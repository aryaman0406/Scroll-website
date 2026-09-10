---
name: scroll-site-generator
description: Generates a complete Apple-style brand website from a short brief — an AI-generated cinematic scroll film (Higgsfield stills + Kling clips scrubbed frame-by-frame) that flows into a full brand homepage below it (manifesto, story, craft, specs, gallery, CTA, nav, footer), all told as one continuous scroll-driven brand story, hosted locally with optional GitHub Pages deploy. Use this whenever the user asks for a scroll animation website, a product landing page "like Apple/AirPods/Nike", a scroll-driven product story or launch page, a 3D-feeling product showcase site, or gives a product idea with scroll beats (e.g. "beans fall, machine assembles, espresso pours"). Also use when they mention GSAP/ScrollTrigger product pages or say "make another one like the coffee/camera/sneaker site".
---

# Scroll-Site Generator

Turn a product brief into a cinematic scroll-driven website: an AI-generated
product film scrubbed by scroll position (the technique behind Apple's AirPods
pages), with huge typography, chapter captions and a premium dark aesthetic.

Proven reference builds live in `~/test saas/`: `coffee-scroll` (AURUM One),
`camera-scroll` (OBSCURA M) — both vanilla — and `nova-x1` (GSAP/Next.js).

## What the user gives you

