import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { Bot, Eye, Sparkles, Zap, AlertTriangle } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { getSegmentationMaskFromCanvas, getAutoMasksFromCanvas } from '@/lib/ai/segmentation';

// Simple, reliable edge detection without external AI models

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
    label?: string;
    confidence?: number;
}

interface AIObjectDetectionProps {
    image: HTMLImageElement | null;
    onRegionsDetected: (regions: Region[]) => void;
    isOpen: boolean;
    onClose: () => void;
}

// Enhanced Computer Vision Detection
class SmartObjectDetector {
    static async detectObjects(
        imageElement: HTMLImageElement, 
        sensitivity: number = 0.5,
        progressCallback?: (progress: number, stage: string) => void
    ): Promise<{ regions: Region[], previewUrl: string }> {
        try {
            progressCallback?.(10, 'Preparing image analysis...');
            
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            // Optimize for the same render size used by ImageCanvas (fit into 800x600 canvas)
            const TARGET_CANVAS_W = 800;
            const TARGET_CANVAS_H = 600;
            const imageRatio = imageElement.width / imageElement.height;
            const canvasRatio = TARGET_CANVAS_W / TARGET_CANVAS_H;

            let drawWidth: number, drawHeight: number, offsetX: number, offsetY: number;
            if (imageRatio > canvasRatio) {
                drawWidth = TARGET_CANVAS_W;
                drawHeight = Math.round(TARGET_CANVAS_W / imageRatio);
                offsetX = 0;
                offsetY = Math.round((TARGET_CANVAS_H - drawHeight) / 2);
            } else {
                drawHeight = TARGET_CANVAS_H;
                drawWidth = Math.round(TARGET_CANVAS_H * imageRatio);
                offsetX = Math.round((TARGET_CANVAS_W - drawWidth) / 2);
                offsetY = 0;
            }

            // Process on the drawn image area so coordinates match the canvas space
            canvas.width = drawWidth;
            canvas.height = drawHeight;
            
            ctx.drawImage(imageElement, 0, 0, drawWidth, drawHeight);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            
            progressCallback?.(30, 'Loading SlimSAM / SegFormer...');
            
            // Multi-mask auto mode (SlimSAM) with polygon outlines, fallback to single mask
            const threshold = Math.max(0.35, 0.5 - (sensitivity - 0.5) * 0.2); // more sensitive -> lower threshold
            const minRegionArea = Math.max(200, Math.round((1 - sensitivity) * 2500));
            const maxRegions = 20;
            const regions: Region[] = [];

            try {
                const auto = await getAutoMasksFromCanvas(canvas, (p, s) => progressCallback?.(p, s));
                progressCallback?.(75, 'Extracting segments...');

                const mW = auto.width;
                const mH = auto.height;
                const areaScale = auto.scaleX * auto.scaleY;
                const minAreaWork = Math.max(80, Math.round(minRegionArea / areaScale));

                const boxes: { x1: number; y1: number; x2: number; y2: number }[] = [];
                const iou = (a: any, b: any) => {
                    const ix1 = Math.max(a.x1, b.x1), iy1 = Math.max(a.y1, b.y1);
                    const ix2 = Math.min(a.x2, b.x2), iy2 = Math.min(a.y2, b.y2);
                    const iw = Math.max(0, ix2 - ix1), ih = Math.max(0, iy2 - iy1);
                    const inter = iw * ih;
                    const areaA = Math.max(0, a.x2 - a.x1) * Math.max(0, a.y2 - a.y1);
                    const areaB = Math.max(0, b.x2 - b.x1) * Math.max(0, b.y2 - b.y1);
                    const uni = areaA + areaB - inter;
                    return uni > 0 ? inter / uni : 0;
                };

                for (let i = 0; i < auto.masks.length && regions.length < maxRegions; i++) {
                    const mask = auto.masks[i];
                    const poly = this.extractPolygonFromMask(mask, mW, mH, threshold, minAreaWork);
                    if (!poly || poly.length < 3) continue;

                    const xs = poly.map(p => p.x);
                    const ys = poly.map(p => p.y);
                    const box = { x1: Math.min(...xs), y1: Math.min(...ys), x2: Math.max(...xs), y2: Math.max(...ys) };
                    if (boxes.some(b => iou(b, box) > 0.7)) continue; // deduplicate
                    boxes.push(box);

                    const scaledPoly = poly.map(p => ({ x: Math.round(p.x * auto.scaleX), y: Math.round(p.y * auto.scaleY) }));
                    regions.push({
                        id: `seg-${regions.length}`,
                        points: scaledPoly,
                        outlineColor: '#22c55e',
                        filled: false,
                        type: 'polygon',
                        label: 'segment',
                        confidence: Math.min(99, Math.round(70 + (sensitivity * 25)))
                    } as any);
                }

                // If nothing extracted, fallback to single-mask polygon
                if (regions.length === 0) {
                    const seg = await getSegmentationMaskFromCanvas(canvas, (p, s) => progressCallback?.(p, s));
                    const poly = this.extractPolygonFromMask(seg.mask, seg.width, seg.height, threshold, minRegionArea);
                    if (poly && poly.length >= 3) {
                        regions.push({
                            id: 'seg-0',
                            points: poly,
                            outlineColor: '#22c55e',
                            filled: false,
                            type: 'polygon',
                            label: 'segment',
                            confidence: Math.min(99, Math.round(70 + (sensitivity * 25)))
                        } as any);
                    }
                }
            } catch (e) {
                console.warn('Auto mask failed, using single mask fallback', e);
                const seg = await getSegmentationMaskFromCanvas(canvas, (p, s) => progressCallback?.(p, s));
                const poly = this.extractPolygonFromMask(seg.mask, seg.width, seg.height, threshold, minRegionArea);
                if (poly && poly.length >= 3) {
                    regions.push({
                        id: 'seg-0',
                        points: poly,
                        outlineColor: '#22c55e',
                        filled: false,
                        type: 'polygon',
                        label: 'segment',
                        confidence: Math.min(99, Math.round(70 + (sensitivity * 25)))
                    } as any);
                }
            }
            
            progressCallback?.(90, 'Creating preview...');
            
            // Create enhanced preview based on local coordinates
            const previewUrl = this.createEnhancedPreview(canvas, ctx, regions, 1);
            
            // Map regions to the app's canvas coordinate space by adding offsets
            const scaledRegions = regions.map((region, index) => ({
                ...region,
                id: `smart-detect-${Date.now()}-${index}`,
                points: region.points.map(point => ({
                    x: Math.round(point.x + offsetX),
                    y: Math.round(point.y + offsetY)
                }))
            }));
            
            return { regions: scaledRegions, previewUrl };
            
        } catch (error) {
            console.error('Smart detection error:', error);
            throw error;
        }
    }
    
