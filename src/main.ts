import "./style.css";

document.body.innerHTML = `
  <canvas id="canvas"></canvas>
  <br><br>
  <button id="thinButton">Thin</button>
  <button id="thickButton">Thick</button>
  <br><br>
  <button id="stickerSmile">🍪</button>
  <button id="stickerStar">🎶</button>
  <button id="stickerHeart">❤️</button>
  <br><br>
  <button id="clearButton">Clear</button>
  <button id="undoButton">Undo</button>
  <button id="redoButton">Redo</button>
`;

// canvas set up
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
canvas.width = 256;
canvas.height = 256;

const ctx = canvas.getContext("2d")!;

//  data structures
type Point = { x: number; y: number };

//keeps track if using marker or sticker
type Tool = "marker" | "sticker";
let currentTool: Tool = "marker";
let currentSticker = "🍪";

//markers tools
const thin_MARKER = 3;
const thick_MARKER = 8;
let currentThickness = thin_MARKER;

// display command
interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
}

class StickerPreview implements DisplayCommand {
  emoji: string;
  x: number;
  y: number;

  constructor(emoji: string, x: number, y: number) {
    this.emoji = emoji;
    this.x = x;
    this.y = y;
  }
  drag(x: number, y: number) {
    this.x = x;
    this.y = y;
  }
  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, this.x, this.y);
    ctx.restore();
  }
}

//places sticker
class StickerStamp implements DisplayCommand {
  emoji: string;
  x: number;
  y: number;

  constructor(emoji: string, x: number, y: number) {
    this.emoji = emoji;
    this.x = x;
    this.y = y;
  }

  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.font = "32px sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(this.emoji, this.x, this.y);
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

  constructor(startX: number, startY: number, thickness: number) {
    this.thickness = thickness;
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
    ctx.strokeStyle = "black";

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
  ) {}

  display(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = "black";
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

//Listen for drawing-changed
canvas.addEventListener("drawing-changed", redraw);
canvas.addEventListener("tool-moved", redraw);

// helper update button clases
const thinButton = document.getElementById("thinButton")!;
const thickButton = document.getElementById("thickButton")!;

function updateSelectedToolButtons() {
  thinButton.classList.toggle("selectedTool", currentThickness === thin_MARKER);
  thickButton.classList.toggle(
    "selectedTool",
    currentThickness === thick_MARKER,
  );
}

//sticker buttons
const stickerSmile = document.getElementById(
  "stickerSmile",
) as HTMLButtonElement;
const stickerStar = document.getElementById("stickerStar") as HTMLButtonElement;
const stickerHeart = document.getElementById(
  "stickerHeart",
) as HTMLButtonElement;

function selectMarker(thickness: number) {
  currentTool = "marker";
  currentThickness = thickness;
  updateSelectedToolButtons();
  dispatchToolMoved();
}

function selectSticker(emoji: string) {
  currentTool = "sticker";
  currentSticker = emoji;
  preview = null;
  dispatchToolMoved();
}

thinButton.addEventListener("click", () => {
  selectMarker(thin_MARKER);
});

thickButton.addEventListener("click", () => {
  selectMarker(thick_MARKER);
});

stickerSmile.addEventListener("click", () => {
  selectSticker("🍪");
});

stickerStar.addEventListener("click", () => {
  selectSticker("🎶");
});

stickerHeart.addEventListener("click", () => {
  selectSticker("❤️");
});

// ------ Mouse events ------------
// start a new stroke
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;

  if (currentTool === "marker") {
    const newStroke = new MarkerLine(e.offsetX, e.offsetY, currentThickness);
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
      preview = new MarkerPreview(e.offsetX, e.offsetY, currentThickness);
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
    currentTool === "sticker" && activeCommand && activeCommand instanceof StickerPreview
  ) {
    const finalSticker = new StickerStamp(activeCommand.emoji, activeCommand.x, activeCommand.y);
    drawing.push(finalSticker);
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

// --- marker thin/ thick button listeners
thinButton.addEventListener("click", () => {
  currentThickness = thin_MARKER;
  updateSelectedToolButtons();
});

thickButton.addEventListener("click", () => {
  currentThickness = thick_MARKER;
  updateSelectedToolButtons();
});

// initial background load
dispatchDrawingChanged();
