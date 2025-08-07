
import React from 'react';

const Header: React.FC = () => {
  return (
    <header className="glass-panel rounded-xl p-4 mb-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent-neon flex items-center justify-center">
            <span className="text-xl font-bold text-primary-foreground">🎨</span>
          </div>
          <div>
            <h1 className="text-xl font-bold">ColorStudio Pro</h1>
            <p className="text-sm text-muted-foreground">Advanced Image Colorization Tool</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>•</span>
          <span>Upload → Outline → Colorize → Export</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
