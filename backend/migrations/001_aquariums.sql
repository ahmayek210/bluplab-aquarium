BEGIN;
CREATE TABLE IF NOT EXISTS aquariums (
  id uuid PRIMARY KEY,
  owner_hash text NOT NULL UNIQUE CHECK (owner_hash ~ '^[0-9a-f]{64}$'),
  viewer_hash text UNIQUE CHECK (viewer_hash ~ '^[0-9a-f]{64}$'),
  revision integer NOT NULL DEFAULT 1 CHECK (revision > 0),
  document jsonb NOT NULL CHECK (jsonb_typeof(document) = 'object' AND document @> '{"version":1}'::jsonb AND octet_length(document::text) <= 900000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS creation_windows (
  window_start timestamptz NOT NULL,
  client_hash text NOT NULL,
  attempts integer NOT NULL CHECK (attempts > 0),
  PRIMARY KEY (window_start, client_hash)
);
COMMIT;
