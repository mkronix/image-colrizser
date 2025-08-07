
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X, Palette } from 'lucide-react';

interface ColorPickerProps {
  selectedColor: string;
  onColorChange: (color: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

const ColorPicker: React.FC<ColorPickerProps> = ({
  selectedColor,
  onColorChange,
  isOpen,
  onToggle
}) => {
  const predefinedColors = [
    '#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#ffeaa7',
    '#dda0dd', '#98d8c8', '#f7dc6f', '#bb8fce', '#85c1e9',
    '#f8c471', '#82e0aa', '#f1948a', '#85c1e9', '#d7bde2',
    '#a3e4db', '#f9e79f', '#fadbd8', '#d5f4e6', '#fdeaa7'
  ];

  if (!isOpen) {
    return (
      <Button
        variant="ghost"
        onClick={onToggle}
        className="w-14 h-14 rounded-xl hover:bg-surface-elevated transition-all duration-200 p-2"
        title="Color Picker"
      >
        <div 
          className="w-8 h-8 rounded-lg border-2 border-border"
          style={{ backgroundColor: selectedColor }}
        />
      </Button>
    );
  }

  return (
    <div className="glass-panel rounded-xl p-4 w-64 animate-slide-up">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <Palette className="h-4 w-4" />
          Choose Color
        </h3>
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggle}
          className="h-6 w-6 hover:bg-surface-elevated"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* Custom Color Input */}
      <div className="mb-4">
        <input
          type="color"
          value={selectedColor}
          onChange={(e) => onColorChange(e.target.value)}
          className="w-full h-12 rounded-lg border border-border bg-surface cursor-pointer"
        />
      </div>

      {/* Predefined Colors */}
      <div className="grid grid-cols-5 gap-2">
        {predefinedColors.map((color) => (
          <button
            key={color}
            onClick={() => onColorChange(color)}
            className={`w-10 h-10 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${
              selectedColor === color 
                ? 'border-primary neon-glow' 
                : 'border-border hover:border-border-hover'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
};

export default ColorPicker;
