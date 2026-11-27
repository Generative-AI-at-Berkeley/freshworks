import { describe, expect, it } from 'vitest';

import { eventId } from './ids.js';

describe('eventId', () => {
  it('is stable for the same parts, which is what makes retries safe', () => {
    expect(eventId('kiro', 'session-1', 42)).toBe(eventId('kiro', 'session-1', 42));
  });

  it('changes when any part changes', () => {
    expect(eventId('kiro', 'session-1', 42)).not.toBe(eventId('kiro', 'session-1', 43));
  });

  it('does not collide when parts are joined differently', () => {
    expect(eventId('ab', 'c')).not.toBe(eventId('a', 'bc'));
  });

  it('is a v5 UUID', () => {
    expect(eventId('x')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });
});
