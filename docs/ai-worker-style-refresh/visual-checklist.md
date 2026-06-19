# Visual Checklist

Use this checklist during browser and viewport verification. It is not a substitute for baseline tests.

## Required Routes

- `/`
- `/history`
- `/jobs/QA15-ROUTE-SMOKE`
- `/admin/login`
- `/admin/assets`
- `/admin/audit-logs`
- `/admin/health`

## Viewports

- Desktop: 1440px wide.
- Desktop/narrow: 1280px wide.
- Tablet: 1024px and 768px wide.
- Mobile: 430px, 390px, and 360px wide.

## Visual Criteria

- Content uses constrained, consistent widths without horizontal overflow.
- Header and navigation wrap cleanly without overlapping labels.
- Home cockpit preserves upload, scope, sites, download, chatbox, and worker console workflows.
- Cards use soft borders and restrained shadows without making static panels look like links.
- Primary, secondary, download, tertiary, and segmented controls have clear hierarchy.
- Forms have visible focus states and enough touch target height on mobile.
- Status indicators include readable text and do not rely on color alone.
- Motion is restrained and respects reduced-motion preferences.
- Tables, job IDs, long messages, and generated text wrap without breaking layout.
- Admin and history/detail pages retain all visible actions and navigation destinations.

## Evidence To Capture

- Before/after notes or screenshots for home, history, detail, admin login, admin assets, admin audit logs, and admin health.
- Mobile screenshots for `/`, `/history`, and one admin route.
- Notes for any route that cannot display realistic data without backend fixtures.
