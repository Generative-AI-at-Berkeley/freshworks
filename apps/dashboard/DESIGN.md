# Dashboard design

Rules every view follows. Read this before adding or changing one. Dew is the
design system: its components, colours, type and spacing are not redefined here.

## Every page

- Header: breadcrumb (the management chain, where there is one), title, the
  date range on the right, then one sentence saying what question the page
  answers. A number without its period cannot be trusted.
- Then a summary strip (`Summary` + `Figure`): one panel split into cells, at
  most four. Never a row of separate cards.
- Then sections (`Section`), each with a title and, when it is not obvious, a
  one-line hint on how to read it.
- What needs a decision comes first (skill adoption's "Needs a decision"),
  the full table after.

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

## Charts

- Single series only, in Dew brand fill, no legend (the header names it).
- `Sparkline` for a trend in a table cell, `Histogram` for a spread, `Meter`
  for a share. Anything bigger waits for the chart library decision on X-3.

## Layout

- Desktop: sidebar plus a scrolling body. Under 768px the sidebar becomes a top
  bar and wide tables scroll inside their frame. The page never scrolls sideways.
- Colours only from Dew variables. Both themes are checked before merging.
