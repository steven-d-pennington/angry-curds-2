#!/usr/bin/env python3
"""
Generate new cheese character sprites (Gouda, Swiss, Parmesan) for Angry Curds 2.
DON-126: Adds three new cheese types to the characters atlas.

Each cheese type gets 7 frames at 128x128:
  - idle_01, idle_02: loaded in slingshot
  - aiming_01, aiming_02: during aim
  - flying: in flight
  - ability: during ability activation
  - settled: after landing

Art bible: three-tone painted shading, warm brown outlines (#3B2510),
directional lighting from top-left at 45 degrees.

Character designs:
  - Gouda: deep orange-red wheel (round), bold/heavy, glow when ability-ready
  - Swiss: pale yellow with holes, elongated/aerodynamic, green speed aura
  - Parmesan: hard wedge, golden-brown, crystalline texture
"""

import json
import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

random.seed(42)
np.random.seed(42)

ROOT = Path(__file__).resolve().parent.parent
SPRITES = ROOT / "public" / "assets" / "sprites"

# --- Art bible color palettes ---
OUTLINE = (0x3B, 0x25, 0x10)

GOUDA = {
    "highlight": (0xFF, 0x8C, 0x42),  # warm orange highlight
    "base": (0xD4, 0x5A, 0x1A),       # deep orange-red
    "shadow": (0x9A, 0x38, 0x0E),     # dark orange-red
    "rind": (0x7A, 0x2A, 0x08),       # dark rind
    "wax": (0xCC, 0x22, 0x22),        # red wax coating
    "cream": (0xFF, 0xE8, 0xC0),      # interior cream
    "glow": (0xFF, 0xAA, 0x33),       # ability glow
    "rim": (0xFF, 0xC8, 0x80),        # rim light
}

SWISS = {
    "highlight": (0xFF, 0xF4, 0xB0),  # pale yellow highlight
    "base": (0xF0, 0xE0, 0x80),       # pale yellow
    "shadow": (0xC8, 0xB8, 0x58),     # darker yellow
    "rind": (0xA0, 0x90, 0x40),       # rind
    "hole_light": (0xD0, 0xC0, 0x60), # hole interior
    "hole_dark": (0x90, 0x80, 0x38),  # hole shadow
    "cream": (0xFF, 0xFA, 0xE0),      # interior
    "speed": (0x66, 0xCC, 0x55),      # green speed aura
    "rim": (0xFF, 0xFA, 0xD0),        # rim light
}

PARMESAN = {
    "highlight": (0xFF, 0xE0, 0x90),  # golden highlight
    "base": (0xD4, 0xB0, 0x60),       # golden-brown
    "shadow": (0xA0, 0x80, 0x3A),     # dark golden
    "rind": (0x80, 0x60, 0x28),       # dark rind
    "crystal": (0xFF, 0xF0, 0xCC),    # crystalline sparkle
    "grain": (0xB8, 0x98, 0x50),      # grain texture
    "cream": (0xFF, 0xF4, 0xD0),      # pale interior
    "rim": (0xFF, 0xE8, 0xB0),        # rim light
}


def lerp_color(c1, c2, t):
    """Linearly interpolate between two RGB tuples."""
    t = max(0.0, min(1.0, t))
    return tuple(int(c1[i] + (c2[i] - c1[i]) * t) for i in range(3))


def light_factor(x, y, w, h):
    """Compute directional light factor (top-left at 45 degrees)."""
    nx = (x / w) * 2.0 - 1.0
    ny = (y / h) * 2.0 - 1.0
    dot = -(-0.707 * nx + -0.707 * ny)
    factor = (dot + 1.0) * 0.5
    return max(0.0, min(1.0, factor ** 0.8))


def add_painted_finish(img, blur_radius=0.8, noise_strength=8):
    """Apply painted finish: subtle blur blend + noise grain."""
    blurred = img.filter(ImageFilter.GaussianBlur(radius=blur_radius))
    result = Image.blend(img, blurred, 0.2)
    # Add noise grain
    pixels = result.load()
    w, h = result.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = pixels[x, y]
            if a < 10:
                continue
            n = random.randint(-noise_strength, noise_strength)
            pixels[x, y] = (
                max(0, min(255, r + n)),
                max(0, min(255, g + n)),
                max(0, min(255, b + n)),
                a,
            )
    return result


