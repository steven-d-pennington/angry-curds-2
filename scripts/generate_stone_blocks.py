#!/usr/bin/env python3
"""
Generate stone block sprites and stone VFX sprites for Angry Curds 2.

Creates:
  - 8 stone block frames (4 sizes × intact/cracked) → props.png atlas
  - 5 stone VFX frames (3 chips + 2 dust) → vfx.png atlas

Art style: Three-tone hand-painted limestone matching art bible palette:
  Highlight: #A89880 (warm limestone, lit face)
  Base:      #7A6B58 (cellar stone, mid-tone)
  Shadow:    #4A3D30 (deep stone, shadow)
  Moss:      #5A8C47 (cellar moss, sparse patches)
  Outline:   #3B2510 (warm brown)

Light direction: top-left 45° (consistent with character sprites).
"""

import json
import math
import random
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "public" / "assets" / "sprites"

# Art bible stone palette
HIGHLIGHT = (0xA8, 0x98, 0x80, 255)  # Warm limestone (lit)
BASE      = (0x7A, 0x6B, 0x58, 255)  # Cellar stone (mid)
SHADOW    = (0x4A, 0x3D, 0x30, 255)  # Deep stone (shadow)
MOSS      = (0x5A, 0x8C, 0x47, 180)  # Cellar moss (semi-transparent)
OUTLINE   = (0x3B, 0x25, 0x10, 255)  # Warm brown outline

# Cracked overlay colors
CRACK_DARK  = (0x2A, 0x1E, 0x14, 220)
CRACK_INNER = (0x3A, 0x2D, 0x20, 160)

random.seed(42)  # Reproducible output


# ── Utility ────────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGBA colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def add_noise(img, intensity=12):
    """Add subtle grain noise for painted texture feel."""
    pixels = img.load()
    w, h = img.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 10:
                continue
            n = random.randint(-intensity, intensity)
            pixels[x, y] = (
                max(0, min(255, r + n)),
                max(0, min(255, g + n)),
                max(0, min(255, b + n)),
                a,
            )


# ── Stone block generation ─────────────────────────────────────────────

