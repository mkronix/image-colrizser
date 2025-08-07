import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { Bot, Eye, Sparkles, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';

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
}

interface AIEdgeDetectionProps {
    image: HTMLImageElement | null;
    onRegionsDetected: (regions: Region[]) => void;
    isOpen: boolean;
    onClose: () => void;
}

// AI Edge Detection System
class RealEdgeDetector {
    // Convert image to grayscale for edge detection
    static toGrayscale(imageData: ImageData): Uint8Array {
        const { data, width, height } = imageData;
        const gray = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Use luminance formula for better contrast
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }

        return gray;
    }

    // WORKING Sobel edge detection
    static sobelEdgeDetection(grayData: Uint8Array, width: number, height: number, threshold: number): Uint8Array {
        const edges = new Uint8Array(width * height);

        // Sobel kernels
        const sobelX = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
        const sobelY = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let pixelX = 0;
                let pixelY = 0;

                // Apply kernels
                for (let ky = -1; ky <= 1; ky++) {
                    for (let kx = -1; kx <= 1; kx++) {
                        const idx = (y + ky) * width + (x + kx);
                        const kernelIdx = (ky + 1) * 3 + (kx + 1);

                        pixelX += grayData[idx] * sobelX[kernelIdx];
                        pixelY += grayData[idx] * sobelY[kernelIdx];
                    }
                }

                const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
                const idx = y * width + x;
                edges[idx] = magnitude > threshold ? 255 : 0;
            }
        }

        return edges;
    }

    // Find rectangular regions (perfect for architecture)
    static findRectangularRegions(
        edges: Uint8Array,
        width: number,
        height: number,
        minWidth: number = 30,
        minHeight: number = 30
    ): Point[][] {
        const regions: Point[][] = [];
        const visited = new Uint8Array(width * height);

        // Scan for potential rectangles
        for (let y = 0; y < height - minHeight; y += 5) {
            for (let x = 0; x < width - minWidth; x += 5) {
                if (visited[y * width + x]) continue;

                const rect = this.detectRectangle(edges, width, height, x, y, minWidth, minHeight);
                if (rect) {
                    regions.push(rect);
                    this.markVisited(visited, width, rect, 10); // Mark area as visited
                }

                if (regions.length >= 20) break;
            }
            if (regions.length >= 20) break;
        }

        return regions;
    }

    static detectRectangle(
        edges: Uint8Array,
        width: number,
        height: number,
        startX: number,
        startY: number,
        minWidth: number,
        minHeight: number
    ): Point[] | null {
        // Look for horizontal edges
        let rightX = startX;
        let bottomY = startY;

        // Find right edge
        while (rightX < width - 1) {
            let hasVerticalEdge = false;
            for (let y = startY; y < Math.min(startY + 100, height); y++) {
                if (edges[y * width + rightX] > 0) {
                    hasVerticalEdge = true;
                    break;
                }
            }
            if (!hasVerticalEdge) break;
            rightX++;
        }

        // Find bottom edge
        while (bottomY < height - 1) {
            let hasHorizontalEdge = false;
            for (let x = startX; x < Math.min(startX + 100, width); x++) {
                if (edges[bottomY * width + x] > 0) {
                    hasHorizontalEdge = true;
                    break;
                }
            }
            if (!hasHorizontalEdge) break;
            bottomY++;
        }

        const rectWidth = rightX - startX;
        const rectHeight = bottomY - startY;

        if (rectWidth >= minWidth && rectHeight >= minHeight) {
            return [
                { x: startX, y: startY },
                { x: rightX, y: startY },
                { x: rightX, y: bottomY },
                { x: startX, y: bottomY }
            ];
        }

        return null;
    }

    // Smart region detection using contours
    static findContourRegions(
        edges: Uint8Array,
        width: number,
        height: number,
        minArea: number = 500
    ): Point[][] {
        const regions: Point[][] = [];
        const visited = new Uint8Array(width * height);

        for (let y = 5; y < height - 5; y += 3) {
            for (let x = 5; x < width - 5; x += 3) {
                if (visited[y * width + x] || edges[y * width + x] === 0) continue;

                const contour = this.traceContour(edges, width, height, x, y, visited);
                if (contour.length > 10) {
                    const simplified = this.simplifyContour(contour, 3);
                    const area = this.calculateArea(simplified);

                    if (area > minArea && simplified.length >= 4) {
                        regions.push(simplified);
                    }
                }

                if (regions.length >= 15) break;
            }
            if (regions.length >= 15) break;
        }

        return regions;
    }

    static traceContour(
        edges: Uint8Array,
        width: number,
        height: number,
        startX: number,
        startY: number,
        visited: Uint8Array
    ): Point[] {
        const contour: Point[] = [];
        const directions = [
            [1, 0], [1, 1], [0, 1], [-1, 1],
            [-1, 0], [-1, -1], [0, -1], [1, -1]
        ];

        let x = startX, y = startY;
        let dir = 0;

        do {
            const idx = y * width + x;
            if (!visited[idx]) {
                visited[idx] = 1;
                contour.push({ x, y });
            }

            let found = false;
            for (let i = 0; i < 8; i++) {
                const newDir = (dir + i) % 8;
                const [dx, dy] = directions[newDir];
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (edges[nIdx] > 0) {
                        x = nx;
                        y = ny;
                        dir = newDir;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) break;

        } while (!(x === startX && y === startY) && contour.length < 1000);

        return contour;
    }

    static simplifyContour(points: Point[], epsilon: number): Point[] {
        if (points.length < 3) return points;

        const simplified: Point[] = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const prev = simplified[simplified.length - 1];
            const curr = points[i];
            const next = points[i + 1];

            // Calculate distance from current point to line between prev and next
            const distance = this.pointToLineDistance(curr, prev, next);

            if (distance > epsilon) {
                simplified.push(curr);
            }
        }

        simplified.push(points[points.length - 1]);
        return simplified;
    }

    static pointToLineDistance(point: Point, lineStart: Point, lineEnd: Point): number {
        const A = lineEnd.x - lineStart.x;
        const B = lineEnd.y - lineStart.y;
        const C = point.x - lineStart.x;
        const D = point.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = A * A + B * B;

        if (lenSq === 0) return Math.sqrt(C * C + D * D);

        const param = dot / lenSq;
        let xx, yy;

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

    static calculateArea(points: Point[]): number {
        if (points.length < 3) return 0;

        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }

        return Math.abs(area) / 2;
    }

    static markVisited(visited: Uint8Array, width: number, rect: Point[], padding: number) {
        const minX = Math.min(...rect.map(p => p.x)) - padding;
        const maxX = Math.max(...rect.map(p => p.x)) + padding;
        const minY = Math.min(...rect.map(p => p.y)) - padding;
        const maxY = Math.max(...rect.map(p => p.y)) + padding;

        for (let y = Math.max(0, minY); y < maxY; y++) {
            for (let x = Math.max(0, minX); x < maxX; x++) {
                visited[y * width + x] = 1;
            }
        }
    }

    // Main detection function
    static detectRegions(
        imageData: ImageData,
        sensitivity: number = 50,
        minRegionSize: number = 500,
        algorithm: 'rectangular' | 'contour' | 'both' = 'both'
    ): Point[][] {
        const { width, height } = imageData;

        // Convert to grayscale
        const grayData = this.toGrayscale(imageData);

        // Detect edges
        const threshold = 255 - (sensitivity * 2.55); // Convert percentage to threshold
        const edges = this.sobelEdgeDetection(grayData, width, height, threshold);

        let regions: Point[][] = [];

        if (algorithm === 'rectangular' || algorithm === 'both') {
            // Find rectangular regions (good for buildings, windows, doors)
            const rectRegions = this.findRectangularRegions(edges, width, height, 20, 20);
            regions.push(...rectRegions);
        }

        if (algorithm === 'contour' || algorithm === 'both') {
            // Find contour regions (good for irregular shapes)
            const contourRegions = this.findContourRegions(edges, width, height, minRegionSize);
            regions.push(...contourRegions);
        }

        // Remove overlapping regions
        regions = this.removeOverlaps(regions);

        return regions.slice(0, 25); // Limit to 25 regions
    }

    static removeOverlaps(regions: Point[][]): Point[][] {
        const filtered: Point[][] = [];

        for (let i = 0; i < regions.length; i++) {
            const region = regions[i];
            const center = this.getCenter(region);

            let overlaps = false;
            for (let j = 0; j < filtered.length; j++) {
                const existingCenter = this.getCenter(filtered[j]);
                const distance = Math.sqrt(
                    Math.pow(center.x - existingCenter.x, 2) +
                    Math.pow(center.y - existingCenter.y, 2)
                );

                if (distance < 50) { // If centers are too close
                    overlaps = true;
                    break;
                }
            }

            if (!overlaps) {
                filtered.push(region);
            }
        }

        return filtered;
    }

    static getCenter(points: Point[]): Point {
        const x = points.reduce((sum, p) => sum + p.x, 0) / points.length;
        const y = points.reduce((sum, p) => sum + p.y, 0) / points.length;
        return { x, y };
    }
}

