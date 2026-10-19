# 09 · Design system and image/video strategy

Everything here is **[REC]** unless marked. Contrast ratios below were computed with the WCAG 2.x relative-luminance formula on 19 October 2026; they are calculations, not a substitute for testing on real screens.

## 1. Direction

- **Feel:** calm, warm, confident, practical. A good physiotherapist's clinic crossed with a well-made banking app: clear numbers, nothing shouting.
- **Avoid:** gym-bro aggression, neon gradients, transformation imagery, medical-looking charts, guilt mechanics.
- **Green and amber are status colours only, never decoration** (a rule borrowed from Kokum's design decision D-003, adopted on its own merits). Kokum is a separate product (file 24); sharing its colour family would help a later bundle but is not required.

### Decision on the primary colour **[OPEN, your call]**

| Option | Primary | For | Against |
|---|---|---|---|
| A (recommended) | Petrol teal `#0E5A50` | Sits clear of the green and amber status colours; 8.09:1 with white text; matches Kokum if a bundle happens | Teal can tip clinical; needs a warm canvas (Kokum noted the same risk) |
| B | Phase 2 "Forest" `#173F35` | Very high contrast (11.67:1 with white) | Reads as dark green, so it collides with the semantic "done" green |

**Skin options:** 10 alternative skins (fonts, palettes, layouts) are in `design/skins.html` for you to choose from; the tokens below are skin 01 (Deep Water) and will be replaced by the chosen skin.

## 2. Tokens

### Colour (light)

| Token | Value | Use | Check |
|---|---|---|---|
| `canvas` | `#F4F0E7` warm ivory | App background | |
| `surface` | `#FFFFFF` | Cards, sheets | |
| `ink` | `#1F2523` | Primary text | 13.71:1 on canvas, 15.59:1 on surface |
| `ink-muted` | `#56605C` | Secondary text | 5.73:1 on canvas |
| `primary` | `#0E5A50` (option A) | Primary buttons, links, active tab | 8.09:1 with white text |
| `border-input` | `#8C948F` | Input and control borders | 3.11:1 on white (meets the 3:1 non-text minimum) |
| `divider` | `#E3DED3` | Decorative separators only | Decorative; not relied on for meaning |
| `success` | `#2E7D4F` | Done, saved | 5.05:1 on white |
| `warning` | `#8A5A00` | Needs attention | 5.93:1 on white |
| `error` | `#B3261E` | Errors, safety stop accent | 6.54:1 on white |
| `info` | `#2F5FA7` | Neutral notices, sources | 6.33:1 on white |

### Colour (dark)

| Token | Value | Check |
|---|---|---|
| `canvas` | `#101413` | |
| `surface` | `#1A201E` | |
| `ink` | `#ECEFED` | 16.03:1 on canvas |
| `ink-muted` | `#A9B3AF` | 7.68:1 on surface |
| `primary` | `#5CC2B0` | 8.66:1 on canvas; button text `#0B1F1B` at 7.99:1 |
| `success` / `warning` / `error` | `#6BCB8E` / `#E3B04B` / `#F2867D` | 8.32 / 8.33 / 6.68 on surface |

Dark mode follows the system setting by default, with an in-app override.

### Data-visualisation palette

Categorical series avoid the semantic hues: `#0E5A50` (8.09:1), `#6D4FA3` (6.37:1), `#C2571A` (4.49:1, line and mark use only), `#2F5FA7` (6.33:1). Every series also differs by marker shape or dash, so colour is never the only cue.

### Typography

- **Family:** Inter (SIL Open Font Licence) for everything, with tabular figures for numbers. One family keeps the bundle small and renders identically on Android and iOS. **[OPEN]** a display face for headings can be added at brand stage.
- **Scale (size / line height):** Display 32/38 · Title 24/30 · Heading 20/26 · Body 16/24 · Body-small 14/20 · Caption 12/16 · Numeral-large 40/44 (tabular).
- **Scaling:** respect OS text size up to 200 per cent; only large numerals in the workout player may cap at 150 per cent so the rep counter still fits.
- **No italics for meaning.** Emphasis by weight.

### Space, shape, elevation

- Spacing on a 4-point base: 4, 8, 12, 16, 24, 32, 48.
- Radius: 8 chips, 12 inputs, 16 cards, 24 sheets (rounded, matching Kokum's Wise-style cards).
- Elevation: tonal surfaces and 1 px borders; at most one soft shadow level for sheets.
- Touch targets: at least 44 pt on iOS and 48 dp on Android (claim R-23); 56 dp for workout-player primary actions, because hands are sweaty and the phone is on the floor.

### Motion and haptics

| Token | Duration | Use |
|---|---|---|
| `motion-micro` | 120 ms | Toggles, chip selection |
| `motion-standard` | 200 ms | Screen transitions, card expand |
| `motion-sheet` | 300 ms | Bottom sheets |

- Reduced motion: replace movement with a 120 ms cross-fade or no animation.
- Logging and completion never wait on an animation.
- Haptics: light tap on set complete and timer end, following the system setting.

### Iconography

Line icons at one stroke weight (Lucide, ISC licence, or equivalent). **No emoji anywhere in the product** (a Kokum convention adopted here).

## 3. Navigation

Five tabs: **Today · Train · Eat · Coach · Progress.** Profile and settings behind the avatar on Today.

## 4. Component library

| Group | Components | Notes |
|---|---|---|
| Actions | Button (primary, secondary, text, destructive), IconButton, FAB for quick log | Destructive buttons never sit where primary usually is |
| Inputs | TextField, NumberStepper, Search, SegmentedControl, ChipGroup (single, multi), Slider (with numeric entry alternative), DatePicker | Every slider has a typed alternative for accessibility |
| Cards | NextActionCard, SessionCard, MealCard, CoachActionCard (Confirm / Not now), ProgressCard | One primary action per card |
| Domain: training | SetRow, RestTimer, ExerciseMedia (with text fallback), EffortPicker, SwapSheet, ShortenSheet | SetRow saves on tap, shows SyncMark |
| Domain: nutrition | FoodResultRow, PortionStepper (katori (bowl), piece (roti, idli and similar), tbsp, tsp, cup, glass, g, ml), OilLevelSelector, RangeValue ("about 450 to 600 kcal"), MacroSummary | RangeValue is the only way to render an estimate |
| Domain: coaching | MessageBubble, SourceChip, EvidenceCard, SafetyResponse (distinct style), FeedbackBar | Safety responses cannot be styled like normal chat |
| Feedback | Toast with undo, Banner (offline, limited mode), InlineError, FullPageError with trace ID, SyncMark, EmptyState | |
| Data display | TrendChart, StrengthChart, ConsistencyGrid, MetricTile | Each chart has a text summary and a table view |
| Safety and privacy | ConsentPanel, SafetyStop, PainReport (body map + list), DeletionConfirm | |

## 5. Charts

| Chart | Encoding | Rules |
|---|---|---|
| Weight trend | Raw points plus smoothed trend line | Gaps of 7+ days break the line; no future projection; y-axis labelled with units; hidden entirely if weight is not tracked |
| Strength | Top set (load x reps) per session per exercise | Only logged data; personal bests marked by shape and label |
| Consistency | Weekly grid of planned versus done | Rest days drawn as rest (neutral), not as misses |
| Nutrition | Ranges as bands, logged as solid, estimated as hatched | Missing data shown as missing, never zero |

Every chart announces a one-sentence summary to screen readers ("Trend weight down 0.8 kg over 4 weeks") and offers a table.

## 6. Image and video strategy

### Principles

1. Technique media must be **real people performing the movement correctly**, reviewed by a qualified coach. Generated imagery is allowed for illustrations, empty states and marketing backgrounds, never as the reference for technique.
2. People shown should look like the users: Indian adults of varied ages, body types and genders, in home and gym settings.
3. No before-and-after imagery, no shirtless transformation shots.

### Exercise media plan

| Stage | Source | Scope | Why |
|---|---|---|---|
| Pilot (you) | Text cues plus simple line illustrations; optionally openly licensed exercise images with attribution (licence to confirm, claim T-15) | 60 to 80 exercises | Fast, cheap, enough to test the loop |
| Beta | Commissioned shoot, phase 1 | Same 60 to 80 exercises; 2 angles each; 6 to 10 s silent loops plus one 30 to 45 s cued demo | Quality and rights control |
| Launch | Shoot phase 2 | 150+ exercises, regressions and progressions | Coverage |

**Shoot specification:** consistent background and lighting; front and side angles; 1080p masters; delivered as 720p H.264 loops under 1.5 MB each plus HLS for long demos; WebVTT captions; poster frames; model releases; written licence granting perpetual, worldwide, all-media rights including edits and AI-assisted derivatives; raw footage ownership.

**Licensed library alternative:** acceptable only if the licence covers commercial in-app use, modification, all territories, and survives termination for content already shipped. Verify per vendor (claim T-16).

### Food imagery

Real Indian dishes in realistic portions (katori, thali, roti count visible), shot or licensed. No "clean eating" styling, no weighing-scale imagery.

### Asset manifest (one row per asset)

`asset_id, exercise_id or food_id, type (loop, demo, image, illustration), angle, duration, file sizes, captions, model release ID, licence ID, licence scope, territory, expiry, reviewer, review date, version, status (draft, reviewed, live, retired)`

Nothing goes live without `status = reviewed` and a licence row.

### Offline media

Cache poster frames for the whole library and loops for the current week's sessions (estimated 20 to 40 MB); show text cues when media is missing.

## 7. Accessibility checklist (applies to every component)

- Screen reader labels and roles; state announced ("set 2 saved").
- Focus order matches visual order; custom sheets trap and return focus.
- Contrast at the ratios in §2; non-text controls at least 3:1.
- Text scaling to 200 per cent without loss of primary actions.
- Reduced motion; no flashing content.
- Captions on all video; text equivalent for every demonstration.
- Body map has a list alternative; sliders have typed alternatives.
- Timers announce remaining time at sensible intervals, not every second.
