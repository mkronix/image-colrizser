import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { toast } from '@/hooks/use-toast';
import { Bot, Eye, Sparkles, Zap } from 'lucide-react';
import React, { useCallback, useState } from 'react';
import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js
env.allowLocalModels = false;
env.useBrowserCache = true;

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

// Real AI Object Detection using Hugging Face
class HuggingFaceObjectDetector {
    private static detector: any = null;
    
    static async initializeDetector(progressCallback?: (progress: number, stage: string) => void) {
        if (this.detector) return this.detector;
        
        try {
            progressCallback?.(10, 'Loading AI model...');
            this.detector = await pipeline(
                'object-detection', 
                'Xenova/detr-resnet-50',
                { device: 'webgpu' }
            );
            progressCallback?.(30, 'Model loaded successfully');
            return this.detector;
        } catch (error) {
            console.log('WebGPU failed, falling back to CPU...');
            progressCallback?.(15, 'Falling back to CPU...');
            this.detector = await pipeline(
                'object-detection', 
                'Xenova/detr-resnet-50'
            );
            progressCallback?.(30, 'Model loaded on CPU');
            return this.detector;
        }
    }

    static async detectObjects(
        imageElement: HTMLImageElement, 
        confidenceThreshold: number = 0.5,
        progressCallback?: (progress: number, stage: string) => void
    ): Promise<{ regions: Region[], previewUrl: string }> {
        try {
            progressCallback?.(40, 'Preparing image...');
            
            // Create canvas for processing
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) throw new Error('Canvas context not available');

            // Set canvas size (optimize for performance)
            const maxSize = 800;
            const scale = Math.min(1, maxSize / Math.max(imageElement.width, imageElement.height));
            canvas.width = imageElement.width * scale;
            canvas.height = imageElement.height * scale;
            
            ctx.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
            
            progressCallback?.(60, 'Running AI detection...');
            
            // Initialize detector
            const detector = await this.initializeDetector(progressCallback);
            
            // Convert canvas to image data for the model
            const imageData = canvas.toDataURL('image/jpeg', 0.8);
            
            progressCallback?.(80, 'Analyzing objects...');
            
            // Run object detection
            const detections = await detector(imageData, { threshold: confidenceThreshold });
            
            console.log('Raw detections:', detections);
            
            progressCallback?.(90, 'Processing results...');
            
            // Convert detections to regions
            const regions: Region[] = detections
                .filter((detection: any) => detection.score >= confidenceThreshold)
                .map((detection: any, index: number) => {
                    const box = detection.box;
                    
                    // Scale back to original image size
                    const x1 = (box.xmin / scale);
                    const y1 = (box.ymin / scale);
                    const x2 = (box.xmax / scale);
                    const y2 = (box.ymax / scale);
                    
                    return {
                        id: `ai-object-${Date.now()}-${index}`,
                        points: [
                            { x: x1, y: y1 },
                            { x: x2, y: y1 },
                            { x: x2, y: y2 },
                            { x: x1, y: y2 }
                        ],
                        outlineColor: this.getColorForLabel(detection.label),
                        filled: false,
                        type: 'rectangle' as const,
                        label: detection.label,
                        confidence: Math.round(detection.score * 100)
                    };
                });

            // Create preview image with detections
            const previewCanvas = document.createElement('canvas');
            const previewCtx = previewCanvas.getContext('2d');
            if (!previewCtx) throw new Error('Preview canvas context not available');
            
            previewCanvas.width = canvas.width;
            previewCanvas.height = canvas.height;
            
            // Draw original image
            previewCtx.drawImage(canvas, 0, 0);
            
            // Draw detection boxes
            detections.forEach((detection: any, index: number) => {
                if (detection.score >= confidenceThreshold) {
                    const box = detection.box;
                    const color = this.getColorForLabel(detection.label);
                    
                    // Draw bounding box
                    previewCtx.strokeStyle = color;
                    previewCtx.lineWidth = 3;
                    previewCtx.strokeRect(box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin);
                    
                    // Draw semi-transparent fill
                    previewCtx.fillStyle = color + '20';
                    previewCtx.fillRect(box.xmin, box.ymin, box.xmax - box.xmin, box.ymax - box.ymin);
                    
                    // Draw label
                    previewCtx.fillStyle = color;
                    previewCtx.font = '14px Arial';
                    previewCtx.fillText(
                        `${detection.label} (${Math.round(detection.score * 100)}%)`,
                        box.xmin + 5,
                        box.ymin - 5
                    );
                }
            });
            
            const previewUrl = previewCanvas.toDataURL();
            
            return { regions, previewUrl };
            
        } catch (error) {
            console.error('Object detection error:', error);
            throw error;
        }
    }
    
    static getColorForLabel(label: string): string {
        const colorMap: { [key: string]: string } = {
            'person': '#ff6b6b',
            'car': '#4ecdc4',
            'truck': '#45b7d1',
            'window': '#96ceb4',
            'door': '#ffeaa7',
            'building': '#dda0dd',
            'house': '#98d8c8',
            'chair': '#f7dc6f',
            'table': '#bb8fce',
            'tv': '#85c1e9',
            'laptop': '#f8c471',
            'mouse': '#82e0aa',
            'keyboard': '#f1948a',
            'book': '#85c1e9',
            'clock': '#f7dc6f'
        };
        
        return colorMap[label.toLowerCase()] || '#00ff88';
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
    const [confidence, setConfidence] = useState([50]);
    const [processingStage, setProcessingStage] = useState('');
    const [showPreview, setShowPreview] = useState(false);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [detectedRegions, setDetectedRegions] = useState<Region[]>([]);

    const processImage = useCallback(async () => {
        if (!image || isProcessing) return;

        console.log('Starting AI object detection...');
        setIsProcessing(true);
        setProgress(0);
        setProcessingStage('Initializing AI...');
        setShowPreview(false);
        setPreviewImage(null);
        setDetectedRegions([]);

        try {
            const confidenceThreshold = confidence[0] / 100;
            
            const { regions, previewUrl } = await HuggingFaceObjectDetector.detectObjects(
                image,
                confidenceThreshold,
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
                    title: "🎯 Objects Detected!",
                    description: `Found ${regions.length} objects with AI. Review the preview.`,
                });
                
            } else {
                setProgress(100);
                setProcessingStage('No objects found');
                toast({
                    title: "No Objects Found",
                    description: "Try lowering the confidence threshold",
                    variant: "destructive"
                });
            }

        } catch (error) {
            console.error('Detection error:', error);
            toast({
                title: "AI Detection Failed",
                description: "Please check your internet connection and try again.",
                variant: "destructive"
            });
        } finally {
            setIsProcessing(false);
        }
    }, [image, confidence, isProcessing]);

    const handleAddToCanvas = useCallback(() => {
        if (detectedRegions.length === 0) return;
        
        console.log('Adding detected objects to canvas...');
        
        onRegionsDetected(detectedRegions);
        
        toast({
            title: "✅ Objects Added!",
            description: `Added ${detectedRegions.length} detected objects to your canvas`,
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
                        AI Object Detection
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
                                Using advanced AI models for accurate object detection...
                            </p>
                        </div>
                    )}

                    {/* Preview Mode */}
                    {showPreview && previewImage && !isProcessing && (
                        <div className="space-y-3">
                            <h4 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Detection Results ({detectedRegions.length} objects found)
                            </h4>
                            
                            {/* Objects Summary */}
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
                                alt="AI Detection Preview"
                                className="w-full max-h-64 object-contain border border-zinc-700 rounded bg-zinc-800"
                            />
                            <div className="flex gap-2">
                                <Button
                                    onClick={handleAddToCanvas}
                                    className="flex-1 bg-green-600 hover:bg-green-500"
                                    disabled={detectedRegions.length === 0}
                                >
                                    <Sparkles className="h-4 w-4 mr-2" />
                                    Add {detectedRegions.length} Objects
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
                                    Confidence Threshold: {confidence[0]}%
                                </h3>
                                <Slider
                                    value={confidence}
                                    onValueChange={setConfidence}
                                    max={90}
                                    min={10}
                                    step={5}
                                    className="w-full"
                                />
                                <p className="text-xs text-zinc-400">
                                    Higher values = fewer but more accurate detections
                                </p>
                            </div>

                            <Button
                                onClick={processImage}
                                disabled={!image}
                                className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500"
                            >
                                <Zap className="h-4 w-4 mr-2" />
                                Detect Objects with AI
                            </Button>
                        </>
                    )}

                    {/* No objects found message */}
                    {!isProcessing && !showPreview && progress === 100 && detectedRegions.length === 0 && (
                        <div className="text-center p-6 bg-yellow-900/20 border border-yellow-700/50 rounded-lg">
                            <h3 className="text-sm font-semibold text-yellow-300 mb-1">No Objects Detected</h3>
                            <p className="text-xs text-yellow-400">Try lowering the confidence threshold</p>
                        </div>
                    )}

                    {/* Info */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-green-400 mb-2">🤖 Real AI Detection</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Advanced Models:</strong> Uses DETR-ResNet-50 for accurate detection</li>
                            <li>• <strong>Multiple Objects:</strong> Detects people, vehicles, furniture, electronics</li>
                            <li>• <strong>Confidence Scores:</strong> Shows how certain the AI is about each detection</li>
                            <li>• <strong>Colored Labels:</strong> Different colors for different object types</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIObjectDetection;