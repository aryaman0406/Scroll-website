#!/usr/bin/env python3
"""
Crossfade-concat chapter clips into a master sequence, slice into WebP scrub
frames, and emit a manifest + chapter scroll fractions for captions.

Works natively with OpenCV + Pillow (or ffmpeg).

Usage:
  python build_master.py '<config-json>'
"""

import json
import os
import sys
import numpy as np
from PIL import Image

try:
    import cv2
except ImportError:
    cv2 = None


def read_clip_frames(src_path, target_fps=12, reverse=False, still_dur=3.0):
    """Reads frames from a video file or still image, resampled to target_fps."""
    ext = os.path.splitext(src_path)[1].lower()
    
    if ext in [".jpg", ".jpeg", ".png", ".webp"]:
        # It's a still image, repeat for still_dur seconds
        img = Image.open(src_path).convert("RGB")
        img_np = np.array(img)
        num_frames = int(target_fps * still_dur)
        frames = [img_np.copy() for _ in range(num_frames)]
        return frames

    if cv2 is None:
        raise RuntimeError("cv2 is required to read video files without ffmpeg.")

    cap = cv2.VideoCapture(src_path)
    if not cap.isOpened():
        raise RuntimeError(f"Cannot open video: {src_path}")

    src_fps = cap.get(cv2.CAP_PROP_FPS) or 24.0
    total_src_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    duration = total_src_frames / src_fps if src_fps > 0 else 0

    all_raw_frames = []
    while True:
        ret, frame = cap.read()
        if not ret:
            break
        # Convert BGR (cv2 default) to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        all_raw_frames.append(frame_rgb)
    cap.release()

    if not all_raw_frames:
        raise RuntimeError(f"No frames read from {src_path}")

    # Resample to target_fps
    num_target_frames = max(1, int(round(duration * target_fps)))
    indices = np.linspace(0, len(all_raw_frames) - 1, num_target_frames).astype(int)
    sampled_frames = [all_raw_frames[idx] for idx in indices]

    if reverse:
        sampled_frames = sampled_frames[::-1]

    return sampled_frames


def resize_and_pad(img_np, target_w, target_h):
    """Resizes and pads an RGB image to target_w x target_h keeping aspect ratio."""
    h, w = img_np.shape[:2]
    scale = min(target_w / w, target_h / h)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    pil_img = Image.fromarray(img_np)
    resized = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)
    resized_np = np.array(resized)

    # Pad on dark background (#050505 or #0a0908)
    canvas = np.full((target_h, target_w, 3), [10, 9, 8], dtype=np.uint8)
    y_off = (target_h - new_h) // 2
    x_off = (target_w - new_w) // 2
    canvas[y_off:y_off + new_h, x_off:x_off + new_w] = resized_np
    return canvas