def draw_eyes(draw, cx, cy, expression, eye_spacing=14, palette=None):
    """Draw expressive eyes common to all cheese characters."""
    eye_y = cy - 4
    left_x = cx - eye_spacing
    right_x = cx + eye_spacing
    outline = OUTLINE

    if expression == "happy":
        for ex in [left_x, right_x]:
            draw.ellipse([ex - 6, eye_y - 7, ex + 6, eye_y + 7], fill=(*palette["cream"], 255))
            draw.ellipse([ex - 3, eye_y - 3, ex + 3, eye_y + 3], fill=(*outline, 255))
            draw.ellipse([ex - 4, eye_y - 4, ex - 1, eye_y - 1], fill=(255, 255, 255, 230))
    elif expression == "happy2":
        for ex in [left_x, right_x]:
            draw.ellipse([ex - 6, eye_y - 6, ex + 6, eye_y + 6], fill=(*palette["cream"], 255))
            # Slightly different pupil position
            draw.ellipse([ex - 2, eye_y - 3, ex + 4, eye_y + 3], fill=(*outline, 255))
            draw.ellipse([ex - 3, eye_y - 4, ex, eye_y - 1], fill=(255, 255, 255, 230))
    elif expression == "nervous":
        for ex in [left_x, right_x]:
            draw.ellipse([ex - 8, eye_y - 7, ex + 8, eye_y + 7], fill=(*palette["cream"], 255))
            draw.ellipse([ex - 3, eye_y - 3, ex + 3, eye_y + 3], fill=(*outline, 255))
            draw.ellipse([ex - 4, eye_y - 4, ex - 1, eye_y - 1], fill=(255, 255, 255, 240))
    elif expression == "nervous2":
        for ex in [left_x, right_x]:
            draw.ellipse([ex - 8, eye_y - 7, ex + 8, eye_y + 7], fill=(*palette["cream"], 255))
            draw.ellipse([ex - 2, eye_y - 2, ex + 4, eye_y + 4], fill=(*outline, 255))
            draw.ellipse([ex - 3, eye_y - 3, ex, eye_y], fill=(255, 255, 255, 230))
    elif expression == "scared":
        for ex in [left_x, right_x]:
            draw.ellipse([ex - 7, eye_y - 8, ex + 7, eye_y + 6], fill=(*palette["cream"], 255))
            draw.ellipse([ex - 3, eye_y - 2, ex + 3, eye_y + 4], fill=(*outline, 255))
            draw.ellipse([ex - 4, eye_y - 3, ex - 1, eye_y], fill=(255, 255, 255, 240))
    elif expression == "fierce":
        for ex in [left_x, right_x]:
            draw.ellipse([ex - 7, eye_y - 6, ex + 7, eye_y + 6], fill=(*palette["cream"], 255))
            draw.ellipse([ex - 4, eye_y - 3, ex + 4, eye_y + 3], fill=(*outline, 255))
            draw.ellipse([ex - 5, eye_y - 5, ex - 2, eye_y - 2], fill=(255, 255, 255, 240))
            # Angry brow line
            side = -1 if ex < cx else 1
            draw.line([(ex - 7, eye_y - 8 + side * 2), (ex + 7, eye_y - 8 - side * 2)],
                      fill=(*outline, 255), width=2)
    elif expression == "dizzy":
        for ex in [left_x, right_x]:
            draw.arc([ex - 6, eye_y - 6, ex + 6, eye_y + 6], 0, 360, fill=(*outline, 255), width=2)
            draw.arc([ex - 3, eye_y - 3, ex + 3, eye_y + 3], 0, 360, fill=(*outline, 255), width=1)


