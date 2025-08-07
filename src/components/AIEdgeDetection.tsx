
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

// Simplified Edge Detection System
class FastEdgeDetector {
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

    static detectEdges(grayData: Uint8Array, width: number, height: number, threshold: number): Uint8Array {
        const edges = new Uint8Array(width * height);
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = y * width + x;
                
                const gx = grayData[idx + 1] - grayData[idx - 1];
                const gy = grayData[idx + width] - grayData[idx - width];
                
                const magnitude = Math.abs(gx) + Math.abs(gy);
                edges[idx] = magnitude > threshold ? 255 : 0;
            }
        }

        return edges;
    }

    static findRectangularRegions(edges: Uint8Array, width: number, height: number): Point[][] {
        const regions: Point[][] = [];
        const visited = new Uint8Array(width * height);
        const minSize = 30;
        
        // Simple grid-based detection
        for (let y = minSize; y < height - minSize; y += 20) {
            for (let x = minSize; x < width - minSize; x += 20) {
                if (visited[y * width + x]) continue;

                const rect = this.detectRectangle(edges, width, height, x, y, minSize);
                if (rect && rect.length === 4) {
                    regions.push(rect);
                    this.markVisited(visited, width, rect, 20);
                }

                if (regions.length >= 8) break; // Limit regions
            }
            if (regions.length >= 8) break;
        }

        return regions;
    }

    static detectRectangle(edges: Uint8Array, width: number, height: number, startX: number, startY: number, minSize: number): Point[] | null {
        const maxWidth = 120;
        const maxHeight = 120;
        
        let w = minSize;
        let h = minSize;
        
        // Simple rectangular detection
        while (w < maxWidth && startX + w < width - 5) {
            let edgeCount = 0;
            for (let y = startY; y < startY + h && y < height; y += 5) {
                if (edges[y * width + (startX + w)] > 0) edgeCount++;
            }
            if (edgeCount < 2) break;
            w += 10;
        }
        
        while (h < maxHeight && startY + h < height - 5) {
            let edgeCount = 0;
            for (let x = startX; x < startX + w && x < width; x += 5) {
                if (edges[(startY + h) * width + x] > 0) edgeCount++;
            }
            if (edgeCount < 2) break;
            h += 10;
        }

        if (w >= minSize && h >= minSize) {
            return [
                { x: startX, y: startY },
                { x: startX + w, y: startY },
                { x: startX + w, y: startY + h },
                { x: startX, y: startY + h }
            ];
        }

        return null;
    }

    static markVisited(visited: Uint8Array, width: number, rect: Point[], padding: number) {
        const minX = Math.max(0, Math.min(...rect.map(p => p.x)) - padding);
        const maxX = Math.max(...rect.map(p => p.x)) + padding;
        const minY = Math.max(0, Math.min(...rect.map(p => p.y)) - padding);
        const maxY = Math.max(...rect.map(p => p.y)) + padding;

        for (let y = minY; y < maxY && y * width < visited.length; y += 2) {
            for (let x = minX; x < maxX && y * width + x < visited.length; x += 2) {
                visited[y * width + x] = 1;
            }
        }
    }

    static async detectRegions(imageData: ImageData, sensitivity: number = 50, progressCallback?: (progress: number, stage: string) => void): Promise<Point[][]> {
        const { width, height } = imageData;
        
        try {
            progressCallback?.(20, 'Converting to grayscale...');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const grayData = this.toGrayscale(imageData);
            
            progressCallback?.(50, 'Detecting edges...');
            await new Promise(resolve => setTimeout(resolve, 150));
            
            const threshold = Math.max(30, 200 - sensitivity);
            const edges = this.detectEdges(grayData, width, height, threshold);
            
            progressCallback?.(80, 'Finding regions...');
            await new Promise(resolve => setTimeout(resolve, 100));
            
            const regions = this.findRectangularRegions(edges, width, height);
            
            return regions;
            
        } catch (error) {
            console.error('Detection error:', error);
            throw error;
        }
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
    const [showPreview, setShowPreview] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [detectedRegions, setDetectedRegions] = useState<Point[][]>([]);
    const [detectionScale, setDetectionScale] = useState(1);

    const processImage = useCallback(async () => {
        if (!image || isProcessing) return;

        console.log('Starting AI detection process...');
        setIsProcessing(true);
        setProgress(0);
        setProcessingStage('Initializing...');
        setShowPreview(false);
        setPreviewImage(null);
        setDetectedRegions([]);

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            // Optimize canvas size for performance
            const maxDimension = 600;
            const scale = Math.min(1, maxDimension / Math.max(image.width, image.height));
            setDetectionScale(scale);
            
            canvas.width = Math.round(image.width * scale);
            canvas.height = Math.round(image.height * scale);
            
            console.log(`Processing at ${canvas.width}x${canvas.height} (scale: ${scale})`);

            setProgress(10);
            setProcessingStage('Preparing image...');
            await new Promise(resolve => setTimeout(resolve, 50));
            
            ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

            const regions = await FastEdgeDetector.detectRegions(
                imageData,
                sensitivity[0],
                (prog, stage) => {
                    setProgress(prog);
                    setProcessingStage(stage);
                }
            );

            console.log(`Detected ${regions.length} regions`);

            if (regions.length > 0) {
                // Create preview
                ctx.strokeStyle = '#00ff88';
                ctx.lineWidth = 2;
                ctx.shadowColor = '#00ff88';
                ctx.shadowBlur = 2;

                regions.forEach((region, index) => {
                    if (region.length >= 4) {
                        ctx.beginPath();
                        ctx.moveTo(region[0].x, region[0].y);
                        region.slice(1).forEach(point => {
                            ctx.lineTo(point.x, point.y);
                        });
                        ctx.closePath();
                        ctx.stroke();
                        
                        // Light fill
                        ctx.fillStyle = 'rgba(0, 255, 136, 0.1)';
                        ctx.fill();
                        
                        // Region number
                        ctx.fillStyle = '#00ff88';
                        ctx.font = '12px Arial';
                        ctx.fillText(`${index + 1}`, region[0].x + 5, region[0].y - 5);
                    }
                });

                setPreviewImage(canvas.toDataURL());
                setDetectedRegions(regions);
                setShowPreview(true);
                setProgress(100);
                setProcessingStage('Preview ready!');
                
                toast({
                    title: "🎯 Regions Detected!",
                    description: `Found ${regions.length} regions. Review the preview.`,
                });
                
            } else {
                setProgress(100);
                setProcessingStage('No regions found');
                toast({
                    title: "No Regions Found",
                    description: "Try adjusting sensitivity or use a different image",
                    variant: "destructive"
                });
            }

        } catch (error) {
            console.error('Detection error:', error);
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
        if (detectedRegions.length === 0 || !image) return;
        
        console.log('Adding detected regions to canvas...');
        
        const finalRegions: Region[] = detectedRegions
            .filter(region => region.length >= 4)
            .map((region, index) => ({
                id: `ai-region-${Date.now()}-${index}`,
                points: region.map(point => ({
                    x: Math.round(point.x / detectionScale),
                    y: Math.round(point.y / detectionScale)
                })),
                outlineColor: '#00ff88',
                color: undefined,
                filled: false,
                type: 'polygon' as const
            }));

        console.log('Final regions to add:', finalRegions);

        if (finalRegions.length > 0) {
            onRegionsDetected(finalRegions);
            
            toast({
                title: "✅ Regions Added!",
                description: `Added ${finalRegions.length} regions to your canvas`,
            });
            
            // Reset and close
            resetState();
            onClose();
        }
    }, [detectedRegions, detectionScale, image, onRegionsDetected, onClose]);

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
                        Fast AI Detection
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
                                Processing optimized for better performance...
                            </p>
                        </div>
                    )}

                    {/* Preview Mode */}
                    {showPreview && previewImage && !isProcessing && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Detection Preview ({detectedRegions.length} regions found)
                            </h4>
                            <img
                                src={previewImage}
                                alt="Detection Preview"
                                className="w-full max-h-64 object-contain border border-zinc-700 rounded bg-zinc-800"
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
                                    Higher values detect more edges
                                </p>
                            </div>

                            <Button
                                onClick={processImage}
                                disabled={!image}
                                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                            >
                                <Bot className="h-4 w-4 mr-2" />
                                Detect Regions
                            </Button>
                        </>
                    )}

                    {/* No regions found message */}
                    {!isProcessing && !showPreview && progress === 100 && detectedRegions.length === 0 && (
                        <div className="text-center p-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                            <h3 className="text-sm font-semibold text-yellow-300 mb-1">No Regions Detected</h3>
                            <p className="text-xs text-yellow-400">Try adjusting the sensitivity or use a different image</p>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">⚡ Fast Detection</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Optimized Processing:</strong> Faster algorithms with preview</li>
                            <li>• <strong>Smart Scaling:</strong> Automatic image resizing for speed</li>
                            <li>• <strong>Rectangular Focus:</strong> Detects windows, doors, and similar shapes</li>
                            <li>• <strong>Preview First:</strong> Review before adding to canvas</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIEdgeDetection;
