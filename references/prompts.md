# Higgsfield prompt recipes (proven on shipped sites)

## Commands

```bash
python3 tools/hf.py image '{"name":"hero","prompt":"...","out":"/abs/hero.png"}'   # default model: higgsfield-ai/soul/standard
python3 tools/hf.py upload /abs/patched-hero.png          # → CDN URL for i2v
python3 tools/hf.py video '{"name":"ch1","image_url":"<CDN url>","prompt":"...","negative_prompt":"...","duration":5,"out":"/abs/clips/ch1.mp4"}'
```

Video renders take 1-6 min — run as background Bash tasks, several in
parallel. `duration` is 5 or 10; `cfg_scale` 0.5 default, 0.7 when the
prompt must dominate (explosions).

## Hero still (the anchor — everything inherits from it)

Include, always: product description with materials/accents · composition
("centered, generous empty space around it") · backdrop ("deep black /
dark charcoal studio background") · lighting ("dramatic <accent> rim
light, soft key light") · "photorealistic 8k commercial product
photography". Bake in props future chapters need (a glass, a visible
pipe, room above for falling objects). Front-on symmetric compositions
survive video generation best; three-quarter has more character but
drifts more.

Image models invent fake logos/text — inspect zoomed crops and patch with
Pillow before uploading (clone a clean band from the same surface with a
feathered mask, keeping the artifact fully inside the solid mask zone;
match per-row brightness).

## Clip prompt skeleton

```
<one specific action, slow motion> + <what stays unchanged: "the machine
stays perfectly still and unchanged, dark studio background unchanged,
studio lighting unchanged"> + "locked static camera, no camera movement"
```
negative_prompt baseline:
```
camera movement, camera zoom, camera pan, <subject> morphing, duplicate
<subject>s, extra objects appearing, hands, people, text, watermark,
logo, blur, flicker, background change
```

## Recipes that worked

- **Assembly (reverse trick)** — 10s, cfg 0.7, from hero: "Product
  explosion animation: the X completely disassembles, every component
  detaches and flies slowly apart, <list its parts>, by the final frame
  the X is fully taken apart into dozens of individual floating parts
  with large gaps of empty space between them, exploded view product
  animation, slow motion..." Then reverse in post. The explicit final
  frame sentence is what makes Kling commit; without it the explosion is
  timid and drifts back together.
- **360 rotation** — 10s: "rotates slowly and smoothly a full 360 degrees
  around its vertical axis while floating in dark space, <accent> rim
  light sweeps across as it turns, constant smooth turntable rotation,
  stays centered and level". Kling may add a glowing floor ring — usually
  looks great, keep it.
- **Liquid pour / fill** — from a frame where the vessel is empty: "a slow
  steady stream of X pours into the empty glass, gradually fills with
  <texture detail>, faint wisps of steam". Chain the *last frame* into the
  next state-dependent chapter.
- **Steam / atmosphere** — "dense white steam gently rises from X, curling
  and drifting upward in slow motion, warm rim lighting catches the wisps".
- **Power-up / fire** — "the <accent> ring ignites/glows, a brief elegant
  burst of white light" — good for shutters, buttons, activations.
- **Final hero** — chain from the last state frame: "studio lighting slowly
  blooms warmer and richer, details glint, very slow smooth subtle camera
  push-in" (the one clip where gentle camera motion is allowed).
- **Macro/keyframe stills for non-product chapters** (falling beans,
  sensors, exploded stacks, wireframes): text-to-image them directly in
  the same lighting language; they don't need product consistency.

## Known failures

- Complex multi-part products (shoes) DUPLICATE instead of separating —
  after two failed attempts switch to the sliced-still + GSAP strips
  technique (see gsap-nextjs.md), which is fully controllable.
- Liquid state resets across chapter cuts — chain last-frames, order
  chapters to minimize resets, and let the 0.4s xfades + captions mask
  the rest.
- Output size follows the INPUT still's aspect (16:9 in → 1080p out on pro, 720p on standard). Keep all anchor stills one aspect.

## QC every clip before using it

```bash
n=$(ffprobe -v error -select_streams v -count_frames -show_entries stream=nb_read_frames -of csv=p=0 clip.mp4)
ffmpeg -y -v error -i clip.mp4 -vf "select='eq(n\,0)+eq(n\,$((n/4)))+eq(n\,$((n/2)))+eq(n\,$((3*n/4)))+eq(n\,$((n-1)))',scale=460:-1,tile=5x1" -frames:v 1 sheet.png
```
Look for: morphing, duplicates, background/lighting shifts, camera drift.
Regenerate only the failed clip (tweak prompt/cfg), never the whole set.
