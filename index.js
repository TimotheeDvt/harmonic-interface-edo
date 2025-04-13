/******************
 * CONFIGURATIONS *
 ******************/
const CONFIG = {
  subdivisions: 31,
  radius: 50,
  startFreq: 440,
  endFreq: this.startFreq * 2,
  canvasSize: 500,
  dotSize: 4,
  scaleFactor: 4,
	smallestInterval: undefined,

  maxVoices: 8,
  attackTime: 0.02,
  releaseTime: 0.05,
};
const letters = ["AZERTYUIOPQSDFGHJKLMWXCVBN123456789"];
const style = window.getComputedStyle(document.body)
let COLORS = {
	white: style.getPropertyValue('--white'),
	black: style.getPropertyValue('--black'),
	red: style.getPropertyValue('--red'),
	blue: style.getPropertyValue('--blue')
};

const state = {
  notes: [],
  audioContext: null,
  oscillators: {},
	showFreq: true,
	showKeys: true,
	showWave: true,
	darkMode: true,
	layout: "AZERTYUIOPQSDFGHJKLMWXCVBN123456789",
	type: "sine",
	time: 0
};

/********************
 * AUDIO MANAGEMENT *
 ********************/
function initAudio() {
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function stopNote(frequency) {
  noteOff(frequency);
}

function stopAllNotes() {
	Object.keys(state.oscillators).forEach(frequency => noteOff(frequency));
}

function playNote(frequency) {
	console.log(frequency);
  if (state.oscillators[frequency]) return;

  // Voice management
  if (Object.keys(state.oscillators).length >= CONFIG.maxVoices) {
    const oldestFrequency = Object.keys(state.oscillators)[0];
    noteOff(oldestFrequency);
  }

  const now = state.audioContext.currentTime;
  const osc = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  // NEW: Add compressor to prevent clipping
  const compressor = state.audioContext.createDynamicsCompressor();
  compressor.threshold.setValueAtTime(-24, now);
  compressor.ratio.setValueAtTime(12, now);

  // Oscillator setup
  osc.type = state.type || 'sine';
  osc.frequency.setValueAtTime(frequency, now);

  // Attack phase (fixed initial value)
  gainNode.gain.cancelScheduledValues(now);
  gainNode.gain.setValueAtTime(0.0001, now); // Start from near-zero
  gainNode.gain.exponentialRampToValueAtTime(0.2, now + CONFIG.attackTime);

  // Audio routing
  osc.connect(gainNode);
  gainNode.connect(compressor);
  compressor.connect(state.audioContext.destination);

  osc.start();
  state.oscillators[frequency] = { osc, gainNode, compressor };
  drawPlayingNotes();
}

function noteOff(frequency) {
  const voice = state.oscillators[frequency];
  if (voice) {
    const now = state.audioContext.currentTime;

    // Release phase
    voice.gainNode.gain.cancelScheduledValues(now);
    voice.gainNode.gain.setValueAtTime(voice.gainNode.gain.value, now);

    // Exponential ramp to near-zero
    voice.gainNode.gain.exponentialRampToValueAtTime(0.001, now + CONFIG.releaseTime);

    // Final linear ramp to absolute zero
    voice.gainNode.gain.linearRampToValueAtTime(0, now + CONFIG.releaseTime + 0.005);

    voice.osc.stop(now + CONFIG.releaseTime + 0.01); // Extra buffer
    delete state.oscillators[frequency];
  }
  drawPlayingNotes();
}

/*************************
 * CALCULATION FUNCTIONS *
 *************************/
function calculateNoteFrequencies() {
  return Array.from({ length: CONFIG.subdivisions }, (_, i) => {
    return Math.pow(2, i / CONFIG.subdivisions) * CONFIG.startFreq
	});
}

function calculateNotePositions(radius = CONFIG.radius) {
  return Array.from({ length: CONFIG.subdivisions}, (_, i) => {
    const angle = 2 * Math.PI * i / (CONFIG.subdivisions) - Math.PI / 2; // Start at the top
    return {
      x: radius * Math.cos(angle),
      y: radius * Math.sin(angle)
    };
  });
}

function normalize(value, min, max, newMin, newMax) {
	return ((value - min) * (newMax - newMin)) / (max - min) + newMin;
}

function findSmallestPerfectSquare(n) {
	const sqrt = Math.sqrt(n);
	if (sqrt % 1 === 0) return sqrt;
  const nextNum = Math.floor(sqrt) + 1;
  return nextNum;
}

/*********************
 * DRAWING FUNCTIONS *
 *********************/
function setupCanvas(canvas) {
  canvas.width = CONFIG.canvasSize;
  canvas.height = CONFIG.canvasSize;
  canvas.style.width = `${CONFIG.canvasSize}px`;
  canvas.style.height = `${CONFIG.canvasSize}px`;

  const ctx = canvas.getContext('2d');
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(CONFIG.scaleFactor, CONFIG.scaleFactor);
  ctx.lineWidth = 0.5;
  return ctx;
}

function drawMainCircle() {
  const canvas = document.getElementById('circle');
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.blue;
  ctx.strokeStyle = COLORS.blue;
  ctx.beginPath();
  ctx.arc(0, 0, CONFIG.radius, 0, Math.PI * 2);
  ctx.stroke();
}

function drawAllNotes() {
  const frequencies = calculateNoteFrequencies();
  const positions = calculateNotePositions();

  state.notes = positions.map((pos, i) => ({ ...pos, frequency: frequencies[i], index: i }));
}

function fillTable() {
  const table = document.getElementById('table');
  const notes = state.notes;
  const rows = findSmallestPerfectSquare(notes.length); // Get the next perfect square
  const cols = rows;

  table.innerHTML = ''; // Clear existing table

  for (let i = 0; i < rows; i++) {
		const index = i * cols;
		if (index > notes.length)
			break;
    const row = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const index = i * cols + j;
      if (index < notes.length) {
        const cell = document.createElement('td');
        cell.innerHTML = `<p>${index}</p>`;
        cell.dataset.frequency = notes[index].frequency; // Store frequency
        cell.dataset.index = index; // Store frequency
				if(state.showFreq) {
					const freq = document.createElement('div');

					freq.className = "freq";
					freq.innerText = notes[index].frequency.toFixed(2) + " Hz";

					cell.appendChild(freq);
				}
				if(state.showKeys) {
					const key = document.createElement('div');

					key.className = "key";
					key.innerText = letters[0][index % (CONFIG.subdivisions)] || "";

					cell.appendChild(key);
				}
        row.appendChild(cell);
      }
    }
    table.appendChild(row);
  }
	const emptyCells = table.querySelectorAll('td:not([data-frequency])');
	for (cell of emptyCells)
		cell.style.border = "none";
}