def main():
    if len(sys.argv) < 2:
        print("Usage: python build_master.py '<config-json>'")
        sys.exit(1)

    cfg = json.loads(sys.argv[1])
    clips_dir = cfg.get("clips_dir", "")
    frames_dir = cfg["frames_dir"]
    fps = cfg.get("fps", 12)
    target_width = cfg.get("width", 1400)
    xfade_sec = cfg.get("xfade", 0.4)
    xfade_frames = int(round(xfade_sec * fps))

    chapters_config = cfg["chapters"]
    loaded_chapters = []

    print(f"--- Loading {len(chapters_config)} chapters ---")
    for i, ch in enumerate(chapters_config):
        ch_name = ch["name"]
        file_name = ch["file"]
        
        # Check in clips_dir or direct path or stills
        if os.path.isabs(file_name) and os.path.exists(file_name):
            src_path = file_name
        elif clips_dir and os.path.exists(os.path.join(clips_dir, file_name)):
            src_path = os.path.join(clips_dir, file_name)
        else:
            # Check relative to base
            src_path = file_name
            if not os.path.exists(src_path):
                sys.exit(f"Error: missing media file for chapter '{ch_name}': {file_name}")

        is_rev = ch.get("reverse", False)
        still_dur = ch.get("duration", 3.0)
        frames = read_clip_frames(src_path, target_fps=fps, reverse=is_rev, still_dur=still_dur)
        print(f"  [{i+1}/{len(chapters_config)}] {ch_name:<20} : {len(frames)} frames ({len(frames)/fps:.2f}s) from {os.path.basename(src_path)}")
        loaded_chapters.append({
            "name": ch_name,
            "frames": frames,
            "title": ch.get("title", ""),
            "caption": ch.get("caption", "")
        })

    # Determine standard resolution from first chapter or 16:9 ratio
    ref_h, ref_w = loaded_chapters[0]["frames"][0].shape[:2]
    aspect = ref_h / ref_w
    target_height = int(round(target_width * aspect))
    # Make height even
    if target_height % 2 != 0:
        target_height += 1

    print(f"\nNormalizing all frames to {target_width}x{target_height}...")
    for ch in loaded_chapters:
        ch["frames"] = [resize_and_pad(f, target_width, target_height) for f in ch["frames"]]

    # Assemble master sequence with crossfades
    print(f"Compositing with {xfade_sec}s ({xfade_frames} frames) crossfade...")
    final_frames = []
    meta = []

    current_frame_idx = 0
    for i, ch in enumerate(loaded_chapters):
        ch_frames = ch["frames"]
        ch_start_frame = current_frame_idx

        if i == 0:
            final_frames.extend(ch_frames)
            current_frame_idx += len(ch_frames)
        else:
            # Crossfade previous tail with current head
            actual_xfade = min(xfade_frames, len(final_frames), len(ch_frames))
            if actual_xfade > 0:
                ch_start_frame = len(final_frames) - actual_xfade
                for k in range(actual_xfade):
                    alpha = (k + 1) / (actual_xfade + 1)
                    prev_idx = len(final_frames) - actual_xfade + k
                    blend = (1.0 - alpha) * final_frames[prev_idx].astype(np.float32) + alpha * ch_frames[k].astype(np.float32)
                    final_frames[prev_idx] = np.clip(blend, 0, 255).astype(np.uint8)
                
                # Append remainder of chapter frames
                final_frames.extend(ch_frames[actual_xfade:])
                current_frame_idx = len(final_frames)
            else:
                final_frames.extend(ch_frames)
                current_frame_idx += len(ch_frames)

        meta.append({
            "name": ch["name"],
            "start_frame": ch_start_frame,
            "duration_frames": len(ch_frames),
            "title": ch["title"],
            "caption": ch["caption"]
        })

    total_frames = len(final_frames)
    total_duration = total_frames / fps

    print(f"\nTotal sequence: {total_duration:.2f}s ({total_frames} frames)")

    # Save frames to frames_dir
    os.makedirs(frames_dir, exist_ok=True)
    # Clean old frames
    for f in os.listdir(frames_dir):
        if f.endswith((".webp", ".png", ".jpg")):
            os.remove(os.path.join(frames_dir, f))

    print(f"Writing {total_frames} WebP frames to {frames_dir}...")
    for idx, f_np in enumerate(final_frames):
        out_path = os.path.join(frames_dir, f"frame_{idx+1:04d}.webp")
        img = Image.fromarray(f_np)
        img.save(out_path, "WEBP", quality=82, method=4)

    manifest = {
        "count": total_frames,
        "pattern": "frames/frame_%04d.webp",
        "fps": fps,
        "duration": total_duration,
        "chapters": []
    }

    print("\n" + "="*70)
    print("CHAPTER SCROLL FRACTIONS (use to calibrate data-in / data-hold / data-out):")
    print("="*70)
    for m in meta:
        frac_start = m["start_frame"] / max(1, total_frames - 1)
        frac_dur = m["duration_frames"] / max(1, total_frames - 1)
        frac_end = min(1.0, frac_start + frac_dur)
        frac_peak = frac_start + frac_dur * 0.65  # peak hold at 65% of chapter
        m["start_fraction"] = round(frac_start, 3)
        m["end_fraction"] = round(frac_end, 3)
        manifest["chapters"].append(m)
        print(f"  Chapter: {m['name']:<20} | Frame: {m['start_frame']:>4} ({frac_start:0.3f}) -> Peak ~{frac_peak:0.3f} -> End ({frac_end:0.3f})")

    with open(os.path.join(frames_dir, "frames.json"), "w") as f:
        json.dump(manifest, f, indent=2)

    total_size_mb = sum(os.path.getsize(os.path.join(frames_dir, f))
                        for f in os.listdir(frames_dir) if f.endswith(".webp")) / 1e6
    print("="*70)
    print(f"Complete! Master frames generated: {total_frames} frames, Total size: {total_size_mb:.2f} MB")
    print("="*70)


if __name__ == "__main__":
    main()
