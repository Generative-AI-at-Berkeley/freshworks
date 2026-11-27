import { describe, expect, it } from 'vitest';

import { createLogger } from './logger.js';

const TOKEN = 'dev_SECRET_TOKEN_123';
const PAYLOAD = '{"prompt":"synthetic prompt text"}';

describe('createLogger', () => {
  it('redacts tokens, headers and bodies wherever an upload error carries them', () => {
    const lines: string[] = [];
    const logger = createLogger('info', { write: (line: string) => void lines.push(line) });

    // The shape a failed fetch tends to end up in: the request hanging off the error.
    const err = Object.assign(new Error('upload failed'), {
      headers: { authorization: `Bearer ${TOKEN}` },
      body: PAYLOAD,
    });
    logger.error({ err, token: TOKEN, payload: PAYLOAD }, 'flush failed');
    logger.info({ request: { authorization: `Bearer ${TOKEN}`, body: PAYLOAD } }, 'sent');

    const output = lines.join('');
    expect(output).toContain('flush failed');
    expect(output).not.toContain(TOKEN);
    expect(output).not.toContain('synthetic prompt text');
  });
});
