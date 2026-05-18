CREATE TABLE IF NOT EXISTS files.attachment (
    id          BIGSERIAL PRIMARY KEY,
    uploader_id BIGINT        NOT NULL,
    filename    TEXT          NOT NULL,
    mime_type   TEXT          NOT NULL,
    size_bytes  BIGINT        NOT NULL,
    object_key  TEXT          NOT NULL,
    created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);
