import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false; // always fetch from hub/CDN
env.useBrowserCache = true;   // cache in IndexedDB to avoid re-downloads

let segmenterPromise: Promise<any> | null = null;
let selectedModel: string | null = null;
let selectedDevice: 'webgpu' | 'wasm' = 'wasm';

const CANDIDATE_MODELS = [
  // Try SlimSAM first; fall back to a small, reliable SegFormer model
  'onnx-community/slimsam',
  'Xenova/segformer-b0-finetuned-ade-512-512',
];

function getPreferredDevice(): 'webgpu' | 'wasm' {
  try {
    // WebGPU provides the best perf/memory when available
    return typeof (navigator as any).gpu !== 'undefined' ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

async function ensureSegmenter(onStatus?: (s: string) => void) {
  if (segmenterPromise) return segmenterPromise;

  selectedDevice = getPreferredDevice();
  onStatus?.(`Loading model on ${selectedDevice.toUpperCase()}...`);

  segmenterPromise = (async () => {
    let lastErr: any = null;
    for (const model of CANDIDATE_MODELS) {
      try {
        const seg = await pipeline('image-segmentation', model, { device: selectedDevice });
        selectedModel = model;
        onStatus?.(`Loaded ${model}`);
        return seg;
      } catch (err) {
        lastErr = err;
        console.warn(`Failed to load ${model}, trying next`, err);
      }
    }
    throw lastErr ?? new Error('No segmentation model could be loaded');
  })();

  return segmenterPromise;
}

export async function getSegmentationMaskFromCanvas(canvas: HTMLCanvasElement, onProgress?: (p: number, s: string) => void): Promise<{ mask: Float32Array; width: number; height: number; model: string; device: string; }>{
  onProgress?.(35, 'Preparing image for model...');

  const seg = await ensureSegmenter((s) => onProgress?.(45, s));

  // Convert canvas to base64 for transformers.js input
  const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
  onProgress?.(55, 'Running segmentation...');

  const result: any = await seg(dataUrl);
  // Expect an array with at least one item containing a mask Float32Array
  const item = Array.isArray(result) ? result[0] : result;
  if (!item || !item.mask || !item.mask.data) {
    throw new Error('Invalid segmentation result: missing mask');
  }

  let mask: Float32Array = item.mask.data as Float32Array;
  const width = canvas.width;
  const height = canvas.height;

  // If mask resolution differs, resample to canvas size (nearest-neighbor)
  const expected = width * height;
  if (mask.length !== expected) {
    const srcLen = mask.length;
    const srcDim = Math.round(Math.sqrt(srcLen));
    const srcW = srcDim;
    const srcH = srcDim; // assume square if dims unknown
    const scaled = new Float32Array(expected);
    for (let y = 0; y < height; y++) {
      const sy = Math.min(srcH - 1, Math.round((y / height) * srcH));
      for (let x = 0; x < width; x++) {
        const sx = Math.min(srcW - 1, Math.round((x / width) * srcW));
        scaled[y * width + x] = mask[sy * srcW + sx];
      }
    }
    mask = scaled;
  }

  onProgress?.(70, 'Segmentation complete');
  return { mask, width, height, model: selectedModel || 'unknown', device: selectedDevice };
}

export function clearSegmentationCache() {
  try {
    (segmenterPromise as any)?.then?.((seg: any) => seg?.dispose?.());
  } catch {}
  segmenterPromise = null;
  selectedModel = null;
}
