# SprintIQ — Complete Color Inventory

## Scope
This document lists every unique color value found in the **SprintIQ** dashboard source files under `C:\Users\Sandeep_fastranking\Desktop\SprintIQ\dashboard\`.

Covered files:
- `css/theme.css` (SprintIQ dark theme & design tokens)
- `js/charts.js` (charting palette & runtime colors)
- `js/ai-cursor.js`
- `test_sprintiq.html`

Excluded:
- Minified vendor libraries (`vendor/`)
- The separate invoice/financial dashboard (`styles.css`, `app.js`, `test.html`)

---

## 1. Design Tokens — `css/theme.css`

These are the primary CSS custom properties that drive the SprintIQ dark UI.

| Token | Value | Notes |
|---|---|---|
| `--bg-main` | `#0a0c10` | Main page background |
| `--bg-sidebar` | `#0e1117` | Sidebar background |
| `--bg-card` | `#141721` | Card / panel background |
| `--bg-card-hover` | `#1b202e` | Card hover state |
| `--bg-card-header` | `#181c28` | Card header background |
| `--bg-input` | `#0e1117` | Form input background |
| `--border-subtle` | `#232736` | Subtle borders |
| `--border-highlight` | `#343a4e` | Highlighted borders |
| `--text-primary` | `#f8fafc` | Primary text |
| `--text-secondary` | `#94a3b8` | Secondary text |
| `--text-muted` | `#64748b` | Muted / helper text |
| `--accent-red` | `#e63946` | Primary brand red |
| `--accent-red-hover` | `#ff4d6d` | Primary red hover |
| `--accent-red-glow` | `rgba(230, 57, 70, 0.25)` | Red glow / shadow |
| `--accent-red-bg` | `rgba(230, 57, 70, 0.12)` | Red tinted background |
| `--rag-green` | `#2ec4b6` | RAG green |
| `--rag-green-bg` | `rgba(46, 196, 182, 0.15)` | Green tinted background |
| `--rag-amber` | `#ffb703` | RAG amber |
| `--rag-amber-bg` | `rgba(255, 183, 3, 0.15)` | Amber tinted background |
| `--rag-red` | `#e63946` | RAG red |
| `--rag-red-bg` | `rgba(230, 57, 70, 0.15)` | Red tinted background |

---

## 2. Hard-coded Colors — `css/theme.css`

Additional raw color values used directly in the stylesheet (not via tokens).

| Color | Typical Use |
|---|---|
| `#fff` / `#ffffff` | Brand icon, primary button text, headings |
| `#ff4d6d` | Red hover / alert text |
| `#2ec4b6` | Green success text / RAG green emphasis |
| `#ffb703` | Amber warning text / RAG amber emphasis |
| `#e63946` | Red RAG text / danger text |
| `rgba(0, 0, 0, 0.2)` | Footer / overlay backgrounds |
| `rgba(0, 0, 0, 0.25)` | Card / dropdown shadows |
| `rgba(0, 0, 0, 0.4)` | Backdrop shadows |
| `rgba(0, 0, 0, 0.6)` | Modal / heavy shadows |
| `rgba(0, 0, 0, 0.75)` | Overlay / dimmer backgrounds |
| `rgba(255, 255, 255, 0.05)` | Chart grid lines |
| `rgba(255, 255, 255, 0.06)` | Glass / subtle hover backgrounds |
| `rgba(255, 255, 255, 0.15)` | Range / chart fills |
| `rgba(255, 255, 255, 0.4)` | Chart / selection borders |
| `rgba(18, 20, 26, 0.8)` | Dark gradient stop |
| `rgba(230, 57, 70, 0.1)` | Red tinted panels / badge backgrounds |
| `rgba(230, 57, 70, 0.12)` | Red tinted backgrounds |
| `rgba(230, 57, 70, 0.15)` | Red glow / shadow / background |
| `rgba(230, 57, 70, 0.25)` | Accent red glow |
| `rgba(230, 57, 70, 0.3)` | Red borders |
| `rgba(230, 57, 70, 0.4)` | Red focus / hover borders |
| `rgba(230, 57, 70, 0.45)` | Red badge borders |
| `rgba(46, 196, 182, 0.1)` | Green chart fills |
| `rgba(46, 196, 182, 0.12)` | Green tinted backgrounds |
| `rgba(46, 196, 182, 0.15)` | Green badge / status backgrounds |
| `rgba(46, 196, 182, 0.3)` | Green borders |
| `rgba(46, 196, 182, 0.4)` | Green focus / hover borders |
| `rgba(46, 196, 182, 0.45)` | Green badge borders |
| `rgba(46, 196, 182, 0.85)` | Green RAG chart bars |
| `rgba(255, 183, 3, 0.15)` | Amber badge / status backgrounds |
| `rgba(255, 183, 3, 0.3)` | Amber borders |
| `rgba(255, 183, 3, 0.4)` | Amber focus / hover borders |
| `rgba(255, 183, 3, 0.85)` | Amber RAG chart bars |