def draw_mouth(draw, cx, cy, expression):
    """Draw mouth for cheese characters."""
    mouth_y = cy + 10

    if expression in ("happy", "happy2"):
        # Smile
        for dx in range(-8, 9):
            curve = round(2 * math.sin((dx + 8) / 16 * math.pi))
            draw.point((cx + dx, mouth_y + curve), fill=(*OUTLINE, 255))
            draw.point((cx + dx, mouth_y + curve + 1), fill=(*OUTLINE, 255))
    elif expression in ("nervous", "nervous2"):
        # Worried open mouth
        draw.ellipse([cx - 7, mouth_y - 1, cx + 7, mouth_y + 5], fill=(*OUTLINE, 255))
        draw.ellipse([cx - 4, mouth_y, cx + 4, mouth_y + 3], fill=(0x8B, 0x5A, 0x0B, 200))
    elif expression == "scared":
        # Wide open scream
        draw.ellipse([cx - 8, mouth_y - 2, cx + 8, mouth_y + 8], fill=(*OUTLINE, 255))
        draw.ellipse([cx - 5, mouth_y - 1, cx + 5, mouth_y + 5], fill=(0x8B, 0x5A, 0x0B, 220))
    elif expression == "fierce":
        # Determined grin
        for dx in range(-8, 9):
            curve = round(3 * math.sin((dx + 8) / 16 * math.pi))
            draw.point((cx + dx, mouth_y + curve), fill=(*OUTLINE, 255))
            draw.point((cx + dx, mouth_y + curve + 1), fill=(*OUTLINE, 255))
        # Teeth glint
        draw.rectangle([cx - 3, mouth_y + 1, cx + 3, mouth_y + 3], fill=(255, 255, 255, 180))
    elif expression == "dizzy":
        # Tongue out
        draw.ellipse([cx - 6, mouth_y, cx + 6, mouth_y + 5], fill=(*OUTLINE, 255))
        draw.ellipse([cx - 3, mouth_y + 4, cx + 3, mouth_y + 10], fill=(0xE0, 0x60, 0x60, 220))


# ─── Gouda: Round wheel shape ─────────────────────────────────────────

def draw_gouda_base(img, ox, oy):
    """Draw Gouda's round wheel body with wax coating details."""
    draw = ImageDraw.Draw(img)
    cx, cy = ox + 64, oy + 60
    radius = 38

    # Body: filled circle with directional shading
    for y in range(cy - radius, cy + radius + 1):
        for x in range(cx - radius, cx + radius + 1):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius:
                lf = light_factor(x - ox, y - oy, 128, 128)
                # Edge darkening
                edge_t = dist / radius
                if lf > 0.6:
                    t = (lf - 0.6) / 0.4
                    color = lerp_color(GOUDA["base"], GOUDA["highlight"], t * 0.7)
                elif lf < 0.35:
                    t = (0.35 - lf) / 0.35
                    color = lerp_color(GOUDA["base"], GOUDA["shadow"], t * 0.75)
                else:
                    color = GOUDA["base"]
                # Darken toward edges for roundness
                color = lerp_color(color, GOUDA["shadow"], edge_t * edge_t * 0.4)
                img.putpixel((x, y), (*color, 255))

    # Wax coating band (top half, red tint)
    for y in range(cy - radius, cy - 5):
        for x in range(cx - radius, cx + radius + 1):
            dx = x - cx
            dy = y - cy
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= radius - 3 and dist >= radius - 12:
                existing = img.getpixel((x, y))[:3]
                wax = lerp_color(existing, GOUDA["wax"], 0.3)
                img.putpixel((x, y), (*wax, 255))

    # Rind band at bottom
    for y in range(cy + radius - 6, cy + radius):
        for x in range(cx - radius, cx + radius + 1):
            dx = x - cx
            dy = y - cy
            if math.sqrt(dx * dx + dy * dy) <= radius:
                existing = img.getpixel((x, y))[:3]
                rind = lerp_color(existing, GOUDA["rind"], 0.5)
                img.putpixel((x, y), (*rind, 255))

    # Cream cross-section (left side, visible cut face)
    for y in range(cy - 15, cy + 15):
        for dx in range(0, 5):
            x = cx - radius + 4 + dx
            dy = y - cy
            if math.sqrt((x - cx) ** 2 + dy * dy) <= radius - 2:
                a = int(160 * (1 - dx / 5))
                existing = img.getpixel((x, y))[:3]
                cream = lerp_color(existing, GOUDA["cream"], a / 255)
                img.putpixel((x, y), (*cream, 255))

    # Warm brown outline
    draw.ellipse([cx - radius - 1, cy - radius - 1, cx + radius + 1, cy + radius + 1],
                 outline=(*OUTLINE, 255), width=3)

    return cx, cy


