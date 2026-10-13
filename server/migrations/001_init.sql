CREATE TABLE IF NOT EXISTS surveys (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  building text NOT NULL DEFAULT '',
  leader_token text NOT NULL UNIQUE,
  join_token text NOT NULL UNIQUE,
  join_expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assets (
  id bigserial PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  tag_number text NOT NULL,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT '',
  building text NOT NULL DEFAULT '',
  floor text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  UNIQUE (survey_id, tag_number)
);

CREATE TABLE IF NOT EXISTS photos (
  id uuid PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  content_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- One row per recorded check. The id is made by the phone, so a retry never duplicates it.
CREATE TABLE IF NOT EXISTS checks (
  id uuid PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES surveys(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES members(id),
  tag_number text NOT NULL,
  condition text NOT NULL CHECK (condition IN ('working','needs_repair','unserviceable','missing')),
  notes text NOT NULL DEFAULT '',
  room text NOT NULL DEFAULT '',
  photo_id uuid REFERENCES photos(id),
  scanned_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS checks_survey_tag ON checks (survey_id, tag_number, scanned_at DESC);
