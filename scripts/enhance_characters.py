#!/usr/bin/env python3
"""
Character sprite enhancement: three-tone painted shading and texture depth.
DON-117: Upgrades flat vector character sprites to hand-painted quality.

Applies per-frame:
- Three-tone directional shading (highlight → base → shadow)
- Painted texture grain overlay
- Rim lighting on light-facing edges
- Hand-drawn outline thickness variation
- Eye specular highlights
- Character-specific depth effects (cheese holes, fur texture)
"""

import json
import math
import os
import random
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

# Deterministic seed for reproducible output
random.seed(42)
np.random.seed(42)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.dirname(SCRIPT_DIR)
SPRITES_DIR = os.path.join(PROJECT_DIR, "public", "assets", "sprites")

ATLAS_PATH = os.path.join(SPRITES_DIR, "characters.png")
JSON_PATH = os.path.join(SPRITES_DIR, "characters.json")
OUTPUT_PATH = os.path.join(SPRITES_DIR, "characters.png")

# Light direction: top-left at 45 degrees (art bible section 5)
LIGHT_DIR = np.array([-0.707, -0.707])  # normalized (top-left)

# ─── Color definitions ───

# Cheddar palette
CHEDDAR = {
    "highlight": np.array([0xFF, 0xD7, 0x6E]),
    "base": np.array([0xF5, 0xA6, 0x23]),
    "shadow": np.array([0xC4, 0x7B, 0x12]),
    "rind": np.array([0x8B, 0x5A, 0x0B]),
    "cream": np.array([0xFF, 0xF4, 0xD6]),
    "outline": np.array([0x3B, 0x25, 0x10]),
    "pupil": np.array([0x3B, 0x25, 0x10]),
    "rim": np.array([0xFF, 0xE8, 0xA0]),
}

# Rat palette
RAT = {
    "highlight": np.array([0x98, 0x98, 0xA8]),
    "base": np.array([0x6B, 0x6B, 0x7B]),
    "shadow": np.array([0x42, 0x42, 0x4E]),
    "belly": np.array([0x88, 0x88, 0xA0]),
    "ear_pink": np.array([0xA8, 0x55, 0x55]),
    "eye_red": np.array([0xE5, 0x22, 0x22]),
    "eye_glow": np.array([0xFF, 0x44, 0x44]),
    "eye_highlight": np.array([0xFF, 0x66, 0x66]),
    "midnight": np.array([0x2E, 0x2E, 0x3A]),
    "outline": np.array([0x2E, 0x2E, 0x3A]),
    "teeth": np.array([0xFF, 0xF4, 0xD6]),
    "rim": np.array([0xB0, 0xB0, 0xC8]),
}


def color_distance(c1, c2):
    """Euclidean distance between two RGB colors."""
    return np.sqrt(np.sum((c1.astype(float) - c2.astype(float)) ** 2))


def is_near_color(pixel_rgb, target, threshold=55):
    """Check if pixel is close to a target color."""
    return color_distance(pixel_rgb, target) < threshold


def lerp_color(c1, c2, t):
    """Linear interpolate between two colors."""
    t = max(0.0, min(1.0, t))
    return (c1.astype(float) * (1 - t) + c2.astype(float) * t).astype(np.uint8)


def classify_cheddar_pixel(rgb):
    """Classify a cheddar pixel into a zone."""
    if is_near_color(rgb, CHEDDAR["outline"], 40):
        return "outline"
    if is_near_color(rgb, CHEDDAR["cream"], 40):
        return "cream"
    if is_near_color(rgb, CHEDDAR["rind"], 45):
        return "rind"
    if is_near_color(rgb, CHEDDAR["shadow"], 50):
        return "shadow"
    if is_near_color(rgb, CHEDDAR["highlight"], 50):
        return "highlight"
    if is_near_color(rgb, CHEDDAR["base"], 60):
        return "body"
    # Check warm orange range broadly
    if rgb[0] > 150 and rgb[1] > 80 and rgb[2] < 150:
        return "body"
    return "other"


