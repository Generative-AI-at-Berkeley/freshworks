# Claude Code format

TODO(AG-2). Fill in from [_template.md](_template.md).

Starting points to verify against a current install, not trust:

- Transcripts as JSONL under `~/.claude/projects/<encoded path>/`.
- Hooks configured in `settings.json`, which the existing Freshworks pipeline
  already uses (`hook_version` in the v2 payload).
- Skills under `~/.claude/skills/`, `<repo>/.claude/skills/`, and inside
  installed plugins.
- The pipeline's `token_usage` event is Cursor only today, so Claude Code
  token counts have to come from the transcripts.
