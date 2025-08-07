
import ColorPickerDrawer from '@/components/ColorPickerDrawer';
import Header from '@/components/Header';
import ImageCanvas from '@/components/ImageCanvas';
import OutlineColorDialog from '@/components/OutlineColorDialog';
import RegionPanel from '@/components/RegionPanel';
import Toolbar from '@/components/Toolbar';
import { useHistory } from '@/hooks/useHistory';
import { useCallback, useEffect, useState } from 'react';

interface Region {
  id: string;
  points: { x: number; y: number }[];
  color?: string;
  outlineColor?: string;
  texture?: string;
  filled: boolean;
  type: 'freehand' | 'rectangle' | 'polygon';
}

const Index = () => {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [currentTool, setCurrentTool] = useState<'pen' | 'fill' | 'select' | 'rectangle' | 'polygon'>('pen');
  const [selectedColor, setSelectedColor] = useState('#ff6b6b');
  const [selectedOutlineColor, setSelectedOutlineColor] = useState('#3b82f6');
  const [selectedRegion, setSelectedRegion] = useState<Region | null>(null);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showOutlineDialog, setShowOutlineDialog] = useState(false);
  const [showOutlines, setShowOutlines] = useState(true);
  const [regionPanelOpen, setRegionPanelOpen] = useState(false);

  const {
    state: regions,
    canUndo,
    canRedo,
    undo,
    redo,
    pushToHistory,
    reset
  } = useHistory<Region[]>([], 12);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          if (canUndo) undo();
        } else if ((e.key === 'y') || (e.key === 'z' && e.shiftKey)) {
          e.preventDefault();
          if (canRedo) redo();
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
      reset([]);
      setSelectedRegion(null);
    };
    img.src = URL.createObjectURL(file);
  }, [reset]);

  const handleRegionCreated = useCallback((region: Region) => {
    const existingIndex = regions.findIndex(r => r.id === region.id);
    let newRegions: Region[];

    if (existingIndex >= 0) {
      newRegions = [...regions];
      newRegions[existingIndex] = region;
    } else {
      newRegions = [...regions, region];
    }

    pushToHistory(newRegions);
  }, [regions, pushToHistory]);

  const handleRegionSelected = useCallback((region: Region | null) => {
    setSelectedRegion(region);
  }, []);

  const handleRegionDelete = useCallback((regionId: string) => {
    const newRegions = regions.filter(r => r.id !== regionId);
    pushToHistory(newRegions);
    setSelectedRegion(prev => prev?.id === regionId ? null : prev);
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
    if (!ctx || !image) return;

    canvas.width = image.width;
    canvas.height = image.height;

    ctx.drawImage(image, 0, 0);

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

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `colorized-image-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    }, 'image/png');
  }, [image, regions]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="p-2 lg:p-4">
        {/* fixed header */}
        <div className={`${!image ? '' : 'max-lg:hidden'} fixed w-full top-0 left-0 z-40`}>
          <Header />
        </div>

        {/* a main container */}
        <div className="pt-[70px]">
          <ImageCanvas
            image={image}
            currentTool={currentTool}
            selectedColor={selectedColor}
            selectedOutlineColor={selectedOutlineColor}
            onRegionCreated={handleRegionCreated}
            onRegionSelected={handleRegionSelected}
            regions={regions}
            showOutlines={showOutlines}
          />

          {/* Right Panel - Hidden on mobile initially */}
          <div className="hidden lg:block">
            <RegionPanel
              regions={regions}
              selectedRegion={selectedRegion}
              onRegionSelect={handleRegionSelected}
              onRegionDelete={handleRegionDelete}
              onColorChange={handleColorChange}
              isOpen={regionPanelOpen}
              onToggle={() => setRegionPanelOpen(!regionPanelOpen)}
            />
          </div>

          {/* Mobile Region Panel */}
          <div className="lg:hidden">
            <RegionPanel
              regions={regions}
              selectedRegion={selectedRegion}
              onRegionSelect={handleRegionSelected}
              onRegionDelete={handleRegionDelete}
              onColorChange={handleColorChange}
              isOpen={regionPanelOpen}
              onToggle={() => setRegionPanelOpen(!regionPanelOpen)}
            />
          </div>
        </div>
      </div>

      {/* fixed Toolbar */}
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
        onOpenColorPicker={() => setShowColorPicker(true)}
        onOpenOutlineDialog={() => setShowOutlineDialog(true)}
      />

      {/* Modals */}
      <ColorPickerDrawer
        isOpen={showColorPicker}
        onClose={() => setShowColorPicker(false)}
        selectedColor={selectedColor}
        onColorSelect={setSelectedColor}
      />

      <OutlineColorDialog
        isOpen={showOutlineDialog}
        onClose={() => setShowOutlineDialog(false)}
        selectedColor={selectedOutlineColor}
        onColorSelect={setSelectedOutlineColor}
      />
    </div>
  );
};

export default Index;
