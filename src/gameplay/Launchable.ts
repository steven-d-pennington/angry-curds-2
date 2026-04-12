/**
 * Common interface for projectiles that can be loaded onto and
 * launched from the slingshot. Both CheeseProjectile and
 * BrieProjectile implement this.
 */
export interface Launchable {
  readonly state: string;
  loadAt(worldX: number, worldY: number): void;
  startAiming(): void;
  aimAt(worldX: number, worldY: number): void;
  launch(velocityX: number, velocityY: number): void;
}
