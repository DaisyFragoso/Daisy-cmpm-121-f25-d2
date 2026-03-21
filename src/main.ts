import "./style.css";

document.body.innerHTML = `
  <div id="app">
    <canvas id="canvas"></canvas>
    <div class="controls-row">
      <label for="markerSize">Marker Size</label>
      <input type="range" id="markerSize" min="1" max="20" value="4" />
      <span id="markerSizeValue">4</span>
    </div>
    <div class="controls-row">
      <label for="colorHue">Marker Hue</label>
      <input type="range" id="colorHue" min="0" max="360" value="0"/>
      <span id="colorHueValue">0</span>
    </div>
    <div>
      <button id="customStickerButton">CustomSticker</button>
      <div id="stickerButtons"></div>
    </div>
    <div>
      <button id="clearButton">Clear</button>
      <button id="undoButton">Undo</button>
      <button id="redoButton">Redo</button>
    </div>
    <div>
      <button id="exportButton">Export Art</button>
      <input type="file" id="imageUpload" accept="image/png" />
    </div>
  </div>
  `;

// canvas set up
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
canvas.width = 512;
canvas.height = 512;

const ctx = canvas.getContext("2d")!;

//  data structures
type Point = { x: number; y: number };

//keeps track if using marker or sticker
type Tool = "marker" | "sticker";
let currentTool: Tool = "marker";
type StickerType = string | HTMLImageElement;
let currentSticker: StickerType = "🍪";
const stickers = ["🍪", "🎶", "❤️"];

//marker defaults
const DEFAULT_MARKER_SIZE = 4;
let currentThickness = DEFAULT_MARKER_SIZE;

//hue defaults
let currentHue = 0;

// display command
interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
}

const colorHueSlider = document.getElementById("colorHue") as HTMLInputElement;
const colorHueValue = document.getElementById(
  "colorHueValue",
) as HTMLSpanElement;

const stickerButtonsDiv = document.getElementById(
  "stickerButtons",
) as HTMLDivElement;
const customStickerButton = document.getElementById(
  "customStickerButton",
) as HTMLButtonElement;

function renderStickerButtons() {
  stickerButtonsDiv.innerHTML = "";

  for (const emoji of stickers) {
    const button = document.createElement("button");
    button.textContent = emoji;

    button.addEventListener("click", () => {
      selectSticker(emoji);
    });

    stickerButtonsDiv.appendChild(button);
  }
}

customStickerButton.addEventListener("click", () => {
  const text = prompt("Custom sticker text", "🧽");
  if (!text || text.trim() === "") return;

  stickers.push(text);
  renderStickerButtons();
  selectSticker(text);
});

renderStickerButtons();

class StickerPreview implements DraggableCommand {
  sticker: StickerType;
  x: number;
  y: number;

  constructor(sticker: StickerType, x: number, y: number) {
    this.sticker = sticker;
    this.x = x;
    this.y = y;
  }
  drag(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (typeof this.sticker === "string") {
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.sticker, this.x, this.y);
    } else {
      // ctx.restore();
      ctx.drawImage(this.sticker, this.x - 16, this.y - 16, 32, 32);
    }
    ctx.restore();
  }
}

function getMarkerColor(): string {
  return `hsl(${currentHue}, 100%, 50%)`;
}

//places sticker
class StickerStamp implements DisplayCommand {
  sticker: StickerType;
  x: number;
  y: number;

  constructor(sticker: StickerType, x: number, y: number) {
    this.sticker = sticker;
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    if (typeof this.sticker === "string") {
      ctx.font = "32px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(this.sticker, this.x, this.y);
    } else {
      ctx.drawImage(this.sticker, this.x - 16, this.y - 16, 32, 32);
    }
    ctx.restore();
  }
}

interface DraggableCommand extends DisplayCommand {
  drag(x: number, y: number): void;
}
//marker line
class MarkerLine implements DraggableCommand {
  private points: Point[] = [];
  private thickness: number;
  private color: string;

  constructor(
    startX: number,
    startY: number,
    thickness: number,
    color: string,
  ) {
    this.thickness = thickness;
    this.color = color;
    this.points.push({ x: startX, y: startY });
  }

  drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  display(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    ctx.save();
    ctx.beginPath();
    ctx.lineWidth = this.thickness;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = this.color;

    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// class MarkerPreview implements ToolPreview {
class MarkerPreview implements DisplayCommand {
  constructor(
    public x: number,
    public y: number,
    public thickness: number,
    public color: string,
  ) {}

  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = this.color;
    ctx.arc(this.x, this.y, this.thickness / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

let preview: DisplayCommand | null = null;
let activeCommand: DraggableCommand | null = null;

//drawing aka each art stoke is an array of points
const drawing: DisplayCommand[] = [];
//redo arrays
const redoArray: DisplayCommand[] = [];

// tacks if drawing or not
const cursor = { active: false };

function dispatchDrawingChanged() {
  const event = new Event("drawing-changed");
  canvas.dispatchEvent(event);
}

function dispatchToolMoved() {
  const event = new Event("tool-moved");
  canvas.dispatchEvent(event);
}

// ---- Redraw everything from `drawing` ----
function redraw() {
  // clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // background
  ctx.fillStyle = "green";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // ctx.beginPath();
  for (const command of drawing) {
    command.display(ctx);
  }

  // draw preview only when mouse is not down
  if (!cursor.active && preview !== null) {
    preview.display(ctx);
  }
  if (cursor.active && currentTool === "sticker" && activeCommand) {
    activeCommand.display(ctx);
  }
}

// Listen for drawing-changed
canvas.addEventListener("drawing-changed", redraw);
canvas.addEventListener("tool-moved", redraw);

function selectSticker(sticker: StickerType) {
  currentTool = "sticker";
  currentSticker = sticker;
  preview = null;
  dispatchToolMoved();
}

// ------ Mouse events ------------
// start a new stroke
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;

  if (currentTool === "marker") {
    const newStroke = new MarkerLine(
      e.offsetX,
      e.offsetY,
      currentThickness,
      getMarkerColor(),
    );
    drawing.push(newStroke);
    redoArray.length = 0;
    preview = null;
    dispatchDrawingChanged();
  } else if (currentTool === "sticker") {
    activeCommand = new StickerPreview(currentSticker, e.offsetX, e.offsetY);
    redoArray.length = 0;
    preview = null;
    dispatchToolMoved();
  }
});

// to add points to current stroke
canvas.addEventListener("mousemove", (e) => {
  if (cursor.active) {
    if (currentTool === "marker") {
      if (drawing.length === 0) return; // safety
      const currentStroke = drawing[drawing.length - 1] as MarkerLine;
      currentStroke.drag(e.offsetX, e.offsetY);
      dispatchDrawingChanged();
    } else if (currentTool === "sticker") {
      if (activeCommand && activeCommand instanceof StickerPreview) {
        activeCommand.drag(e.offsetX, e.offsetY);
        dispatchToolMoved();
      }
    }
  } else {
    // preview for marker
    if (currentTool === "marker") {
      preview = new MarkerPreview(
        e.offsetX,
        e.offsetY,
        currentThickness,
        getMarkerColor(),
      );
      dispatchToolMoved();
    } else {
      // preview for sticker
      preview = new StickerPreview(currentSticker, e.offsetX, e.offsetY);
      dispatchToolMoved();
    }
  }
});

// stop drawing
canvas.addEventListener("mouseup", () => {
  if (!cursor.active) return;
  cursor.active = false;

  if (
    currentTool === "sticker" && activeCommand instanceof StickerPreview
  ) {
    const finalSticker = new StickerStamp(
      activeCommand.sticker,
      activeCommand.x,
      activeCommand.y,
    );
    drawing.push(finalSticker);
    activeCommand = null;
    preview = null;
    dispatchDrawingChanged();
  }
});

//so it stops if mouse leaves canvas
canvas.addEventListener("mouseleave", () => {
  cursor.active = false;
  preview = null;
  activeCommand = null;
  dispatchToolMoved();
});

// clear button
const clearButton = document.getElementById("clearButton")!;
clearButton.addEventListener("click", () => {
  // clear the data, not just the pixels
  drawing.length = 0;
  redoArray.length = 0;

  dispatchDrawingChanged();
});

// undo Button
const undoButton = document.getElementById("undoButton")!;
undoButton.addEventListener("click", () => {
  if (drawing.length === 0) return;

  const stroke = drawing.pop()!;
  redoArray.push(stroke);

  dispatchDrawingChanged();
});

// redo button
const redoButton = document.getElementById("redoButton")!;
redoButton.addEventListener("click", () => {
  if (redoArray.length === 0) return;

  const stroke = redoArray.pop()!;
  drawing.push(stroke);

  dispatchDrawingChanged();
});

const imageUpload = document.getElementById("imageUpload") as HTMLInputElement;
imageUpload.addEventListener("change", () => {
  const file = imageUpload.files?.[0];
  if (!file) return;

  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  img.onload = () => {
    currentTool = "sticker";
    currentSticker = img;
    preview = null;
    dispatchToolMoved();
    URL.revokeObjectURL(objectUrl);
  };
  img.src = objectUrl;
});

const exportButton = document.getElementById(
  "exportButton",
) as HTMLButtonElement;

const markerSizeSlider = document.getElementById(
  "markerSize",
) as HTMLInputElement;

const markerSizeValue = document.getElementById(
  "markerSizeValue",
) as HTMLSpanElement;

markerSizeSlider.addEventListener("input", () => {
  currentThickness = Number(markerSizeSlider.value);
  markerSizeValue.textContent = markerSizeSlider.value;
  dispatchToolMoved();
});

exportButton.addEventListener("click", () => {
  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = 1024;
  exportCanvas.height = 1024;

  const exportCtx = exportCanvas.getContext("2d")!;
  exportCtx.scale(4, 4);

  exportCtx.fillStyle = "green";
  exportCtx.fillRect(0, 0, canvas.width, canvas.height);

  for (const command of drawing) {
    command.display(exportCtx);
  }

  const anchor = document.createElement("a");
  anchor.href = exportCanvas.toDataURL("image/png");
  anchor.download = "sketchpad.png";
  anchor.click();
});

colorHueSlider.addEventListener("input", () => {
  currentHue = Number(colorHueSlider.value);
  colorHueValue.textContent = colorHueSlider.value;
  currentTool = "marker";
  dispatchToolMoved();
});

// initial background load
dispatchDrawingChanged();
