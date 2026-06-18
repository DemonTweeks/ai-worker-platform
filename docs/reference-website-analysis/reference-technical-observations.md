# Technical Implementation Observations

## Verified Findings

| Area | Finding | Evidence |
|---|---|---|
| Framework | Next.js | `_next/static/chunks`, `main-app`, `app/page` chunk names |
| Rendering approach | App Router style React/Next streaming | `self.__next_f.push` data in HTML |
| Styling | Tailwind CSS or Tailwind-style utilities | Rendered utility classes such as `max-w-7xl`, `py-16`, `bg-muted/30` |
| Design tokens | CSS variables using OKLCH | `--background`, `--primary`, `--radius`, etc. |
| Font loading | Preloaded WOFF2 plus font variables | Head preload and computed font stack |
| Icon style | SVG outline icons; likely Heroicons or similar | Inline SVGs with `stroke-width=1.5` and `data-slot=icon` |
| SEO metadata | Rich title, description, canonical, OG, Twitter | Head metadata |
| Structured data | WebApplication and FAQPage JSON-LD | Inline JSON-LD scripts |
| Analytics | Umami | `https://umami.top9.cc/script.js` |
| Authentication | Login/register routes; protected analysis/tool routes | Redirects to `/login?redirect=...` |
| Public examples | `/tasks` public task library | Route inspection |
| Images | No `<img>` elements on homepage | DOM image list empty |

## Strong Inferences

| Area | Inference | Confidence | Rationale |
|---|---|---:|---|
| Component library | Custom components with utility classes | Medium | Consistent cards/buttons but no obvious library DOM names |
| Animation library | Framer Motion or similar wrapper | Medium | Rendered data references delayed wrapper components and scale animation |
| Deployment | Vercel or Vercel-like Next hosting | Medium | Next static paths and app structure; no definitive hosting header captured |
| State management | Local React state for sample selection/menu/theme | Medium | Interactive sample list and theme script |
| Theming | Light/dark theme support present | High | Theme script toggles `light`/`dark`; CSS variables include dark classes |
| API pattern | Protected API routes under the same domain | High | MCP endpoint documented as `/api/mcp`; app redirects |

## Weak Inferences

| Area | Inference | Reason For Uncertainty |
|---|---|---|
| Exact icon library | Heroicons | SVG paths match common outline style, but library not directly named |
| Exact animation implementation | Framer Motion | Rendered wrappers imply animation; package not inspected |
| CDN | Platform/CDN unknown | Static assets are same-origin; headers not deeply analyzed |
| Component source organization | App directory components | Next app chunks imply structure but source unavailable |

## Unknowns

- Server-side data model for tasks.
- Queueing and async analysis implementation.
- Actual analysis form validation and loading states.
- Error handling for private workflows.
- API rate limits, caching strategy, and auth token storage.
- Accessibility of authenticated app surfaces.
- Payment/credit purchase workflow.

## Technical Risks

- Script-heavy React app could be more expensive than necessary for static marketing content.
- Long inline streamed payload increases HTML size.
- Homepage has no actual images, which keeps performance light but may feel less product-rich for some users.
- Theme support must be tested for contrast in dark mode; screenshots only verified light mode.

