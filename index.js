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
	scaleJustIntonation : [
		1, 16/15, 9/8, 6/5, 5/4, 4/3, 45/32, 3/2, 8/5, 5/2, 9/5, 15/8, 2
	],
	scalePythagorean : [
		1, 256/243, 9/8, 32/27, 81/64, 4/3, 1024/729, 729/512, 3/2, 128/81, 27/16, 16/9, 243/128, 2
	]
};
const letters = ["AZERTYUIOPQSDFGHJKLMWXCVBN123456789", "QWERTYUIOPASDFGHJKLZXCVBNM123456789"];
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
	layout: 0,
	type: "sine",
	time: 0,
	scale: "justIntonation"
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

function playNote(frequency) { // TODO: Add velocity
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
	if (state.scale === "justIntonation")
		return Array.from({ length: CONFIG.subdivisions }, (_, i) => {
			return CONFIG.startFreq * CONFIG.scaleJustIntonation[i];
		});
	if (state.scale === "pythagorean") {
		return Array.from({ length: CONFIG.subdivisions }, (_, i) => {
			return CONFIG.startFreq * CONFIG.scalePythagorean[i];
		});
	}
	return Array.from({ length: CONFIG.subdivisions }, (_, i) => {
		return CONFIG.startFreq * 2 ** (i / CONFIG.subdivisions);
	});
}

