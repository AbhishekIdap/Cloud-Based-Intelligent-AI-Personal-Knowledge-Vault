CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

CREATE TABLE users (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name              TEXT NOT NULL,
  email             CITEXT UNIQUE NOT NULL,
  password_hash     TEXT NOT NULL,          
  avatar_initials   TEXT,
  avatar_color      TEXT DEFAULT 'sage',  
  plan              TEXT DEFAULT 'LifeGraph Personal',
  storage_cap_kb    BIGINT NOT NULL DEFAULT (15 * 1024 * 1024), 
  theme             TEXT NOT NULL DEFAULT 'light',           
  show_hidden       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);


CREATE TABLE notification_preferences (
  user_id                 UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  uploads                 BOOLEAN NOT NULL DEFAULT TRUE,
  reminders               BOOLEAN NOT NULL DEFAULT TRUE,
  collection_activity     BOOLEAN NOT NULL DEFAULT TRUE,
  security                BOOLEAN NOT NULL DEFAULT TRUE,
  weekly_digest           BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE collections (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT DEFAULT '',
  icon          TEXT DEFAULT '📁',          
  color         TEXT DEFAULT 'sage',         
  keywords      TEXT[] DEFAULT '{}',        
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_collections_user ON collections(user_id);

CREATE TYPE file_category AS ENUM ('note', 'document', 'pdf', 'photo', 'video', 'recording');

CREATE TABLE files (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  collection_id     UUID REFERENCES collections(id) ON DELETE SET NULL,
  name              TEXT NOT NULL,
  category          file_category NOT NULL,
  category_source   TEXT NOT NULL DEFAULT 'rule_based', 
  size_kb           BIGINT NOT NULL DEFAULT 0,
  storage_url       TEXT,                    
  thumbnail_url     TEXT,                 
  mime_type         TEXT,
  note_content      TEXT,                    
  description       TEXT,                    
  ai_summary        TEXT,                   
  ai_summary_status TEXT NOT NULL DEFAULT 'skipped', 
  starred           BOOLEAN NOT NULL DEFAULT FALSE,
  hidden            BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  viewed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_files_user ON files(user_id);
CREATE INDEX idx_files_collection ON files(collection_id);
CREATE INDEX idx_files_category ON files(user_id, category);
CREATE INDEX idx_files_starred ON files(user_id, starred) WHERE starred = TRUE;
CREATE INDEX idx_files_hidden ON files(user_id, hidden) WHERE hidden = TRUE;
CREATE INDEX idx_files_name_trgm ON files USING gin (name gin_trgm_ops); 
CREATE INDEX idx_files_description_trgm ON files USING gin (description gin_trgm_ops);
CREATE INDEX idx_files_ai_summary_trgm ON files USING gin (ai_summary gin_trgm_ops);



CREATE TABLE reminders (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  due_at        TIMESTAMPTZ NOT NULL,
  done          BOOLEAN NOT NULL DEFAULT FALSE,
  related_file_id       UUID REFERENCES files(id) ON DELETE SET NULL,
  related_collection_id UUID REFERENCES collections(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_reminders_user_due ON reminders(user_id, due_at) WHERE done = FALSE;


CREATE TYPE notification_kind AS ENUM ('upload', 'reminder', 'storage', 'collection', 'digest', 'security');

CREATE TABLE notifications (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind          notification_kind NOT NULL,
  title         TEXT NOT NULL,
  body          TEXT NOT NULL,
  read          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, read) WHERE read = FALSE;

CREATE TABLE assistant_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role          TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content       TEXT NOT NULL,
  referenced_file_ids UUID[] DEFAULT '{}',   
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_assistant_messages_user ON assistant_messages(user_id, created_at);

CREATE TABLE account_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL,            
  metadata      JSONB DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE VIEW storage_by_category AS
SELECT
  user_id,
  category,
  COUNT(*)              AS file_count,
  COALESCE(SUM(size_kb), 0) AS total_kb
FROM files
GROUP BY user_id, category;

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_collections_updated_at BEFORE UPDATE ON collections
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
CREATE TRIGGER trg_files_updated_at BEFORE UPDATE ON files
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();


-- ============================================================================
