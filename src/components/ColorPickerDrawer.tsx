
import React from 'react';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { X, Palette, Sparkles } from 'lucide-react';

interface ColorPickerDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const ColorPickerDrawer: React.FC<ColorPickerDrawerProps> = ({
  isOpen,
  onClose,
  selectedColor,
  onColorSelect
}) => {
  const colorPalettes = {
    warm: ['#ff6b6b', '#ff8e53', '#ff6b35', '#f7931e', '#ffd23f', '#ff9ff3', '#f368e0'],
    cool: ['#4ecdc4', '#45b7d1', '#96ceb4', '#85c1e9', '#a8e6cf', '#88d8c0', '#7fcdcd'],
    nature: ['#6ab04c', '#badc58', '#f0932b', '#eb4d4b', '#f9ca24', '#f0932b', '#6c5ce7'],
    pastel: ['#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#fadbd8', '#d5f4e6'],
    vibrant: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'],
    monochrome: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7', '#ecf0f1', '#ffffff'],
  };

  const gradients = [
    'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
    'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
    'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
    'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
    'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
  ];

  return (
    <Drawer open={isOpen} onOpenChange={onClose}>
      <DrawerContent className="glass-panel min-h-[90vh] max-h-[90vh]">
        <DrawerHeader className="border-b border-border">
          <div className="flex items-center justify-between">
            <DrawerTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5" />
              Color Palette
            </DrawerTitle>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon">
                <X className="h-4 w-4" />
              </Button>
            </DrawerClose>
          </div>
        </DrawerHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Selection */}
          <div className="text-center">
            <div 
              className="w-20 h-20 rounded-2xl border-4 border-primary mx-auto mb-3 neon-glow"
              style={{ backgroundColor: selectedColor }}
            />
            <p className="text-sm font-medium">Selected: {selectedColor}</p>
          </div>

          {/* Custom Color Picker */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Custom Color
            </h3>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => onColorSelect(e.target.value)}
              className="w-full h-16 rounded-xl border border-border bg-surface cursor-pointer"
            />
          </div>

          {/* Color Palettes */}
          {Object.entries(colorPalettes).map(([paletteName, colors]) => (
            <div key={paletteName} className="space-y-3">
              <h3 className="text-lg font-semibold capitalize">{paletteName} Colors</h3>
              <div className="grid grid-cols-7 gap-3">
                {colors.map((color, index) => (
                  <button
                    key={`${paletteName}-${index}`}
                    onClick={() => onColorSelect(color)}
                    className={`aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-110 ${
                      selectedColor === color 
                        ? 'border-primary neon-glow scale-105' 
                        : 'border-border hover:border-border-hover'
                    }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Gradient Colors */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold">Gradient Inspiration</h3>
            <div className="grid grid-cols-2 gap-3">
              {gradients.map((gradient, index) => (
                <div
                  key={index}
                  className="h-16 rounded-xl border border-border cursor-pointer hover:scale-105 transition-transform"
                  style={{ background: gradient }}
                  onClick={() => {
                    // Extract a representative color from gradient
                    const colors = ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a', '#a8edea'];
                    onColorSelect(colors[index]);
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
};

export default ColorPickerDrawer;
