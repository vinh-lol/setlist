// Minimal types for Butterchurn (MIT, https://github.com/jberg/butterchurn).
declare module "butterchurn" {
  export interface Visualizer {
    connectAudio(node: AudioNode): void;
    disconnectAudio(node: AudioNode): void;
    loadPreset(preset: object, blendSeconds: number): void;
    setRendererSize(width: number, height: number, opts?: object): void;
    render(opts?: {
      elapsedTime?: number;
      audioLevels?: { timeByteArray: Uint8Array; timeByteArrayL: Uint8Array; timeByteArrayR: Uint8Array };
    }): void;
  }
  const butterchurn: {
    createVisualizer(ctx: AudioContext, canvas: HTMLCanvasElement, opts: { width: number; height: number; pixelRatio?: number; textureRatio?: number }): Visualizer;
  };
  export default butterchurn;
}
declare module "butterchurn-presets" {
  const presets: { getPresets(): Record<string, object> };
  export default presets;
}