def draw_gouda_frame(expression="happy", with_glow=False):
    """Generate a single Gouda frame."""
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = draw_gouda_base(img, 0, 0)

    # Ability glow ring
    if with_glow:
        glow = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        for r in range(48, 38, -1):
            t = (48 - r) / 10
            a = int(60 * t)
            gd.ellipse([cx - r, cy - r, cx + r, cy + r],
                       outline=(*GOUDA["glow"], a), width=2)
        glow = glow.filter(ImageFilter.GaussianBlur(radius=2.0))
        img = Image.alpha_composite(img, glow)
        draw = ImageDraw.Draw(img)

    draw_eyes(draw, cx, cy, expression, eye_spacing=12, palette=GOUDA)
    draw_mouth(draw, cx, cy, expression)

    # Rim light on top-left edge
    for angle in range(180, 300):
        rad = math.radians(angle)
        x = int(cx + 38 * math.cos(rad))
        y = int(cy + 38 * math.sin(rad))
        if 0 <= x < 128 and 0 <= y < 128:
            existing = img.getpixel((x, y))
            if existing[3] > 10:
                rim = lerp_color(existing[:3], GOUDA["rim"], 0.35)
                img.putpixel((x, y), (*rim, existing[3]))

    return add_painted_finish(img)


# ─── Swiss: Elongated aerodynamic shape ────────────────────────────────

def draw_swiss_base(img, ox, oy):
    """Draw Swiss cheese's elongated body with signature holes."""
    draw = ImageDraw.Draw(img)
    cx, cy = ox + 64, oy + 60

    # Elongated horizontal ellipse
    rx, ry = 44, 32

    # Body fill with directional shading
    for y in range(cy - ry, cy + ry + 1):
        for x in range(cx - rx, cx + rx + 1):
            dx = (x - cx) / rx
            dy = (y - cy) / ry
            dist = math.sqrt(dx * dx + dy * dy)
            if dist <= 1.0:
                lf = light_factor(x - ox, y - oy, 128, 128)
                edge_t = dist
                if lf > 0.6:
                    t = (lf - 0.6) / 0.4
                    color = lerp_color(SWISS["base"], SWISS["highlight"], t * 0.7)
                elif lf < 0.35:
                    t = (0.35 - lf) / 0.35
                    color = lerp_color(SWISS["base"], SWISS["shadow"], t * 0.75)
                else:
                    color = SWISS["base"]
                color = lerp_color(color, SWISS["shadow"], edge_t * edge_t * 0.3)
                img.putpixel((x, y), (*color, 255))

    # Signature holes (larger and more prominent than cheddar)
    holes = [
        (cx - 16, cy + 4, 8, 6),
        (cx + 12, cy - 6, 6, 5),
        (cx - 4, cy + 12, 7, 5),
        (cx + 20, cy + 8, 5, 4),
        (cx - 22, cy - 2, 4, 3),
        (cx + 6, cy - 10, 5, 4),
    ]
    for hx, hy, hrx, hry in holes:
        # Check if inside body
        dx = (hx - cx) / rx
        dy = (hy - cy) / ry
        if math.sqrt(dx * dx + dy * dy) < 0.85:
            draw.ellipse([hx - hrx, hy - hry, hx + hrx, hy + hry],
                         fill=(*SWISS["hole_light"], 255))
            draw.ellipse([hx - hrx + 2, hy - hry + 2, hx + hrx - 1, hy + hry - 1],
                         fill=(*SWISS["hole_dark"], 200))

    # Rind edge
    for angle_deg in range(0, 360, 2):
        rad = math.radians(angle_deg)
        for depth in range(4):
            x = int(cx + (rx - depth) * math.cos(rad))
            y = int(cy + (ry - depth) * math.sin(rad))
            if 0 <= x < 128 and 0 <= y < 128:
                existing = img.getpixel((x, y))
                if existing[3] > 10:
                    a = 0.5 * (1 - depth / 4)
                    rind = lerp_color(existing[:3], SWISS["rind"], a)
                    img.putpixel((x, y), (*rind, 255))

    # Outline
    draw.ellipse([cx - rx - 1, cy - ry - 1, cx + rx + 1, cy + ry + 1],
                 outline=(*OUTLINE, 255), width=3)

    # Aerodynamic pointed tip on right side
    tip_pts = [(cx + rx - 5, cy - 8), (cx + rx + 8, cy), (cx + rx - 5, cy + 8)]
    draw.polygon(tip_pts, fill=(*SWISS["base"], 255), outline=(*OUTLINE, 255))
    # Shade the tip
    for y in range(cy - 7, cy + 7):
        for x in range(cx + rx - 4, cx + rx + 7):
            if img.getpixel((x, y))[3] > 10:
                lf_val = light_factor(x, y, 128, 128)
                existing = img.getpixel((x, y))[:3]
                if lf_val > 0.5:
                    color = lerp_color(existing, SWISS["highlight"], 0.3)
                else:
                    color = lerp_color(existing, SWISS["shadow"], 0.3)
                img.putpixel((x, y), (*color, 255))

    return cx, cy


