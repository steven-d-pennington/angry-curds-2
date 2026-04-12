# Character Design Sheet -- Rat (Villain)

> The enemies Cheddar must defeat. Rats are angular, sneaky, and satisfying to topple.
> Must contrast sharply with Cheddar in both silhouette and color temperature.

---

## 1. Identity

| Property | Value |
|---|---|
| Role | Enemy target (destroy to win) |
| Species | Rat (stylized, not realistic) |
| Personality | Smug, cowardly, comically villainous |
| Physics shape | Circle, radius 0.3m |
| Primary color | Steel Gray `#6B6B7B` |

---

## 2. Shape Language

- **Base form**: Angular and pointy, in deliberate contrast to Cheddar's rounded wedge. The body is a squat, pear-shaped oval (wider at bottom, narrowing upward), but ears and snout add sharp triangular elements.
- **Key shapes**: Triangular ears (tall, pointed), elongated pointed snout, thin whip-like tail curling upward.
- **Proportions**: Head+ears ~45% of height, body ~45%, legs/feet ~10% (stubby, almost vestigial -- they sit more than stand).
- **Silhouette key**: The tall pointed ears are the #1 identifier. Even at 64x64, the ears must be clearly visible and distinct from Cheddar's smooth wedge shape.
- **Volume**: Less painted volume than Cheddar. Flatter rendering with sharper highlight-to-shadow transitions, suggesting sleek fur rather than waxy cheese.

---

## 3. Color Breakdown

| Zone | Color | Notes |
|---|---|---|
| Body fill | `#6B6B7B` Steel Gray | Cool-toned, matte fur |
| Fur highlight | `#9898A8` Moonlight | Top edge of head/ears, sharp highlight |
| Shadow fur | `#42424E` Shadow Fur | Underside of body, between ears |
| Belly patch | `#8888A0` | Slightly lighter oval on chest/belly |
| Ears (inner) | `#A85555` | Warm pinkish, visible inside ear triangles |
| Snout | `#8888A0` | Lighter gray, pointed |
| Nose | `#2E2E3A` Midnight | Tiny dark oval at snout tip |
| Eyes | `#E52222` Rat Red | Glowing, beady. Key villain signifier |
| Eye highlight | `#FF6666` | Single sharp specular dot, top-right |
| Tail | `#6B6B7B` base, `#9898A8` highlight | Thin, whip-like, curls upward |
| Teeth | `#FFF4D6` Cream | Two front teeth visible when mouth open |
| Outline | `#2E2E3A` at 2-3px | Slightly cooler/darker than Cheddar's warm brown outline |

---

## 4. Face Placement

- Eyes sit in the **upper 1/3** of the head, flanking the snout.
- Eyes are small and beady (contrast with Cheddar's large expressive eyes). ~15% of head width each.
- Snout protrudes forward from the center of the face, between and slightly below the eyes.
- Ears extend upward from the top of the head, angled slightly outward. Each ear is ~60% of head height.
- Mouth is hidden behind the snout in most poses. Visible only in taunt, hit, and defeated poses.

---

## 5. Poses / Animation States

### 5.1 Idle
- Sitting smugly atop structure. Arms (tiny paws) crossed or resting on belly.
- Slow tail swish animation (2-3s loop).
- Eyes half-lidded, slight smirk implied by snout angle.
- Occasional blink (every 3-5s, randomized).

### 5.2 Alert (cheese incoming / structure wobbling)
- Eyes snap fully open, ears perk straight up.
- Body tenses -- slight upward shift, paws uncross.
- Tail goes rigid / straight.
- Quick transition (0.15s) from idle to alert.

### 5.3 Hit (non-lethal impact)
- Eyes squeeze shut, mouth opens showing two front teeth.
- Body compresses on impact side (squash), then bounces back.
- Stars or small impact lines around head (VFX layer).
- Returns to idle or alert after 0.5s.

### 5.4 Defeated (lethal hit -- kill triggered)
- Eyes become X marks.
- Tongue sticks out, body goes limp.
- Spins slowly while fading out (0.3s death timer in code).
- Optional: tiny ghost/angel rat floats upward (VFX layer, purely decorative).

### 5.5 Taunt (played periodically while alive, or after player misses)
- Sticks tongue out, wiggles ears.
- Optional rude gesture with tiny paw.
- Quick animation, 0.5-0.8s, returns to idle.
- **Gameplay note**: taunt should fire after a cheese shot misses all rats. Drives player to retry.

---

## 6. Silhouette Validation

```
At 64x64 pixels, the viewer must be able to answer:
  1. "That's a rat" (pointed ears + snout)
  2. "It's an enemy, not the hero" (angular vs. rounded)
  3. "It's alive/dead" (upright vs. limp)

Test: Render each pose as solid black on white at 64x64.
      The ear points must be clearly visible.
      The overall shape must NOT be mistakable for Cheddar.
```

---

## 7. Visual Contrast with Cheddar

| Property | Cheddar | Rat |
|---|---|---|
| Shape | Rounded, organic | Angular, pointed |
| Color temp | Warm gold/orange | Cool gray/blue |
| Eyes | Large, expressive | Small, beady, red |
| Outline | Warm brown `#3B2510` | Cool dark `#2E2E3A` |
| Rendering | Painterly, soft | Flatter, sharper edges |
| Silhouette | Smooth curve | Spiky (ears, snout, tail) |

This contrast is critical for readability. A player glancing at the screen must instantly distinguish hero from enemy.

---

## 8. Spine Rig Notes (for Technical Artist)

- **Skeleton**: Root bone at body center of mass.
- **Meshes**: Body (slight deform for squash), head, ear-left, ear-right, snout, tail (multi-bone chain, 3-4 segments for swish).
- **Slots**: body, belly-patch, head, ear-left-outer, ear-left-inner, ear-right-outer, ear-right-inner, snout, nose, eye-left, eye-right, mouth (hidden by default), teeth, tail-segments, paw-left, paw-right.
- **Animations**: idle (loop), alert (transition), hit (one-shot), defeated (one-shot + fade), taunt (one-shot).
- **Tail**: IK or FK chain for natural swish. 3-4 bones, sine-wave offset.
- **Expression swaps**: Attachment swap on eyes (half-lid, open, X-mark) and mouth (hidden, open, tongue-out).

---

## 9. Size Reference

| Context | Dimension |
|---|---|
| Physics radius | 0.3 meters |
| Visual diameter at 1080p | ~58px (0.6m * 96px/m) |
| Visual height with ears | ~80px (ears extend beyond physics circle) |
| Sprite sheet cell | 96x128 px (with ear clearance + padding) |
| Minimum readable size | 64x64 px (mobile) |
