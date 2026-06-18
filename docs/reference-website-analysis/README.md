# Reference Website Analysis

## Analysis Objective

Analyze the public reference website at https://ai-douyin.top9.cc/ in enough detail to guide a future original website with similar polish, clarity, and usability, without copying source code, brand identity, exact wording, assets, layouts, or proprietary material.

## Analysis Date

2026-06-18

## Scope

Included:

- Public homepage.
- Desktop and mobile responsive behavior.
- Public navigation routes.
- Public task/tool/guide/developer/about/login/register pages at a high level.
- Visual style, information architecture, page structure, design system, components, interactions, conversion flow, technical clues, performance observations, and accessibility review.

Excluded:

- Authenticated/private workflows.
- Source-code inspection of the reference site.
- Intrusive testing, bypassing authentication, or private API access.
- Any production implementation or redesign work.

## Method Used

- Captured desktop and mobile screenshots with Playwright.
- Inspected rendered DOM, CSS variables, metadata, routes, headings, layout measurements, and public scripts.
- Checked public route redirects for protected app actions.
- Recorded verified findings separately from estimates and inferences.
- Created Mermaid diagrams and Markdown documentation under this folder.

## Key Findings

- The site is a product-first AI video-analysis web app with marketing support.
- The main conversion path is starting an analysis, which redirects unauthenticated users to login.
- The first viewport combines outcome-focused copy with a simulated one-link product preview.
- The homepage uses a short sequence: hero, benefit strip, public output showcase, features, use cases, platform solutions, FAQ.
- The design system is a clean light SaaS interface with OKLCH tokens, blue/violet accents, soft cards, rounded controls, and restrained motion.
- The technical implementation appears to be Next.js with Tailwind-style utilities, JSON-LD metadata, and Umami analytics.
- The mobile layout is usable and avoids horizontal overflow, but the page becomes long and card-heavy.
- A conventional footer was not visible on the captured homepage.

## Strongest Patterns Worth Adapting

1. Outcome-first hero with immediate workflow preview.
2. Public examples that make AI outputs tangible.
3. Multiple entry paths: analysis, download utility, guide, developer docs.
4. Feature cards that translate capabilities into benefits.
5. Role and platform segmentation for self-identification and SEO.
6. Clear mobile navigation with a full-width menu.
7. Developer/MCP path that suggests product maturity.

## Main Weaknesses

1. Logo and page hero both render as `h1`, creating heading hierarchy risk.
2. Primary CTA requires login before actual use, which can interrupt trial momentum.
3. Repeated card grids create visual monotony.
4. Long sample content makes the mobile page lengthy.
5. Hover affordances may imply clickability on some non-clickable cards.
6. No visible homepage footer or final CTA after FAQ.
7. Reduced-motion and dark-mode accessibility were not fully verified.

## Generated Documents

- [Website overview](reference-website-overview.md)
- [Information architecture](reference-information-architecture.md)
- [Page structure](reference-page-structure.md)
- [Visual design system](reference-visual-design-system.md)
- [Design tokens](reference-design-tokens.md)
- [Component inventory](reference-component-inventory.md)
- [Interaction analysis](reference-interaction-analysis.md)
- [Responsive analysis](reference-responsive-analysis.md)
- [Copy and conversion analysis](reference-copy-and-conversion-analysis.md)
- [Technical observations](reference-technical-observations.md)
- [Performance observations](reference-performance-observations.md)
- [Accessibility review](reference-accessibility-review.md)
- [Strengths and risks](reference-strengths-and-risks.md)
- [Original adaptation guidelines](reference-adaptation-guidelines.md)
- [Screenshot index](screenshots/README.md)

## Diagrams

- [Sitemap](diagrams/sitemap.md)
- [Homepage section flow](diagrams/homepage-section-flow.md)
- [User conversion flow](diagrams/conversion-flow.md)
- [Component relationship map](diagrams/component-map.md)

## Screenshots

- [Desktop homepage full](screenshots/desktop-homepage-full.png)
- [Desktop header](screenshots/desktop-header.png)
- [Desktop hero](screenshots/desktop-hero.png)
- [Desktop main interaction](screenshots/desktop-main-interaction.png)
- [Desktop analysis preview](screenshots/desktop-analysis-preview.png)
- [Desktop features](screenshots/desktop-features.png)
- [Desktop use cases](screenshots/desktop-use-cases.png)
- [Desktop solutions](screenshots/desktop-solutions.png)
- [Desktop FAQ](screenshots/desktop-faq.png)
- [Mobile homepage full](screenshots/mobile-homepage-full.png)
- [Mobile header](screenshots/mobile-header.png)
- [Mobile menu](screenshots/mobile-menu.png)
- [Mobile hero](screenshots/mobile-hero.png)
- [Mobile main interaction](screenshots/mobile-main-interaction.png)
- [Mobile features](screenshots/mobile-features.png)
- [Mobile FAQ/end area](screenshots/mobile-faq-footer.png)

## Known Limitations

- The in-app browser automation surface was unavailable, so Playwright CLI/local browser capture was used instead.
- Authenticated pages were not accessed.
- Section screenshot crops are approximate.
- Performance observations are lightweight snapshots, not Lighthouse audits.
- Dark mode, full keyboard navigation, real form validation, loading states, and error states were not fully tested.
- Exact values are only claimed where measured or observed; otherwise they are labeled as estimates or inferences in the relevant documents.

## Verified Versus Inferred Findings

Verified findings come from screenshots, rendered DOM, route inspection, CSS variables, metadata, and observed redirects. Inferred findings are explicitly labeled and should be validated before being used as implementation requirements.

## Compliance Notes

- No production implementation files were modified.
- No production UI code was created.
- No reference source code, proprietary assets, images, scripts, logos, fonts, or exact copyrighted content were copied into a product implementation.
- Screenshots are documentation artifacts only and must not be reused as production assets.

