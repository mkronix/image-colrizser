import { Button } from '@/components/ui/button';
import { Download, Eye, EyeOff, Hexagon, MousePointer, Palette, Pen, Redo2, Square, Undo2, Upload, Wrench } from 'lucide-react';
import React, { useState } from 'react';

interface ToolbarProps {
  currentTool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon';
  onToolChange: (tool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon') => void;
  onImageUpload: (file: File) => void;
  onExport: () => void;
  showOutlines: boolean;
  onToggleOutlines: () => void;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onOpenColorPicker: () => void;
  onOpenOutlineDialog: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({
  currentTool,
  onToolChange,
  onImageUpload,
  onExport,
  showOutlines,
  onToggleOutlines,
  canUndo,
  canRedo,
  onUndo,
  onRedo,
  onOpenColorPicker,
  onOpenOutlineDialog
}) => {
  const [showToolsSubmenu, setShowToolsSubmenu] = useState(false);
  const [showMobileSubmenu, setShowMobileSubmenu] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
    }
  };

  const handleToolChange = (tool: 'pen' | 'fill' | 'select' | 'rectangle' | 'polygon') => {
    // Validation for tools
    if (tool === 'fill') {
      onOpenColorPicker();
    } else if (['pen', 'rectangle', 'polygon'].includes(tool)) {
      onOpenOutlineDialog();
    }
    
    // Add validation feedback
    if (tool === 'pen') {
      console.log('Pen tool selected - ready for freehand drawing');
    } else if (tool === 'rectangle') {
      console.log('Rectangle tool selected - click and drag to create rectangles');
    } else if (tool === 'polygon') {
      console.log('Polygon tool selected - click points to create polygons');
    } else if (tool === 'fill') {
      console.log('Fill tool selected - click regions to add color');
    } else if (tool === 'select') {
      console.log('Select tool selected - click regions to select them');
    }
    
    onToolChange(tool);
    setShowToolsSubmenu(false);
    setShowMobileSubmenu(false);
  };

  const drawingTools = [
    { id: 'pen' as const, icon: Pen, label: 'Draw', description: 'Draw freehand lines' },
    { id: 'rectangle' as const, icon: Square, label: 'Rectangle', description: 'Draw rectangles' },
    { id: 'polygon' as const, icon: Hexagon, label: 'Polygon', description: 'Draw polygons' }
  ];

  const otherTools = [
    { id: 'fill' as const, icon: Palette, label: 'Fill', description: 'Fill regions with color' },
    { id: 'select' as const, icon: MousePointer, label: 'Select', description: 'Select regions' }
  ];

  const ToolButton = ({
    icon: Icon,
    label,
    description,
    onClick,
    isActive = false,
    disabled = false,
    className = ""
  }: {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    description: string;
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    className?: string;
  }) => (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      disabled={disabled}
      className={`
        group w-16 sm:w-full relative flex flex-col items-center gap-1 p-7 sm:p-2 h-14
        rounded-xl transition-all duration-300 ease-out border border-zinc-700
        ${isActive
          ? 'bg-zinc-800 border-zinc-500 text-white shadow-lg'
          : 'bg-zinc-900/50 hover:bg-zinc-800 hover:border-zinc-600 text-zinc-300 hover:text-white'
        }
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}
        ${className}
      `}
      title={description}
    >
      <Icon className={`
        h-4 w-4 sm:h-5 sm:w-5 transition-all duration-300
        ${disabled ? '' : 'group-hover:scale-110'}
      `} />
      <span className="text-xs font-medium transition-colors duration-300">
        {label}
      </span>
    </Button>
  );

  const isDrawingToolActive = drawingTools.some(tool => tool.id === currentTool);
  const activeDrawingTool = drawingTools.find(tool => tool.id === currentTool);

