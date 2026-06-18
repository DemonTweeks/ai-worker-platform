# Reference Page Structure And Section Sequencing

## Verified Homepage Sequence

| Order | Section | Target User Question | Content Type | Layout | CTA Behavior | Responsive Behavior |
|---:|---|---|---|---|---|---|
| 1 | Header | Where can I go and how do I sign in? | Nav links and auth actions | Horizontal desktop nav | Login/register persistent | Collapses below the `sm` breakpoint, estimated near 640 px |
| 2 | Hero | What is this and why should I care? | Eyebrow, headline, description, platform badges, CTAs, metrics, product preview | Two-column desktop grid | Primary analysis CTA, secondary download/guide CTAs | Stacks into single column on mobile |
| 3 | Benefit strip | Who is this for and what job does it solve? | Three compact cards | Three columns desktop | No CTA | Stacks vertically on mobile |
| 4 | Analysis showcase | What does an output look like? | Left list of example tasks, right result panel | Two-column result demo | Links to source and full analysis detail | Stacks on mobile; result content becomes long |
| 5 | Features | What capabilities are included? | Six feature cards with icons and checklists | Three columns x two rows | No direct CTA | Cards stack one per row on mobile |
| 6 | Use cases | Which role-specific problem does it solve? | Four audience cards | Four columns | No direct CTA | Cards stack vertically |
| 7 | Solutions | Which platforms are supported? | Three platform cards | Three columns | Each card links to a platform solution page | Cards stack vertically |
| 8 | FAQ | What objections remain? | Three static FAQ cards | Centered single column | No direct CTA | Single column retained |

## Section Detail

### Header

Purpose: establishes brand, exposes product routes, and keeps auth visible.  
Visual treatment: transparent sticky bar, active nav underline, small rounded auth buttons.  
Spacing: estimated 64 px height, `max-w-7xl` container, desktop horizontal padding around 32 to 80 px depending viewport.

### Hero

Purpose: compress the product promise into one sentence and show a realistic path to action.  
Heading pattern: short contrast statement with a gradient emphasis line.  
Content density: medium-high, but organized into badges, CTAs, metrics, and preview.  
Transition: the hero flows into a benefit strip, so users get role-specific reinforcement without a hard break.

### Benefit Strip

Purpose: gives three immediate user jobs: operator, creator, team.  
Visual treatment: white cards with thin borders and small icon tiles.  
Trade-off: compact and efficient, but the cards are easy to skim past because there is no strong heading.

### Analysis Effect Showcase

Purpose: proves that the system produces structured output, not merely a vague marketing promise.  
Layout: example list on the left and selected result panel on the right.  
Interaction: the list items have active and hover styles; the selected item changes the displayed sample in the app code.  
Risk: sample topics are highly specific and may date quickly; future original sites should use representative but owned examples.

### Features

Purpose: converts capabilities into benefits: summary structure, subtitles, follow-up Q&A, archive, download extraction, API/MCP workflows.  
Layout: six reusable cards, 3x2 desktop.  
Visual treatment: icon tile, heading, paragraph, checklist.  
Effectiveness: strong because each feature card says what the user can do next, not just which technology exists.

### Use Cases

Purpose: role-based segmentation.  
Layout: four compact centered cards.  
Effectiveness: quick scan for "is this for me?"  
Weakness: no CTA or deeper link from each audience card.

### Solutions

Purpose: SEO and platform segmentation for Douyin, Xiaohongshu, and Bilibili.  
Layout: three larger cards with text link CTAs.  
Effectiveness: helps discovery and clarifies supported platforms.  
Risk: may feel repetitive after feature/use-case cards if expanded too much.

### FAQ

Purpose: objection handling around supported platforms, Douyin summarization, and team fit.  
Layout: static cards rather than accordion.  
Accessibility benefit: content is visible without interaction.  
Risk: no footer or final CTA after FAQ weakens closing conversion momentum.

## How The Sequence Supports Conversion

1. Understand product: hero headline and product preview.
2. Recognize value: metrics and benefit strip.
3. Trust output: analysis showcase.
4. Discover features: six-card feature grid.
5. Map to user role: use-case cards.
6. Map to platform: solution cards.
7. Resolve objections: FAQ.
8. Convert: header and hero CTAs; solution links; app routes redirect to login.

## Repetitive Or Weak Areas

- Feature, use-case, and solution sections all use card grids. This creates consistency, but a future original site should vary rhythm with a workflow timeline or a compact comparison table.
- The FAQ ends the page without a visible footer or final conversion block.
- The public examples are persuasive, but they introduce long text blocks that can overwhelm mobile readers.

