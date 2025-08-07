import ColorPickerDrawer from '@/components/ColorPickerDrawer';
import Header from '@/components/Header';
import ImageCanvas from '@/components/ImageCanvas';
import OutlineColorDialog from '@/components/OutlineColorDialog';
import RegionPanel from '@/components/RegionPanel';
import Toolbar from '@/components/Toolbar';
import { useHistory } from '@/hooks/useHistory';
import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Bot, Sparkles, Zap } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import AIEdgeDetection from '@/components/AIEdgeDetection';
import AIOutlineOptimizer from '@/components/AIOutlineOptimizer';

// Import AI Components (these would be in separate files)
// import AIEdgeDetection from '@/components/AIEdgeDetection';
// import AIOutlineOptimizer from '@/components/AIOutlineOptimizer';

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

  // AI Feature States
  const [showAIEdgeDetection, setShowAIEdgeDetection] = useState(false);
  const [showAIOptimizer, setShowAIOptimizer] = useState(false);
  const [showOptimizationPrompt, setShowOptimizationPrompt] = useState(false);
  const [lastCreatedRegion, setLastCreatedRegion] = useState<Region | null>(null);

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

      // Show AI detection suggestion
      setTimeout(() => {
        toast({
          title: "🤖 AI Assistant Ready!",
          description: "Want me to automatically detect edges and regions in your image?",
          action: (
            <Button
              size="sm"
              onClick={() => setShowAIEdgeDetection(true)}
              className="bg-gradient-to-r from-green-600 to-blue-600"
            >
              <Bot className="h-3 w-3 mr-1" />
              Try AI Detection
            </Button>
          ),
        });
      }, 1000);
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
      setLastCreatedRegion(region);

      // Show AI optimization suggestion for manual drawings
      if (region.type === 'freehand' && region.points.length > 10) {
        setTimeout(() => {
          setShowOptimizationPrompt(true);
        }, 500);
      }
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

  // AI Edge Detection Handler
  const handleAIRegionsDetected = useCallback((detectedRegions: Region[]) => {
    const newRegions = [...regions, ...detectedRegions];
    pushToHistory(newRegions);
  }, [regions, pushToHistory]);

  // AI Optimization Handler
  const handleOptimizationApplied = useCallback((optimizedRegion: Region) => {
    const newRegions = regions.map(region =>
      region.id === optimizedRegion.id ? optimizedRegion : region
    );
    pushToHistory(newRegions);
    setLastCreatedRegion(null);
    setShowOptimizationPrompt(false);
  }, [regions, pushToHistory]);

  const handleExport = useCallback(() => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx || !image) return;

    canvas.width = image.width * 2; // 2x resolution for better quality
    canvas.height = image.height * 2;

    // Scale context for high resolution
    ctx.scale(2, 2);
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
        ctx.fillRect(0, 0, image.width, image.height);

        ctx.globalCompositeOperation = 'overlay';
        ctx.fillStyle = `rgba(${r}, ${g}, ${b}, 0.3)`;
        ctx.fillRect(0, 0, image.width, image.height);

        ctx.restore();
      }
    });

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `colorized-masterpiece-${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);

        toast({
          title: "🎨 Export Successful!",
          description: "Your colorized artwork has been downloaded in high resolution",
        });
      }
    }, 'image/png');
  }, [image, regions]);

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <div className="p-2 lg:p-4">
        {/* Fixed header */}
        <div className={`${!image ? '' : 'max-lg:hidden'} fixed w-full top-0 left-0 z-40`}>
          <Header />
        </div>

        {/* AI Quick Actions Bar - Only show when image is loaded */}
        {image && (
          <div className="fixed top-6 left-1/2  z-[100] flex justify-center">
            <div className="">
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAIEdgeDetection(true)}
                  className="border-green-600/50 text-green-400 hover:bg-green-600/10 hover:border-green-500"
                >
                  <Bot className="h-3 w-3 mr-1" />
                  AI Detect
                </Button>

                {selectedRegion && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowAIOptimizer(true)}
                    className="border-blue-600/50 text-blue-400 hover:bg-blue-600/10 hover:border-blue-500"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    AI Optimize
                  </Button>
                )}

              </div>
            </div>
          </div>
        )}

        {/* Main container */}
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

      {/* Fixed Toolbar */}
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

      {/* AI Optimization Prompt Toast */}
      {showOptimizationPrompt && lastCreatedRegion && (
        <div className="fixed bottom-24 left-4 right-4 lg:left-24 lg:right-80 z-50 flex justify-center">
          <div className="bg-gradient-to-r from-blue-900/95 to-purple-900/95 backdrop-blur-sm border border-blue-600/50 rounded-2xl p-4 shadow-2xl max-w-md">
            <div className="flex items-start gap-3">
              <Bot className="h-5 w-5 text-blue-400 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-white mb-1">AI Optimization Available</h3>
                <p className="text-xs text-blue-200 mb-3">I can improve your outline by smoothing lines and optimizing shape</p>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSelectedRegion(lastCreatedRegion);
                      setShowAIOptimizer(true);
                      setShowOptimizationPrompt(false);
                    }}
                    className="bg-blue-600 hover:bg-blue-500 text-white"
                  >
                    <Sparkles className="h-3 w-3 mr-1" />
                    Optimize
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setShowOptimizationPrompt(false)}
                    className="border-blue-600/50 text-blue-300"
                  >
                    Skip
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* AI Components - These would be imported from separate files */}

      <AIEdgeDetection
        image={image}
        onRegionsDetected={handleAIRegionsDetected}
        isOpen={showAIEdgeDetection}
        onClose={() => setShowAIEdgeDetection(false)}
      />

      <AIOutlineOptimizer
        region={selectedRegion}
        isOpen={showAIOptimizer}
        onClose={() => setShowAIOptimizer(false)}
        onOptimizationApplied={handleOptimizationApplied}
      />

    </div>
  );
};

export default Index;