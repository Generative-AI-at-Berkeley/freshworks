import type { TelemetryEvent } from '@fwcoach/contracts';

/**
 * How much of the engineer's work product may leave the machine (spec 7.3).
 * The engineer is identified at every level. This only governs content.
 *
 *   L0  metrics: counts, durations, harness, model, tokens, credits, cost
 *   L1  L0 plus tool names, skill IDs, file extensions, repo folder name
 *   L2  L1 plus prompt and response text. Off unless the engineer opts in,
 *       time-boxed. Not implemented, and must not be until the privacy review
 *       signs off. config.ts refuses it.
 *
 * The agent enforces this locally. The server can ask for less, never more.
 */
export const ContentLevel = { L0: 'L0', L1: 'L1', L2: 'L2' } as const;
export type ContentLevel = (typeof ContentLevel)[keyof typeof ContentLevel];

/**
 * Keys that carry content, paths or tool arguments, compared lowercased with
 * `_` and `-` removed. If one shows up in an event, an adapter mapped the
 * wrong field, and the event is dropped rather than sent. This is a backstop,
 * not the policy: TODO(X-1, AG-2) replace it with a per-event-type allowlist
 * once every event type has a schema. Until then, add a harness's names for
 * the same things here when you find them.
 */
const CONTENT_KEYS = new Set(
  [
    'prompt',
    'prompt_text',
    'response',
    'response_text',
    'message',
    'message_text',
    'content',
    'text',
    'body',
    'file_path',
    'path',
    'notebook_path',
    'cwd',
    'workspace_root',
    'url',
    'uri',
    'command',
    'args',
    'input',
    'tool_input',
    'tool_output',
    'output_text',
    'old_string',
    'new_string',
    'pattern',
    'query',
    'diff',
    'patch',
  ].map(normalizeKey),
);

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[_-]/g, '');
}

// An absolute path, a home-relative path, or a Windows drive path.
const PATH_LIKE = /^(\/|~\/|[a-z]:\\)/i;

export function findContent(value: unknown, at = '$'): string[] {
  if (typeof value === 'string') return PATH_LIKE.test(value) ? [`${at} (path-like value)`] : [];
  if (Array.isArray(value)) return value.flatMap((v, i) => findContent(v, `${at}[${i}]`));
  if (value === null || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, child]) => [
    ...(CONTENT_KEYS.has(normalizeKey(key)) ? [`${at}.${key}`] : []),
    ...findContent(child, `${at}.${key}`),
  ]);
}

export type PolicyResult =
  { action: 'send'; event: TelemetryEvent } | { action: 'drop'; reason: string };

/**
 * Last check before an event enters the buffer. Scans everything an adapter
 * controls: `data`, `ext`, `msg`, and the session and repo blocks.
 *
 * TODO(AG-2): L0 should also strip tool names, skill IDs and file extensions
 * from `data`. Do it per event type once the data schemas exist (X-1).
 */
export function applyPolicy(event: TelemetryEvent, level: ContentLevel): PolicyResult {
  if (level === ContentLevel.L2) {
    return { action: 'drop', reason: 'L2 collection is not implemented' };
  }
  const found = findContent({
    msg: event.msg,
    session: event.session,
    repo: event.repo,
    data: event.data,
    ext: event.ext,
  });
  if (found.length > 0) {
    return { action: 'drop', reason: `content present at ${found.join(', ')}` };
  }
  if (level === ContentLevel.L0) {
    return { action: 'send', event: { ...event, repo: { name: null } } };
  }
  return { action: 'send', event };
}
