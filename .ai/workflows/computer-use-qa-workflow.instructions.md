# Computer Use QA Workflow

Use this only when terminal tests cannot verify a future UI behavior.

## Current Use

No Computer Use action is required for the current CLI-only project.

## Future Dashboard Use

Use Computer/Browser tooling for:

- visual inspection of dashboard pages;
- approval dialog ergonomics;
- asset preview rendering;
- mobile/desktop screenshot checks;
- text overlap and layout regressions.

## Confirmation Boundaries

Ask before direct UI actions that:

- upload files to a third-party service;
- submit public or scheduled content;
- create or change accounts, permissions, keys, or passwords;
- delete local/cloud data through a GUI;
- transmit sensitive data.

Do not use Computer Use to bypass browser security warnings or paywalls.
