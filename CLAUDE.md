# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository overview

This repo has no build system, package manager, or test suite — it's two static files, deployed as-is via GitHub Pages:

- `index.html` — a single-file web app ("Gastos en pareja" / "Shared couple expenses"), self-contained HTML/CSS/JS with one external JS dependency (`@supabase/supabase-js`, loaded via CDN `<script>` — see Persistence below; fonts are loaded from Google Fonts via `<link>`). This is the actual application.
- `DESIGN.md` — a standalone design-system reference document analyzing Apple's website (colors, typography, spacing, components). It documents a *different* aesthetic (photography-first, blue accent, SF Pro) than what `index.html` currently uses (warm editorial palette: Fraunces serif headings, Inter body, IBM Plex Mono for numbers, gold/clay/paper tones). Treat it as reference/inspiration material, not a spec already applied to the app — don't assume the two are in sync unless asked to reconcile them.

## Running / testing changes

There is no dev server, bundler, or test command. To verify changes, open `index.html` directly in a browser (or use the `run` skill to launch it) and exercise the UI manually — add an expense, toggle paid/unpaid, add income entries, change the split type, etc. Since persistence now goes over the network to Supabase, testing multi-device sync means opening the file in two tabs/browsers and entering the same couple code in both.

## Architecture of index.html

Everything lives in one file: `<style>` in the `<head>`, markup in `<body>`, and app logic in a single trailing `<script>`. There is no framework — DOM updates are done by re-rendering `innerHTML` strings from plain JS state.