def classify_rat_pixel(rgb):
    """Classify a rat pixel into a zone."""
    if is_near_color(rgb, RAT["outline"], 35):
        return "outline"
    if is_near_color(rgb, RAT["eye_red"], 50):
        return "eye"
    if is_near_color(rgb, RAT["ear_pink"], 55):
        return "ear"
    if is_near_color(rgb, RAT["teeth"], 40):
        return "teeth"
    if is_near_color(rgb, RAT["midnight"], 35):
        return "dark"
    if is_near_color(rgb, RAT["shadow"], 45):
        return "shadow"
    if is_near_color(rgb, RAT["highlight"], 50):
        return "highlight"
    if is_near_color(rgb, RAT["belly"], 45):
        return "belly"
    if is_near_color(rgb, RAT["base"], 55):
        return "body"
    # Broad gray range
    if abs(int(rgb[0]) - int(rgb[1])) < 25 and abs(int(rgb[1]) - int(rgb[2])) < 25:
        if 50 < rgb[0] < 180:
            return "body"
    return "other"


def compute_light_factor(x, y, w, h):
    """
    Compute a directional light factor for position (x,y) in frame (w,h).
    Light comes from top-left. Returns 0.0 (full shadow) to 1.0 (full highlight).
    """
    # Normalize position to [-1, 1]
    nx = (x / w) * 2.0 - 1.0
    ny = (y / h) * 2.0 - 1.0
    # Dot product with inverted light direction gives light intensity
    # More negative x,y = more toward top-left = more light
    dot = -(nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1])
    # Map from [-1,1] to [0,1] with bias toward mid
    factor = (dot + 1.0) * 0.5
    # Apply a gentle S-curve for more natural falloff
    factor = factor ** 0.8
    return max(0.0, min(1.0, factor))


def generate_texture_noise(w, h, scale=0.08):
    """Generate subtle texture grain noise."""
    noise = np.random.normal(0, scale, (h, w, 3))
    return noise


def find_edge_pixels(alpha, threshold=128):
    """Find pixels that are on the edge of the sprite (next to transparency)."""
    h, w = alpha.shape
    edges = np.zeros((h, w), dtype=bool)
    # A pixel is an edge if it's opaque but has a transparent neighbor
    opaque = alpha >= threshold
    for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1), (-1, -1), (-1, 1), (1, -1), (1, 1)]:
        shifted = np.roll(np.roll(opaque, dy, axis=0), dx, axis=1)
        # Mark boundary pixels
        if dy == -1:
            shifted[0, :] = False
        elif dy == 1:
            shifted[-1, :] = False
        if dx == -1:
            shifted[:, 0] = False
        elif dx == 1:
            shifted[:, -1] = False
        edges |= (opaque & ~shifted)
    return edges


def find_outline_pixels(rgba_arr, is_cheddar=True):
    """Find pixels that are outline colored."""
    rgb = rgba_arr[:, :, :3]
    alpha = rgba_arr[:, :, 3]
    h, w = alpha.shape
    outline = np.zeros((h, w), dtype=bool)

    outline_color = CHEDDAR["outline"] if is_cheddar else RAT["outline"]
    threshold = 40

    for y in range(h):
        for x in range(w):
            if alpha[y, x] >= 128:
                if color_distance(rgb[y, x], outline_color) < threshold:
                    outline[y, x] = True
    return outline


def compute_rim_mask(alpha, light_facing=True):
    """
    Compute rim light mask: edge pixels on the light-facing side.
    Returns float mask 0-1.
    """
    h, w = alpha.shape
    edges = find_edge_pixels(alpha)
    rim = np.zeros((h, w), dtype=float)

    for y in range(h):
        for x in range(w):
            if edges[y, x]:
                # Position relative to center
                nx = (x / w) * 2.0 - 1.0
                ny = (y / h) * 2.0 - 1.0
                # How much this edge faces the light
                dot = -(nx * LIGHT_DIR[0] + ny * LIGHT_DIR[1])
                if dot > 0:
                    rim[y, x] = min(1.0, dot * 1.5)
    return rim