function updateTableSize() {
	const tds = document.querySelectorAll('td');
	const trs = document.querySelectorAll('tr');
	const ps = document.querySelectorAll('td>p');
	const table = document.getElementById('table-container');

	const tableWidth = table.clientWidth;
	const tableHeight = table.clientHeight;
	const littleSquare = findSmallestPerfectSquare(CONFIG.subdivisions);
	const rows = trs.length;
	const cols = trs[0]?.children.length || 0;

	const cellSize = Math.floor(Math.min(tableWidth / cols, tableHeight / rows));

	for (let i = 0; i < tds.length; i++) {
		tds[i].style.width = `${cellSize}px`;
		tds[i].style.height = `${cellSize}px`;
		tds[i].style.maxWidth = `${cellSize}px`;
		tds[i].style.maxHeight = `${cellSize}px`;
		tds[i].style.overflow = 'hidden';
		if (ps[i])
			ps[i].style.fontSize = `${cellSize / 2}px`;
	}

	const keys = document.querySelectorAll('.key');
	const freqs = document.querySelectorAll('.freq');

	for (const key of keys)
		key.style.fontSize = `${cellSize / 6}px`;

	for (const freq of freqs)
		freq.style.fontSize = `${cellSize / 8}px`;
}

function drawPlayingNotes() {
  const canvas = document.getElementById('circle');
  const ctx = canvas.getContext('2d');
  const notes = state.notes;

  // Clear canvas
  ctx.clearRect(-CONFIG.canvasSize / 2, -CONFIG.canvasSize / 2, CONFIG.canvasSize, CONFIG.canvasSize);
  setupCanvas(canvas); // Reset transform
  drawMainCircle();
	writeIndexes();

	let playingNotes = Object.keys(state.oscillators).map(frequency => {
		return notes.find(note => note.frequency == frequency);
	});
	// tracer un poylgone qui relie les notes jouées
	if (playingNotes.length >= 1) {
		playingNotes.sort((a, b) => a.index - b.index);
		const newPos = calculateNotePositions(CONFIG.radius-2);
		const positions = playingNotes.map(note => {
			const index = note.index;
			return {
				x: newPos[index].x,
				y: newPos[index].y
			};
		});
		ctx.beginPath();
		ctx.lineTo(positions[0].x, positions[0].y);
		ctx.arc(positions[0].x, positions[0].y, 0.09, 0, Math.PI * 2);
		for (let i = 1; i < playingNotes.length; i++) {
			ctx.lineTo(positions[i].x, positions[i].y);
			ctx.arc(positions[i].x, positions[i].y, 0.09, 0, Math.PI * 2);
		}
		ctx.lineTo(positions[0].x, positions[0].y);
		ctx.arc(positions[0].x, positions[0].y, 0.09, 0, Math.PI * 2);
		ctx.strokeStyle = COLORS.blue;
		ctx.lineWidth = 2;
		ctx.lineJoin = 'round';
		ctx.stroke();
		ctx.lineWidth = 1;
	}

  notes.forEach(note => {
    if (state.oscillators[note.frequency]) {
			const cell = document.querySelector(`td[data-index="${note.index}"]`);
			cell.style.backgroundColor = COLORS.red;
    } else {
			const cell = document.querySelector(`td[data-index="${note.index}"]`);
			cell.style.backgroundColor = COLORS.black;
		}
  });
}

