# Character Design Sheet -- Cheddar (Hero)

> The player's projectile. Cheddar is a wedge of cheddar cheese with personality.
> Must be instantly lovable, readable at 64x64, and visually satisfying in motion.

---

## 1. Identity

| Property | Value |
|---|---|
| Role | Hero projectile (player-launched) |
| Species | Cheddar cheese wedge |
| Personality | Eager, brave, slightly anxious |
| Physics shape | Circle, radius 0.4m |
| Primary color | Cheddar Gold `#F5A623` |

---

## 2. Shape Language

- **Base form**: Wedge / rounded triangle, wider at base than top. The physics collider is circular (0.4m radius), but the visual reads as a cheese wedge inscribed within that circle.
- **Proportions**: ~60% body, ~25% face area, ~15% rind/edge detail.
- **Silhouette key**: The wedge tip (top) and rounded base (bottom) must be clearly distinguishable even as a solid silhouette. The shape should NOT look like a generic circle -- the wedge taper is essential.
- **Volume**: The cheese has visible thickness. A subtle side-face on the left edge shows the cross-section (lighter cream color `#FFF4D6`), selling the 3D wedge illusion.

---

## 3. Color Breakdown

| Zone | Color | Notes |
|---|---|---|
| Main body fill | `#F5A623` Cheddar Gold | Flat base, hand-painted grain overlay |
| Painted highlight | `#FFD76E` Cheese Highlight | Top-left quadrant, soft-edged |
| Shadow side | `#C47B12` Aged Cheddar | Bottom-right, blended edge |
| Rind edge | `#8B5A0B` Cheese Rind | Thin band along the curved bottom edge |
| Holes (x3-4) | `#C47B12` inner, `#8B5A0B` shadow edge | Classic cheese holes. Elliptical, vary size. Largest ~15% of body radius |
| Cross-section | `#FFF4D6` Cream | Thin sliver on left edge, showing the "cut" |
| Eye whites | `#FFF4D6` Cream | Slightly oval, vertically oriented |
| Pupils | `#3B2510` Warm Brown | Large, round, ~40% of eye size |
| Mouth | `#3B2510` Warm Brown | Simple curved line, varies by expression |
| Outline | `#3B2510` at 2-3px | Entire silhouette edge, warm brown not black |

---

## 4. Face Placement

- Eyes sit at **upper 1/3** of the wedge body, horizontally centered with slight offset toward the wider (bottom) end.
- Eyes are spaced ~30% of body width apart.
- Mouth sits directly below and between the eyes, in the middle 1/3 zone.
- Face should feel "nested" in the cheese body, not stamped on top. Slight shadow around the eye sockets.

---

## 5. Poses / Animation States

Each pose is a distinct sprite frame (or Spine animation key pose). The physics circle does not change between poses -- only the visual within it.

### 5.1 Idle
- Sitting on the slingshot. Eyes open, looking forward. Slight smile.
- Gentle 2-frame breathing cycle (body scale 100% -> 102% -> 100%, ~1.5s loop).
- Cheese holes subtly shift with the breathing.

### 5.2 Loaded (on slingshot, pre-drag)
- Same as Idle but eyes look slightly upward (anticipation).
- Optional: tiny sweat drop on the side.

### 5.3 Aiming (being dragged)
- Eyes widen, brow line raises. Expression shifts from eager to nervous.
- Body squishes slightly in the pull direction (stretch toward anchor, squash perpendicular).
- The further the pull, the more nervous the face.

### 5.4 Flying (launched)
- Eyes squeezed shut, mouth wide open (excited scream).
- Slight motion blur trail (VFX, not part of sprite -- see VFX spec).
- Body rotates freely with physics. Cheese holes spin with it.

### 5.5 Impact (collision)
- Eyes become X shapes or spirals for 0.2s on hard impact.
- Squash frame: flatten 20% along impact normal, stretch perpendicular.
- 2 cheese crumb particles spawn (VFX layer).

### 5.6 Settled (resting after landing)
- Dazed expression: spiral eyes, tongue out.
- No animation, static frame.
- Fades out over 0.5s when removed.

### 5.7 Win Pose (shown in victory screen, not in-game physics)
- Eyes big and sparkling, huge grin.
- Arms (tiny cheese arms, not visible in other poses) raised in triumph.
- Confetti context (VFX).

### 5.8 Lose Pose (shown in defeat screen)
- Eyes drooping, frown, single tear drop.
- Slumped posture.

---

## 6. Silhouette Validation

```
At 64x64 pixels, the viewer must be able to answer:
  1. "That's a cheese wedge" (shape)
  2. "It has a face" (personality)
  3. "It's not a rat" (distinct from enemy)

Test: Render each pose as solid black on white at 64x64.
      If the wedge tip and rounded base are not clearly
      distinguishable, simplify the shape.
```

---

## 7. Spine Rig Notes (for Technical Artist)

- **Skeleton**: Single root bone at body center.
- **Meshes**: Body (deformable for squash/stretch), left eye, right eye, mouth, cheese holes (x4, parented to body mesh).
- **Slots**: body, cross-section, hole1-4, eye-left, eye-right, pupil-left, pupil-right, mouth, brow-left, brow-right, sweat (optional).
- **Animations**: idle (loop), loaded (loop), aiming (pose, blend by pull distance), flying (loop), impact (one-shot), settled (pose), win (one-shot), lose (pose).
- **Squash/stretch**: Apply via root bone scale. X scale = 1/Y scale to preserve volume.
- **Expression swaps**: Use Spine skin or attachment swaps for eye/mouth variants.

---

## 8. Size Reference

| Context | Dimension |
|---|---|
| Physics radius | 0.4 meters |
| Visual diameter at 1080p | ~77px (0.8m * 96px/m) |
| Sprite sheet cell | 128x128 px (with padding) |
| Minimum readable size | 64x64 px (mobile) |
