# FarmCircle — Design Reference

Frontend design system for `web/`. Written once the palette/type/pattern decisions were made explicit; earlier landing-page work (hero, nav, value props) has been retrofitted to match this, so treat this doc as canonical over anything in git history that predates it.

## 1. Colors

Defined as 50–950 HSL ramps in `web/src/app/globals.css` under `@theme`, generated at constant hue/saturation with lightness stepping ~10 per stop (50≈95%, 100→900 step 90→10, 950≈7%). Semantic tokens (`--color-background`, `--color-primary`, etc.) alias these — components should reach for the semantic token, not the raw scale, except for role-color badges which reference the scale directly.

| Token family | Role | Use |
|---|---|---|
| `icy-aqua` | Primary / brand | CTAs, links, active states, brand mark, Grower role accent, un-auth/guest default |
| `frosted-blue` | Secondary | Focus rings, info states, Vendor role accent, secondary buttons |
| `lavender-grey` | Tertiary | Customer role accent, subtle highlights |
| `granite` | Neutral | Body text, borders, backgrounds, disabled states |
| `dark-slate-grey` | Ink | Headings, high-contrast text, Admin role accent (no bright color — neutral) |

Semantic state colors (own ramps, not aliased to the five above):

| Token | Base (500) |
|---|---|
| `success` | `hsl(152 60% 45%)` |
| `warning` | `hsl(38 92% 50%)` |
| `danger` | `hsl(352 75% 55%)` |
| `info` | reuses `frosted-blue` |

**Mode: light only.** No dark-mode tokens/media-query in v1 — don't add `dark:` variants.

### Role → color mapping (fixed)

| Role | Color |
|---|---|
| Grower | `icy-aqua` |
| Vendor | `frosted-blue` |
| Customer | `lavender-grey` |
| Admin | `dark-slate-grey` |
| Un-auth / guest | `icy-aqua` (same as brand primary — shifts to role color post-signup) |

## 2. Fonts

Loaded via `next/font/google` (avoids layout shift, no CDN `<link>`).

| Role | Typeface | Use |
|---|---|---|
| Display | Space Grotesk | Headings, hero copy, logo wordmark |
| Body | Inter | UI copy, forms, descriptions, marketing text |
| Utility/data | JetBrains Mono | Prices, order IDs, SKUs, timestamps, quantities, data tables |

**Weight budget — don't introduce a weight outside these:**
- Space Grotesk: 500 / 650 only (loaded as a variable font so 650 is reachable)
- Inter: 400 / 500 / 600 only

## 3. Text (voice & content rules)

- Active voice, plain verbs: "Save changes," not "Submit."
- Name things by what the user controls, not backend structure: "Notifications," not "Webhook settings."
- Button label and result must match: "List product" → toast says "Product listed," not "Success!"
- Errors state what happened and how to fix it — never bare "Something went wrong."
- Empty states invite action: "No listings yet — Add your first product," not "No data."
- Tone: Grower/Vendor screens can be operational/dense (working tools). Customer-facing screens read a little warmer. Both stay plain — no filler, no forced cheerfulness.

## 4. Design pattern

**Core motif**: a closed circle/orbit — literalizes "FarmCircle" and the Grower → Vendor → Customer loop. The one recurring signature (logo, hero, loaders/progress rings). Used sparingly elsewhere — not decoration on every screen.

**Shape language**: slightly more rounded than typical SaaS default, reinforcing the circular identity without going full-pill everywhere.

| Element | Radius |
|---|---|
| Small elements (inputs, badges, small buttons) | 6px (`rounded-sm`) |
| Cards, dropdowns | 10px (`rounded-md`) |
| Modals, large panels | 16px (`rounded-lg`) |
| Avatars, pills, primary CTA, orbit nodes | fully round |

**Elevation**: subtle brand-color glow instead of generic black drop-shadows — ties elevation to brand identity (the hero's core glow is the reference implementation). Reserve the glow for primary/active states only, not every card.

**Icons**: Material Symbols, via the `material-symbols` npm package (self-hosted SVG/font subset, no MUI dependency). Not installed yet — nothing on the site needs an icon yet. Install with `npm install material-symbols` in `web/` when the first one is needed.

**Responsive strategy ("layout shifter")**: reflow via CSS/Tailwind responsive classes on a single component tree (`grid-cols`, `flex-direction`, `order`, etc.) — the industry-standard default, and what the landing page already does. Reserve separate component trees per breakpoint for cases where the *interaction* genuinely diverges (e.g. a mobile drawer nav vs. desktop inline nav), and even then prefer one component conditionally showing/hiding pieces over duplicate files.

**Overall feel**: modern marketplace infrastructure — clean, quiet, information-forward. Not rustic/agrarian (no wheat clipart, no earthy browns, no handwritten fonts). The boldness budget is spent on the orbit motif and role-color coding; everything else (spacing, cards, tables) stays disciplined and gets out of the way of the content.
