import "./style.css";

document.body.innerHTML = `
  <canvas id="canvas"></canvas>
  <br><br>
  <button id="clearButton">Clear</button>
`;

// canvas set up
const canvas = document.getElementById("canvas") as HTMLCanvasElement;
canvas.width = 256;
canvas.height = 256;

const ctx = canvas.getContext("2d")!;

//  data structures
type Point = { x: number; y: number };

//drawing aka each stoke is an array of points
const drawing: Point[][] = [];

// tacks if drawing or not
const cursor = { active: false };

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

  // draw all strokes
  ctx.beginPath();
  for (const stroke of drawing) {
    if (stroke.length === 0) continue;

    // move to first point in stroke
    ctx.moveTo(stroke[0].x, stroke[0].y);

    // draw lines through rest of points
    for (let i = 1; i < stroke.length; i++) {
      const p = stroke[i];
      ctx.lineTo(p.x, p.y);
    }
  }

  ctx.stroke();
}

//Listen for drawing-changed
canvas.addEventListener("drawing-changed", redraw);

// ------ Mouse events ------------
// start a new stroke
canvas.addEventListener("mousedown", (e) => {
  cursor.active = true;

  const newStroke: Point[] = [];
  newStroke.push({ x: e.offsetX, y: e.offsetY });
  drawing.push(newStroke);

  dispatchDrawingChanged();
});

// to add points to current stroke
canvas.addEventListener("mousemove", (e) => {
  if (!cursor.active) return;
  if (drawing.length === 0) return; // safety

  const currentStroke = drawing[drawing.length - 1];
  currentStroke.push({ x: e.offsetX, y: e.offsetY });

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

//  Clear button
const clearButton = document.getElementById("clearButton")!;
clearButton.addEventListener("click", () => {
  // clear the data, not just the pixels
  drawing.length = 0;

  dispatchDrawingChanged();
});

// initial background load
dispatchDrawingChanged();
