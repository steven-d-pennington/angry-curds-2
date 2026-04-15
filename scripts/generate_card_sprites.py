#!/usr/bin/env python3
"""
Generate card UI sprites for Angry Curds 2.
DON-126: Card-sized icons for Gouda, Swiss, Parmesan to display in the card hand UI.

Creates a new ui.png/ui.json atlas with card icons matching existing Cheddar/Brie style.
Each card icon is 32x40, showing a small cheese character silhouette.

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

OUTLINE = (0x3B, 0x25, 0x10)

# Card icon palettes (simplified versions of character palettes)
CARD_COLORS = {
    "cheddar": {
        "body": (0xF5, 0xA6, 0x23),
        "highlight": (0xFF, 0xD7, 0x6E),
        "shadow": (0xC4, 0x7B, 0x12),
    },
    "brie": {
        "body": (0xFF, 0xF8, 0xE7),
        "highlight": (0xFF, 0xFF, 0xF4),
        "shadow": (0xE0, 0xD8, 0xC0),
    },
    "gouda": {
        "body": (0xD4, 0x5A, 0x1A),
        "highlight": (0xFF, 0x8C, 0x42),
        "shadow": (0x9A, 0x38, 0x0E),
    },
    "swiss": {
        "body": (0xF0, 0xE0, 0x80),
        "highlight": (0xFF, 0xF4, 0xB0),
        "shadow": (0xC8, 0xB8, 0x58),
    },
    "parmesan": {
        "body": (0xD4, 0xB0, 0x60),
        "highlight": (0xFF, 0xE0, 0x90),
        "shadow": (0xA0, 0x80, 0x3A),
    },
}


def lerp_color(c1, c2, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def light_factor(x, y, w, h):
    nx = (x / w) * 2.0 - 1.0
    ny = (y / h) * 2.0 - 1.0
    dot = -(-0.707 * nx + -0.707 * ny)
    return max(0.0, min(1.0, ((dot + 1.0) * 0.5) ** 0.8))


def draw_card_cheddar(w, h, palette):
    """Wedge-shaped cheese icon (Cheddar style)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 + 2

    # Small wedge triangle
    tip = (cx, 4)
    bl = (4, h - 4)
    br = (w - 4, h - 4)

    for y in range(tip[1], bl[1] + 1):
        t = (y - tip[1]) / max(1, bl[1] - tip[1])
        lx = tip[0] + (bl[0] - tip[0]) * t
        rx = tip[0] + (br[0] - tip[0]) * t
        for x in range(int(lx), int(rx) + 1):
            lf = light_factor(x, y, w, h)
            if lf > 0.6:
                color = lerp_color(palette["body"], palette["highlight"], (lf - 0.6) / 0.4 * 0.7)
            elif lf < 0.35:
                color = lerp_color(palette["body"], palette["shadow"], (0.35 - lf) / 0.35 * 0.7)
            else:
                color = palette["body"]
            img.putpixel((x, y), (*color, 255))

    draw.polygon([tip, br, bl], outline=(*OUTLINE, 255))
    draw.line([tip, br], fill=(*OUTLINE, 255), width=2)
    draw.line([br, bl], fill=(*OUTLINE, 255), width=2)
    draw.line([bl, tip], fill=(*OUTLINE, 255), width=2)

    return img


def draw_card_gouda(w, h, palette):
    """Round wheel cheese icon (Gouda)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 + 1
    radius = min(w, h) // 2 - 3

    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius:
                lf = light_factor(x, y, w, h)
                edge_t = (dist / radius) ** 2
                if lf > 0.6:
                    color = lerp_color(palette["body"], palette["highlight"], (lf - 0.6) / 0.4 * 0.7)
                elif lf < 0.35:
                    color = lerp_color(palette["body"], palette["shadow"], (0.35 - lf) / 0.35 * 0.7)
                else:
                    color = palette["body"]
                color = lerp_color(color, palette["shadow"], edge_t * 0.3)
                img.putpixel((x, y), (*color, 255))

    draw.ellipse([cx - radius - 1, cy - radius - 1, cx + radius + 1, cy + radius + 1],
                 outline=(*OUTLINE, 255), width=2)

    return img


def draw_card_swiss(w, h, palette):
    """Elongated cheese with holes icon (Swiss)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 + 1
    rx, ry = w // 2 - 3, h // 2 - 5

    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / max(1, rx)
            dy = (y - cy) / max(1, ry)
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= 1.0:
                lf = light_factor(x, y, w, h)
                if lf > 0.6:
                    color = lerp_color(palette["body"], palette["highlight"], (lf - 0.6) / 0.4 * 0.7)
                elif lf < 0.35:
                    color = lerp_color(palette["body"], palette["shadow"], (0.35 - lf) / 0.35 * 0.7)
                else:
                    color = palette["body"]
                img.putpixel((x, y), (*color, 255))

    # Swiss holes
    holes = [(cx - 5, cy - 2, 3), (cx + 4, cy + 3, 2), (cx - 1, cy + 5, 2)]
    for hx, hy, hr in holes:
        draw.ellipse([hx - hr, hy - hr, hx + hr, hy + hr],
                     fill=(0xC8, 0xB8, 0x58, 255))

    draw.ellipse([cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1],
                 outline=(*OUTLINE, 255), width=2)

    return img


