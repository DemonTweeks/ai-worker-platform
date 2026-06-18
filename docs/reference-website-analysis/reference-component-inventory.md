# Component Inventory

## Navigation

| Component | Purpose | Structure | Visual Treatment | Interaction | Responsive | Essential |
|---|---|---|---|---|---|---|
| Header | Global orientation | Logo, nav links, icon control, auth actions | Sticky, 64 px, transparent top | Active underline, hover color | Collapses to mobile menu | Yes |
| Desktop navigation | Route discovery | Six text links | Small text, active bottom border | Hover border/text color | Hidden on mobile | Yes |
| Mobile menu | Compact navigation | Vertical nav, login/register | Full-width dropdown panel | Hamburger toggles close icon | Visible below estimated 640 px | Yes |
| Logo area | Brand anchor | Text logo link | Gradient text | Links home | Same on mobile | Yes |
| Login action | Returning user path | Outlined button/link | Small rounded border | Hover border/accent | In mobile menu | Yes |
| Registration action | Conversion | Filled primary button/link | Primary blue fill | Hover darkens | In mobile menu | Yes |
| Icon-only control | Likely theme/display control | Button with icon | Muted icon button | Hover/focus state | Present desktop and mobile | Optional |

Accessibility requirements: preserve semantic `nav`, unique button names, visible focus states, `aria-expanded` on menu button, and sufficient touch targets.

## Hero

| Component | Purpose | Structure | Visual Treatment | Interaction | Variants |
|---|---|---|---|---|---|
| Hero badge | Fast reassurance | Dot + short label | Pill, border, pale surface | None | Status/trust badge |
| Hero heading | Core promise | Two-line contrast statement | Large bold text, gradient emphasis | None | Outcome-focused heading |
| Hero description | Explain product | Paragraph | Muted text, wide line height | None | Short/long variants |
| Platform badges | Supported-platform scan | Pill labels | Pale accent border/fill | None | Platform/category badges |
| Primary CTA | Start analysis | Text + arrow icon | Blue/violet gradient, shadow | Navigates to app/login | Full-width mobile |
| Secondary CTA | Download URL or guide | Text + icon | White/transparent outlined buttons | Navigate to tool/guide | Multiple secondary actions |
| Metrics strip | Reduce uncertainty | Three metrics | Gradient numbers with dividers | None | KPI/trust metrics |
| Product preview card | Demonstrate workflow | Header, faux input, output categories, checklist, CTA | Elevated glass card with gradient border | CTA link, hover on category tiles | Could become real form |

## Forms

| Component | Purpose | Structure | Visual Treatment | Interaction | Essential |
|---|---|---|---|---|---|
| URL input preview | Demonstrate minimum input | Label, icon, sample URL | Bordered rounded panel with focus ring styling | Static on homepage | Yes |
| Submit button | Main workflow action | Full-width button | Gradient primary | Navigates to analysis/login | Yes |
| Login form | Auth | Email, password, forgot link, submit, Google | Centered form page | Validation inferred, not verified | Yes |
| Register form | Conversion | Username, email, password, confirm, optional invite | Centered form page | Validation inferred, not verified | Yes |

## Content

| Component | Purpose | Structure | Visual Treatment | Interaction | Responsive |
|---|---|---|---|---|---|
| Benefit card | Immediate role/job explanation | Icon, heading, caption | Compact border card | None | Stacks |
| Sample task item | Proof/example selection | Title, metadata | Active filled primary; inactive bordered card | Click/selection inferred from button styling | Stacks |
| Result panel | Output demonstration | Title, source, detail link, summary list | Large white card | Links out | Full width mobile |
| Feature card | Capability explanation | Icon, heading, paragraph, checklist | Border card, hover shadow | Hover border/shadow | 3 columns to 1 |
| Audience card | Role segmentation | Icon, role, sentence | Centered small card | Hover border/shadow | 4 columns to 1 |
| Solution card | Platform SEO/conversion | Heading, paragraph, text link | Larger card | Text link to platform page | 3 columns to 1 |
| FAQ item | Objection handling | Question + answer | Static rounded card | None | Single column |

## Feedback

| Component | Purpose | Structure | Visual Treatment | Interaction | Notes |
|---|---|---|---|---|---|
| Online status badge | Service confidence | Dot + status text | Emerald pill, subtle ring | Animated pulse | Verified in hero preview |
| Check-list row | Reassurance | Check icon + text | Emerald or accent icon | None | Used in preview and cards |
| Task status badge | Task state | Icon/text status | Colored statuses | In task list | Verified on `/tasks` preview |
| Loading/skeleton | Unknown | Not observed | Unknown | Unknown | Likely exists in app routes |
| Toast/modal | Unknown | Not observed | Unknown | Unknown | Implied by app complexity only |

## Data Display

| Component | Purpose | Structure | Visual Treatment | Interaction | Essential |
|---|---|---|---|---|---|
| Public task list | Browse examples | Search, filters, task cards | Dense list/cards | Filter/search; search needs login | Yes for proof |
| Result detail link | Deeper trust | Text link | Blue/accent link | Opens task detail | Optional |
| Developer command block | MCP setup | Code snippet | Monospace block | Copy behavior not verified | Yes for developer page |

## Conversion

| Component | Purpose | Placement | Behavior |
|---|---|---|---|
| Header register button | Persistent signup | Desktop header and mobile menu | Navigate to `/register` |
| Hero primary CTA | Main conversion | First viewport | Navigate to `/analysis`, login redirect if needed |
| Product preview CTA | Reinforced trial | Hero preview card | Navigate to `/analysis` |
| Solution text links | SEO-to-action bridge | Solution cards | Navigate to platform-specific pages |
| Guide CTAs | Low-friction onboarding | Guide and hero | Navigate to analysis/tool |

## Footer

No conventional footer component was visible on the captured homepage. A future original site should include footer navigation, legal links, support contact, and product status or documentation links.

