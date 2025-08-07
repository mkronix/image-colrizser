# 🎨 Advanced Image Colorization Studio

> A professional-grade web application for precise image colorization with manual segmentation and advanced color blending techniques.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5+-3178C6?logo=typescript)
![Fabric.js](https://img.shields.io/badge/Fabric.js-6+-FF6B35?logo=javascript)

## 🌟 Overview

I want to create a tool where the topic is to colorize the image but its not that easy or something that is already in market. Here's what I want:

**User uploads images** - For example an image of a house

**Provide drawing tools** - Pencil or pen tool to draw over the image to outline different blocks/sections

**Smart segmentation** - As houses have many partitions like doors, grills, walls, pillars etc., users want to color differently on each block or partition

**Intelligent processing** - Once user outlines different portions, we process that outline block with image making it separate pixels

**Interactive coloring** - After processing, user can click on separate blocks they outlined and get options for adding color or texture

**Precise application** - When user selects any color/texture, it should reflect only in that specific block (fill the image pixels with color or texture)

**Clean export** - Once user is done editing, they can export it as PNG where the edited image shows original image with selected colors, but **outline strokes must not be visible**

---

## 🎨 Theme Overview: "Dark Pro Studio" Style

**🎯 Inspiration From:**
- Figma
- Photoshop  
- Spline
- Framer Canvas
- Midjourney Editor

---

## ✅ PRODUCT FLOW (UX/UI + Logic Breakdown)

### 1. **Image Upload**
- User uploads a house image (JPG, PNG, WEBP)
- Image is displayed in a fixed-size canvas
- Internally stored as pixel data

### 2. **Outlining Tool (Freehand / Shapes)**
**Provide tools:**
- 🖊 **Pen/Pencil** (freehand)
- 🔳 **Optional:** Polygon/rectangle (for precise blocks)
- Users draw outlines on different areas (e.g., door, wall)
- Each outline becomes a closed region

> **Behind the scenes:** Capture stroke points, simplify the path, store as vector data.

### 3. **Region Detection & Pixel Masking**
**After outlines are complete:**
- Convert each outline into a pixel mask (i.e., which pixels belong inside that region)
- This separates the image into logical segments
- Internally each region = `{id, path, mask, color, texture}`

### 4. **Region Selection & Color/Texture Fill**
- User can click any block (region) they outlined
- Show a modal or palette to select:
  - 🎨 **Color**
  - 🧵 **Texture** (from preloaded image patterns)
- Apply fill only inside the masked region

> **Texture fill:** Use `CanvasPattern` to fill area with repeating image texture  
> **Color fill:** Use `fillRect` or path drawing with `globalCompositeOperation = 'source-in'`

### 5. **Live Preview**
**Show final preview image as layers:**
- **Background:** Original image
- **Foreground:** Colorized regions (rendered to blend in)
- **Hidden:** User's drawn outlines (only for editing)

### 6. **Export Final Image (Without Outlines)**
**Merge the:**
- Original image
- Pixel-filled regions (color/texture)
- Remove all shape/outline overlays
- Export canvas as PNG

```js
canvas.toDataURL('image/png')
```

---

## 🧰 UI Components to Include

### 🔼 **Top Toolbar**
- App logo (left)
- File (New, Open)
- Edit (Undo, Redo, Clear Canvas)
- Export (PNG, JSON)
- Help (Shortcuts, Docs)

### 🔄 **Left Side Toolbar**
- Pen/Freehand Tool
- Rectangle, Circle, Polygon
- Select/Move Tool
- Fill Color / Texture Tool
- Undo / Redo
- Zoom Tool
- Delete Shape
- Tooltip appears on hover

### 🖼️ **Center Canvas Workspace**
- Render image + overlays
- Zoom in/out (mouse wheel or bottom panel)
- Drag canvas (holding space bar)
- Toggle: show/hide outlines
- Context menu (right click on region)

### 🎛️ **Right Side Panel (Optional)**
- Layers list (region 1, region 2…)
- Color/Texture preview of each
- Edit/fill/reset button per region

### 🎨 **Color / Texture Picker (Popup Modal)**
- Modern color picker (wheel, palette)
- Texture gallery
- Live preview on hover
- "Apply" button

### 🔽 **Bottom Panel**
- Zoom level indicator
- FPS / render performance (optional)
- Total regions
- Reset zoom / center canvas

---

## ✅ TECH STACK / LIBRARIES

### 🔧 **Frontend (ReactJS)**

| Purpose | Library / Tool |
|---------|----------------|
| UI + State | ReactJS |
| Drawing Tool | `react-konva` (freehand + shape support) |
| Region Smoothing | `simplify-js`, custom Bézier curve |
| Texture Fill | HTML5 Canvas API (`CanvasPattern`) |
| Image Display / Pixel Access | `canvas` element + `getImageData()` |
| Region Masking | Custom path + `isPointInPath()` logic |
| Color Picker | `react-color` or `react-colorful` |
| Export | `canvas.toDataURL()` or `html2canvas` fallback |

### 🧠 **Image Processing (Region Detection, Fill)**
- Use HTML Canvas APIs directly:
  - `ctx.getImageData()`
  - `ctx.putImageData()`
  - `ctx.createPattern()`
  - `ctx.globalCompositeOperation`
- Optional: Use `opencv.js` if you need contour detection later.

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn
- Modern web browser with Canvas support

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/your-username/advanced-image-colorization.git
cd advanced-image-colorization
```

2. **Install dependencies**
```bash
npm install
# or
yarn install
```

3. **Start development server**
```bash
npm run dev
# or  
yarn dev
```

4. **Open in browser**
```
http://localhost:3000
```

---

## 🎯 Core Features

### ✨ **Professional Drawing Tools**
- **Pencil Tool:** Free-hand drawing for organic shapes
- **Line Tool:** Straight lines with angle snapping
- **Pen Tool:** Bezier curves for smooth, precise outlines
- **Eraser:** Remove outline segments
- **Zoom:** Up to 300% magnification for detail work

### 🎨 **Advanced Color Application**  
- **Multiple Blend Modes:**
  - Multiply (preserves shadows/highlights)
  - Overlay (vibrant colors)
  - Soft Light (subtle application)
  - Color Burn (darker contrast)
- **Opacity Control:** 0-100% transparency
- **Texture Support:** Upload custom textures or patterns

### 🧠 **Intelligent Segmentation**
- **Auto-Close Detection:** Paths close within 10px tolerance
- **Edge Smoothing:** Anti-aliased boundaries  
- **Layer Management:** Proper stacking order
- **Real-time Preview:** Live visualization during drawing

### 📤 **Professional Export**
- **Clean Output:** Outlines hidden in final export
- **High Resolution:** 2x multiplier for crisp images
- **Multiple Formats:** PNG (lossless), JPG (compressed)
- **Batch Processing:** Apply templates to multiple images

---

## 🎯 Final Output Goals

**Exported PNG should:**
- ✅ Show original image
- ✅ Only colored/texture regions  
- ✅ No outline strokes
- ✅ Professional quality blending
- ✅ High resolution (2x multiplier)

---

## 📁 Project Structure

```
src/
├── components/
│   ├── Canvas/
│   │   ├── CanvasEditor.tsx        # Main canvas component
│   │   ├── DrawingTools.tsx        # Tool selection panel
│   │   └── SegmentationManager.tsx # Segment management
│   ├── UI/
│   │   ├── ColorPicker.tsx         # Color selection interface
│   │   ├── ImageUploader.tsx       # File upload component
│   │   └── Toolbar.tsx             # Main toolbar
│   └── Layout/
│       └── MainLayout.tsx          # Application layout
├── utils/
│   ├── imageProcessing.ts          # Core image algorithms
│   ├── segmentation.ts             # Path and mask utilities
│   ├── colorBlending.ts            # Blend mode implementations
│   └── exportUtils.ts              # Export functionality
├── hooks/
│   ├── useCanvas.ts                # Canvas state management
│   ├── useImageProcessing.ts       # Image processing hooks
│   └── useSegmentation.ts          # Segmentation logic
└── types/
    ├── canvas.types.ts             # Canvas-related types
    └── processing.types.ts         # Image processing types
```

---

## 🔧 Configuration

### Canvas Settings
```typescript
const canvasConfig = {
  width: 1000,
  height: 700,
  backgroundColor: "#1a1a1a",
  preserveObjectStacking: true,
  renderOnAddRemove: true
};
```

### Drawing Tools
```typescript
const toolConfig = {
  pencil: { minSize: 2, maxSize: 20 },
  line: { snapAngle: 15 }, // degrees
  autoClose: { tolerance: 15 }, // pixels
  zoom: { min: 0.5, max: 3.0 }
};
```

---

## 🎨 Color Blending Modes

### Available Blend Modes:
- **Normal:** Direct color replacement
- **Multiply:** Darkens by multiplying colors (realistic shadows)
- **Overlay:** Vibrant colors with preserved highlights/shadows  
- **Soft Light:** Subtle, natural color application
- **Color Burn:** High contrast, dramatic darkening

### Implementation Example:
```typescript
const blendMultiply = (base: RGBA, overlay: RGBA): RGBA => ({
  r: (base.r * overlay.r) / 255,
  g: (base.g * overlay.g) / 255, 
  b: (base.b * overlay.b) / 255,
  a: base.a
});
```

---

## 🚀 Performance Optimizations

### Memory Management
- Use Web Workers for heavy image processing
- Implement dirty rectangle rendering
- Cache processed segments to avoid re-computation

### Canvas Optimization  
- Limit history states to prevent memory leaks
- Use object pooling for temporary drawing objects
- Efficient layer management system

### Export Quality
- Support multiple resolution exports
- Optimized PNG compression
- Progressive JPEG options

---

## 📊 Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 90+ | ✅ Full Support |
| Firefox | 88+ | ✅ Full Support |
| Safari | 14+ | ✅ Full Support |
| Edge | 90+ | ✅ Full Support |

**Required APIs:**
- HTML5 Canvas
- File API
- Canvas 2D Context
- Path2D (for complex shapes)

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

---

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- Fabric.js team for excellent canvas library
- Shadcn/ui for beautiful component system
- OpenCV.js for image processing algorithms
- React ecosystem for robust development tools

---

## 📞 Support

- 📧 Email: support@colorization-studio.com
- 💬 Discord: [Join our community](https://discord.gg/colorization-studio)
- 📖 Documentation: [Full API docs](https://docs.colorization-studio.com)
- 🐛 Issues: [GitHub Issues](https://github.com/your-username/advanced-image-colorization/issues)

---

**Built with ❤️ for creative professionals and artists worldwide.**