// src/lib/ai/sam2-segmentation.ts

import { SamModel, AutoProcessor, RawImage } from '@huggingface/transformers';

interface Point {
    x: number;
    y: number;
}

interface Region {
    id: string;
    points: Point[];
    color?: string;
    outlineColor?: string;
    texture?: string;
    filled: boolean;
    type: 'freehand' | 'rectangle' | 'polygon';
    confidence?: number;
}

interface SegmentationResult {
    mask: Float32Array;
    width: number;
    height: number;
    iouScore: number;
    confidence: number;
}

interface AutoSegmentationResult {
    mask: Float32Array;
    width: number;
    height: number;
    confidence: number;
    id: string;
}

interface ProgressCallback {
    status: string;
    progress: number;
}

class SAM2ImageSegmentation {
    private model: any = null;
    private processor: any = null;
    private isLoading: boolean = false;
    private isInitialized: boolean = false;
    private modelIdUsed: string | null = null;
    private readonly modelCandidates: string[] = [
        'Xenova/slimsam-77-uniform',
        'Xenova/mobile-sam',
        'Xenova/segment-anything'
    ];

    async initialize(onProgress?: (progress: ProgressCallback) => void): Promise<void> {
        if (this.isInitialized) return;
        if (this.isLoading) throw new Error('Model is already loading');

        this.isLoading = true;

        const tried: string[] = [];
        try {
            for (const candidate of this.modelCandidates) {
                try {
                    onProgress?.({ status: `Loading model ${candidate}...`, progress: 10 });
                    this.model = await SamModel.from_pretrained(candidate, {
                        device: 'webgpu',
                    });
                    onProgress?.({ status: 'Loading processor...', progress: 70 });
                    this.processor = await AutoProcessor.from_pretrained(candidate);
                    this.modelIdUsed = candidate;
                    this.isInitialized = true;
                    onProgress?.({ status: 'Model ready!', progress: 100 });
                    return;
                } catch (err) {
                    tried.push(candidate);
                    // Try next candidate
                }
            }
            throw new Error(`Could not load any SAM model. Tried: ${tried.join(', ')}`);
        } catch (error) {
            console.error('Failed to initialize SAM/SAM2:', error);
            throw error;
        } finally {
            this.isLoading = false;
        }
    }

    async segmentFromPoints(
        imageElement: HTMLImageElement,
        points: number[][],
        labels?: number[]
    ): Promise<SegmentationResult> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            // Convert HTML image element to RawImage
            const image = await RawImage.fromURL(imageElement.src);

            // Default labels if not provided (1 = foreground, 0 = background)
            if (!labels) {
                labels = new Array(points.length).fill(1);
            }

            // Prepare inputs
            const inputs = await this.processor(image, {
                input_points: [points],
                input_labels: [labels],
            });

            // Run inference
            const outputs = await this.model(inputs);

            // Post-process masks to image size
            const masks = await this.processor.post_process_masks(
                outputs.pred_masks,
                inputs.original_sizes,
                inputs.reshaped_input_sizes
            );