def draw_swiss_frame(expression="happy", with_speed_aura=False):
    """Generate a single Swiss frame."""
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # Speed aura behind character
    if with_speed_aura:
        aura = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
        ad = ImageDraw.Draw(aura)
        for i in range(5):
            y_off = random.randint(-20, 20)
            x_start = 10 + random.randint(0, 15)
            length = 40 + random.randint(0, 30)
            a = 40 + random.randint(0, 30)
            ad.line([(x_start, 60 + y_off), (x_start + length, 60 + y_off)],
                    fill=(*SWISS["speed"], a), width=2)
        aura = aura.filter(ImageFilter.GaussianBlur(radius=3.0))
        img = Image.alpha_composite(img, aura)
        draw = ImageDraw.Draw(img)

    cx, cy = draw_swiss_base(img, 0, 0)

    draw_eyes(draw, cx, cy, expression, eye_spacing=14, palette=SWISS)
    draw_mouth(draw, cx, cy, expression)

    # Rim light
    for angle_deg in range(150, 280):
        rad = math.radians(angle_deg)
        x = int(cx + 44 * math.cos(rad))
        y = int(cy + 32 * math.sin(rad))
        if 0 <= x < 128 and 0 <= y < 128:
            existing = img.getpixel((x, y))
            if existing[3] > 10:
                rim = lerp_color(existing[:3], SWISS["rim"], 0.3)
                img.putpixel((x, y), (*rim, existing[3]))

    return add_painted_finish(img)


# ─── Parmesan: Hard wedge shape ────────────────────────────────────────

