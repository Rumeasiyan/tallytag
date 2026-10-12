package main

import (
	"context"
	"database/sql"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

type Server struct {
	db        *sql.DB
	hub       *Hub
	photoDir  string
	joinTTL   time.Duration
	allowedOr string
}

func (s *Server) routes() http.Handler {
	m := http.NewServeMux()
	m.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		writeJSON(w, 200, map[string]string{"status": "ok"})
	})
	m.HandleFunc("POST /api/v1/surveys", s.createSurvey)
	m.HandleFunc("GET /api/v1/surveys/{id}", s.getSurvey)
	m.HandleFunc("POST /api/v1/surveys/{id}/join-token", s.renewJoinToken)
	m.HandleFunc("POST /api/v1/join", s.join)
	m.HandleFunc("POST /api/v1/scans", s.postScan)
	m.HandleFunc("POST /api/v1/scans/batch", s.postScanBatch)
	m.HandleFunc("GET /api/v1/surveys/{id}/items", s.getItems)
	m.HandleFunc("POST /api/v1/surveys/{id}/assets", s.importAssets)
	m.HandleFunc("GET /api/v1/surveys/{id}/export.csv", s.exportCSV)
	m.HandleFunc("GET /api/v1/surveys/{id}/report", s.getReport)
	m.HandleFunc("GET /api/v1/surveys/{id}/live", s.live)
	m.HandleFunc("POST /api/v1/photos", s.postPhoto)
	m.HandleFunc("GET /api/v1/photos/{id}", s.getPhoto)
	return s.cors(m)
}