const AIEdgeDetection: React.FC<AIEdgeDetectionProps> = ({
    image,
    onRegionsDetected,
    isOpen,
    onClose
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const [sensitivity, setSensitivity] = useState([50]);
    const [minRegionSize, setMinRegionSize] = useState([500]);
    const [algorithm, setAlgorithm] = useState<'rectangular' | 'contour' | 'both'>('both');
    const [processingStage, setProcessingStage] = useState('');
    const [previewMode, setPreviewMode] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);

    const processImage = useCallback(async () => {
        if (!image) return;

        setIsProcessing(true);
        setProgress(0);
        setProcessingStage('Analyzing image...');

        try {
            // Create processing canvas
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            // Use original size but limit to reasonable dimensions for performance
            const maxDimension = 1200;
            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));

            canvas.width = image.width * scale;
            canvas.height = image.height * scale;

            setProgress(10);
            setProcessingStage('Preparing image data...');

            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            setProgress(30);
            setProcessingStage('Detecting edges...');

            // Simulate processing delay for better UX
            await new Promise(resolve => setTimeout(resolve, 500));

            // Detect regions using the working algorithm
            const detectedRegions = RealEdgeDetector.detectRegions(
                imageData,
                sensitivity[0],
                minRegionSize[0] * scale * scale,
                algorithm
            );

            setProgress(80);
            setProcessingStage('Creating regions...');

            console.log(`Detected ${detectedRegions.length} regions`); // Debug log

            if (previewMode) {
                // Create preview with detected regions overlaid on original image
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 3;
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 5;

                detectedRegions.forEach(region => {
                    if (region.length > 0) {
                        ctx.beginPath();
                        ctx.moveTo(region[0].x, region[0].y);
                        region.slice(1).forEach(point => {
                            ctx.lineTo(point.x, point.y);
                        });
                        ctx.closePath();
                        ctx.stroke();
                        
                        // Fill with transparent color for better visibility
                        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
                        ctx.fill();
                    }
                });

                setPreviewImage(canvas.toDataURL());
                setProgress(100);
                setProcessingStage('Preview ready!');
                return;
            }

            // Scale regions back to original size and ensure proper format
            const regions: Region[] = detectedRegions
                .filter(region => region.length >= 3) // Only keep valid regions
                .map((region, index) => ({
                    id: `ai-region-${Date.now()}-${index}`,
                    points: region.map(point => ({
                        x: Math.round(point.x / scale),
                        y: Math.round(point.y / scale)
                    })),
                    outlineColor: '#00ff88',
                    color: undefined, // No fill color initially
                    filled: false,
                    type: 'polygon' as const
                }));

            setProgress(100);
            setProcessingStage('Complete!');

            console.log(`Sending ${regions.length} valid regions to canvas`); // Debug log

            if (regions.length > 0) {
                onRegionsDetected(regions);
            } else {
                console.warn('No valid regions detected');
            }

            toast({
                title: "🤖 AI Detection Successful!",
                description: `Found ${regions.length} regions in your image. Ready to colorize!`,
            });

            setTimeout(() => {
                onClose();
            }, 1000);

        } catch (error) {
            console.error('Detection error:', error);
            toast({
                title: "Detection Error",
                description: "Something went wrong. Please try again with different settings.",
                variant: "destructive"
            });
            setIsProcessing(false);
            setProgress(0);
        }
    }, [image, sensitivity, minRegionSize, algorithm, previewMode, onRegionsDetected, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Bot className="h-5 w-5 text-green-400" />
                        Working AI Detection
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
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
                        </div>
                    )}

                    {/* Preview Image */}
                    {previewImage && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Detection Preview
                            </h4>
                            <img
                                src={previewImage}
                                alt="Detection Preview"
                                className="w-full max-h-48 object-contain border border-zinc-700 rounded bg-zinc-800"
                            />
                        </div>
                    )}

                    {/* Algorithm Selection */}
                    {!isProcessing && (
                        <>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                    <Zap className="h-4 w-4 text-blue-400" />
                                    Detection Method
                                </h3>
                                <div className="grid grid-cols-3 gap-2">
                                    <Button
                                        variant={algorithm === 'rectangular' ? 'default' : 'outline'}
                                        onClick={() => setAlgorithm('rectangular')}
                                        className="text-xs p-2"
                                    >
                                        Rectangular
                                    </Button>
                                    <Button
                                        variant={algorithm === 'contour' ? 'default' : 'outline'}
                                        onClick={() => setAlgorithm('contour')}
                                        className="text-xs p-2"
                                    >
                                        Contour
                                    </Button>
                                    <Button
                                        variant={algorithm === 'both' ? 'default' : 'outline'}
                                        onClick={() => setAlgorithm('both')}
                                        className="text-xs p-2"
                                    >
                                        Both
                                        <Badge className="ml-1 bg-green-600 text-white text-xs">Best</Badge>
                                    </Button>
                                </div>
                                <p className="text-xs text-zinc-400">
                                    {algorithm === 'rectangular' && 'Perfect for buildings, windows, doors'}
                                    {algorithm === 'contour' && 'Better for curved and irregular shapes'}
                                    {algorithm === 'both' && 'Combines both methods for maximum detection'}
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white">
                                    Edge Sensitivity: {sensitivity[0]}%
                                </h3>
                                <Slider
                                    value={sensitivity}
                                    onValueChange={setSensitivity}
                                    max={90}
                                    min={10}
                                    step={5}
                                    className="w-full"
                                />
                                <p className="text-xs text-zinc-400">
                                    Higher values detect more subtle edges
                                </p>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white">
                                    Min Region Size: {minRegionSize[0]} pixels
                                </h3>
                                <Slider
                                    value={minRegionSize}
                                    onValueChange={setMinRegionSize}
                                    max={2000}
                                    min={200}
                                    step={100}
                                    className="w-full"
                                />
                                <p className="text-xs text-zinc-400">
                                    Larger values = fewer, bigger regions
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">Preview Mode</span>
                                <Button
                                    variant={previewMode ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => {
                                        setPreviewMode(!previewMode);
                                        setPreviewImage(null);
                                    }}
                                >
                                    {previewMode ? 'Preview First' : 'Direct Apply'}
                                </Button>
                            </div>

                            <div className="flex gap-3">
                                <Button
                                    onClick={processImage}
                                    disabled={!image}
                                    className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {previewMode ? 'Preview Detection' : 'Detect Regions'}
                                </Button>
                            </div>
                            
                            {/* Preview Action Buttons */}
                            {previewImage && !isProcessing && previewMode && (
                                <div className="flex gap-2 pt-2">
                                    <Button
                                        onClick={() => {
                                            setPreviewMode(false);
                                            processImage();
                                        }}
                                        className="flex-1 bg-green-600 hover:bg-green-500"
                                    >
                                        Add to Canvas
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setPreviewImage(null);
                                            setPreviewMode(false);
                                        }}
                                        className="border-zinc-600 text-white hover:bg-zinc-800"
                                    >
                                        Back
                                    </Button>
                                </div>
                            )}
                        </>
                    )}

                    {/* Debug Info */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">🔍 How This Works</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Rectangular:</strong> Finds windows, doors, building sections</li>
                            <li>• <strong>Contour:</strong> Traces curved edges and irregular shapes</li>
                            <li>• <strong>Edge Detection:</strong> Uses Sobel algorithm for reliable results</li>
                            <li>• <strong>Smart Filtering:</strong> Removes overlaps and noise</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIEdgeDetection;