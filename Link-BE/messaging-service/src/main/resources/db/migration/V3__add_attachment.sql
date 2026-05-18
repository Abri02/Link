ALTER TABLE messaging.message
    ADD COLUMN IF NOT EXISTS attachment_url  TEXT,
    ADD COLUMN IF NOT EXISTS attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS attachment_mime TEXT;
