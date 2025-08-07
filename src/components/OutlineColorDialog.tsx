
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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
  const outlineColors = [
    '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6',
    '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
    '#14b8a6', '#f43f5e', '#8b5cf6', '#059669', '#dc2626',
    '#7c3aed', '#0ea5e9', '#ea580c', '#be185d', '#7c2d12'
  ];

  const handleColorSelect = (color: string) => {
    onColorSelect(color);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="glass-panel max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Choose Outline Color
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {/* Custom Color Input */}
          <div>
            <label className="text-sm font-medium mb-2 block">Custom Color</label>
            <input
              type="color"
              value={selectedColor}
              onChange={(e) => handleColorSelect(e.target.value)}
              className="w-full h-12 rounded-lg border border-border bg-surface cursor-pointer"
            />
          </div>

          {/* Predefined Colors */}
          <div>
            <label className="text-sm font-medium mb-2 block">Preset Colors</label>
            <div className="grid grid-cols-5 gap-2">
              {outlineColors.map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
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

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OutlineColorDialog;
