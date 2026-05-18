SET search_path TO messaging;

CREATE TABLE message_reaction (
    id         BIGSERIAL   PRIMARY KEY,
    message_id BIGINT      NOT NULL REFERENCES message(id) ON DELETE CASCADE,
    user_id    BIGINT      NOT NULL,
    emoji      VARCHAR(10) NOT NULL,
    UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX ON message_reaction (message_id);
