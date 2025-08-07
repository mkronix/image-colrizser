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
  type: 'freehand' | 'rectangle' | 'polygon';
}

interface ImageCanvasProps {
  image: HTMLImageElement | null;
  currentTool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon';
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
  const [startPoint, setStartPoint] = useState<Point | null>(null);
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

    // Draw filled regions with better blending
    regions.forEach(region => {
      if (region.filled && region.points.length > 0 && region.color) {
        console.log('Drawing filled region:', region.id, 'with color:', region.color);
        ctx.save();
        
        // Create clipping path for the region
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

        // Create a semi-transparent overlay for better blending
        const color = region.color;
        // Convert hex to rgba for blending
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        
        // Apply color with multiply blend mode for better integration
        ctx.globalCompositeOperation = 'multiply';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.7)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Add a subtle color overlay
        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.restore();
      }
    });

    // Draw outlines if enabled
    if (showOutlines) {
      regions.forEach(region => {
        if (region.points.length > 1) {
          ctx.beginPath();
          ctx.strokeStyle = '#60a5fa';
          ctx.lineWidth = 2;
          
          if (region.type === 'rectangle' && region.points.length >= 2) {
            const [start, end] = region.points;
            ctx.rect(start.x, start.y, end.x - start.x, end.y - start.y);
          } else {
            ctx.moveTo(region.points[0].x, region.points[0].y);
            region.points.slice(1).forEach(point => {
              ctx.lineTo(point.x, point.y);
            });
          }
          ctx.stroke();
        }
      });

      // Draw current path based on tool
      if (currentTool === 'pen' && currentPath.length > 1) {
        ctx.beginPath();
        ctx.moveTo(currentPath[0].x, currentPath[0].y);
        currentPath.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (currentTool === 'rectangle' && startPoint && currentPath.length > 0) {
        const endPoint = currentPath[currentPath.length - 1];
        ctx.beginPath();
        ctx.rect(startPoint.x, startPoint.y, endPoint.x - startPoint.x, endPoint.y - startPoint.y);
        ctx.strokeStyle = '#a855f7';
        ctx.lineWidth = 3;
        ctx.stroke();
      } else if (currentTool === 'polygon' && currentPath.length > 1) {
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
  }, [image, regions, currentPath, showOutlines, currentTool, startPoint]);

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
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const pos = getMousePos(e);
    console.log('Mouse down at:', pos, 'Current tool:', currentTool);

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
        setCurrentPath([pos]);
      } else {
        setCurrentPath(prev => [...prev, pos]);
      }
    } else if (currentTool === 'fill' || currentTool === 'select') {
      // Find region at click point
      const clickedRegion = regions.find(region => isPointInRegion(pos, region));
      console.log('Clicked region:', clickedRegion, 'Available regions:', regions.length);

      if (clickedRegion) {
        if (currentTool === 'fill') {
          console.log('Filling region with color:', selectedColor);
          // Update region with current color
          const updatedRegion = { ...clickedRegion, color: selectedColor, filled: true };
          onRegionCreated(updatedRegion);
        } else {
          onRegionSelected(clickedRegion);
        }
      } else {
        console.log('No region found at click position');
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;

    const pos = getMousePos(e);

    if (currentTool === 'pen') {
      setCurrentPath(prev => [...prev, pos]);
    } else if (currentTool === 'rectangle') {
      setCurrentPath([pos]);
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      if (currentTool === 'pen' && currentPath.length > 2) {
        // Create new freehand region
        const newRegion: Region = {
          id: `region-${Date.now()}`,
          points: currentPath,
          filled: false,
          type: 'freehand'
        };
        onRegionCreated(newRegion);
      } else if (currentTool === 'rectangle' && startPoint && currentPath.length > 0) {
        // Create new rectangle region
        const endPoint = currentPath[currentPath.length - 1];
        const newRegion: Region = {
          id: `region-${Date.now()}`,
          points: [startPoint, endPoint],
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
    }
  };

  const handleDoubleClick = () => {
    if (currentTool === 'polygon' && isDrawing && currentPath.length > 2) {
      // Finish polygon
      const newRegion: Region = {
        id: `region-${Date.now()}`,
        points: currentPath,
        filled: false,
        type: 'polygon'
      };
      onRegionCreated(newRegion);
      setIsDrawing(false);
      setCurrentPath([]);
    }
  };

  if (!image) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center glass-panel rounded-2xl p-8 max-w-md animate-fade-in">
          <div className="text-6xl mb-4">🎨</div>
          <h2 className="text-2xl font-bold mb-2">Welcome to ColorStudio Pro</h2>
          <p className="text-muted-foreground mb-4">
            Upload an image to start creating beautiful colorized artwork
          </p>
          <div className="text-sm text-muted-foreground">
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              <span>Upload your image</span>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2 h-2 bg-accent-electric rounded-full"></span>
              <span>Outline different regions</span>
            </div>
            <div className="flex items-center justify-center gap-2 mb-2">
              <span className="w-2 h-2 bg-accent-neon rounded-full"></span>
              <span>Fill with colors</span>
            </div>
            <div className="flex items-center justify-center gap-2">
              <span className="w-2 h-2 bg-muted rounded-full"></span>
              <span>Export your masterpiece</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

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
          onDoubleClick={handleDoubleClick}
          className="border border-border rounded-lg cursor-crosshair bg-surface shadow-2xl"
          style={{ maxWidth: '100%', height: 'auto' }}
        />
      </div>
    </div>
  );
};

export default ImageCanvas;
