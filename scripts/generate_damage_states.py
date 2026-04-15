#!/usr/bin/env python3
"""
Generate intermediate block damage state sprites for Angry Curds 2.
DON-126: Adds 'damaged' state between intact and cracked for all block types.

Creates 3-stage damage progression: intact → damaged → cracked → destroyed.

For each material (wood, cheese_crate, stone) × each size, creates a
_damaged variant by reading the intact sprite and applying mild surface damage
(hairline cracks, scuff marks, displaced fragments) that is visibly less severe
than the existing _cracked variant.

Art bible: three-tone painted shading, warm brown outlines (#3B2510).
"""

import json
import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter

random.seed(42)

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "public" / "assets" / "sprites"

# Art bible colors
OUTLINE = (0x3B, 0x25, 0x10, 255)
SHADOW = (0x4A, 0x3D, 0x30, 255)
CRACK_HAIRLINE = (0x30, 0x22, 0x16, 160)  # lighter than full crack
CRACK_SHADOW = (0x3E, 0x33, 0x28, 100)
SCUFF_MARK = (0x50, 0x40, 0x30, 80)


def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGBA colors."""
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def _draw_hairline_crack(img, x1, y1, x2, y2):
    """Draw a thin, subtle hairline crack (less severe than full cracks)."""
    steps = max(abs(x2 - x1), abs(y2 - y1), 1)
    for i in range(steps + 1):
        t = i / steps
        px = int(x1 + (x2 - x1) * t + random.randint(-1, 1))
        py = int(y1 + (y2 - y1) * t + random.randint(-1, 1))
        px = max(0, min(img.width - 1, px))
        py = max(0, min(img.height - 1, py))

        existing = img.getpixel((px, py))
        if existing[3] > 10:
            # Thin crack center (1px wide, semi-transparent)
            img.putpixel((px, py), CRACK_HAIRLINE)
            # Very subtle shadow on one side
            if px + 1 < img.width:
                adj = img.getpixel((px + 1, py))
                if adj[3] > 10:
                    dark = lerp_color(adj, CRACK_SHADOW, 0.3)
                    img.putpixel((px + 1, py), dark)


def _add_scuff_marks(img, count=3):
    """Add subtle surface scuff marks (darkened patches)."""
    w, h = img.size
    for _ in range(count):
        cx = random.randint(w // 6, w * 5 // 6)
        cy = random.randint(h // 6, h * 5 // 6)
        radius = random.randint(3, 8)
        for dy in range(-radius, radius + 1):
            for dx in range(-radius, radius + 1):
                px, py = cx + dx, cy + dy
                dist = math.sqrt(dx * dx + dy * dy)
                if 0 <= px < w and 0 <= py < h and dist <= radius:
                    existing = img.getpixel((px, py))
                    if existing[3] > 10:
                        darken = 0.12 * (1 - dist / radius)
                        dark = lerp_color(existing, SHADOW, darken)
                        img.putpixel((px, py), dark)


def _add_edge_chip(img, side="top"):
    """Add a small chip/nick to an edge."""
    w, h = img.size
    if side == "top":
        cx = random.randint(w // 4, w * 3 // 4)
        for dx in range(-3, 4):
            for dy in range(0, 3):
                px, py = cx + dx, dy
                if 0 <= px < w and 0 <= py < h:
                    existing = img.getpixel((px, py))
                    if existing[3] > 10:
                        # Reduce alpha to simulate chipped edge
                        chip_a = max(0, existing[3] - random.randint(60, 150))
                        img.putpixel((px, py), (existing[0], existing[1], existing[2], chip_a))
    elif side == "right":
        cy = random.randint(h // 4, h * 3 // 4)
        for dy in range(-3, 4):
            for dx in range(0, 3):
                px, py = w - 1 - dx, cy + dy
                if 0 <= px < w and 0 <= py < h:
                    existing = img.getpixel((px, py))
                    if existing[3] > 10:
                        chip_a = max(0, existing[3] - random.randint(60, 150))
                        img.putpixel((px, py), (existing[0], existing[1], existing[2], chip_a))


def create_damaged_variant(intact_img):
    """
    Create a 'damaged' variant from an intact sprite.
    Applies mild damage: 1-2 hairline cracks, scuff marks, optional edge chip.
    """
    img = intact_img.copy()
    w, h = img.size

    random_state = random.getstate()

    # One main hairline crack (shorter and thinner than full cracks)
    if h > w:
        # Vertical block: diagonal crack
        cx1 = random.randint(w // 3, w * 2 // 3)
        cy1 = random.randint(h // 6, h // 3)
        cx2 = cx1 + random.randint(-15, 15)
        cy2 = cy1 + random.randint(h // 6, h // 3)
    else:
        # Horizontal platform: horizontal-ish crack
        cx1 = random.randint(w // 6, w // 3)
        cy1 = random.randint(h // 4, h * 3 // 4)
        cx2 = cx1 + random.randint(w // 6, w // 3)
        cy2 = cy1 + random.randint(-8, 8)

    _draw_hairline_crack(img, cx1, cy1, cx2, cy2)

    # Optional second smaller crack (50% chance)
    if random.random() > 0.5:
        mid_x = (cx1 + cx2) // 2
        mid_y = (cy1 + cy2) // 2
        _draw_hairline_crack(img, mid_x, mid_y,
                             mid_x + random.randint(5, 15),
                             mid_y + random.randint(5, 15))

    # Scuff marks
    _add_scuff_marks(img, count=random.randint(2, 4))

    # Small edge chip (60% chance)
    if random.random() > 0.4:
        _add_edge_chip(img, random.choice(["top", "right"]))

    # Subtle overall darkening (very mild, 3-5%)
    pixels = img.load()
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a > 10:
                darken = 0.03 + random.random() * 0.02
                pixels[x, y] = (
                    max(0, int(r * (1 - darken))),
                    max(0, int(g * (1 - darken))),
                    max(0, int(b * (1 - darken))),
                    a,
                )

    return img


# ─── Atlas assembly ────────────────────────────────────────────────────

def build_damage_states():
    """Generate damaged variants for all block types and add to props atlas."""
    print("Loading existing props atlas...")
    props_img = Image.open(SPRITES / "props.png").convert("RGBA")
    with open(SPRITES / "props.json") as f:
        props_json = json.load(f)

    frames = props_json["frames"]

    # Define intact blocks and their damaged variant positions
    # Format: (intact_name, damaged_name, x, y)
    damage_specs = [
        # Wood planks — placed in right-side vertical free space
        ("wood_plank_short",  "wood_plank_short_damaged",  848, 194),   # below stone_short_cracked
        ("wood_plank_medium", "wood_plank_medium_damaged", 914, 258),   # below stone_medium_cracked
        ("wood_plank_long",   "wood_plank_long_damaged",   782, 386),   # below stone_long
        # Wood platform — bottom area
        ("wood_platform",     "wood_platform_damaged",     0,   820),
        # Cheese crates — bottom area
        ("cheese_crate_small", "cheese_crate_small_damaged", 386, 820),
        ("cheese_crate_large", "cheese_crate_large_damaged", 486, 820),
        # Stone blocks — right side
        ("stone_short",       "stone_short_damaged",       848, 386),   # below wood_plank_short_damaged
        ("stone_medium",      "stone_medium_damaged",      914, 516),   # below wood_plank_medium_damaged
        ("stone_long",        "stone_long_damaged",        716, 386),   # right of stone_long_cracked
        # Stone platform — bottom area
        ("stone_platform",    "stone_platform_damaged",    0,   870),
    ]

    for intact_name, damaged_name, dx, dy in damage_specs:
        if intact_name not in frames:
            print(f"  WARNING: {intact_name} not found in atlas, skipping")
            continue

        f = frames[intact_name]["frame"]
        w, h = f["w"], f["h"]

        # Seed deterministically per block for reproducible results
        random.seed(42 + hash(damaged_name) % 10000)

        print(f"  Generating {damaged_name} ({w}x{h}) from {intact_name}...")

        # Extract intact sprite
        intact = props_img.crop((f["x"], f["y"], f["x"] + w, f["y"] + h))

        # Create damaged variant
        damaged = create_damaged_variant(intact)

        # Paste into atlas
        props_img.paste(damaged, (dx, dy), damaged)

        # Add frame entry
        frames[damaged_name] = {
            "frame": {"x": dx, "y": dy, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }

    # Save updated atlas
    props_img.save(SPRITES / "props.png", "PNG")
    with open(SPRITES / "props.json", "w") as f:
        json.dump(props_json, f, indent=2)

    file_size = (SPRITES / "props.png").stat().st_size
    print(f"\nSaved props.png (1024x1024, {file_size / 1024:.1f} KB)")
    print(f"Saved props.json ({len(frames)} frames)")


if __name__ == "__main__":
    print("=== Generating Block Damage State Sprites ===\n")
    build_damage_states()
    print("\n=== Done! ===")