A product (real or fictional) and optionally: scroll beats ("lens elements
float apart, sensor appears..."), a vibe ("matte black + brass"), a brand
name, and a tech-stack preference. Everything missing, you invent tastefully.
If no aesthetic is given, default to: near-black background (#050505-#0a0a0c),
one accent color that suits the product, huge tight-tracked display type,
generous negative space.

## Choose the architecture

- **Vanilla scroll-film** (default): one continuous AI-generated film sliced
  into ~400 WebP frames, scrubbed on a canvas. Best when the brief is a list
  of cinematic beats. Zero build step, deploys anywhere.
  → read `references/vanilla-film.md`
- **GSAP/Next.js hybrid**: pinned sections mixing frame-scrubbed canvases with
  pure GSAP animation (exploded layers, energy pulses, particles, morphs).
  Choose when the brief asks for GSAP/React/sections/labels/specs or reads
  like a marketing-page spec rather than a single film.
  → read `references/gsap-nextjs.md`

## Pipeline (both architectures)

1. **Storyboard.** Map the brief onto 5-8 chapters, each one visual idea.
   Decide per chapter: video clip, still + GSAP trick, or pure CSS/GSAP.
2. **Hero still first.** Generate 1-3 candidates with `scripts/hf.py`
   (default model: Soul). The hero anchors every video clip — iterate here,
   it's cheap. Show the user and let them pick if they're around; otherwise
   pick the most consistent/symmetric one and say so. Patch text artifacts
   with Pillow before any video spend (AI stills love fake logos —
   clone/gradient-fill them out; check zoomed crops).
3. **Chapter clips** via Kling v2.1 pro image-to-video, anchored for
   consistency (this is the anti-morphing system):
   - Every clip that shows the product starts from the hero or from another
     clip's extracted last frame (`ffmpeg -sseof -0.1 ... -frames:v 1`),
     uploaded via `hf.py upload`. Chain state changes (cup fills → milk in).
   - "Product assembles itself": generate a 10s *disassembly/explosion* from
     the hero (cfg_scale 0.7, explicit end-state in the prompt) and play it
     REVERSED — it then ends pixel-perfect on the hero.
   - Run clips as background tasks in parallel; QC each with an ffmpeg
     contact sheet (first/quarter/mid/three-quarter/last frames) before
     using it. Regenerate individual failures — never the whole set.
   - Prompt recipes and known failure modes: `references/prompts.md`.
4. **Build frames.** `scripts/build_master.py` xfade-concats the chapters,
   slices ~12fps 1400px WebP frames (~15-25 MB total) and prints per-chapter
   scroll fractions — use those to place captions. For standalone sequences
   (a 360° rotation for a GSAP section) use `scripts/extract.py`.
5. **Site.** Copy the engine from `assets/` (see the architecture reference),
   rebrand colors/copy, calibrate captions to the printed fractions.
6. **The full brand page.** The film is only the opening act — a run that
   ends at the film has built a fancy header, not a website. Continue the
   scroll below the film with a complete brand homepage (manifesto, origin
   story, craft chapters, stats, specs, quotes, gallery, closing CTA,
   sticky nav, real footer), told as one continuous brand story in the same
   design system. This normally costs zero extra generations — it reuses
   crops and rejects. → read `references/brand-page.md` and use
   `assets/brand-sections.html`.
7. **Verify in a real browser** — scrub to every chapter, check captions,
   console, mobile viewport, AND the below-film sections (nav appears after
   the film, reveals fire, footer present). See "Verification gotchas".
8. **Host.** Add a launch.json config (next free port: check existing ones in
   `~/test saas/.claude/launch.json`), serve with `python3 -m http.server`
   (vanilla) or `next dev` (hybrid), `open` it in the browser. Offer GitHub
   Pages deploy → `references/deploy.md`.

## API + costs

`scripts/hf.py` (image | upload | video) reads HF_KEY from env or the `.env`
sitting next to this SKILL.md — already configured with the user's
Higgsfield key. Platform facts that will save you an hour:
- Text-to-image: `higgsfield-ai/soul/standard` (the script's default).
  `reve/text-to-image` and `bytedance/seedream/v4` are both dead — model
  availability shifts, so if the default 404s, probe alternatives with one
  cheap submission before giving up.
- Upload: SDK flow via `higgsfield_client` pip package
  (`/files/generate-upload-url` presigned PUT). The old `/upload` is dead.
- Kling's output size FOLLOWS the input still's aspect (16:9 hero →
  1920×1080 on pro, 1280×720 on standard; 4:3 hero → 1656×1248). Keep every
  anchor still the same aspect so clips match — build_master normalizes
  mismatches, but matched inputs look better. Design the site for
  contain-fit + vignette/mask, never cover-crop.
- Each clip costs real credits (~1-2 min render). A typical site is 1-4
  stills + 5-8 clips including retries. Mention the spend before starting;
  get the hero approved before burning video credits when practical.
- **Credits can run out mid-build** (`not_enough_credits`, HTTP 403).
  Failed/rejected submissions don't charge. There's no balance endpoint.
  When pro-tier is rejected, `kling-video/v2.1/standard/image-to-video`
  may still succeed (cheaper). If a planned clip is unaffordable, salvage:
  reverse/slow/retrim clips you already have (`-vf reverse`, `setpts`),
  split one clip across two chapters with captions, or use still+GSAP
  chapters — then tell the user which chapters deserve a regenerate once
  credits are topped up.

## Failure modes (learned the hard way)

- **Kling duplicates complex multi-part objects** (sneakers became two
  shoes) instead of separating layers. If an explosion/exploded-view clip
  fails twice: generate the exploded state as a *still* (image models are excellent
  at these), slice it into contiguous horizontal strips with Pillow, and
  animate the strips apart with GSAP/CSS transforms. Looks better anyway.
- **Chapter cuts reset object state** (full cup → empty cup). Mask with the
  0.4s crossfades build_master adds, and land captions near cuts.
- Local ffmpeg has **no WebP encoder** — extract PNG, convert with Pillow
  (the bundled scripts already do this).
- Still images sit in visible rectangles on the page. Blend with a radial
  `mask-image` (`.img-blend` pattern) and fade strip edges horizontally.
- Caption with `data-in="0.00"` is invisible at exactly scroll 0 — give the
  opening title a negative data-in.

## Verification gotchas

The Launch preview panel's tab is `hidden`: rAF suspends, GSAP tickers stall,
and screenshots can desync from canvas compositing. For vanilla sites,
screenshot twice and trust element/pixel probes (`preview_eval` reading
canvas pixels). For Next/GSAP sites, verify in the user's real Chrome via the
claude-in-chrome tools — scroll with `javascript_tool`, screenshot, and
remember GitHub Pages caches HTML for ~10 min (cache-bust with `?fresh=1`).

## Finishing

Save/update a project memory file (ports, brand, quirks). Report: local URL,
what each chapter shows, credits used, rough edges worth a retake. Every
individual clip is independently regenerable — say so.