def apply_outline_variation(img_arr, outline_mask, alpha):
    """
    Vary outline thickness to create hand-drawn feel.
    Thicken outlines on the shadow side, thin on the light side.
    """
    h, w = alpha.shape
    result = img_arr.copy()

    for y in range(1, h - 1):
        for x in range(1, w - 1):
            if not outline_mask[y, x]:
                continue
            # Light factor for this position
            lf = compute_light_factor(x, y, w, h)
            # On light side (lf > 0.6), chance to thin outline (make semi-transparent)
            if lf > 0.65:
                # Slightly reduce alpha for thinner appearance
                result[y, x, 3] = int(result[y, x, 3] * 0.75)
            # On shadow side (lf < 0.35), thicken by darkening adjacent body pixels
            elif lf < 0.3:
                for dy, dx in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                    ny, nx_ = y + dy, x + dx
                    if 0 <= ny < h and 0 <= nx_ < w:
                        if alpha[ny, nx_] >= 128 and not outline_mask[ny, nx_]:
                            # Darken adjacent body pixel slightly toward outline color
                            orig = result[ny, nx_, :3].astype(float)
                            outline_c = result[y, x, :3].astype(float)
                            blend = (orig * 0.8 + outline_c * 0.2).astype(np.uint8)
                            result[ny, nx_, :3] = blend

    return result


def enhance_cheddar_frame(frame_img):
    """Apply full enhancement pipeline to a Cheddar frame."""
    arr = np.array(frame_img)
    h, w = arr.shape[:2]

    if arr.shape[2] < 4:
        # Add alpha channel if missing
        alpha_ch = np.full((h, w, 1), 255, dtype=np.uint8)
        arr = np.concatenate([arr, alpha_ch], axis=2)

    result = arr.copy()
    alpha = arr[:, :, 3]
    texture_noise = generate_texture_noise(w, h, scale=0.06)
    rim_mask = compute_rim_mask(alpha)
    outline_mask = find_outline_pixels(arr, is_cheddar=True)

    for y in range(h):
        for x in range(w):
            if alpha[y, x] < 128:
                continue

            rgb = arr[y, x, :3].copy()
            zone = classify_cheddar_pixel(rgb)
            lf = compute_light_factor(x, y, w, h)

            if zone == "body" or zone == "highlight" or zone == "shadow":
                # Three-tone shading based on light direction
                if lf > 0.6:
                    # Highlight zone
                    t = (lf - 0.6) / 0.4
                    new_color = lerp_color(CHEDDAR["base"], CHEDDAR["highlight"], t * 0.7)
                elif lf < 0.35:
                    # Shadow zone
                    t = (0.35 - lf) / 0.35
                    new_color = lerp_color(CHEDDAR["base"], CHEDDAR["shadow"], t * 0.75)
                else:
                    new_color = CHEDDAR["base"].copy()

                # Blend with original to preserve existing detail
                new_color = lerp_color(rgb, new_color, 0.55)

                # Add texture grain
                noise = texture_noise[y, x]
                new_color = np.clip(new_color.astype(float) + noise * 255 * 0.3, 0, 255).astype(np.uint8)

                result[y, x, :3] = new_color

            elif zone == "rind":
                # Deepen rind with shadow variation
                t = 1.0 - lf
                new_color = lerp_color(CHEDDAR["rind"], CHEDDAR["shadow"], t * 0.4)
                new_color = lerp_color(rgb, new_color, 0.5)
                noise = texture_noise[y, x]
                new_color = np.clip(new_color.astype(float) + noise * 255 * 0.2, 0, 255).astype(np.uint8)
                result[y, x, :3] = new_color

            elif zone == "cream":
                # Eye whites / specular - add subtle warm tint on shadow side
                if lf < 0.4:
                    new_color = lerp_color(rgb, CHEDDAR["highlight"], 0.15)
                    result[y, x, :3] = new_color
                # Add specular dot check (small white dot in eyes)

            elif zone == "outline":
                # Will be handled by outline variation pass
                pass

            # Apply rim light
            if rim_mask[y, x] > 0.1 and zone != "outline":
                rim_strength = rim_mask[y, x] * 0.4
                result[y, x, :3] = lerp_color(
                    result[y, x, :3], CHEDDAR["rim"], rim_strength
                )

    # Apply outline variation
    result = apply_outline_variation(result, outline_mask, alpha)

    # Add eye specular highlights
    result = add_cheddar_eye_specular(result, arr)

    return Image.fromarray(result)