---

## 3. Charting & Runtime Palette — `js/charts.js`

The chart module uses a named color object plus additional hard-coded values.

### Named Chart Colors

| Name | Value |
|---|---|
| `primaryRed` | `#e63946` |
| `accentRed` | `#ff4d6d` |
| `darkRed` | `#a4161a` |
| `lightRed` | `#ff758f` |
| `green` | `#2ec4b6` |
| `amber` | `#ffb703` |
| `red` | `#e63946` |
| `graphiteDark` | `#12141a` |
| `graphiteCard` | `#1a1d26` |
| `graphiteBorder` | `#2a2e3d` |
| `textPrimary` | `#f8fafc` |
| `textMuted` | `#94a3b8` |

### General Chart Palette (10 colors)

| # | Value |
|---|---|
| 1 | `#e63946` |
| 2 | `#2ec4b6` |
| 3 | `#ffb703` |
| 4 | `#4361ee` |
| 5 | `#7209b7` |
| 6 | `#f72585` |
| 7 | `#4cc9f0` |
| 8 | `#06d6a0` |
| 9 | `#118ab2` |
| 10 | `#073b4c` |

### Other Chart Colors

| Color | Use |
|---|---|
| `#94a3b8` | Default Chart.js text color |
| `#161922` | Tooltip background |
| `#ffffff` | Tooltip title color |
| `#e2e8f0` | Tooltip body color |
| `#2a2e3d` | Tooltip border color |
| `#12141a` | Doughnut / chart border color |
| `rgba(255, 255, 255, 0.05)` | Chart grid lines (reused) |
| `rgba(255, 255, 255, 0.15)` | Range highlight fill |
| `rgba(255, 255, 255, 0.4)` | Range highlight border |
| `rgba(255, 255, 255, 0.2)` | Background fill (e.g. area charts) |
| `rgba(46, 196, 182, 0.1)` | Green area fill |
| `rgba(46, 196, 182, 0.85)` | Green RAG bar fill |
| `rgba(255, 183, 3, 0.85)` | Amber RAG bar fill |
| `rgba(230, 57, 70, 0.85)` | Red RAG bar fill |

---

## 4. AI Cursor — `js/ai-cursor.js`

| Color | Use |
|---|---|
| `#e63946` | Persona color & pointer color |

---

## 5. Test Runner — `test_sprintiq.html`

| Color | Use |
|---|---|
| `#0e1117` | Test page background |
| `#f8fafc` | Test page text |
| `#e63946` | Fail / heading text |
| `#161922` | Test card background |
| `#2a2e3d` | Test card border |
| `#2ec4b6` | Pass indicator border |
| `#0e1117` | Pass badge text |
| `#ffffff` | Fail badge text |
| `#94a3b8` | Test details text |
| `rgba(230, 57, 70, 0.1)` | Fail card background |
| `rgba(46, 196, 182, 0.2)` | Pass summary background |
| `rgba(230, 57, 70, 0.2)` | Fail summary background |

