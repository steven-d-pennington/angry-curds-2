#!/usr/bin/env python3
"""
Generate upgraded hand-painted VFX sprite atlas for Angry Curds 2.
DON-119: Replaces placeholder shapes with three-tone painted particles.

Art bible references:
  - Three-tone painted shading (highlight, midtone, shadow)
  - Warm brown outlines (#3B2510) where appropriate
  - VFX palette: dust #C8B898, impact #FFB833, score #FFEE44
  - Cheese palette: gold #F5A623, highlight #FFD76E, shadow #C47B12
  - Environment: wood-light #B8845A, wood-mid #8B5E3C, wood-dark #5C3A1E
  - Stone: light #A89880, mid #7A6B58, dark #4A3D30
"""

import math
import random
from PIL import Image, ImageDraw, ImageFilter

random.seed(42)  # Reproducible output

ATLAS_W, ATLAS_H = 256, 384

# --- Color palettes (from art bible) ---
CHEESE = {
    "highlight": (0xFF, 0xD7, 0x6E),
    "mid": (0xF5, 0xA6, 0x23),
    "shadow": (0xC4, 0x7B, 0x12),
    "deep": (0x8B, 0x5A, 0x0B),
}
DUST = {
    "highlight": (0xDA, 0xD0, 0xB8),
    "mid": (0xC8, 0xB8, 0x98),
    "shadow": (0xA8, 0x98, 0x78),
}
SPARK = {
    "highlight": (0xFF, 0xEE, 0x44),
    "mid": (0xFF, 0xB8, 0x33),
    "shadow": (0xE0, 0x90, 0x10),
}
WOOD = {
    "highlight": (0xB8, 0x84, 0x5A),
    "mid": (0x8B, 0x5E, 0x3C),
    "shadow": (0x5C, 0x3A, 0x1E),
}
STONE = {
    "highlight": (0xA8, 0x98, 0x80),
    "mid": (0x7A, 0x6B, 0x58),
    "shadow": (0x4A, 0x3D, 0x30),
}
OUTLINE = (0x3B, 0x25, 0x10)