def add_cheddar_eye_specular(result, original):
    """Add small white specular dot to Cheddar's eyes."""
    h, w = result.shape[:2]
    alpha = original[:, :, 3]

    # Find eye-white (cream colored) clusters
    cream_pixels = []
    for y in range(h):
        for x in range(w):
            if alpha[y, x] >= 128:
                rgb = original[y, x, :3]
                if is_near_color(rgb, CHEDDAR["cream"], 40):
                    cream_pixels.append((x, y))

    if len(cream_pixels) < 4:
        return result

    # Find clusters of cream pixels (eyes)
    clusters = cluster_pixels(cream_pixels, max_dist=8)

    for cluster in clusters:
        if len(cluster) < 3:
            continue
        # Find top-right pixel in cluster (specular position)
        xs = [p[0] for p in cluster]
        ys = [p[1] for p in cluster]
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        # Specular dot at top-left of eye (light source direction)
        spec_x = int(cx - 1)
        spec_y = int(cy - 1)
        if 0 <= spec_x < w and 0 <= spec_y < h and alpha[spec_y, spec_x] >= 128:
            # Place a 2px specular highlight
            for dy in range(2):
                for dx in range(2):
                    py, px = spec_y + dy, spec_x + dx
                    if 0 <= py < h and 0 <= px < w and alpha[py, px] >= 128:
                        result[py, px, :3] = np.array([255, 255, 255], dtype=np.uint8)
                        result[py, px, 3] = 220

    return result


