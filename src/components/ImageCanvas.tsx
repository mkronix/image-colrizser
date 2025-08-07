
import React, { useRef, useEffect, useState, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface Region {
  id: string;
  points: Point[];
  color?: string;
  texture?: string;
  filled: boolean;
}

interface ImageCanvasProps {
  image: HTMLImageElement | null;
  currentTool: 'pen' | 'fill' | 'select';
  selectedColor: string;
  onRegionCreated: (region: Region) => void;
  onRegionSelected: (region: Region | null) => void;
  regions: Region[];
  showOutlines: boolean;
}

const ImageCanvas: React.FC<ImageCanvasProps> = ({
  image,
  currentTool,
  selectedColor,
  onRegionCreated,
  onRegionSelected,
  regions,
  showOutlines = true
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]);
  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  const drawImage = useCallback(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw image if available
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
      if (region.filled && region.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(region.points[0].x, region.points[0].y);
        region.points.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();

        // Set fill style
        if (region.color) {
          ctx.fillStyle = region.color;
        }
        
        // Use source-atop to only fill where image exists
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    });

    // Draw outlines if enabled
    if (showOutlines) {
      regions.forEach(region => {
        if (region.points.length > 1) {
          ctx.beginPath();
          ctx.moveTo(region.points[0].x, region.points[0].y);
          region.points.slice(1).forEach(point => {
            ctx.lineTo(point.x, point.y);
          });
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });

      // Draw current path
      if (currentPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.stroke();
      }
    }
  }, [image, regions, currentPath, showOutlines]);

  useEffect(() => {
    drawImage();
  }, [drawImage]);

  const getMousePos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  };

  const isPointInRegion = (point: Point, region: Region): boolean => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx || region.points.length < 3) return false;

    ctx.beginPath();
    ctx.moveTo(region.points[0].x, region.points[0].y);
    region.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
    ctx.closePath();
    
    return ctx.isPointInPath(point.x, point.y);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    
    if (currentTool === 'pen') {
      setIsDrawing(true);
      setCurrentPath([pos]);
    } else if (currentTool === 'fill' || currentTool === 'select') {
      // Find region at click point
      const clickedRegion = regions.find(region => isPointInRegion(pos, region));
      
      if (clickedRegion) {
        if (currentTool === 'fill') {
          // Update region with current color
          const updatedRegion = { ...clickedRegion, color: selectedColor, filled: true };
          onRegionCreated(updatedRegion);
        } else {
          onRegionSelected(clickedRegion);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || currentTool !== 'pen') return;
    
    const pos = getMousePos(e);
    setCurrentPath(prev => [...prev, pos]);
  };

  const handleMouseUp = () => {
    if (isDrawing && currentTool === 'pen' && currentPath.length > 2) {
      // Create new region
      const newRegion: Region = {
        id: `region-${Date.now()}`,
        points: currentPath,
        filled: false
      };
      onRegionCreated(newRegion);
    }
    
    setIsDrawing(false);
    setCurrentPath([]);
  };

  return (
    <div className="flex-1 flex items-center justify-center p-4">
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize.width}
          height={canvasSize.height}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          className="border border-border rounded-lg cursor-crosshair bg-surface shadow-2xl"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
};

export default ImageCanvas;
