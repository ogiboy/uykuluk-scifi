# Planner Task

Generate Turkish UykulukSciFi video ideas as JSON only.

Requirements:

- Return exactly 8 ideas.
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
- Make every `fit` explanation specific to that idea's title, lane, visual promise, and scientific
  caution. Do not reuse the same `fit` sentence frame across ideas.
- Spell `UykulukSciFi` exactly when mentioning the channel; do not write `UykulukSci`,
  `UykulukSciyFi`, or any other variant.
- Use Turkish style phrases such as `sakin sinematik bilimkurgu anlatısı`; do not use words like
  `calm`, `cinematic`, `science fiction`, `surreal`, or `imagery`.
- Use scientific caution.
- Avoid overclaiming, clickbait, and unsupported certainty.
- Do not present invented mechanisms as established science. If the premise is fictional, make the
  uncertainty visible instead of saying science has shown it.
- Avoid near-duplicate ideas. Each title, premise, and central question must be meaningfully
  different from the others.
- Use eight different topic lanes across the list. Pick from lanes such as buzaltı okyanusları,
  ötegezegen jeolojisi, kuşak gemileri, insan-sonrası arkeoloji, yörünge arşivleri,
  gezegen-dönüştürme etiği, zaman gecikmeli sinyaller, otonom sondalar, derin uzay yaşam alanları,
  veya belirsiz biyolojik imza sinyalleri.
- Do not copy English lane names into the output; use Turkish terms such as `ötegezegen`, not
  `exoplanet`.
- Do not reuse the same protagonist, setting, central object, conflict, or discovery pattern across
  ideas.
- Do not use `Uyku`, `Yıldız`, `Karanlık`, `Mesaj`, or `Gezegen` in more than one title each. Prefer
  more specific titles built from the lane, artifact, place, or dilemma instead of generic astronomy
  words.
- Before finalizing, internally check that no five-word phrase repeats across three or more
  `premise` values. Rewrite any idea that repeats a premise frame.
- Each `premise` must contain one clear speculative question or uncertainty marker such as
  `olabilir`, `belki`, `henüz bilinmeyen`, `varsayalım`, or `kesin kanıt değildir`.
- Prefer calm cinematic science-fiction premises.
- The story should target at least 20 minutes of estimated narration time.
- Return only the final JSON payload. Do not include markdown fences, commentary, or thinking
  traces.
