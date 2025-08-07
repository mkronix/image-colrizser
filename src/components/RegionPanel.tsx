import { Button } from '@/components/ui/button';
import { Hexagon, Menu, Palette, Pen, Square, Trash2, X } from 'lucide-react';
import React from 'react';

interface Region {
  id: string;
  points: { x: number; y: number }[];
  color?: string;
  texture?: string;
  filled: boolean;
  type: 'freehand' | 'rectangle' | 'polygon';
}

interface RegionPanelProps {
  regions: Region[];
  selectedRegion: Region | null;
  onRegionSelect: (region: Region) => void;
  onRegionDelete: (regionId: string) => void;
  onColorChange: (regionId: string, color: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const RegionPanel: React.FC<RegionPanelProps> = ({
  regions,
  selectedRegion,
  onRegionSelect,
  onRegionDelete,
  onColorChange,
  isOpen,
  onToggle
}) => {
  const getRegionIcon = (type: Region['type']) => {
    switch (type) {
      case 'freehand': return Pen;
      case 'rectangle': return Square;
      case 'polygon': return Hexagon;
      default: return Pen;
    }
  };

  const getRegionTypeName = (type: Region['type']) => {
    switch (type) {
      case 'freehand': return 'Freehand';
      case 'rectangle': return 'Rectangle';
      case 'polygon': return 'Polygon';
      default: return 'Region';
    }
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <Button
        onClick={onToggle}
        className="lg:hidden fixed top-4 right-4 z-50 bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800"
        size="sm"
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Panel */}
      <div className={`
  fixed top-16 right-0 h-[calc(100vh-4rem)] w-80 lg:w-64
  bg-zinc-900 border-l border-zinc-700 p-4 pt-6
  transform transition-transform duration-300 z-30
  ${isOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0 '}
`}>
        {/* Mobile Close Button */}
        <Button
          onClick={onToggle}
          className="lg:hidden absolute top-4 right-4 bg-zinc-800 border border-zinc-600 text-white hover:bg-zinc-700"
          size="sm"
        >
          <X className="h-4 w-4" />
        </Button>

        <div className="mt-12 lg:mt-0">
          <h3 className="text-sm font-semibold mb-3 flex items-center gap-2 text-white">
            <Palette className="h-4 w-4" />
            Regions ({regions.length})
          </h3>

          {regions.length === 0 ? (
            <div className="text-center text-zinc-400">
              <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No regions outlined yet</p>
              <p className="text-xs mt-1">Use drawing tools to create regions</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {regions.map((region, index) => {
                const IconComponent = getRegionIcon(region.type);
                return (
                  <div
                    key={region.id}
                    className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${selectedRegion?.id === region.id
                      ? 'border-zinc-500 bg-zinc-800 text-white'
                      : 'border-zinc-700 hover:border-zinc-600 bg-zinc-800/50 text-zinc-300 hover:text-white'
                      }`}
                    onClick={() => onRegionSelect(region)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <IconComponent className="w-4 h-4" />
                        <div
                          className="w-6 h-6 rounded border border-zinc-600"
                          style={{
                            backgroundColor: region.color || '#374151',
                            opacity: region.filled ? 1 : 0.3
                          }}
                        />
                        <span className="text-sm font-medium">
                          {getRegionTypeName(region.type)} {index + 1}
                        </span>
                      </div>

                      <div className="flex items-center gap-1">
                        {region.filled && (
                          <input
                            type="color"
                            value={region.color || '#374151'}
                            onChange={(e) => onColorChange(region.id, e.target.value)}
                            className="w-6 h-6 rounded border-0 cursor-pointer bg-transparent"
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRegionDelete(region.id);
                          }}
                          className="h-6 w-6 hover:bg-red-900 hover:text-red-300 text-zinc-400"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    <div className="text-xs text-zinc-500 mt-1">
                      {region.points.length} points • {region.filled ? 'Filled' : 'Outlined'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={onToggle}
        />
      )}
    </>
  );
};

export default RegionPanel;