function writeIndexes() {
	const notes = state.notes;
	const canvas = document.getElementById("circle");
	const ctx = canvas.getContext('2d');
	const newPos = calculateNotePositions(CONFIG.radius+5);
	const positions = notes.map(note => {
		const index = note.index;
		return {
			x: newPos[index].x,
			y: newPos[index].y
		};
	});
	let playingNotes = Object.keys(state.oscillators).map(frequency => {
		return notes.find(note => note.frequency == frequency);
	});
	ctx.fillStyle = COLORS.white;
	ctx.font = `6px Courier New`;
	ctx.textAlign = 'center';
	ctx.textBaseline = 'middle';
	ctx.fillStyle = COLORS.white;
	ctx.strokeStyle = COLORS.white;
	ctx.lineWidth = 0.5;
	for (let i = 0; i < notes.length; i++) {
		if (playingNotes.includes(notes[i])) {
			ctx.fillStyle = COLORS.blue;
			ctx.strokeStyle = COLORS.blue;
		} else {
			ctx.fillStyle = COLORS.white;
			ctx.strokeStyle = COLORS.white;
		}
		ctx.fillText(notes[i].index, positions[i].x, positions[i].y);
		ctx.strokeText(notes[i].index, positions[i].x, positions[i].y);
	}
}

function drawWaveForms() { // c'est faux !!!
	if (!state.showWave) return;

  const canvas = document.getElementById('waveform');
  const ctx = canvas.getContext('2d');

  // Waveform display area
  const waveformX = 0;
  const waveformY = 0;
  const waveformWidth = canvas.width;
  const waveformHeight = canvas.height;

	ctx.clearRect(0, 0, waveformWidth, waveformHeight);

  for (osc of Object.values(state.oscillators)) {
		const frequency = osc.osc.frequency.value;
		// draw the waveform
		ctx.strokeStyle = COLORS.blue;
		ctx.moveTo(waveformX, waveformY + waveformHeight / 2);
		ctx.beginPath();
		const ys = [];
		for (let i = 0; i < waveformWidth; i+=0.5) {
			const x = i / waveformWidth * 2 * Math.PI * frequency / 100 + state.time;
			let y;
			switch (state.type) {
				case 'sine':
					y = Math.sin(x) * (waveformHeight / 2) + waveformHeight / 2;
					break;
				case 'square':
					y = Math.sign(Math.sin(x)) * (waveformHeight / 2) + waveformHeight / 2;
					break;
				case 'sawtooth':
					y = ((x / Math.PI) % 2 - 1) * (waveformHeight / 2) + waveformHeight / 2;
					break;
				case 'triangle':
					y = Math.abs((x / Math.PI) % 2 - 1) * (waveformHeight / 2) + waveformHeight / 2;
					break;
			}
			ys.push(y);
			// scale the y value to fit the canvas
			y = normalize(y, 0, waveformHeight, waveformY, waveformY + waveformHeight);
			ctx.lineTo(waveformX + i, y);
		}
		ctx.strokeStyle = COLORS.blue2;
		ctx.lineWidth = 1;
		ctx.lineJoin = 'round';
		ctx.stroke();
	}
	state.time += 0.05; // Increment time for animation
	if (state.time > 2 * Math.PI) state.time = 0; // Reset time to avoid overflow
}