def draw_card_parmesan(w, h, palette):
    """Hard wedge with crystalline texture icon (Parmesan)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2 + 2

    # Wider wedge
    tip = (cx + 2, 5)
    bl = (3, h - 4)
    br = (w - 3, h - 4)

    for y in range(tip[1], bl[1] + 1):
        t = (y - tip[1]) / max(1, bl[1] - tip[1])
        lx = tip[0] + (bl[0] - tip[0]) * t
        rx = tip[0] + (br[0] - tip[0]) * t
        for x in range(int(lx), int(rx) + 1):
            lf = light_factor(x, y, w, h)
            if lf > 0.6:
                color = lerp_color(palette["body"], palette["highlight"], (lf - 0.6) / 0.4 * 0.7)
            elif lf < 0.35:
                color = lerp_color(palette["body"], palette["shadow"], (0.35 - lf) / 0.35 * 0.7)
            else:
                color = palette["body"]
            img.putpixel((x, y), (*color, 255))

    # Crystal sparkles
    random.seed(123)
    for _ in range(5):
        sx = random.randint(6, w - 6)
        sy = random.randint(10, h - 8)
        if img.getpixel((sx, sy))[3] > 10:
            draw.point((sx, sy), fill=(0xFF, 0xF0, 0xCC, 200))

    draw.polygon([tip, br, bl], outline=(*OUTLINE, 255))
    draw.line([tip, br], fill=(*OUTLINE, 255), width=2)
    draw.line([br, bl], fill=(*OUTLINE, 255), width=2)
    draw.line([bl, tip], fill=(*OUTLINE, 255), width=2)

    random.seed(42)
    return img


def build_card_atlas():
    """Build ui.png/ui.json atlas with card icons for all cheese types."""
    card_w, card_h = 32, 40
    gap = 2

    cheese_types = ["cheddar", "brie", "gouda", "swiss", "parmesan"]
    draw_funcs = {
        "cheddar": draw_card_cheddar,
        "brie": draw_card_cheddar,  # Brie uses same wedge shape, different color
        "gouda": draw_card_gouda,
        "swiss": draw_card_swiss,
        "parmesan": draw_card_parmesan,
    }

    atlas_w = len(cheese_types) * (card_w + gap)
    atlas_h = card_h + gap
    atlas = Image.new("RGBA", (atlas_w, atlas_h), (0, 0, 0, 0))

    frames = {}
    x = 0
    for cheese in cheese_types:
        palette = CARD_COLORS[cheese]
        icon = draw_funcs[cheese](card_w, card_h, palette)

        # Apply subtle painted finish
        blurred = icon.filter(ImageFilter.GaussianBlur(radius=0.5))
        icon = Image.blend(icon, blurred, 0.15)

        atlas.paste(icon, (x, 0), icon)
        frames[f"card_{cheese}"] = {
            "frame": {"x": x, "y": 0, "w": card_w, "h": card_h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": card_w, "h": card_h},
            "sourceSize": {"w": card_w, "h": card_h},
        }
        print(f"  Generated card_{cheese} at ({x}, 0)")
        x += card_w + gap

    # Save
    atlas.save(SPRITES / "ui.png", "PNG")

    manifest = {
        "frames": frames,
        "meta": {
            "app": "angry-curds-2",
            "version": "1.0",
            "image": "ui.png",
            "format": "RGBA8888",
            "size": {"w": atlas_w, "h": atlas_h},
            "scale": "1",
        },
    }
    with open(SPRITES / "ui.json", "w") as f:
        json.dump(manifest, f, indent=2)

    file_size = (SPRITES / "ui.png").stat().st_size
    print(f"\nSaved ui.png ({atlas_w}x{atlas_h}, {file_size / 1024:.1f} KB)")
    print(f"Saved ui.json ({len(frames)} frames)")


if __name__ == "__main__":
    print("=== Generating Card UI Sprites ===\n")
    build_card_atlas()
    print("\n=== Done! ===")
