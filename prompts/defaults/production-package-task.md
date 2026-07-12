# Production Package Task

Generate a production package from the approved script.

Outputs:

- Clean voiceover text.
- Subtitle segments.
- Scene-by-scene visual prompts.
- Popup info card text.
- Lower-third or name-panel suggestions.
- YouTube title, description, and tags draft.

Do not trigger TTS, image generation, render, upload, or publish.

Requirements:

- All human-facing text must be Turkish.
- Do not invent people, planets, institutions, species, measurements, or claims that are absent from
  the approved script. Reuse only names and facts already present there.
- Keep YouTube tags Turkish; do not add English translation tags.
- Lower thirds must describe roles, evidence, or scenes from the approved script and must not invent
  a named expert.
- Keep the title specific and credible; avoid generic mystery or clickbait suffixes.
- Return these top-level keys exactly: `popupCards`, `lowerThirds`, and `youtube`.
- `youtube` must include `title`, `description`, and `tags`.

Return only the final JSON payload. Do not include markdown fences, commentary, or thinking traces.
