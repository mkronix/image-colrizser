import React, { useRef, useEffect, useState, useCallback } from 'react';

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

interface ImageCanvasProps {
  image: HTMLImageElement | null;
  currentTool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon';
  selectedColor: string;
  selectedOutlineColor: string;
  onRegionCreated: (region: Region) => void;
  onRegionSelected: (region: Region | null) => void;
  regions: Region[];
  showOutlines: boolean;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  image,
  currentTool,
  selectedColor,
  selectedOutlineColor,
  onRegionCreated,
  onRegionSelected,
  regions,
  showOutlines = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });
  const [polygonPoints, setPolygonPoints] = useState<Point[]>([]);

  // Mobile-specific states
  const [isMobile, setIsMobile] = useState(false);
  const [lastTouchTime, setLastTouchTime] = useState(0);
  const [lastClickTime, setLastClickTime] = useState(0);
  const [lastClickPos, setLastClickPos] = useState<Point | null>(null);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768 || 'ontouchstart' in window);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (image) {
      const { width, height } = image;
      const canvasRatio = canvas.width / canvas.height;
      const imageRatio = width / height;

      let drawWidth, drawHeight, offsetX, offsetY;

      if (imageRatio > canvasRatio) {
        drawWidth = canvas.width;
        drawHeight = canvas.width / imageRatio;
        offsetX = 0;
        offsetY = (canvas.height - drawHeight) / 2;
      } else {
        drawHeight = canvas.height;
        drawWidth = canvas.height * imageRatio;
        offsetX = (canvas.width - drawWidth) / 2;
        offsetY = 0;
      }

      ctx.drawImage(image, offsetX, offsetY, drawWidth, drawHeight);
    }

    // Draw filled regions
    regions.forEach(region => {
      if (region.filled && region.points.length > 0 && region.color) {
        ctx.save();

        ctx.beginPath();
        if (region.type === 'rectangle' && region.points.length >= 2) {
          const [start, end] = region.points;
          ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
        } else {
          ctx.moveTo(region.points[0].x, region.points[0].y);
          region.points.slice(1).forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.closePath();
        }

        ctx.clip();

        const color = region.color;
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.restore();
      }
    });

    // Draw outlines
    if (showOutlines) {
      regions.forEach(region => {
        if (region.points.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = region.outlineColor || '#60a5fa';
          ctx.lineWidth = isMobile ? 3 : 2; // Thicker lines on mobile

          if (region.type === 'rectangle' && region.points.length >= 2) {
            const [start, end] = region.points;
            ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
          } else {
            ctx.moveTo(region.points[0].x, region.points[0].y);
            region.points.slice(1).forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
            if (region.type === 'polygon') {
              ctx.closePath();
            }
          }
          ctx.stroke();
        }
      });

      // Draw current path
      if (currentTool === 'pen' && currentPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = selectedOutlineColor || '#a855f7';
        ctx.lineWidth = isMobile ? 4 : 3; // Thicker on mobile
        ctx.stroke();
      } else if (currentTool === 'rectangle' && startPoint && currentPath.length > 0) {
        const endPoint = currentPath[currentPath.length - 1];
        ctx.beginPath();
        ctx.rect(startPoint.x, startPoint.y, endPoint.x - startPoint.x, endPoint.y - startPoint.y);
        ctx.strokeStyle = selectedOutlineColor || '#a855f7';
        ctx.lineWidth = isMobile ? 4 : 3;
        ctx.stroke();
      } else if (currentTool === 'polygon' && polygonPoints.length > 0) {
        ctx.beginPath();
        ctx.moveTo(polygonPoints[0].x, polygonPoints[0].y);
        polygonPoints.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        if (currentPath.length > 0) {
          ctx.lineTo(currentPath[currentPath.length - 1].x, currentPath[currentPath.length - 1].y);
        }
        ctx.strokeStyle = selectedOutlineColor || '#a855f7';
        ctx.lineWidth = isMobile ? 4 : 3;
        ctx.stroke();
      }
    }
  }, [image, regions, currentPath, showOutlines, currentTool, startPoint, selectedOutlineColor, polygonPoints, isMobile]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  // Unified position getting function for mouse and touch
  const getEventPos = useCallback((e: MouseEvent | TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();

    if ('touches' in e && e.touches.length > 0) {
      // Touch event
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top
      };
    } else if ('changedTouches' in e && e.changedTouches.length > 0) {
      // Touch end event
      return {
        x: e.changedTouches[0].clientX - rect.left,
        y: e.changedTouches[0].clientY - rect.top
      };
    } else {
      // Mouse event
      const mouseEvent = e as MouseEvent;
      return {
        x: mouseEvent.clientX - rect.left,
        y: mouseEvent.clientY - rect.top
      };
    }
  }, []);

  const isPointInRegion = useCallback((point: Point, region: Region): boolean => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || region.points.length < 2) return false;

    ctx.beginPath();
    if (region.type === 'rectangle' && region.points.length >= 2) {
      const [start, end] = region.points;
      ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else {
      ctx.moveTo(region.points[0].x, region.points[0].y);
      region.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.closePath();
    }

    return ctx.isPointInPath(point.x, point.y);
  }, []);

  // Check if two points are close enough for double-click detection
  const isNearPoint = useCallback((p1: Point, p2: Point, threshold = 20): boolean => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy) < threshold;
  }, []);

  // Unified start function with improved double-click detection
  const handleStart = useCallback((e: MouseEvent | TouchEvent) => {
    e.preventDefault();
    const pos = getEventPos(e);
    const now = Date.now();

    // Double-click detection for polygon completion
    if (currentTool === 'polygon') {
      const timeDiff = now - lastClickTime;
      const isDoubleClick = timeDiff < 500 && lastClickPos && isNearPoint(pos, lastClickPos, 30);
      
      if (isDoubleClick && isDrawing && polygonPoints.length > 2) {
        // Complete the polygon
        const newRegion: Region = {
          id: `region-${Date.now()}`,
          points: [...polygonPoints],
          outlineColor: selectedOutlineColor,
          filled: false,
          type: 'polygon'
        };
        onRegionCreated(newRegion);
        setIsDrawing(false);
        setPolygonPoints([]);
        setCurrentPath([]);
        setLastClickTime(0);
        setLastClickPos(null);
        return;
      }
      
      setLastClickTime(now);
      setLastClickPos(pos);
    }

    if (currentTool === 'pen') {
      setIsDrawing(true);
      setCurrentPath([pos]);
    } else if (currentTool === 'rectangle') {
      setIsDrawing(true);
      setStartPoint(pos);
      setCurrentPath([pos]);
    } else if (currentTool === 'polygon') {
      if (!isDrawing) {
        setIsDrawing(true);
        setPolygonPoints([pos]);
        setCurrentPath([pos]);
      } else {
        setPolygonPoints(prev => [...prev, pos]);
        setCurrentPath([pos]);
      }
    } else if (currentTool === 'fill' || currentTool === 'select') {
      const clickedRegion = regions.find(region => isPointInRegion(pos, region));

      if (clickedRegion) {
        if (currentTool === 'fill') {
          const updatedRegion = { ...clickedRegion, color: selectedColor, filled: true };
          onRegionCreated(updatedRegion);
        } else {
          onRegionSelected(clickedRegion);
        }
      }
    }
  }, [currentTool, getEventPos, selectedColor, selectedOutlineColor, onRegionCreated, onRegionSelected, regions, isPointInRegion, lastClickTime, lastClickPos, isNearPoint, isDrawing, polygonPoints]);

  // Unified move function
  const handleMove = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    const pos = getEventPos(e);

    if (currentTool === 'pen') {
      setCurrentPath(prev => [...prev, pos]);
    } else if (currentTool === 'rectangle') {
      setCurrentPath([pos]);
    } else if (currentTool === 'polygon') {
      setCurrentPath([pos]);
    }
  }, [isDrawing, currentTool, getEventPos]);

  // Unified end function
  const handleEnd = useCallback((e: MouseEvent | TouchEvent) => {
    if (!isDrawing) return;
    e.preventDefault();

    if (currentTool === 'pen' && currentPath.length > 2) {
      const newRegion: Region = {
        id: `region-${Date.now()}`,
        points: currentPath,
        outlineColor: selectedOutlineColor,
        filled: false,
        type: 'freehand'
      };
      onRegionCreated(newRegion);
    } else if (currentTool === 'rectangle' && startPoint && currentPath.length > 0) {
      const endPoint = currentPath[currentPath.length - 1];
      const newRegion: Region = {
        id: `region-${Date.now()}`,
        points: [startPoint, endPoint],
        outlineColor: selectedOutlineColor,
        filled: false,
        type: 'rectangle'
      };
      onRegionCreated(newRegion);
    }

    if (currentTool !== 'polygon') {
      setIsDrawing(false);
      setCurrentPath([]);
      setStartPoint(null);
    }
  }, [isDrawing, currentTool, currentPath, startPoint, selectedOutlineColor, onRegionCreated]);

  // Mouse event handlers
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMobile) return; // Ignore mouse events on mobile
    handleStart(e.nativeEvent);
  }, [handleStart, isMobile]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMobile) return;
    handleMove(e.nativeEvent);
  }, [handleMove, isMobile]);

  const handleMouseUp = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isMobile) return;
    handleEnd(e.nativeEvent);
  }, [handleEnd, isMobile]);

  // Touch event handlers
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    handleStart(e.nativeEvent);
  }, [handleStart]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    handleMove(e.nativeEvent);
  }, [handleMove]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    handleEnd(e.nativeEvent);
  }, [handleEnd]);

  // Reset polygon state when tool changes
  useEffect(() => {
    if (currentTool !== 'polygon') {
      setIsDrawing(false);
      setPolygonPoints([]);
      setCurrentPath([]);
      setLastClickTime(0);
      setLastClickPos(null);
    }
  }, [currentTool]);

  if (!image) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center bg-zinc-900 border border-zinc-700 rounded-2xl p-6 sm:p-8 max-w-md animate-fade-in">
          <div className="text-4xl sm:text-6xl mb-4">🎨</div>
          <h2 className="text-xl sm:text-2xl font-bold mb-2 text-white">Welcome to ColorStudio Pro</h2>
          <p className="text-zinc-400 mb-4 text-sm sm:text-base">
            Upload an image to start creating beautiful colorized artwork
          </p>
          <div className="text-sm text-zinc-400 space-y-2">
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-zinc-500 rounded-full"></span>
              <span>Upload your image</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-zinc-400 rounded-full"></span>
              <span>Outline different regions</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-zinc-300 rounded-full"></span>
              <span>Fill with colors</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-zinc-200 rounded-full"></span>
              <span>Export your masterpiece</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full flex justify-center items-center">
      <canvas
        ref={canvasRef}
        width={canvasSize.width}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className="border border-zinc-700 rounded-lg cursor-crosshair bg-zinc-800 touch-none"
        style={{
          maxWidth: '100%',
          height: 'auto',
          touchAction: 'none' // Prevent default touch behaviors
        }}
      />
      {currentTool === 'polygon' && isDrawing && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 bg-zinc-900/90 px-3 py-1 rounded-lg text-sm border border-zinc-700 text-white">
          Double-click to finish polygon ({polygonPoints.length} points)
        </div>
      )}
    </div>
  );
};

export default ImageCanvas;
