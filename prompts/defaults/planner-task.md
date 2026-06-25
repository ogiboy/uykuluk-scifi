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
- Do not repeat four-word sentence frames across three or more `fit` explanations; each `fit` must
  explain a different concrete value for this channel.
- Avoid generic `fit` boilerplate such as `bilimsel soruları`, `doğasıyla uyumludur`,
  `etik dilemleri`, or `bilimsel sınırı aşan` across multiple ideas; name the concrete channel
  value.
- Spell `UykulukSciFi` exactly when mentioning the channel; do not write `UykulukSci`,
  `UykulukSciyFi`, or any other variant.
- Use Turkish style phrases such as `sakin sinematik bilimkurgu anlatısı`; do not use words like
  `calm`, `cinematic`, `science fiction`, `surreal`, or `imagery`.
- Do not use English scientific leftovers with Turkish suffixes, such as `anomaly’sı`; use Turkish
  terms like `anomali`, `sapma`, or `belirsiz ölçüm`.
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
  `premise` values and no four-word phrase repeats across three or more `fit` values. Rewrite any
  idea that repeats a premise or fit frame.
- Each `premise` must contain one clear speculative question or uncertainty marker such as
  `olabilir`, `belki`, `henüz bilinmeyen`, `varsayalım`, or `kesin kanıt değildir`.
- Do not use `Belki bu` in more than one premise. Vary uncertainty placement with forms such as
  `varsayalım`, `henüz açıklanmamış`, `kesin kanıt değildir`, or a direct cautious question.
- Do not reuse generic unknown-species boilerplate such as `bilinmeyen bir tür`,
  `izlerini saklıyor`, or `varlığına dair ipucu` across multiple ideas; make uncertainty
  lane-specific.
- Do not reuse weak action boilerplate such as `bilgiyi bulduktan sonra` or `anlamaya çalışır`
  across multiple premises; give each premise a concrete different action.
- Do not reuse weak journey or clue boilerplate such as `anlamak için yola çıkar`,
  `hakkında ipuçları içeriyor`, `incelemeyi öngörür`, `inceleyerek`, `yansıtmakta`, or repeated
  `gösteriyor olabilir mi`; state the concrete observation, experiment, dilemma, or visual review
  value for that slot.
- Prefer calm cinematic science-fiction premises.
- The story should target at least 20 minutes of estimated narration time.
- Return only the final JSON payload. Do not include markdown fences, commentary, or thinking
  traces.
