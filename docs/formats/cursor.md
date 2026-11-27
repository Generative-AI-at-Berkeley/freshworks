# Cursor format (IDE and Cursor Agent)

TODO(AG-3). Fill in from [_template.md](_template.md). The IDE and the CLI
agent are separate harnesses (`cursor`, `cursor-agent`) that share fixtures.

Starting points from the spec and the closed upstream PRs #162 and #224, to
verify against a current install:

- IDE: SQLite `state.vscdb` in globalStorage (Cursor 3.0+ moved message
  content there). `composerData:` keys for sessions, `bubbleId:<composer>:<bubble>`
  for messages, `composer.composerHeaders` as the central index. Edited files
  need a join on the `agentKv` table. Legacy layouts keep content inline in
  `conversationMap`.
- Agent: JSONL under `~/.cursor/projects/**/agent-transcripts/`. Some tooling
  reports `~/.cursor/chats` instead. Project directory names use a lossy
  path encoding.
- Never shell out to the `sqlite3` binary. Use `node:sqlite` read-only, or
  copy the file first, since Cursor may hold a write lock. The database is
  often over 1 GB: read incrementally.
- Rules files are Cursor's skill equivalent for the inventory.
