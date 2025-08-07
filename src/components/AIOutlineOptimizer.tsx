import React, { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, Zap, TrendingUp, CheckCircle, X } from 'lucide-react';
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
}

interface AIOutlineOptimizerProps {
    region: Region | null;
    isOpen: boolean;
    onClose: () => void;
    onOptimizationApplied: (optimizedRegion: Region) => void;
}

class OutlineOptimizer {
    // Smooth a path using Catmull-Rom spline interpolation
    static smoothPath(points: Point[], tension: number = 0.5): Point[] {
        if (points.length < 3) return points;

        const smoothed: Point[] = [points[0]];

        for (let i = 1; i < points.length - 1; i++) {
            const p0 = points[i - 1];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[Math.min(i + 2, points.length - 1)];

            // Add intermediate points
            for (let t = 0; t <= 1; t += 0.2) {
                const point = this.catmullRomInterpolate(p0, p1, p2, p3, t, tension);
                if (t > 0) smoothed.push(point);
            }
        }

        smoothed.push(points[points.length - 1]);
        return smoothed;
    }

    static catmullRomInterpolate(p0: Point, p1: Point, p2: Point, p3: Point, t: number, tension: number): Point {
        const t2 = t * t;
        const t3 = t2 * t;

        const x = 0.5 * (
            (2 * p1.x) +
            (-p0.x + p2.x) * t +
            (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
            (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3
        );

        const y = 0.5 * (
            (2 * p1.y) +
            (-p0.y + p2.y) * t +
            (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
            (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3
        );

        return { x, y };
    }

    // Simplify path using Ramer-Douglas-Peucker algorithm
    static simplifyPath(points: Point[], epsilon: number = 2): Point[] {
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

    // Auto-close path if endpoints are near
    static autoClosePath(points: Point[], threshold: number = 15): Point[] {
        if (points.length < 3) return points;

        const first = points[0];
        const last = points[points.length - 1];
        const distance = Math.sqrt(
            Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
        );

        if (distance <= threshold) {
            return [...points.slice(0, -1), first];
        }

        return points;
    }

    // Align to grid or snap to angles
    static alignPath(points: Point[], gridSize: number = 10, snapAngles: number[] = [0, 45, 90, 135, 180]): Point[] {
        if (points.length < 2) return points;

        const aligned: Point[] = [points[0]];

        for (let i = 1; i < points.length; i++) {
            const current = points[i];
            const previous = aligned[aligned.length - 1];

            // Snap to grid
            let x = Math.round(current.x / gridSize) * gridSize;
            let y = Math.round(current.y / gridSize) * gridSize;

            // Snap to angles if line is long enough
            const dx = x - previous.x;
            const dy = y - previous.y;
            const length = Math.sqrt(dx * dx + dy * dy);

            if (length > 20) {
                const angle = Math.atan2(dy, dx) * 180 / Math.PI;
                const snappedAngle = this.snapToNearestAngle(angle, snapAngles);

                if (Math.abs(angle - snappedAngle) < 15) {
                    const radians = snappedAngle * Math.PI / 180;
                    x = previous.x + length * Math.cos(radians);
                    y = previous.y + length * Math.sin(radians);
                }
            }

            aligned.push({ x, y });
        }

        return aligned;
    }

    static snapToNearestAngle(angle: number, snapAngles: number[]): number {
        return snapAngles.reduce((closest, snapAngle) => {
            return Math.abs(angle - snapAngle) < Math.abs(angle - closest) ? snapAngle : closest;
        });
    }

    // Analyze path and generate suggestions
    static analyzePath(points: Point[]): OptimizationSuggestion[] {
        const suggestions: OptimizationSuggestion[] = [];

        if (points.length < 3) return suggestions;

        // Check if path needs smoothing
        const jaggedness = this.calculateJaggedness(points);
        if (jaggedness > 0.3) {
            suggestions.push({
                type: 'smoothing',
                title: 'Smooth Jagged Lines',
                description: 'Make your outline smoother and more natural looking',
                confidence: Math.min(jaggedness * 100, 95),
                preview: this.smoothPath(points, 0.5),
                originalPoints: points
            });
        }

        // Check if path needs simplification
        const complexity = points.length / 100;
        if (complexity > 1) {
            suggestions.push({
                type: 'simplification',
                title: 'Reduce Complexity',
                description: 'Simplify outline while preserving shape',
                confidence: Math.min(complexity * 50, 90),
                preview: this.simplifyPath(points, 3),
                originalPoints: points
            });
        }

        // Check if path needs closure
        const first = points[0];
        const last = points[points.length - 1];
        const closureDistance = Math.sqrt(
            Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2)
        );

        if (closureDistance < 30 && closureDistance > 5) {
            suggestions.push({
                type: 'closure',
                title: 'Close Shape',
                description: 'Automatically close the outline shape',
                confidence: 100 - (closureDistance * 2),
                preview: this.autoClosePath(points, 50),
                originalPoints: points
            });
        }

        // Check if path needs alignment
        const alignmentScore = this.calculateAlignmentScore(points);
        if (alignmentScore < 0.7) {
            suggestions.push({
                type: 'alignment',
                title: 'Improve Alignment',
                description: 'Align to grid and snap to common angles',
                confidence: (1 - alignmentScore) * 80,
                preview: this.alignPath(points, 10),
                originalPoints: points
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
        const commonAngles = [0, 45, 90, 135, 180, 225, 270, 315];

        for (let i = 1; i < points.length; i++) {
            const dx = points[i].x - points[i - 1].x;
            const dy = points[i].y - points[i - 1].y;
            const angle = Math.atan2(dy, dx) * 180 / Math.PI;

            const isAligned = commonAngles.some(commonAngle =>
                Math.abs(angle - commonAngle) < 15 || Math.abs(angle - commonAngle + 360) < 15
            );

            if (isAligned) alignedSegments++;
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
    const [previewCanvas, setPreviewCanvas] = useState<HTMLCanvasElement | null>(null);

    const analyzePath = useCallback(async () => {
        if (!region || !region.points.length) return;

        setIsAnalyzing(true);

        // Simulate analysis delay for better UX
        await new Promise(resolve => setTimeout(resolve, 800));

        const pathSuggestions = OutlineOptimizer.analyzePath(region.points);
        setSuggestions(pathSuggestions);

        if (pathSuggestions.length > 0) {
            toast({
                title: "🤖 AI Analysis Complete!",
                description: `Found ${pathSuggestions.length} optimization opportunities`,
            });
        } else {
            toast({
                title: "✨ Perfect Outline!",
                description: "Your outline looks great already - no optimizations needed!",
            });
        }

        setIsAnalyzing(false);
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

    const applyOptimizations = useCallback(() => {
        if (!region || selectedSuggestions.size === 0) return;

        let optimizedPoints = [...region.points];

        // Apply selected optimizations in order of priority
        const sortedIndices = Array.from(selectedSuggestions).sort();

        for (const index of sortedIndices) {
            const suggestion = suggestions[index];
            optimizedPoints = suggestion.preview;
        }

        const optimizedRegion: Region = {
            ...region,
            points: optimizedPoints
        };

        onOptimizationApplied(optimizedRegion);

        toast({
            title: "🎯 Optimizations Applied!",
            description: `Applied ${selectedSuggestions.size} optimization(s) to your outline`,
        });

        onClose();
    }, [region, selectedSuggestions, suggestions, onOptimizationApplied, onClose]);

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
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
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
                                <p className="text-xs text-blue-400">AI is examining shape, smoothness, and alignment</p>
                            </div>
                        </div>
                    )}

                    {/* Suggestions */}
                    {!isAnalyzing && suggestions.length > 0 && (
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-green-400" />
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
                                                    {Math.round(suggestion.confidence)}% confident
                                                </Badge>
                                            </div>
                                            <p className="text-xs text-zinc-400">{suggestion.description}</p>

                                            {/* Before/After Stats */}
                                            <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                                                <span>Before: {suggestion.originalPoints.length} points</span>
                                                <span>After: {suggestion.preview.length} points</span>
                                            </div>
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
                    {!isAnalyzing && suggestions.length === 0 && (
                        <div className="text-center p-6 bg-green-900/20 border border-green-700/50 rounded-lg">
                            <CheckCircle className="h-8 w-8 text-green-400 mx-auto mb-2" />
                            <h3 className="text-sm font-semibold text-green-300 mb-1">Outline looks great!</h3>
                            <p className="text-xs text-green-400">No optimizations needed - your outline is already well-drawn</p>
                        </div>
                    )}

                    {/* Action Buttons */}
                    {suggestions.length > 0 && (
                        <div className="flex gap-3 pt-2">
                            <Button
                                onClick={applyOptimizations}
                                disabled={selectedSuggestions.size === 0}
                                className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500"
                            >
                                <Sparkles className="h-4 w-4 mr-2" />
                                Apply {selectedSuggestions.size} Optimization{selectedSuggestions.size !== 1 ? 's' : ''}
                            </Button>

                            <Button
                                variant="outline"
                                onClick={() => setSelectedSuggestions(new Set(suggestions.map((_, i) => i)))}
                                className="border-zinc-600 text-white hover:bg-zinc-800"
                            >
                                Select All
                            </Button>
                        </div>
                    )}

                    {/* Tips */}
                    <div className="bg-zinc-800/50 p-3 rounded-lg">
                        <h4 className="text-sm font-semibold text-blue-400 mb-2">💡 Optimization Tips</h4>
                        <ul className="text-xs text-zinc-300 space-y-1">
                            <li>• <strong>Smoothing:</strong> Reduces jagged lines for natural curves</li>
                            <li>• <strong>Simplification:</strong> Removes excess points while preserving shape</li>
                            <li>• <strong>Closure:</strong> Automatically closes nearly-closed shapes</li>
                            <li>• <strong>Alignment:</strong> Snaps to grid and common angles</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AIOutlineOptimizer;