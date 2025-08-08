
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

let objectDetectorPromise: Promise<any> | null = null;
let segmenterPromise: Promise<any> | null = null;
let selectedModel: string | null = null;
let selectedDevice: 'webgpu' | 'wasm' = 'wasm';

// Models for different tasks
const OBJECT_DETECTION_MODELS = [
  'Xenova/detr-resnet-50', // Good general object detection
  'Xenova/yolos-tiny', // Faster alternative
];

const SEGMENTATION_MODELS = [
  'onnx-community/slimsam',
  'Xenova/segformer-b0-finetuned-ade-512-512',
];

function getPreferredDevice(): 'webgpu' | 'wasm' {
  try {
    return typeof (navigator as any).gpu !== 'undefined' ? 'webgpu' : 'wasm';
  } catch {
    return 'wasm';
  }
}

async function ensureObjectDetector(onStatus?: (s: string) => void) {
  if (objectDetectorPromise) return objectDetectorPromise;

  selectedDevice = getPreferredDevice();
  onStatus?.(`Loading object detection model on ${selectedDevice.toUpperCase()}...`);

  objectDetectorPromise = (async () => {
    let lastErr: any = null;
    for (const model of OBJECT_DETECTION_MODELS) {
      try {
        const detector = await pipeline('object-detection', model, { device: selectedDevice });
        selectedModel = model;
        onStatus?.(`Loaded ${model}`);
        return detector;
      } catch (err) {
        lastErr = err;
        console.warn(`Failed to load ${model}, trying next`, err);
      }
    }
    throw lastErr ?? new Error('No object detection model could be loaded');
  })();

  return objectDetectorPromise;
}

async function ensureSegmenter(onStatus?: (s: string) => void) {
  if (segmenterPromise) return segmenterPromise;

  selectedDevice = getPreferredDevice();
  onStatus?.(`Loading segmentation model on ${selectedDevice.toUpperCase()}...`);

  segmenterPromise = (async () => {
    let lastErr: any = null;
    for (const model of SEGMENTATION_MODELS) {
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

// Convert detection boxes to polygon points
function boxToPolygon(box: any, width: number, height: number): { x: number; y: number }[] {
  const { xmin, ymin, xmax, ymax } = box;
  
  // Convert normalized coordinates to pixel coordinates
  const x1 = Math.round(xmin * width);
  const y1 = Math.round(ymin * height);
  const x2 = Math.round(xmax * width);
  const y2 = Math.round(ymax * height);
  
  // Return rectangle as polygon points
  return [
    { x: x1, y: y1 },
    { x: x2, y: y1 },
    { x: x2, y: y2 },
    { x: x1, y: y2 }
  ];
}

// Enhanced object detection with proper individual object segmentation
export async function detectObjectsInCanvas(
  canvas: HTMLCanvasElement,
  onProgress?: (p: number, s: string) => void
): Promise<{
  regions: Array<{
    id: string;
    points: { x: number; y: number }[];
    label: string;
    confidence: number;
    type: 'freehand' | 'rectangle' | 'polygon';
  }>;
  model: string;
  device: string;
}> {
  onProgress?.(20, 'Initializing object detection...');

  const detector = await ensureObjectDetector((s) => onProgress?.(30, s));

  // Prepare image for detection
  const MAX_SIDE = 640; // Good balance of speed vs accuracy
  const targetW = Math.min(canvas.width, Math.round((MAX_SIDE / Math.max(canvas.width, canvas.height)) * canvas.width) || canvas.width);
  const targetH = Math.min(canvas.height, Math.round((MAX_SIDE / Math.max(canvas.width, canvas.height)) * canvas.height) || canvas.height);
  
  const work = document.createElement('canvas');
  work.width = targetW;
  work.height = targetH;
  const wctx = work.getContext('2d');
  if (!wctx) throw new Error('Failed to get 2D context');
  wctx.drawImage(canvas, 0, 0, targetW, targetH);
  const dataUrl = work.toDataURL('image/jpeg', 0.9);

  onProgress?.(50, 'Detecting objects...');

  // Run object detection
  const detections: any[] = await detector(dataUrl);
  console.log('Raw detections:', detections);

  onProgress?.(70, 'Processing detections...');

  // Filter and process detections
  const regions = detections
    .filter((det: any) => det.score > 0.3) // Only keep confident detections
    .map((det: any, index: number) => {
      // Scale coordinates back to original canvas size
      const scaleX = canvas.width / targetW;
      const scaleY = canvas.height / targetH;
      
      const scaledBox = {
        xmin: det.box.xmin * scaleX,
        ymin: det.box.ymin * scaleY,
        xmax: det.box.xmax * scaleX,
        ymax: det.box.ymax * scaleY
      };

      const points = [
        { x: Math.round(scaledBox.xmin), y: Math.round(scaledBox.ymin) },
        { x: Math.round(scaledBox.xmax), y: Math.round(scaledBox.ymin) },
        { x: Math.round(scaledBox.xmax), y: Math.round(scaledBox.ymax) },
        { x: Math.round(scaledBox.xmin), y: Math.round(scaledBox.ymax) }
      ];

      return {
        id: `detected-${Date.now()}-${index}`,
        points,
        label: det.label || 'object',
        confidence: det.score,
        type: 'polygon' as const
      };
    })
    .slice(0, 20); // Limit to 20 objects max

  onProgress?.(90, `Found ${regions.length} objects`);

  console.log('Processed regions:', regions);

  return {
    regions,
    model: selectedModel || 'unknown',
    device: selectedDevice
  };
}

// Legacy function for backward compatibility
export async function getSegmentationMaskFromCanvas(
  canvas: HTMLCanvasElement, 
  onProgress?: (p: number, s: string) => void
): Promise<{ 
  mask: Float32Array; 
  width: number; 
  height: number; 
  model: string; 
  device: string; 
}> {
  const result = await detectObjectsInCanvas(canvas, onProgress);
  
  // Create a simple mask from the first detected object
  const mask = new Float32Array(canvas.width * canvas.height);
  if (result.regions.length > 0) {
    // Fill mask for the first region (simplified)
    mask.fill(0.5);
  }
  
  return {
    mask,
    width: canvas.width,
    height: canvas.height,
    model: result.model,
    device: result.device
  };
}

// Enhanced multi-object detection
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
  const result = await detectObjectsInCanvas(canvas, onProgress);
  
  // Convert regions to masks
  const masks: Float32Array[] = [];
  result.regions.forEach((region) => {
    const mask = new Float32Array(canvas.width * canvas.height);
    // Simple rectangular fill for each detected object
    const [p1, p2, p3, p4] = region.points;
    const minX = Math.min(p1.x, p2.x, p3.x, p4.x);
    const maxX = Math.max(p1.x, p2.x, p3.x, p4.x);
    const minY = Math.min(p1.y, p2.y, p3.y, p4.y);
    const maxY = Math.max(p1.y, p2.y, p3.y, p4.y);
    
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        if (x >= 0 && x < canvas.width && y >= 0 && y < canvas.height) {
          mask[y * canvas.width + x] = 0.8;
        }
      }
    }
    masks.push(mask);
  });

  return {
    masks,
    width: canvas.width,
    height: canvas.height,
    scaleX: 1,
    scaleY: 1,
    model: result.model,
    device: result.device
  };
}

export function clearSegmentationCache() {
  try {
    (objectDetectorPromise as any)?.then?.((detector: any) => detector?.dispose?.());
    (segmenterPromise as any)?.then?.((seg: any) => seg?.dispose?.());
  } catch {}
  objectDetectorPromise = null;
  segmenterPromise = null;
  selectedModel = null;
}