def enhance_rat_frame(frame_img):
    """Apply full enhancement pipeline to a Rat frame."""
    arr = np.array(frame_img)
    h, w = arr.shape[:2]

    if arr.shape[2] < 4:
        alpha_ch = np.full((h, w, 1), 255, dtype=np.uint8)
        arr = np.concatenate([arr, alpha_ch], axis=2)

    result = arr.copy()
    alpha = arr[:, :, 3]
    texture_noise = generate_texture_noise(w, h, scale=0.05)
    rim_mask = compute_rim_mask(alpha)
    outline_mask = find_outline_pixels(arr, is_cheddar=False)

    for y in range(h):
        for x in range(w):
            if alpha[y, x] < 128:
                continue

            rgb = arr[y, x, :3].copy()
            zone = classify_rat_pixel(rgb)
            lf = compute_light_factor(x, y, w, h)

            if zone in ("body", "highlight", "shadow", "belly"):
                # Three-tone shading
                if lf > 0.6:
                    t = (lf - 0.6) / 0.4
                    target = RAT["highlight"]
                    # Shinier highlight on top of head (upper 1/3)
                    if y < h * 0.35:
                        t = min(1.0, t * 1.3)
                    new_color = lerp_color(RAT["base"], target, t * 0.7)
                elif lf < 0.35:
                    t = (0.35 - lf) / 0.35
                    new_color = lerp_color(RAT["base"], RAT["shadow"], t * 0.75)
                else:
                    new_color = RAT["base"].copy()

                # Belly patch: slightly lighter
                if zone == "belly":
                    new_color = lerp_color(new_color, RAT["belly"], 0.3)

                # Blend with original
                new_color = lerp_color(rgb, new_color, 0.55)

                # Fur texture: directional noise (more horizontal)
                nx = texture_noise[y, x]
                # Bias noise horizontally for fur stroke suggestion
                fur_factor = 0.25
                fur_noise = nx[0] * fur_factor
                new_color = np.clip(
                    new_color.astype(float) + fur_noise * 255, 0, 255
                ).astype(np.uint8)

                result[y, x, :3] = new_color

            elif zone == "eye":
                # Enhance menacing glow
                # Bright center, darker edges
                eye_pixels = find_nearby_zone_pixels(arr, x, y, "eye", classify_rat_pixel, radius=4)
                if eye_pixels:
                    ecx = sum(p[0] for p in eye_pixels) / len(eye_pixels)
                    ecy = sum(p[1] for p in eye_pixels) / len(eye_pixels)
                    dist = math.sqrt((x - ecx) ** 2 + (y - ecy) ** 2)
                    max_r = max(1, max(abs(p[0] - ecx) for p in eye_pixels))
                    t = min(1.0, dist / max_r)
                    # Core is bright red-orange, edge is deep red
                    glow_center = np.array([0xFF, 0x44, 0x22], dtype=np.uint8)
                    glow_edge = np.array([0xCC, 0x11, 0x11], dtype=np.uint8)
                    new_color = lerp_color(glow_center, glow_edge, t)
                    result[y, x, :3] = lerp_color(rgb, new_color, 0.6)
                else:
                    result[y, x, :3] = lerp_color(rgb, RAT["eye_glow"], 0.3)

            elif zone == "ear":
                # Add inner shadow depth to ears
                inner_shadow = lerp_color(RAT["ear_pink"], RAT["shadow"], (1.0 - lf) * 0.45)
                result[y, x, :3] = lerp_color(rgb, inner_shadow, 0.5)

            elif zone == "dark":
                # Nose/dark features - subtle depth
                new_color = lerp_color(rgb, RAT["shadow"], (1.0 - lf) * 0.3)
                result[y, x, :3] = new_color

            # Apply rim light (cooler for rats)
            if rim_mask[y, x] > 0.1 and zone != "outline":
                rim_strength = rim_mask[y, x] * 0.35
                result[y, x, :3] = lerp_color(
                    result[y, x, :3], RAT["rim"], rim_strength
                )

    # Apply outline variation
    result = apply_outline_variation(result, outline_mask, alpha)

    # Add eye specular for rats
    result = add_rat_eye_specular(result, arr)

    return Image.fromarray(result)


def add_rat_eye_specular(result, original):
    """Add sharp specular highlight to rat eyes."""
    h, w = result.shape[:2]
    alpha = original[:, :, 3]

    eye_pixels = []
    for y in range(h):
        for x in range(w):
            if alpha[y, x] >= 128:
                rgb = original[y, x, :3]
                if is_near_color(rgb, RAT["eye_red"], 50):
                    eye_pixels.append((x, y))

    if len(eye_pixels) < 2:
        return result

    clusters = cluster_pixels(eye_pixels, max_dist=6)

    for cluster in clusters:
        if len(cluster) < 2:
            continue
        xs = [p[0] for p in cluster]
        ys = [p[1] for p in cluster]
        cx = sum(xs) / len(xs)
        cy = sum(ys) / len(ys)
        # Top-right specular (per art bible: single sharp dot)
        spec_x = int(cx + 1)
        spec_y = int(cy - 1)
        if 0 <= spec_x < w and 0 <= spec_y < h and alpha[spec_y, spec_x] >= 128:
            result[spec_y, spec_x, :3] = np.array([0xFF, 0x66, 0x66], dtype=np.uint8)
            # One more pixel for visibility
            if spec_y + 1 < h:
                result[spec_y + 1, spec_x, :3] = np.array([0xFF, 0x88, 0x88], dtype=np.uint8)

    return result


def find_nearby_zone_pixels(arr, cx, cy, target_zone, classifier, radius=4):
    """Find all pixels of a given zone within radius."""
    h, w = arr.shape[:2]
    results = []
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            ny, nx = cy + dy, cx + dx
            if 0 <= ny < h and 0 <= nx < w and arr[ny, nx, 3] >= 128:
                if classifier(arr[ny, nx, :3]) == target_zone:
                    results.append((nx, ny))
    return results


