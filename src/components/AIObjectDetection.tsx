
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Bot, Sparkles, Zap } from 'lucide-react';
import { detectObjectsInCanvas } from '@/lib/ai/segmentation';
import { toast } from '@/hooks/use-toast';

interface Region {
  id: string;
  points: { x: number; y: number }[];
  color?: string;
  outlineColor?: string;
  texture?: string;
  filled: boolean;
  type: 'freehand' | 'rectangle' | 'polygon';
}

interface AIObjectDetectionProps {
  image: HTMLImageElement | null;
  onRegionsDetected: (regions: Region[]) => void;
  isOpen: boolean;
  onClose: () => void;
}

const AIObjectDetection: React.FC<AIObjectDetectionProps> = ({
  image,
  onRegionsDetected,
  isOpen,
  onClose,
}) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const [detectedObjects, setDetectedObjects] = useState<any[]>([]);

  const generateColors = (count: number): string[] => {
    const colors = [
      '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57',
      '#ff9ff3', '#54a0ff', '#5f27cd', '#00d2d3', '#ff9f43',
      '#c44569', '#40407a', '#706fd3', '#f97f51', '#833471',
      '#18dcff', '#7d5fff', '#3c40c6', '#0984e3', '#6c5ce7'
    ];
    
    const result: string[] = [];
    for (let i = 0; i < count; i++) {
      result.push(colors[i % colors.length]);
    }
    return result;
  };

  const handleDetection = async () => {
    if (!image) {
      toast({
        title: "No image",
        description: "Please upload an image first",
        variant: "destructive",
      });
      return;
    }

    setIsProcessing(true);
    setProgress(0);
    setStatus('Preparing image...');
    setDetectedObjects([]);

    try {
      // Create canvas from image
      const canvas = document.createElement('canvas');
      canvas.width = image.width;
      canvas.height = image.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to create canvas context');
      
      ctx.drawImage(image, 0, 0);

      // Detect objects
      const result = await detectObjectsInCanvas(canvas, (p, s) => {
        setProgress(p);
        setStatus(s);
      });

      console.log('Detection result:', result);

      if (result.regions.length === 0) {
        toast({
          title: "No objects detected",
          description: "Try adjusting the image or using a different approach",
          variant: "destructive",
        });
        setIsProcessing(false);
        return;
      }

      setDetectedObjects(result.regions);
      setProgress(100);
      setStatus(`Detected ${result.regions.length} objects using ${result.model}`);

      toast({
        title: "🎯 Objects Detected!",
        description: `Found ${result.regions.length} individual objects. Review and apply them to your canvas.`,
      });

    } catch (error) {
      console.error('Object detection failed:', error);
      toast({
        title: "Detection Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
      setProgress(0);
      setStatus('');
    }

    setIsProcessing(false);
  };

  const handleApplyDetections = () => {
    if (detectedObjects.length === 0) return;

    const colors = generateColors(detectedObjects.length);
    
    const regions: Region[] = detectedObjects.map((obj, index) => ({
      id: obj.id,
      points: obj.points,
      outlineColor: colors[index],
      filled: false,
      type: obj.type,
    }));

    onRegionsDetected(regions);
    
    toast({
      title: "✨ Objects Applied!",
      description: `Added ${regions.length} detected objects to your canvas`,
    });
    
    onClose();
  };

  const handleClose = () => {
    setDetectedObjects([]);
    setProgress(0);
    setStatus('');
    setIsProcessing(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl bg-zinc-900 border-zinc-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Bot className="h-5 w-5 text-green-400" />
            AI Object Detection
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center space-y-4">
            {!isProcessing && detectedObjects.length === 0 && (
              <>
                <div className="text-6xl mb-4">🤖</div>
                <h3 className="text-xl font-semibold text-white">Smart Object Detection</h3>
                <p className="text-zinc-400">
                  AI will automatically detect and outline individual objects in your image like windows, doors, walls, and architectural elements.
                </p>
                <Button
                  onClick={handleDetection}
                  className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  size="lg"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Detect Objects
                </Button>
              </>
            )}

            {isProcessing && (
              <div className="space-y-4">
                <div className="text-4xl animate-spin">🔄</div>
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">Processing Image...</h3>
                  <Progress value={progress} className="w-full mb-2" />
                  <p className="text-sm text-zinc-400">{status}</p>
                </div>
              </div>
            )}

            {!isProcessing && detectedObjects.length > 0 && (
              <div className="space-y-4">
                <div className="text-4xl">🎯</div>
                <h3 className="text-lg font-semibold text-white">
                  Detection Complete!
                </h3>
                <div className="bg-zinc-800 rounded-lg p-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-zinc-400">Objects Found:</span>
                      <span className="text-white font-semibold ml-2">{detectedObjects.length}</span>
                    </div>
                    <div>
                      <span className="text-zinc-400">Model:</span>
                      <span className="text-white font-semibold ml-2 text-xs">DETR</span>
                    </div>
                  </div>
                  
                  <div className="mt-4 space-y-2">
                    <h4 className="text-sm font-semibold text-white">Detected Objects:</h4>
                    <div className="flex flex-wrap gap-1">
                      {detectedObjects.slice(0, 10).map((obj, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-zinc-700 rounded text-xs text-zinc-300"
                        >
                          {obj.label} ({Math.round(obj.confidence * 100)}%)
                        </span>
                      ))}
                      {detectedObjects.length > 10 && (
                        <span className="px-2 py-1 bg-zinc-600 rounded text-xs text-zinc-400">
                          +{detectedObjects.length - 10} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 justify-center">
                  <Button
                    onClick={handleApplyDetections}
                    className="bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-700 hover:to-blue-700"
                  >
                    <Sparkles className="h-4 w-4 mr-2" />
                    Apply to Canvas
                  </Button>
                  <Button
                    onClick={handleDetection}
                    variant="outline"
                    className="border-zinc-600"
                  >
                    Detect Again
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIObjectDetection;