def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB colors."""
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def draw_soft_ellipse(draw, cx, cy, rx, ry, color, alpha_base=200, feather=0.3):
    """Draw a soft-edged ellipse with feathered transparency."""
    img = Image.new("RGBA", draw.im.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    # Core
    d.ellipse(
        [cx - rx, cy - ry, cx + rx, cy + ry],
        fill=(*color, alpha_base),
    )
    return img


def make_dust_puff(w, h, variant=0):
    """Hand-painted wispy dust cloud with internal detail and soft edges."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    r = min(w, h) // 2 - 2

    # Warm tint variations per variant
    tint_offsets = [
        (0, 0, 0),
        (8, 4, -4),
        (-4, 2, 6),
        (4, -2, -2),
    ]
    toff = tint_offsets[variant % 4]

    base = tuple(max(0, min(255, DUST["mid"][i] + toff[i])) for i in range(3))
    hi = tuple(max(0, min(255, DUST["highlight"][i] + toff[i])) for i in range(3))
    sh = tuple(max(0, min(255, DUST["shadow"][i] + toff[i])) for i in range(3))

    # Multiple overlapping soft blobs for wispy shape
    blobs = []
    random.seed(42 + variant * 7)
    for _ in range(6):
        bx = cx + random.randint(-r // 2, r // 2)
        by = cy + random.randint(-r // 2, r // 2)
        br = random.randint(r // 3, r * 2 // 3)
        blobs.append((bx, by, br))

    # Paint shadow layer first
    for bx, by, br in blobs:
        oy = 2  # shadow offset
        draw.ellipse(
            [bx - br, by - br + oy, bx + br, by + br + oy],
            fill=(*sh, 60),
        )

    # Paint midtone layer
    for bx, by, br in blobs:
        draw.ellipse(
            [bx - br, by - br, bx + br, by + br],
            fill=(*base, 100),
        )

    # Paint highlight blob (top-left lit)
    for bx, by, br in blobs[:3]:
        hr = br * 2 // 3
        draw.ellipse(
            [bx - hr - 2, by - hr - 2, bx + hr - 2, by + hr - 2],
            fill=(*hi, 80),
        )

    # Internal wispy detail — small darker wisps
    random.seed(100 + variant)
    for _ in range(4):
        wx = cx + random.randint(-r // 3, r // 3)
        wy = cy + random.randint(-r // 3, r // 3)
        wr = random.randint(2, r // 4)
        draw.ellipse(
            [wx - wr, wy - wr, wx + wr, wy + wr],
            fill=(*sh, 40),
        )

    # Soft edge blur for feathered look
    img = img.filter(ImageFilter.GaussianBlur(radius=2.0))

    # Brighten center slightly
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse(
        [cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3],
        fill=(*hi, 50),
    )
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=3.0))
    img = Image.alpha_composite(img, overlay)

    return img


def make_cheese_crumb(w, h, variant=0):
    """Painted cheese crumb with highlights and shadow, varied shapes."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(200 + variant)

    # Different shapes per variant: wedge, round, crumbled
    if variant == 0:
        # Angular wedge chunk
        pts = [
            (2, h - 3),
            (w // 2, 2),
            (w - 2, h // 3),
            (w - 3, h - 2),
            (w // 3, h - 2),
        ]
        # Shadow
        spts = [(x + 1, y + 1) for x, y in pts]
        draw.polygon(spts, fill=(*CHEESE["deep"], 180))
        # Outline
        draw.polygon(pts, fill=(*CHEESE["shadow"], 255), outline=(*OUTLINE, 220))
        # Midtone overlay
        inner = [(int(cx + (x - cx) * 0.6), int(cy + (y - cy) * 0.6)) for x, y in pts]
        draw.polygon(inner, fill=(*CHEESE["mid"], 200))
        # Highlight
        hpts = [(int(cx + (x - cx) * 0.3), int(cy + (y - cy) * 0.3 - 1)) for x, y in pts]
        draw.polygon(hpts, fill=(*CHEESE["highlight"], 180))
    elif variant == 1:
        # Rounder chunk
        r = min(w, h) // 2 - 2
        # Shadow
        draw.ellipse([cx - r + 1, cy - r + 2, cx + r + 1, cy + r + 2], fill=(*CHEESE["deep"], 160))
        # Outline
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*CHEESE["mid"], 255), outline=(*OUTLINE, 220))
        # Highlight (top-left)
        hr = r * 2 // 3
        draw.ellipse([cx - hr - 2, cy - hr - 2, cx + hr - 2, cy + hr - 2], fill=(*CHEESE["highlight"], 180))
        # Cheese hole detail
        draw.ellipse([cx + 1, cy + 1, cx + r // 3, cy + r // 3], fill=(*CHEESE["shadow"], 200))
    else:
        # Small crumbled piece
        pts = [
            (1, h // 2),
            (w // 3, 1),
            (w - 2, 2),
            (w - 1, h - 3),
            (w // 2, h - 1),
        ]
        draw.polygon(pts, fill=(*CHEESE["shadow"], 255), outline=(*OUTLINE, 200))
        inner = [(int(cx + (x - cx) * 0.55), int(cy + (y - cy) * 0.55)) for x, y in pts]
        draw.polygon(inner, fill=(*CHEESE["mid"], 220))
        draw.polygon(
            [(int(cx + (x - cx) * 0.25), int(cy + (y - cy) * 0.25 - 1)) for x, y in pts],
            fill=(*CHEESE["highlight"], 180),
        )

    # Subtle blur for painted feel
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))
    return img


def make_impact_spark(w, h, variant=0):
    """Rich warm glow spark with orange-gold gradient, dynamic shapes."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(300 + variant)

    # Outer glow
    glow_r = min(w, h) // 2 - 1
    for gr in range(glow_r, glow_r // 3, -1):
        t = 1.0 - (gr / glow_r)
        c = lerp_color(SPARK["shadow"], SPARK["highlight"], t)
        a = int(40 + 160 * t)
        draw.ellipse([cx - gr, cy - gr, cx + gr, cy + gr], fill=(*c, a))

    # Spike rays (4-point star or 6-point depending on variant)
    n_spikes = [4, 6, 5][variant % 3]
    angle_off = [0, 0.26, 0.5][variant % 3]
    for i in range(n_spikes):
        angle = angle_off + i * (2 * math.pi / n_spikes)
        length = glow_r * 0.9 + random.randint(-2, 2)
        ex = cx + math.cos(angle) * length
        ey = cy + math.sin(angle) * length
        # Thick bright ray
        half_w = 2
        perp = angle + math.pi / 2
        px, py = math.cos(perp) * half_w, math.sin(perp) * half_w
        ray_pts = [
            (cx + px, cy + py),
            (ex, ey),
            (cx - px, cy - py),
        ]
        draw.polygon(ray_pts, fill=(*SPARK["highlight"], 220))

        # Thinner inner bright core
        px2, py2 = math.cos(perp) * 1, math.sin(perp) * 1
        inner_pts = [
            (cx + px2, cy + py2),
            (cx + math.cos(angle) * length * 0.7, cy + math.sin(angle) * length * 0.7),
            (cx - px2, cy - py2),
        ]
        draw.polygon(inner_pts, fill=(255, 255, 255, 200))

    # Bright white center
    draw.ellipse([cx - 3, cy - 3, cx + 3, cy + 3], fill=(255, 255, 255, 240))
    draw.ellipse([cx - 2, cy - 2, cx + 2, cy + 2], fill=(255, 255, 255, 255))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    return img


def make_wood_splinter(w, h, variant=0):
    """Wood splinter with visible grain, varied thickness, splintered edges."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    random.seed(400 + variant)

    # Tapered splinter shape
    if variant == 0:
        # Thicker piece with taper
        pts = [
            (1, h // 2 - 1),
            (3, 1),
            (w - 4, 0),
            (w - 1, h // 2),
            (w - 3, h - 1),
            (4, h - 1),
        ]
    else:
        # Thinner, more jagged
        pts = [
            (0, h // 2),
            (4, 0),
            (w // 2, 1),
            (w - 2, 0),
            (w - 1, h // 2),
            (w - 3, h - 1),
            (w // 2 + 2, h - 1),
            (3, h - 1),
        ]

    # Outline and base
    draw.polygon(pts, fill=(*WOOD["mid"], 255), outline=(*OUTLINE, 200))

    # Grain lines — horizontal streaks
    for gy in range(1, h - 1):
        if random.random() < 0.4:
            gx1 = random.randint(2, w // 4)
            gx2 = random.randint(w * 3 // 4, w - 2)
            gc = lerp_color(WOOD["shadow"], WOOD["mid"], random.random())
            draw.line([(gx1, gy), (gx2, gy)], fill=(*gc, 120), width=1)

    # Highlight stripe (top edge, lit side)
    for gx in range(3, w - 3):
        if random.random() < 0.6:
            draw.point((gx, 1), fill=(*WOOD["highlight"], 180))

    # Shadow on bottom edge
    for gx in range(3, w - 3):
        if random.random() < 0.5:
            draw.point((gx, h - 2), fill=(*WOOD["shadow"], 160))

    # Splintered ends — jagged pixels at left/right edges
    for ey in range(h):
        if random.random() < 0.3:
            draw.point((0, ey), fill=(*WOOD["highlight"], random.randint(60, 140)))
        if random.random() < 0.3:
            draw.point((w - 1, ey), fill=(*WOOD["shadow"], random.randint(80, 160)))

    return img


def make_star(w, h):
    """Bright star with soft glow halo."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    # Soft glow halo
    for r in range(w // 2, 2, -1):
        t = 1.0 - (r / (w // 2))
        a = int(30 + 120 * t)
        c = lerp_color(SPARK["mid"], SPARK["highlight"], t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*c, a))

    # 4-pointed star shape
    outer_r = w // 2 - 2
    inner_r = outer_r // 3
    pts = []
    for i in range(8):
        angle = -math.pi / 2 + i * (math.pi / 4)
        r = outer_r if i % 2 == 0 else inner_r
        pts.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))

    draw.polygon(pts, fill=(*SPARK["highlight"], 255))

    # Bright white center
    cr = 2
    draw.ellipse([cx - cr, cy - cr, cx + cr, cy + cr], fill=(255, 255, 255, 255))

    # Inner highlight
    inner_pts = []
    for i in range(8):
        angle = -math.pi / 2 + i * (math.pi / 4)
        r = outer_r * 0.5 if i % 2 == 0 else inner_r * 0.6
        inner_pts.append((cx + math.cos(angle) * r, cy + math.sin(angle) * r))
    draw.polygon(inner_pts, fill=(255, 255, 255, 160))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    return img


def make_stone_chip(w, h, variant=0):
    """Angular stone fragments, gray-tan colored, three-tone shading."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(500 + variant)

    # Angular irregular polygon
    n_pts = random.randint(5, 7)
    pts = []
    for i in range(n_pts):
        angle = i * (2 * math.pi / n_pts) + random.uniform(-0.3, 0.3)
        r = min(w, h) // 2 - 2 + random.randint(-2, 1)
        pts.append((
            int(cx + math.cos(angle) * r),
            int(cy + math.sin(angle) * r),
        ))

    # Drop shadow
    spts = [(x + 1, y + 1) for x, y in pts]
    draw.polygon(spts, fill=(*STONE["shadow"], 120))

    # Base shape with outline
    draw.polygon(pts, fill=(*STONE["mid"], 255), outline=(*OUTLINE, 200))

    # Highlight facet (top-left)
    hi_pts = [(int(cx + (x - cx) * 0.65 - 1), int(cy + (y - cy) * 0.65 - 1)) for x, y in pts[:n_pts // 2 + 1]]
    if len(hi_pts) >= 3:
        draw.polygon(hi_pts, fill=(*STONE["highlight"], 180))

    # Shadow facet (bottom-right)
    sh_pts = [(int(cx + (x - cx) * 0.5 + 1), int(cy + (y - cy) * 0.5 + 1)) for x, y in pts[n_pts // 2:]]
    if len(sh_pts) >= 3:
        draw.polygon(sh_pts, fill=(*STONE["shadow"], 160))

    # Surface texture — tiny speckles
    for _ in range(w * h // 8):
        sx = random.randint(1, w - 2)
        sy = random.randint(1, h - 2)
        if img.getpixel((sx, sy))[3] > 100:
            sc = lerp_color(STONE["shadow"], STONE["highlight"], random.random())
            draw.point((sx, sy), fill=(*sc, random.randint(80, 160)))

    return img


def make_stone_dust(w, h, variant=0):
    """Heavier, grayer dust cloud for stone destruction."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    r = min(w, h) // 2 - 2

    # Stone dust is grayer and heavier than regular dust
    hi = lerp_color(STONE["highlight"], DUST["highlight"], 0.3)
    mid = lerp_color(STONE["mid"], DUST["mid"], 0.3)
    sh = lerp_color(STONE["shadow"], DUST["shadow"], 0.3)

    random.seed(600 + variant * 11)

    # Dense overlapping blobs
    blobs = []
    for _ in range(7):
        bx = cx + random.randint(-r // 2, r // 2)
        by = cy + random.randint(-r // 2, r // 2)
        br = random.randint(r // 3, r * 2 // 3)
        blobs.append((bx, by, br))

    # Shadow layer
    for bx, by, br in blobs:
        draw.ellipse(
            [bx - br, by - br + 2, bx + br, by + br + 2],
            fill=(*sh, 70),
        )

    # Midtone
    for bx, by, br in blobs:
        draw.ellipse(
            [bx - br, by - br, bx + br, by + br],
            fill=(*mid, 110),
        )

    # Highlights
    for bx, by, br in blobs[:3]:
        hr = br * 2 // 3
        draw.ellipse(
            [bx - hr - 1, by - hr - 1, bx + hr - 1, by + hr - 1],
            fill=(*hi, 70),
        )

    # Internal gritty detail
    for _ in range(6):
        wx = cx + random.randint(-r // 3, r // 3)
        wy = cy + random.randint(-r // 3, r // 3)
        wr = random.randint(1, r // 5)
        draw.ellipse([wx - wr, wy - wr, wx + wr, wy + wr], fill=(*sh, 50))

    img = img.filter(ImageFilter.GaussianBlur(radius=2.2))

    # Subtle gritty particles on top (stone-specific)
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    for _ in range(20):
        px = cx + random.randint(-r // 2, r // 2)
        py = cy + random.randint(-r // 2, r // 2)
        pc = lerp_color(sh, hi, random.random())
        od.point((px, py), fill=(*pc, random.randint(40, 100)))
    img = Image.alpha_composite(img, overlay)

    return img


def make_explosion_ring(w, h, variant=0):
    """Expanding shockwave ring for Gouda detonation."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(700 + variant)

    # Ring parameters scale with variant (expanding shockwave)
    ring_radius = min(w, h) // 2 - 2
    ring_width = max(2, 6 - variant * 2)
    base_alpha = max(60, 220 - variant * 70)

    # Gouda orange-red palette
    gouda_glow = (0xFF, 0xAA, 0x33)
    gouda_core = (0xFF, 0x6A, 0x22)
    gouda_fade = (0xD4, 0x5A, 0x1A)

    # Outer glow
    for r in range(ring_radius, ring_radius - 6, -1):
        t = (ring_radius - r) / 6
        a = int(base_alpha * 0.3 * (1 - t))
        c = lerp_color(gouda_fade, gouda_glow, t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*c, a), width=1)

    # Main ring
    for dr in range(-ring_width, ring_width + 1):
        r = ring_radius - 3 + dr
        if r < 1:
            continue
        t = 1.0 - abs(dr) / ring_width
        a = int(base_alpha * t)
        c = lerp_color(gouda_fade, gouda_core, t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(*c, a), width=1)

    # Bright core ring
    core_r = ring_radius - 3
    if core_r > 1:
        draw.ellipse([cx - core_r, cy - core_r, cx + core_r, cy + core_r],
                     outline=(*gouda_glow, min(255, base_alpha + 40)), width=2)

    # Hot spot flares at cardinal points
    for angle in range(0, 360, 90 + variant * 30):
        rad = math.radians(angle + random.randint(-10, 10))
        fx = cx + math.cos(rad) * (ring_radius - 3)
        fy = cy + math.sin(rad) * (ring_radius - 3)
        size = random.randint(2, 4)
        draw.ellipse([fx - size, fy - size, fx + size, fy + size],
                     fill=(255, 255, 200, min(255, base_alpha)))

    img = img.filter(ImageFilter.GaussianBlur(radius=1.0))
    return img


def make_speed_blur(w, h, variant=0):
    """Horizontal streak effect for Swiss piercing ability."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cy = h // 2

    random.seed(750 + variant)

    # Swiss cheese green-yellow speed palette
    speed_core = (0x88, 0xEE, 0x66)
    speed_mid = (0x66, 0xCC, 0x55)
    speed_fade = (0x44, 0x99, 0x33)

    # Multiple horizontal streaks
    n_streaks = 3 + variant
    for i in range(n_streaks):
        y_off = cy + random.randint(-h // 3, h // 3)
        streak_w = random.randint(w // 2, w - 4)
        x_start = random.randint(1, w - streak_w - 1)
        thickness = random.randint(1, 3)
        alpha = random.randint(100, 200)

        # Gradient from bright to fade along length
        for x in range(x_start, x_start + streak_w):
            t = (x - x_start) / streak_w
            # Bright in middle, fade at ends
            brightness = 1.0 - abs(t * 2 - 1) ** 2
            c = lerp_color(speed_fade, speed_core, brightness)
            a = int(alpha * brightness)
            for dy in range(-thickness, thickness + 1):
                y = y_off + dy
                if 0 <= y < h:
                    dt = 1.0 - abs(dy) / max(1, thickness)
                    draw.point((x, y), fill=(*c, int(a * dt)))

    # Core bright center line
    draw.line([(2, cy), (w - 3, cy)], fill=(*speed_core, 180), width=1)

    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))
    return img


def make_cheese_fragment(w, h, variant=0):
    """Small Parmesan shard sprite — angular, crystalline."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(800 + variant)

    # Parmesan golden-brown palette
    parm_hi = (0xFF, 0xE0, 0x90)
    parm_mid = (0xD4, 0xB0, 0x60)
    parm_sh = (0xA0, 0x80, 0x3A)
    parm_crystal = (0xFF, 0xF0, 0xCC)

    # Angular shard shape
    n_pts = random.randint(4, 6)
    pts = []
    for i in range(n_pts):
        angle = i * (2 * math.pi / n_pts) + random.uniform(-0.4, 0.4)
        r = (min(w, h) // 2 - 1) * random.uniform(0.5, 1.0)
        pts.append((int(cx + math.cos(angle) * r), int(cy + math.sin(angle) * r)))

    # Drop shadow
    spts = [(x + 1, y + 1) for x, y in pts]
    draw.polygon(spts, fill=(*parm_sh, 100))

    # Base shape
    draw.polygon(pts, fill=(*parm_mid, 255), outline=(*OUTLINE, 200))

    # Highlight facet (top-left)
    hi_pts = [(int(cx + (x - cx) * 0.6 - 1), int(cy + (y - cy) * 0.6 - 1))
              for x, y in pts[:n_pts // 2 + 1]]
    if len(hi_pts) >= 3:
        draw.polygon(hi_pts, fill=(*parm_hi, 170))

    # Crystal sparkle
    for _ in range(2):
        sx = cx + random.randint(-w // 4, w // 4)
        sy = cy + random.randint(-h // 4, h // 4)
        draw.point((sx, sy), fill=(*parm_crystal, random.randint(150, 230)))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.4))
    return img


def make_confetti(w, h, variant=0):
    """Colored celebration confetti particle."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(850 + variant)

    # Festive colors: cheese gold, victory green, warm red, bright blue
    colors = [
        ((0xFF, 0xD7, 0x6E), (0xF5, 0xA6, 0x23)),  # gold
        ((0x72, 0xDD, 0x5C), (0x42, 0xA0, 0x32)),   # green
        ((0xFF, 0x66, 0x44), (0xCC, 0x33, 0x22)),    # red
        ((0x66, 0xBB, 0xFF), (0x33, 0x88, 0xCC)),    # blue
    ]
    hi, mid = colors[variant % len(colors)]

    # Confetti shape: small rectangle or diamond
    if variant % 2 == 0:
        # Rotated rectangle
        angle = random.uniform(0.3, 1.2)
        half_w = w // 2 - 1
        half_h = h // 3
        pts = []
        for dx, dy in [(-half_w, -half_h), (half_w, -half_h), (half_w, half_h), (-half_w, half_h)]:
            rx = cx + int(dx * math.cos(angle) - dy * math.sin(angle))
            ry = cy + int(dx * math.sin(angle) + dy * math.cos(angle))
            pts.append((rx, ry))
        draw.polygon(pts, fill=(*mid, 230))
        # Highlight
        if len(pts) >= 3:
            hi_pts = pts[:2] + [(cx, cy)]
            draw.polygon(hi_pts, fill=(*hi, 180))
    else:
        # Diamond
        draw.polygon([(cx, cy - h // 2 + 1), (cx + w // 2 - 1, cy),
                       (cx, cy + h // 2 - 1), (cx - w // 2 + 1, cy)],
                     fill=(*mid, 230))
        draw.polygon([(cx, cy - h // 2 + 1), (cx + w // 2 - 1, cy), (cx, cy)],
                     fill=(*hi, 180))

    return img


def make_dust_cloud(w, h, variant=0):
    """Enhanced impact dust cloud (larger, denser than existing dust puffs)."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2
    r = min(w, h) // 2 - 2

    random.seed(900 + variant * 13)

    # Warmer, denser dust
    warm_offsets = [(6, 3, -2), (-2, 4, 4), (4, -2, 0)]
    toff = warm_offsets[variant % 3]

    base = tuple(max(0, min(255, DUST["mid"][i] + toff[i])) for i in range(3))
    hi = tuple(max(0, min(255, DUST["highlight"][i] + toff[i])) for i in range(3))
    sh = tuple(max(0, min(255, DUST["shadow"][i] + toff[i])) for i in range(3))

    # More blobs for denser cloud
    blobs = []
    for _ in range(8 + variant * 2):
        bx = cx + random.randint(-r * 2 // 3, r * 2 // 3)
        by = cy + random.randint(-r * 2 // 3, r * 2 // 3)
        br = random.randint(r // 4, r * 3 // 4)
        blobs.append((bx, by, br))

    # Shadow layer
    for bx, by, br in blobs:
        draw.ellipse([bx - br, by - br + 3, bx + br, by + br + 3], fill=(*sh, 50))

    # Midtone
    for bx, by, br in blobs:
        draw.ellipse([bx - br, by - br, bx + br, by + br], fill=(*base, 90))

    # Highlights
    for bx, by, br in blobs[:4]:
        hr = br * 2 // 3
        draw.ellipse([bx - hr - 2, by - hr - 2, bx + hr - 2, by + hr - 2], fill=(*hi, 70))

    # Internal wisps
    for _ in range(5):
        wx = cx + random.randint(-r // 3, r // 3)
        wy = cy + random.randint(-r // 3, r // 3)
        wr = random.randint(2, r // 4)
        draw.ellipse([wx - wr, wy - wr, wx + wr, wy + wr], fill=(*sh, 35))

    # Soft edge blur
    img = img.filter(ImageFilter.GaussianBlur(radius=2.5))

    # Brighten center
    overlay = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    od = ImageDraw.Draw(overlay)
    od.ellipse([cx - r // 3, cy - r // 3, cx + r // 3, cy + r // 3], fill=(*hi, 45))
    overlay = overlay.filter(ImageFilter.GaussianBlur(radius=3.0))
    img = Image.alpha_composite(img, overlay)

    return img


def make_ember(w, h, variant=0):
    """Small glowing ember particle for Gouda trail."""
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)
    cx, cy = w // 2, h // 2

    random.seed(950 + variant)

    # Gouda ember palette: warm orange-red glow
    ember_core = (0xFF, 0xCC, 0x44)
    ember_mid = (0xFF, 0x88, 0x22)
    ember_edge = (0xCC, 0x44, 0x11)

    max_r = min(w, h) // 2 - 1

    # Radial gradient glow
    for r in range(max_r, 0, -1):
        t = 1.0 - (r / max_r)
        if t > 0.7:
            c = lerp_color(ember_mid, ember_core, (t - 0.7) / 0.3)
        elif t > 0.3:
            c = lerp_color(ember_edge, ember_mid, (t - 0.3) / 0.4)
        else:
            c = ember_edge
        a = int(40 + 200 * t * t)
        draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=(*c, a))

    # Bright white-hot center
    draw.ellipse([cx - 1, cy - 1, cx + 1, cy + 1], fill=(255, 255, 220, 255))

    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    return img


def build_atlas():
    """Pack all sprites into a 256x256 atlas and generate JSON manifest."""
    atlas = Image.new("RGBA", (ATLAS_W, ATLAS_H), (0, 0, 0, 0))

    frames = {}
    y_cursor = 0

    # --- Row 0: Cheese crumbs (y=0) ---
    crumb_specs = [(16, 16), (24, 24), (12, 12)]
    x = 0
    for i, (w, h) in enumerate(crumb_specs):
        sprite = make_cheese_crumb(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"cheese_crumb_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
    y_cursor += 26  # max cheese crumb height (24) + 2px padding

    # --- Row 1: Dust puffs (y=28 -> y=26 to save space) ---
    x = 0
    for i in range(4):
        w, h = 48, 48
        sprite = make_dust_puff(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"dust_puff_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
    y_cursor += 50  # 48 + 2

    # --- Row 2: Impact sparks (y=76) ---
    x = 0
    for i in range(3):
        w, h = 32, 32
        sprite = make_impact_spark(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"impact_spark_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
    y_cursor += 34  # 32 + 2

    # --- Row 3: Wood splinters (y=110) ---
    x = 0
    splinter_specs = [(24, 8), (32, 6)]
    row_max_h = 0
    for i, (w, h) in enumerate(splinter_specs):
        sprite = make_wood_splinter(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"wood_splinter_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
        row_max_h = max(row_max_h, h)
    y_cursor += row_max_h + 2  # 8 + 2 = 10

    # --- Row 4: Star (y=120) ---
    w, h = 16, 16
    sprite = make_star(w, h)
    atlas.paste(sprite, (0, y_cursor), sprite)
    frames["star_01"] = {
        "frame": {"x": 0, "y": y_cursor, "w": w, "h": h},
        "rotated": False,
        "trimmed": False,
        "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
        "sourceSize": {"w": w, "h": h},
    }
    y_cursor += h + 2  # 18

    # --- Row 5: Stone chips (y=138) ---
    x = 0
    chip_specs = [(16, 16), (20, 20), (12, 12)]
    row_max_h = 0
    for i, (w, h) in enumerate(chip_specs):
        sprite = make_stone_chip(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"stone_chip_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
        row_max_h = max(row_max_h, h)
    y_cursor += row_max_h + 2  # 22

    # --- Row 6: Stone dust (y=160) ---
    x = 0
    for i in range(2):
        w, h = 48, 48
        sprite = make_stone_dust(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"stone_dust_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
    y_cursor += 50

    # --- Row 7: Explosion rings (y=210) ---
    x = 0
    for i in range(3):
        w, h = 48, 48
        sprite = make_explosion_ring(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"explosion_ring_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
    y_cursor += 50  # 48 + 2

    # --- Row 8: Speed blurs (y=260) and cheese fragments ---
    x = 0
    blur_specs = [(48, 16), (64, 16)]
    row_max_h = 0
    for i, (w, h) in enumerate(blur_specs):
        sprite = make_speed_blur(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"speed_blur_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
        row_max_h = max(row_max_h, h)

    # Cheese fragments on same row
    frag_specs = [(16, 16), (16, 16), (12, 12), (14, 14)]
    for i, (w, h) in enumerate(frag_specs):
        sprite = make_cheese_fragment(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"cheese_fragment_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
        row_max_h = max(row_max_h, h)
    y_cursor += row_max_h + 2  # 16 + 2 = 18

    # --- Row 9: Confetti and embers (y=278) ---
    x = 0
    for i in range(4):
        w, h = 12, 12
        sprite = make_confetti(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"confetti_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2

    # Embers
    for i in range(2):
        w, h = 12, 12
        sprite = make_ember(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"ember_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
    y_cursor += 14  # 12 + 2

    # --- Row 10: Enhanced dust clouds (y=292) ---
    x = 0
    cloud_specs = [(64, 64), (48, 48), (32, 32)]
    row_max_h = 0
    for i, (w, h) in enumerate(cloud_specs):
        sprite = make_dust_cloud(w, h, variant=i)
        atlas.paste(sprite, (x, y_cursor), sprite)
        frames[f"dust_cloud_{i+1:02d}"] = {
            "frame": {"x": x, "y": y_cursor, "w": w, "h": h},
            "rotated": False,
            "trimmed": False,
            "spriteSourceSize": {"x": 0, "y": 0, "w": w, "h": h},
            "sourceSize": {"w": w, "h": h},
        }
        x += w + 2
        row_max_h = max(row_max_h, h)
    y_cursor += row_max_h + 2  # 64 + 2 = 66

    print(f"Atlas packed: {ATLAS_W}x{ATLAS_H}, content ends at y={y_cursor}")
    assert y_cursor <= ATLAS_H, f"Atlas overflow: content needs {y_cursor}px but budget is {ATLAS_H}px"

    # Save atlas
    atlas_path = "public/assets/sprites/vfx.png"
    atlas.save(atlas_path, "PNG")
    print(f"Saved {atlas_path}")

    # Generate JSON manifest
    import json

    manifest = {
        "frames": frames,
        "meta": {
            "app": "angry-curds-2",
            "version": "1.0",
            "image": "vfx.png",
            "format": "RGBA8888",
            "size": {"w": ATLAS_W, "h": ATLAS_H},
            "scale": "1",
        },
    }

    json_path = "public/assets/sprites/vfx.json"
    with open(json_path, "w") as f:
        json.dump(manifest, f, indent=2)
    print(f"Saved {json_path}")

    return atlas, frames


if __name__ == "__main__":
    build_atlas()
