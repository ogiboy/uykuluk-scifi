# Design System Direction

Use this before future Next.js Producer Studio work or visual asset generation.

## Visual Personality

- cinematic;
- dark but not monochrome;
- quiet production-desk energy;
- precise grids and stable panels;
- high contrast for review readability;
- subtle scanline, starfield, orbital, telemetry, or waveform motifs only when they support the
  task.

## UI Principles

- Build the working surface first, not a landing page.
- Use tabs for run detail sections.
- Use tables for run lists and ledgers.
- Use side panels or dialogs for approvals.
- Use segmented controls for stage filters.
- Use badges for state, warning, block, and approval status.
- Use icon buttons for repeated tools.
- Use cards only for repeated artifacts, modals, and framed previews.
- Do not put cards inside cards.
- Keep text compact and scannable.

## Producer Studio Layout

Expected first-screen composition:

- left rail or top bar for runs/assets/settings;
- run list or current run queue;
- active run detail;
- right-side evidence/next-action rail;
- persistent warning/blocked-action area.

## Taste Skill Routing

- Producer Studio is a dense operator product. Do not use `gpt-taste`, `design-taste-frontend`, or
  `design-taste-frontend-v1` as its primary design authority.
- For Studio work, use this file with Product Design context gathering and Build Web Apps
  implementation/QA. A taste skill may contribute only bounded checks such as anti-generic
  composition, hierarchy, contrast, consistency, reduced motion, and accessibility.
- For public product, campaign, or channel-facing web pages, prefer `design-taste-frontend`.
- Use `gpt-taste` only for an explicitly requested cinematic/Awwwards-style landing page whose
  motion and dependency budget supports GSAP-heavy composition.
- Use `stitch-design-taste` only for a Google Stitch design-system or screen-generation workflow
  when Stitch access is available.
- Use `design-taste-frontend-v1` only for exact legacy compatibility.
- Select one taste skill per task. Never merge their full rule sets.

## Brand Assets

Committed assets should drive the visual language:

- square logo;
- transparent watermark;
- corner logo bug;
- YouTube banner;
- subtitle panel;
- lower-third;
- name panel;
- popup info card;
- title card;
- end screen.

## Avoid

- stock SaaS gradients;
- decorative blobs or orbs;
- generic purple AI glow;
- oversized hero marketing composition;
- fake tiny dashboard details;
- UI that hides approval or cost state below the fold.
