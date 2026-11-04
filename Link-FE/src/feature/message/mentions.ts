/**
 * `@username` parsing. Mirrors the backend `MentionParser`: a mention starts at the beginning of
 * the text or after a character that can't be part of a word, so `mail@bob.com` is not one.
 */
const NAME = String.raw`[\p{L}\p{N}_.\-]`;
const MENTION_RE = new RegExp(String.raw`(?<![\p{L}\p{N}_@.\-])@(${NAME}+)`, "gu");
/** An unfinished `@name` right before the caret. */
const ACTIVE_RE = new RegExp(String.raw`(?:^|[^\p{L}\p{N}_@.\-])@(${NAME}*)$`, "u");

export type Segment = { text: string; mention?: string };

/**
 * Finds which username a token refers to: an exact match first, then without trailing sentence
 * punctuation (`@bob.`), then case-insensitively when that's unambiguous.
 */
function resolve(token: string, usernames: string[]): string | undefined {
  const trimmed = token.replace(/[.-]+$/, "");
  const exact = usernames.find((u) => u === token) ?? usernames.find((u) => u === trimmed);
  if (exact) return exact;
  for (const t of [token, trimmed]) {
    const hits = usernames.filter((u) => u.toLowerCase() === t.toLowerCase());
    if (hits.length === 1) return hits[0];
  }
  return undefined;
}

/** Splits a message body into plain text and `@mention` segments for known usernames. */
export function splitMentions(body: string, usernames: string[]): Segment[] {
  const segments: Segment[] = [];
  let last = 0;
  for (const match of body.matchAll(MENTION_RE)) {
    const username = resolve(match[1], usernames);
    if (!username) continue;
    // Only the matched name is highlighted. Trailing punctuation stays plain text.
    const start = match.index!;
    const end = start + 1 + username.length;
    if (start > last) segments.push({ text: body.slice(last, start) });
    segments.push({ text: body.slice(start, end), mention: username });
    last = end;
  }
  if (last < body.length) segments.push({ text: body.slice(last) });
  return segments;
}

/** The partial name typed after `@` right before the caret, or null when not typing a mention. */
export function activeMentionQuery(textBeforeCaret: string): string | null {
  const match = ACTIVE_RE.exec(textBeforeCaret);
  return match ? match[1] : null;
}
