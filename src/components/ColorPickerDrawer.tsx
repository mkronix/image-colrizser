
import { Button } from '@/components/ui/button';
import { Palette, Sparkles, X } from 'lucide-react';
import React from 'react';

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
  if (!isOpen) return null;

  const colorPalettes = {
    warm: ['#ff6b6b', '#ff8e53', '#ff6b35', '#f7931e', '#ffd23f', '#ff9ff3', '#f368e0'],
    cool: ['#4ecdc4', '#45b7d1', '#96ceb4', '#85c1e9', '#a8e6cf', '#88d8c0', '#7fcdcd'],
    nature: ['#6ab04c', '#badc58', '#f0932b', '#eb4d4b', '#f9ca24', '#f0932b', '#6c5ce7'],
    pastel: ['#ffeaa7', '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#fadbd8', '#d5f4e6'],
    vibrant: ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#e67e22'],
    monochrome: ['#2c3e50', '#34495e', '#7f8c8d', '#95a5a6', '#bdc3c7', '#ecf0f1', '#ffffff'],
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-t-2xl sm:rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-zinc-900 border-b border-zinc-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Color Palette
          </h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-6">
          {/* Current Selection */}
          <div className="text-center">
            <div
              className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-2 border-zinc-600 mx-auto mb-3"
              style={{ backgroundColor: selectedColor }}
            />
            <p className="text-sm font-medium text-white">Selected: {selectedColor}</p>
          </div>

          {/* Custom Color Picker */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2 text-white">
              <Sparkles className="h-4 w-4" />
              Custom Color
            </h3>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => onColorSelect(e.target.value)}
              className="w-full h-12 sm:h-16 rounded-xl border border-zinc-600 bg-zinc-800 cursor-pointer"
            />
          </div>

          {/* Color Palettes */}
          {Object.entries(colorPalettes).map(([paletteName, colors]) => (
            <div key={paletteName} className="space-y-3">
              <h3 className="text-lg font-semibold capitalize text-white">{paletteName} Colors</h3>
              <div className="grid grid-cols-7 gap-2 sm:gap-3">
                {colors.map((color, index) => (
                  <button
                    key={`${paletteName}-${index}`}
                    onClick={() => onColorSelect(color)}
                    className={`aspect-square rounded-xl border-2 transition-all duration-200 hover:scale-110 ${selectedColor === color
                        ? 'border-white scale-105 shadow-lg'
                        : 'border-zinc-600 hover:border-zinc-500'
                      }`}
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ColorPickerDrawer;
