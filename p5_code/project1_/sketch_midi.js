let currentkey = '1';
let activeBrush = 'b';
let bgc;
let gkcount;
let hsvOn;
let sizeScalar;
const MIN_SIZE = 0.2;
const MAX_SIZE = 5;
let qnSpacing;
let qnResidual;

let midiOutput = null;
let lastControlTime = 0;
const BRUSH_IDS = { e: 1, l: 2, o: 3, b: 4, c: 5 };

const QN_PALETTE = {
  pink: { h: 340, s: 21, b: 82 },
  green: { h: 79, s: 30, b: 81 },
  brown: { h: 30, s: 35, b: 70 }
};

function qnFillColor(name, bAdjust = 0, alpha = 100) {
  const c = QN_PALETTE[name];
  const b = constrain(c.b + bAdjust, 0, 100);
  fill(c.h, c.s, b, alpha);
}

function qnStrokeColor(name, bAdjust = 0, alpha = 100) {
  const c = QN_PALETTE[name];
  const b = constrain(c.b + bAdjust, 0, 100);
  stroke(c.h, c.s, b, alpha);
}

let qnColors = ['pink', 'green', 'brown'];
let qnColorIdx = 0;

function setup() {
  createCanvas(800, 600);
  colorMode(HSB, 360, 100, 100, 100);
  background(255);
  smooth();
  bgc = color(255);
  gkcount = 20;
  hsvOn = true;
  sizeScalar = 1;
  qnSpacing = 20;
  qnResidual = 0;
}

function draw() {
  if (keyIsPressed) clear_print();

  if (mouseIsPressed) {
    drawChoice();
    sendMouseControls();
  }
}

async function enableMIDI() {
  if (!navigator.requestMIDIAccess) {
    console.log('Web MIDI is not supported. Try Chrome or Edge.');
    return;
  }

  if (midiOutput) return midiOutput;

  try {
    const midiAccess = await navigator.requestMIDIAccess();
    const outputs = Array.from(midiAccess.outputs.values());
    console.log('MIDI outputs:', outputs.map(output => output.name));
    midiOutput = outputs.find(output => output.name.includes('BrushToMax'));

    if (midiOutput) {
      console.log('Connected to BrushToMax');
    } else {
      console.log('Create a loopMIDI port named BrushToMax, then refresh.');
    }
  } catch (error) {
    console.log('MIDI permission failed:', error);
  }
}

function sendCC(controller, value) {
  if (!midiOutput) return;
  const safeValue = constrain(Math.round(value), 0, 127);
  midiOutput.send([0xB0, controller, safeValue]);
}

function sendMouseControls() {
  if (!midiOutput) return;

  const now = performance.now();
  if (now - lastControlTime < 30) return;

  const xValue = map(mouseX, 0, width, 0, 127);
  const yValue = map(mouseY, 0, height, 0, 127);

  sendCC(16, xValue);
  sendCC(17, yValue);
  lastControlTime = now;
}

function mousePressed() {
  enableMIDI().then(() => {
    if (BRUSH_IDS[activeBrush]) {
      sendCC(18, BRUSH_IDS[activeBrush]);
    }
    sendCC(19, 1);
    sendMouseControls();
  });
  return false;
}

function mouseReleased() {
  sendCC(19, 0);
  return false;
}

function drawChoice() {
  let brush = activeBrush || key.toLowerCase();

  switch (brush) {
    case 'l':
      drawline(color(0), mouseX, mouseY, pmouseX, pmouseY);
      break;
    case 'e':
      eraser(bgc, mouseX, mouseY, 25 * sizeScalar);
      break;
    case 'o':
      qnOrbitBrush(hsvOn ? frameCount % 360 : 0, 200 * sizeScalar, 8, 6);
      break;
    case 'c':
      qnCloudBrush(12, 8, 40, 60);
      break;
    case 'b':
      qnBurst();
      break;
  }
}

function drawline(k, lx, ly, px, py) {
  stroke(k);
  line(lx, ly, px, py);
}

function eraser(k, lx, ly, sz) {
  noStroke();
  fill(k);
  ellipse(lx, ly, sz, sz);
}

function clear_print() {
  if (key === 'x' || key === 'X') background(255);
}

function keyPressed() {
  const brush = key.toLowerCase();

  if (BRUSH_IDS[brush]) {
    activeBrush = brush;
    enableMIDI().then(() => sendCC(18, BRUSH_IDS[brush]));
  }

  if (key === '=' || key === '+' || keyCode === 187) {
    sizeScalar = min(MAX_SIZE, sizeScalar + 0.2);
  } else if (key === '-' || key === '_' || keyCode === 189) {
    sizeScalar = max(MIN_SIZE, sizeScalar - 0.2);
  } else if (key === '0' || key === ')' || keyCode === 48) {
    qnColorIdx = (qnColorIdx + 1) % qnColors.length;
  }
}

function qnOrbitBrush(h, r, count, jitter) {
  push();
  noStroke();
  const col = qnColors[qnColorIdx];
  for (let i = 0; i < count; i++) {
    const ang = (TWO_PI / count) * i + frameCount * 0.02;
    const jr = r + random(-jitter, jitter);
    const x = mouseX + cos(ang) * jr;
    const y = mouseY + sin(ang) * jr;
    qnFillColor(col, random(-10, 10));
    ellipse(x, y, 6 * sizeScalar, 6 * sizeScalar);
  }
  pop();
}

function qnCloudBrush(clumps, perClump, minSize, maxSize) {
  push();
  noStroke();
  const col = qnColors[qnColorIdx];
  for (let c = 0; c < clumps; c++) {
    const baseA = random(TWO_PI);
    const baseR = random(5, 35) * sizeScalar;
    const cx = mouseX + cos(baseA) * baseR;
    const cy = mouseY + sin(baseA) * baseR;
    for (let i = 0; i < perClump; i++) {
      const a = random(TWO_PI);
      const r = random(0, 20) * sizeScalar;
      const x = cx + cos(a) * r;
      const y = cy + sin(a) * r;
      const s = random(minSize, maxSize) * sizeScalar * random(0.5, 1.2);
      qnFillColor(col, random(-8, 8), 85);
      ellipse(x, y, s * random(0.7, 1.4), s * random(0.7, 1.4));
    }
  }
  pop();
}

function qnBurst() {
  push();
  const ringSize = 30 * sizeScalar;
  const spacing = ringSize * (1 / 3);
  const dx = mouseX - pmouseX;
  const dy = mouseY - pmouseY;
  const segLen = sqrt(dx * dx + dy * dy);
  const col = qnColors[qnColorIdx];
  if (segLen > 0) {
    const ux = dx / segLen;
    const uy = dy / segLen;
    let distAlong = qnResidual;
    while (distAlong <= segLen) {
      const x = pmouseX + ux * distAlong;
      const y = pmouseY + uy * distAlong;
      qnFillColor(col, random(-6, 6));
      qnStrokeColor('brown', -5, 80);
      strokeWeight(2);
      ellipse(x, y, ringSize, ringSize);
      distAlong += spacing;
    }
    qnResidual = distAlong - segLen;
  }
  pop();
}
