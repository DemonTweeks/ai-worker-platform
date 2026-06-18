# Performance Observations

## Method

Performance observations were gathered through a non-intrusive Playwright page load and visual inspection. These are not lab-grade Lighthouse results.

## Measured Snapshot

| Metric | Observed Value | Status |
|---|---:|---|
| Desktop full page screenshot size | 1440 x 4308 px | Verified |
| Mobile full page screenshot size | 390 x 7164 px | Verified |
| Approximate 1440 px load elapsed in one run | ~4.4 s | Observed estimate |
| Subsequent responsive route loads | ~1.8-2.4 s | Observed estimate |
| Homepage visible section count | 7 sections | Verified |
| Homepage image elements | 0 | Verified |
| Stylesheets | 4 CSS files | Verified |
| External analytics script | Umami | Verified |

## Visible Performance Strengths

- No large homepage image assets were used.
- Layout is mostly text, CSS, cards, and inline SVG icons.
- Background decoration is CSS-based.
- Section layout is stable, with explicit cards and constrained containers.
- Mobile has no horizontal overflow in inspected widths.

## Visible Performance Risks

- Multiple Next.js chunks and many inline React flight payload scripts are present.
- Animated cards and gradient/blur backgrounds could be costly on lower-end mobile devices if overused.
- The mobile page is long, so cumulative rendering work grows with content volume.
- Public task example text adds content weight and visual density.
- Font loading uses external/preloaded font resources; fallback behavior should be monitored for layout shift.

## Loading And Layout Observations

The page visually loaded into a stable layout during screenshot capture. No obvious layout shifts were observed in the captured final state. Fonts appear to be loaded through Next/font-style preloading with fallback font classes, reducing but not eliminating the chance of font metric shifts.

## Recommendations For Original Adaptation

- Keep the no-heavy-media advantage unless real product screenshots or generated visuals add clear value.
- Use CSS blur/gradient effects sparingly and test on mobile.
- Split long public examples into lazy-loaded or paginated content if the example library grows.
- Prefer static rendering for marketing sections when possible.
- Respect `prefers-reduced-motion` for animated status dots and entrance effects.
- Monitor JavaScript payload because the marketing homepage does not require heavy interactivity.