            const scores = outputs.iou_scores.data as Float32Array;
            let bestIdx = 0;
            for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bestIdx]) bestIdx = i;

            const bestMask: any = (masks as any)[0][bestIdx];
            const w = bestMask.dims[1];
            const h = bestMask.dims[0];
            const data = bestMask.data as Uint8Array;
            const mask = new Float32Array(data.length);
            for (let i = 0; i < data.length; i++) mask[i] = data[i] ? 1 : 0;

            return {
                mask,
                width: w,
                height: h,
                iouScore: scores[bestIdx],
                confidence: scores[bestIdx]
            };
        } catch (error) {
            console.error('Segmentation failed:', error);
            throw error;
        }
    }

    async segmentFromBox(imageElement: HTMLImageElement, box: number[]): Promise<SegmentationResult> {
        if (!this.isInitialized) {
            await this.initialize();
        }

        try {
            const image = await RawImage.fromURL(imageElement.src);

            // Box format: [x1, y1, x2, y2]
            const inputs = await this.processor(image, {
                input_boxes: [[box]]
            });

            const outputs = await this.model(inputs);
            const masks = await this.processor.post_process_masks(
                outputs.pred_masks,
                inputs.original_sizes,
                inputs.reshaped_input_sizes
            );

            const scores = outputs.iou_scores.data as Float32Array;
            let bestIdx = 0;
            for (let i = 1; i < scores.length; i++) if (scores[i] > scores[bestIdx]) bestIdx = i;

            const bestMask: any = (masks as any)[0][bestIdx];
            const w = bestMask.dims[1];
            const h = bestMask.dims[0];
            const data = bestMask.data as Uint8Array;
            const mask = new Float32Array(data.length);
            for (let i = 0; i < data.length; i++) mask[i] = data[i] ? 1 : 0;

            return {
                mask,
                width: w,
                height: h,
                iouScore: scores[bestIdx],
                confidence: scores[bestIdx]
            };
        } catch (error) {
            console.error('Box segmentation failed:', error);
            throw error;
        }
    }

    async automaticSegmentation(
        imageElement: HTMLImageElement,
        onProgress?: (progress: ProgressCallback) => void
    ): Promise<AutoSegmentationResult[]> {
        if (!this.isInitialized) {
            await this.initialize(onProgress);
        }

        try {
            onProgress?.({ status: 'Processing image...', progress: 20 });

            const image = await RawImage.fromURL(imageElement.src);

            onProgress?.({ status: 'Generating automatic masks...', progress: 50 });

            // For automatic segmentation, we'll use a grid of points
            const width = image.width;
            const height = image.height;
            const gridSize = 32;

            const points: number[][] = [];
            for (let y = gridSize; y < height; y += gridSize) {
                for (let x = gridSize; x < width; x += gridSize) {
                    points.push([x, y]);
                }
            }

            const inputs = await this.processor(image, {
                input_points: [points],
                input_labels: [new Array(points.length).fill(1)],
            });

            onProgress?.({ status: 'Running segmentation...', progress: 80 });

            const outputs = await this.model(inputs);
            const masksOut: any = await this.processor.post_process_masks(
                outputs.pred_masks,
                inputs.original_sizes,
                inputs.reshaped_input_sizes
            );
            const scores = outputs.iou_scores.data as Float32Array;

            onProgress?.({ status: 'Processing results...', progress: 90 });

            // Convert masks to usable format
            const results: AutoSegmentationResult[] = [];
            const batch = (masksOut as any)[0];
            const count = Array.isArray(batch) ? batch.length : 0;
            for (let i = 0; i < count; i++) {
                const maskT = batch[i];
                const score = scores[i] ?? 0;
                if (score > 0.5) {
                    const data = maskT.data as Uint8Array;
                    const mask = new Float32Array(data.length);
                    for (let j = 0; j < data.length; j++) mask[j] = data[j] ? 1 : 0;
                    results.push({
                        mask,
                        width: maskT.dims[1],
                        height: maskT.dims[0],
                        confidence: score,
                        id: `auto-${i}`,
                    });
                }
            }

            onProgress?.({ status: 'Complete!', progress: 100 });

            return results;
        } catch (error) {
            console.error('Automatic segmentation failed:', error);
            throw error;
        }
    }

    // Convert mask data to polygon points
    maskToPolygon(maskData: Float32Array, width: number, height: number, threshold: number = 0.5): Point[] {
        const contours = this.findContours(maskData, width, height, threshold);
        if (contours.length === 0) return [];

        // Find the largest contour
        let largestContour = contours[0];
        let maxArea = this.calculateArea(largestContour);

        for (let i = 1; i < contours.length; i++) {
            const area = this.calculateArea(contours[i]);
            if (area > maxArea) {
                maxArea = area;
                largestContour = contours[i];
            }
        }

        // Simplify the contour using Douglas-Peucker algorithm
        return this.simplifyPolygon(largestContour, 2.0);
    }

    private findContours(maskData: Float32Array, width: number, height: number, threshold: number): Point[][] {
        const binary = new Uint8Array(width * height);

        // Convert to binary
        for (let i = 0; i < maskData.length; i++) {
            binary[i] = maskData[i] > threshold ? 1 : 0;
        }

        const contours: Point[][] = [];
        const visited = new Set<number>();

        for (let y = 0; y < height - 1; y++) {
            for (let x = 0; x < width - 1; x++) {
                const idx = y * width + x;
                if (binary[idx] === 1 && !visited.has(idx)) {
                    const contour = this.traceContour(binary, width, height, x, y, visited);
                    if (contour.length > 10) { // Filter very small contours
                        contours.push(contour);
                    }
                }
            }
        }

        return contours;
    }

    private traceContour(
        binary: Uint8Array,
        width: number,
        height: number,
        startX: number,
        startY: number,
        visited: Set<number>
    ): Point[] {
        const contour: Point[] = [];
        const directions: [number, number][] = [
            [1, 0], [1, 1], [0, 1], [-1, 1],
            [-1, 0], [-1, -1], [0, -1], [1, -1]
        ];

        let x = startX;
        let y = startY;
        let dir = 0;

        do {
            contour.push({ x, y });
            visited.add(y * width + x);

            // Find next contour point
            let found = false;
            for (let i = 0; i < 8; i++) {
                const newDir = (dir + i) % 8;
                const [dx, dy] = directions[newDir];
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const idx = ny * width + nx;
                    if (binary[idx] === 1) {
                        x = nx;
                        y = ny;
                        dir = (newDir + 6) % 8; // Turn left
                        found = true;
                        break;
                    }
                }
            }

            if (!found) break;
        } while (!(x === startX && y === startY) && contour.length < 10000);

        return contour;
    }

    private calculateArea(points: Point[]): number {
        if (points.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }
        return Math.abs(area) / 2;
    }

    private simplifyPolygon(points: Point[], tolerance: number): Point[] {
        if (points.length <= 2) return points;

        const simplified = this.douglasPeucker(points, tolerance);
        return simplified.length >= 3 ? simplified : points;
    }

    private douglasPeucker(points: Point[], epsilon: number): Point[] {
        if (points.length <= 2) return points;

        let maxDistance = 0;
        let maxIndex = 0;
        const end = points.length - 1;

        for (let i = 1; i < end; i++) {
            const distance = this.pointToLineDistance(
                points[i],
                points[0],
                points[end]
            );
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance > epsilon) {
            const left = this.douglasPeucker(
                points.slice(0, maxIndex + 1),
                epsilon
            );
            const right = this.douglasPeucker(
                points.slice(maxIndex),
                epsilon
            );

            return left.slice(0, -1).concat(right);
        }

        return [points[0], points[end]];
    }

    private pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
        const A = lineEnd.x - lineStart.x;
        const B = lineEnd.y - lineStart.y;
        const C = point.x - lineStart.x;
        const D = point.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = A * A + B * B;

        if (lenSq === 0) {
            return Math.sqrt(C * C + D * D);
        }

        const param = dot / lenSq;
        let xx: number, yy: number;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * A;
            yy = lineStart.y + param * B;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    dispose(): void {
        if (this.model) {
            this.model.dispose();
            this.model = null;
        }
        this.processor = null;
        this.isInitialized = false;
    }
}

