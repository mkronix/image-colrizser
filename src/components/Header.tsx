const Header = () => {
  return (
    <header className="bg-zinc-900 border-b border-zinc-700 p-4 w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-zinc-600 to-zinc-800 flex items-center justify-center">
            <span className="text-lg sm:text-xl font-bold text-white">🎨</span>
          </div>
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-white">ColorStudio Pro</h1>
            <p className="text-xs sm:text-sm text-zinc-400">Advanced Image Colorization Tool</p>
          </div>
        </div>

        <div className="hidden sm:flex items-center gap-2 text-sm text-zinc-400">
          <span>•</span>
          <span>Upload → Outline → Colorize → Export</span>
        </div>
      </div>
    </header>
  );
};

export default Header;