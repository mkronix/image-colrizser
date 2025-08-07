
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import React from 'react';

interface OutlineColorDialogProps {
  isOpen: boolean;
  onClose: () => void;
  selectedColor: string;
  onColorSelect: (color: string) => void;
}

const OutlineColorDialog: React.FC<OutlineColorDialogProps> = ({
  isOpen,
  onClose,
  selectedColor,
  onColorSelect
}) => {
  if (!isOpen) return null;

  const outlineColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#f43f5e', '#8b5cf6', '#059669', '#dc2626',
    '#7c3aed', '#0ea5e9', '#ea580c', '#be185d', '#7c2d12'
  ];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-zinc-900 border border-zinc-700 rounded-2xl w-full max-w-md">
        <div className="border-b border-zinc-700 p-4 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Choose Outline Color</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="text-zinc-400 hover:text-white">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="p-4 space-y-4">
          {/* Custom Color Input */}
          <div>
            <label htmlFor='customColor' className="text-sm font-medium mb-2 block text-white">Custom Color</label>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => onColorSelect(e.target.value)}
              className="w-full h-12 rounded-lg border border-zinc-600 bg-zinc-800 cursor-pointer"
            />
          </div>

          {/* Predefined Colors */}
          <div>
            <label htmlFor='presetColors' className="text-sm font-medium mb-2 block text-white">Preset Colors</label>
            <div className="grid grid-cols-5 gap-2">
              {outlineColors.map((color) => (
                <button
                  key={color}
                  onClick={() => onColorSelect(color)}
                  className={`w-10 h-10 rounded-lg border-2 transition-all duration-200 hover:scale-110 ${selectedColor === color
                    ? 'border-white scale-105 shadow-lg'
                    : 'border-zinc-600 hover:border-zinc-500'
                    }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} className="border-zinc-600 text-white hover:bg-zinc-800">
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OutlineColorDialog;
