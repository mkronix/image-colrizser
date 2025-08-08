import { contours as d3Contours } from 'd3-contour';

export type Point = { x: number; y: number };

function polygonArea(points: Point[]): number {
  let area = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const p1 = points[j];
    const p2 = points[i];
    area += (p1.x * p2.y - p2.x * p1.y);
  }
  return Math.abs(area / 2);
}

function rdp(points: Point[], eps: number): Point[] {
  if (points.length <= 2) return points;
  let dmax = 0;
  let index = 0;
  const end = points.length - 1;

  const dist = (p: Point, a: Point, b: Point) => {
    const num = Math.abs((b.y - a.y) * p.x - (b.x - a.x) * p.y + b.x * a.y - b.y * a.x);
    const den = Math.hypot(b.y - a.y, b.x - a.x) || 1;
    return num / den;
  };

  for (let i = 1; i < end; i++) {
    const d = dist(points[i], points[0], points[end]);
    if (d > dmax) {
      index = i;
      dmax = d;
    }
  }

  if (dmax > eps) {
    const rec1 = rdp(points.slice(0, index + 1), eps);
    const rec2 = rdp(points.slice(index), eps);
    return rec1.slice(0, -1).concat(rec2);
  }
  return [points[0], points[end]];
}

// Convert a binary mask [0..1] to a simplified polygon using d3-contour
export function maskToPolygon(mask: Float32Array, width: number, height: number, simplify = 2): Point[] {
  // d3-contour expects a flat array of values row-major
  const contours = d3Contours()
    .size([width, height])
    .thresholds([0.5])(Array.from(mask));

  if (!contours.length) return [];

  // Each contour may contain multiple polygons (rings). Pick the largest ring overall
  let best: Point[] = [];
  let bestArea = 0;

  for (const c of contours) {
    // c.coordinates: MultiPolygon => number[][][]
    for (const poly of c.coordinates) {
      for (const ring of poly) {
        const pts: Point[] = ring.map(([x, y]) => ({ x, y }));
        const area = polygonArea(pts);
        if (area > bestArea) {
          bestArea = area;
          best = pts;
        }
      }
    }
  }

  if (best.length === 0) return [];

  // Simplify
  const simplified = rdp(best, simplify);
  return simplified;
}