// Export singleton instance
export const sam2Segmentation = new SAM2ImageSegmentation();

// Helper functions for integration with your existing code
export async function segmentWithSAM2Points(
    imageElement: HTMLImageElement,
    points: number[][],
    onProgress?: (progress: ProgressCallback) => void
): Promise<Region> {
    try {
        const result = await sam2Segmentation.segmentFromPoints(imageElement, points);

        // Convert to your region format
        const polygonPoints = sam2Segmentation.maskToPolygon(
            result.mask,
            result.width,
            result.height
        );

        return {
            id: `sam2-${Date.now()}`,
            points: polygonPoints,
            confidence: result.confidence,
            type: 'polygon',
            filled: false,
            outlineColor: '#60a5fa'
        };
    } catch (error) {
        console.error('SAM2 point segmentation failed:', error);
        throw error;
    }
}

export async function segmentWithSAM2Box(
    imageElement: HTMLImageElement,
    box: number[],
    onProgress?: (progress: ProgressCallback) => void
): Promise<Region> {
    try {
        const result = await sam2Segmentation.segmentFromBox(imageElement, box);

        const polygonPoints = sam2Segmentation.maskToPolygon(
            result.mask,
            result.width,
            result.height
        );

        return {
            id: `sam2-box-${Date.now()}`,
            points: polygonPoints,
            confidence: result.confidence,
            type: 'polygon',
            filled: false,
            outlineColor: '#60a5fa'
        };
    } catch (error) {
        console.error('SAM2 box segmentation failed:', error);
        throw error;
    }
}

export async function automaticSegmentWithSAM2(
    imageElement: HTMLImageElement,
    onProgress?: (progress: ProgressCallback) => void
): Promise<Region[]> {
    try {
        const results = await sam2Segmentation.automaticSegmentation(imageElement, onProgress);

        const regions: Region[] = [];
        for (let i = 0; i < results.length && i < 20; i++) { // Limit to 20 regions
            const result = results[i];
            const polygonPoints = sam2Segmentation.maskToPolygon(
                result.mask,
                result.width,
                result.height
            );

            if (polygonPoints.length >= 3) {
                regions.push({
                    id: `sam2-auto-${Date.now()}-${i}`,
                    points: polygonPoints,
                    confidence: result.confidence,
                    type: 'polygon',
                    filled: false,
                    outlineColor: `hsl(${(i * 360 / results.length)}, 70%, 60%)`
                });
            }
        }

        return regions;
    } catch (error) {
        console.error('SAM2 automatic segmentation failed:', error);
        throw error;
    }
}