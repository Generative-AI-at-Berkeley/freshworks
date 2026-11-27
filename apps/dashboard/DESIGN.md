# Dashboard design

Rules every view follows. Read this before adding or changing one. Dew is the
design system: its components, colours, type and spacing are not redefined here.

## Every page

- Header: breadcrumb where there is one, title, one sentence on the question
  the page answers, and the period control (7, 28 or 90 days) on the right.
  Under it a context row: scope, period, the comparison period when the page
  compares, and the last day with finished data. The period lives in the URL
  (`?days=`) and every link carries it.
- Then a summary strip (`Summary` + `Figure`): one panel split into cells, at
  most four. Never a row of separate cards.
- Then sections (`Section`), each with a title and, when it is not obvious, a
  one-line hint on how to read it.
- Skill adoption reads top to bottom as: are engineers using skills at all
  (headline rate, installed to used to still using, daily trend), where to act
  (statuses from `lib/skill-status.ts`, each with its reason and next step),
  then every skill in a sortable, filterable table. Rows open `/skills/[id]`.
- Comparisons come from asking the API for the previous period. If that call
  fails the comparison is left out, never estimated.

## Numbers

- Unknown renders through `Value`: muted "Not measured", "Not priced" or "Not
  used yet", with the reason on hover. Never 0, never a dash.
- A partial total carries its coverage as a note ("71% of usage priced").
- Shares render as a `Meter` with the count beside it ("7 of 9"), so the bar
  and the number say the same thing.
- Usage is shown in the unit the tool reports: tokens, or credits for Kiro.

## People

- Sorted by name. No column ranks people by usage (spec section 8).
- Rows that open something show `PersonName` and end with `RowChevron`.
- Per-person pages lead with what could help them, not with volume.

## Color

- One data ink, `--fw-ink-data` (Dew chart category 01), for every measured
  series and bar. Comparison series are a dashed neutral.
- Brand blue only means "you can click this" or "you are here".
- Semantic colors only for status dots and up or down deltas, always next to
  a word, as Dew Tags. Never a tinted warning box.
- Panels are Dew `Card` (outlined), statuses and changes are Dew `Tag`, shares
  are Dew `ProgressLoader`, definitions are Dew `Tooltip`. Do not restyle Dew
  components; only lay them out.

## Charts

- `TrendChart` for a daily series: y axis, dates, crosshair tooltip, arrow
  keys. Busy daily series show a 7-day average and say so in the title.
- `Sparkline` for a trend in a table cell, `Histogram` for a spread, `Meter`
  for a share next to its number, `BarList` for a few labelled counts.
- Tables go in `TableFrame`, which keeps Dew's table look and only adds scroll.

## Layout

- Desktop: sidebar plus a scrolling body. Under 768px the sidebar becomes a top
  bar and wide tables scroll inside their frame. The page never scrolls sideways.
- Colours only from Dew variables. Both themes are checked before merging.