---

## 6. Complete Alphabetical Master List

Every unique color value found in the SprintIQ source files (excludes vendor and invoice app).

### Solid / Hex Colors

- `#06d6a0`
- `#073b4c`
- `#0a0c10`
- `#0e1117`
- `#118ab2`
- `#12141a`
- `#141721`
- `#161922`
- `#181c28`
- `#1a1d26`
- `#1b202e`
- `#232736`
- `#2a2e3d`
- `#2ec4b6`
- `#343a4e`
- `#4361ee`
- `#4cc9f0`
- `#64748b`
- `#7209b7`
- `#94a3b8`
- `#a4161a`
- `#e2e8f0`
- `#e63946`
- `#f72585`
- `#f8fafc`
- `#ff4d6d`
- `#ff758f`
- `#ffb703`
- `#fff`
- `#ffffff`

### RGB / RGBA Colors

- `rgba(0, 0, 0, 0.2)`
- `rgba(0, 0, 0, 0.25)`
- `rgba(0, 0, 0, 0.4)`
- `rgba(0, 0, 0, 0.6)`
- `rgba(0, 0, 0, 0.75)`
- `rgba(18, 20, 26, 0.8)`
- `rgba(230, 57, 70, 0.1)`
- `rgba(230, 57, 70, 0.12)`
- `rgba(230, 57, 70, 0.15)`
- `rgba(230, 57, 70, 0.2)`
- `rgba(230, 57, 70, 0.25)`
- `rgba(230, 57, 70, 0.3)`
- `rgba(230, 57, 70, 0.4)`
- `rgba(230, 57, 70, 0.45)`
- `rgba(230, 57, 70, 0.85)`
- `rgba(255, 183, 3, 0.15)`
- `rgba(255, 183, 3, 0.3)`
- `rgba(255, 183, 3, 0.4)`
- `rgba(255, 183, 3, 0.85)`
- `rgba(255, 255, 255, 0.05)`
- `rgba(255, 255, 255, 0.06)`
- `rgba(255, 255, 255, 0.15)`
- `rgba(255, 255, 255, 0.2)`
- `rgba(255, 255, 255, 0.4)`
- `rgba(46, 196, 182, 0.1)`
- `rgba(46, 196, 182, 0.12)`
- `rgba(46, 196, 182, 0.15)`
- `rgba(46, 196, 182, 0.2)`
- `rgba(46, 196, 182, 0.3)`
- `rgba(46, 196, 182, 0.4)`
- `rgba(46, 196, 182, 0.45)`
- `rgba(46, 196, 182, 0.85)`

---

## 7. Core Color Combinations (Dark UI)

| Surface | Background | Text / Accent | Use |
|---|---|---|---|
| Page | `#0a0c10` | `#f8fafc` | Default page body |
| Sidebar | `#0e1117` | `#94a3b8` | Navigation sidebar |
| Card | `#141721` | `#f8fafc` | Content cards |
| Card hover | `#1b202e` | — | Interactive cards |
| Primary CTA | `#e63946` | `#ffffff` | Primary buttons |
| Primary CTA hover | `#ff4d6d` | `#ffffff` | Buttons on hover |
| Success / Green | `#2ec4b6` | `rgba(46, 196, 182, 0.15)` | Green RAG status |
| Warning / Amber | `#ffb703` | `rgba(255, 183, 3, 0.15)` | Amber RAG status |
| Danger / Red | `#e63946` | `rgba(230, 57, 70, 0.15)` | Red RAG status |

---

## Notes

- `index.html` does **not** contain hard-coded color values; it relies entirely on the `theme.css` design tokens.
- The `#fff` shorthand and `#ffffff` both appear in the source; they are the same color.
- All opaque grays are grouped under the `--text-*`, `--bg-*` and `--border-*` token families.
- The primary accent palette is built around a single red (`#e63946`) plus green (`#2ec4b6`) and amber (`#ffb703`) for RAG states.
