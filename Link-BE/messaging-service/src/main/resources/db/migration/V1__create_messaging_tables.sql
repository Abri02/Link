SET search_path TO messaging;

CREATE TABLE workspace (
    id         BIGSERIAL    PRIMARY KEY,
    name       VARCHAR(100) NOT NULL,
    slug       VARCHAR(100) NOT NULL UNIQUE,
    owner_id   BIGINT       NOT NULL,
    created_at TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE TABLE workspace_member (
    id           BIGSERIAL   PRIMARY KEY,
    workspace_id BIGINT      NOT NULL REFERENCES workspace(id),
    user_id      BIGINT      NOT NULL,
    role         VARCHAR(20) NOT NULL,
    UNIQUE (workspace_id, user_id)
);

CREATE TABLE channel (
    id           BIGSERIAL   PRIMARY KEY,
    workspace_id BIGINT      NOT NULL REFERENCES workspace(id),
    name         VARCHAR(80) NOT NULL,
    kind         VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    created_by   BIGINT      NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, name)
);

CREATE TABLE channel_member (
    id         BIGSERIAL PRIMARY KEY,
    channel_id BIGINT    NOT NULL REFERENCES channel(id),
    user_id    BIGINT    NOT NULL,
    UNIQUE (channel_id, user_id)
);

CREATE TABLE message (
    id                BIGSERIAL   PRIMARY KEY,
    channel_id        BIGINT      NOT NULL REFERENCES channel(id),
    author_id         BIGINT      NOT NULL,
    body              TEXT        NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    edited_at         TIMESTAMPTZ,
    deleted_at        TIMESTAMPTZ,
    parent_message_id BIGINT      REFERENCES message(id)
);

CREATE INDEX ON message (channel_id, created_at DESC);