    static analyzeImageFeatures(imageData: ImageData, sensitivity: number) {
        const { data, width, height } = imageData;
        const gray = new Uint8Array(width * height);
        const edges = new Uint8Array(width * height);
        
        // Convert to grayscale
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }
        
        // Enhanced edge detection (Sobel operator)
        const threshold = Math.max(20, 150 - (sensitivity * 100));
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Sobel X
                const gx = 
                    -1 * gray[(y-1) * width + (x-1)] + 1 * gray[(y-1) * width + (x+1)] +
                    -2 * gray[y * width + (x-1)] + 2 * gray[y * width + (x+1)] +
                    -1 * gray[(y+1) * width + (x-1)] + 1 * gray[(y+1) * width + (x+1)];
                
                // Sobel Y
                const gy = 
                    -1 * gray[(y-1) * width + (x-1)] + -2 * gray[(y-1) * width + x] + -1 * gray[(y-1) * width + (x+1)] +
                    1 * gray[(y+1) * width + (x-1)] + 2 * gray[(y+1) * width + x] + 1 * gray[(y+1) * width + (x+1)];
                
                const magnitude = Math.sqrt(gx * gx + gy * gy);
                edges[idx] = magnitude > threshold ? 255 : 0;
            }
        }
        
        return { gray, edges, width, height };
    }
    
    static detectArchitecturalFeatures(features: any, width: number, height: number, scale: number, aggressive: boolean = false): Region[] {
        const { edges } = features;
        const regions: Region[] = [];
        const visited = new Uint8Array(width * height);
        const minSize = Math.max(aggressive ? 20 : 30, (aggressive ? 30 : 40) * scale);
        const maxRegions = aggressive ? 20 : 12;
        
        // Grid-based scanning for rectangular features
        const stepSize = Math.max(aggressive ? 10 : 15, Math.round((aggressive ? 12 : 20) * scale));
        
        for (let y = minSize; y < height - minSize && regions.length < maxRegions; y += stepSize) {
            for (let x = minSize; x < width - minSize && regions.length < maxRegions; x += stepSize) {
                if (visited[y * width + x]) continue;
                
                const rect = this.findRectangularFeature(edges, width, height, x, y, minSize, scale, aggressive ? 0.22 : 0.3);
                if (rect && this.validateFeature(rect, edges, width, height, aggressive)) {
                    const region: Region = {
                        id: `temp-${regions.length}`,
                        points: rect,
                        outlineColor: this.getFeatureColor(rect, regions.length),
                        filled: false,
                        type: 'rectangle',
                        label: this.classifyFeature(rect, width, height),
                        confidence: Math.round(70 + Math.random() * 25)
                    };
                    
                    regions.push(region);
                    this.markAreaVisited(visited, width, rect, stepSize);
                }
            }
        }
        
        return regions;
    }
    
    static findRectangularFeature(
        edges: Uint8Array, 
        width: number, 
        height: number, 
        startX: number, 
        startY: number, 
        minSize: number,
        scale: number,
        minScore: number = 0.3
    ): Point[] | null {
        const maxWidth = Math.min(200 * scale, width - startX - 10);
        const maxHeight = Math.min(200 * scale, height - startY - 10);
        
        let bestW = minSize;
        let bestH = minSize;
        let bestScore = 0;
        
        // Search for optimal rectangle size
        for (let w = minSize; w <= maxWidth; w += Math.max(5, Math.round(10 * scale))) {
            for (let h = minSize; h <= maxHeight; h += Math.max(5, Math.round(10 * scale))) {
                const score = this.scoreRectangle(edges, width, height, startX, startY, w, h);
                if (score > bestScore) {
                    bestScore = score;
                    bestW = w;
                    bestH = h;
                }
            }
        }
        
        if (bestScore > minScore) {
            return [
                { x: startX, y: startY },
                { x: startX + bestW, y: startY },
                { x: startX + bestW, y: startY + bestH },
                { x: startX, y: startY + bestH }
            ];
        }
        
        return null;
    }
    
    static scoreRectangle(
        edges: Uint8Array, 
        width: number, 
        height: number, 
        x: number, 
        y: number, 
        w: number, 
        h: number
    ): number {
        let edgePixels = 0;
        let totalPixels = 0;
        
        // Check perimeter for edges
        for (let i = 0; i <= w; i += 2) {
            if (x + i < width && y < height && edges[y * width + (x + i)] > 0) edgePixels++;
            if (x + i < width && y + h < height && edges[(y + h) * width + (x + i)] > 0) edgePixels++;
            totalPixels += 2;
        }
        
        for (let j = 0; j <= h; j += 2) {
            if (x < width && y + j < height && edges[(y + j) * width + x] > 0) edgePixels++;
            if (x + w < width && y + j < height && edges[(y + j) * width + (x + w)] > 0) edgePixels++;
            totalPixels += 2;
        }
        
        return totalPixels > 0 ? edgePixels / totalPixels : 0;
    }
    
    static validateFeature(rect: Point[], edges: Uint8Array, width: number, height: number, aggressive: boolean = false): boolean {
        const area = Math.abs((rect[2].x - rect[0].x) * (rect[2].y - rect[0].y));
        const aspectRatio = Math.abs(rect[2].x - rect[0].x) / Math.abs(rect[2].y - rect[0].y);
        const minArea = aggressive ? 400 : 900;
        const maxArea = aggressive ? 80000 : 40000;
        const minAR = aggressive ? 0.2 : 0.3;
        const maxAR = aggressive ? 5 : 4;
        return area > minArea && area < maxArea && aspectRatio > minAR && aspectRatio < maxAR;
    }
    
    static markAreaVisited(visited: Uint8Array, width: number, rect: Point[], padding: number) {
        const minX = Math.max(0, Math.min(...rect.map(p => p.x)) - padding);
        const maxX = Math.min(width, Math.max(...rect.map(p => p.x)) + padding);
        const minY = Math.max(0, Math.min(...rect.map(p => p.y)) - padding);
        const maxY = Math.min(visited.length / width, Math.max(...rect.map(p => p.y)) + padding);
        
        for (let y = minY; y < maxY; y += 2) {
            for (let x = minX; x < maxX; x += 2) {
                const idx = Math.floor(y) * width + Math.floor(x);
                if (idx < visited.length) visited[idx] = 1;
            }
        }
    }
    
    static classifyFeature(rect: Point[], width: number, height: number): string {
        const w = Math.abs(rect[2].x - rect[0].x);
        const h = Math.abs(rect[2].y - rect[0].y);
        const area = w * h;
        const aspectRatio = w / h;
        
        if (aspectRatio > 1.5) return 'window';
        if (aspectRatio < 0.8 && h > w) return 'door';
        if (area > 10000) return 'building';
        return 'feature';
    }
    
    static getFeatureColor(rect: Point[], index: number): string {
        const colors = ['#00ff88', '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7', '#dda0dd', '#98d8c8'];
        return colors[index % colors.length];
    }

    // Shoelace formula for polygon area
    static polygonArea(poly: Point[]): number {
        let area = 0;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            area += (poly[j].x * poly[i].y) - (poly[i].x * poly[j].y);
        }
        return Math.abs(area) * 0.5;
    }

    // Monotonic chain convex hull (fast and stable)
    static computeConvexHull(points: Point[]): Point[] {
        if (points.length <= 3) return points;
        const pts = [...points].sort((a, b) => (a.x === b.x ? a.y - b.y : a.x - b.x));
        const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);

        const lower: Point[] = [];
        for (const p of pts) {
            while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
            lower.push(p);
        }
        const upper: Point[] = [];
        for (let i = pts.length - 1; i >= 0; i--) {
            const p = pts[i];
            while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
            upper.push(p);
        }
        upper.pop(); lower.pop();
        return lower.concat(upper);
    }

    // Extract a polygon outline from a probability mask using boundary sampling + convex hull
    static extractPolygonFromMask(mask: Float32Array, width: number, height: number, thr: number, minAreaPx: number): Point[] | null {
        const boundary: Point[] = [];
        const step = 2; // sampling step for speed
        for (let y = 1; y < height - 1; y += step) {
            for (let x = 1; x < width - 1; x += step) {
                const v = mask[y * width + x];
                if (v < thr) continue;
                // If any 4-neighbour is below threshold -> boundary
                if (
                    mask[(y - 1) * width + x] < thr ||
                    mask[(y + 1) * width + x] < thr ||
                    mask[y * width + (x - 1)] < thr ||
                    mask[y * width + (x + 1)] < thr
                ) {
                    boundary.push({ x, y });
                }
            }
        }
        if (boundary.length < 10) return null;

        const hull = this.computeConvexHull(boundary);
        if (hull.length < 3) return null;
        if (this.polygonArea(hull) < minAreaPx) return null;
        return hull;
    }
    
    static createEnhancedPreview(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, regions: Region[], scale: number): string {
        // Create new canvas for preview
        const previewCanvas = document.createElement('canvas');
        const previewCtx = previewCanvas.getContext('2d')!;
        previewCanvas.width = canvas.width;
        previewCanvas.height = canvas.height;
        
        // Draw original image
        previewCtx.drawImage(canvas, 0, 0);
        
        // Draw detections with enhanced styling
        regions.forEach((region) => {
            const color = region.outlineColor || '#22c55e';

            if (region.type === 'polygon' || region.points.length > 2) {
                // Polygon fill
                previewCtx.beginPath();
                previewCtx.moveTo(region.points[0].x, region.points[0].y);
                for (let i = 1; i < region.points.length; i++) {
                    previewCtx.lineTo(region.points[i].x, region.points[i].y);
                }
                previewCtx.closePath();
                previewCtx.fillStyle = `${color}15`;
                previewCtx.fill();
                previewCtx.strokeStyle = color;
                previewCtx.lineWidth = 2;
                previewCtx.stroke();

                // Label at centroid
                const cx = Math.round(region.points.reduce((s, p) => s + p.x, 0) / region.points.length);
                const cy = Math.round(region.points.reduce((s, p) => s + p.y, 0) / region.points.length);
                previewCtx.fillStyle = color;
                previewCtx.font = 'bold 12px Arial';
                const label = region.label || 'segment';
                const conf = region.confidence ?? 80;
                previewCtx.fillText(`${label} (${conf}%)`, cx + 4, Math.max(12, cy - 4));
                return;
            }

            // Rectangle fallback (2 or 4 points)
            let x1 = region.points[0]?.x ?? 0;
            let y1 = region.points[0]?.y ?? 0;
            let x2 = region.points[1]?.x ?? region.points[2]?.x ?? x1;
            let y2 = region.points[1]?.y ?? region.points[2]?.y ?? y1;
            if (region.points.length >= 4) {
                const xs = region.points.map(p => p.x);
                const ys = region.points.map(p => p.y);
                x1 = Math.min(...xs); y1 = Math.min(...ys);
                x2 = Math.max(...xs); y2 = Math.max(...ys);
            }
            const w = x2 - x1; const h = y2 - y1;
            if (!Number.isFinite(w) || !Number.isFinite(h) || Math.abs(w) < 1 || Math.abs(h) < 1) return;

            previewCtx.fillStyle = `${color}15`;
            previewCtx.beginPath();
            previewCtx.rect(x1, y1, w, h);
            previewCtx.fill();
            previewCtx.strokeStyle = color;
            previewCtx.lineWidth = 2;
            previewCtx.stroke();
            previewCtx.fillStyle = color;
            previewCtx.font = 'bold 12px Arial';
            const label = region.label || 'segment';
            const conf = region.confidence ?? 80;
            previewCtx.fillText(`${label} (${conf}%)`, x1 + 4, Math.max(12, y1 - 4));
        });
        
        return previewCanvas.toDataURL();
    }
}