def cluster_pixels(pixels, max_dist=8):
    """Simple clustering of pixel positions."""
    if not pixels:
        return []
    clusters = []
    used = set()

    for i, p in enumerate(pixels):
        if i in used:
            continue
        cluster = [p]
        used.add(i)
        queue = [p]
        while queue:
            curr = queue.pop(0)
            for j, other in enumerate(pixels):
                if j in used:
                    continue
                dist = math.sqrt((curr[0] - other[0]) ** 2 + (curr[1] - other[1]) ** 2)
                if dist <= max_dist:
                    cluster.append(other)
                    used.add(j)
                    queue.append(other)
        clusters.append(cluster)

    return clusters


def apply_gentle_blur_blend(original, enhanced, alpha, strength=0.2):
    """
    Blend a slightly blurred version back to soften hard transitions.
    Simulates the soft-shadow, painted feel from the art bible.
    """
    blurred = enhanced.filter(ImageFilter.GaussianBlur(radius=0.8))
    blurred_arr = np.array(blurred)
    enhanced_arr = np.array(enhanced)
    alpha_arr = np.array(alpha) if isinstance(alpha, Image.Image) else alpha

    # Only blend where opaque
    mask = (alpha_arr >= 128).astype(float)
    if len(mask.shape) == 2:
        mask = mask[:, :, np.newaxis]

    result = (enhanced_arr.astype(float) * (1 - strength) +
              blurred_arr.astype(float) * strength)
    result = np.clip(result, 0, 255).astype(np.uint8)

    # Preserve transparency
    orig_arr = np.array(original)
    result[:, :, 3] = orig_arr[:, :, 3]

    return Image.fromarray(result)


def process_atlas():
    """Main pipeline: load atlas, enhance each frame, reassemble."""
    print("Loading atlas and frame data...")
    atlas = Image.open(ATLAS_PATH).convert("RGBA")
    with open(JSON_PATH) as f:
        atlas_data = json.load(f)

    frames = atlas_data["frames"]
    meta = atlas_data["meta"]
    atlas_w, atlas_h = meta["size"]["w"], meta["size"]["h"]

    print(f"Atlas: {atlas_w}x{atlas_h}, {len(frames)} frames")

    # Create output atlas
    output = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))

    # Copy the entire original first (preserves any non-frame pixels)
    output.paste(atlas, (0, 0))

    cheddar_count = 0
    rat_count = 0

    for name, info in frames.items():
        f = info["frame"]
        x, y, w, h = f["x"], f["y"], f["w"], f["h"]

        # Extract frame
        frame_img = atlas.crop((x, y, x + w, y + h))

        is_cheddar = name.startswith("cheddar_")
        label = "Cheddar" if is_cheddar else "Rat"
        print(f"  Enhancing {label}: {name} ({w}x{h} at {x},{y})")

        if is_cheddar:
            enhanced = enhance_cheddar_frame(frame_img)
            cheddar_count += 1
        else:
            enhanced = enhance_rat_frame(frame_img)
            rat_count += 1

        # Apply gentle blur blend for painted softness
        enhanced = apply_gentle_blur_blend(frame_img, enhanced, np.array(frame_img)[:, :, 3])

        # Paste back at exact same position
        output.paste(enhanced, (x, y))

    # Save
    print(f"\nSaving enhanced atlas to {OUTPUT_PATH}")
    print(f"  Enhanced: {cheddar_count} Cheddar frames, {rat_count} Rat frames")
    output.save(OUTPUT_PATH, "PNG", optimize=True)

    # Verify output
    verify = Image.open(OUTPUT_PATH)
    print(f"  Output size: {verify.size[0]}x{verify.size[1]}")
    file_size = os.path.getsize(OUTPUT_PATH)
    print(f"  File size: {file_size / 1024:.1f} KB")
    print("Done!")


if __name__ == "__main__":
    process_atlas()
