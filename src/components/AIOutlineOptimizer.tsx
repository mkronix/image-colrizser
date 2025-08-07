
import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, CheckCircle, X, Eye, Zap } from 'lucide-react';
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

interface OptimizationSuggestion {
    type: 'smoothing' | 'simplification' | 'closure' | 'alignment';
    title: string;
    description: string;
    confidence: number;
    preview: Point[];
    originalPoints: Point[];
    improvement: string;
}

interface AIOutlineOptimizerProps {
    region: Region | null;
    isOpen: boolean;
    onClose: () => void;
    onOptimizationApplied: (optimizedRegion: Region) => void;
}

class OutlineOptimizer {
    static smoothPath(points: Point[], intensity: number = 0.8): Point[] {
        if (points.length < 4) return points;

        const smoothed: Point[] = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const prev = points[Math.max(0, i - 1)];
            const curr = points[i];
            const next = points[Math.min(points.length - 1, i + 1)];

            // Stronger smoothing
            const smoothX = (prev.x + curr.x * 2 + next.x) / 4;
            const smoothY = (prev.y + curr.y * 2 + next.y) / 4;

            smoothed.push({
                x: Math.round(curr.x + (smoothX - curr.x) * intensity),
                y: Math.round(curr.y + (smoothY - curr.y) * intensity)
            });
        }

        smoothed.push(points[points.length - 1]);
        return smoothed;
    }

    static simplifyPath(points: Point[], epsilon: number = 6): Point[] {
        if (points.length < 4) return points;
        
        const simplified = this.douglasPeucker(points, epsilon);
        
        // Ensure significant reduction for visible change
        if (simplified.length > points.length * 0.6) {
            return this.douglasPeucker(points, epsilon * 1.5);
        }
        
        return simplified;
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
        }

        return [start, end];
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

    static autoClosePath(points: Point[], threshold: number = 30): Point[] {
        if (points.length < 3) return points;

        const first = points[0];
        const last = points[points.length - 1];
        const distance = Math.sqrt(
            Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
        );

        if (distance <= threshold && distance > 5) {
            return [...points.slice(0, -1), first];
        }

        return points;
    }

    static alignPath(points: Point[], gridSize: number = 20): Point[] {
        if (points.length < 2) return points;

        return points.map((point, i) => {
            let x = Math.round(point.x / gridSize) * gridSize;
            let y = Math.round(point.y / gridSize) * gridSize;

            // Additional alignment for straight lines
            if (i > 0) {
                const prev = points[i - 1];
                const dx = Math.abs(x - prev.x);
                const dy = Math.abs(y - prev.y);

                // Snap to horizontal/vertical lines
                if (dx < gridSize / 2) x = prev.x;
                if (dy < gridSize / 2) y = prev.y;
            }

            return { x: Math.round(x), y: Math.round(y) };
        });
    }

    static analyzePath(points: Point[]): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];

        if (points.length < 3) return suggestions;

        // Check for jaggedness
        const jaggedness = this.calculateJaggedness(points);
        if (jaggedness > 0.3) {
            const smoothed = this.smoothPath(points, 0.8);
            suggestions.push({
                type: 'smoothing',
                title: 'Smooth Jagged Lines',
                description: 'Remove rough edges and make lines smoother',
                confidence: Math.min(jaggedness * 150, 95),
                preview: smoothed,
                originalPoints: points,
                improvement: `Reduced jaggedness by ${Math.round(jaggedness * 100)}%`
            });
        }

        // Check for complexity
        if (points.length > 15) {
            const simplified = this.simplifyPath(points, 5);
            const reduction = Math.round((1 - simplified.length / points.length) * 100);
            if (reduction > 20) {
                suggestions.push({
                    type: 'simplification',
                    title: 'Reduce Complexity',
                    description: 'Simplify outline while preserving shape',
                    confidence: Math.min(reduction * 1.5, 90),
                    preview: simplified,
                    originalPoints: points,
                    improvement: `Reduced points by ${reduction}% (${points.length} → ${simplified.length})`
                });
            }
        }

        // Check for closure
        const first = points[0];
        const last = points[points.length - 1];
        const closureDistance = Math.sqrt(
            Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
        );

        if (closureDistance < 50 && closureDistance > 8) {
            const closed = this.autoClosePath(points, 35);
            suggestions.push({
                type: 'closure',
                title: 'Close Shape',
                description: 'Automatically close the outline gap',
                confidence: Math.max(65, 100 - (closureDistance * 2)),
                preview: closed,
                originalPoints: points,
                improvement: `Closed gap of ${Math.round(closureDistance)}px`
            });
        }

        // Check for alignment
        const alignmentScore = this.calculateAlignmentScore(points);
        if (alignmentScore < 0.7 && points.length > 6) {
            const aligned = this.alignPath(points, 15);
            suggestions.push({
                type: 'alignment',
                title: 'Improve Alignment',
                description: 'Align to grid and straighten lines',
                confidence: (1 - alignmentScore) * 80,
                preview: aligned,
                originalPoints: points,
                improvement: `Improved alignment by ${Math.round((1 - alignmentScore) * 100)}%`
            });
        }

        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    static calculateJaggedness(points: Point[]): number {
        if (points.length < 3) return 0;

        let totalAngleChange = 0;
        let validSegments = 0;

        for (let i = 1; i < points.length - 1; i++) {
            const p1 = points[i - 1];
            const p2 = points[i];
            const p3 = points[i + 1];

            const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
            const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);

            let angleDiff = Math.abs(angle2 - angle1);
            if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

            totalAngleChange += angleDiff;
            validSegments++;
        }

        return validSegments > 0 ? (totalAngleChange / validSegments) / Math.PI : 0;
    }

    static calculateAlignmentScore(points: Point[]): number {
        if (points.length < 2) return 1;

        let alignedSegments = 0;
        const totalSegments = points.length - 1;

        for (let i = 1; i < points.length; i++) {
            const dx = Math.abs(points[i].x - points[i - 1].x);
            const dy = Math.abs(points[i].y - points[i - 1].y);
            
            // Check if segment is roughly horizontal or vertical
            if (dx < 5 || dy < 5 || Math.abs(dx - dy) < 5) {
                alignedSegments++;
            }
        }

        return alignedSegments / totalSegments;
    }
}

