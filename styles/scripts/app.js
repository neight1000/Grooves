const AudioContext = window.AudioContext || window.webkitAudioContext;
const ctx = new AudioContext();

// Audio Nodes
const analyser = ctx.createAnalyser();
analyser.fftSize = 1024;
const dataArray = new Uint8Array(analyser.frequencyBinCount);

const gainNode = ctx.createGain();
const filter = ctx.createBiquadFilter();
const delay = ctx.createDelay();
const reverb = ctx.createConvolver();

const master = ctx.createGain();
gainNode.connect(filter);
filter.connect(delay);
delay.connect(reverb);
reverb.connect(master);
filter.connect(master);
master.connect(analyser);
analyser.connect(ctx.destination);

// Reverb Impulse
const impulse = ctx.createBuffer(2, 0.5 * ctx.sampleRate, ctx.sampleRate);
for (let c = 0; c < 2; c++) {
  const ch = impulse.getChannelData(c);
  for (let i = 0; i < ch.length; i++) {
    ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
  }
}
reverb.buffer = impulse;

// DOM Elements
const bpmSlider = document.getElementById("bpmSlider");
const bpmValue = document.getElementById("bpmValue");
const midiSelect = document.getElementById("midiSelect");
const keyDisplay = document.getElementById("keyDisplay");

const delaySlider = document.getElementById("delaySlider");
const filterSlider = document.getElementById("filterSlider");
const volumeSlider = document.getElementById("volumeSlider");
const presetSelect = document.getElementById("presetSelect");

const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");

playBtn.onclick = () => ctx.resume();
stopBtn.onclick = () => ctx.suspend();

bpmSlider.oninput = () => bpmValue.textContent = bpmSlider.value;
delaySlider.oninput = () => delay.delayTime.value = parseFloat(delaySlider.value);
filterSlider.oninput = () => filter.frequency.value = parseFloat(filterSlider.value);
volumeSlider.oninput = () => gainNode.gain.value = parseFloat(volumeSlider.value);

// Audio Trigger
function triggerTone(freq) {
  const now = ctx.currentTime;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.001, now);
  env.gain.exponentialRampToValueAtTime(parseFloat(volumeSlider.value), now + 0.1);
  env.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

  [0.99, 1.0, 1.01].forEach(detune => {
    const o = ctx.createOscillator();
    o.type = "square";
    o.frequency.setValueAtTime(freq * detune, now);
    o.connect(env);
    o.start(now);
    o.stop(now + 1.2);
  });

  env.connect(gainNode);
}

function playNoteByMidi(note) {
  const freq = 440 * Math.pow(2, (note - 69) / 12);
  triggerTone(freq);
  const camelotMap = {60: "8B", 62: "9B", 64: "10B", 65: "11B", 67: "1B", 69: "2B", 71: "3B", 72: "8B"};
  keyDisplay.textContent = `Key: ${camelotMap[note] || "—"}`;
}

// MIDI Clock Sync
let clockCounter = 0;
let clockStartTime = null;

navigator.requestMIDIAccess().then(access => {
  access.inputs.forEach((input, i) => {
    const opt = document.createElement("option");
    opt.value = i;
    opt.textContent = input.name;
    midiSelect.appendChild(opt);
  });

  const selected = Array.from(access.inputs.values())[0];
  if (selected) setMidiInput(selected);

  midiSelect.onchange = () => {
    const chosen = Array.from(access.inputs.values())[midiSelect.selectedIndex];
    if (chosen) setMidiInput(chosen);
  };
});

function setMidiInput(input) {
  input.onmidimessage = e => {
    const [status, d1, d2] = e.data;
    if (status === 0xF8) handleClock();
    if (status === 0xFA) clockStartTime = performance.now();
    if (status === 0xFC) clockStartTime = null;
    if ((status & 0xf0) === 0x90 && d2 > 0) playNoteByMidi(d1);
  };
}

function handleClock() {
  if (!clockStartTime) return;
  clockCounter++;
  if (clockCounter % 24 === 0) {
    const now = performance.now();
    const elapsed = now - clockStartTime;
    const bpm = (clockCounter / 24) * (60000 / elapsed);
    bpmSlider.value = bpm.toFixed(0);
    bpmValue.textContent = bpm.toFixed(0);
    clockStartTime = now;
    clockCounter = 0;
  }
}

// Visualizer
const canvas = document.getElementById("visualizer");
const ctx2d = canvas.getContext("2d");
function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight * 0.6;
}
window.onresize = resizeCanvas;
resizeCanvas();

function draw() {
  requestAnimationFrame(draw);
  analyser.getByteTimeDomainData(dataArray);
  ctx2d.fillStyle = "black";
  ctx2d.fillRect(0, 0, canvas.width, canvas.height);
  ctx2d.strokeStyle = "white";
  ctx2d.beginPath();
  const slice = canvas.width / dataArray.length;
  for (let i = 0; i < dataArray.length; i++) {
    const x = i * slice;
    const y = (dataArray[i] / 255) * canvas.height;
    i === 0 ? ctx2d.moveTo(x, y) : ctx2d.lineTo(x, y);
  }
  ctx2d.stroke();
}
draw();