def draw_parmesan_base(img, ox, oy):
    """Draw Parmesan's hard wedge body with crystalline texture."""
    draw = ImageDraw.Draw(img)
    cx, cy = ox + 64, oy + 62

    # Wedge shape (wider than cheddar, more angular)
    tip = (cx + 10, oy + 20)
    bl = (ox + 18, oy + 100)
    br = (ox + 108, oy + 100)

    # Fill wedge with directional gradient
    for y in range(tip[1], bl[1] + 1):
        t_y = (y - tip[1]) / max(1, bl[1] - tip[1])
        left_x = tip[0] + (bl[0] - tip[0]) * t_y
        right_x = tip[0] + (br[0] - tip[0]) * t_y
        for x in range(int(left_x), int(right_x) + 1):
            lf_val = light_factor(x - ox, y - oy, 128, 128)
            if lf_val > 0.6:
                t = (lf_val - 0.6) / 0.4
                color = lerp_color(PARMESAN["base"], PARMESAN["highlight"], t * 0.7)
            elif lf_val < 0.35:
                t = (0.35 - lf_val) / 0.35
                color = lerp_color(PARMESAN["base"], PARMESAN["shadow"], t * 0.75)
            else:
                color = PARMESAN["base"]
            img.putpixel((x, y), (*color, 255))

    # Rough, broken edge at top (Parmesan is chipped/broken)
    random.seed(777)
    for x in range(int(bl[0]) + 5, int(br[0]) - 5):
        t_x = (x - bl[0]) / (br[0] - bl[0])
        base_y = int(tip[1] + (1 - abs(t_x * 2 - 1)) * 3)
        # Jagged edge
        jag = random.randint(-3, 3)
        for y in range(base_y + jag, base_y + jag + 4):
            if 0 <= y < 128 and 0 <= x < 128:
                existing = img.getpixel((x, y))
                if existing[3] > 10:
                    rough = lerp_color(existing[:3], PARMESAN["rind"], 0.4)
                    img.putpixel((x, y), (*rough, 255))
    random.seed(42)

    # Rind along bottom
    for x in range(int(bl[0]), int(br[0]) + 1):
        for dy in range(6):
            y = bl[1] - dy
            if 0 <= x < 128 and 0 <= y < 128:
                existing = img.getpixel((x, y))
                if existing[3] > 10:
                    a = 0.6 * (1 - dy / 6)
                    rind = lerp_color(existing[:3], PARMESAN["rind"], a)
                    img.putpixel((x, y), (*rind, 255))

    # Crystalline texture — small bright specks scattered throughout
    random.seed(888)
    for _ in range(40):
        x = random.randint(int(bl[0]) + 8, int(br[0]) - 8)
        y = random.randint(tip[1] + 10, bl[1] - 10)
        # Check inside wedge
        t_y = (y - tip[1]) / max(1, bl[1] - tip[1])
        left_x = tip[0] + (bl[0] - tip[0]) * t_y
        right_x = tip[0] + (br[0] - tip[0]) * t_y
        if left_x + 3 < x < right_x - 3:
            # Crystalline sparkle point
            size = random.randint(1, 2)
            draw.ellipse([x - size, y - size, x + size, y + size],
                         fill=(*PARMESAN["crystal"], random.randint(120, 200)))
    random.seed(42)

    # Grain texture lines
    random.seed(999)
    for _ in range(15):
        x1 = random.randint(int(bl[0]) + 10, int(br[0]) - 10)
        y1 = random.randint(tip[1] + 15, bl[1] - 15)
        angle = random.uniform(-0.3, 0.3) + math.pi * 0.75  # mostly diagonal
        length = random.randint(8, 20)
        x2 = int(x1 + length * math.cos(angle))
        y2 = int(y1 + length * math.sin(angle))
        draw.line([(x1, y1), (x2, y2)], fill=(*PARMESAN["grain"], 80), width=1)
    random.seed(42)

    # Warm brown outline
    pts = [tip, br, bl]
    draw.polygon(pts, outline=(*OUTLINE, 255))
    # Thicker outline pass
    for i in range(len(pts)):
        p1 = pts[i]
        p2 = pts[(i + 1) % len(pts)]
        draw.line([p1, p2], fill=(*OUTLINE, 255), width=3)

    return cx, cy


