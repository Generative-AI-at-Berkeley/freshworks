# <Harness> format

- Versions observed: <version, date, OS>
- Last verified: YYYY-MM-DD by <name>

## Where it stores things

| Path | What | Format | Notes |
| ---- | ---- | ------ | ----- |

## Fields we read

| Field (source) | Maps to | Always present? | Notes |
| -------------- | ------- | --------------- | ----- |

## Sessions and subagents

How a session is identified, how a subagent run links to its parent, what an
orphan looks like.

## Tokens and credits

Which token classes exist, whether they are per request or cumulative, and
whether a parent's totals already include its subagents.

## Skills

Where installed skills, rules, steering files or Powers live, and how an
invocation shows up in the session data.

## Safe reading

Locks, write-ahead logs, files that change while being read, and how the
adapter avoids disturbing the harness.

## Unknown

What we could not determine, and what we tried.
