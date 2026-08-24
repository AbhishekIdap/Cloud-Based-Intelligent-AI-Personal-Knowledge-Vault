-- ============================================================================
-- Migration 002 — manual + AI-generated file descriptions, searchable.
-- ============================================================================
-- Run this once against your EXISTING database (schema.sql already has these
-- columns for anyone doing a fresh install, so this file is only needed if
-- you already ran `npm run migrate` before this change landed).
--
-- Safe to re-run: every statement is guarded with IF NOT EXISTS, and no
-- existing rows or columns are touched — this only adds new, nullable
-- columns and indexes.
--
-- How to run it:
--   Local Postgres:   psql "$DATABASE_URL" -f backend/migrations/002_manual_and_ai_descriptions.sql
--   Docker Compose:    docker compose exec -T postgres psql -U lifegraph -d lifegraph
--                         < backend/migrations/002_manual_and_ai_descriptions.sql
-- ============================================================================

ALTER TABLE files ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE files ADD COLUMN IF NOT EXISTS ai_summary_status TEXT NOT NULL DEFAULT 'skipped';

CREATE INDEX IF NOT EXISTS idx_files_description_trgm ON files USING gin (description gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_files_ai_summary_trgm ON files USING gin (ai_summary gin_trgm_ops);
