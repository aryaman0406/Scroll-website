# GSAP / Next.js hybrid architecture

Full working reference: `~/test saas/nova-x1` (NOVA X1). Pinned scrub
sections, each its own client component with a GSAP timeline.

## Scaffold

```bash
npx -y create-next-app@15 <name> --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --yes
cd <name> && npm i gsap lenis
```

Keep the AI pipeline in a sibling `<name>-assets/` folder (tools + .env +
clips/stills) so the repo never contains the key or heavy sources.

Copy from the skill's `assets/`: `SmoothScroll.tsx` (Lenis on gsap.ticker —
wrap `<main>` with it) and `useFrameSequence.ts` (blob cache + sliding
decode window; `draw(canvas, progress)`). The bundled `useFrameSequence`
already decodes frames with a `createImageBitmap` → `<img>` fallback:
createImageBitmap throws "source image could not be decoded" in hidden/
backgrounded tabs and some webviews, which silently leaves the hero canvas
blank on the deployed site even though frames load fine. Do NOT strip the
fallback. If you write your own scrubber, keep it — `ctx.drawImage` accepts
both an ImageBitmap and an HTMLImageElement.

## Section pattern

Every section: `<section ref={root} className="relative h-[300vh]">` with a
`sticky top-0 h-screen overflow-hidden` inner stage. One timeline per
section inside `gsap.context(() => {...}, root)`, cleaned up with
`ctx.revert()`:

```ts
gsap.timeline({ scrollTrigger: {
  trigger: root.current, start: "top top", end: "bottom bottom", scrub: 0.6,
}})
```

Frame-scrub sections tween `{p: startFraction → endFraction}` with
`onUpdate: () => draw(canvasRef.current, frame.p)`. Two sections can share
one sequence (rotation: 0→0.55 in section 2, 0.55→1 in the showcase).

## Proven section recipes (steal from nova-x1/src/components/sections)

- **Hero** — split-char title reveal (manual char spans, stagger), idle
  floating product (yoyo y/rotate), particles, scroll-out parallax.
- **Rotation** — canvas scrub of a 360° Kling sequence + char-staggered
  claim.
- **Exploded view** — NO video (Kling duplicates complex objects): slice an
  exploded *still* into contiguous horizontal strips (Pillow crop bands at
  the dark gaps), position strips at their natural `top:%`, start them
  tucked behind the product band (`y = -(top - anchorBottom)/imgH * stageH`)
  and stagger them down to `y:0`. Labels + scaleX ticks after they settle.
- **Technology spotlight** — dimmed full still (`brightness-[0.55]`),
  roaming radial-gradient spotlight (mix-blend screen), connector paths
  drawn via strokeDashoffset, copy blocks stepping in/out.
- **Material morph** — image stages revealed by
  `clipPath: circle(0% → 75%)` wipes, not crossfades.
- **Energy/pulse** — SVG path along the product with
  `strokeDasharray "180 580"` + dashoffset tween; squash `scaleY` with
  transformOrigin at the contact edge, rebound with `back.out(2.5)`.
- **Performance/motion** — perspective grid floor (rotateX 72deg repeating
  gradients), speed lines (xPercent stream), ghost trail (blurred copies at
  staggered offsets), particle exhaust.
- **Specs showcase** — canvas scrub + spec callouts entering with
  `filter: blur(6px) → 0`.

## After the film: the brand page

The pinned film sections are the opening act. Follow them with normal
(non-pinned) brand sections — manifesto, origin, craft splits, stats,
specs, quotes, gallery, CTA band, sticky nav, real footer — as light
server-renderable components revealed with simple ScrollTriggers
(`start: "top 75%"`), not scrub timelines. Structure and copy rules:
`references/brand-page.md`.

## Polish rules

- Every product still gets `.img-blend` (radial mask) so its rectangle
  melts into the page; strips get a horizontal fade mask. Both classes are
  in nova-x1's globals.css.
- Assets go in `public/img` + `public/frames/<seq>/` (use
  `scripts/extract.py`), referenced with RELATIVE paths ("img/hero.webp",
  fetch("frames/rotate/manifest.json")) — required for subpath deploys.
- Film grain overlay + glow blobs + one accent color = the premium look.
- Verify in real Chrome (claude-in-chrome), not the preview panel: the
  hidden preview tab stalls GSAP and desyncs canvas screenshots.
