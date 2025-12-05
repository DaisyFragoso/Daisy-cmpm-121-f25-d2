import "./style.css";

document.body.innerHTML = `
  <canvas id="canvas"></canvas>
  <button id="thinButton">Thin</button>
  <button id="thickButton">Thick</button>
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

// display command
interface DisplayCommand {
  display(ctx: CanvasRenderingContext2D): void;
}

//marker line
class MarkerLine implements DisplayCommand {
  private points: Point[] = [];
  private thickness: number;

  constructor(startX: number, startY: number, thickness: number) {
    this.thickness = thickness;
    this.points.push({ x: startX, y: startY });
  }

  drag(x: number, y: number) {
    this.points.push({ x, y });
  }

  // Add this line's geometry to the current path
  display(ctx: CanvasRenderingContext2D): void {
    if (this.points.length === 0) return;

    ctx.beginPath();
    ctx.lineWidth = this.thickness;
    ctx.moveTo(this.points[0].x, this.points[0].y);
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      ctx.lineTo(p.x, p.y);
    }
    ctx.stroke();
  }
}

//drawing aka each art stoke is an array of points
const drawing: DisplayCommand[] = [];
//redo arrays
const redoArray: DisplayCommand[] = [];

// tacks if drawing or not
const cursor = { active: false };

//markers tools
const thin_MARKER = 1;
const thick_MARKER = 8;

let currentThickness = thin_MARKER;

function dispatchDrawingChanged() {
  const event = new Event("drawing-changed");
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
}

//Listen for drawing-changed
canvas.addEventListener("drawing-changed", redraw);

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

// ------ Mouse events ------------
// start a new stroke
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;

  const newStroke = new MarkerLine(e.offsetX, e.offsetY, currentThickness);
  drawing.push(newStroke);

  redoArray.length = 0;

  dispatchDrawingChanged();
});

// to add points to current stroke
canvas.addEventListener("mousemove", (e) => {
  if (!cursor.active) return;
  if (drawing.length === 0) return; // safety

  const currentStroke = drawing[drawing.length - 1] as MarkerLine;
  currentStroke.drag(e.offsetX, e.offsetY);

  dispatchDrawingChanged();
});

// stop drawing
canvas.addEventListener("mouseup", () => {
  cursor.active = false;
});

//so it stops if mouse leaves canvas
canvas.addEventListener("mouseleave", () => {
  cursor.active = false;
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