  return (
    <>
      {/* Desktop Layout - Vertical Left Sidebar */}
      <div className="hidden lg:flex fixed left-0 top-16 z-30 pt-3">

        <div className="bg-zinc-900 backdrop-blur-xl border-r border-zinc-700 p-3 shadow-2xl h-[calc(100vh-4rem)] scrollbar-hide w-20">

          <div className="flex flex-col gap-2">
            {/* File Operations */}
            <div className="flex flex-col gap-2">
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                  id="image-upload"
                />
                <ToolButton
                  icon={Upload}
                  label="Upload"
                  description="Upload an image to edit"
                  onClick={() => { }}
                />
              </div>

              <ToolButton
                icon={Download}
                label="Export"
                description="Download your artwork as PNG"
                onClick={onExport}
              />
            </div>

            {/* History Controls */}
            <div className="flex flex-col gap-2">
              <ToolButton
                icon={Undo2}
                label="Undo"
                description="Undo last action (Ctrl+Z)"
                onClick={onUndo}
                disabled={!canUndo}
              />

              <ToolButton
                icon={Redo2}
                label="Redo"
                description="Redo last action (Ctrl+Y)"
                onClick={onRedo}
                disabled={!canRedo}
              />
            </div>

            {/* Drawing Tools with Submenu */}
            <div className="flex flex-col gap-2 relative">
              <div
                className="relative"
                onMouseEnter={() => setShowToolsSubmenu(true)}
                onMouseLeave={() => setShowToolsSubmenu(false)}
              >
                <ToolButton
                  icon={activeDrawingTool?.icon || Wrench}
                  label="Tools"
                  description="Drawing tools (hover to see options)"
                  onClick={() => setShowToolsSubmenu(!showToolsSubmenu)}
                  isActive={isDrawingToolActive}
                />

                {/* Desktop Submenu - Left Side Panel */}
                {showToolsSubmenu && (
                  <div className="absolute left-full ml-1 top-0 z-[100]">
                    <div className="bg-zinc-800 backdrop-blur-xl border border-zinc-600 rounded-xl p-1 shadow-2xl min-w-max">
                      <div className="flex flex-col gap-1">
                        {drawingTools.map((tool) => (
                          <Button
                            key={tool.id}
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToolChange(tool.id)}
                            className={`
                              flex items-center gap-3 p-2 h-10 text-left justify-start
                              rounded-lg transition-all duration-200 border border-transparent
                              ${currentTool === tool.id
                                ? 'bg-zinc-700 border-zinc-500 text-white'
                                : 'text-zinc-300 hover:bg-zinc-700 hover:text-white'
                              }
                            `}
                            title={tool.description}
                          >
                            <tool.icon className="h-4 w-4 shrink-0" />
                            <span className="text-sm font-medium whitespace-nowrap">{tool.label}</span>
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Other Tools */}
              {otherTools.map((tool) => (
                <ToolButton
                  key={tool.id}
                  icon={tool.icon}
                  label={tool.label}
                  description={tool.description}
                  onClick={() => handleToolChange(tool.id)}
                  isActive={currentTool === tool.id}
                />
              ))}
            </div>

            {/* View Options */}
            <div className="flex flex-col gap-2">
              <ToolButton
                icon={showOutlines ? EyeOff : Eye}
                label={showOutlines ? 'Hide' : 'Show'}
                description={showOutlines ? 'Hide outlines' : 'Show outlines'}
                onClick={onToggleOutlines}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Mobile/Tablet Layout - Bottom Horizontal Scrollable Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50 p-2">
        <div className="bg-zinc-900/95 backdrop-blur-xl border border-zinc-700 rounded-2xl p-2 shadow-2xl max-w-full overflow-hidden">
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {/* File Operations */}
            <div className="relative">
              <input
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="absolute inset-0 z-10 w-full h-full opacity-0 cursor-pointer"
                id="image-upload-mobile"
              />
              <ToolButton
                icon={Upload}
                label="Upload"
                description="Upload image"
                onClick={() => { }}
              />
            </div>


            <ToolButton
              icon={activeDrawingTool?.icon || Wrench}
              label="Tools"
              description="Drawing tools"
              onClick={() => setShowMobileSubmenu(!showMobileSubmenu)}
              isActive={isDrawingToolActive}
            />

            {/* Other Tools */}
            {otherTools.map((tool) => (
              <ToolButton
                key={tool.id}
                icon={tool.icon}
                label={tool.label}
                description={tool.description}
                onClick={() => handleToolChange(tool.id)}
                isActive={currentTool === tool.id}
              />
            ))}

            <ToolButton
              icon={Download}
              label="Export"
              description="Export PNG"
              onClick={onExport}
            />

            {/* History */}
            <ToolButton
              icon={Undo2}
              label="Undo"
              description="Undo (Ctrl+Z)"
              onClick={onUndo}
              disabled={!canUndo}
            />

            <ToolButton
              icon={Redo2}
              label="Redo"
              description="Redo (Ctrl+Y)"
              onClick={onRedo}
              disabled={!canRedo}
            />


            {/* View Toggle */}
            <ToolButton
              icon={showOutlines ? EyeOff : Eye}
              label={showOutlines ? 'Hide' : 'Show'}
              description={showOutlines ? 'Hide outlines' : 'Show outlines'}
              onClick={onToggleOutlines}
            />
          </div>
        </div>

        {/* Mobile Submenu - Bottom to Up Panel */}
        {showMobileSubmenu && (
          <div className="absolute bottom-full left-2 right-2">
            <div className="bg-zinc-800/50 backdrop-blur-3xl  rounded-xl p-2">
              <div className="flex justify-center gap-2">
                {drawingTools.map((tool) => (
                  <Button
                    key={tool.id}
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToolChange(tool.id)}
                    className={`
                      flex flex-col items-center gap-1 p-7 sm:p-2 h-14 rounded-xl
                      transition-all duration-200 border border-zinc-700
                      ${currentTool === tool.id
                        ? 'bg-zinc-700 border-zinc-500 text-white shadow-lg'
                        : 'bg-zinc-900/50 hover:bg-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white'
                      }
                    `}
                    title={tool.description}
                  >
                    <tool.icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{tool.label}</span>
                  </Button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Mobile overlay to close submenu */}
        {showMobileSubmenu && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowMobileSubmenu(false)}
          />
        )}
      </div>

      {/* Custom scrollbar styles */}
      <style>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </>
  );
};

export default Toolbar;