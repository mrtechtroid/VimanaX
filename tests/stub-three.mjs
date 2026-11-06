// Re-exports real three but swaps WebGLRenderer for a no-op so the app can boot without a GPU.
export * from '../node_modules/three/build/three.module.js';
export class WebGLRenderer { constructor({ canvas }) { this.domElement = canvas; this.calls = 0; this.shadowMap = {}; } setPixelRatio() {} setSize() {} render() { this.calls++; } }