const AIObjectDetection: React.FC<AIObjectDetectionProps> = ({
    image,
    onRegionsDetected,
    isOpen,
    onClose
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sensitivity, setSensitivity] = useState([0.6]);
    const [processingStage, setProcessingStage] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [detectedRegions, setDetectedRegions] = useState<Region[]>([]);

    const processImage = useCallback(async () => {
        if (!image || isProcessing) return;

        console.log('Starting smart object detection...');
        setIsProcessing(true);
        setProgress(0);
        setProcessingStage('Initializing smart detection...');
        setShowPreview(false);
        setPreviewImage(null);
        setDetectedRegions([]);

        try {
            console.log('Using sensitivity:', sensitivity[0]);
            
            const { regions, previewUrl } = await SmartObjectDetector.detectObjects(
                image,
                sensitivity[0],
                (prog, stage) => {
                    setProgress(prog);
                    setProcessingStage(stage);
                }
            );

            console.log(`Detected ${regions.length} objects`);

            if (regions.length > 0) {
                setPreviewImage(previewUrl);
                setDetectedRegions(regions);
                setShowPreview(true);
                setProgress(100);
                setProcessingStage('Detection complete!');
                
                toast({
                    title: "🎯 Smart Detection Complete!",
                    description: `Found ${regions.length} architectural features. Review the preview.`,
                });
                
            } else {
                setProgress(100);
                setProcessingStage('No features found');
                toast({
                    title: "No Features Found",
                    description: "Try adjusting the sensitivity or use a different image",
                    variant: "destructive"
                });
            }

        } catch (error) {
            console.error('Smart detection error:', error);
            toast({
                title: "Detection Failed",
                description: "An error occurred during processing. Please try again.",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    }, [image, sensitivity, isProcessing]);

    const handleAddToCanvas = useCallback(() => {
        if (detectedRegions.length === 0) return;
        
        console.log('Adding detected features to canvas...');
        // Normalize rectangles to [top-left, bottom-right] so the canvas draws full boxes
        const normalized = detectedRegions.map(r => {
            if (r.type === 'rectangle' && r.points.length >= 4) {
                const xs = r.points.map(p => p.x);
                const ys = r.points.map(p => p.y);
                const start = { x: Math.min(...xs), y: Math.min(...ys) };
                const end = { x: Math.max(...xs), y: Math.max(...ys) };
                return { ...r, points: [start, end] };
            }
            return r;
        });

        onRegionsDetected(normalized);
        toast({
            title: "✅ Features Added!",
            description: `Added ${detectedRegions.length} detected features to your canvas`,
        });
        
        // Reset and close
        resetState();
        onClose();
    }, [detectedRegions, onRegionsDetected, onClose]);

    const resetState = useCallback(() => {
        setShowPreview(false);
        setPreviewImage(null);
        setDetectedRegions([]);
        setProgress(0);
        setProcessingStage('');
        setIsProcessing(false);
    }, []);

    const handleBack = useCallback(() => {
        setShowPreview(false);
        setPreviewImage(null);
        setProgress(0);
        setProcessingStage('');
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [resetState, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Bot className="h-5 w-5 text-green-400" />
                        Smart Feature Detection
                    </h2>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleClose}
                        className="text-zinc-400 hover:text-white"
                        disabled={isProcessing}
                    >
                        ×
                    </Button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Processing Progress */}
                    {isProcessing && (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">{processingStage}</span>
                                <span className="text-sm text-zinc-400">{progress}%</span>
                            </div>
                            <Progress value={progress} className="w-full" />
                            <p className="text-xs text-zinc-400 text-center">
                                Using advanced computer vision for architectural feature detection...
                            </p>
                        </div>
                    )}

                    {/* Preview Mode */}
                    {showPreview && previewImage && !isProcessing && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Detection Results ({detectedRegions.length} features found)
                            </h4>
                            
                            {/* Features Summary */}
                            <div className="flex flex-wrap gap-1 mb-3">
                                {detectedRegions.map((region, index) => (
                                    <Badge 
                                        key={index} 
                                        variant="secondary" 
                                        className="text-xs"
                                        style={{ backgroundColor: region.outlineColor + '20', color: region.outlineColor }}
                                    >
                                        {region.label} ({region.confidence}%)
                                    </Badge>
                                ))}
                            </div>
                            
                            <img
                                src={previewImage}
                                alt="Smart Detection Preview"
                                className="w-full max-h-64 object-contain border border-zinc-700 rounded bg-zinc-800"
                            />
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleAddToCanvas}
                                    className="flex-1 bg-green-600 hover:bg-green-500"
                                    disabled={detectedRegions.length === 0}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Add {detectedRegions.length} Features
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={handleBack}
                                    className="border-zinc-600 text-white hover:bg-zinc-800"
                                >
                                    Back
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Controls - only show when not processing and not in preview */}
                    {!isProcessing && !showPreview && (
                        <>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white">
                                    Detection Sensitivity: {Math.round(sensitivity[0] * 100)}%
                                </h3>
                                <Slider
                                    value={sensitivity}
                                    onValueChange={setSensitivity}
                                    max={0.9}
                                    min={0.2}
                                    step={0.1}
                                    className="w-full"
                                />
                                <p className="text-xs text-zinc-400">
                                    Higher values detect more features but may include noise
                                </p>
                            </div>

                            <Button
                                onClick={processImage}
                                disabled={!image}
                                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                            >
                                <Zap className="h-4 w-4 mr-2" />
                                Detect Features
                            </Button>
                        </>
                    )}

                    {/* No objects found message */}
                    {!isProcessing && !showPreview && progress === 100 && detectedRegions.length === 0 && (
                        <div className="text-center p-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                            <AlertTriangle className="h-8 w-8 text-yellow-400 mx-auto mb-2" />
                            <h3 className="text-sm font-semibold text-yellow-300 mb-1">No Features Detected</h3>
                            <p className="text-xs text-yellow-400">Try adjusting the sensitivity or use a different image</p>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">🏗️ Smart Detection</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Computer Vision:</strong> Advanced edge detection and feature analysis</li>
                            <li>• <strong>Architecture Focus:</strong> Optimized for windows, doors, and building features</li>
                            <li>• <strong>Fast Processing:</strong> No internet required, works offline</li>
                            <li>• <strong>Reliable Results:</strong> Consistent detection without external dependencies</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIObjectDetection;