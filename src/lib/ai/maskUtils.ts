// Utilities to normalize segmentation outputs to a binary Float32Array mask

export async function extractBestBinaryMaskFromSegments(segments: any, width: number, height: number): Promise<Float32Array | null> {
  try {
    const segs: any[] = Array.isArray(segments) ? segments : [segments];
    let bestMask: Float32Array | null = null;
    let bestScore = -Infinity;

    for (const s of segs) {
      const m = s?.mask ?? s;
      const bin = await toBinaryMask(m, width, height);
      if (!bin) continue;
      // Score by total foreground pixels (area)
      const score = bin.reduce((acc, v) => acc + (v > 0.5 ? 1 : 0), 0);
      if (score > bestScore) {
        bestScore = score;
        bestMask = bin;
      }
    }
    return bestMask;
  } catch (e) {
    console.warn('extractBestBinaryMaskFromSegments failed:', e);
    return null;
  }
}

async function toBinaryMask(src: any, width: number, height: number): Promise<Float32Array | null> {
  try {
    // Case 1: Float32Array/Uint8Array length matches
    if (src && (src instanceof Float32Array || src instanceof Uint8Array)) {
      const arr = src as Float32Array | Uint8Array;
      const out = new Float32Array(width * height);
      const factor = 1 / (arr instanceof Uint8Array ? 255 : 1);
      for (let i = 0; i < out.length && i < arr.length; i++) out[i] = (arr as any)[i] * factor;
      return out;
    }

    // Case 2: ImageData
    if (src && typeof ImageData !== 'undefined' && src instanceof ImageData) {
      const data = src.data as Uint8ClampedArray; // RGBA
      const out = new Float32Array(width * height);
      for (let i = 0; i < width * height; i++) {
        const a = data[i * 4 + 3];
        out[i] = a / 255;
      }
      return out;
    }

    // Case 3: HTMLCanvasElement
    if (src && typeof HTMLCanvasElement !== 'undefined' && src instanceof HTMLCanvasElement) {
      const ctx = src.getContext('2d');
      if (!ctx) return null;
      const img = ctx.getImageData(0, 0, width, height);
      return toBinaryMask(img, width, height);
    }

    // Case 4: data URL string
    if (src && typeof src === 'string' && src.startsWith('data:')) {
      const img = await loadImage(src);
      const c = document.createElement('canvas');
      c.width = width;
      c.height = height;
      const ctx = c.getContext('2d');
      if (!ctx) return null;
      ctx.drawImage(img, 0, 0, width, height);
      const id = ctx.getImageData(0, 0, width, height);
      return toBinaryMask(id, width, height);
    }

    // Unknown
    return null;
  } catch (e) {
    console.warn('toBinaryMask failed:', e);
    return null;
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}
