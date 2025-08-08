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

  // Optionally downscale for speed/memory
  const MAX_SIDE = 512;
  const targetW = Math.min(canvas.width, Math.round((MAX_SIDE / Math.max(canvas.width, canvas.height)) * canvas.width) || canvas.width);
  const targetH = Math.min(canvas.height, Math.round((MAX_SIDE / Math.max(canvas.width, canvas.height)) * canvas.height) || canvas.height);
  const scaleX = canvas.width / targetW;
  const scaleY = canvas.height / targetH;

  const work = document.createElement('canvas');
  work.width = targetW;
  work.height = targetH;
  const wctx = work.getContext('2d');
  if (!wctx) throw new Error('Failed to get 2D context');
  wctx.drawImage(canvas, 0, 0, targetW, targetH);

  // Convert canvas to base64 for transformers.js input
  const dataUrl = work.toDataURL('image/jpeg', 0.85);

  // If SlimSAM is available, run Auto-Mask with grid prompts to get multiple parts.
  const useAutoMask = (selectedModel || '').includes('slimsam');

  if (useAutoMask) {
    onProgress?.(55, 'Auto-Mask: probing regions...');

    // Grid of foreground prompts (positive label = 1)
    const GRID_X = 6; // 6x6 = 36 probes (balanced quality/speed)
    const GRID_Y = 6;
    const marginX = Math.round(targetW * 0.08);
    const marginY = Math.round(targetH * 0.08);

    const xs: number[] = [];
    const ys: number[] = [];
    for (let i = 0; i < GRID_X; i++) xs.push(Math.round(marginX + (i + 0.5) * (targetW - 2 * marginX) / GRID_X));
    for (let j = 0; j < GRID_Y; j++) ys.push(Math.round(marginY + (j + 0.5) * (targetH - 2 * marginY) / GRID_Y));

    const expected = targetW * targetH;
    const agg = new Float32Array(expected);

    let step = 0;
    const total = GRID_X * GRID_Y;

    for (const y of ys) {
      for (const x of xs) {
        step++;
        onProgress?.(55 + Math.round((step / total) * 10), `Auto-Mask probe ${step}/${total}`);
        try {
          const result: any = await (seg as any)(dataUrl, {
            points: [[x, y]],
            labels: [1],
          });

          const item = Array.isArray(result) ? result[0] : result;
          const raw: Float32Array | undefined = item?.mask?.data as Float32Array | undefined;
          if (!raw || raw.length === 0) continue;

          // Resample probe mask to working size if needed (nearest-neighbor)
          let resampled: Float32Array;
          if (raw.length !== expected) {
            const srcLen = raw.length;
            const srcDim = Math.round(Math.sqrt(srcLen));
            const srcW = srcDim;
            const srcH = srcDim;
            resampled = new Float32Array(expected);
            for (let yy = 0; yy < targetH; yy++) {
              const sy = Math.min(srcH - 1, Math.round((yy / targetH) * srcH));
              for (let xx = 0; xx < targetW; xx++) {
                const sx = Math.min(srcW - 1, Math.round((xx / targetW) * srcW));
                resampled[yy * targetW + xx] = raw[sy * srcW + sx] ?? 0;
              }
            }
          } else {
            resampled = raw;
          }

          // Aggregate using max to keep distinct parts
          for (let i = 0; i < expected; i++) {
            const v = resampled[i];
            if (v > agg[i]) agg[i] = v;
          }
        } catch (e) {
          // Ignore single probe failures to keep UX smooth
          console.warn('Auto-Mask probe failed', e);
        }
      }
    }

    // Upsample back to original canvas size
    const outExpected = canvas.width * canvas.height;
    let outMask = new Float32Array(outExpected);
    for (let y = 0; y < canvas.height; y++) {
      const sy = Math.min(targetH - 1, Math.round(y / scaleY));
      for (let x = 0; x < canvas.width; x++) {
        const sx = Math.min(targetW - 1, Math.round(x / scaleX));
        outMask[y * canvas.width + x] = agg[sy * targetW + sx] ?? 0;
      }
    }

    onProgress?.(70, 'Segmentation complete');
    return { mask: outMask, width: canvas.width, height: canvas.height, model: selectedModel || 'unknown', device: selectedDevice };
  }

  // Fallback: single-pass semantic segmentation (SegFormer)
  onProgress?.(55, 'Running segmentation...');
  const result: any = await (seg as any)(dataUrl);
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

export async function getAutoMasksFromCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number, s: string) => void
): Promise<{
  masks: Float32Array[];
  width: number;
  height: number;
  scaleX: number;
  scaleY: number;
  model: string;
  device: string;
}> {
  const seg = await ensureSegmenter((s) => onProgress?.(45, s));

  // Downscale for speed/memory
  const MAX_SIDE = 512;
  const targetW = Math.min(canvas.width, Math.round((MAX_SIDE / Math.max(canvas.width, canvas.height)) * canvas.width) || canvas.width);
  const targetH = Math.min(canvas.height, Math.round((MAX_SIDE / Math.max(canvas.width, canvas.height)) * canvas.height) || canvas.height);
  const scaleX = canvas.width / targetW;
  const scaleY = canvas.height / targetH;

  const work = document.createElement('canvas');
  work.width = targetW;
  work.height = targetH;
  const wctx = work.getContext('2d');
  if (!wctx) throw new Error('Failed to get 2D context');
  wctx.drawImage(canvas, 0, 0, targetW, targetH);
  const dataUrl = work.toDataURL('image/jpeg', 0.85);

  const masks: Float32Array[] = [];

  const useAutoMask = (selectedModel || '').includes('slimsam');
  if (!useAutoMask) {
    // Fallback: single semantic mask
    const single = await getSegmentationMaskFromCanvas(canvas, onProgress);
    // Resample to work size if needed
    const expected = targetW * targetH;
    let resampled = new Float32Array(expected);
    const srcW = single.width, srcH = single.height;
    for (let y = 0; y < targetH; y++) {
      const sy = Math.min(srcH - 1, Math.round((y / targetH) * srcH));
      for (let x = 0; x < targetW; x++) {
        const sx = Math.min(srcW - 1, Math.round((x / targetW) * srcW));
        resampled[y * targetW + x] = single.mask[sy * srcW + sx] ?? 0;
      }
    }
    masks.push(resampled);
    return { masks, width: targetW, height: targetH, scaleX, scaleY, model: selectedModel || 'unknown', device: selectedDevice };
  }

  onProgress?.(55, 'Auto-Mask: probing regions...');
  // Grid probes
  const GRID_X = 5;
  const GRID_Y = 5;
  const marginX = Math.round(targetW * 0.08);
  const marginY = Math.round(targetH * 0.08);
  const xs: number[] = [];
  const ys: number[] = [];
  for (let i = 0; i < GRID_X; i++) xs.push(Math.round(marginX + (i + 0.5) * (targetW - 2 * marginX) / GRID_X));
  for (let j = 0; j < GRID_Y; j++) ys.push(Math.round(marginY + (j + 0.5) * (targetH - 2 * marginY) / GRID_Y));

  const expected = targetW * targetH;
  type Box = { x1: number; y1: number; x2: number; y2: number };
  const boxes: Box[] = [];
  const iou = (a: Box, b: Box) => {
    const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
    const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
    const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
    const inter = iw * ih;
    const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
    const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
    const uni = areaA + areaB - inter;
    return uni > 0 ? inter / uni : 0;
  };

  let step = 0; const total = GRID_X * GRID_Y;
  for (const y of ys) {
    for (const x of xs) {
      step++;
      onProgress?.(55 + Math.round((step / total) * 10), `Auto-Mask probe ${step}/${total}`);
      try {
        const result: any = await (seg as any)(dataUrl, { points: [[x, y]], labels: [1] });
        const item = Array.isArray(result) ? result[0] : result;
        const raw: Float32Array | undefined = item?.mask?.data as Float32Array | undefined;
        if (!raw || raw.length === 0) continue;

        let resampled: Float32Array;
        if (raw.length !== expected) {
          const srcDim = Math.round(Math.sqrt(raw.length));
          const srcW = srcDim, srcH = srcDim;
          resampled = new Float32Array(expected);
          for (let yy = 0; yy < targetH; yy++) {
            const sy = Math.min(srcH - 1, Math.round((yy / targetH) * srcH));
            for (let xx = 0; xx < targetW; xx++) {
              const sx = Math.min(srcW - 1, Math.round((xx / targetW) * srcW));
              resampled[yy * targetW + xx] = raw[sy * srcW + sx] ?? 0;
            }
          }
        } else {
          resampled = raw;
        }

        // Compute bbox at threshold to deduplicate and filter skinny stripes
        const thr = 0.5;
        let x1 = targetW, y1 = targetH, x2 = 0, y2 = 0, count = 0;
        for (let yy = 0; yy < targetH; yy++) {
          for (let xx = 0; xx < targetW; xx++) {
            const v = resampled[yy * targetW + xx];
            if (v >= thr) {
              count++;
              if (xx < x1) x1 = xx; if (xx > x2) x2 = xx;
              if (yy < y1) y1 = yy; if (yy > y2) y2 = yy;
            }
          }
        }
        if (count < 60) continue; // too small
        const bw = x2 - x1, bh = y2 - y1;
        if (bw < 6 || bh < 6) continue; // stripe-like
        const box = { x1, y1, x2, y2 };
        if (boxes.some((b) => iou(b, box) > 0.7)) continue; // duplicate

        boxes.push(box);
        masks.push(resampled);
        if (masks.length >= 20) break;
      } catch (e) {
        console.warn('Auto-Mask probe failed', e);
      }
    }
    if (masks.length >= 20) break;
  }

  return { masks, width: targetW, height: targetH, scaleX, scaleY, model: selectedModel || 'unknown', device: selectedDevice };
}

export function clearSegmentationCache() {
  try {
    (segmenterPromise as any)?.then?.((seg: any) => seg?.dispose?.());
  } catch {}
  segmenterPromise = null;
  selectedModel = null;
}
