
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

// Optimized Edge Detection System
class OptimizedEdgeDetector {
    // Optimized grayscale conversion with reduced memory usage
    static toGrayscale(imageData: ImageData): Uint8Array {
        const { data, width, height } = imageData;
        const gray = new Uint8Array(width * height);

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            gray[i / 4] = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
        }

        return gray;
    }

    // Simplified and faster edge detection
    static fastEdgeDetection(grayData: Uint8Array, width: number, height: number, threshold: number): Uint8Array {
        const edges = new Uint8Array(width * height);
        
        // Simplified Sobel-like detection for better performance
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                // Simple gradient calculation
                const gx = grayData[idx + 1] - grayData[idx - 1];
                const gy = grayData[idx + width] - grayData[idx - width];
                
                const magnitude = Math.abs(gx) + Math.abs(gy); // Manhattan distance for speed
                edges[idx] = magnitude > threshold ? 255 : 0;
            }
        }

        return edges;
    }

    // Fast rectangular region detection
    static findSimpleRectangles(
        edges: Uint8Array,
        width: number,
        height: number,
        minSize: number = 20
    ): Point[][] {
        const regions: Point[][] = [];
        const visited = new Uint8Array(width * height);
        
        // Scan with larger steps for performance
        for (let y = minSize; y < height - minSize; y += 8) {
            for (let x = minSize; x < width - minSize; x += 8) {
                if (visited[y * width + x] || edges[y * width + x] === 0) continue;

                // Look for rectangular patterns
                const rect = this.detectSimpleRect(edges, width, height, x, y, minSize);
                if (rect && rect.length === 4) {
                    regions.push(rect);
                    this.markVisited(visited, width, rect, 15);
                }

                if (regions.length >= 15) break; // Limit for performance
            }
            if (regions.length >= 15) break;
        }

        return regions;
    }

    static detectSimpleRect(
        edges: Uint8Array,
        width: number,
        height: number,
        startX: number,
        startY: number,
        minSize: number
    ): Point[] | null {
        // Simple rectangular detection
        let rightX = startX + minSize;
        let bottomY = startY + minSize;
        
        // Find reasonable bounds based on edge density
        while (rightX < width - 5 && rightX - startX < 150) {
            let edgeCount = 0;
            for (let y = startY; y < Math.min(startY + 50, height); y += 3) {
                if (edges[y * width + rightX] > 0) edgeCount++;
            }
            if (edgeCount < 3) break;
            rightX += 5;
        }

        while (bottomY < height - 5 && bottomY - startY < 150) {
            let edgeCount = 0;
            for (let x = startX; x < Math.min(startX + 50, width); x += 3) {
                if (edges[bottomY * width + x] > 0) edgeCount++;
            }
            if (edgeCount < 3) break;
            bottomY += 5;
        }

        const rectWidth = rightX - startX;
        const rectHeight = bottomY - startY;

        if (rectWidth >= minSize && rectHeight >= minSize) {
            return [
                { x: startX, y: startY },
                { x: rightX, y: startY },
                { x: rightX, y: bottomY },
                { x: startX, y: bottomY }
            ];
        }

        return null;
    }

    static markVisited(visited: Uint8Array, width: number, rect: Point[], padding: number) {
        const minX = Math.max(0, Math.min(...rect.map(p => p.x)) - padding);
        const maxX = Math.min(width, Math.max(...rect.map(p => p.x)) + padding);
        const minY = Math.max(0, Math.min(...rect.map(p => p.y)) - padding);
        const maxY = Math.max(...rect.map(p => p.y)) + padding;

        for (let y = minY; y < maxY; y += 2) {
            for (let x = minX; x < maxX; x += 2) {
                if (y * width + x < visited.length) {
                    visited[y * width + x] = 1;
                }
            }
        }
    }

    // Main optimized detection function
    static async detectRegions(
        imageData: ImageData,
        sensitivity: number = 50,
        progressCallback?: (progress: number, stage: string) => void
    ): Promise<Point[][]> {
        const { width, height } = imageData;
        
        progressCallback?.(10, 'Converting to grayscale...');
        await new Promise(resolve => setTimeout(resolve, 50)); // Allow UI update
        
        const grayData = this.toGrayscale(imageData);
        
        progressCallback?.(30, 'Detecting edges...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const threshold = Math.max(20, 255 - (sensitivity * 2));
        const edges = this.fastEdgeDetection(grayData, width, height, threshold);
        
        progressCallback?.(60, 'Finding regions...');
        await new Promise(resolve => setTimeout(resolve, 100));
        
        const regions = this.findSimpleRectangles(edges, width, height, 25);
        
        progressCallback?.(90, 'Optimizing results...');
        await new Promise(resolve => setTimeout(resolve, 50));
        
        return regions.slice(0, 12); // Limit to prevent UI overload
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
    const [sensitivity, setSensitivity] = useState([60]);
    const [processingStage, setProcessingStage] = useState('');
    const [previewMode, setPreviewMode] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [detectedRegions, setDetectedRegions] = useState<Point[][]>([]);

    const processImage = useCallback(async () => {
        if (!image || isProcessing) return;

        console.log('Starting AI detection process...');
        setIsProcessing(true);
        setProgress(0);
        setProcessingStage('Initializing...');

        try {
            // Create optimized canvas - limit size for performance
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                throw new Error('Canvas context not available');
            }

            // Optimize dimensions for performance
            const maxDimension = 800;
            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
            
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            
            console.log(`Processing at ${canvas.width}x${canvas.height} (scale: ${scale})`);

            setProgress(5);
            setProcessingStage('Preparing image...');
            
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            // Use optimized detection
            const regions = await OptimizedEdgeDetector.detectRegions(
                imageData,
                sensitivity[0],
                (prog, stage) => {
                    setProgress(prog);
                    setProcessingStage(stage);
                }
            );

            console.log(`Detected ${regions.length} regions`);

            if (previewMode) {
                // Create preview
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 3;

                regions.forEach((region, index) => {
                    if (region.length >= 4) {
                        ctx.beginPath();
                        ctx.moveTo(region[0].x, region[0].y);
                        region.slice(1).forEach(point => {
                            ctx.lineTo(point.x, point.y);
                        });
                        ctx.closePath();
                        ctx.stroke();
                        
                        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
                        ctx.fill();
                        
                        // Add region number
                        ctx.fillStyle = '#00ff88';
                        ctx.font = '12px Arial';
                        ctx.fillText(`${index + 1}`, region[0].x + 5, region[0].y - 5);
                    }
                });

                setPreviewImage(canvas.toDataURL());
                setDetectedRegions(regions);
                setProgress(100);
                setProcessingStage('Preview ready!');
                
            } else {
                // Direct application
                const finalRegions: Region[] = regions
                    .filter(region => region.length >= 4)
                    .map((region, index) => ({
                        id: `ai-region-${Date.now()}-${index}`,
                        points: region.map(point => ({
                            x: Math.round(point.x / scale),
                            y: Math.round(point.y / scale)
                        })),
                        outlineColor: '#00ff88',
                        color: undefined,
                        filled: false,
                        type: 'polygon' as const
                    }));

                setProgress(100);
                setProcessingStage('Complete!');

                console.log(`Adding ${finalRegions.length} regions to canvas`);

                if (finalRegions.length > 0) {
                    onRegionsDetected(finalRegions);
                    
                    toast({
                        title: "🤖 AI Detection Successful!",
                        description: `Found ${finalRegions.length} regions. Ready to colorize!`,
                    });
                } else {
                    toast({
                        title: "No Regions Found",
                        description: "Try adjusting sensitivity or use a different image",
                        variant: "destructive"
                    });
                }

                setTimeout(() => {
                    setIsProcessing(false);
                    if (finalRegions.length > 0) {
                        onClose();
                    }
                }, 1500);
            }

        } catch (error) {
            console.error('Detection error:', error);
            toast({
                title: "Detection Failed",
                description: "An error occurred during processing. Please try again.",
                variant: "destructive"
            });
            setIsProcessing(false);
            setProgress(0);
            setProcessingStage('');
        }
    }, [image, sensitivity, previewMode, onRegionsDetected, onClose, isProcessing]);

    const handleAddToCanvas = useCallback(() => {
        if (detectedRegions.length === 0) return;
        
        console.log('Adding preview regions to canvas...');
        
        const scale = Math.min(1, 800 / Math.max(image?.width || 800, image?.height || 800));
        
        const finalRegions: Region[] = detectedRegions
            .filter(region => region.length >= 4)
            .map((region, index) => ({
                id: `ai-region-${Date.now()}-${index}`,
                points: region.map(point => ({
                    x: Math.round(point.x / scale),
                    y: Math.round(point.y / scale)
                })),
                outlineColor: '#00ff88',
                color: undefined,
                filled: false,
                type: 'polygon' as const
            }));

        onRegionsDetected(finalRegions);
        
        toast({
            title: "🎯 Regions Added!",
            description: `Added ${finalRegions.length} regions to your canvas`,
        });
        
        onClose();
    }, [detectedRegions, image, onRegionsDetected, onClose]);

    const resetPreview = useCallback(() => {
        setPreviewImage(null);
        setDetectedRegions([]);
        setPreviewMode(false);
        setProgress(0);
        setProcessingStage('');
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Bot className="h-5 w-5 text-green-400" />
                        Fast AI Detection
                    </h2>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={onClose} 
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
                                Processing optimized for better performance...
                            </p>
                        </div>
                    )}

                    {/* Preview Image */}
                    {previewImage && !isProcessing && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Detection Preview ({detectedRegions.length} regions found)
                            </h4>
                            <img
                                src={previewImage}
                                alt="Detection Preview"
                                className="w-full max-h-48 object-contain border border-zinc-700 rounded bg-zinc-800"
                            />
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleAddToCanvas}
                                    className="flex-1 bg-green-600 hover:bg-green-500"
                                    disabled={detectedRegions.length === 0}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Add {detectedRegions.length} Regions
                                </Button>
                                <Button
                                    variant="outline"
                                    onClick={resetPreview}
                                    className="border-zinc-600 text-white hover:bg-zinc-800"
                                >
                                    Back
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* Controls - only show when not processing */}
                    {!isProcessing && !previewImage && (
                        <>
                            <div className="space-y-3">
                                <h3 className="text-sm font-semibold text-white">
                                    Edge Sensitivity: {sensitivity[0]}%
                                </h3>
                                <Slider
                                    value={sensitivity}
                                    onValueChange={setSensitivity}
                                    max={90}
                                    min={30}
                                    step={10}
                                    className="w-full"
                                />
                                <p className="text-xs text-zinc-400">
                                    Higher values detect more edges (may be slower)
                                </p>
                            </div>

                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-white">Preview Mode</span>
                                <Button
                                    variant={previewMode ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() => setPreviewMode(!previewMode)}
                                >
                                    {previewMode ? 'Preview First' : 'Direct Apply'}
                                </Button>
                            </div>

                            <Button
                                onClick={processImage}
                                disabled={!image}
                                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                            >
                                <Bot className="h-4 w-4 mr-2" />
                                {previewMode ? 'Preview Detection' : 'Detect Regions'}
                            </Button>
                        </>
                    )}

                    {/* Info */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">⚡ Optimized Detection</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Fast Processing:</strong> Optimized algorithms for better performance</li>
                            <li>• <strong>Smart Sizing:</strong> Automatic image scaling for speed</li>
                            <li>• <strong>Memory Efficient:</strong> Reduced memory usage during processing</li>
                            <li>• <strong>Quality Results:</strong> Focused on rectangular regions like windows/doors</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIEdgeDetection;
