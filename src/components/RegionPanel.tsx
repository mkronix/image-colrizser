
import React from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Palette, Pen, Square, Polygon } from 'lucide-react';

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
}

const RegionPanel: React.FC<RegionPanelProps> = ({
  regions,
  selectedRegion,
  onRegionSelect,
  onRegionDelete,
  onColorChange
}) => {
  const getRegionIcon = (type: Region['type']) => {
    switch (type) {
      case 'freehand':
        return Pen;
      case 'rectangle':
        return Square;
      case 'polygon':
        return Polygon;
      default:
        return Pen;
    }
  };

  const getRegionTypeName = (type: Region['type']) => {
    switch (type) {
      case 'freehand':
        return 'Freehand';
      case 'rectangle':
        return 'Rectangle';
      case 'polygon':
        return 'Polygon';
      default:
        return 'Region';
    }
  };

  if (regions.length === 0) {
    return (
      <div className="glass-panel rounded-xl p-4 w-64 text-center">
        <div className="text-muted-foreground">
          <Palette className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No regions outlined yet</p>
          <p className="text-xs mt-1">Use drawing tools to create regions</p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4 w-64 studio-scrollbar">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
        <Palette className="h-4 w-4" />
        Regions ({regions.length})
      </h3>
      
      <div className="space-y-2 max-h-96 overflow-y-auto studio-scrollbar">
        {regions.map((region, index) => {
          const IconComponent = getRegionIcon(region.type);
          return (
            <div
              key={region.id}
              className={`p-3 rounded-lg border transition-all duration-200 cursor-pointer ${
                selectedRegion?.id === region.id
                  ? 'border-primary bg-surface-elevated neon-glow'
                  : 'border-border hover:border-border-hover bg-surface'
              }`}
              onClick={() => onRegionSelect(region)}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <IconComponent className="w-4 h-4 text-muted-foreground" />
                  <div
                    className="w-6 h-6 rounded border border-border"
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
                      className="w-6 h-6 rounded border-0 cursor-pointer"
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
                    className="h-6 w-6 hover:bg-destructive hover:text-destructive-foreground"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              
              <div className="text-xs text-muted-foreground mt-1">
                {region.points.length} points • {region.filled ? 'Filled' : 'Outlined'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RegionPanel;
