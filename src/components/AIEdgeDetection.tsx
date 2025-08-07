
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Layers } from 'lucide-react';
import React from 'react';
import AIObjectDetection from './AIObjectDetection';

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

// This component now shows both options
const AIEdgeDetection: React.FC<AIEdgeDetectionProps> = ({
    image,
    onRegionsDetected,
    isOpen,
    onClose
}) => {
    const [showAIDetection, setShowAIDetection] = React.useState(false);

    if (!isOpen) return null;

    // Show AI Object Detection if selected
    if (showAIDetection) {
        return (
            <AIObjectDetection
                image={image}
                onRegionsDetected={onRegionsDetected}
                isOpen={true}
                onClose={() => {
                    setShowAIDetection(false);
                    onClose();
                }}
            />
        );
    }

    // Show selection screen
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
                <div className="p-6 space-y-6">
                    <div className="text-center">
                        <h2 className="text-xl font-semibold text-white mb-2">Choose AI Detection Mode</h2>
                        <p className="text-sm text-zinc-400">Select the type of AI detection you want to use</p>
                    </div>

                    <div className="space-y-4">
                        <Button
                            onClick={() => setShowAIDetection(true)}
                            className="w-full bg-gradient-to-r from-green-600 to-blue-600 hover:from-green-500 hover:to-blue-500 h-16"
                        >
                            <div className="text-center">
                                <div className="font-semibold">🤖 Smart AI Detection</div>
                                <div className="text-xs opacity-90">Detects actual objects (people, cars, windows, etc.)</div>
                            </div>
                        </Button>

                        <Button
                            onClick={() => {
                                toast({
                                    title: "Fast Edge Detection",
                                    description: "This feature has been simplified. Please use Smart AI Detection for better results.",
                                });
                            }}
                            variant="outline"
                            className="w-full border-zinc-600 text-white hover:bg-zinc-800 h-16"
                        >
                            <div className="text-center">
                                <div className="font-semibold flex items-center justify-center gap-2">
                                    <Layers className="h-4 w-4" />
                                    Fast Edge Detection
                                </div>
                                <div className="text-xs opacity-70">Basic rectangular region detection</div>
                            </div>
                        </Button>
                    </div>

                    <Button
                        variant="ghost"
                        onClick={onClose}
                        className="w-full text-zinc-400 hover:text-white"
                    >
                        Cancel
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AIEdgeDetection;
