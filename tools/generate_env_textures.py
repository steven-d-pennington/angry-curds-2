#!/usr/bin/env python3
"""
Procedural environment texture generator for Angry Curds 2.
Generates rich, hand-painted-style parallax background layers for the cheese cellar.

Usage:
    python3 tools/generate_env_textures.py

Output:
    public/assets/environment/cellar_layer0_wall.png      (2048x1024)
    public/assets/environment/cellar_layer1_shelves.png    (2048x1024)
    public/assets/environment/cellar_layer2_floor.png      (2048x256)
    public/assets/environment/cellar_layer3_beam_01.png    (256x32)
    public/assets/environment/cellar_layer3_pipe_01.png    (48x256)

Art bible references:
    - Stone palette: #A89880 → #7A6B58 → #4A3D30
    - Wood palette:  #B8845A → #8B5E3C → #5C3A1E
    - Moss: #5A8C47
    - Copper: #A87D4E → #D4A862
"""

import math
import os
import random
import struct
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

# ── Constants ────────────────────────────────────────────────────────────────
SEED = 42
OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "environment"

# Color palettes (from art bible)
STONE_LIGHT = (168, 152, 128)   # #A89880
STONE_MID   = (122, 107, 88)    # #7A6B58
STONE_DARK  = (74, 61, 48)      # #4A3D30

WOOD_LIGHT  = (184, 132, 90)    # #B8845A
WOOD_MID    = (139, 94, 60)     # #8B5E3C
WOOD_DARK   = (92, 58, 30)      # #5C3A1E

COPPER      = (168, 125, 78)    # #A87D4E
COPPER_HI   = (212, 168, 98)    # #D4A862

MOSS        = (90, 140, 71)     # #5A8C47
FLAGSTONE   = (107, 93, 79)     # #6B5D4F
MORTAR      = (74, 61, 48)      # #4A3D30

CHEESE_GOLD = (245, 166, 35)    # #F5A623
CHEESE_HI   = (255, 215, 110)   # #FFD76E
CHEESE_RIND = (196, 123, 18)    # #C47B12

LANTERN_GLOW = (255, 215, 110)  # #FFD76E
WARM_HAZE   = (255, 232, 176)   # #FFE8B0

OUTLINE     = (59, 37, 16)      # #3B2510


random.seed(SEED)


# ── Utility functions ────────────────────────────────────────────────────────

def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB(A) tuples."""
    t = max(0.0, min(1.0, t))
    return tuple(int(a + (b - a) * t) for a, b in zip(c1, c2))


def noise_val(x, y, scale=1.0):
    """Simple value noise using sine-based hash. Returns 0..1."""
    n = math.sin(x * 12.9898 * scale + y * 78.233 * scale) * 43758.5453
    return n - math.floor(n)


def fbm(x, y, octaves=4, persistence=0.5, scale=1.0):
    """Fractional Brownian Motion noise. Returns 0..1."""
    val = 0.0
    amp = 1.0
    freq = scale
    max_val = 0.0
    for _ in range(octaves):
        val += noise_val(x * freq, y * freq) * amp
        max_val += amp
        amp *= persistence
        freq *= 2.0
    return val / max_val


def add_texture_noise(img, strength=15, warm_bias=True, block_size=4):
    """Add block-level grain noise to simulate painted texture while keeping PNG compressible."""
    pixels = img.load()
    w, h = img.size
    for by in range(0, h, block_size):
        for bx in range(0, w, block_size):
            n = random.randint(-strength, strength)
            rn = n + (random.randint(0, 3) if warm_bias else 0)
            gn = n + (random.randint(0, 2) if warm_bias else 0)
            for dy in range(min(block_size, h - by)):
                for dx in range(min(block_size, w - bx)):
                    x, y = bx + dx, by + dy
                    p = pixels[x, y]
                    if len(p) == 4:
                        pixels[x, y] = (
                            max(0, min(255, p[0] + rn)),
                            max(0, min(255, p[1] + gn)),
                            max(0, min(255, p[2] + n)),
                            p[3],
                        )
                    else:
                        pixels[x, y] = (
                            max(0, min(255, p[0] + rn)),
                            max(0, min(255, p[1] + gn)),
                            max(0, min(255, p[2] + n)),
                        )


def draw_rounded_rect(draw, bbox, radius, fill, outline_color=None, outline_width=0):
    """Draw a rounded rectangle."""
    x0, y0, x1, y1 = bbox
    r = min(radius, (x1 - x0) // 2, (y1 - y0) // 2)
    draw.rectangle([x0 + r, y0, x1 - r, y1], fill=fill)
    draw.rectangle([x0, y0 + r, x1, y1 - r], fill=fill)
    draw.ellipse([x0, y0, x0 + 2 * r, y0 + 2 * r], fill=fill)
    draw.ellipse([x1 - 2 * r, y0, x1, y0 + 2 * r], fill=fill)
    draw.ellipse([x0, y1 - 2 * r, x0 + 2 * r, y1], fill=fill)
    draw.ellipse([x1 - 2 * r, y1 - 2 * r, x1, y1], fill=fill)
    if outline_color and outline_width:
        draw.rounded_rectangle(bbox, radius=r, outline=outline_color, width=outline_width)


# ── Layer 0: Far stone wall ─────────────────────────────────────────────────

def generate_layer0():
    """
    Far wall: 2048x1024, tileable horizontally.
    Weathered stone blocks with mortar variation, lanterns, cracks, cobwebs.
    Cool-shifted and desaturated for depth.
    """
    W, H = 2048, 1024
    img = Image.new("RGBA", (W, H), STONE_DARK + (255,))
    draw = ImageDraw.Draw(img)

    # ── Background gradient: darker at top (vaulted ceiling), lighter in middle
    for y in range(H):
        t = y / H
        # Ceiling arch darkening
        ceiling_factor = max(0, 1.0 - (t * 3.0)) * 0.3 if t < 0.33 else 0.0
        base = lerp_color(STONE_DARK, STONE_MID, t * 0.7 + 0.15)
        darkened = lerp_color(base, STONE_DARK, ceiling_factor)
        for x in range(W):
            draw.point((x, y), fill=darkened + (255,))

    # ── Draw stone blocks with irregular sizing
    mortar_w = 4
    block_rows = []
    y_pos = 0
    row_idx = 0
    while y_pos < H:
        bh = random.randint(48, 80)
        if y_pos + bh > H:
            bh = H - y_pos
        blocks = []
        x_pos = 0
        # Offset every other row for brick pattern
        if row_idx % 2 == 1:
            x_pos = -random.randint(40, 80)
        while x_pos < W:
            bw = random.randint(80, 160)
            blocks.append((x_pos, y_pos, x_pos + bw, y_pos + bh))
            x_pos += bw + mortar_w
        block_rows.append(blocks)
        y_pos += bh + mortar_w
        row_idx += 1

    # Draw each stone block with block-level variation (not per-pixel) for compressibility
    CELL = 8  # noise grid cell size
    for row in block_rows:
        for bx0, by0, bx1, by1 in row:
            # Per-block base color
            variation = random.uniform(-0.15, 0.15)
            t_base = (by0 / H) * 0.7 + 0.15 + variation
            t_base = max(0, min(1, t_base))
            block_color = lerp_color(STONE_DARK, STONE_LIGHT, t_base)

            # Fill the block with the base color first
            for py in range(max(0, by0), min(H, by1)):
                for px in range(max(0, bx0), min(W, bx1)):
                    # Edge darkening (mortar shadow)
                    dx_edge = min(px - bx0, bx1 - px)
                    dy_edge = min(py - by0, by1 - py)
                    edge_dist = min(dx_edge, dy_edge)
                    if edge_dist < 6:
                        edge_t = (6 - edge_dist) / 6.0
                        color = lerp_color(block_color, MORTAR, edge_t * 0.5)
                    else:
                        # Coarse weathering: sample noise at grid cell centers
                        cx = (px // CELL) * CELL
                        cy = (py // CELL) * CELL
                        n = fbm(cx, cy, octaves=2, scale=0.02)
                        color = lerp_color(block_color, STONE_DARK, n * 0.3)
                    draw.point((px % W, py), fill=color + (255,))

    # ── Mortar lines (already visible as gaps; darken them)
    for y_pos in range(H):
        for x_pos in range(W):
            p = img.getpixel((x_pos, y_pos))
            # mortar is wherever blocks don't cover — the dark background shows through

    # ── Vaulted ceiling arch (darkened upper area with arch shape)
    for x in range(W):
        # Subtle arch darkening at the very top
        arch_height = int(30 + 20 * math.sin(x / W * math.pi * 2))
        for y in range(min(arch_height, H)):
            p = img.getpixel((x, y))
            t = 1.0 - (y / arch_height)
            dark = lerp_color(p[:3], STONE_DARK, t * 0.4)
            draw.point((x, y), fill=dark + (255,))

    # ── Cracks
    for _ in range(8):
        cx = random.randint(0, W)
        cy = random.randint(50, H - 50)
        angle = random.uniform(-0.5, 0.5)
        length = random.randint(30, 120)
        crack_points = [(cx, cy)]
        for i in range(length):
            angle += random.uniform(-0.3, 0.3)
            cx += int(math.cos(angle) * 2)
            cy += int(math.sin(angle) * 2)
            if 0 <= cx < W and 0 <= cy < H:
                crack_points.append((cx, cy))
        for i in range(len(crack_points) - 1):
            draw.line([crack_points[i], crack_points[i + 1]],
                      fill=STONE_DARK + (180,), width=1)
            # Highlight edge on one side
            p0 = crack_points[i]
            draw.point((p0[0], p0[1] - 1),
                        fill=lerp_color(STONE_MID, STONE_LIGHT, 0.3) + (60,))

    # ── Cobwebs in upper corners
    def draw_cobweb(cx, cy, flip_x=False):
        """Draw a simple cobweb radiating from a corner."""
        web_color = (200, 195, 185, 40)
        num_strands = 6
        for i in range(num_strands):
            angle = (math.pi / 2) * (i / (num_strands - 1))
            if flip_x:
                angle = math.pi - angle
            ex = cx + int(math.cos(angle) * random.randint(40, 90))
            ey = cy + int(math.sin(angle) * random.randint(40, 90))
            draw.line([(cx, cy), (ex, ey)], fill=web_color, width=1)
        # Cross strands
        for r in range(20, 80, 20):
            pts = []
            for i in range(num_strands):
                angle = (math.pi / 2) * (i / (num_strands - 1))
                if flip_x:
                    angle = math.pi - angle
                rr = r + random.randint(-5, 5)
                pts.append((cx + int(math.cos(angle) * rr),
                            cy + int(math.sin(angle) * rr)))
            for j in range(len(pts) - 1):
                draw.line([pts[j], pts[j + 1]], fill=web_color, width=1)

    draw_cobweb(10, 10, flip_x=False)
    draw_cobweb(W - 10, 10, flip_x=True)
    draw_cobweb(W // 3, 5, flip_x=False)

    # ── Lanterns / bare bulbs with warm glow halos
    lantern_positions = [
        (W // 5, 60),
        (W // 2, 45),
        (int(W * 0.78), 55),
    ]

    for lx, ly in lantern_positions:
        # Wire from ceiling
        draw.line([(lx, 0), (lx, ly - 15)], fill=STONE_DARK + (200,), width=2)

        # Bulb shape (small rounded rectangle)
        bulb_w, bulb_h = 10, 16
        draw.ellipse([lx - bulb_w // 2, ly - bulb_h // 2,
                       lx + bulb_w // 2, ly + bulb_h // 2],
                      fill=(255, 230, 160, 240))
        # Filament line
        draw.line([(lx, ly - 4), (lx, ly + 4)], fill=(255, 200, 100, 200), width=1)

        # Warm glow halo (additive-style using alpha compositing)
        glow = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        for radius in range(200, 10, -5):
            alpha = int(15 * (1.0 - radius / 200.0))
            glow_draw.ellipse([lx - radius, ly - radius, lx + radius, ly + radius],
                               fill=LANTERN_GLOW + (alpha,))
        img = Image.alpha_composite(img, glow)
        draw = ImageDraw.Draw(img)

        # Light pool on wall behind
        pool = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        pool_draw = ImageDraw.Draw(pool)
        for radius in range(120, 20, -3):
            alpha = int(12 * (1.0 - radius / 120.0))
            pool_draw.ellipse([lx - radius, ly + 20 - radius // 2,
                                lx + radius, ly + 20 + radius // 2],
                               fill=LANTERN_GLOW + (alpha,))
        img = Image.alpha_composite(img, pool)
        draw = ImageDraw.Draw(img)

    # ── Cool-shift and desaturate for depth (Layer 0 is furthest back)
    pixels = img.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = pixels[x, y]
            # Desaturate to 60%
            gray = int(0.299 * r + 0.587 * g + 0.114 * b)
            r = int(gray + (r - gray) * 0.6)
            g = int(gray + (g - gray) * 0.6)
            b = int(gray + (b - gray) * 0.6)
            # Cool shift (slight blue push)
            b = min(255, b + 8)
            r = max(0, r - 5)
            pixels[x, y] = (r, g, b, a)

    # ── Subtle painted texture grain
    add_texture_noise(img, strength=8)

    # Soft blur to unify the hand-painted feel
    img = img.filter(ImageFilter.GaussianBlur(radius=0.8))

    return img


# ── Layer 1: Shelves with props ──────────────────────────────────────────────

def generate_layer1():
    """
    Shelves layer: 2048x1024.
    Wooden shelving with visible grain, props on shelves.
    Upper 70% of viewport (bottom 30% is transparent for floor to show).
    """
    W, H = 2048, 1024
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    visible_h = int(H * 0.72)  # Shelves occupy upper ~70%

    # ── Draw 3 shelf units across the width
    shelf_unit_width = W // 3
    shelf_height = 12  # thickness of shelf plank
    num_shelves = 3  # shelves per unit

    for unit in range(3):
        ux = unit * shelf_unit_width + random.randint(-20, 20)

        # Vertical posts
        post_width = 18
        CELL = 8
        for post_x_offset in [30, shelf_unit_width - 50]:
            px = ux + post_x_offset
            # Wood grain on posts (sampled at grid level for compressibility)
            for py_cell in range(10, visible_h, CELL):
                grain_n = fbm(px, py_cell, octaves=2, scale=0.08)
                color = lerp_color(WOOD_DARK, WOOD_MID, grain_n)
                vgrain = math.sin(px * 0.5 + grain_n * 3) * 0.15
                color = lerp_color(color, WOOD_LIGHT, max(0, vgrain))
                for py in range(py_cell, min(py_cell + CELL, visible_h)):
                    for dx in range(post_width):
                        edge_t = 0
                        if dx < 3:
                            edge_t = (3 - dx) / 3.0 * 0.3
                        elif dx > post_width - 3:
                            edge_t = (dx - (post_width - 3)) / 3.0 * 0.2
                        final = lerp_color(color, WOOD_LIGHT, edge_t) if edge_t > 0 else color
                        if px + dx < W:
                            draw.point((px + dx, py), fill=final + (230,))

            # Bracket at shelf intersections
            for shelf_i in range(num_shelves):
                sy = 40 + shelf_i * (visible_h - 60) // num_shelves
                # Small L-bracket
                bracket_color = COPPER + (200,)
                draw.rectangle([px + 2, sy - 3, px + post_width - 2, sy + 3], fill=bracket_color)
                draw.rectangle([px + post_width - 2, sy - 10, px + post_width + 4, sy + 3],
                               fill=bracket_color)

        # Horizontal shelves
        for shelf_i in range(num_shelves):
            sy = 40 + shelf_i * (visible_h - 60) // num_shelves
            sx0 = ux + 25
            sx1 = ux + shelf_unit_width - 40

            # Shelf plank with wood grain
            for py in range(sy, sy + shelf_height):
                for px in range(max(0, sx0), min(W, sx1)):
                    grain = fbm(px, py * 3, octaves=3, scale=0.03)
                    color = lerp_color(WOOD_MID, WOOD_LIGHT, grain * 0.8)
                    # Top highlight
                    if py == sy:
                        color = lerp_color(color, WOOD_LIGHT, 0.4)
                    # Bottom shadow
                    if py == sy + shelf_height - 1:
                        color = lerp_color(color, WOOD_DARK, 0.5)
                    draw.point((px, py), fill=color + (240,))

            # Shadow under shelf (soft)
            for py in range(sy + shelf_height, sy + shelf_height + 15):
                shadow_alpha = int(40 * (1.0 - (py - sy - shelf_height) / 15.0))
                for px in range(max(0, sx0), min(W, sx1)):
                    draw.point((px, py), fill=WOOD_DARK + (shadow_alpha,))

            # ── Props on shelf (between posts)
            prop_zone_start = sx0 + 35
            prop_zone_end = sx1 - 35
            prop_x = prop_zone_start

            while prop_x < prop_zone_end - 40:
                prop_type = random.choice(["cheese_wheel", "cheese_wheel",
                                           "wine_bottle", "jar", "garlic",
                                           "copper_pot", "gap"])
                if prop_type == "gap":
                    prop_x += random.randint(20, 60)
                    continue

                item_bottom = sy - 2  # items sit on the shelf

                if prop_type == "cheese_wheel":
                    cw_w = random.randint(35, 55)
                    cw_h = random.randint(22, 32)
                    cx, cy_center = prop_x + cw_w // 2, item_bottom - cw_h // 2
                    # Cheese wheel (ellipse)
                    draw.ellipse([prop_x, item_bottom - cw_h,
                                  prop_x + cw_w, item_bottom],
                                 fill=CHEESE_GOLD + (220,),
                                 outline=CHEESE_RIND + (200,), width=2)
                    # Wax rind highlight arc
                    draw.arc([prop_x + 3, item_bottom - cw_h + 3,
                              prop_x + cw_w - 3, item_bottom - 3],
                             start=200, end=340,
                             fill=CHEESE_HI + (120,), width=2)
                    # Rind detail
                    draw.arc([prop_x + 1, item_bottom - cw_h + 1,
                              prop_x + cw_w - 1, item_bottom - 1],
                             start=30, end=150,
                             fill=CHEESE_RIND + (150,), width=2)
                    prop_x += cw_w + random.randint(8, 20)

                elif prop_type == "wine_bottle":
                    bh = random.randint(40, 55)
                    bw = 14
                    bx = prop_x
                    by_top = item_bottom - bh
                    # Bottle body (dark glass)
                    bottle_color = (45, 60, 35, 220)
                    draw.rectangle([bx, item_bottom - bh // 2, bx + bw, item_bottom],
                                   fill=bottle_color)
                    # Neck
                    neck_w = 6
                    draw.rectangle([bx + (bw - neck_w) // 2, by_top,
                                    bx + (bw + neck_w) // 2, item_bottom - bh // 2 + 3],
                                   fill=bottle_color)
                    # Cork
                    draw.rectangle([bx + (bw - 4) // 2, by_top - 4,
                                    bx + (bw + 4) // 2, by_top],
                                   fill=(180, 160, 130, 200))
                    # Glass highlight
                    draw.line([(bx + 3, item_bottom - bh // 2 + 5),
                               (bx + 3, item_bottom - 5)],
                              fill=(120, 160, 110, 80), width=1)
                    prop_x += bw + random.randint(10, 25)

                elif prop_type == "jar":
                    jw = random.randint(18, 26)
                    jh = random.randint(25, 35)
                    jx = prop_x
                    # Glass jar
                    jar_color = (180, 200, 190, 140)
                    draw.rectangle([jx, item_bottom - jh, jx + jw, item_bottom],
                                   fill=jar_color, outline=(160, 180, 170, 100), width=1)
                    # Lid
                    draw.rectangle([jx - 1, item_bottom - jh - 4, jx + jw + 1, item_bottom - jh],
                                   fill=COPPER + (200,))
                    # Contents suggestion
                    content_color = random.choice([
                        (200, 180, 100, 100),  # mustard
                        (180, 60, 40, 100),    # jam
                        (220, 200, 150, 100),  # pickled
                    ])
                    draw.rectangle([jx + 2, item_bottom - jh // 2, jx + jw - 2, item_bottom - 2],
                                   fill=content_color)
                    prop_x += jw + random.randint(10, 25)

                elif prop_type == "garlic":
                    gw = 20
                    gx = prop_x
                    # Hanging garlic braid
                    rope_color = (160, 140, 100, 180)
                    draw.line([(gx + gw // 2, item_bottom - 45),
                               (gx + gw // 2, item_bottom - 30)],
                              fill=rope_color, width=2)
                    # Garlic bulbs (3 small circles)
                    for gi in range(3):
                        gy = item_bottom - 28 + gi * 10
                        draw.ellipse([gx + 4, gy, gx + gw - 4, gy + 12],
                                     fill=(240, 235, 220, 220),
                                     outline=(200, 195, 180, 150), width=1)
                    prop_x += gw + random.randint(10, 25)

                elif prop_type == "copper_pot":
                    pw = random.randint(25, 35)
                    ph = random.randint(20, 28)
                    px_pos = prop_x
                    # Pot body
                    draw.ellipse([px_pos, item_bottom - ph, px_pos + pw, item_bottom],
                                 fill=COPPER + (210,))
                    # Rim highlight
                    draw.arc([px_pos, item_bottom - ph, px_pos + pw, item_bottom - ph + 8],
                             start=180, end=360, fill=COPPER_HI + (180,), width=2)
                    # Handle
                    draw.arc([px_pos + pw // 2 - 8, item_bottom - ph - 10,
                              px_pos + pw // 2 + 8, item_bottom - ph + 5],
                             start=180, end=360, fill=COPPER + (180,), width=2)
                    # Patina spots
                    for _ in range(3):
                        spot_x = px_pos + random.randint(5, pw - 5)
                        spot_y = item_bottom - random.randint(5, ph - 5)
                        draw.ellipse([spot_x - 2, spot_y - 2, spot_x + 2, spot_y + 2],
                                     fill=(102, 136, 85, 60))
                    prop_x += pw + random.randint(10, 25)

    # ── Add subtle texture grain
    add_texture_noise(img, strength=6)

    # Slight blur for painted feel
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

    return img


# ── Layer 2: Flagstone floor ─────────────────────────────────────────────────

def generate_layer2():
    """
    Floor layer: 2048x256, tileable horizontally.
    Flagstone tiles with mortar lines, crumbs, moss.
    """
    W, H = 2048, 256
    img = Image.new("RGBA", (W, H), MORTAR + (255,))
    draw = ImageDraw.Draw(img)

    # ── Generate irregular flagstone tiles
    tile_rows = []
    y_pos = 4
    row_i = 0
    while y_pos < H - 4:
        th = random.randint(35, 60)
        if y_pos + th > H - 4:
            th = H - 4 - y_pos
        tiles = []
        x_pos = 4
        # Offset alternate rows
        if row_i % 2 == 1:
            x_pos -= random.randint(20, 50)
        while x_pos < W:
            tw = random.randint(60, 130)
            tiles.append((x_pos, y_pos, x_pos + tw, y_pos + th))
            x_pos += tw + random.randint(3, 6)  # mortar gap
        tile_rows.append(tiles)
        y_pos += th + random.randint(3, 5)  # mortar gap
        row_i += 1

    # Draw each tile with block-level noise for compressibility
    CELL = 8
    for row in tile_rows:
        for tx0, ty0, tx1, ty1 in row:
            # Per-tile color variation
            variation = random.uniform(-0.2, 0.2)
            t = 0.5 + variation
            tile_color = lerp_color(MORTAR, FLAGSTONE, max(0, min(1, t + 0.3)))

            for py in range(max(0, ty0), min(H, ty1)):
                for px in range(max(0, tx0 % W), min(W, tx1)):
                    # Edge darkening for mortar shadow
                    dx = min(px - tx0, tx1 - px)
                    dy = min(py - ty0, ty1 - py)
                    edge_dist = min(max(0, dx), max(0, dy))
                    if edge_dist < 4:
                        edge_t = (4 - edge_dist) / 4.0
                        color = lerp_color(tile_color, MORTAR, edge_t * 0.6)
                    else:
                        # Coarse surface variation
                        cx = (px // CELL) * CELL
                        cy = (py // CELL) * CELL
                        n = fbm(cx, cy, octaves=2, scale=0.05)
                        color = lerp_color(tile_color, lerp_color(FLAGSTONE, STONE_LIGHT, 0.3), n * 0.4)
                    draw.point((px % W, py), fill=color + (255,))

    # ── Moss between flagstones
    for _ in range(20):
        mx = random.randint(0, W)
        my = random.randint(0, H)
        # Only place on mortar (dark areas)
        p = img.getpixel((mx % W, my % H))
        brightness = (p[0] + p[1] + p[2]) / 3
        if brightness < 80:
            moss_size = random.randint(3, 10)
            for dx in range(-moss_size, moss_size):
                for dy in range(-moss_size, moss_size):
                    if dx * dx + dy * dy < moss_size * moss_size:
                        px = (mx + dx) % W
                        py = max(0, min(H - 1, my + dy))
                        alpha = int(120 * (1.0 - math.sqrt(dx * dx + dy * dy) / moss_size))
                        moss_var = lerp_color(MOSS, (70, 120, 50), random.random() * 0.3)
                        draw.point((px, py), fill=moss_var + (alpha,))

    # ── Scattered crumbs
    for _ in range(30):
        cx = random.randint(0, W)
        cy = random.randint(0, H)
        crumb_color = random.choice([
            CHEESE_GOLD + (150,),
            WOOD_LIGHT + (120,),
            STONE_MID + (100,),
        ])
        size = random.randint(1, 3)
        draw.ellipse([cx - size, cy - size, cx + size, cy + size], fill=crumb_color)

    # ── Warm-shift for depth proximity
    pixels = img.load()
    for y in range(H):
        for x in range(W):
            r, g, b, a = pixels[x, y]
            r = min(255, r + 5)
            g = min(255, g + 2)
            pixels[x, y] = (r, g, b, a)

    add_texture_noise(img, strength=6)
    img = img.filter(ImageFilter.GaussianBlur(radius=0.5))

    return img


# ── Layer 3: Beam ────────────────────────────────────────────────────────────

def generate_layer3_beam():
    """
    Foreground beam: 256x32.
    Wood grain detail with warm-brown painted style.
    """
    W, H = 256, 32
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Wood beam with grain
    for y in range(2, H - 2):
        for x in range(W):
            # Horizontal wood grain
            grain = fbm(x, y * 4, octaves=3, scale=0.04)
            grain2 = math.sin(x * 0.05 + grain * 5) * 0.5 + 0.5

            t = grain * 0.5 + grain2 * 0.3
            color = lerp_color(WOOD_DARK, WOOD_LIGHT, t)

            # Top highlight
            if y < 5:
                ht = (5 - y) / 5.0
                color = lerp_color(color, WOOD_LIGHT, ht * 0.5)
            # Bottom shadow
            if y > H - 6:
                st = (y - (H - 6)) / 5.0
                color = lerp_color(color, WOOD_DARK, st * 0.6)
            # Rounded ends
            if x < 4:
                alpha_t = x / 4.0
                color = lerp_color(WOOD_DARK, color, alpha_t)
            if x > W - 5:
                alpha_t = (W - 1 - x) / 4.0
                color = lerp_color(WOOD_DARK, color, alpha_t)

            draw.point((x, y), fill=color + (230,))

    # Knot detail
    for kx in [80, 180]:
        ky = H // 2
        for dy in range(-4, 5):
            for dx in range(-5, 6):
                if dx * dx + dy * dy < 20:
                    px = kx + dx
                    py = ky + dy
                    if 0 <= px < W and 0 <= py < H:
                        t = math.sqrt(dx * dx + dy * dy) / 5.0
                        knot_c = lerp_color(WOOD_DARK, WOOD_MID, t)
                        draw.point((px, py), fill=knot_c + (220,))

    # Nail heads at ends
    for nx in [12, W - 14]:
        ny = H // 2
        draw.ellipse([nx - 2, ny - 2, nx + 2, ny + 2],
                     fill=(100, 100, 110, 200))
        draw.point((nx, ny - 1), fill=(140, 140, 150, 180))

    # Optional hanging rope from beam
    rope_x = W // 3
    rope_color = (140, 120, 80, 180)
    draw.line([(rope_x, H - 2), (rope_x, H + 20)],
              fill=rope_color, width=2)
    # Small hook at end
    draw.arc([rope_x - 3, H + 16, rope_x + 5, H + 24],
             start=0, end=180, fill=COPPER + (180,), width=2)

    add_texture_noise(img, strength=5)

    return img


# ── Layer 3: Pipe ────────────────────────────────────────────────────────────

def generate_layer3_pipe():
    """
    Foreground pipe: 48x256.
    Copper pipe with patina and detail.
    """
    W, H = 48, 256
    img = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    pipe_left = 10
    pipe_right = 38
    pipe_w = pipe_right - pipe_left

    for y in range(H):
        for x in range(pipe_left, pipe_right):
            # Cylindrical shading
            t_across = (x - pipe_left) / pipe_w  # 0 to 1 across pipe
            # Cosine falloff for cylindrical look
            shade = math.cos((t_across - 0.35) * math.pi)
            shade = max(0, min(1, shade * 0.5 + 0.5))

            color = lerp_color(WOOD_DARK, COPPER_HI, shade)

            # Vertical texture variation
            v_noise = fbm(x, y, octaves=2, scale=0.03)
            color = lerp_color(color, COPPER, v_noise * 0.3)

            draw.point((x, y), fill=color + (220,))

    # Pipe joints/rings every ~60px
    for jy in range(30, H, 60):
        for y in range(jy, min(jy + 6, H)):
            for x in range(pipe_left - 2, pipe_right + 2):
                t_across = (x - pipe_left + 2) / (pipe_w + 4)
                shade = math.cos((t_across - 0.35) * math.pi)
                shade = max(0, min(1, shade * 0.5 + 0.5))
                ring_color = lerp_color(WOOD_DARK, COPPER_HI, shade * 1.1)
                # Highlight ring top
                if y == jy:
                    ring_color = lerp_color(ring_color, COPPER_HI, 0.4)
                draw.point((x, y), fill=ring_color + (240,))

    # Verdigris (green patina) in spots
    for _ in range(8):
        px = random.randint(pipe_left + 2, pipe_right - 2)
        py = random.randint(10, H - 10)
        patina_color = (102, 136, 85)
        for dx in range(-3, 4):
            for dy in range(-3, 4):
                if dx * dx + dy * dy < 10:
                    ppx = px + dx
                    ppy = py + dy
                    if pipe_left <= ppx < pipe_right and 0 <= ppy < H:
                        alpha = int(80 * (1.0 - math.sqrt(dx * dx + dy * dy) / 4.0))
                        draw.point((ppx, ppy), fill=patina_color + (alpha,))

    # Rivet details at joints
    for jy in range(30, H, 60):
        for rx in [pipe_left + 3, pipe_right - 5]:
            draw.ellipse([rx, jy + 1, rx + 3, jy + 4],
                         fill=COPPER + (200,))
            draw.point((rx + 1, jy + 1), fill=COPPER_HI + (180,))

    # Hanging ladle from pipe
    ladle_y = H // 2
    ladle_x = pipe_right + 2
    # Hook
    draw.arc([ladle_x - 4, ladle_y - 6, ladle_x + 4, ladle_y + 6],
             start=270, end=90, fill=COPPER + (180,), width=2)
    # Handle
    draw.line([(ladle_x + 3, ladle_y + 4), (ladle_x + 3, ladle_y + 30)],
              fill=WOOD_MID + (180,), width=2)
    # Bowl
    draw.arc([ladle_x - 4, ladle_y + 26, ladle_x + 10, ladle_y + 40],
             start=0, end=180, fill=COPPER + (180,), width=2)

    add_texture_noise(img, strength=4)

    return img


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    generators = [
        ("cellar_layer0_wall.png", generate_layer0, "Layer 0 (Far Wall)"),
        ("cellar_layer1_shelves.png", generate_layer1, "Layer 1 (Shelves)"),
        ("cellar_layer2_floor.png", generate_layer2, "Layer 2 (Floor)"),
        ("cellar_layer3_beam_01.png", generate_layer3_beam, "Layer 3 (Beam)"),
        ("cellar_layer3_pipe_01.png", generate_layer3_pipe, "Layer 3 (Pipe)"),
    ]

    for filename, gen_func, label in generators:
        print(f"Generating {label}...")
        img = gen_func()
        out_path = OUT_DIR / filename

        # Check if image has meaningful alpha (non-opaque pixels)
        has_alpha = False
        if img.mode == "RGBA":
            extrema = img.getextrema()
            if len(extrema) == 4:
                alpha_min = extrema[3][0]
                has_alpha = alpha_min < 250

        if has_alpha:
            # For images with transparency, quantize with FASTOCTREE (supports RGBA)
            quantized = img.quantize(colors=192, method=Image.Quantize.FASTOCTREE)
            quantized.save(str(out_path), "PNG", optimize=True)
        else:
            # For opaque images, convert to RGB then quantize to PNG-8
            rgb = img.convert("RGB")
            quantized = rgb.quantize(colors=192, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG)
            quantized.save(str(out_path), "PNG", optimize=True)

        file_size = os.path.getsize(out_path)
        print(f"  -> {out_path.name}: {img.size[0]}x{img.size[1]}, {file_size:,} bytes ({file_size / 1024:.1f} KB)")

    # Report total
    total = sum(os.path.getsize(OUT_DIR / f) for f, _, _ in generators)
    print(f"\nTotal environment assets: {total:,} bytes ({total / 1024:.1f} KB)")
    print("Target budget: 200-400 KB")


if __name__ == "__main__":
    main()