**Persistence**: backed by Supabase (Postgres + REST + Realtime), not `localStorage` or `window.storage` (this app previously ran inside Claude Artifacts, where `window.storage` was Artifacts' own shared KV runtime — that environment no longer applies here). Every couple is one row in a `couples` table, keyed by a shared "código de pareja" the two people agree on (no email/password — see `initCouple()`/`enterCouple()`). The `store.get(key)`/`store.set(key, value)` object (search `const store = {` in the script) still exposes the original key-based interface so the ~15 call sites elsewhere didn't need to change; internally it now maps logical keys to `couples` columns and does Supabase `select`/`update` calls:
- `expenses_v1` → `expenses` column — array of expense objects
- `names_v1` → `names` column — ordered `[{id, name}]` roster of the people in the space; the old `{A, B}` object shape is migrated on read by `migratePeople()`
- `income_v2` → `income` column — `{fx, entries: {A: [...], B: [...]}}`; a legacy scalar shape is migrated on load via `migrateIncome()`
- `fixed_v1` → `fixed` column, `fixedincome_v1` → `fixed_income` column
- `varestimates_v1` → `variable_estimates`, `varexpenses_v1` → `variable_expenses`
- `budgetoverrides_v1` → `budget_overrides` — the **gastos posibles** rubros, now `{personId|'shared': [{id, label, amount}]}` instead of the old `{personId: {catKey: amount}}` caps. Every slot starts with the five rubros of `DEFAULT_BUDGET_CATS` (Salidas, Regalos, Compras Hogar, Deudas, Diaria), each `locked: true` so they can't be deleted until the padlock is opened; the amount is always editable, in Ajustes or from the ✎ on the rubro's card in Gastos (`openBudgetRubroModal()`), and both write back to the same rubro — it's a recurring amount, not a per-month one; `migrateBudgetTemplates()` converts the legacy shape on read, keeping whatever amounts were already typed
- `goals_v1` → `goals` column — array of user-written savings goals `{id, person, name, kind:'total'|'mensual', amount, currency, deadline, saved}`
- the one-time migration flags (`fixed_m1`, `fixed_m2`, `fixed_m3`, `fixedincome_m1`) collapse into a single `migration_flags` jsonb column instead of separate rows

Adding a new logical key means adding the column to `couples` in Supabase too (`alter table couples add column <name> jsonb;`) — there's no migration runner. A write to a column that doesn't exist comes back as Postgres error `42703`; `store._writeNow()` special-cases it (no retries, and a toast naming the missing column) and the value survives in the localStorage cache until the column exists.

A Supabase Realtime subscription (`subscribeCoupleRealtime()`) pushes every `UPDATE` on the couple's row to all other open tabs/devices with the same code, which is what makes cross-device sync work without polling. Row Level Security on `couples` allows any `anon` client to read/write — the couple code itself is the only access control, mirroring the no-auth model the app already had. The Supabase project URL and anon key are hardcoded near the top of the script (`SUPABASE_URL`, `SUPABASE_ANON_KEY`) — this is intentional and safe: Supabase anon keys are meant to be public, security comes from RLS policies, not from hiding the key.

**People model**: a space holds **1 to `MAX_PEOPLE` (4) people**, not a fixed couple. `people` is an ordered array of `{id, name}` where `id` comes from `PERSON_IDS = ['A','B','C','D']`; that id is what every record is keyed by — expense `paidBy` and `shares`, `income.entries`, `varEstimates`, `budgetOverrides`, `goals.person`, `fixedIncome.person`. Names are cosmetic and resolved at render time through the derived `names` map (`nameOf(id)`), so renaming someone never touches data.

- `pids()` / `peopleCount()` / `firstPid()` / `isPerson(id)` are the accessors; **never hardcode `'A'`/`'B'`** or iterate a literal `['A','B']`.
- `setPeople()` is the only way to change the roster: it rebuilds `names`, creates the missing per-person slots, and re-points any selection (`currentPaidBy`, `currentAhorroPerson`, …) that pointed at someone who is gone.
- **Expense splits** are `ex.shares = {A: 60, B: 40}` (percentages), not the old scalar `pctA`. Build them with `sharesFor(splitType)`; `splitType` is `'equal' | 'income' | 'only:<id>'`. `normalizeExpenses()` migrates `pctA` and the old `'50' | 'a-to-b' | 'b-to-a'` types on load, so stored data from the couple-only era keeps working.
- Raising the count leaves past expenses alone on purpose — those months really were split among whoever was there, and the newcomer's share is 0. Lowering it is destructive and confirms first: `dropPersonData()` deletes that person's income/variable expenses/budget/goals, and `redistributeShares()` spreads their slice of each shared expense across whoever is left so no money is left orphaned.
- `refreshPeopleUI()` rebuilds every person-dependent control in one place (all the `.seg` pickers, the split options, the names inputs in Ajustes) and publishes `--cols` / `--cols-sm` for the per-person grids. Call it after any roster or name change instead of touching those controls directly. With a single person it also hides the "who?" pickers and the split field entirely.
- Colors come from `PERSON_COLORS` by position (`personColor`, `personTagClass`), so charts and tags stay consistent as people are added.
- Who-owes-whom is `netBalances()` → `settlements()`: with two people it's the same single line as before, with three or four it greedily nets the debts into the fewest transfers.
- `f.locked` on a fixed template is a delete guard, not a freeze: it disables ✕ on the template row in Ajustes **and** on every loaded expense card in Gastos whose `desc` matches it (`lockedTemplateFor()`), while ✎ and the amount stay editable. The same padlock lives on the gastos posibles rubros.
- **A fixed expense can be personal**, not just shared (one person's monotributo). The recurring template in Ajustes carries an `owner` (`fixed[].owner`: a person id, or absent = shared, cycled with `cycleFixedOwner()`), and picking that chip in the add-expense modal preselects the split via `splitForOwner()`. The Gastos fijos block then filters the list with `renderFixedTabs()` into `Compartidos` + one tab per person, derived from `expenseOwner(ex)` — which reads the expense's own `shares`, so it needs no extra field and classifies pre-existing expenses correctly. The tabs filter **only the list**: the Totales below stay the whole month, or the chain would stop adding up.

**State → render flow**: every mutation (add/delete/toggle expense, add/remove income, change names or FX rate) follows the same pattern: mutate the in-memory object → persist via the relevant `save*()` function (fire-and-forget async, wrapped in try/catch) → call `render()` (or `renderIncomeLists()` for income-specific UI) to redraw affected DOM sections from scratch. There is no diffing — sections are fully re-stringified and reassigned to `innerHTML`.

**The money chain** — the single source of truth for every "how much is left" figure in the app is `financeFor(person, monthKey)`. It walks one person's month in the order the Gastos tab lays it out:

```
ingreso − su parte de los gastos fijos − sus gastos variables − lo que tiene presupuestado gastar = ahorro
```

and returns every intermediate saldo (`afterFijos`, `afterVar`) plus `propio`/`compartido`/`podes` — what this person has budgeted per rubro (`budgetTemplates[person]`) plus their equal share of the shared rubros (`budgetTemplates.shared`). The amounts are no longer auto-suggested percentages of what's left: they're whatever was set in Ajustes, and the Gastos block only reads them. The Gastos tab is four big `.card` blocks — Gastos fijos, Gastos variables, Gastos posibles, Ahorro — each with `Compartidos` + one sub-tab per person filtering *only* its list, and each closes with a "Saldos" footer (one card per person) (`.sld-*`, `renderBlockSaldos()`) showing the running saldo at that step; the Ahorro block's number is the end of the chain. The Ahorro tab's headline number, its month-by-month history, and its 50/30/20 bars all read from the same function, so they can't drift from Gastos. If you change how any step is computed, change it in `financeFor()`, not in a renderer.

**Everything is split `Compartido` / one tab per person.** Gastos fijos and variables have a template list in Ajustes plus a modal whose `¿De quién es?` picker offers `Compartido` + each person, and the Gastos tab lists the entries actually loaded for the month. A shared entry stores `paidBy: 'shared'` plus a frozen `shares` map (equal parts at load time) and generates **no debt** — `netBalances()` skips it, because each person put in exactly their part. `entryShareOf()` turns one entry into one person's slice, and `redistributeShares()` re-splits shared entries when someone leaves the space. Gastos posibles follows the same `Compartido`/persona split but has no per-month entries: its rubros live only in Ajustes and the Gastos block renders them read-only.

**Key derived calculations** (in `render()`'s call graph):
- `renderCharts()` → `renderBalance()` — computes net debt between A and B across *all* expenses (not just current month) by summing each person's owed share vs. what they actually paid.
- `incomePctA()` — proportional income split (used when an expense's `splitType === 'income'`), converts any USD income entries to ARS using the manually-entered `fx` rate before comparing.
- Recurring expenses: marking a recurring expense paid (`togglePaid`) auto-generates the next month's copy via `addMonths()`, and bumps `cycleCount`; if `adjustPct > 0` and the new cycle is a multiple of 3, the amount is escalated by that percentage.

**Charts**: category and payer breakdowns are rendered as hand-rolled SVG pie charts (`pieSvgHtml`/`arcPath`/`polarToCartesian`) — no charting library.

**i18n**: all user-facing strings are hardcoded Spanish (Argentine locale — `es-AR` for `Intl.NumberFormat`/date formatting, ARS as the default currency). There's no translation layer; don't add one unless asked.

## Conventions to preserve when editing

- Keep everything in the one HTML file unless the user asks to split it up — GitHub Pages serves it as a static file with no build step.
- Use the `store.get`/`store.set` abstraction (backed by Supabase) for anything that needs to persist — don't reach for `localStorage` as a source of truth; it's only used to remember which couple code this device last used (`couple_code` key), not for actual data.
- Key everything by person **id**, never by name and never by a hardcoded `'A'`/`'B'` — iterate `pids()` and resolve labels with `nameOf(id)`. Any new per-person UI belongs in `refreshPeopleUI()`, and any new per-person data structure needs a slot created in `setPeople()` and cleanup in `dropPersonData()`.
- `escapeHtml()` is used when interpolating user-entered text (`desc`, income `label`) into `innerHTML` — keep doing this for any new user-text interpolation to avoid XSS via the shared/multi-editor storage.
- Every `couples` row is shared by everyone who knows that couple's code — there is still no per-person auth within a couple, only isolation *between* couples.
