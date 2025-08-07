import React from 'react';
import { Button } from '@/components/ui/button';
import { Pen, Palette, MousePointer, Upload, Download, Eye, EyeOff, Square, Hexagon } from 'lucide-react';

interface ToolbarProps {
  currentTool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon';
  onToolChange: (tool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon') => void;
  onImageUpload: (file: File) => void;
  onExport: () => void;
  showOutlines: boolean;
  onToggleOutlines: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onToolChange,
  onImageUpload,
  onExport,
  showOutlines,
  onToggleOutlines
}) => {
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const tools = [
    { id: 'pen' as const, icon: Pen, label: 'Draw Outline' },
    { id: 'rectangle' as const, icon: Square, label: 'Rectangle' },
    { id: 'polygon' as const, icon: Hexagon, label: 'Polygon' },
    { id: 'fill' as const, icon: Palette, label: 'Fill Color' },
    { id: 'select' as const, icon: MousePointer, label: 'Select Region' }
  ];

  return (
    <div className="w-20 glass-panel rounded-xl p-3 flex flex-col gap-3">
      {/* Upload */}
      <div className="relative">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          id="image-upload"
        />
        <Button
          variant="ghost"
          size="icon"
          className="w-14 h-14 rounded-xl hover:bg-surface-elevated transition-all duration-200 hover:neon-glow"
          title="Upload Image"
        >
          <Upload className="h-6 w-6" />
        </Button>
      </div>

      <div className="h-px bg-border my-1" />

      {/* Drawing Tools */}
      {tools.map((tool) => (
        <Button
          key={tool.id}
          variant="ghost"
          size="icon"
          onClick={() => onToolChange(tool.id)}
          className={`w-14 h-14 rounded-xl transition-all duration-200 ${
            currentTool === tool.id 
              ? 'tool-active animate-pulse-neon' 
              : 'hover:bg-surface-elevated hover:border-border-hover'
          }`}
          title={tool.label}
        >
          <tool.icon className="h-6 w-6" />
        </Button>
      ))}

      <div className="h-px bg-border my-1" />

      {/* View Toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onToggleOutlines}
        className="w-14 h-14 rounded-xl hover:bg-surface-elevated transition-all duration-200"
        title={showOutlines ? 'Hide Outlines' : 'Show Outlines'}
      >
        {showOutlines ? <EyeOff className="h-6 w-6" /> : <Eye className="h-6 w-6" />}
      </Button>

      {/* Export */}
      <Button
        variant="ghost"
        size="icon"
        onClick={onExport}
        className="w-14 h-14 rounded-xl hover:bg-surface-elevated hover:border-border-hover transition-all duration-200"
        title="Export PNG"
      >
        <Download className="h-6 w-6" />
      </Button>
    </div>
  );
};

export default Toolbar;