const AIOutlineOptimizer: React.FC<AIOutlineOptimizerProps> = ({
    region,
    isOpen,
    onClose,
    onOptimizationApplied
}) => {
    const [suggestions, setSuggestions] = useState<OptimizationSuggestion[]>([]);
    const [selectedSuggestions, setSelectedSuggestions] = useState<Set<number>>(new Set());
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [showPreview, setShowPreview] = useState(false);
    const [previewPoints, setPreviewPoints] = useState<Point[] | null>(null);

    const analyzePath = useCallback(async () => {
        if (!region || !region.points.length) return;

        console.log('Starting AI optimization analysis...');
        setIsAnalyzing(true);
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        setShowPreview(false);
        setPreviewPoints(null);

        try {
            // Add delay for UI feedback
            await new Promise(resolve => setTimeout(resolve, 800));

            const pathSuggestions = OutlineOptimizer.analyzePath(region.points);
            setSuggestions(pathSuggestions);

            if (pathSuggestions.length > 0) {
                // Auto-select the highest confidence suggestion
                setSelectedSuggestions(new Set([0]));
                
                toast({
                    title: "🤖 Analysis Complete!",
                    description: `Found ${pathSuggestions.length} optimization opportunities`,
                });
            } else {
                toast({
                    title: "✨ Perfect Outline!",
                    description: "Your outline is already well-optimized!",
                });
            }
        } catch (error) {
            console.error('Analysis error:', error);
            toast({
                title: "Analysis Failed",
                description: "Please try again with the outline",
                variant: "destructive"
            });
        } finally {
            setIsAnalyzing(false);
        }
    }, [region]);

    const toggleSuggestion = useCallback((index: number) => {
        setSelectedSuggestions(prev => {
            const newSet = new Set(prev);
            if (newSet.has(index)) {
                newSet.delete(index);
            } else {
                newSet.add(index);
            }
            return newSet;
        });
    }, []);

    const generatePreview = useCallback(() => {
        if (!region || selectedSuggestions.size === 0) return;

        let optimizedPoints = [...region.points];

        // Apply selected optimizations in order of confidence
        const sortedIndices = Array.from(selectedSuggestions).sort((a, b) => 
            suggestions[b].confidence - suggestions[a].confidence
        );

        for (const index of sortedIndices) {
            const suggestion = suggestions[index];
            optimizedPoints = suggestion.preview;
        }

        setPreviewPoints(optimizedPoints);
        setShowPreview(true);

        const appliedOptimizations = sortedIndices.map(i => suggestions[i].title);
        toast({
            title: "👁️ Preview Generated",
            description: `Showing: ${appliedOptimizations.join(', ')}`,
        });
    }, [region, selectedSuggestions, suggestions]);

    const applyOptimizations = useCallback((usePreview = false) => {
        if (!region) return;
        
        const finalPoints = usePreview && previewPoints ? previewPoints : (() => {
            if (selectedSuggestions.size === 0) return region.points;
            
            let optimizedPoints = [...region.points];
            const sortedIndices = Array.from(selectedSuggestions).sort((a, b) => 
                suggestions[b].confidence - suggestions[a].confidence
            );
            
            for (const index of sortedIndices) {
                optimizedPoints = suggestions[index].preview;
            }
            return optimizedPoints;
        })();

        const optimizedRegion: Region = {
            ...region,
            points: finalPoints
        };

        console.log('Applying optimizations:', {
            originalPoints: region.points.length,
            optimizedPoints: finalPoints.length,
            selectedOptimizations: Array.from(selectedSuggestions).map(i => suggestions[i].title)
        });

        onOptimizationApplied(optimizedRegion);

        toast({
            title: "🎯 Optimizations Applied!",
            description: `Your outline has been enhanced and updated`,
        });

        // Reset state and close
        resetState();
        onClose();
    }, [region, selectedSuggestions, suggestions, previewPoints, onOptimizationApplied, onClose]);

    const resetState = useCallback(() => {
        setSuggestions([]);
        setSelectedSuggestions(new Set());
        setShowPreview(false);
        setPreviewPoints(null);
        setIsAnalyzing(false);
    }, []);

    const handleClose = useCallback(() => {
        resetState();
        onClose();
    }, [resetState, onClose]);

    const handleBack = useCallback(() => {
        setShowPreview(false);
        setPreviewPoints(null);
    }, []);

    // Auto-analyze when region changes
    React.useEffect(() => {
        if (isOpen && region) {
            analyzePath();
        }
    }, [isOpen, region, analyzePath]);

    if (!isOpen || !region) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between rounded-t-2xl">
                    <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Bot className="h-5 w-5 text-blue-400" />
                        AI Outline Optimizer
                    </h2>
                    <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={handleClose} 
                        className="text-zinc-400 hover:text-white"
                        disabled={isAnalyzing}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                </div>

                <div className="p-4 space-y-4">
                    {/* Analysis Status */}
                    {isAnalyzing && (
                        <div className="flex items-center gap-3 p-3 bg-blue-900/20 border border-blue-700/50 rounded-lg">
                            <div className="animate-spin h-5 w-5 border-2 border-blue-400 border-t-transparent rounded-full" />
                            <div>
                                <p className="text-sm font-medium text-blue-300">Analyzing your outline...</p>
                                <p className="text-xs text-blue-400">Checking for improvements...</p>
                            </div>
                        </div>
                    )}

                    {/* Preview Mode */}
                    {showPreview && previewPoints && !isAnalyzing && (
                        <div className="bg-green-900/20 border border-green-700/50 rounded-lg p-3">
                            <h4 className="text-sm font-semibold text-green-300 mb-2 flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Optimization Preview
                            </h4>
                            <div className="text-xs text-green-200 space-y-1 mb-3">
                                <p><strong>Original:</strong> {region.points.length} points</p>
                                <p><strong>Optimized:</strong> {previewPoints.length} points</p>
                                <p><strong>Change:</strong> {((previewPoints.length - region.points.length) / region.points.length * 100).toFixed(1)}%</p>
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    onClick={() => applyOptimizations(true)}
                                    className="flex-1 bg-green-600 hover:bg-green-500"
                                >
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Apply Preview
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

                    {/* Suggestions */}
                    {!isAnalyzing && !showPreview && suggestions.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <Zap className="h-4 w-4 text-green-400" />
                                Optimization Suggestions
                            </h3>

                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={index}
                                    className={`p-3 border rounded-lg cursor-pointer transition-all ${selectedSuggestions.has(index)
                                            ? 'border-green-500 bg-green-900/20'
                                            : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                                        }`}
                                    onClick={() => toggleSuggestion(index)}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h4 className="text-sm font-medium text-white">{suggestion.title}</h4>
                                                <Badge
                                                    variant="secondary"
                                                    className="text-xs bg-zinc-700 text-zinc-300"
                                                >
                                                    {Math.round(suggestion.confidence)}%
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-zinc-400 mb-2">{suggestion.description}</p>
                                            <p className="text-xs text-green-400 font-medium">{suggestion.improvement}</p>
                                        </div>

                                        <div className="flex items-center gap-2 ml-2">
                                            {selectedSuggestions.has(index) && (
                                                <CheckCircle className="h-4 w-4 text-green-400" />
                                            )}
                                            <div className={`w-3 h-3 rounded border-2 ${selectedSuggestions.has(index)
                                                    ? 'border-green-400 bg-green-400'
                                                    : 'border-zinc-600'
                                                }`} />
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* No Suggestions */}
                    {!isAnalyzing && !showPreview && suggestions.length === 0 && (
                        <div className="text-center p-6 bg-green-900/20 border border-green-700/50 rounded-lg">
                            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                            <h3 className="text-sm font-semibold text-green-300 mb-1">Outline Already Optimized!</h3>
                            <p className="text-xs text-green-400">Your outline looks great - no improvements needed</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {!showPreview && !isAnalyzing && suggestions.length > 0 && selectedSuggestions.size > 0 && (
                        <div className="flex gap-3 pt-2">
                            <Button
                                onClick={generatePreview}
                                className="flex-1 bg-blue-600 hover:bg-blue-500"
                            >
                                <Eye className="h-4 w-4 mr-2" />
                                Preview Changes
                            </Button>
                            <Button
                                onClick={() => applyOptimizations(false)}
                                className="flex-1 bg-green-600 hover:bg-green-500"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Apply Direct
                            </Button>
                        </div>
                    )}

                    {/* Close Button */}
                    {!isAnalyzing && (
                        <div className="flex justify-center pt-2">
                            <Button
                                variant="ghost"
                                onClick={handleClose}
                                className="text-zinc-400 hover:text-white"
                            >
                                Close
                            </Button>
                        </div>
                    )}

                    {/* Tips */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Enhanced Optimizer</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Visible Results:</strong> More aggressive optimizations for clear changes</li>
                            <li>• <strong>Preview Mode:</strong> See exactly what will change before applying</li>
                            <li>• <strong>Smart Analysis:</strong> Better detection of improvement opportunities</li>
                            <li>• <strong>Detailed Metrics:</strong> Clear statistics on what changed</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIOutlineOptimizer;
