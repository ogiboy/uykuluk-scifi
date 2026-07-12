# UykulukSciFi Visual Assets

Imported from:

- `/Users/ogiboy/Documents/uykulukscifi_youtube_visual_pack.zip`
- `/Users/ogiboy/Documents/uykulukscifi_addon_visual_pack.zip`

## Brand

- `brand/uykulukscifi_channel_logo_square_1024.png` - square channel logo.
- `brand/uykulukscifi_watermark_transparent_500.png` - transparent watermark.
- `brand/uykulukscifi_youtube_banner_2048x1152.jpg` - YouTube channel/banner art.
- `brand/corner_logo_bug_520x190.png` - corner logo bug for video overlays.

## Overlays

- `overlays/subtitle_panel_blank_1700x190.png` - blank subtitle panel.
- `overlays/subtitle_panel_sample_1700x190.png` - subtitle panel sample.
- `overlays/video_lower_third_banner_1920x240.png` - lower-third banner.
- `overlays/name_panel_1100x280.png` - name/title panel.
- `overlays/popup_info_card_900x520.png` - popup info card.

## Intro / Outro

- `intro/episode_title_card_1920x1080.jpg` - episode title card.
- `intro/frames/intro_frame_00.jpg` through `intro/frames/intro_frame_05.jpg` - 1920x1080 intro
  render source frames.
- `outro/youtube_end_screen_1920x1080.jpg` - YouTube end screen.
- `outro/frames/outro_frame_00.jpg` through `outro/frames/outro_frame_05.jpg` - 1920x1080 outro
  render source frames.

## Thumbnails

- `thumbnails/thumbnail_template_01_left_1280x720.jpg` - 1280x720 thumbnail template with left text
  composition.
- `thumbnails/thumbnail_text_safe_overlay_01_left_1280x720.png` - matching transparent text-safe
  overlay.
- `thumbnails/thumbnail_template_02_right_1280x720.jpg` - 1280x720 thumbnail template with right
  text composition.
- `thumbnails/thumbnail_text_safe_overlay_02_right_1280x720.png` - matching transparent text-safe
  overlay.
- `thumbnails/thumbnail_template_03_center_1280x720.jpg` - 1280x720 thumbnail template with center
  text composition.
- `thumbnails/thumbnail_text_safe_overlay_03_center_1280x720.png` - matching transparent text-safe
  overlay.

## Background Plates

- `backgrounds/plate_01_deep_space_grid_1920x1080.jpg` - deep-space grid background plate.
- `backgrounds/plate_02_planet_horizon_1920x1080.jpg` - planet horizon background plate.
- `backgrounds/plate_03_blackhole_ring_1920x1080.jpg` - black-hole ring background plate.
- `backgrounds/plate_04_signal_lab_1920x1080.jpg` - signal lab background plate.
- `backgrounds/plate_05_nebula_data_field_1920x1080.jpg` - nebula data field background plate.
- `backgrounds/plate_06_observatory_night_1920x1080.jpg` - observatory night background plate.

## Transitions

- `transitions/transition_01_soft_glitch_transparent_1920x1080.png` - transparent soft-glitch
  transition overlay.
- `transitions/transition_02_heavy_glitch_transparent_1920x1080.png` - transparent heavy-glitch
  transition overlay.
- `transitions/transition_03_no_signal_transparent_1920x1080.png` - transparent no-signal transition
  overlay.
- `transitions/transition_04_cyan_orange_scan_transparent_1920x1080.png` - transparent cyan/orange
  scan transition overlay.

## Popup Icons

- `icons/icon_telescope_512.png` - telescope popup icon.
- `icons/icon_planet_512.png` - planet popup icon.
- `icons/icon_warning_512.png` - warning popup icon.
- `icons/icon_fact_check_512.png` - fact-check popup icon.
- `icons/icon_signal_512.png` - signal popup icon.

## Waveform Overlays

- `waveforms/waveform_overlay_thin_panel_transparent_1920x240.png` - thin transparent waveform
  panel.
- `waveforms/waveform_overlay_orange_panel_transparent_1920x240.png` - orange transparent waveform
  panel.
- `waveforms/waveform_overlay_full_width_transparent_1920x320.png` - full-width transparent waveform
  panel.

## Source Pack Notes

- `source-docs/addon-visual-pack/README.md` - original addon pack notes.
- `source-docs/addon-visual-pack/manifest.json` - original addon pack manifest.

Creative, design, and marketing agents must route through `.ai/capabilities.instructions.md` before
creating or changing production assets. Generated assets still require source, licensing, and
inventory documentation here.

## Production Evidence Contract

These files are tracked production inputs. Script review and approval are content-addressed today;
evidence also records runtime prompt hashes. Render planning now records exact selected asset paths,
roles, and SHA-256 digests in `production/asset_provenance.json` rather than inferring them from
directory presence. Security dependency auditing covers executable packages; asset provenance
remains governed by this tracked inventory and per-run evidence. Readiness/evidence state
synchronization does not imply that optional asset gaps are resolved; the asset check status remains
independently reviewable.

The current asset guard inventories brand, overlay, intro, and outro directories. Logo, watermark,
subtitle/lower-third, intro, and outro availability all contribute operator-visible readiness
warnings.

`pnpm producer doctor` runs the same inventory before a run and records the result in ignored local
project diagnostics. Asset warnings do not create a run or imply production approval.

Generation budget preflight does not infer asset readiness or mutate this inventory. It only blocks
provider-backed artifact creation before these production inputs could be referenced downstream.
Tracked runtime prompt changes likewise affect future text artifacts only; they do not rewrite,
approve, or change the provenance of committed production assets.

Script revisions snapshot text artifacts and invalidate script review/approval only. They do not
modify or reclassify files in the tracked asset inventory.

## Current Render Use

The local render planner records `intro/frames/*` and `outro/frames/*` as source-frame provenance
when present. The draft FFmpeg renderer can expand those committed frames into local intro/outro
bookend inputs for review MP4s. These frame sources remain tracked inputs, not generated run output
or upload approval.

The current popup-card PNG is a styled sample/template asset with placeholder copy. During local
draft rendering, the scene-scoped popup filter masks that placeholder content before drawing plain,
wrapped run-specific text; the card, lower-third, and waveform are hidden from intro/outro. Editable
or blank layered popup-card sources remain preferable for final channel production.

The manual channel handoff derives `production/thumbnail_candidates.*` from tracked
`thumbnails/thumbnail_template_*` and matching `thumbnail_text_safe_overlay_*` files. These are
review candidates only; they do not generate images, upload media, or approve publishing.

## Still Useful To Create Later

- Editable Figma, PSD, SVG, or layered source files for thumbnail and overlay text changes.
- Render-ready intro/outro MP4 clips generated from the committed source frames for reuse by editors
  outside the local draft renderer.
- Font files and license notes for recurring title, thumbnail, lower-third, and subtitle typography.
- Additional series-specific background plates once recurring episode categories are defined.
- Storyboard/contact-sheet refinements based on repeated real-run review evidence.
