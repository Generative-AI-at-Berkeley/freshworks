# Kiro format

TODO(AG-4). Fill in from [_template.md](_template.md). Due first, before the
adapter: what Kiro exposes, how it reports credits, how it represents subagents.

Starting points from the spec, to verify against a current install:

- `~/.kiro/sessions/`, two layouts. Directory format (IDE and CLI v3 engine):
  per-session folder with `session.json`, `messages.jsonl`, `sub-executions/`.
  Three-file format (CLI default engine): `cli/<id>.json`, `<id>.jsonl`, `<id>.lock`.
- A SQLite database under `~/.kiro/` where the CLI saves every turn, scoped
  per working directory.
- IDE chat history under `~/Library/Application Support/kiro/User/globalStorage/kiro.kiroagent/`,
  which can reach gigabytes. Check `User/workspaceStorage/` for workspace mapping.
- Consumption is in credits, per turn. Record as credits (ADR 0005).
- Steering files and Powers are Kiro's skill equivalents for the inventory.
- Skip `.lock`-held sessions or read them without disturbing the writer.
