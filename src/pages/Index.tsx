
import React, { useState, useCallback, useRef } from 'react';
import Header from '@/components/Header';
import Toolbar from '@/components/Toolbar';
import ImageCanvas from '@/components/ImageCanvas';
import ColorPicker from '@/components/ColorPicker';
import RegionPanel from '@/components/RegionPanel';
import { toast } from 'sonner';

interface Region {
  id: string;
  points: { x: number; y: number }[];
  color?: string;
  texture?: string;
  filled: boolean;
}

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [currentTool, setCurrentTool] = useState<'pen' | 'fill' | 'select'>('pen');
  const [selectedColor, setSelectedColor] = useState('#ff6b6b');
  const [regions, setRegions] = useState<Region[]>([]);
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showOutlines, setShowOutlines] = useState(true);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = useCallback((file: File) => {
    const img = new Image();
    img.onload = () => {
      setImage(img);
      setRegions([]); // Clear existing regions
      setSelectedRegion(null);
      toast.success('Image uploaded successfully!');
    };
    img.src = URL.createObjectURL(file);
  }, []);

  const handleRegionCreated = useCallback((region: Region) => {
    setRegions(prev => {
      // Update existing region or add new one
      const existingIndex = prev.findIndex(r => r.id === region.id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = region;
        return updated;
      }
      return [...prev, region];
    });
    
    if (!region.filled) {
      toast.success('Region outlined! Use fill tool to colorize.');
    }
  }, []);

  const handleRegionSelected = useCallback((region: Region | null) => {
    setSelectedRegion(region);
    if (region) {
      toast.info(`Selected Region ${regions.findIndex(r => r.id === region.id) + 1}`);
    }
  }, [regions]);

  const handleRegionDelete = useCallback((regionId: string) => {
    setRegions(prev => prev.filter(r => r.id !== regionId));
    setSelectedRegion(prev => prev?.id === regionId ? null : prev);
    toast.success('Region deleted');
  }, []);

  const handleColorChange = useCallback((regionId: string, color: string) => {
    setRegions(prev => prev.map(region => 
      region.id === regionId 
        ? { ...region, color, filled: true }
        : region
    ));
  }, []);

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

    // Draw filled regions without outlines
    regions.forEach(region => {
      if (region.filled && region.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(region.points[0].x, region.points[0].y);
        region.points.slice(1).forEach(point => {
          ctx.lineTo(point.x, point.y);
        });
        ctx.closePath();

        if (region.color) {
          ctx.fillStyle = region.color;
        }
        
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
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
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto">
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
          />

          {/* Main Canvas Area */}
          <div className="flex-1 flex flex-col">
            <ImageCanvas
              image={image}
              currentTool={currentTool}
              selectedColor={selectedColor}
              onRegionCreated={handleRegionCreated}
              onRegionSelected={handleRegionSelected}
              regions={regions}
              showOutlines={showOutlines}
            />

            {/* Bottom Color Picker */}
            {currentTool === 'fill' && (
              <div className="mt-4 flex justify-center">
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

        {/* Welcome Message */}
        {!image && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
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
        )}
      </div>
    </div>
  );
};

export default Index;
