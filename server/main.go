package main

import (
	"context"
	"database/sql"
	"embed"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/lib/pq"
)

//go:embed migrations/*.sql
var migrationFS embed.FS

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

func main() {
	dsn := env("DATABASE_URL", "postgres://tallytag:tallytag@localhost:5432/tallytag?sslmode=disable")
	db, err := sql.Open("postgres", dsn)
	if err != nil {
		log.Fatal(err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	for {
		if err = db.PingContext(ctx); err == nil {
			break
		}
		if ctx.Err() != nil {
			log.Fatalf("database not reachable: %v", err)
		}
		time.Sleep(time.Second)
	}
	if err := migrate(db); err != nil {
		log.Fatalf("migration failed: %v", err)
	}

	photoDir := env("PHOTO_DIR", "./data/photos")
	if err := os.MkdirAll(photoDir, 0o755); err != nil {
		log.Fatal(err)
	}

	s := &Server{
		db:        db,
		hub:       newHub(),
		photoDir:  photoDir,
		joinTTL:   envDuration("JOIN_TOKEN_TTL", 10*time.Minute),
		allowedOr: env("ALLOWED_ORIGIN", "*"),
	}
	addr := env("ADDR", ":8080")
	log.Printf("TALLYTAG server listening on %s", addr)
	log.Fatal(http.ListenAndServe(addr, s.routes()))
}

func envDuration(key string, fallback time.Duration) time.Duration {
	if v := os.Getenv(key); v != "" {
		if d, err := time.ParseDuration(v); err == nil {
			return d
		}
	}
	return fallback
}

func migrate(db *sql.DB) error {
	entries, err := migrationFS.ReadDir("migrations")
	if err != nil {
		return err
	}
	for _, e := range entries {
		b, err := migrationFS.ReadFile("migrations/" + e.Name())
		if err != nil {
			return err
		}
		if _, err := db.Exec(string(b)); err != nil {
			return err
		}
	}
	return nil
}
