import type { api } from '@fwcoach/contracts';

import type { DayRange } from '@/lib/range';
import { eachDay } from '@/lib/range';
import { lastDay } from '@/mock/days';
import { MOCK_VIEWER, ORG_UNITS, person, PEOPLE } from '@/mock/org';

/**
 * Mock responses for fleet health, the access log and "my data". Numbers are
 * derived from the day, not random, so screenshots and tests are stable, and
 * every total is the sum of the rows it summarises.
 */

const isWeekend = (day: string) => {
  const weekday = new Date(`${day}T00:00:00Z`).getUTCDay();
  return weekday === 0 || weekday === 6;
};

/** A small stable number from a string, for varying mock values by day. */
function seed(text: string): number {
  let hash = 0;
  for (const char of text) hash = (hash * 31 + char.charCodeAt(0)) % 9973;
  return hash;
}

const at = (day: string, time: string) => `${day}T${time}Z`;

function shiftDay(day: string, offset: number): string {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function fleetHealth(range: DayRange): api.FleetHealth {
  const days = eachDay(range);
  const end = days.at(-1) ?? range.from;
  // A collector release with a schema bug, nine days before the end, is the
  // story the page should make easy to spot.
  const badDay = shiftDay(end, -9);
  const uploads = days.map((day) => {
    const batches = isWeekend(day) ? 9 + (seed(day) % 4) : 31 + (seed(day) % 7);
    const accepted = batches * 42 + (seed(`${day}a`) % 40);
    const duplicates = Math.round(accepted * 0.02);
    const rejected = day === badDay ? 38 : seed(`${day}r`) % 3;
    return { day, batches, accepted, duplicates, rejected };
  });
  const rejectedTotal = uploads.reduce((sum, row) => sum + row.rejected, 0);
  const badDayRejected = uploads.find((row) => row.day === badDay)?.rejected ?? 0;
  const tooLarge = Math.min(rejectedTotal - badDayRejected, 4);
  const quietDevices = [
    {
      deviceId: 'dev-132-a',
      owner: { id: 'e-132', name: 'Quinn Mbeki' },
      agentVersion: '0.3.9',
      lastSeenAt: at(shiftDay(end, -5), '16:42:00'),
    },
    {
      deviceId: 'dev-112-b',
      owner: { id: 'e-112', name: 'Drew Okafor' },
      agentVersion: '0.4.1',
      lastSeenAt: at(shiftDay(end, -3), '09:15:00'),
    },
  ].sort((a, b) => a.owner.name.localeCompare(b.owner.name));
  const total = PEOPLE.length + 1;
  return {
    range,
    dataThrough: lastDay(range),
    devices: {
      total,
      reportingLastDay: total - quietDevices.length - 1,
      quiet: quietDevices.length,
    },
    agentVersions: [
      { version: '0.4.2', devices: 7 },
      { version: '0.4.1', devices: 3 },
      { version: '0.3.9', devices: 1 },
    ],
    uploads,
    rejections: [
      { reason: 'invalid_schema', count: rejectedTotal - tooLarge },
      { reason: 'too_large', count: tooLarge },
      { reason: 'not_base64', count: 0 },
    ],
    harnesses: [
      { harness: 'claude-code', devices: 8 },
      { harness: 'cursor', devices: 5 },
      { harness: 'cursor-agent', devices: 3 },
      { harness: 'kiro', devices: 4 },
    ],
    quietDevices,
    lastRetentionRun: {
      ranAt: at(end, '02:00:00'),
      dryRun: false,
      // Nothing is older than 13 months yet, so nothing is dropped.
      partitionsDropped: 0,
      rowsPurged: 0,
    },
  };
}

/** One page of a cursor route. Short, so a table fits on screen. */
const PAGE_SIZE = 10;

function allAccessEntries(range: DayRange): api.AccessLogEntry[] {
  const managers = PEOPLE.filter((p) => PEOPLE.some((q) => q.managerId === p.id));
  const entries: api.AccessLogEntry[] = [];
  for (const day of eachDay(range)) {
    if (isWeekend(day)) continue;
    // Each manager opens one report's page on some weekdays.
    for (const manager of managers) {
      const reports = PEOPLE.filter((p) => p.managerId === manager.id);
      const pick = seed(`${day}${manager.id}`);
      if (pick % 3 !== 0 || reports.length === 0) continue;
      const subject = reports[pick % reports.length];
      if (!subject) continue;
      const hour = String(9 + (pick % 8)).padStart(2, '0');
      const minute = String(pick % 60).padStart(2, '0');
      entries.push({
        viewedAt: at(day, `${hour}:${minute}:00`),
        viewer: { id: manager.id, name: manager.name },
        subject: { id: subject.id, name: subject.name },
        route: `/v1/engineers/${subject.id}`,
      });
    }
  }
  return entries.sort((a, b) => b.viewedAt.localeCompare(a.viewedAt));
}

export function accessLog(
  range: DayRange,
  cursor: string | null,
  subject: string | null,
): api.AccessLog {
  const all = allAccessEntries(range).filter((entry) => !subject || entry.subject.id === subject);
  const start = cursor ? Number(cursor) : 0;
  const end = start + PAGE_SIZE;
  return {
    range,
    entries: all.slice(start, end),
    total: all.length,
    nextCursor: end < all.length ? String(end) : null,
  };
}

const EVENT_FIELDS: Record<string, string[]> = {
  sessionStart: ['session_id', 'model', 'repo_name', 'started_at'],
  token_usage: ['session_id', 'model', 'input_tokens', 'output_tokens', 'cache_read_tokens'],
  postToolUse: ['session_id', 'tool_name', 'duration_ms', 'succeeded'],
  command_invoked: ['session_id', 'command', 'skill_id'],
  sessionEnd: ['session_id', 'ended_at', 'end_reason', 'request_count'],
};

function allMyEvents(range: DayRange): api.MyEvent[] {
  const events: api.MyEvent[] = [];
  for (const day of eachDay(range)) {
    if (isWeekend(day)) continue;
    const sessions = 1 + (seed(day) % 3);
    for (let n = 0; n < sessions; n += 1) {
      const sessionId = `s-${day.replaceAll('-', '')}-${String(n)}`;
      const harness = n === 2 ? 'cursor' : 'claude-code';
      const hour = 9 + n * 3;
      const types = ['sessionStart', 'token_usage', 'postToolUse', 'command_invoked', 'sessionEnd'];
      types.forEach((eventType, index) => {
        events.push({
          occurredAt: at(
            day,
            `${String(hour + Math.floor(index / 2)).padStart(2, '0')}:${String((index * 11) % 60).padStart(2, '0')}:00`,
          ),
          harness,
          eventType,
          sessionId,
          fields: EVENT_FIELDS[eventType] ?? [],
        });
      });
    }
  }
  return events.sort((a, b) => b.occurredAt.localeCompare(a.occurredAt));
}

export function myData(range: DayRange, cursor: string | null): api.MyData {
  const me = person(MOCK_VIEWER.engineerId);
  const events = allMyEvents(range);
  const sessionsFor = (harness: string) =>
    new Set(events.filter((e) => e.harness === harness).map((e) => e.sessionId)).size;
  const activeDaysFor = (harness: string) =>
    new Set(events.filter((e) => e.harness === harness).map((e) => e.occurredAt.slice(0, 10))).size;
  const start = cursor ? Number(cursor) : 0;
  const end = start + PAGE_SIZE;
  const days = eachDay(range);
  const lastSeen = days.at(-1) ?? range.from;
  const claudeSessions = sessionsFor('claude-code');
  const cursorSessions = sessionsFor('cursor');
  return {
    engineer: {
      id: MOCK_VIEWER.engineerId,
      name: me?.name ?? MOCK_VIEWER.displayName,
      orgUnit: { id: MOCK_VIEWER.orgUnitId, name: ORG_UNITS[MOCK_VIEWER.orgUnitId] },
    },
    range,
    dataThrough: lastDay(range),
    devices: [
      {
        deviceId: 'dev-100-a',
        agentVersion: '0.4.2',
        firstSeenAt: at('2026-09-14', '10:03:00'),
        lastSeenAt: at(lastSeen, '18:20:00'),
      },
    ],
    harnesses: [
      {
        harness: 'claude-code',
        activeDays: activeDaysFor('claude-code'),
        sessions: claudeSessions,
        tokens: claudeSessions * 410_000,
        credits: null,
        cost: { costUsd: Math.round(claudeSessions * 4.8), costCoverage: 0.97 },
      },
      {
        harness: 'cursor',
        activeDays: activeDaysFor('cursor'),
        sessions: cursorSessions,
        tokens: cursorSessions * 120_000,
        credits: null,
        cost: { costUsd: Math.round(cursorSessions * 1.3), costCoverage: 0.62 },
      },
    ],
    events: events.slice(start, end),
    totalEvents: events.length,
    nextCursor: end < events.length ? String(end) : null,
    retentionMonths: 13,
  };
}
