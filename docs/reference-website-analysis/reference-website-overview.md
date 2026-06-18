# Reference Website Overview

Reference URL: https://ai-douyin.top9.cc/  
Analysis date: 2026-06-18

## Scope And Evidence

This document summarizes the visible public website only. Findings are based on live desktop and mobile screenshots, rendered DOM inspection, public route checks, metadata, and non-intrusive browser performance data. Authenticated workflows were not entered.

## Concise Overview

The website presents an AI video-analysis product for turning short-video links into summaries, subtitles, content insights, and operational recommendations. The visible target audience is creators, content operators, brand marketers, MCN teams, ecommerce sellers, and technical users who want API or MCP access.

The primary user action is to start an analysis by submitting a video link. Secondary actions include retrieving a downloadable video URL, reading a guide, browsing public analysis examples, viewing tools, registering, logging in, and reading MCP documentation.

The main value proposition is speed and structure: the product promises to reduce the effort of watching and manually extracting insights from videos by producing a compact, reusable analysis. The site is product-first with marketing support: the first viewport sells the outcome, but the hero also contains a product-like interaction preview.

## Overall Strategy

In plain language, the site tries to make the product feel immediately usable. It does this by:

- Explaining the product in one outcome-focused hero.
- Showing a simulated input/result card above the fold.
- Offering a real app path through the primary CTA.
- Using public examples to make outputs concrete.
- Segmenting value by features, audiences, platforms, and developer integration.
- Repeating registration and analysis entry points across public routes.

## Verified Findings

| Area | Finding | Evidence |
|---|---|---|
| Product type | AI video summary and analysis web app | Page title, JSON-LD WebApplication, hero/product preview |
| Language | Chinese-first site | `html lang="zh-CN"` |
| Target users | Creators, operations teams, MCNs, brands, ecommerce, developers | Homepage sections and public route content |
| Primary CTA | Start analysis | Hero CTA links to `/analysis`, which redirects unauthenticated users to login |
| Secondary CTA | Download URL retrieval and guide | Hero CTAs link to `/tools/video-download` and `/guide` |
| Visual direction | Clean SaaS interface with light surfaces, blue/violet gradient accents, soft cards | Screenshots and CSS variables |
| Technical posture | Next.js app with Tailwind-style utility classes | `_next/static` chunks and rendered class names |
| Analytics | Umami script loaded | `https://umami.top9.cc/script.js` in page scripts |

## Inferred Findings

| Inference | Confidence | Rationale |
|---|---:|---|
| Product maturity is early-to-mid stage | Medium | Polished marketing, public task examples, auth routes, tools, MCP docs, but compact homepage and limited footer |
| Conversion goal is registration and repeated analysis usage | High | Register/login are persistent, `/analysis` and `/tools/video-download` redirect to login, newcomer credits are mentioned |
| UX strategy is low-friction trial framing before login | High | Above-fold preview and public examples reduce uncertainty before requiring account |
| Main audience is operational rather than casual consumers | High | Use-case language emphasizes analysis,复盘, batch workflows, API/MCP |

## Screenshots

- [Desktop homepage full](screenshots/desktop-homepage-full.png)
- [Desktop hero](screenshots/desktop-hero.png)
- [Desktop main interaction](screenshots/desktop-main-interaction.png)
- [Mobile homepage full](screenshots/mobile-homepage-full.png)
- [Mobile menu](screenshots/mobile-menu.png)

