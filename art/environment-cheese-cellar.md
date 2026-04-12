# Environment Concept -- Cheese Cellar (Level 1)

> The first (and currently only) level environment. An underground cheese aging cellar
> with stone walls, wooden shelving, and warm incandescent lighting.
> Must feel cozy-dangerous: a warm, inviting space that rats have infested.

---

## 1. Setting Description

An old European-style cheese cellar (cave d'affinage). Stone-walled, barrel-vaulted ceiling, wooden shelving units along the walls. Wheels of cheese age on the shelves. Dim incandescent lighting from bare bulbs or oil lamps casts warm pools of light with soft shadows. The floor is irregular flagstone. The atmosphere is warm, slightly hazy, and suggests generations of cheesemaking tradition.

The rats have built their fort from salvaged wood planks and cheese crates, turning the cellar into their stronghold.

---

## 2. Parallax Layer Breakdown

The environment is composed of **4 parallax layers** that scroll at different rates to create depth. Layer 0 is furthest back; Layer 3 is closest to the camera.

### Layer 0 -- Far Background (parallax factor: 0.1x)
**Content**: The cellar's rear stone wall and vaulted ceiling.
- Stone wall texture: irregular limestone blocks, warm-toned (`#A89880` to `#7A6B58`).
- Vaulted ceiling: arched stone, darker at the crown (`#4A3D30`), lighter at the spring line.
- 2-3 bare incandescent bulbs hanging from the ceiling on simple wires. These are the light sources. Each bulb emits a soft warm glow halo (additive blend, `#FFD76E` at 15% opacity).
- Light from bulbs creates soft circular highlight pools on the stone wall behind them.
- Overall: **desaturated, low contrast, cool-shifted** compared to foreground layers.

**Size**: Full viewport width + 20% overscan for parallax. Height = viewport height.
**Texture**: 2048x1024 PNG, tileable horizontally.

### Layer 1 -- Mid Background (parallax factor: 0.4x)
**Content**: Wooden shelving units with cheese wheels, casks, and cellar clutter.
- Wooden shelf frames: vertical posts and horizontal shelves, aged oak (`#B8845A` to `#8B5E3C`).
- Cheese wheels on shelves: various sizes, golden-orange tones. Some with wax rind, some with cloth wrapping. These are decorative -- not interactive.
- Small props on shelves: copper ladles, glass jars, cheesecloth bundles, a candle stub.
- Shelf units are irregularly spaced, creating visual rhythm but not perfect symmetry.
- Medium contrast, slightly warmer than Layer 0.

**Size**: Full viewport width + 40% overscan. Height = ~70% of viewport (top half, resting on implied floor).
**Texture**: 2048x1024 PNG.

### Layer 2 -- Foreground Ground Plane (parallax factor: 0.8x)
**Content**: The flagstone floor and ground-level details.
- Flagstone tiles: irregular rectangular shapes, warm gray-brown (`#6B5D4F`), mortar lines in darker tone (`#4A3D30`).
- Moss patches between flagstones: small green accent (`#5A8C47`), keeps the "edible world" pillar alive.
- Scattered props at floor level: cheese crumbs, straw wisps, a mouse hole in the baseboard (comedic touch).
- This layer contains the **ground plane** that entities sit on. Ground Y = 1m in world space.
- Ground surface has a subtle grass/moss strip at the top edge, then flagstone below.

**Size**: Full viewport width + 60% overscan. Height = bottom ~15% of viewport (ground plane and below).
**Texture**: 2048x256 PNG, tileable horizontally.

### Layer 3 -- Near Foreground (parallax factor: 1.2x, in front of gameplay)
**Content**: Atmospheric overlay elements that pass in front of gameplay occasionally.
- Subtle dust motes floating (can also be a particle system instead of baked).
- Occasional wooden beam or pipe crossing the near foreground, slightly blurred (depth of field effect).
- These elements should be sparse and translucent (30-50% opacity) so they don't obscure gameplay.
- Used sparingly: 1-2 elements max visible at any time.

**Size**: Sparse elements, not a full-width layer. Individual sprites positioned as needed.
**Texture**: Individual PNGs, 256x256 max per element.

---

## 3. Structural Elements (Gameplay Layer)

These are interactive physics objects on the main gameplay plane (parallax factor 1.0x). They are NOT part of the parallax backgrounds -- they are sprite-replaced versions of the current graybox blocks.

### Wood Planks
- **Current graybox**: Brown rectangles (`#8B5E3C`), various sizes.
- **Art target**: Aged wooden planks with visible grain. Warm brown base with knot details. Slightly rounded/worn edges. Nail heads or bracket details at ends.
- **Variants needed**: 3 plank lengths (short 0.35m, medium 0.7m, long 1.0m), 2 orientations each (horizontal/vertical use same sprite, rotated in-engine).
- **Damage state**: Cracked variant for blocks near fracture threshold. 1 additional sprite per variant showing split/cracked wood.

### Cheese Crates
- **Current graybox**: Yellow-tan rectangles (`#E8C547`), various sizes.
- **Art target**: Wooden crates with cheese wedges visible through slats. Warm golden wood (`#B8845A`) slats with cheese gold (`#F5A623`) peeking through gaps. Rope binding around the crate. Slight wax-drip detail on edges.
- **Variants needed**: 2 sizes (small 0.6m, large 0.8m), both roughly square.
- **Damage state**: Cracked/splintered variant showing cheese spilling out.

### Slingshot (Launcher)
- **Current graybox**: Brown line-stroke posts with red rubber band.
- **Art target**: Copper pipe Y-fork launcher. Two upright copper pipes (`#A87D4E` base, `#D4A862` highlights) joined at the base, splaying outward at the top into a Y-shape. Between the fork tips: a cheese-wire or thick leather strap (replaces rubber band).
- The base is mounted on a rough stone or wood pedestal.
- Fittings: small copper rivets at joints, verdigris (green patina `#668855`) in crevices.

---

## 4. Lighting in Environment

```
Light map concept:

  [Bulb 1]         [Bulb 2]              [Bulb 3]
     |                 |                      |
   ~~~~~           ~~~~~~~                ~~~~~~~~
  warm pool       warm pool             warm pool
  (left 1/4)      (center)             (right 1/4)

Between pools: cooler ambient (#4A3D30 overlay at 20%)
```

- 3 overhead light sources, roughly evenly spaced.
- Slingshot area (left) is well-lit -- player needs to see their aim clearly.
- Fort area (right) is slightly more shadowed, rats lurking in semi-darkness. But still readable.
- Ambient fill prevents any area from being too dark to read gameplay.

---

## 5. Atmosphere & Mood

- **Warm haze**: Very subtle warm overlay (`#F5A623` at 3-5% opacity) across the entire scene. Gives the "cellar lit by incandescent light" feel.
- **Dust particles**: Slow-drifting motes in the mid-ground. Small, sparse, warm-toned. Particle system, not baked.
- **No weather**: This is an indoor environment. No wind, rain, or clouds.
- **Sound design note** (for audio team): Dripping water, distant creaking wood, rat squeaks. Not in art scope but noted for atmosphere coherence.

---

## 6. Sky / Background Beyond Cellar

- The far background (Layer 0) IS the back wall. There is no visible sky.
- The background color of the PixiJS canvas (currently `#1A1A2E` Night Sky) should be changed to a deep warm brown (`#2A1E14`) to match the cellar darkness that would show through any gaps.
- This dark base color is visible above the vaulted ceiling arch and at the extreme edges.

---

## 7. Color Temperature Gradient (Depth Cue)

| Layer | Temperature | Saturation | Contrast |
|---|---|---|---|
| Layer 0 (far wall) | Cool-warm (desaturated) | 60% of foreground | Low |
| Layer 1 (shelves) | Warm | 80% of foreground | Medium |
| Layer 2 (floor) | Warm | 100% (reference) | High |
| Layer 3 (near) | Warm, blurred | 90% | Low (soft) |
| Gameplay plane | Full warmth | 100% | Full |

This gradient makes the gameplay elements "pop" against the softer background.
