# Original Adaptation Guidelines

## Reusable Structural Ideas

- Use a product-first hero with a clear outcome promise.
- Place a workflow preview near the top of the page.
- Offer more than one entry path: primary workflow, lower-friction utility, and guide/docs.
- Follow with proof, features, role-specific use cases, platform/solution pages, FAQ, and footer.
- Segment technical integration content into a dedicated developer path.

## Reusable Visual Principles

- Constrained containers inside full-width sections.
- High-contrast text on calm light surfaces.
- Soft card borders and restrained shadows.
- Icon-led cards with concise headings and checklists.
- Clear active states in navigation.
- Full-width mobile CTAs.

## Reusable Interaction Patterns

- Sticky header with mobile hamburger menu.
- CTA buttons with clear hover/focus states.
- Product preview that clarifies minimum input and expected outputs.
- Public examples as proof, provided they are original and owned.
- FAQ content visible by default or in accessible accordions.

## What Must Remain Original

Do not copy:

- The logo.
- The brand name.
- The exact color palette without adjustment.
- The exact layout measurements.
- The exact text.
- The screenshots or visible content examples as production assets.
- Images, icons, fonts, scripts, or proprietary assets.
- Source code, component names, or private implementation details.
- Public task examples or task result copy.
- The exact route structure if it would create brand confusion.

Also do not hotlink assets, imitate a misleadingly similar brand, or create a pixel-for-pixel clone.

## How To Avoid A Clone

1. Change the brand system: logo, name, color ratios, type scale, illustration/photo strategy, and voice.
2. Keep the strategic sequence but alter layout rhythm. For example, use a real product screenshot, a workflow timeline, or side-by-side before/after output.
3. Write entirely new copy around the future product's exact users and jobs.
4. Use different examples and owned data.
5. Adjust card radius, shadow style, spacing, and section order.
6. Use a distinct conversion model, such as guest sample analysis, demo mode, or clearer pricing path.

## Accessibility Improvements To Build In

- Use one page-level `h1`.
- Add a proper footer with support, legal, privacy, and contact routes.
- Ensure all icon buttons have accessible names.
- Respect `prefers-reduced-motion`.
- Test keyboard navigation through mobile menu, cards, tabs, forms, and dialogs.
- Maintain visible focus indicators.
- Avoid color-only status indicators.
- Verify contrast in light and dark themes.

## Maintainability Improvements

- Define design tokens before building components.
- Create component variants for cards, badges, buttons, forms, and status messages.
- Keep marketing examples in data files or CMS content, not hardcoded component bodies.
- Separate public marketing routes from authenticated app surfaces.
- Keep developer docs versioned and clearly dated.

## Performance Improvements

- Static-render marketing sections where possible.
- Lazy-load heavy examples below the fold.
- Avoid excessive blur effects and animated glows.
- Use actual optimized images only when they add product clarity.
- Keep third-party analytics minimal.

## Scalability Improvements

- Add a final conversion/footer section.
- Give role cards deeper pages only when there is enough unique content.
- Add comparison/pricing only if users need buying clarity.
- Use content governance for public examples so stale or risky examples can be removed.

