# Angry Curds 2 -- Art Bible

> Canonical visual reference for all art, UI, and VFX decisions.
> Every asset produced for this game must conform to this document.

---

## 1. Creative Pillars

| Pillar | What It Means for Art |
|---|---|
| **Tactile Warmth** | Surfaces look touchable. Soft shadows, slight texture grain, warm lighting. Nothing feels plasticky or clinical. |
| **Readable Comedy** | Silhouettes are exaggerated and instantly recognizable at 64x64px. Poses communicate emotion before detail does. |
| **Edible World** | Every material in the game world should look like it belongs in a kitchen or cheese cellar. Surfaces suggest wax, rind, aged wood, warm stone. |

---

## 2. Visual Style

### Rendering Approach
- **Hand-painted with structure.** Base shapes are clean vector, then overlaid with subtle brush-stroke texture and painted highlights. Not fully painterly (no visible raw canvas) and not flat vector.
- **Thick outlines**: 2-3px at 1080p native resolution, dark warm brown (`#3B2510`), not pure black. Outlines thin to 1-2px on small props/details.
- **Soft shadows**: Drop shadows use multiply-blend warm brown, not hard-edged black. Approximate 15-20% opacity, 2-4px offset downward.
- **Layered depth**: Parallax separation reinforces depth. Foreground elements are warmer and more saturated; background elements are cooler and lower contrast.

### Anti-Patterns (Do NOT Do)
- **No flat vector / Corporate Memphis.** Shapes must have volume -- painted highlights, subtle gradients.
- **No pixel art.** This is a smooth, high-resolution hand-painted look.
- **No Rovio pastiche.** We share genre DNA with Angry Birds but must have our own identity. Avoid glossy rounded-rectangle UI, candy-colored palettes, or identical composition.
- **No pure black outlines.** Use warm dark brown (`#3B2510`) for all linework.
- **No hard-edged cel shading.** Shadows are soft and blended.

### Reference Touchstones
- **Rayman Legends** -- layered depth, hand-painted textures, readable silhouettes
- **Cut the Rope Remastered** -- warm lighting, tactile surfaces, expressive characters
- **Pixar Ratatouille kitchen scenes** -- the copper, stone, and warm wood material language

---

## 3. Color Palette

### 3.1 Hero / Cheese Palette
Used for Cheddar, cheese crates, cheese-themed props, positive UI elements.

| Swatch | Hex | Name | Usage |
|---|---|---|---|
| fill | `#F5A623` | Cheddar Gold | Primary cheese fill |
| highlight | `#FFD76E` | Cheese Highlight | Top-lit painted highlights |
| shadow | `#C47B12` | Aged Cheddar | Shadow side, rind detail |
| deep | `#8B5A0B` | Cheese Rind | Deep shadow, interior holes |
| accent | `#FFF4D6` | Cream | Specular dots, eye whites |

### 3.2 Villain / Rat Palette
Used for Rats, villain UI accents, danger indicators.

| Swatch | Hex | Name | Usage |
|---|---|---|---|
| fill | `#6B6B7B` | Steel Gray | Primary rat body |
| highlight | `#9898A8` | Moonlight | Fur highlight |
| shadow | `#42424E` | Shadow Fur | Dark side of body |
| eye | `#E52222` | Rat Red | Eyes, alert indicators |
| accent | `#2E2E3A` | Midnight | Ears, tail, nose |
| danger | `#FF4444` | Alarm Red | Damage flash, UI danger |

### 3.3 Environment Palette (Cheese Cellar)
Used for backgrounds, structures, ground, and ambient elements.

| Swatch | Hex | Name | Usage |
|---|---|---|---|
| stone-light | `#A89880` | Warm Limestone | Lit stone walls |
| stone-mid | `#7A6B58` | Cellar Stone | Mid-tone stone |
| stone-dark | `#4A3D30` | Deep Stone | Shadowed crevices |
| wood-light | `#B8845A` | Aged Oak | Lit wood shelves/planks |
| wood-mid | `#8B5E3C` | Cellar Wood | Primary wood tone |
| wood-dark | `#5C3A1E` | Dark Timber | Shadow wood |
| floor | `#6B5D4F` | Flagstone | Floor tiles |
| metal | `#A87D4E` | Copper | Slingshot, pipes, brackets |
| metal-hi | `#D4A862` | Polished Copper | Metal highlights |
| ground-grass | `#5A8C47` | Cellar Moss | Ground vegetation |
| ground-dirt | `#6B5040` | Earth | Dirt base |

### 3.4 VFX / UI Palette

| Swatch | Hex | Name | Usage |
|---|---|---|---|
| score | `#FFEE44` | Score Gold | Score popups, positive feedback |
| impact | `#FFB833` | Spark Orange | Impact sparks, cheese crumbs |
| dust | `#C8B898` | Dust | Block break dust clouds |
| hud-bg | `#1A1A2E` | Night Sky | HUD background, sky gradient top |
| hud-text | `#FFFFFF` | White | Primary HUD text |
| win | `#44FF44` | Victory Green | Win overlay |
| lose | `#FF4444` | Retry Red | Lose overlay |

---

## 4. Typography

| Context | Font | Weight | Size (at 1080p) | Color | Stroke |
|---|---|---|---|---|---|
| HUD labels | **Fredoka One** (fallback: Arial Rounded) | Bold | 28px | Per-element | 3px warm brown `#3B2510` |
| Score popups | **Fredoka One** | Bold | 24px | `#FFEE44` | 3px warm brown |
| Win/Lose overlay | **Fredoka One** | Bold | 64px | Green/Red | 5px warm brown |
| Menu headers | **Fredoka One** | Bold | 48px | `#FFFFFF` | 4px warm brown |

> **Note**: Fredoka One provides the rounded, playful feel that matches our pillars. If licensing is an issue, use Google Fonts "Fredoka" (variable weight, OFL).

---

## 5. Lighting Principles

- **Primary light source**: Warm incandescent, top-left at ~45deg. Suggests oil lamps / bare bulbs in a cheese cellar.
- **Fill light**: Cool ambient from bottom-right, very subtle (just enough to prevent pure-black shadows).
- **Rim light**: Thin warm highlight on character edges facing the light, especially on Cheddar to make the cheese "glow".
- **Environment**: Background layers receive progressively less direct light (more ambient). Furthest parallax layer is the most desaturated and cool-shifted.

---

## 6. Scale & Readability

- **Silhouette test**: Every character and key prop must be identifiable as a solid black silhouette at **64x64 pixels**. If it fails, simplify the shape.
- **Minimum detail size**: No painted detail smaller than 4px at 1080p. Details that would be smaller should be implied through texture pattern rather than explicit shapes.
- **Viewport**: Primary target 1920x1080 (desktop), secondary 390x844 (mobile portrait). All assets must read clearly at mobile scale.
- **World dimensions**: 20m wide x 12m tall. 1 meter ~= 96px at 1080p desktop.

---

## 7. Asset Naming Convention

```
art/sprites/{category}/{entity}_{variant}_{state}_{size}.png

Examples:
  art/sprites/characters/cheddar_idle_01_1x.png
  art/sprites/characters/rat_defeated_01_1x.png
  art/sprites/environment/cellar_wall_back_1x.png
  art/sprites/props/cheese_crate_intact_1x.png
  art/sprites/vfx/cheese_crumb_01_1x.png
```

Categories: `characters`, `environment`, `props`, `vfx`, `ui`

---

## 8. Performance Budgets

| Asset Type | Max Texture Size | Format |
|---|---|---|
| Character sprite sheet | 2048x2048 | PNG-8 where possible, PNG-32 for alpha |
| Environment parallax layer | 2048x1024 | PNG-32 (seamless tile or full-width) |
| Props (blocks, crates) | 512x512 atlas | PNG-8 |
| VFX particles | 256x256 atlas | PNG-32 |
| UI elements | 1024x1024 atlas | PNG-32 |

> Coordinate with Technical Director before exceeding these limits.
