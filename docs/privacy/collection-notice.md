# Collection notice (draft)

**Status: draft for the PM and the Freshworks privacy review. Not approved.**

Spec 7.3 and 8 require a one-page notice that engineers see at install time,
not buried in a policy. This is its skeleton. Keep it to one page. Every claim
here must match what the code does. If the code changes what is collected,
this changes in the same PR.

---

## What this agent is

TODO: one paragraph, plain language.

## What it collects

| Collected                       | Example                          | Not collected                    |
| ------------------------------- | -------------------------------- | -------------------------------- |
| Which AI tools you use and when | "Cursor, 14 sessions on Tuesday" | Your prompts or the AI's replies |
| Token, credit and cost totals   | "1.2M tokens, 40 credits"        | File contents                    |
| Tool and skill names            | "used the review skill"          | File paths (only the extension)  |
| Repository folder name          | "payments-api"                   | Full paths, branch names         |

## Who can see it

- You: everything about you, including the raw rows behind each number.
- Your management chain: your data, for coaching and enablement.
- Platform admins: fleet health and the audit log.
- Nobody sideways. Every view of your individual data is logged.

## How long it is kept

13 months of detail, then deleted. Aggregates are kept. Detail is purged when
you leave. (ADR 0006; period to be confirmed.)

## What it is not for

No leaderboards, no ranking of people by usage, tokens or lines of code.

## Questions

TODO: contact.