/******************
 * EVENT HANDLERS *
 ******************/
function handleTableClick(event) {
  const cell = event.target.closest('td');
  if (!cell) return;

  const frequency = parseFloat(cell.dataset.frequency);
  if (frequency) {
    if (state.oscillators[frequency]) {
      stopNote(frequency);
    } else {
      playNote(frequency);
    }
  }
	update();
}

function handleCanvasClick(event) {
  const canvas = document.getElementById('circle');
  const rect = canvas.getBoundingClientRect();

  const click = {
    x: (event.clientX - rect.left - canvas.width / 2) / CONFIG.scaleFactor,
    y: (event.clientY - rect.top - canvas.height / 2) / CONFIG.scaleFactor
  };

  const clickRadius = 20 / CONFIG.subdivisions * CONFIG.scaleFactor;
	const newPos = calculateNotePositions(CONFIG.radius+5);
  state.notes.forEach(note => {
		const index = note.index;
		const notePos = newPos[index];
    const distance = Math.sqrt((click.x - notePos.x) ** 2 + (click.y - notePos.y) ** 2);
    if (distance < clickRadius) {
      if (state.oscillators[note.frequency]) {
        stopNote(note.frequency);
      } else {
        playNote(note.frequency);
      }
    }
  });
	update();
}

function handleShowFreqClick() {
	state.showFreq = !state.showFreq;
	update();
}

function handleShowKeysClick() {
	state.showKeys = !state.showKeys;
	update();
}

function handleShowWaveFormClick() {
	state.showWave = !state.showWave;
  const canvas = document.getElementById('waveform');
  const ctx = canvas.getContext('2d');

	ctx.clearRect(0, 0, canvas.width, canvas.height);

	update();
}

function handleLayoutChange() {
	state.layout = document.getElementById('changeLayout').value;
	if (state.layout === "AZERTY")
		letters[0] = "AZERTYUIOPQSDFGHJKLMWXCVBN123456789";
	else if (state.layout === "QWERTY")
		letters[0] = "QWERTYUIOPASDFGHJKLZXCVBNM123456789";
	update();
}

function handleWaveFormChange() {
	state.type = document.getElementById('changeWaveform').value;
	update();
}

function handleModeChange() {
	const firstVar = getComputedStyle(document.documentElement).getPropertyValue('--white');
	const secondVar = getComputedStyle(document.documentElement).getPropertyValue('--black');

	document.documentElement.style.setProperty('--white', secondVar);
	document.documentElement.style.setProperty('--black', firstVar);
	COLORS = {
		white: style.getPropertyValue('--white'),
		black: style.getPropertyValue('--black'),
		red: style.getPropertyValue('--red'),
		blue: style.getPropertyValue('--blue')
	};
	update();
}

/********************
 * KEYBOARD SUPPORT *
 ********************/
const key_to_index = {};
function calculate_key_to_index() {
	const keys = letters[0].split('');
	for (let i = 0; i < keys.length; i++) {
		key_to_index[keys[i]] = i % (CONFIG.subdivisions);
	}
}

function keyToFrequency(key) {
  const index = key_to_index[key.toUpperCase()];
  if (index !== undefined) {
    return state.notes[index].frequency;
  }
  return null;
}

function toggleFooterAndInfos() {
	const footer = document.querySelector('footer');
	footer.classList.toggle('hidden');
	if (footer.classList.contains('hidden'))
		footer.style.display = 'none';
	else
		footer.style.display = 'flex';
	const infos = document.querySelector('#infos');
	infos.classList.toggle('hidden');
	if (infos.classList.contains('hidden')) {
		infos.style.display = 'none';
	} else {
		infos.style.display = 'flex';
	}
}

const pressedKeys = new Set();
document.addEventListener('keydown', (e) => {
	if (pressedKeys.has(e.key)) return; // Prevent duplicate key presses
	pressedKeys.add(e.key);
  const noteKey = keyToFrequency(e.key);
  if (noteKey) {
    playNote(noteKey);
	} else if (e.key === " ") {
		stopAllNotes();
		toggleFooterAndInfos();
	}
	update();
});