def draw_parmesan_frame(expression="happy", with_shatter=False):
    """Generate a single Parmesan frame."""
    img = Image.new("RGBA", (128, 128), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    cx, cy = draw_parmesan_base(img, 0, 0)

    # Shatter effect for ability (small fragments flying off)
    if with_shatter:
        random.seed(1234)
        for _ in range(6):
            fx = cx + random.randint(-45, 45)
            fy = cy + random.randint(-35, 35)
            size = random.randint(3, 6)
            pts = [(fx + random.randint(-size, size), fy + random.randint(-size, size))
                   for _ in range(4)]
            draw.polygon(pts, fill=(*PARMESAN["base"], 180), outline=(*OUTLINE, 160))
        random.seed(42)

    draw_eyes(draw, cx, cy, expression, eye_spacing=14, palette=PARMESAN)
    draw_mouth(draw, cx, cy, expression)

    # Rim light on top-left edges
    tip = (cx + 10, 20)
    bl = (18, 100)
    # Light on left edge
    for y in range(tip[1] + 5, bl[1] - 5):
        t = (y - tip[1]) / (bl[1] - tip[1])
        x = int(tip[0] + (bl[0] - tip[0]) * t)
        for dx in range(3):
            px = x + dx
            if 0 <= px < 128 and 0 <= y < 128:
                existing = img.getpixel((px, y))
                if existing[3] > 10:
                    rim = lerp_color(existing[:3], PARMESAN["rim"], 0.3 * (1 - dx / 3))
                    img.putpixel((px, y), (*rim, existing[3]))

    return add_painted_finish(img)


# ─── Atlas assembly ────────────────────────────────────────────────────

def generate_all_frames():
    """Generate all frames for all three cheese types."""
    frames = {}

    # Gouda frames: round, bold, heavy
    print("Generating Gouda frames...")
    frames["gouda_idle_01"] = draw_gouda_frame("happy")
    frames["gouda_idle_02"] = draw_gouda_frame("happy2")
    frames["gouda_aiming_01"] = draw_gouda_frame("nervous")
    frames["gouda_aiming_02"] = draw_gouda_frame("nervous2")
    frames["gouda_flying"] = draw_gouda_frame("scared")
    frames["gouda_ability"] = draw_gouda_frame("fierce", with_glow=True)
    frames["gouda_settled"] = draw_gouda_frame("dizzy")

    # Swiss frames: elongated, aerodynamic
    print("Generating Swiss frames...")
    frames["swiss_idle_01"] = draw_swiss_frame("happy")
    frames["swiss_idle_02"] = draw_swiss_frame("happy2")
    frames["swiss_aiming_01"] = draw_swiss_frame("nervous")
    frames["swiss_aiming_02"] = draw_swiss_frame("nervous2")
    frames["swiss_flying"] = draw_swiss_frame("scared", with_speed_aura=True)
    frames["swiss_ability"] = draw_swiss_frame("fierce", with_speed_aura=True)
    frames["swiss_settled"] = draw_swiss_frame("dizzy")

    # Parmesan frames: hard wedge, crystalline
    print("Generating Parmesan frames...")
    frames["parmesan_idle_01"] = draw_parmesan_frame("happy")
    frames["parmesan_idle_02"] = draw_parmesan_frame("happy2")
    frames["parmesan_aiming_01"] = draw_parmesan_frame("nervous")
    frames["parmesan_aiming_02"] = draw_parmesan_frame("nervous2")
    frames["parmesan_flying"] = draw_parmesan_frame("scared")
    frames["parmesan_ability"] = draw_parmesan_frame("fierce", with_shatter=True)
    frames["parmesan_settled"] = draw_parmesan_frame("dizzy")

    return frames


def build_atlas():
    """Expand the characters atlas with new cheese types."""
    print("Loading existing characters atlas...")
    atlas_img = Image.open(SPRITES / "characters.png").convert("RGBA")
    with open(SPRITES / "characters.json") as f:
        atlas_json = json.load(f)

    old_w, old_h = atlas_img.size

    # New atlas: 910 x 790 (3 new rows of 7 frames each)
    new_w, new_h = 910, 790
    new_atlas = Image.new("RGBA", (new_w, new_h), (0, 0, 0, 0))
    new_atlas.paste(atlas_img, (0, 0))

    all_frames = generate_all_frames()

    # Layout: 7 frames per row at 128x128, 2px gaps
    cheese_types = ["gouda", "swiss", "parmesan"]
    frame_suffixes = ["idle_01", "idle_02", "aiming_01", "aiming_02", "flying", "ability", "settled"]

    for row_idx, cheese in enumerate(cheese_types):
        y = 400 + row_idx * 130  # rows 3, 4, 5
        for col_idx, suffix in enumerate(frame_suffixes):
            x = col_idx * 130
            frame_name = f"{cheese}_{suffix}"
            frame_img = all_frames[frame_name]
            new_atlas.paste(frame_img, (x, y), frame_img)

            atlas_json["frames"][frame_name] = {
                "frame": {"x": x, "y": y, "w": 128, "h": 128},
                "rotated": False,
                "trimmed": False,
                "spriteSourceSize": {"x": 0, "y": 0, "w": 128, "h": 128},
                "sourceSize": {"w": 128, "h": 128},
            }
            print(f"  Placed {frame_name} at ({x}, {y})")

    # Update atlas metadata
    atlas_json["meta"]["size"] = {"w": new_w, "h": new_h}

    # Save
    new_atlas.save(SPRITES / "characters.png", "PNG", optimize=True)
    with open(SPRITES / "characters.json", "w") as f:
        json.dump(atlas_json, f, indent=2)

    file_size = (SPRITES / "characters.png").stat().st_size
    print(f"\nSaved characters.png ({new_w}x{new_h}, {file_size / 1024:.1f} KB)")
    print(f"Saved characters.json ({len(atlas_json['frames'])} frames)")


if __name__ == "__main__":
    print("=== Generating New Cheese Character Sprites ===\n")
    build_atlas()
    print("\n=== Done! ===")