def generate_stone_block(w, h, cracked=False):
    """Generate a single stone block sprite with three-tone painted shading."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    outline_w = 3 if max(w, h) >= 192 else 2
    inner_x0, inner_y0 = outline_w, outline_w
    inner_x1, inner_y1 = w - outline_w - 1, h - outline_w - 1
    inner_w = inner_x1 - inner_x0 + 1
    inner_h = inner_y1 - inner_y0 + 1

    # Draw outline with rounded corners
    draw.rounded_rectangle(
        [(0, 0), (w - 1, h - 1)],
        radius=min(6, min(w, h) // 8),
        fill=OUTLINE,
    )

    # Fill interior with three-tone directional gradient (top-left light)
    for py in range(inner_y0, inner_y1 + 1):
        for px in range(inner_x0, inner_x1 + 1):
            # Normalized position
            nx = (px - inner_x0) / max(1, inner_w - 1)
            ny = (py - inner_y0) / max(1, inner_h - 1)

            # Light factor: 1.0 at top-left, 0.0 at bottom-right
            light = 1.0 - (nx * 0.5 + ny * 0.5)
            light = max(0, min(1, light))

            # Three-tone mapping
            if light > 0.55:
                t = (light - 0.55) / 0.45
                color = lerp_color(BASE, HIGHLIGHT, t)
            else:
                t = light / 0.55
                color = lerp_color(SHADOW, BASE, t)

            img.putpixel((px, py), color)

    # Add mortar lines (horizontal and vertical joints)
    _draw_mortar_lines(img, inner_x0, inner_y0, inner_w, inner_h, w, h)

    # Add subtle texture grain
    add_noise(img, intensity=8)

    # Add moss patches (sparse, small)
    _draw_moss_patches(img, inner_x0, inner_y0, inner_w, inner_h, count=max(1, (w * h) // 8000))

    # Add rim lighting on top-left edges
    _draw_rim_light(img, inner_x0, inner_y0, inner_x1, inner_y1)

    # Add corner bolts/rivets for character
    _draw_corner_details(img, outline_w, w, h)

    if cracked:
        _draw_cracks(img, inner_x0, inner_y0, inner_w, inner_h, w, h)

    return img


def _draw_mortar_lines(img, ix0, iy0, iw, ih, w, h):
    """Draw mortar/joint lines in the stone surface."""
    draw = ImageDraw.Draw(img)
    mortar_color = (0x5A, 0x4D, 0x3E, 100)
    mortar_dark = (0x3E, 0x33, 0x28, 80)

    # Horizontal mortar lines spaced ~30-50px
    spacing_h = max(30, ih // max(1, ih // 40))
    y = iy0 + spacing_h
    while y < iy0 + ih - 10:
        # Slightly wavy line
        for x in range(ix0 + 2, ix0 + iw - 2):
            offset = int(math.sin(x * 0.15) * 1.5)
            yy = y + offset
            if iy0 <= yy < iy0 + ih:
                img.putpixel((x, yy), mortar_color)
                if yy + 1 < iy0 + ih:
                    img.putpixel((x, yy + 1), mortar_dark)
        y += spacing_h + random.randint(-5, 5)

    # Vertical mortar lines (offset per row for brick pattern)
    spacing_v = max(25, iw // max(1, iw // 30))
    row = 0
    y = iy0
    while y < iy0 + ih:
        next_y = min(y + spacing_h + random.randint(-5, 5), iy0 + ih)
        offset = (spacing_v // 2) if row % 2 else 0
        x = ix0 + offset + spacing_v
        while x < ix0 + iw - 5:
            for yy in range(y + 2, min(next_y - 2, iy0 + ih)):
                wobble = int(math.sin(yy * 0.2) * 1)
                xx = x + wobble
                if ix0 <= xx < ix0 + iw:
                    img.putpixel((xx, yy), mortar_color)
            x += spacing_v + random.randint(-3, 3)
        y = next_y
        row += 1


def _draw_moss_patches(img, ix0, iy0, iw, ih, count=2):
    """Add sparse moss/lichen patches."""
    for _ in range(count):
        cx = ix0 + random.randint(5, max(6, iw - 5))
        cy = iy0 + random.randint(ih // 2, max(ih // 2 + 1, ih - 5))  # Moss grows lower
        radius = random.randint(3, 7)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                dist = math.sqrt(dx * dx + dy * dy)
                if dist <= radius and random.random() > 0.3:
                    px, py = cx + dx, cy + dy
                    if 0 <= px < img.width and 0 <= py < img.height:
                        existing = img.getpixel((px, py))
                        if existing[3] > 10:
                            alpha = int(MOSS[3] * (1 - dist / radius) * 0.6)
                            blended = lerp_color(existing, MOSS[:3] + (255,), alpha / 255)
                            img.putpixel((px, py), blended)


def _draw_rim_light(img, x0, y0, x1, y1):
    """Thin warm highlight on top and left edges (light-facing)."""
    rim = (0xC0, 0xB0, 0x98, 80)
    for x in range(x0, x1 + 1):
        existing = img.getpixel((x, y0))
        if existing[3] > 10:
            img.putpixel((x, y0), lerp_color(existing, rim, 0.4))
        if y0 + 1 <= y1:
            existing = img.getpixel((x, y0 + 1))
            if existing[3] > 10:
                img.putpixel((x, y0 + 1), lerp_color(existing, rim, 0.2))
    for y in range(y0, y1 + 1):
        existing = img.getpixel((x0, y))
        if existing[3] > 10:
            img.putpixel((x0, y), lerp_color(existing, rim, 0.35))


def _draw_corner_details(img, outline_w, w, h):
    """Small corner accent dots for character."""
    draw = ImageDraw.Draw(img)
    dot_color = (0x5A, 0x4D, 0x3E, 180)
    dot_r = 2
    margin = outline_w + 4
    corners = [(margin, margin), (w - margin - 1, margin),
               (margin, h - margin - 1), (w - margin - 1, h - margin - 1)]
    for cx, cy in corners:
        if 0 <= cx < w and 0 <= cy < h:
            draw.ellipse(
                [(cx - dot_r, cy - dot_r), (cx + dot_r, cy + dot_r)],
                fill=dot_color,
            )


def _draw_cracks(img, ix0, iy0, iw, ih, w, h):
    """Draw damage cracks for the cracked variant."""
    draw = ImageDraw.Draw(img)

    # Main diagonal crack from top-right toward center-left
    cx_start = ix0 + iw * 3 // 4 + random.randint(-5, 5)
    cy_start = iy0 + 2
    cx_end = ix0 + iw // 4 + random.randint(-5, 5)
    cy_end = iy0 + ih * 2 // 3 + random.randint(-5, 5)

    _draw_crack_line(img, cx_start, cy_start, cx_end, cy_end, width=2)

    # Branch cracks
    mid_x = (cx_start + cx_end) // 2
    mid_y = (cy_start + cy_end) // 2
    _draw_crack_line(img, mid_x, mid_y,
                     mid_x + random.randint(10, 20), mid_y + random.randint(10, 25), width=1)

    # Second smaller crack from bottom
    c2_start_x = ix0 + iw // 3 + random.randint(-5, 5)
    c2_start_y = iy0 + ih - 3
    c2_end_x = ix0 + iw // 2 + random.randint(-5, 5)
    c2_end_y = iy0 + ih * 2 // 3 + random.randint(-5, 5)
    _draw_crack_line(img, c2_start_x, c2_start_y, c2_end_x, c2_end_y, width=1)

    # Darken area around cracks for depth
    darkened = img.copy()
    dark_draw = ImageDraw.Draw(darkened)
    # Subtle darkening overlay near the main crack
    for t_val in [i / 20.0 for i in range(21)]:
        px = int(cx_start + (cx_end - cx_start) * t_val)
        py = int(cy_start + (cy_end - cy_start) * t_val)
        for dx in range(-4, 5):
            for dy in range(-4, 5):
                ppx, ppy = px + dx, py + dy
                if 0 <= ppx < w and 0 <= ppy < h:
                    existing = img.getpixel((ppx, ppy))
                    if existing[3] > 10:
                        darkened_c = lerp_color(existing, SHADOW, 0.15)
                        darkened.putpixel((ppx, ppy), darkened_c)
    img.paste(darkened, (0, 0))


def _draw_crack_line(img, x1, y1, x2, y2, width=2):
    """Draw a jagged crack line with depth shading."""
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    prev_x, prev_y = x1, y1

    for i in range(steps + 1):
        t = i / steps
        px = int(x1 + (x2 - x1) * t + random.randint(-2, 2))
        py = int(y1 + (y2 - y1) * t + random.randint(-1, 1))
        px = max(0, min(img.width - 1, px))
        py = max(0, min(img.height - 1, py))

        # Dark crack center
        for w_offset in range(-width, width + 1):
            for h_offset in range(-width, width + 1):
                cpx = px + w_offset
                cpy = py + h_offset
                if 0 <= cpx < img.width and 0 <= cpy < img.height:
                    dist = abs(w_offset) + abs(h_offset)
                    if dist <= width:
                        color = CRACK_DARK if dist == 0 else CRACK_INNER
                        img.putpixel((cpx, cpy), color)


# ── Stone VFX sprite generation ────────────────────────────────────────

def generate_stone_chip(size, variant=0):
    """Generate an angular stone chip/fragment sprite."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Angular polygon shape
    cx, cy = size // 2, size // 2
    random.seed(42 + variant)
    points = []
    num_pts = random.randint(4, 6)
    for i in range(num_pts):
        angle = (2 * math.pi * i / num_pts) + random.uniform(-0.3, 0.3)
        r = (size // 2 - 1) * random.uniform(0.6, 1.0)
        points.append((int(cx + r * math.cos(angle)), int(cy + r * math.sin(angle))))

    # Fill with stone mid-tone
    chip_base = lerp_color(BASE, SHADOW, random.uniform(0.1, 0.4))
    draw.polygon(points, fill=chip_base, outline=OUTLINE)

    # Add highlight on top-left face
    for px, py in points[:len(points) // 2]:
        if 0 <= px < size and 0 <= py < size:
            existing = img.getpixel((px, py))
            if existing[3] > 10:
                img.putpixel((px, py), lerp_color(existing, HIGHLIGHT, 0.3))

    add_noise(img, intensity=6)
    return img


def generate_stone_dust(size):
    """Generate a stone dust cloud sprite (grayer/heavier than existing dust)."""
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    cx, cy = size // 2, size // 2
    max_r = size // 2 - 1

    # Gray-brown dust color
    dust_base = (0x8A, 0x7D, 0x6E, 200)  # Warmer gray-brown
    dust_edge = (0x9A, 0x8D, 0x7E, 0)

    for y in range(size):
        for x in range(size):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= max_r:
                t = dist / max_r
                # Soft radial falloff
                alpha = int(200 * (1 - t * t))
                # Slight color variation
                noise = random.randint(-5, 5)
                r = max(0, min(255, dust_base[0] + noise))
                g = max(0, min(255, dust_base[1] + noise))
                b = max(0, min(255, dust_base[2] + noise))
                img.putpixel((x, y), (r, g, b, max(0, alpha)))

    # Gaussian blur for softness
    img = img.filter(ImageFilter.GaussianBlur(radius=1.5))
    return img


# ── Atlas assembly ─────────────────────────────────────────────────────

def build_props_atlas():
    """Generate stone block sprites and composite into expanded props atlas."""
    print("Loading existing props atlas...")
    props_png = Image.open(SPRITES / "props.png").convert("RGBA")
    with open(SPRITES / "props.json") as f:
        props_json = json.load(f)

    # Expand atlas to 1024x1024
    new_atlas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    new_atlas.paste(props_png, (0, 0))

    # Stone block definitions: (name, width, height)
    blocks = [
        ("stone_short",    64, 192),
        ("stone_medium",   64, 256),
        ("stone_long",     64, 384),
        ("stone_platform", 384, 48),
    ]

    # Layout positions for intact blocks
    positions = {
        "stone_short":    (650, 0),
        "stone_medium":   (716, 0),
        "stone_long":     (782, 0),
        "stone_platform": (0, 720),
    }
    # Layout positions for cracked blocks
    cracked_positions = {
        "stone_short_cracked":    (848, 0),
        "stone_medium_cracked":   (914, 0),
        "stone_long_cracked":     (650, 386),
        "stone_platform_cracked": (0, 770),
    }

    for name, bw, bh in blocks:
        # Intact version
        print(f"  Generating {name} ({bw}x{bh})...")
        intact = generate_stone_block(bw, bh, cracked=False)
        pos = positions[name]
        new_atlas.paste(intact, pos, intact)
        props_json["frames"][name] = _frame_entry(pos[0], pos[1], bw, bh)

        # Cracked version
        cracked_name = f"{name}_cracked"
        print(f"  Generating {cracked_name} ({bw}x{bh})...")
        cracked = generate_stone_block(bw, bh, cracked=True)
        cpos = cracked_positions[cracked_name]
        new_atlas.paste(cracked, cpos, cracked)
        props_json["frames"][cracked_name] = _frame_entry(cpos[0], cpos[1], bw, bh)

    # Update atlas size in metadata
    props_json["meta"]["size"] = {"w": 1024, "h": 1024}

    # Save
    new_atlas.save(SPRITES / "props.png")
    with open(SPRITES / "props.json", "w") as f:
        json.dump(props_json, f, indent=2)
    print(f"  Saved props.png (1024x1024) and props.json")


def build_vfx_atlas():
    """Generate stone VFX sprites and composite into expanded VFX atlas."""
    print("Loading existing VFX atlas...")
    vfx_png = Image.open(SPRITES / "vfx.png").convert("RGBA")
    with open(SPRITES / "vfx.json") as f:
        vfx_json = json.load(f)

    # Expand atlas to 256x220
    new_atlas = Image.new("RGBA", (256, 220), (0, 0, 0, 0))
    new_atlas.paste(vfx_png, (0, 0))

    # Stone chips
    chips = [
        ("stone_chip_01", 16, 0),
        ("stone_chip_02", 20, 1),
        ("stone_chip_03", 12, 2),
    ]
    y_row = 144
    x_cursor = 0
    for name, size, variant in chips:
        print(f"  Generating {name} ({size}x{size})...")
        chip = generate_stone_chip(size, variant)
        new_atlas.paste(chip, (x_cursor, y_row), chip)
        vfx_json["frames"][name] = _frame_entry(x_cursor, y_row, size, size)
        x_cursor += size + 2

    # Stone dust clouds
    dusts = [
        ("stone_dust_01", 48),
        ("stone_dust_02", 48),
    ]
    y_row2 = 164
    x_cursor = 0
    for name, size in dusts:
        print(f"  Generating {name} ({size}x{size})...")
        random.seed(42 + hash(name))
        dust = generate_stone_dust(size)
        new_atlas.paste(dust, (x_cursor, y_row2), dust)
        vfx_json["frames"][name] = _frame_entry(x_cursor, y_row2, size, size)
        x_cursor += size + 2

    # Update atlas size in metadata
    vfx_json["meta"]["size"] = {"w": 256, "h": 220}

    # Save
    new_atlas.save(SPRITES / "vfx.png")
    with open(SPRITES / "vfx.json", "w") as f:
        json.dump(vfx_json, f, indent=2)
    print(f"  Saved vfx.png (256x220) and vfx.json")


def _frame_entry(x, y, w, h):
    return {
        "frame": {"x": x, "y": y, "w": w, "h": h},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
        "sourceSize": {"w": w, "h": h},
    }


# ── Main ───────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=== Generating Stone Block Assets ===\n")
    build_props_atlas()
    print()
    build_vfx_atlas()
    print("\n=== Done! ===")
