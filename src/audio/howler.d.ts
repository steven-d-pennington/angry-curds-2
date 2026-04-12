declare module "howler" {
  interface HowlOptions {
    src: string | string[];
    volume?: number;
    loop?: boolean;
    preload?: boolean;
    autoplay?: boolean;
    html5?: boolean;
    onload?: () => void;
    onloaderror?: (id: number, error: unknown) => void;
    onplay?: (id: number) => void;
    onend?: (id: number) => void;
  }

  class Howl {
    constructor(options: HowlOptions);
    play(spriteOrId?: string | number): number;
    pause(id?: number): this;
    stop(id?: number): this;
    volume(vol?: number, id?: number): this | number;
    mute(muted?: boolean, id?: number): this;
    playing(id?: number): boolean;
    state(): "unloaded" | "loading" | "loaded";
    unload(): void;
    on(event: string, fn: (...args: unknown[]) => void, id?: number): this;
    once(event: string, fn: (...args: unknown[]) => void, id?: number): this;
    off(event: string, fn?: (...args: unknown[]) => void, id?: number): this;
  }

  namespace Howler {
    function mute(muted: boolean): typeof Howler;
    function volume(vol?: number): typeof Howler | number;
    const ctx: AudioContext | null;
  }
}
