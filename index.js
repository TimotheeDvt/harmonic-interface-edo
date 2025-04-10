// Configurations
const CONFIG = {
  subdivisions: 31,
  radius: 50,
  startFreq: 440,
  endFreq: 880,
  canvasSize: 500,
  dotSize: 4,
  scaleFactor: 4,
  maxVoices: 31
};
const letters = ["AZERTYUIOPQSDFGHJKLMWXCVBN"];

const style = window.getComputedStyle(document.body)
const COLORS = {
	white: style.getPropertyValue('--white'),
	black: style.getPropertyValue('--black'),
	red: style.getPropertyValue('--red'),
	blue: style.getPropertyValue('--blue'),
	blue2: style.getPropertyValue('--blue2')
};

// State management
const state = {
  notes: [],
  audioContext: null,
  oscillators: {}, // Track active oscillators by frequency
	showFreq: true,
	showKeys: true,
	showWave: true,
	layout: "AZERTYUIOPQSDFGHJKLMWXCVBN",
	type: "sine",

};

// Audio functions
function initAudio() {
  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
}

function playNote(frequency) {
  noteOn(frequency);
}

function stopNote(frequency) {
  noteOff(frequency);
}

function stopAllNotes() {
	Object.keys(state.oscillators).forEach(frequency => noteOff(frequency));
}

function noteOn(frequency) {
  if (state.oscillators[frequency]) return; // Avoid duplicate notes

  // Kill the oldest note if we exceed maxVoices
  if (Object.keys(state.oscillators).length >= CONFIG.maxVoices) {
    const oldestFrequency = Object.keys(state.oscillators)[0]; // Get the first key (oldest)
    noteOff(oldestFrequency); // Stop the oldest note
  }

  const osc = state.audioContext.createOscillator();
  const gainNode = state.audioContext.createGain();

  osc.type = state.type || 'sine'; // Default to sine wave
  osc.frequency.value = frequency;

  // Initial volume
  gainNode.gain.setValueAtTime(0, state.audioContext.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.2, state.audioContext.currentTime + 0.05); // Attack

  osc.connect(gainNode);
  gainNode.connect(state.audioContext.destination);
  osc.start();

  state.oscillators[frequency] = { osc, gainNode }; // Store oscillator
  drawPlayingNotes();
}

function noteOff(frequency) {
  const voice = state.oscillators[frequency];
  if (voice) {
    voice.gainNode.gain.linearRampToValueAtTime(0.001, state.audioContext.currentTime + 0.1); // Release
    voice.osc.stop(state.audioContext.currentTime + 0.1);
    delete state.oscillators[frequency];
  }
  drawPlayingNotes();
}

// Calculation functions
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

// Drawing functions
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

// Main drawing function
function drawAllNotes() {
  const frequencies = calculateNoteFrequencies();
  const positions = calculateNotePositions();

  state.notes = positions.map((pos, i) => ({ ...pos, frequency: frequencies[i], index: i }));
}

function findSmallestPerfectSquare(n) {
	const sqrt = Math.sqrt(n);
	if (sqrt % 1 === 0) return sqrt;
  const nextNum = Math.floor(sqrt) + 1;
  return nextNum;
}

function fillTable() {
  const table = document.getElementById('table');
  const notes = state.notes;
  const rows = findSmallestPerfectSquare(notes.length); // Get the next perfect square
  const cols = rows;

  table.innerHTML = ''; // Clear existing table

  for (let i = 0; i < rows; i++) {
    const row = document.createElement('tr');
    for (let j = 0; j < cols; j++) {
      const index = i * cols + j;
      if (index < notes.length) {
        const cell = document.createElement('td');
        cell.innerText = `${index}`;
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

function drawWaveForms() {
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
		for (let i = 0; i < waveformWidth; i++) {
			const x = i / waveformWidth * 2 * Math.PI * frequency / 100;
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
}

function normalize(value, min, max, newMin, newMax) {
	return ((value - min) * (newMax - newMin)) / (max - min) + newMin;
}


// Event handlers
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
		letters[0] = "AZERTYUIOPQSDFGHJKLMWXCVBN";
	else if (state.layout === "QWERTY")
		letters[0] = "QWERTYUIOPASDFGHJKLZXCVBNM";
	update();
}

function handleWaveFormChange() {
	state.type = document.getElementById('changeWaveform').value;
	update();
}

// Keyboard support
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

document.addEventListener('keydown', (e) => {
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

// Initialization
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
	// document.querySelector('#StartingFreq').addEventListener('change', (e) => {
	// 	CONFIG.startFreq = e.target.value;
	// 	CONFIG.endFreq = CONFIG.startFreq * 2;
	// 	update();
	// });
	document.querySelector('#subdivNb').addEventListener('change', (e) => {
		CONFIG.subdivisions = e.target.value;
		update();
	});
	update();
}

function update() {
	calculate_key_to_index();
  drawMainCircle();
  drawAllNotes();
  fillTable();
	writeIndexes();
	drawPlayingNotes();
	if(state.showWave)
		drawWaveForms();
}

// Start application
init();
