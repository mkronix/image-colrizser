import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Bot, Sparkles, Zap, Settings2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';

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

// Edge detection algorithms
class EdgeDetector {
    // Sobel edge detection
    static sobelEdgeDetection(imageData: ImageData, threshold: number = 50): ImageData {
        const { data, width, height } = imageData;
        const output = new ImageData(width, height);

        // Sobel kernels
        const sobelX = [[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]];
        const sobelY = [[-1, -2, -1], [0, 0, 0], [1, 2, 1]];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                let pixelX = 0;
                let pixelY = 0;

                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const idx = ((y + i) * width + (x + j)) * 4;
                        const gray = (data[idx] + data[idx + 1] + data[idx + 2]) / 3;

                        pixelX += gray * sobelX[i + 1][j + 1];
                        pixelY += gray * sobelY[i + 1][j + 1];
                    }
                }

                const magnitude = Math.sqrt(pixelX * pixelX + pixelY * pixelY);
                const outputIdx = (y * width + x) * 4;

                if (magnitude > threshold) {
                    output.data[outputIdx] = 255;     // R
                    output.data[outputIdx + 1] = 255; // G
                    output.data[outputIdx + 2] = 255; // B
                } else {
                    output.data[outputIdx] = 0;
                    output.data[outputIdx + 1] = 0;
                    output.data[outputIdx + 2] = 0;
                }
                output.data[outputIdx + 3] = 255; // Alpha
            }
        }

        return output;
    }

    // Canny edge detection (simplified)
    static cannyEdgeDetection(imageData: ImageData, lowThreshold: number = 50, highThreshold: number = 150): ImageData {
        const { width, height } = imageData;

        // Step 1: Gaussian blur
        const blurred = this.gaussianBlur(imageData, 1.4);

        // Step 2: Sobel edge detection
        const edges = this.sobelEdgeDetection(blurred, lowThreshold);

        // Step 3: Non-maximum suppression and hysteresis (simplified)
        return this.hysteresisThresholding(edges, lowThreshold, highThreshold);
    }

    static gaussianBlur(imageData: ImageData, sigma: number): ImageData {
        const { data, width, height } = imageData;
        const output = new ImageData(width, height);

        // Create Gaussian kernel
        const kernelSize = Math.ceil(sigma * 3) * 2 + 1;
        const kernel: number[] = [];
        let sum = 0;

        for (let i = 0; i < kernelSize; i++) {
            const x = i - Math.floor(kernelSize / 2);
            const value = Math.exp(-(x * x) / (2 * sigma * sigma));
            kernel.push(value);
            sum += value;
        }

        // Normalize kernel
        for (let i = 0; i < kernelSize; i++) {
            kernel[i] /= sum;
        }

        // Apply horizontal blur
        const temp = new ImageData(width, height);
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;

                for (let i = 0; i < kernelSize; i++) {
                    const px = Math.max(0, Math.min(width - 1, x + i - Math.floor(kernelSize / 2)));
                    const idx = (y * width + px) * 4;
                    r += data[idx] * kernel[i];
                    g += data[idx + 1] * kernel[i];
                    b += data[idx + 2] * kernel[i];
                }

                const idx = (y * width + x) * 4;
                temp.data[idx] = r;
                temp.data[idx + 1] = g;
                temp.data[idx + 2] = b;
                temp.data[idx + 3] = 255;
            }
        }

        // Apply vertical blur
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                let r = 0, g = 0, b = 0;

                for (let i = 0; i < kernelSize; i++) {
                    const py = Math.max(0, Math.min(height - 1, y + i - Math.floor(kernelSize / 2)));
                    const idx = (py * width + x) * 4;
                    r += temp.data[idx] * kernel[i];
                    g += temp.data[idx + 1] * kernel[i];
                    b += temp.data[idx + 2] * kernel[i];
                }

                const idx = (y * width + x) * 4;
                output.data[idx] = r;
                output.data[idx + 1] = g;
                output.data[idx + 2] = b;
                output.data[idx + 3] = 255;
            }
        }

        return output;
    }

    static hysteresisThresholding(imageData: ImageData, low: number, high: number): ImageData {
        const { data, width, height } = imageData;
        const output = new ImageData(width, height);

        for (let i = 0; i < data.length; i += 4) {
            const intensity = (data[i] + data[i + 1] + data[i + 2]) / 3;

            if (intensity > high) {
                output.data[i] = 255;
                output.data[i + 1] = 255;
                output.data[i + 2] = 255;
            } else if (intensity > low) {
                output.data[i] = 128;
                output.data[i + 1] = 128;
                output.data[i + 2] = 128;
            } else {
                output.data[i] = 0;
                output.data[i + 1] = 0;
                output.data[i + 2] = 0;
            }
            output.data[i + 3] = 255;
        }

        return output;
    }

    // Contour detection and polygonization
    static findContours(imageData: ImageData, minContourLength: number = 50): Point[][] {
        const { data, width, height } = imageData;
        const visited = new Array(width * height).fill(false);
        const contours: Point[][] = [];

        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                if (!visited[idx] && data[idx * 4] > 128) { // Edge pixel
                    const contour = this.traceContour(data, width, height, x, y, visited);
                    if (contour.length > minContourLength) {
                        contours.push(this.simplifyContour(contour, 2));
                    }
                }
            }
        }

        return contours;
    }

    static traceContour(data: Uint8ClampedArray, width: number, height: number, startX: number, startY: number, visited: boolean[]): Point[] {
        const contour: Point[] = [];
        const directions = [
            [-1, -1], [0, -1], [1, -1],
            [-1, 0], [1, 0],
            [-1, 1], [0, 1], [1, 1]
        ];

        let x = startX, y = startY;
        let dir = 0;

        do {
            const idx = y * width + x;
            if (!visited[idx]) {
                visited[idx] = true;
                contour.push({ x, y });
            }

            // Find next edge pixel
            let found = false;
            for (let i = 0; i < 8; i++) {
                const newDir = (dir + i) % 8;
                const [dx, dy] = directions[newDir];
                const nx = x + dx;
                const ny = y + dy;

                if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                    const nIdx = ny * width + nx;
                    if (data[nIdx * 4] > 128) { // Edge pixel
                        x = nx;
                        y = ny;
                        dir = newDir;
                        found = true;
                        break;
                    }
                }
            }

            if (!found) break;

        } while (!(x === startX && y === startY) && contour.length < 10000);

        return contour;
    }

    // Douglas-Peucker algorithm for contour simplification
    static simplifyContour(points: Point[], epsilon: number): Point[] {
        if (points.length < 3) return points;

        return this.douglasPeucker(points, epsilon);
    }

    static douglasPeucker(points: Point[], epsilon: number): Point[] {
        if (points.length < 3) return points;

        const start = points[0];
        const end = points[points.length - 1];

        let maxDistance = 0;
        let maxIndex = 0;

        for (let i = 1; i < points.length - 1; i++) {
            const distance = this.pointToLineDistance(points[i], start, end);
            if (distance > maxDistance) {
                maxDistance = distance;
                maxIndex = i;
            }
        }

        if (maxDistance > epsilon) {
            const left = this.douglasPeucker(points.slice(0, maxIndex + 1), epsilon);
            const right = this.douglasPeucker(points.slice(maxIndex), epsilon);

            return [...left.slice(0, -1), ...right];
        } else {
            return [start, end];
        }
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
}

