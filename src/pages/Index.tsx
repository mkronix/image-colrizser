import React, { useState, useCallback, useRef, useEffect } from 'react';
import Header from '@/components/Header';
import Toolbar from '@/components/Toolbar';
import ImageCanvas from '@/components/ImageCanvas';
import ColorPicker from '@/components/ColorPicker';
import RegionPanel from '@/components/RegionPanel';
import { useHistory } from '@/hooks/useHistory';
import { toast } from 'sonner';

interface Region {
  id: string;
  points: { x: number; y: number }[];
  color?: string;
  texture?: string;
  filled: boolean;
  type: 'freehand' | 'rectangle' | 'polygon';
}

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [currentTool, setCurrentTool] = useState<'pen' | 'fill' | 'select' | 'rectangle' | 'polygon'>('pen');
  const [selectedColor, setSelectedColor] = useState('#ff6b6b');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showOutlines, setShowOutlines] = useState(true);

  // Use history hook for undo/redo functionality
  const {
    state: regions,
    canUndo,
    canRedo,
    undo,
    redo,
    pushToHistory,
    reset
  } = useHistory<Region[]>([], 12);

  // Add keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (canUndo) {
            undo();
            toast.success('Undone');
          }
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          if (canRedo) {
            redo();
            toast.success('Redone');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const handleImageUpload = useCallback((file: File) => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      reset([]); // Clear existing regions and history
      setSelectedRegion(null);
      toast.success('Image uploaded successfully!');
    };
    img.src = URL.createObjectURL(file);
  }, [reset]);

  const handleRegionCreated = useCallback((region: Region) => {
    const existingIndex = regions.findIndex(r => r.id === region.id);
    let newRegions: Region[];
    
    if (existingIndex >= 0) {
      // Update existing region
      newRegions = [...regions];
      newRegions[existingIndex] = region;
    } else {
      // Add new region
      newRegions = [...regions, region];
    }
    
    pushToHistory(newRegions);

    if (!region.filled) {
      toast.success('Region outlined! Use fill tool to colorize.');
    }
  }, [regions, pushToHistory]);

  const handleRegionSelected = useCallback((region: Region | null) => {
    setSelectedRegion(region);
    if (region) {
      toast.info(`Selected Region ${regions.findIndex(r => r.id === region.id) + 1}`);
    }
  }, [regions]);

  const handleRegionDelete = useCallback((regionId: string) => {
    const newRegions = regions.filter(r => r.id !== regionId);
    pushToHistory(newRegions);
    setSelectedRegion(prev => prev?.id === regionId ? null : prev);
    toast.success('Region deleted');
  }, [regions, pushToHistory]);

  const handleColorChange = useCallback((regionId: string, color: string) => {
    const newRegions = regions.map(region =>
      region.id === regionId
        ? { ...region, color, filled: true }
        : region
    );
    pushToHistory(newRegions);
  }, [regions, pushToHistory]);

  const handleExport = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !image) {
      toast.error('No image to export');
      return;
    }

    canvas.width = image.width;
    canvas.height = image.height;

    // Draw original image
    ctx.drawImage(image, 0, 0);

    // Draw filled regions with improved blending (without outlines)
    regions.forEach(region => {
      if (region.filled && region.points.length > 0 && region.color) {
        ctx.save();
        
        // Create clipping path
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

        // Apply color with better blending
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

    // Export as PNG
    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `colorized-image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
        toast.success('Image exported successfully!');
      }
    }, 'image/png');
  }, [image, regions]);

  return (
    <div className="h-screen p-2">
      <div className="">
        <Header />

        <div className="flex gap-6 h-[calc(100vh-8rem)]">
          {/* Left Toolbar */}
          <Toolbar
            currentTool={currentTool}
            onToolChange={setCurrentTool}
            onImageUpload={handleImageUpload}
            onExport={handleExport}
            showOutlines={showOutlines}
            onToggleOutlines={() => setShowOutlines(!showOutlines)}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={undo}
            onRedo={redo}
          />

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col relative">
            <ImageCanvas
              image={image}
              currentTool={currentTool}
              selectedColor={selectedColor}
              onRegionCreated={handleRegionCreated}
              onRegionSelected={handleRegionSelected}
              regions={regions}
              showOutlines={showOutlines}
            />

            {/* Floating Color Picker */}
            {currentTool === 'fill' && (
              <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10">
                <ColorPicker
                  selectedColor={selectedColor}
                  onColorChange={setSelectedColor}
                  isOpen={showColorPicker}
                  onToggle={() => setShowColorPicker(!showColorPicker)}
                />
              </div>
            )}
          </div>

          {/* Right Panel */}
          <RegionPanel
            regions={regions}
            selectedRegion={selectedRegion}
            onRegionSelect={handleRegionSelected}
            onRegionDelete={handleRegionDelete}
            onColorChange={handleColorChange}
          />
        </div>
      </div>
    </div>
  );
};

export default Index;
