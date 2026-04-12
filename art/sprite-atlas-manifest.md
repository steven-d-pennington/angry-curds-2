# Sprite Atlas Manifest

> Defines the layout, naming, and packing strategy for all game sprite sheets.
> Technical Artist uses this as the source of truth when building atlas PNGs.

---

## 1. Atlas Strategy

The game uses **4 atlas textures**, one per category. All atlases use **premultiplied alpha** and are packed with 2px padding between frames to prevent bleeding.

| Atlas | Max Size | Format | Contents |
|---|---|---|---|
| `characters.png` | 2048x2048 | PNG-32 | Cheddar + Rat sprites (non-Spine fallback) |
| `props.png` | 1024x1024 | PNG-8+alpha | Blocks, crates, slingshot parts |
| `environment.png` | 2048x1024 | PNG-32 | Parallax layers (packed or separate) |
| `vfx.png` | 512x512 | PNG-32 | Particles, impact effects, dust |

> **Note on Spine**: If Spine is used for character animation, the Spine export produces its own atlas (e.g., `cheddar.atlas` + `cheddar.png`). In that case, `characters.png` is only needed as a fallback for platforms without Spine support. The props and VFX atlases are always needed.

---

## 2. Characters Atlas -- Frame Inventory

### Cheddar (Hero)
| Frame Name | Size (px) | Notes |
|---|---|---|
| `cheddar_idle_01` | 128x128 | Default standing pose |
| `cheddar_idle_02` | 128x128 | Breathing frame (slight scale) |
| `cheddar_loaded` | 128x128 | On slingshot, looking up |
| `cheddar_aiming_01` | 128x128 | Nervous, low pull |
| `cheddar_aiming_02` | 128x128 | Very nervous, max pull |
| `cheddar_flying` | 128x128 | Eyes shut, mouth open |
| `cheddar_impact` | 128x128 | Squash frame, X-eyes |
| `cheddar_settled` | 128x128 | Dazed, spiral eyes |
| `cheddar_win` | 128x128 | Arms up, sparkling |
| `cheddar_lose` | 128x128 | Drooping, tear |

**Cheddar total: 10 frames @ 128x128 = ~164K px (fits easily in 2048x2048)**

### Rat (Villain)
| Frame Name | Size (px) | Notes |
|---|---|---|
| `rat_idle_01` | 96x128 | Smug sitting, tail left |
| `rat_idle_02` | 96x128 | Smug sitting, tail right (tail swish) |
| `rat_idle_03` | 96x128 | Blink frame |
| `rat_alert` | 96x128 | Eyes wide, ears up |
| `rat_hit` | 96x128 | Eyes shut, teeth showing |
| `rat_defeated` | 96x128 | X-eyes, tongue out, limp |
| `rat_taunt` | 96x128 | Tongue out, ears wiggle frame |

**Rat total: 7 frames @ 96x128 = ~86K px**

---

## 3. Props Atlas -- Frame Inventory

### Wood Planks
| Frame Name | Size (px) | Notes |
|---|---|---|
| `wood_plank_short` | 64x192 | 0.35m x ~1.1m plank (vertical orientation) |
| `wood_plank_medium` | 64x256 | 0.7m plank |
| `wood_plank_long` | 64x384 | 1.0m plank |
| `wood_plank_short_cracked` | 64x192 | Damaged variant |
| `wood_plank_medium_cracked` | 64x256 | Damaged variant |
| `wood_plank_long_cracked` | 64x384 | Damaged variant |
| `wood_platform` | 384x48 | Horizontal platform (3.0m width) |
| `wood_platform_cracked` | 384x48 | Damaged variant |

### Cheese Crates
| Frame Name | Size (px) | Notes |
|---|---|---|
| `cheese_crate_small` | 96x96 | ~0.6m crate |
| `cheese_crate_large` | 112x112 | ~0.8m crate |
| `cheese_crate_small_cracked` | 96x96 | Damaged variant |
| `cheese_crate_large_cracked` | 112x112 | Damaged variant |

### Slingshot
| Frame Name | Size (px) | Notes |
|---|---|---|
| `slingshot_base` | 128x256 | Copper Y-fork posts + pedestal |
| `slingshot_band_segment` | 32x8 | Tileable band/wire segment for dynamic stretch |

