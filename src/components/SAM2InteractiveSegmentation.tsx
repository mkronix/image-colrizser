import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/hooks/use-toast';
import {
    sam2Segmentation
} from '@/lib/ai/sam2-segmentation';
import {
    Bot,
    RefreshCw,
    Sparkles,
    Square,
    Target,
    Wand2,
    Zap
} from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';

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

interface CanvasPoint extends Point {
    isNegative?: boolean;
}

interface BoundingBox {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface SAM2InteractiveSegmentationProps {
    image: HTMLImageElement | null;
    isOpen: boolean;
    onClose: () => void;
    onRegionsDetected: (regions: Region[]) => void;
}

type SegmentationMode = 'point' | 'box' | 'auto';

const SAM2InteractiveSegmentation: React.FC<SAM2InteractiveSegmentationProps> = ({
    image,
    isOpen,
    onClose,
    onRegionsDetected
}) => {
    const [isInitializing, setIsInitializing] = useState<boolean>(false);
    const [isReady, setIsReady] = useState<boolean>(false);
    const [isProcessing, setIsProcessing] = useState<boolean>(false);
    const [progress, setProgress] = useState<number>(0);
    const [status, setStatus] = useState<string>('');
    const [mode, setMode] = useState<SegmentationMode>('point');
    const [points, setPoints] = useState<CanvasPoint[]>([]);
    const [box, setBox] = useState<BoundingBox | null>(null);
    const [isDrawingBox, setIsDrawingBox] = useState<boolean>(false);
    const [detectedRegions, setDetectedRegions] = useState<Region[]>([]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [canvasSize] = useState({ width: 800, height: 600 });

    // Initialize SAM2 when component mounts
    useEffect(() => {
        if (isOpen && image && !isReady && !isInitializing) {
            initializeSAM2();
        }
    }, [isOpen, image, isReady, isInitializing]);

    const initializeSAM2 = async (): Promise<void> => {
        setIsInitializing(true);
        setProgress(0);
        setStatus('Loading SAM2...');
        try {
            await sam2Segmentation.initialize((progressData) => {
                setProgress(progressData.progress);
                setStatus(progressData.status);
            });
            setIsReady(true);
            setStatus('SAM2 ready! Click on the image to segment objects.');
        } catch (err) {
            toast({
                title: 'Segmentation Setup Failed',
                description: err instanceof Error ? err.message : 'Unknown error',
                variant: 'destructive'
            });
        } finally {
            setIsInitializing(false);
        }
    };

    // Apply selected regions
    const handleApplyRegions = (): void => {
        if (detectedRegions.length > 0) {
            onRegionsDetected(detectedRegions);
            toast({
                title: "✨ Regions Applied!",
                description: `Added ${detectedRegions.length} segmented regions to your canvas`,
            });
            handleClose();
        }
    };

    // Clear current state
    const handleClear = (): void => {
        setPoints([]);
        setBox(null);
        setDetectedRegions([]);
        setIsDrawingBox(false);
    };

    // Close handler
    const handleClose = (): void => {
        handleClear();
        setIsReady(false);
        setIsInitializing(false);
        setIsProcessing(false);
        setProgress(0);
        setStatus('');
        onClose();
    };

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent): void => {
            if (!isOpen) return;

            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'Enter' && detectedRegions.length > 0) {
                handleApplyRegions();
            } else if (e.key === 'c' && (e.ctrlKey || e.metaKey)) {
                e.preventDefault();
                handleClear();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, detectedRegions]);

    // Drawing helpers
    const transformRef = React.useRef({ scale: 1, offsetX: 0, offsetY: 0 });