function calculateNotePositions(radius = CONFIG.radius) {
	// calculate position based on note frequency
	const ret = [{ x: radius*Math.cos(0), y: radius*Math.sin(0), angle: 0 }];
	for (let i = 1; i < CONFIG.subdivisions; i++) {
		const angle = ret[i-1].angle + (2*Math.PI) / CONFIG.subdivisions;
		ret.push({
			x: radius * Math.cos(angle),
			y: radius * Math.sin(angle),
			angle
		});
	}
	return ret;
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
	state.notes = frequencies.map((freq, i) => ({ frequency: freq, index: i }));
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
					key.innerText = letters[state.layout][index % (CONFIG.subdivisions)] || "";

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
	const layout = document.getElementById('changeLayout').value;
	if (layout === "AZERTY")
		state.layout = 0;
	else if (layout === "QWERTY")
		state.layout = 1;
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

function handleScaleChange() {
	const scale = document.getElementById('changeScale').value;
	state.scale = scale;
	update();
}

/********************
 * KEYBOARD SUPPORT *
 ********************/
const key_to_index = {};
function calculate_key_to_index() {
	const keys = letters[state.layout].split('');
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

document.addEventListener("click", (e) => {
	document.getElementById("toRemove").style.visibility = "hidden";
})

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
	document.querySelector('#changeScale').addEventListener('change', handleScaleChange);
	document.querySelector('#subdivNb').addEventListener('change', (e) => {
		CONFIG.subdivisions = e.target.value;
		update();
	});
	document.querySelector('#StartingFreq').addEventListener('change', (e) => {
		CONFIG.startFreq = e.target.value;
		update();
	});
	CONFIG.subdivisions = parseInt(document.querySelector('#subdivNb').value);
	state.darkMode = document.querySelector('#changeMode').checked;
	CONFIG.smallestInterval = (CONFIG.endFreq-CONFIG.startFreq) / CONFIG.subdivisions;
	update();
}

function update() {
	if (CONFIG.subdivisions == 12) {
		const select = document.getElementById('changeScale');
		state.scale = select.value;
		select.hidden = false;
	} else {
		const select = document.getElementById('changeScale');
		const option = select.querySelector(`option[value="12-EDO"]`);
		option.selected = true;
		select.hidden = true;
		state.scale = null;
	}
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

// Check if the browser supports Web MIDI API
if (navigator.requestMIDIAccess) {
  navigator.requestMIDIAccess( { sysex: true } )
    .then(onMIDISuccess, onMIDIFailure)
    .catch((error) => console.error("Error accessing MIDI devices:", error));
} else {
  console.error("Web MIDI API is not supported in this browser.");
}

// Check MIDI permissions using Permissions API
navigator.permissions.query({ name: "midi", sysex: true }).then((result) => {
  if (result.state === "granted") {
    navigator.requestMIDIAccess().then(onMIDISuccess, onMIDIFailure);
  } else if (result.state === "prompt") {
    console.warn("MIDI access requires user permission.");
  } else {
    console.error("MIDI access denied.");
  }
});

// Handle failure to access MIDI devices
function onMIDIFailure(error) {
  console.error("Failed to get MIDI access:", error);
}

// Map to store connected MIDI inputs
const connectedInputs = new Map();

// Handle successful access to MIDI devices
function onMIDISuccess(midiAccess) {
  // console.log("MIDI Access Object:", midiAccess);

  // List all available MIDI inputs and outputs
  listInputsAndOutputs(midiAccess);

  // Listen for device connection/disconnection events
  midiAccess.onstatechange = updateDevices;

  // Set up message handlers for specific inputs
  for (const input of midiAccess.inputs.values()) {
		input.onmidimessage = handleInput;
  }
}

const isShowed = new Map();

// List all available MIDI inputs and outputs
function listInputsAndOutputs(midiAccess) {
  const select = document.getElementById('midiControl');
  for (const [id, input] of midiAccess.inputs) {
		if (isShowed.has(id))
			continue;
		isShowed.set(id, true);
		let selected;
		select.innerHTML += `<option value="${id}" ${selected}>${input.name}</option>`;
    console.log(`Input: [ID: ${id}] Name: ${input.name}`);
  }

  for (const [id, output] of midiAccess.outputs) {
    console.log(`Output: [ID: ${id}] Name: ${output.name}`);
  }
}

// Handle device connection or disconnection events
function updateDevices(event) {
  const port = event.port;
  const timestamp = new Date().toLocaleTimeString();
  const select = document.getElementById('midiControl');
  if (port.name !== select.value) return;

  const popUp = document.getElementById('midiConnection');
  if (port.connection == "open" || port.state == "connected" && !connectedInputs.has(port.id)) {
		connectedInputs.set(port.id, [port, timestamp]);
    port.onmidimessage = handleInput;
    showPopUp(popUp, `Connected to MIDI device: ${port.name}`, 'connected');
  } else if (port.connection == "closed" && connectedInputs.has(port.id)) {
		if (connectedInputs.get(port.id)[1] == timestamp) return;
		connectedInputs.delete(port.id);
    port.onmidimessage = null;
    showPopUp(popUp, `Disconnected from MIDI device: ${port.name}`, 'disconnected');
  } else if (port.connection == "pending"){
		console.warn(`Pending connection: ${event}`);
    showPopUp(popUp, `Pending from MIDI device: ${port.name}`, 'pending');
	}
}


// Display connection status in a pop-up element
function showPopUp(element, message, statusClass) {
  element.classList.add(statusClass);
  element.style.top = "0px";
  element.innerText = message;

  setTimeout(() => {
    element.style.top = "-100px";
    element.classList.remove(statusClass);
  }, 1500);
}

// Handle incoming MIDI messages
function handleInput(event) {
  const [command, note, velocity] = event.data;
	console.log(note)

	const freq = noteToFreq(note);
	if (freq == null) return;
  if (command >= 144 && command <= 159) { // Note On event
    if (velocity > 0) playNote(freq);
    else noteOff(freq); // Note Off with velocity zero
  } else if (command >= 128 && command <= 143) { // Note Off event
    noteOff(freq);
  }
}

// Convert a MIDI note to a key name
function noteToFreq(note) {
	const key = note - 57;
	if (key < 0) return null;
  return keyToFrequency(letters[state.layout][key % CONFIG.subdivisions] || "");
}


const scale = [
	1, 15/16, 8/9, 5/6, 4/5, 3/4, 32/45, 2/3, 5/8, 3/5, 5/9, 8/15, 1/2
]