### Ground
| Frame Name | Size (px) | Notes |
|---|---|---|
| `ground_surface` | 512x64 | Tileable grass/moss strip at ground Y |
| `ground_dirt` | 512x128 | Tileable flagstone below ground surface |

---

## 4. Environment Atlas -- Frame Inventory

These may be packed into one atlas or kept as individual PNGs depending on parallax implementation.

| Frame Name | Size (px) | Notes |
|---|---|---|
| `cellar_layer0_wall` | 2048x1024 | Far background: stone wall + ceiling + lights |
| `cellar_layer1_shelves` | 2048x1024 | Mid: shelving units with cheese/props |
| `cellar_layer2_floor` | 2048x256 | Ground plane: flagstone + moss |
| `cellar_layer3_beam_01` | 256x64 | Near foreground element: wooden beam |
| `cellar_layer3_pipe_01` | 64x256 | Near foreground element: copper pipe |

> Layer 0 and 1 may need to tile horizontally if scrolling extends beyond single image width.

---

## 5. VFX Atlas -- Frame Inventory

| Frame Name | Size (px) | Notes |
|---|---|---|
| `cheese_crumb_01` | 16x16 | Small cheese particle |
| `cheese_crumb_02` | 24x24 | Medium cheese particle |
| `cheese_crumb_03` | 12x12 | Tiny cheese particle |
| `dust_puff_01` | 48x48 | Dust cloud frame 1 |
| `dust_puff_02` | 48x48 | Dust cloud frame 2 |
| `dust_puff_03` | 48x48 | Dust cloud frame 3 |
| `dust_puff_04` | 48x48 | Dust cloud frame 4 |
| `impact_spark_01` | 32x32 | Impact spark frame 1 |
| `impact_spark_02` | 32x32 | Impact spark frame 2 |
| `impact_spark_03` | 32x32 | Impact spark frame 3 |
| `wood_splinter_01` | 24x8 | Wood fracture debris |
| `wood_splinter_02` | 32x6 | Wood fracture debris |
| `star_01` | 16x16 | Hit stars (around rat head) |

---

## 6. Spine Exports (if using Spine)

| Export | Atlas Size | Skeleton |
|---|---|---|
| `cheddar.atlas` + `cheddar.png` | 512x512 | `cheddar.json` or `cheddar.skel` |
| `rat.atlas` + `rat.png` | 512x512 | `rat.json` or `rat.skel` |

Spine atlases are exported from Spine Editor at 1x scale. The engine's `pixi-spine` loader handles them natively.

---

## 7. Directory Structure (Final Assets)

```
public/
  assets/
    sprites/
      characters.json     # TexturePacker/PixiJS spritesheet JSON
      characters.png
      props.json
      props.png
      vfx.json
      vfx.png
    environment/
      cellar_layer0_wall.png
      cellar_layer1_shelves.png
      cellar_layer2_floor.png
      cellar_layer3_beam_01.png
      cellar_layer3_pipe_01.png
    spine/
      cheddar.json
      cheddar.atlas
      cheddar.png
      rat.json
      rat.atlas
      rat.png
```

---

## 8. PixiJS Loading Notes

```typescript
// Spritesheet loading (TexturePacker JSON-hash format)
import { Assets } from 'pixi.js';

await Assets.load([
  { alias: 'characters', src: 'assets/sprites/characters.json' },
  { alias: 'props', src: 'assets/sprites/props.json' },
  { alias: 'vfx', src: 'assets/sprites/vfx.json' },
]);

// Individual environment layers
await Assets.load([
  { alias: 'cellar_layer0', src: 'assets/environment/cellar_layer0_wall.png' },
  { alias: 'cellar_layer1', src: 'assets/environment/cellar_layer1_shelves.png' },
  { alias: 'cellar_layer2', src: 'assets/environment/cellar_layer2_floor.png' },
]);

// Spine (if using @esotericsoftware/spine-pixi)
await Assets.load([
  { alias: 'cheddar-spine', src: 'assets/spine/cheddar.json' },
  { alias: 'rat-spine', src: 'assets/spine/rat.json' },
]);
```