    const drawCanvas = (): void => {
        const canvas = canvasRef.current;
        if (!canvas || !image) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        const iw = (image as HTMLImageElement).naturalWidth || image.width;
        const ih = (image as HTMLImageElement).naturalHeight || image.height;
        const scale = Math.min(canvas.width / iw, canvas.height / ih);
        const drawW = iw * scale;
        const drawH = ih * scale;
        const offsetX = (canvas.width - drawW) / 2;
        const offsetY = (canvas.height - drawH) / 2;
        transformRef.current = { scale, offsetX, offsetY };

        ctx.drawImage(image, offsetX, offsetY, drawW, drawH);

        // Draw points (green for positive, red for negative)
        if (mode === 'point') {
            points.forEach((p) => {
                ctx.beginPath();
                ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
                ctx.fillStyle = p.isNegative ? 'rgba(239,68,68,0.9)' : 'rgba(34,197,94,0.9)';
                ctx.fill();
                ctx.lineWidth = 1;
                ctx.strokeStyle = 'rgba(0,0,0,0.8)';
                ctx.stroke();
            });
        }

        // Draw bounding box
        if (mode === 'box' && box) {
            const x = box.width >= 0 ? box.x : box.x + box.width;
            const y = box.height >= 0 ? box.y : box.y + box.height;
            const w = Math.abs(box.width);
            const h = Math.abs(box.height);
            ctx.lineWidth = 2;
            ctx.strokeStyle = 'rgba(59,130,246,0.9)';
            ctx.strokeRect(x, y, w, h);
        }
    };

    useEffect(() => {
        if (isReady) drawCanvas();
    }, [image, points, box, isDrawingBox, isReady, mode]);

