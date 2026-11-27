# Dashboard design

Rules every view follows. Read this before adding or changing one. The look
follows Freshworks' own Dew products (Freshdesk and Freshservice analytics):
Dew components with Dew's default colours, nothing restyled beyond layout.

## Frame

- Grey `fill-container` frame. Dew `TopNavigation` across the top with the
  Freshworks logo on the left and the sample-data tag and profile avatar on
  the right. The profile popover holds the viewer, the org and the theme switch.
- An icon rail on the left: icon only, label in a tooltip, Dew's `Selected`
  icon on the active page. Under 640px the rail becomes a row under the top bar.
- The page sits on a white `fill-surface` panel with a rounded top-left corner.

## Every page

- Header row: breadcrumb (parents in brand blue) or the title, then the period
  dates and the 7, 28 or 90 day control on the right. No description line. A
  data-through note shows only when the data stops short of the period.
- Then a row of KPI cards (`Summary` + `Figure`), one Dew card per number:
  label, value, delta (a coloured triangle and the change, with what it is
  compared against in a tooltip), and at most one short note.
- Then widget cards (`Section`): bold title, an info icon for how the numbers
  are counted, controls on the right of the title. Explanations go in the info
  tooltip, never as body text.
- Widget cards in a row share a fixed `height`. Lists inside them page with
  `usePaged` / `Paged` (Dew `PageNavigation` in the card footer), so a card
  never grows or shrinks with its content.
- Copy is short, sentence case. Labels name the number ("Active engineers"),
  they do not explain it.
- Comparisons come from asking the API for the previous period. If that call
  fails the comparison is left out, never estimated.

## Numbers

- Unknown renders through `Value`: "Not measured", "Not priced" or "Not used
  yet". Never 0, never a dash.
- A partial total carries its coverage as a note ("71% of usage priced").
- Shares render as a `Meter` with the count beside it ("7 of 9").
- Usage is shown in the unit the tool reports: tokens, or credits for Kiro.

## People

- Sorted by name. No column ranks people by usage (spec section 8). Per-person
  pages show no volume counters.
- Rows that open something show `PersonName` and end with `RowChevron`, and
  carry the period in the link.

## Colour

- Dew variables only. `globals.css` defines `--fw-*` names as plain aliases of
  Dew variables, plus `--fw-line`: Dew's border step in light, a neutral grey
  in dark, because Dew's dark boundaries are blue-grey on neutral surfaces.
  Cards take the `fw-card` class to use it.
- Data is Dew chart category 01. Comparison series are a dashed neutral.
- Brand blue means "you can click this" or "you are here".
- Statuses are Dew `Tag`s. Up and down deltas use the semantic text colours.
- The Freshworks logo keeps its own brand colours; its wordmark takes the text
  colour so it reads in both themes.

## Charts and tables

- `TrendChart` for a daily series, `Sparkline` in table cells, `Histogram` for
  a spread, `BarList` for a few labelled counts.
- Tables go in `TableFrame`: grey rounded header row, semi-bold labels, no
  vertical rules, a rule between rows. Filters above a table use one control
  per kind (segmented tabs for status, a Dew `Select` for tool) so groups do
  not run together.
- Both themes and 375px are checked before merging.
