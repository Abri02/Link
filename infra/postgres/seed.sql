-- Seed script for local development.
-- Run AFTER docker compose up and all services have started.
-- Requires two users to exist in auth.auth_user (created via /api/auth/signup).
-- Usage: psql -h localhost -U link -d link -f infra/postgres/seed.sql

DO $$
DECLARE
  user1_id BIGINT;
  user2_id BIGINT;
  ws_id    BIGINT;
  ch_id    BIGINT;
BEGIN
  -- grab the first two users
  SELECT id INTO user1_id FROM auth.auth_user ORDER BY id LIMIT 1;
  SELECT id INTO user2_id FROM auth.auth_user ORDER BY id OFFSET 1 LIMIT 1;

  IF user1_id IS NULL THEN
    RAISE EXCEPTION 'No users found — sign up at least one user first';
  END IF;

  -- workspace
  INSERT INTO messaging.workspace (name, slug, owner_id)
  VALUES ('Link HQ', 'link-hq', user1_id)
  ON CONFLICT (slug) DO NOTHING
  RETURNING id INTO ws_id;

  IF ws_id IS NULL THEN
    SELECT id INTO ws_id FROM messaging.workspace WHERE slug = 'link-hq';
  END IF;

  -- workspace members
  INSERT INTO messaging.workspace_member (workspace_id, user_id, role)
  VALUES (ws_id, user1_id, 'OWNER')
  ON CONFLICT (workspace_id, user_id) DO NOTHING;

  IF user2_id IS NOT NULL THEN
    INSERT INTO messaging.workspace_member (workspace_id, user_id, role)
    VALUES (ws_id, user2_id, 'MEMBER')
    ON CONFLICT (workspace_id, user_id) DO NOTHING;
  END IF;

  -- general channel
  INSERT INTO messaging.channel (workspace_id, name, kind, created_by)
  VALUES (ws_id, 'general', 'PUBLIC', user1_id)
  ON CONFLICT (workspace_id, name) DO NOTHING
  RETURNING id INTO ch_id;

  IF ch_id IS NULL THEN
    SELECT id INTO ch_id FROM messaging.channel WHERE workspace_id = ws_id AND name = 'general';
  END IF;

  -- channel members
  INSERT INTO messaging.channel_member (channel_id, user_id)
  VALUES (ch_id, user1_id)
  ON CONFLICT (channel_id, user_id) DO NOTHING;

  IF user2_id IS NOT NULL THEN
    INSERT INTO messaging.channel_member (channel_id, user_id)
    VALUES (ch_id, user2_id)
    ON CONFLICT (channel_id, user_id) DO NOTHING;
  END IF;

  -- seed messages
  FOR i IN 1..10 LOOP
    INSERT INTO messaging.message (channel_id, author_id, body, created_at)
    VALUES (
      ch_id,
      CASE WHEN i % 2 = 1 THEN user1_id ELSE COALESCE(user2_id, user1_id) END,
      'Seed message #' || i || ' — hello from the Link seed script!',
      NOW() - ((10 - i) * INTERVAL '1 minute')
    );
  END LOOP;

  RAISE NOTICE 'Seed complete. workspace_id=%, channel_id=%', ws_id, ch_id;
END $$;