    const getCanvasPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const canvasToImage = (p: { x: number; y: number }) => {
        const { scale, offsetX, offsetY } = transformRef.current;
        return {
            x: Math.max(0, Math.round((p.x - offsetX) / scale)),
            y: Math.max(0, Math.round((p.y - offsetY) / scale)),
        };
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'point') return;
        const pos = getCanvasPos(e);
        setPoints((prev) => [...prev, { x: pos.x, y: pos.y, isNegative: e.shiftKey }]);
    };

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'box') return;
        const pos = getCanvasPos(e);
        setIsDrawingBox(true);
        setBox({ x: pos.x, y: pos.y, width: 0, height: 0 });
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'box' || !isDrawingBox || !box) return;
        const pos = getCanvasPos(e);
        setBox({ ...box, width: pos.x - box.x, height: pos.y - box.y });
    };

    const handleMouseUp = async (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (mode !== 'box' || !isDrawingBox || !box || !image) return;
        setIsDrawingBox(false);
        const end = getCanvasPos(e);
        const x1 = Math.min(box.x, end.x);
        const y1 = Math.min(box.y, end.y);
        const x2 = Math.max(box.x, end.x);
        const y2 = Math.max(box.y, end.y);
        const startImg = canvasToImage({ x: x1, y: y1 });
        const endImg = canvasToImage({ x: x2, y: y2 });
        setIsProcessing(true);
        setStatus('Segmenting box...');
        try {
            const result = await sam2Segmentation.segmentFromBox(image, [startImg.x, startImg.y, endImg.x, endImg.y]);
            const poly = sam2Segmentation.maskToPolygon(result.mask, result.width, result.height);
            if (poly.length >= 3) {
                const { scale, offsetX, offsetY } = transformRef.current;
                const canvasPoints = poly.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
                setDetectedRegions([
                    {
                        id: `sam2-box-${Date.now()}`,
                        points: canvasPoints,
                        confidence: result.confidence,
                        type: 'polygon',
                        filled: false,
                        outlineColor: '#60a5fa',
                    },
                ]);
            } else {
                toast({ title: 'No object found', description: 'Try a tighter box or different area.' });
            }
        } catch (err) {
            toast({ title: 'Segmentation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handleAutomaticSegmentation = async (): Promise<void> => {
        if (!image) return;
        setIsProcessing(true);
        setProgress(0);
        setStatus('Running automatic segmentation...');
        try {
            const results = await sam2Segmentation.automaticSegmentation(image, ({ status, progress }) => {
                setStatus(status);
                setProgress(progress);
            });
            const { scale, offsetX, offsetY } = transformRef.current;
            const regions: Region[] = [];
            for (let i = 0; i < results.length && i < 20; i++) {
                const r = results[i];
                const poly = sam2Segmentation.maskToPolygon(r.mask, r.width, r.height);
                if (poly.length >= 3) {
                    const pts = poly.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
                    regions.push({
                        id: `sam2-auto-${Date.now()}-${i}`,
                        points: pts,
                        confidence: r.confidence,
                        type: 'polygon',
                        filled: false,
                        outlineColor: `hsl(${(i * 360 / results.length)}, 70%, 60%)`,
                    });
                }
            }
            setDetectedRegions(regions);
            if (regions.length === 0) {
                toast({ title: 'No regions detected', description: 'Try switching modes or providing a point/box.' });
            }
        } catch (err) {
            toast({ title: 'Automatic segmentation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    const handlePointSegmentation = async (): Promise<void> => {
        if (!image || points.length === 0) return;
        setIsProcessing(true);
        setStatus('Segmenting from points...');
        try {
            const { scale, offsetX, offsetY } = transformRef.current;
            const inputPoints: number[][] = points.map((p) => {
                const img = canvasToImage({ x: p.x, y: p.y });
                return [img.x, img.y];
            });
            const labels: number[] = points.map((p) => (p.isNegative ? 0 : 1));
            const res = await sam2Segmentation.segmentFromPoints(image, inputPoints, labels);
            const poly = sam2Segmentation.maskToPolygon(res.mask, res.width, res.height);
            if (poly.length >= 3) {
                const canvasPts = poly.map((p) => ({ x: p.x * scale + offsetX, y: p.y * scale + offsetY }));
                setDetectedRegions([
                    {
                        id: `sam2-${Date.now()}`,
                        points: canvasPts,
                        confidence: res.confidence,
                        type: 'polygon',
                        filled: false,
                        outlineColor: '#60a5fa',
                    },
                ]);
            } else {
                toast({ title: 'No region produced', description: 'Try adding more positive points or some negative ones (Shift+Click).' });
            }
        } catch (err) {
            toast({ title: 'Point segmentation failed', description: err instanceof Error ? err.message : 'Unknown error', variant: 'destructive' });
        } finally {
            setIsProcessing(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="max-w-6xl bg-zinc-900 border-zinc-700 text-white">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5 text-blue-400" />
                        SAM2 Interactive Segmentation
                    </DialogTitle>
                </DialogHeader>

                <div className="space-y-6">
                    {/* Status and Progress */}
                    {(isInitializing || isProcessing) && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
                                <span className="text-sm text-blue-300">{status}</span>
                            </div>
                            <Progress value={progress} className="w-full" />
                        </div>
                    )}

                    {/* Mode Selection */}
                    {isReady && !isProcessing && (
                        <div className="flex gap-2 p-3 bg-zinc-800 rounded-lg">
                            <Button
                                variant={mode === 'point' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setMode('point'); handleClear(); }}
                                className="flex items-center gap-2"
                            >
                                <Target className="h-4 w-4" />
                                Point Mode
                            </Button>
                            <Button
                                variant={mode === 'box' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setMode('box'); handleClear(); }}
                                className="flex items-center gap-2"
                            >
                                <Square className="h-4 w-4" />
                                Box Mode
                            </Button>
                            <Button
                                variant={mode === 'auto' ? 'default' : 'outline'}
                                size="sm"
                                onClick={() => { setMode('auto'); handleClear(); }}
                                className="flex items-center gap-2"
                            >
                                <Wand2 className="h-4 w-4" />
                                Auto Mode
                            </Button>
                        </div>
                    )}

                    {/* Instructions */}
                    {isReady && !isProcessing && (
                        <div className="bg-zinc-800/50 p-3 rounded-lg">
                            <div className="text-sm text-zinc-300">
                                {mode === 'point' && (
                                    <>
                                        <strong>Point Mode:</strong> Click on objects to segment them.
                                        Hold Shift and click for negative points (background).
                                    </>
                                )}
                                {mode === 'box' && (
                                    <>
                                        <strong>Box Mode:</strong> Click and drag to draw a bounding box around objects.
                                    </>
                                )}
                                {mode === 'auto' && (
                                    <>
                                        <strong>Auto Mode:</strong> Automatically detect and segment all objects in the image.
                                    </>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Canvas */}
                    {image && (
                        <div className="relative">
                            <canvas
                                ref={canvasRef}
                                width={canvasSize.width}
                                height={canvasSize.height}
                                onClick={handleCanvasClick}
                                onMouseDown={handleMouseDown}
                                onMouseMove={handleMouseMove}
                                onMouseUp={handleMouseUp}
                                className="border border-zinc-600 rounded-lg cursor-crosshair bg-zinc-800"
                                style={{ maxWidth: '100%', height: 'auto' }}
                            />

                            {/* Point counter */}
                            {mode === 'point' && points.length > 0 && (
                                <div className="absolute top-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm">
                                    {points.length} point{points.length !== 1 ? 's' : ''}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Auto Mode Controls */}
                    {mode === 'auto' && isReady && !isProcessing && (
                        <div className="flex justify-center">
                            <Button
                                onClick={handleAutomaticSegmentation}
                                className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500"
                                size="lg"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Start Automatic Segmentation
                            </Button>
                        </div>
                    )}

                    {/* Results */}
                    {detectedRegions.length > 0 && (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-semibold flex items-center gap-2">
                                    <Zap className="h-5 w-5 text-yellow-400" />
                                    Detected Regions ({detectedRegions.length})
                                </h3>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-60 overflow-y-auto">
                                {detectedRegions.map((region, index) => (
                                    <div
                                        key={region.id}
                                        className="p-3 bg-zinc-800 rounded-lg border border-zinc-600"
                                    >
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="font-medium">Region {index + 1}</span>
                                            {region.confidence && (
                                                <Badge variant="secondary" className="text-xs">
                                                    {Math.round(region.confidence * 100)}%
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-400">
                                            {region.points.length} points
                                        </div>
                                        {region.outlineColor && (
                                            <div className="flex items-center gap-2 mt-2">
                                                <div
                                                    className="w-4 h-4 rounded border border-zinc-500"
                                                    style={{ backgroundColor: region.outlineColor }}
                                                />
                                                <span className="text-xs text-zinc-400">Preview color</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-4 border-t border-zinc-700">
                        <div className="flex gap-2">
                            {(points.length > 0 || box || detectedRegions.length > 0) && (
                                <Button
                                    variant="outline"
                                    onClick={handleClear}
                                    className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                                >
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Clear
                                </Button>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleClose}
                                className="border-zinc-600 text-zinc-300 hover:bg-zinc-800"
                            >
                                Cancel
                            </Button>

                            {detectedRegions.length > 0 && (
                                <Button
                                    onClick={handleApplyRegions}
                                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Apply {detectedRegions.length} Region{detectedRegions.length !== 1 ? 's' : ''}
                                </Button>
                            )}

                            {mode === 'point' && points.length > 0 && detectedRegions.length === 0 && (
                                <Button
                                    onClick={() => handlePointSegmentation()}
                                    className="bg-blue-600 hover:bg-blue-500"
                                >
                                    <Target className="h-4 w-4 mr-2" />
                                    Segment Points
                                </Button>
                            )}
                        </div>
                    </div>

                    {/* Keyboard shortcuts help */}
                    <div className="text-xs text-zinc-500 text-center">
                        <span>💡 </span>
                        Press <kbd className="px-1 py-0.5 bg-zinc-700 rounded">Esc</kbd> to close,
                        <kbd className="px-1 py-0.5 bg-zinc-700 rounded ml-1">Enter</kbd> to apply,
                        <kbd className="px-1 py-0.5 bg-zinc-700 rounded ml-1">Ctrl+C</kbd> to clear
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default SAM2InteractiveSegmentation;