document.addEventListener('keyup', (e) => {
	pressedKeys.delete(e.key);
  const noteKey = keyToFrequency(e.key);
  if (noteKey) {
    stopNote(noteKey);
  }
	update();
});

function preventSubmit1(e) {
	if (e.key === 'Enter') {
		CONFIG.startFreq = parseFloat(e.target.value);
		CONFIG.endFreq = CONFIG.startFreq * 2;
		update();
		e.preventDefault();
	}
}

function preventSubmit2(e) {
	if (e.key === 'Enter') {
		CONFIG.subdivisions = e.target.value;
		update();
		e.preventDefault();
	}
}

/******************
 * INITIALIZATION *
 ******************/
function init() {
  initAudio();
	handleLayoutChange();
  document.getElementById('circle').addEventListener('click', handleCanvasClick);
  document.getElementById('table').addEventListener('click', handleTableClick);
  document.querySelector('#showFreq').addEventListener('click', handleShowFreqClick);
  document.querySelector('#showKey').addEventListener('click', handleShowKeysClick);
  document.querySelector('#showWave').addEventListener('click', handleShowWaveFormClick);
	document.querySelector('#changeLayout').addEventListener('change', handleLayoutChange);
	document.querySelector('#changeWaveform').addEventListener('change', handleWaveFormChange);
	document.querySelector('#changeMode').addEventListener('change', handleModeChange);
	document.querySelector('#subdivNb').addEventListener('change', (e) => {
		CONFIG.subdivisions = e.target.value;
		update();
	});
	CONFIG.subdivisions = parseInt(document.querySelector('#subdivNb').value);
	state.darkMode = document.querySelector('#changeMode').checked;
	CONFIG.smallestInterval = (CONFIG.endFreq-CONFIG.startFreq) / CONFIG.subdivisions;
	update();
}

function update() {
	calculate_key_to_index();
  drawMainCircle();
  drawAllNotes();
  fillTable();
	writeIndexes();
	drawPlayingNotes();
	updateTableSize();
}

const showWaveInterval = setInterval(drawWaveForms, 1000 / 50); // 30 FPS

/*********************
 * START APPLICATION *
 *********************/
init();

if (navigator.requestMIDIAccess) {
	navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
}

function onMIDIFailure() {
	console.error('Could not access your MIDI devices.');
}

const connectedInputs = new Map();

function onMIDISuccess(midiAccess) {
	midiAccess.onstatechange = updateDevices;

	for (let input of midiAccess.inputs.values()) {
		if (input.name === "Q Mini") {
			connectedInputs.set(input.id, input);
			input.onmidimessage = handleInput;
		}
	}
}

function updateDevices(event) {
	console.log(event.port.name)
	if (event.port.name != "Q Mini")
		return;
	if (event.port.connection == "open" && event.port.state == "connected") {
		event.port.onmidimessage = handleInput;
		const popUp = document.getElementById('midiConnection');
		popUp.classList.add('connected');
		popUp.style.top = "0px";
		popUp.innerText = "Connected to MIDI device: " + event.port.name;
		setTimeout(() => {
			popUp.style.top = "-52px";
			popUp.classList.remove('connected');
		}, 1500);
	} else if (event.port.connection == "closed" || event.port.connection == "pending") {
		event.port.onmidimessage = null;
		const popUp = document.getElementById('midiConnection');
		popUp.classList.add('disconnected');
		popUp.style.top = "0px";
		popUp.innerText = "Disconnected to MIDI device: " + event.port.name;
		setTimeout(() => {
			popUp.style.top = "-52px";
			popUp.classList.remove('disconnected');
		}, 1500);
	}
}

function handleInput(input) {

	const command = input.data[0];
	const note = input.data[1];
	const velocity = input.data[2];
	if (command >= 144 && command <= 159) {
		if(velocity > 0)
			playNote(keyToFrequency(noteToKey(note)));
		else
			noteOff(keyToFrequency(noteToKey(note)));
	} else if (command >= 128 && command <= 143) {
		noteOff(keyToFrequency(noteToKey(note)));
	}
}

function noteToKey(note) {
	return letters[0][note % (CONFIG.subdivisions)] || "";
}