const AIEdgeDetection: React.FC<AIEdgeDetectionProps> = ({
    image,
    onRegionsDetected,
    isOpen,
    onClose
}) => {
    const [isProcessing, setIsProcessing] = useState(false);
    const [algorithm, setAlgorithm] = useState<'sobel' | 'canny'>('canny');
    const [sensitivity, setSensitivity] = useState([75]);
    const [minRegionSize, setMinRegionSize] = useState([100]);
    const [previewMode, setPreviewMode] = useState(false);
    const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

    const processImage = useCallback(async () => {
        if (!image) return;

        setIsProcessing(true);

        try {
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            canvas.width = image.width;
            canvas.height = image.height;
            ctx.drawImage(image, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Apply edge detection
            let edgeData: ImageData;
            if (algorithm === 'canny') {
                edgeData = EdgeDetector.cannyEdgeDetection(imageData, sensitivity[0] * 0.5, sensitivity[0] * 1.5);
            } else {
                edgeData = EdgeDetector.sobelEdgeDetection(imageData, sensitivity[0]);
            }

            // Show preview if requested
            if (previewMode) {
                ctx.putImageData(edgeData, 0, 0);
                setPreviewCanvas(canvas);
                return;
            }

            // Find contours and convert to regions
            const contours = EdgeDetector.findContours(edgeData, minRegionSize[0]);

            const regions: Region[] = contours.map((contour, index) => ({
                id: `ai-region-${Date.now()}-${index}`,
                points: contour,
                outlineColor: '#00ff88',
                filled: false,
                type: 'polygon' as const
            }));

            onRegionsDetected(regions);

            toast({
                title: "🤖 AI Detection Complete!",
                description: `Found ${regions.length} potential regions. You can now fill them with colors!`,
            });

            onClose();

        } catch (error) {
            toast({
                title: "Detection Error",
                description: "Failed to process image. Please try different settings.",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    }, [image, algorithm, sensitivity, minRegionSize, previewMode, onRegionsDetected, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Bot className="h-5 w-5 text-green-400" />
                        AI Edge Detection
                    </h2>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
                        ×
                    </Button>
                </div>

                <div className="p-4 space-y-6">
                    {/* Algorithm Selection */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Zap className="h-4 w-4 text-blue-400" />
                            Detection Algorithm
                        </h3>
                        <div className="grid grid-cols-2 gap-2">
                            <Button
                                variant={algorithm === 'canny' ? 'default' : 'outline'}
                                onClick={() => setAlgorithm('canny')}
                                className="text-sm"
                            >
                                Canny (Precise)
                            </Button>
                            <Button
                                variant={algorithm === 'sobel' ? 'default' : 'outline'}
                                onClick={() => setAlgorithm('sobel')}
                                className="text-sm"
                            >
                                Sobel (Fast)
                            </Button>
                        </div>
                        <p className="text-xs text-zinc-400">
                            {algorithm === 'canny'
                                ? 'More accurate but slower, best for detailed images'
                                : 'Faster processing, good for images with clear edges'
                            }
                        </p>
                    </div>

                    {/* Sensitivity Control */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                            <Settings2 className="h-4 w-4 text-purple-400" />
                            Edge Sensitivity: {sensitivity[0]}%
                        </h3>
                        <Slider
                            value={sensitivity}
                            onValueChange={setSensitivity}
                            max={100}
                            min={10}
                            step={5}
                            className="w-full"
                        />
                        <p className="text-xs text-zinc-400">
                            Higher values detect more subtle edges, lower values only strong edges
                        </p>
                    </div>

                    {/* Min Region Size */}
                    <div className="space-y-3">
                        <h3 className="text-sm font-semibold text-white">
                            Min Region Size: {minRegionSize[0]} pixels
                        </h3>
                        <Slider
                            value={minRegionSize}
                            onValueChange={setMinRegionSize}
                            max={500}
                            min={50}
                            step={25}
                            className="w-full"
                        />
                        <p className="text-xs text-zinc-400">
                            Smaller regions will be ignored to reduce noise
                        </p>
                    </div>

                    {/* Preview Mode Toggle */}
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">Preview Edges</span>
                        <Button
                            variant={previewMode ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPreviewMode(!previewMode)}
                        >
                            {previewMode ? 'Show Preview' : 'Direct Apply'}
                        </Button>
                    </div>

                    {/* Preview Canvas */}
                    {previewMode && previewCanvas && (
                        <div className="space-y-2">
                            <h4 className="text-sm font-semibold text-white">Edge Preview</h4>
                            <canvas
                                ref={(el) => {
                                    if (el && previewCanvas) {
                                        const ctx = el.getContext('2d');
                                        el.width = previewCanvas.width;
                                        el.height = previewCanvas.height;
                                        ctx?.drawImage(previewCanvas, 0, 0);
                                    }
                                }}
                                className="w-full h-32 object-contain border border-zinc-700 rounded"
                            />
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-3">
                        <Button
                            onClick={processImage}
                            disabled={isProcessing || !image}
                            className="flex-1 bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                        >
                            {isProcessing ? (
                                <>
                                    <div className="animate-spin h-4 w-4 mr-2 border-2 border-white border-t-transparent rounded-full" />
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    {previewMode ? 'Preview Edges' : 'Detect Regions'}
                                </>
                            )}
                        </Button>
                    </div>

                    {/* Tips */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">💡 Tips for Better Results</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• Use high contrast images for better detection</li>
                            <li>• Try Canny algorithm for detailed architectural images</li>
                            <li>• Adjust sensitivity based on image complexity</li>
                            <li>• Preview first to fine-tune settings</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIEdgeDetection;