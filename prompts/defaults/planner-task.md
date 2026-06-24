# Planner Task

Generate Turkish UykulukSciFi video ideas as JSON only.

Requirements:

- Return 5-10 ideas.
- All human-facing values must be Turkish, including `title`, `premise`, `targetDuration`, `style`,
  and `fit`.
- Do not use English titles, English descriptions, or English duration words such as `minutes`.
- Include title, premise, target duration, style, estimated difficulty, risk level, and fit.
- Use these exact keys for every idea: `id`, `title`, `premise`, `targetDuration`, `style`,
  `estimatedDifficulty`, `riskLevel`, and `fit`.
- Use exactly `low`, `medium`, or `high` for estimated difficulty and risk level.
- Use `targetDuration` values like `20 dakika`, `25 dakika`, or `30 dakika`.
- Make `fit` a short Turkish sentence explaining why the idea fits UykulukSciFi; do not return
  `low`, `medium`, or `high` for `fit`.
- Use scientific caution.
- Avoid overclaiming, clickbait, and unsupported certainty.
- Prefer calm cinematic science-fiction premises.
- The story should target at least 20 minutes of estimated narration time.
- Return only the final JSON payload. Do not include markdown fences, commentary, or thinking
  traces.