func (s *Server) cors(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", s.allowedOr)
		w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// ---------- auth ----------

type principal struct {
	leader     bool
	surveyID   string
	memberID   string
	memberName string
}

func (s *Server) auth(r *http.Request) (principal, bool) {
	tok := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
	if tok == "" {
		tok = r.URL.Query().Get("token") // for EventSource and <img>, which cannot set headers
	}
	var p principal
	switch {
	case strings.HasPrefix(tok, "lt_"):
		err := s.db.QueryRowContext(r.Context(), `SELECT id FROM surveys WHERE leader_token=$1`, tok).Scan(&p.surveyID)
		p.leader = true
		return p, err == nil
	case strings.HasPrefix(tok, "mt_"):
		err := s.db.QueryRowContext(r.Context(), `SELECT id, survey_id, name FROM members WHERE token=$1`, tok).
			Scan(&p.memberID, &p.surveyID, &p.memberName)
		return p, err == nil
	}
	return p, false
}

func (s *Server) requireLeader(w http.ResponseWriter, r *http.Request) (principal, bool) {
	p, ok := s.auth(r)
	if !ok || !p.leader || p.surveyID != r.PathValue("id") {
		writeErr(w, 401, "unauthorized", "Sign in as the survey leader.")
		return p, false
	}
	return p, true
}

func (s *Server) requireMember(w http.ResponseWriter, r *http.Request) (principal, bool) {
	p, ok := s.auth(r)
	if !ok || p.leader {
		writeErr(w, 401, "unauthorized", "Join the survey first.")
		return p, false
	}
	return p, true
}

// ---------- surveys and joining ----------

func (s *Server) createSurvey(w http.ResponseWriter, r *http.Request) {
	var req struct{ Name, Building string }
	if !readJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 200 {
		writeErr(w, 400, "invalid_name", "Give the survey a name.")
		return
	}
	id, lt, jt := newUUID(), newToken("lt_"), newToken("jt_")
	exp := time.Now().Add(s.joinTTL).UTC()
	_, err := s.db.ExecContext(r.Context(),
		`INSERT INTO surveys (id,name,building,leader_token,join_token,join_expires_at) VALUES ($1,$2,$3,$4,$5,$6)`,
		id, req.Name, strings.TrimSpace(req.Building), lt, jt, exp)
	if err != nil {
		writeErr(w, 500, "server_error", "Could not create the survey.")
		return
	}
	writeJSON(w, 201, map[string]any{"surveyId": id, "leaderToken": lt, "joinToken": jt, "joinExpiresAt": exp})
}

func (s *Server) getSurvey(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	var name, building, jt string
	var exp, created time.Time
	err := s.db.QueryRowContext(r.Context(),
		`SELECT name,building,join_token,join_expires_at,created_at FROM surveys WHERE id=$1`, p.surveyID).
		Scan(&name, &building, &jt, &exp, &created)
	if err != nil {
		writeErr(w, 404, "survey_not_found", "Survey not found.")
		return
	}
	members, _ := s.listMembers(r.Context(), p.surveyID)
	writeJSON(w, 200, map[string]any{"surveyId": p.surveyID, "name": name, "building": building,
		"joinToken": jt, "joinExpiresAt": exp.UTC(), "createdAt": created.UTC(), "members": members})
}

func (s *Server) renewJoinToken(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	jt := newToken("jt_")
	exp := time.Now().Add(s.joinTTL).UTC()
	if _, err := s.db.ExecContext(r.Context(), `UPDATE surveys SET join_token=$1, join_expires_at=$2 WHERE id=$3`, jt, exp, p.surveyID); err != nil {
		writeErr(w, 500, "server_error", "Could not make a new QR code.")
		return
	}
	writeJSON(w, 200, map[string]any{"joinToken": jt, "joinExpiresAt": exp})
}

type memberInfo struct {
	MemberID string    `json:"memberId"`
	Name     string    `json:"name"`
	JoinedAt time.Time `json:"joinedAt"`
	Checks   int       `json:"checks"`
}

func (s *Server) listMembers(ctx context.Context, surveyID string) ([]memberInfo, error) {
	rows, err := s.db.QueryContext(ctx, `
		SELECT m.id, m.name, m.created_at, (SELECT COUNT(*) FROM checks c WHERE c.member_id=m.id)
		FROM members m WHERE m.survey_id=$1 ORDER BY m.created_at`, surveyID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []memberInfo{}
	for rows.Next() {
		var m memberInfo
		if err := rows.Scan(&m.MemberID, &m.Name, &m.JoinedAt, &m.Checks); err != nil {
			return nil, err
		}
		m.JoinedAt = m.JoinedAt.UTC()
		out = append(out, m)
	}
	return out, rows.Err()
}

func (s *Server) join(w http.ResponseWriter, r *http.Request) {
	var req struct {
		JoinToken string `json:"joinToken"`
		Name      string `json:"name"`
	}
	if !readJSON(w, r, &req) {
		return
	}
	req.Name = strings.TrimSpace(req.Name)
	if req.Name == "" || len(req.Name) > 100 {
		writeErr(w, 400, "invalid_name", "Enter your name.")
		return
	}
	var sid, sname string
	var exp time.Time
	err := s.db.QueryRowContext(r.Context(), `SELECT id,name,join_expires_at FROM surveys WHERE join_token=$1`, req.JoinToken).Scan(&sid, &sname, &exp)
	if errors.Is(err, sql.ErrNoRows) {
		writeErr(w, 404, "join_token_not_found", "This QR code is not valid.")
		return
	} else if err != nil {
		writeErr(w, 500, "server_error", "Could not join.")
		return
	}
	if time.Now().After(exp) {
		writeErr(w, 410, "join_token_expired", "This QR code has expired.")
		return
	}
	mid, mt := newUUID(), newToken("mt_")
	if _, err := s.db.ExecContext(r.Context(), `INSERT INTO members (id,survey_id,name,token) VALUES ($1,$2,$3,$4)`, mid, sid, req.Name, mt); err != nil {
		writeErr(w, 500, "server_error", "Could not join.")
		return
	}
	s.publish(sid, map[string]any{"type": "member.joined", "member": map[string]any{"memberId": mid, "name": req.Name}})
	writeJSON(w, 201, map[string]any{"memberId": mid, "memberToken": mt, "surveyId": sid, "surveyName": sname})
}

func (s *Server) publish(surveyID string, v any) {
	b, _ := json.Marshal(v)
	s.hub.publish(surveyID, b)
}

// ---------- scans ----------

type scanReq struct {
	ID        string `json:"id"`
	TagNumber string `json:"tagNumber"`
	Condition string `json:"condition"`
	Notes     string `json:"notes"`
	Room      string `json:"room"`
	PhotoID   string `json:"photoId"`
	ScannedAt string `json:"scannedAt"`
}

type scanResp struct {
	ID     string `json:"id"`
	Result string `json:"result"` // created | duplicate | error
	Error  string `json:"error,omitempty"`
	Item   *Item  `json:"item,omitempty"`
}

func (s *Server) postScan(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireMember(w, r)
	if !ok {
		return
	}
	var req scanReq
	if !readJSON(w, r, &req) {
		return
	}
	res := s.processScan(r.Context(), p, req)
	if res.Result == "error" {
		writeErr(w, 400, res.Error, "The scan could not be saved.")
		return
	}
	status := 200
	if res.Result == "created" {
		status = 201
	}
	writeJSON(w, status, res)
}

// postScanBatch is how a phone sends everything it collected while offline.
func (s *Server) postScanBatch(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireMember(w, r)
	if !ok {
		return
	}
	var req struct {
		Scans []scanReq `json:"scans"`
	}
	r.Body = http.MaxBytesReader(w, r.Body, 4<<20)
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil || len(req.Scans) > 500 {
		writeErr(w, 400, "bad_json", "Send up to 500 scans as JSON.")
		return
	}
	out := make([]scanResp, 0, len(req.Scans))
	for _, sc := range req.Scans {
		out = append(out, s.processScan(r.Context(), p, sc))
	}
	writeJSON(w, 200, map[string]any{"results": out})
}

func (s *Server) processScan(ctx context.Context, p principal, req scanReq) scanResp {
	fail := func(code string) scanResp { return scanResp{ID: req.ID, Result: "error", Error: code} }
	if !isUUID(req.ID) {
		return fail("invalid_id")
	}
	tag := normalizeTag(req.TagNumber)
	if tag == "" || len(tag) > 100 {
		return fail("invalid_tag")
	}
	if !validConditions[req.Condition] {
		return fail("invalid_condition")
	}
	at := time.Now().UTC()
	if req.ScannedAt != "" {
		t, err := time.Parse(time.RFC3339, req.ScannedAt)
		if err != nil {
			return fail("invalid_time")
		}
		at = t.UTC()
	}
	var photo any
	if isUUID(req.PhotoID) {
		var n int
		_ = s.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM photos WHERE id=$1 AND survey_id=$2`, req.PhotoID, p.surveyID).Scan(&n)
		if n == 1 {
			photo = req.PhotoID
		}
	}
	if len(req.Notes) > 2000 {
		req.Notes = req.Notes[:2000]
	}
	res, err := s.db.ExecContext(ctx, `
		INSERT INTO checks (id,survey_id,member_id,tag_number,condition,notes,room,photo_id,scanned_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (id) DO NOTHING`,
		strings.ToLower(req.ID), p.surveyID, p.memberID, tag, req.Condition, req.Notes, strings.TrimSpace(req.Room), photo, at)
	if err != nil {
		return fail("server_error")
	}
	n, _ := res.RowsAffected()
	items, _ := s.queryItems(ctx, p.surveyID, tag)
	var item *Item
	if len(items) == 1 {
		item = &items[0]
	}
	result := "duplicate"
	if n == 1 {
		result = "created"
		s.publish(p.surveyID, map[string]any{"type": "scan.recorded", "item": item})
	}
	return scanResp{ID: req.ID, Result: result, Item: item}
}

// ---------- the list ----------

type Item struct {
	TagNumber   string  `json:"tagNumber"`
	Description string  `json:"description"`
	Category    string  `json:"category"`
	Building    string  `json:"building"`
	Floor       string  `json:"floor"`
	Room        string  `json:"room"`
	Status      string  `json:"status"` // found | missing | extra
	Condition   *string `json:"condition"`
	Notes       string  `json:"notes"`
	PhotoID     *string `json:"photoId"`
	CheckedBy   *string `json:"checkedBy"`
	CheckedAt   *string `json:"checkedAt"`
	Conflict    bool    `json:"conflict"`
	OnList      bool    `json:"onList"`
}

const itemsSQL = `
WITH latest AS (
  SELECT DISTINCT ON (c.tag_number) c.tag_number, c.condition, c.notes, c.room, c.photo_id, c.scanned_at, m.name AS checked_by
  FROM checks c JOIN members m ON m.id = c.member_id
  WHERE c.survey_id = $1 AND ($2 = '' OR c.tag_number = $2)
  ORDER BY c.tag_number, c.scanned_at DESC, c.created_at DESC
), conf AS (
  SELECT tag_number, COUNT(DISTINCT condition) > 1 AS conflict
  FROM checks WHERE survey_id = $1 AND ($2 = '' OR tag_number = $2) GROUP BY tag_number
)
SELECT COALESCE(a.tag_number, l.tag_number),
       COALESCE(a.description,''), COALESCE(a.category,''), COALESCE(a.building,''), COALESCE(a.floor,''),
       COALESCE(NULLIF(l.room,''), a.room, ''),
       l.condition, COALESCE(l.notes,''), l.photo_id::text, l.checked_by, l.scanned_at,
       COALESCE(cf.conflict, false), (a.id IS NOT NULL)
FROM (SELECT * FROM assets WHERE survey_id = $1 AND ($2 = '' OR tag_number = $2)) a
FULL OUTER JOIN latest l ON l.tag_number = a.tag_number
LEFT JOIN conf cf ON cf.tag_number = COALESCE(a.tag_number, l.tag_number)
ORDER BY 1`

func (s *Server) queryItems(ctx context.Context, surveyID, tag string) ([]Item, error) {
	rows, err := s.db.QueryContext(ctx, itemsSQL, surveyID, tag)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	items := []Item{}
	for rows.Next() {
		var it Item
		var cond, photo, by sql.NullString
		var at sql.NullTime
		if err := rows.Scan(&it.TagNumber, &it.Description, &it.Category, &it.Building, &it.Floor, &it.Room,
			&cond, &it.Notes, &photo, &by, &at, &it.Conflict, &it.OnList); err != nil {
			return nil, err
		}
		if cond.Valid {
			it.Condition = &cond.String
		}
		if photo.Valid {
			it.PhotoID = &photo.String
		}
		if by.Valid {
			it.CheckedBy = &by.String
		}
		if at.Valid {
			t := at.Time.UTC().Format(time.RFC3339)
			it.CheckedAt = &t
		}
		switch {
		case !it.OnList:
			it.Status = "extra"
		case it.Condition == nil || *it.Condition == "missing":
			it.Status = "missing"
		default:
			it.Status = "found"
		}
		items = append(items, it)
	}
	return items, rows.Err()
}

type Counts struct {
	Total          int `json:"total"`
	Found          int `json:"found"`
	Missing        int `json:"missing"`
	Extra          int `json:"extra"`
	NeedsAttention int `json:"needsAttention"`
	Conflicts      int `json:"conflicts"`
}

func countItems(items []Item) Counts {
	var c Counts
	for _, it := range items {
		c.Total++
		switch it.Status {
		case "found":
			c.Found++
		case "missing":
			c.Missing++
		case "extra":
			c.Extra++
		}
		if it.Condition != nil && (*it.Condition == "needs_repair" || *it.Condition == "unserviceable" || *it.Condition == "missing") {
			c.NeedsAttention++
		}
		if it.Conflict {
			c.Conflicts++
		}
	}
	return c
}

func (s *Server) getItems(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	items, err := s.queryItems(r.Context(), p.surveyID, "")
	if err != nil {
		writeErr(w, 500, "server_error", "Could not read the list.")
		return
	}
	writeJSON(w, 200, map[string]any{"counts": countItems(items), "items": items})
}

func (s *Server) getReport(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	var name, building string
	var created time.Time
	if err := s.db.QueryRowContext(r.Context(), `SELECT name,building,created_at FROM surveys WHERE id=$1`, p.surveyID).Scan(&name, &building, &created); err != nil {
		writeErr(w, 404, "survey_not_found", "Survey not found.")
		return
	}
	items, err := s.queryItems(r.Context(), p.surveyID, "")
	if err != nil {
		writeErr(w, 500, "server_error", "Could not build the report.")
		return
	}
	members, _ := s.listMembers(r.Context(), p.surveyID)
	writeJSON(w, 200, map[string]any{
		"survey":      map[string]any{"id": p.surveyID, "name": name, "building": building, "createdAt": created.UTC()},
		"generatedAt": time.Now().UTC(), "counts": countItems(items), "items": items, "members": members,
	})
}

// ---------- asset list import and export ----------

func (s *Server) importAssets(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 5<<20)
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		writeErr(w, 400, "too_large", "The file is too large.")
		return
	}
	text := strings.TrimPrefix(string(raw), "\ufeff")
	cr := csv.NewReader(strings.NewReader(text))
	cr.FieldsPerRecord = -1
	cr.TrimLeadingSpace = true
	rows, err := cr.ReadAll()
	if err != nil || len(rows) < 2 {
		writeErr(w, 400, "invalid_csv", "The file must be a CSV with a header row and at least one asset.")
		return
	}
	col := map[string]int{}
	for i, h := range rows[0] {
		col[strings.ToLower(strings.TrimSpace(h))] = i
	}
	ti, found := col["tag_number"]
	if !found {
		writeErr(w, 400, "missing_tag_column", "The header row needs a tag_number column.")
		return
	}
	get := func(row []string, name string) string {
		if i, ok := col[name]; ok && i < len(row) {
			return strings.TrimSpace(row[i])
		}
		return ""
	}
	tx, err := s.db.BeginTx(r.Context(), nil)
	if err != nil {
		writeErr(w, 500, "server_error", "Could not import.")
		return
	}
	defer tx.Rollback()
	if r.URL.Query().Get("mode") == "replace" {
		if _, err := tx.Exec(`DELETE FROM assets WHERE survey_id=$1`, p.surveyID); err != nil {
			writeErr(w, 500, "server_error", "Could not import.")
			return
		}
	}
	n := 0
	for _, row := range rows[1:] {
		if ti >= len(row) {
			continue
		}
		tag := normalizeTag(row[ti])
		if tag == "" {
			continue
		}
		_, err := tx.Exec(`
			INSERT INTO assets (survey_id,tag_number,description,category,building,floor,room) VALUES ($1,$2,$3,$4,$5,$6,$7)
			ON CONFLICT (survey_id,tag_number) DO UPDATE SET description=EXCLUDED.description, category=EXCLUDED.category,
			  building=EXCLUDED.building, floor=EXCLUDED.floor, room=EXCLUDED.room`,
			p.surveyID, tag, get(row, "description"), get(row, "category"), get(row, "building"), get(row, "floor"), get(row, "room"))
		if err != nil {
			writeErr(w, 500, "server_error", "Could not import.")
			return
		}
		n++
	}
	if err := tx.Commit(); err != nil {
		writeErr(w, 500, "server_error", "Could not import.")
		return
	}
	s.publish(p.surveyID, map[string]any{"type": "assets.imported", "count": n})
	writeJSON(w, 200, map[string]any{"imported": n})
}

func (s *Server) exportCSV(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	items, err := s.queryItems(r.Context(), p.surveyID, "")
	if err != nil {
		writeErr(w, 500, "server_error", "Could not export.")
		return
	}
	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set("Content-Disposition", `attachment; filename="tallytag-results.csv"`)
	_, _ = w.Write([]byte("\ufeff")) // so Excel reads Sinhala and Tamil correctly
	cw := csv.NewWriter(w)
	_ = cw.Write([]string{"tag_number", "description", "category", "building", "floor", "room", "status", "condition", "notes", "checked_by", "checked_at", "conflict"})
	str := func(p *string) string {
		if p == nil {
			return ""
		}
		return *p
	}
	for _, it := range items {
		_ = cw.Write([]string{csvSafe(it.TagNumber), csvSafe(it.Description), csvSafe(it.Category), csvSafe(it.Building), csvSafe(it.Floor),
			csvSafe(it.Room), it.Status, str(it.Condition), csvSafe(it.Notes), csvSafe(str(it.CheckedBy)), str(it.CheckedAt), fmt.Sprint(it.Conflict)})
	}
	cw.Flush()
}

// ---------- live updates (Server-Sent Events) ----------

func (s *Server) live(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireLeader(w, r)
	if !ok {
		return
	}
	fl, ok := w.(http.Flusher)
	if !ok {
		writeErr(w, 500, "no_streaming", "Streaming is not supported.")
		return
	}
	w.Header().Set("Content-Type", "text/event-stream")
	w.Header().Set("Cache-Control", "no-cache")
	w.Header().Set("X-Accel-Buffering", "no")
	ch := s.hub.subscribe(p.surveyID)
	defer s.hub.unsubscribe(p.surveyID, ch)
	fmt.Fprint(w, ": connected\n\n")
	fl.Flush()
	tick := time.NewTicker(20 * time.Second)
	defer tick.Stop()
	for {
		select {
		case <-r.Context().Done():
			return
		case msg := <-ch:
			fmt.Fprintf(w, "data: %s\n\n", msg)
			fl.Flush()
		case <-tick.C:
			fmt.Fprint(w, ": ping\n\n")
			fl.Flush()
		}
	}
}

// ---------- photos ----------

func (s *Server) postPhoto(w http.ResponseWriter, r *http.Request) {
	p, ok := s.requireMember(w, r)
	if !ok {
		return
	}
	id := r.URL.Query().Get("id")
	if !isUUID(id) {
		id = newUUID()
	}
	id = strings.ToLower(id)
	r.Body = http.MaxBytesReader(w, r.Body, 8<<20)
	data, err := io.ReadAll(r.Body)
	if err != nil || len(data) == 0 {
		writeErr(w, 400, "invalid_photo", "The photo is empty or larger than 8 MB.")
		return
	}
	ct := http.DetectContentType(data)
	if ct != "image/jpeg" && ct != "image/png" && ct != "image/webp" && ct != "image/gif" {
		writeErr(w, 400, "invalid_photo", "Only JPEG, PNG, WebP or GIF photos are accepted.")
		return
	}
	res, err := s.db.ExecContext(r.Context(), `INSERT INTO photos (id,survey_id,content_type) VALUES ($1,$2,$3) ON CONFLICT (id) DO NOTHING`, id, p.surveyID, ct)
	if err != nil {
		writeErr(w, 500, "server_error", "Could not save the photo.")
		return
	}
	if n, _ := res.RowsAffected(); n == 1 {
		if err := os.WriteFile(filepath.Join(s.photoDir, id), data, 0o644); err != nil {
			_, _ = s.db.Exec(`DELETE FROM photos WHERE id=$1`, id)
			writeErr(w, 500, "server_error", "Could not save the photo.")
			return
		}
	}
	writeJSON(w, 201, map[string]string{"photoId": id})
}

func (s *Server) getPhoto(w http.ResponseWriter, r *http.Request) {
	p, ok := s.auth(r)
	id := strings.ToLower(r.PathValue("id"))
	if !ok || !isUUID(id) {
		writeErr(w, 401, "unauthorized", "Sign in first.")
		return
	}
	var ct string
	if err := s.db.QueryRowContext(r.Context(), `SELECT content_type FROM photos WHERE id=$1 AND survey_id=$2`, id, p.surveyID).Scan(&ct); err != nil {
		writeErr(w, 404, "photo_not_found", "Photo not found.")
		return
	}
	w.Header().Set("Content-Type", ct)
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Cache-Control", "private, max-age=3600")
	http.ServeFile(w, r, filepath.Join(s.photoDir, id))
}
