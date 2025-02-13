import { 
	supabase,
	saveSession,
	getTasks,
	updateTask,
	deleteTask,
	createTask,
	getTaskByName,
	getSessionsAfter,
	bulkSaveSessions,
	updateTimerState,
	getTimerState,
	subscribeToTimerState,
	startSession,
	endSession,
	saveTasks,
} from './supabase-client.js'
import { createAuthUI } from './auth-ui.js'
import './loading-indicator.css'
import { config } from './config.js'

// Unregister service worker
if ('serviceWorker' in navigator) {
	navigator.serviceWorker.getRegistrations().then(function(registrations) {
		for(let registration of registrations) {
			registration.unregister()
		}
	})
}

let timerWorker = new Worker(new URL('./worker.js', import.meta.url), {
	type: 'module'
});

let root = document.documentElement;

let mainel = document.getElementById("main");
let statisticsDiv = document.getElementById("statistics");
let menu = document.getElementById("menu");
let manageTasks = document.getElementById("managetasks");

let timediv = document.getElementById("time");
let timer = document.getElementById("timer");
let roundnoDiv = document.getElementById("roundno");
let pauseplaybtn = document.getElementById("pauseplay");
let progress = document.getElementById("progress");

let nextbtn = document.getElementById("next");
let menubtn = document.getElementById("menubtn");
let taskSelect = document.getElementById("task-select");

let volumeContainer = document.getElementById("slider-container");
let volumeSlider = document.getElementById("volume-slider");
let volumeValue = document.getElementById("volume-value");

// Session pattern management
let currentSession = null;

// Initialize session dialog
const newsessionDialog = document.getElementById('newsession');
const patternBtns = document.querySelectorAll('.pattern-btn');
const customPatternInput = document.querySelector('.custom-pattern-input');
const patternInput = document.getElementById('pattern-input');
const sessionGoals = document.getElementById('session-goals');

// Show dialog when new session button is clicked
document.getElementById('newsessionbtn').addEventListener('click', () => {
    newsessionDialog.showModal();
});

// Handle pattern button selection
patternBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        if (btn.classList.contains('custom-pattern')) {
            customPatternInput.style.display = 'block';
            patternBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
        } else {
            customPatternInput.style.display = 'none';
            patternBtns.forEach(b => b.classList.remove('selected'));
            btn.classList.add('selected');
            patternInput.value = btn.dataset.pattern;
        }
    });
});

// Handle dialog buttons
document.getElementById('cancel-session').addEventListener('click', () => {
    newsessionDialog.close();
    resetSessionDialog();
});

document.getElementById('start-session').addEventListener('click', () => {
    const pattern = patternInput.value;
    if (!validatePattern(pattern)) {
        alert('Invalid pattern format. Please use numbers separated by hyphens (e.g., 25-5-25-15)');
        return;
    }
    
    const goals = sessionGoals.value.trim();
    if (!goals) {
        alert('Please enter session goals');
        return;
    }
    
    startNewSession(pattern, goals);
    newsessionDialog.close();
    resetSessionDialog();
});

function validatePattern(pattern) {
    // Pattern should be numbers separated by hyphens
    const regex = /^\d+(-\d+)*$/;
    if (!regex.test(pattern)) return false;
    
    // Should have at least one focus period
    const numbers = pattern.split('-').map(Number);
    return numbers.length >= 1 && numbers.every(n => n > 0 && n <= 180);
}

function startNewSession(pattern, goals) {
    // Clean up existing session if any
    if (currentSession) {
        // End current session if one is in progress
        if (roundInfo.currentSessionId) {
            endSession(roundInfo.currentSessionId, roundInfo.t);
            roundInfo.currentSessionId = null;
        }
        // Remove existing session display
        const existingDisplay = document.querySelector('.current-session');
        if (existingDisplay) {
            existingDisplay.remove();
        }
    }

    const rounds = pattern.split('-').map(Number);
    currentSession = {
        pattern,
        goals,
        rounds,
        currentRoundIndex: 0
    };
    
    // Reset timer state
    roundInfo.t = 0;
    roundInfo.running = false;
    roundInfo.pattern = pattern;  // Store pattern
    roundInfo.patternPosition = 0;  // Reset position
    
    // Set initial duration from first round
    const initialDuration = rounds[0] * 60;
    roundInfo.current = 'focus';
    roundInfo.remaining = initialDuration;
    config[roundInfo.current] = initialDuration;
    
    // Update round display
    const totalRounds = Math.ceil(rounds.length / 2);  // Count focus periods
    roundnoDiv.innerText = `1/${totalRounds}`;  // Start at first round
    
    // Update UI
    timer.className = "t-" + roundInfo.current;
    setTime();
    
    // Create session display
    showCurrentSession();
}

function startNextRound() {
    if (!currentSession) return;
    
    const { rounds, currentRoundIndex } = currentSession;
    if (currentRoundIndex >= rounds.length) {
        // Session complete
        alert('Session complete!');
        currentSession = null;
        roundInfo.pattern = null;
        roundInfo.patternPosition = 0;
        const display = document.querySelector('.current-session');
        if (display) display.remove();
        return;
    }
    
    const duration = rounds[currentRoundIndex] * 60; // Convert minutes to seconds
    const isBreak = currentRoundIndex % 2 === 1;
    
    // Update timer state
    roundInfo.current = isBreak ? 'short' : 'focus';
    roundInfo.t = 0;
    roundInfo.remaining = duration;
    config[roundInfo.current] = duration; // Set the duration for this round
    
    // Update round display if this is a focus period
    if (!isBreak) {
        const totalRounds = Math.ceil(rounds.length / 2);  // Count focus periods
        const currentRound = Math.floor(currentRoundIndex / 2) + 1;  // Calculate current focus round
        roundnoDiv.innerText = `${currentRound}/${totalRounds}`;
    }
    
    // Update UI
    timer.className = "t-" + roundInfo.current;
    setTime();
    
    // Start timer if it was running
    if (roundInfo.running) {
        timerWorker.postMessage({
            type: "start",
            maxDuration: duration,
        });
    }
    
    // Start new session if this is a focus round
    if (!isBreak && selectedTask) {
        getTaskByName(selectedTask).then(task => {
            if (task) {
                startSession(task.id, duration).then(({ data }) => {
                    if (data) roundInfo.currentSessionId = data.id;
                });
            }
        });
    }
    
    // Increment round index
    currentSession.currentRoundIndex++;
    roundInfo.patternPosition = currentRoundIndex;
}

function showCurrentSession() {
    // Remove existing session display if any
    const existingDisplay = document.querySelector('.current-session');
    if (existingDisplay) {
        existingDisplay.remove();
    }
    
    // Create new session display
    const display = document.createElement('div');
    display.className = 'current-session';
    display.innerHTML = `
        <h3>Current Session</h3>
        <div class="session-pattern">${currentSession.pattern}</div>
        <div class="session-goals-display">${currentSession.goals}</div>
    `;
    
    document.body.appendChild(display);
}

function resetSessionDialog() {
    patternBtns.forEach(btn => btn.classList.remove('selected'));
    customPatternInput.style.display = 'none';
    patternInput.value = '';
    sessionGoals.value = '';
}

// Replace the existing nextRound function
const originalNextRound = nextRound;
nextRound = function() {
    if (currentSession) {
        startNextRound();
    } else {
        originalNextRound.call(this);
    }
};

let pipActive = false;

const fullname = {
	focus: "Focus",
	short: "Short Break",
	long: "Long Break",
};

let viewState = "timer";

let audioType = "";

let volume = 80;

const audioTypes = ["noise"];

let roundInfo = {
	t: 0,
	focusNum: 1,
	current: "focus",
	running: false,
	remaining: config.focus,  // Initialize with focus duration
	currentSessionId: null,
	pattern: null,  // Add pattern tracking
	patternPosition: 0  // Add position tracking
};

let isSyncing = false;

let isOnline = navigator.onLine

function updateRootFontSize() {
    const vmin = Math.min(window.innerWidth, window.innerHeight) / 100;
    const fontSize = Math.min(vmin * 3, 20); // Cap at 20px while maintaining responsive scaling
    document.documentElement.style.fontSize = `${fontSize}px`;
}

// Call on initial load
updateRootFontSize();

// Add resize listener
window.addEventListener('resize', updateRootFontSize);

window.addEventListener('online', () => {
	isOnline = true
	// Sync when coming back online
	if (supabase.auth.session()) {
			syncFromSupabase()
			syncSessions()
	}
})

window.addEventListener('offline', () => {
	isOnline = false
})

//#region Time

function setTime() {
	let seconds = config[roundInfo.current] - roundInfo.t;
	if (seconds < 0) {
		nextRound();
		return;
	}
	let timestr =
		Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0") +
		":" +
		(seconds % 60).toString().padStart(2, "0");
	timediv.innerText = timestr;
	document.title = `${timestr} ${fullname[roundInfo.current]} - Gomodoro`;
	
	// Update progress ring (100 to 0 scale)
	const progressPercent = (roundInfo.t / config[roundInfo.current]) * 100;
	progress.style.strokeDashoffset = progressPercent;
	
	if (pipActive) loop();
}

timerWorker.addEventListener("message", (e) => {
	roundInfo.t = e.data.t;
	roundInfo.running = e.data.running;
	setTime();
	
	// Update UI state
	if (roundInfo.running) {
		pauseplaybtn.title = "Pause Timer";
		pauseplaybtn.className = "playing";
	} else {
		pauseplaybtn.title = "Start Timer";
		pauseplaybtn.className = "paused";
	}
	
	if (e.data.t % 5 === 0) { // Sync every 5 seconds to reduce updates
		syncTimerState();
	}
	
	// Only advance to next round if timer completed naturally (reached maxDuration)
	if (!e.data.running && e.data.t >= e.data.maxDuration) {
		timer.style.setProperty("--progress", "0");
		nextRound();
	}
});

//#endregion

//#region Timer Actions

// Create notes dialog once at startup
const notesDialog = document.createElement('dialog')
notesDialog.className = 'notes-dialog'
notesDialog.innerHTML = `
	<form method="dialog">
		<h2>Session Complete</h2>
		<p>What did you accomplish?</p>
		<textarea id="session-notes" 
			placeholder="e.g., Finished first draft of proposal, researched key points..."
			rows="4"></textarea>
		<div class="dialog-buttons">
			<button type="submit" value="skip">Skip</button>
			<button type="submit" value="save" class="primary">Save Notes</button>
		</div>
	</form>
`
document.body.appendChild(notesDialog)

// Handle notes submission
notesDialog.addEventListener('close', () => {
	if (notesDialog.returnValue === 'save') {
		const notes = document.getElementById('session-notes').value
		if (roundInfo.currentSessionId && notes) {
			endSession(roundInfo.currentSessionId, roundInfo.t, notes)
		}
	} else if (roundInfo.currentSessionId) {
		endSession(roundInfo.currentSessionId, roundInfo.t)
	}
	document.getElementById('session-notes').value = ''
	roundInfo.currentSessionId = null
})

function nextRound() {
	let finished = fullname[roundInfo.current];
	let body = "Begin ";
	if (roundInfo.current === "focus") {
		if (audioType === "noise") {
			fadeOut();
		}
		// End current session if one exists
		if (roundInfo.currentSessionId) {
			// If they didn't complete most of the session, delete it
			if (roundInfo.t < config[roundInfo.current] * 0.75) {
				endSession(roundInfo.currentSessionId, roundInfo.t)
			} else {
				notesDialog.showModal()
			}
		}
		focusEnd(roundInfo.t);
		finished += " Round";
		if (roundInfo.focusNum >= config.longGap) {
			roundInfo.current = "long";
			roundInfo.focusNum = 0;
		} else {
			roundInfo.current = "short";
		}
		body += "a " + Math.floor(config[roundInfo.current] / 60) + " minute " + fullname[roundInfo.current];
	} else {
		roundInfo.current = "focus";
		roundInfo.focusNum++;
		roundnoDiv.innerText = roundInfo.focusNum + "/" + config.longGap;
		body += "focusing for " + Math.floor(config.focus / 60) + " minutes";
	}

	timer.className = "t-" + roundInfo.current;
	roundInfo.t = 0;
	roundInfo.remaining = 0;
	setTime();
	syncTimerState();
	if (roundInfo.running) {
		if (roundInfo.current === "focus" && audioType === "noise") {
			fadeIn();
		}
		// Start new session if starting a focus round
		if (roundInfo.current === 'focus' && selectedTask) {
			getTaskByName(selectedTask).then(task => {
				if (task) {
					startSession(task.id, config.focus).then(({ data }) => {
						if (data) roundInfo.currentSessionId = data.id
					})
				}
			})
		}
		timerWorker.postMessage({
			type: "start",
			maxDuration: config[roundInfo.current],
		});
	}
	notify(`${finished} Complete`, body);
}

function pauseplay() {
	if (roundInfo.current === "none") {
		nextRound();
		return;
	}

	if (roundInfo.running) {
		// Pausing
		if (roundInfo.current === "focus" && audioType === "noise") {
			fadeOut();
		}
		timerWorker.postMessage({ type: "stop" });
		roundInfo.running = false;
		roundInfo.remaining = config[roundInfo.current] - roundInfo.t;
		pauseplaybtn.title = "Start Timer";
		pauseplaybtn.className = "paused";
		// End session if one is in progress
		if (roundInfo.currentSessionId) {
			focusEnd(roundInfo.t);
		}
	} else {
		// Resuming or starting
		if (roundInfo.current === "focus" && audioType === "noise") {
			fadeIn();
		}
		roundInfo.running = true;
		pauseplaybtn.title = "Pause Timer";
		pauseplaybtn.className = "playing";
		
		// Calculate correct time position based on remaining time
		if (roundInfo.remaining > 0) {
			roundInfo.t = config[roundInfo.current] - roundInfo.remaining;
			roundInfo.remaining = 0;  // Reset remaining after using it
		}
		
		// Start new session if this is a focus round AND we're starting fresh
		if (roundInfo.current === 'focus' && selectedTask && roundInfo.t === 0) {
			getTaskByName(selectedTask).then(async task => {
				if (task) {
					try {
						const { data } = await startSession(task.id, config.focus);
						if (data) roundInfo.currentSessionId = data.id;
					} catch (error) {
						console.error('Error starting session:', error);
					}
				}
			});
		}
		
		// Start the timer with correct duration and position
		timerWorker.postMessage({
			type: "start",
			t: roundInfo.t,
			maxDuration: config[roundInfo.current]
		});
	}
	syncTimerState();
}

pauseplaybtn.addEventListener("click", pauseplay);

nextbtn.addEventListener("click", () => {
	nextRound();
});

document.getElementById("resetround").addEventListener("click", () => {
	// Stop the timer if it's running
	if (roundInfo.running) {
		timerWorker.postMessage({ type: "stop" });
		roundInfo.running = false;
		pauseplaybtn.title = "Start Timer";
		pauseplaybtn.className = "paused";
		// End session if one is in progress
		if (roundInfo.currentSessionId) {
			focusEnd(roundInfo.t);
		}
	}
	
	// Reset timer state
	roundInfo.t = 0;
	roundInfo.remaining = config[roundInfo.current];
	
	// Update UI
	setTime();
	progress.style.strokeDashoffset = 100; // Reset to start position
	
	// Sync state
	syncTimerState();
});

document.addEventListener("keydown", (event) => {
	if (event.isComposing || event.keyCode === 229) {
		return;
	}
	if (event.code === "Space") {
		if (document.activeElement === pauseplaybtn || viewState !== "timer") {
			return;
		}
		pauseplaybtn.focus();
		pauseplay();
	}
});

//#endregion

//#region Notifications

let notificationEnabled = true;
let notificationSilent = false;
let notification;
let notifSelect = document.getElementById("notif-select");

function setNotif(pomoNotif) {
	if (pomoNotif === "disabled") {
		notificationEnabled = false;
	} else if (pomoNotif === "silent") {
		notificationEnabled = true;
		notificationSilent = true;
	} else {
		notificationEnabled = true;
		notificationSilent = false;
	}

	notifSelect.value = pomoNotif;
}

if (localStorage.getItem("pomo-notif")) {
	setNotif(localStorage.getItem("pomo-notif"));
}

notifSelect.addEventListener("change", function () {
	setNotif(this.value);
	localStorage.setItem("pomo-notif", this.value);
});

function notify(title, message) {
	if (!notificationEnabled) return;
	if (!("Notification" in window)) {
		return;
	} else if (Notification.permission === "granted") {
		if (notification) notification.close();
		notification = new Notification(title, {
			body: message,
			icon: "./icons/icon192.png",
			silent: notificationSilent,
		});
	} else if (Notification.permission !== "denied") {
		Notification.requestPermission().then(function (permission) {
			if (permission === "granted") {
				notification = new Notification(title, {
					body: message,
					icon: "./icons/icon192.png",
					silent: notificationSilent,
				});
			}
		});
	}
}

function setup() {
	if ("Notification" in window) {
		if (Notification.permission !== "denied" && Notification.permission !== "granted") {
			Notification.requestPermission();
		}
	}

	setTime();
	roundnoDiv.innerText = roundInfo.focusNum + "/" + config.longGap;
}

setup();

//#endregion

//#region Audio

function volumeSliderDisplay() {
	if (audioType === "noise") {
		volumeContainer.classList.remove("disabled");
	} else {
		volumeContainer.classList.add("disabled");
	}
	volumeValue.textContent = volume;
	volumeSlider.value = volume;
}

let audioSelect = document.getElementById("audio-select");
if (localStorage.getItem("pomo-audio-type")) {
	let audioTypeL = localStorage.getItem("pomo-audio-type");
	if (audioTypes.includes(audioTypeL)) {
		audioType = audioTypeL;
		audioSelect.value = audioType;
	}
} else {
	audioSelect.value = "disabled";
}

if (localStorage.getItem("pomo-audio-volume")) {
	volume = parseFloat(localStorage.getItem("pomo-audio-volume")) || 80;
}

volumeSliderDisplay();

let audioCtx;
let noiseSource;
let gain;
let noiseTimeout;

let isWhiteNoiseRunning = false;
let isFadingOut = false;

audioSelect.addEventListener("change", () => {
	audioType = audioSelect.value;
	if (audioType !== "noise" && isWhiteNoiseRunning) {
		fadeOut();
	} else if (roundInfo.running) {
		if (roundInfo.current === "focus" && audioType === "noise") {
			fadeIn();
		}
	}
	volumeSliderDisplay(audioType);
	localStorage.setItem("pomo-audio-type", audioType);
});

function initNoise() {
	if (!audioCtx) {
		audioCtx = new AudioContext();
	}
	const bufferSize = audioCtx.sampleRate * 3;
	const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
	let data = buffer.getChannelData(0);

	for (let i = 0; i < bufferSize; i++) {
		data[i] = Math.random() * 2 - 1;
	}

	noiseSource = audioCtx.createBufferSource();
	noiseSource.buffer = buffer;

	gain = audioCtx.createGain();
	gain.gain = volume / 100;

	noiseSource.connect(gain);
	gain.connect(audioCtx.destination);
}

volumeSlider.addEventListener("input", () => {
	volume = parseFloat(volumeSlider.value);
	volumeValue.textContent = volume;
	if (volume === 0) {
		volumeContainer.classList.add("muted");
	} else {
		volumeContainer.classList.remove("muted");
	}
	if (gain) gain.gain.linearRampToValueAtTime(volume / 100, audioCtx.currentTime);
	localStorage.setItem("pomo-audio-volume", volume);
});

function playNoise() {
	noiseSource.loop = true;
	noiseSource.start();
	isWhiteNoiseRunning = true;
}

function stopNoise() {
	noiseSource.stop();
	isWhiteNoiseRunning = false;
	isFadingOut = false;
}

function fadeOut() {
	if (!isWhiteNoiseRunning) return;
	isFadingOut = true;
	gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1);
	noiseTimeout = setTimeout(stopNoise, 1000);
}

function fadeIn() {
	clearTimeout(noiseTimeout);
	if (!isFadingOut) {
		initNoise();
		gain.gain.setValueAtTime(0, audioCtx.currentTime);
		gain.gain.linearRampToValueAtTime(volume / 100, audioCtx.currentTime + 1);
		playNoise(0);
	} else {
		gain.gain.setValueAtTime(gain.gain.value, audioCtx.currentTime);
		gain.gain.linearRampToValueAtTime(volume / 100, audioCtx.currentTime + 1);
	}
}

//#endregion

//#region Current View

const animations = {
	out: [
		{ opacity: "1", transform: "translateY(0)" },
		{
			opacity: "0",
			transform: "translateY(50px)",
		},
	],
	in: [
		{
			opacity: "0",
			transform: "translateY(50px)",
		},
		{ opacity: "1", transform: "translateY(0)" },
	],
	animoptions: {
		duration: 200,
		fill: "forwards",
	},
};

let lastanim;

menubtn.addEventListener("click", () => {
	if (lastanim) lastanim.cancel();
	if (viewState === "menu") {
		mainel.style.display = "flex";
		lastanim = menu.animate(animations.out, animations.animoptions);
		lastanim.onfinish = () => {
			menu.style.display = "none";
		};
		menubtn.title = "Open Settings";
		viewState = "timer";
	} else {
		if (viewState !== "timer") return;
		menu.style.display = "flex";
		menu.scroll({ top: 0 });
		lastanim = menu.animate(animations.in, animations.animoptions);
		lastanim.onfinish = () => (mainel.style.display = "none");
		menubtn.title = "Close Settings";
		viewState = "menu";
	}
});

document.getElementById("managetaskbtn").addEventListener("click", function () {
	if (lastanim) lastanim.cancel();
	if (viewState !== "timer") return;
	manageTasks.style.display = "flex";
	manageTasks.scroll({ top: 0 });
	lastanim = manageTasks.animate(animations.in, animations.animoptions);
	lastanim.onfinish = () => (mainel.style.display = "none");
	viewState = "tasks";
});

document.getElementById("closetasks").addEventListener("click", function () {
	if (lastanim) lastanim.cancel();
	if (viewState === "tasks") {
		mainel.style.display = "flex";
		lastanim = manageTasks.animate(animations.out, animations.animoptions);
		lastanim.onfinish = () => {
			manageTasks.style.display = "none";
		};
		viewState = "timer";
	}
});

document.getElementById("statbtn").addEventListener("click", function () {
	if (lastanim) lastanim.cancel();
	if (viewState !== "timer") return;
	statisticsDiv.style.display = "flex";
	statisticsDiv.scroll({ top: 0 });
	lastanim = statisticsDiv.animate(animations.in, animations.animoptions);
	lastanim.onfinish = () => (mainel.style.display = "none");
	viewState = "statistics";
	loadStatistics();
});

document.getElementById("closestats").addEventListener("click", function () {
	if (lastanim) lastanim.cancel();
	if (viewState === "statistics") {
		mainel.style.display = "flex";
		lastanim = statisticsDiv.animate(animations.out, animations.animoptions);
		lastanim.onfinish = () => {
			statisticsDiv.style.display = "none";
		};
		viewState = "timer";
	}
});

//#endregion

//#region Statistics

let tasks = ["Default Task"];

let selectedTask = "Default Task";

let taskContainer = document.getElementById("task-container");
let filterContainer = document.getElementById("filters");
let filteredTasks = new Set();

let statTimeSelect = document.getElementById("stat-time-select");

let hourlyNames = ["0-6", "6-12", "12-18", "18-24"];
let hourlyFullNames = ["00:00 - 00:06", "06:00 - 12:00", "12:00 - 18:00", "18:00 - 24:00"];

let dayNames = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

let monthNames = [
	"january",
	"february",
	"march",
	"april",
	"may",
	"june",
	"july",
	"august",
	"september",
	"october",
	"november",
	"december",
];

async function loadTasks() {
	navigator.storage.persist();
	
	// Get tasks from Supabase if user is logged in
	try {
		const { data: { user } } = await supabase.auth.getUser();
		if (user) {
			const { data: remoteTasks } = await getTasks();
			tasks = remoteTasks?.map(task => task.name) || [];
		} else {
			tasks = [];
		}
	} catch (error) {
		console.error('Error loading tasks:', error);
		tasks = [];
	}

	// Clear existing tasks UI
	taskSelect.innerHTML = "";
	taskContainer.innerHTML = "";
	filterContainer.innerHTML = "";
	noTaskManager();
	tasks.forEach((task) => createTaskEl(task));

	// Initialize selected task with first available task
	if (tasks.length > 0) {
		// Get existing timer state first
		const { data: existingState } = await getTimerState();
		if (existingState) {
			// Use existing state
			selectedTask = existingState.selected_task;
			if (!tasks.includes(selectedTask)) {
				selectedTask = tasks[0]; // Fallback if selected task was deleted
			}
			// Initialize roundInfo from cloud state
			roundInfo.current = existingState.current;
			roundInfo.t = existingState.time;
			roundInfo.running = existingState.running;
			roundInfo.focusNum = existingState.focus_num;
			roundInfo.remaining = existingState.remaining_time;
			
			// Update UI
			roundnoDiv.innerText = roundInfo.focusNum + "/" + config.longGap;
			timer.className = "t-" + roundInfo.current;
			setTime();

			// Start worker if timer was running
			if (existingState.running) {
				timerWorker.postMessage({
					type: "start",
					t: existingState.time,
					maxDuration: config[existingState.current],
				});
			}
		} else {
			// No existing state, initialize with first task
			selectedTask = tasks[0];
		}
		taskSelect.value = selectedTask;
	}

	if (localStorage.getItem("pomo-records")) {
		let records = JSON.parse(localStorage.getItem("pomo-records"));
		records.forEach((r) => saveRecord(r));
		localStorage.removeItem("pomo-records");
	}

	if (localStorage.getItem("pomo-stat-period")) {
		statTimeSelect.value = localStorage.getItem("pomo-stat-period");
	}

	return Promise.resolve();
}

async function getRecords() {
    try {
        const { data: sessions } = await supabase
            .from('daily_sessions')
            .select(`
                *,
                task:tasks(name)
            `)
            .order('start_time', { ascending: false });

        if (!sessions) return [];

        // Filter out invalid records and ensure proper task mapping
        return sessions
            .filter(session => 
                session.actual_duration > 0 && // Only include sessions with actual duration
                session.task?.name && // Must have a valid task name
                session.start_time // Must have a start time
            )
            .map(session => ({
                t: Math.max(0, Math.round(session.actual_duration / 60)), // Convert to minutes and ensure non-negative
                d: new Date(session.start_time).getTime(),
                n: session.task?.name || 'Unknown Task',
                notes: session.notes || ''
            }));
    } catch (error) {
        console.error('Error getting records:', error);
        return [];
    }
}

// Helper function to format time
function hmstr(t) {
    if (!t || t < 0) return '00:00';
    let h = Math.floor(t / 60);
    let m = Math.floor(t % 60);
    return h.toString().padStart(2, "0") + ":" + m.toString().padStart(2, "0");
}

function hmstrFull(t) {
    if (!t || t < 0) t = 0;
    let r = hmstr(t)
        .split(":")
        .map((i) => parseInt(i));
    if (r[0] === 0) return r[1] + " Minutes";
    if (r[1] === 0) return r[0] + " Hour" + (r[0] === 1 ? "" : "s");
    return r[0] + " Hour" + (r[0] > 1 ? "s" : "") + " & " + r[1] + " Minute" + (r[1] > 1 ? "s" : "");
}

async function focusEnd(t) {
	if (!roundInfo.currentSessionId) return;
	
	try {
		await endSession(roundInfo.currentSessionId, t);
	} catch (error) {
		console.error('Error ending session:', error);
		// Store failed session end in local storage to retry later
		const failedSessions = JSON.parse(localStorage.getItem('failed_session_ends') || '[]');
		failedSessions.push({
			id: roundInfo.currentSessionId,
			duration: t,
			timestamp: Date.now()
		});
		localStorage.setItem('failed_session_ends', JSON.stringify(failedSessions));
	}
	
	roundInfo.currentSessionId = null;
}

// Add retry mechanism for failed session ends
async function retryFailedSessionEnds() {
	if (!isOnline) return;
	
	const failedSessions = JSON.parse(localStorage.getItem('failed_session_ends') || '[]');
	if (failedSessions.length === 0) return;
	
	const newFailedSessions = [];
	
	for (const session of failedSessions) {
		try {
			await endSession(session.id, session.duration);
		} catch (error) {
			console.error('Error retrying session end:', error);
			// Only keep retrying sessions that failed in the last 24 hours
			if (Date.now() - session.timestamp < 24 * 60 * 60 * 1000) {
				newFailedSessions.push(session);
			}
		}
	}
	
	localStorage.setItem('failed_session_ends', JSON.stringify(newFailedSessions));
}

// Add retry attempts when coming back online
window.addEventListener('online', retryFailedSessionEnds);

let allCheckbox = document.getElementById("all");
let pieCardContainer = document.getElementById("pie-card-container");
let timeSpentChart = document.getElementById("timespent");
let timeSixHourlyChart = document.getElementById("timesixhourly");
let timeDailyChart = document.getElementById("timedaily");
let timeMonthlyChart = document.getElementById("timemonthly");
let timeYearlyChart = document.getElementById("timeyearly");
statTimeSelect.addEventListener("change", () => {
	localStorage.setItem("pomo-stat-period", statTimeSelect.value);
	loadStatistics();
});

let taskBars = {};
let pieCards = {};

function createTaskEl(task) {
	const taskEl = document.createElement("div");
	taskEl.className = "task";
	taskEl.innerHTML = `
		<div class="task-name">${task}</div>
		<button class="task-delete-btn" title="Delete Task">
			<span class="material-icons-round">delete</span>
		</button>
	`;
	
	filteredTasks.add(task);
	let op = document.createElement("option");
	op.value = op.innerText = task;
	taskSelect.appendChild(op);

	let tel = document.createElement("div");
	tel.className = "task";
	let tname = document.createElement("div");
	tname.className = "task-name";
	tname.innerText = task;
	tel.appendChild(tname);

	let chip = document.createElement("label");
	chip.className = "task-chip";
	let chipCheckbox = document.createElement("input");
	chipCheckbox.className = "task-checkbox";
	chipCheckbox.type = "checkbox";
	chipCheckbox.defaultChecked = true;
	let namespan = document.createElement("span");
	namespan.className = "chip-task-name";
	namespan.innerText = task;

	chip.append(chipCheckbox, namespan);
	filterContainer.appendChild(chip);

	// Only track pie cards now, removed taskBars
	pieCards[task] = null;

	chipCheckbox.addEventListener("change", function () {
		if (this.checked) {
			filteredTasks.add(task);
			if (filteredTasks.size === tasks.length) allCheckbox.checked = true;
		} else {
			filteredTasks.delete(task);
			if (pieCards[task]) {
				pieCards[task].remove();
				pieCards[task] = null;
			}
			if (filteredTasks.size < tasks.length) allCheckbox.checked = false;
		}
		loadStatistics();
	});

	let tdel = document.createElement("button");
	tdel.className = "task-delete-btn crossbtn";
	tdel.title = "Delete this task";
	tdel.addEventListener("click", async () => {
		let p = confirm(
			'Are you sure you want to delete the task "' +
				task +
				'"? All the data related to this task will be deleted.'
		);
		if (!p) return;
		
		try {
			// Delete from Supabase if user is authenticated
			const { data: { user } } = await supabase.auth.getUser()
			if (user) {
				const { data: taskData } = await getTaskByName(task)
				if (taskData) {
					const { error } = await deleteTask(taskData.id)
					if (error) throw error
				}
			}

			// Update local UI
			tasks.splice(tasks.indexOf(task), 1);
			op.remove();
			tel.remove();
			chip.remove();
			filteredTasks.delete(task);
			if (filteredTasks.size === 0) {
				allCheckbox.checked = false;
			}
			if (filteredTasks.size === tasks.length) {
				allCheckbox.checked = true;
			}
			if (pieCards[task]) {
				pieCards[task].remove();
				pieCards[task] = null;
			}
			if (selectedTask === task) {
				if (tasks.length > 0) {
					selectedTask = tasks[0];
					taskSelect.value = selectedTask;
				}
			}
			noTaskManager();
		} catch (error) {
			console.error('Error deleting task:', error)
			alert('Failed to delete task')
		}
	});
	tel.appendChild(tdel);

	taskContainer.appendChild(tel);
}

let noTaskTitle = document.getElementById("no-task-title");

function noTaskManager() {
    // Hide task select by default
    taskSelect.style.display = "none";
    
    // Check if user is logged in
    supabase.auth.getUser().then(({ data: { user } }) => {
        if (!user) {
            // Not logged in - hide task management UI
            manageTasks.style.display = "none";
            mainel.style.display = "flex";
            return;
        }
        
        // User is logged in - handle task UI visibility
        if (tasks.length === 0) {
            mainel.style.display = "none";
            manageTasks.style.display = "flex";
            viewState = "tasks";
            
            // Show message if no tasks exist
            const noTasksMessage = document.querySelector('.content h2 + br + div');
            if (noTasksMessage) {
                noTasksMessage.textContent = "Please create your first task to get started with the timer.";
            }
        } else {
            taskSelect.style.display = "initial";
            if (viewState === "timer") {
                mainel.style.display = "flex";
                manageTasks.style.display = "none";
            }
        }
    });
}

async function taskInit() {
	await loadTasks();
	taskSelect.innerHTML = "";
	noTaskManager();
	tasks.forEach((task) => createTaskEl(task));
	allCheckbox.addEventListener("change", function () {
		if (this.checked) {
			document.querySelectorAll(".task-checkbox").forEach((el) => (el.checked = true));
			tasks.forEach((task) => {
				filteredTasks.add(task);
			});
		} else {
			document.querySelectorAll(".task-checkbox").forEach((el) => (el.checked = false));
			tasks.forEach((task) => {
				filteredTasks.delete(task);
			});
		}
		loadStatistics();
	});
}

taskInit();

document.getElementById("newtask").addEventListener("submit", async function (ev) {
	ev.preventDefault();
	let formdata = new FormData(this);
	let tname = formdata.get("taskname").trim();
	if (tname === "") {
		alert("Please Enter a Valid Name!");
		this.reset();
		return;
	}

	try {
		// Save to Supabase if user is authenticated and online
		const { data: { user } } = await supabase.auth.getUser()
		if (user && isOnline) {
			const { data, error } = await createTask(tname)
			if (error) {
				if (error.code === '23505') { // Unique violation
					alert("Task already exists!");
					return;
				}
				throw error;
			}
			// Add to local tasks if created successfully
			tasks.push(tname);
			createTaskEl(tname);
			if (!tasks.includes(selectedTask)) {
				selectedTask = tname;
				taskSelect.value = tname;
			}
			noTaskManager();
			this.reset();

			// If this was the first task, show the timer
			if (tasks.length === 1) {
				viewState = "timer";
				mainel.style.display = "flex";
				manageTasks.style.display = "none";
			}
		}
	} catch (error) {
		console.error('Error saving task to Supabase:', error)
		alert("Failed to create task. Please try again.");
	}
});

taskSelect.addEventListener("change", async function () {
	const previousTask = selectedTask;
	selectedTask = this.value;
	
	// Store current timer state
	const currentState = {
		current: roundInfo.current,
		t: roundInfo.t,
		running: roundInfo.running,
		focusNum: roundInfo.focusNum,
		remaining: roundInfo.remaining
	};
	
	try {
		await updateSelectedTask(selectedTask);
		
		// Restore timer state after task update
		roundInfo.current = currentState.current;
		roundInfo.t = currentState.t;
		roundInfo.running = currentState.running;
		roundInfo.focusNum = currentState.focusNum;
		roundInfo.remaining = currentState.remaining;
		
		setTime(); // Update display without advancing round
	} catch (error) {
		console.error('Error updating selected task:', error);
		selectedTask = previousTask;
		this.value = previousTask;
	}
});

let format = new Intl.DateTimeFormat(undefined, {
	dateStyle: "full",
	timeStyle: "short",
});

function pieCardGenerator(task) {
	let el = document.createElement("div");
	el.className = "pie-card";
	let pieName = document.createElement("div");
	pieName.className = "pie-card-name";
	pieName.innerText = task;
	el.appendChild(pieName);
	let timeHolder = document.createElement("div");
	let text = document.createElement("span");
	text.innerText = "Time Spent: ";
	let timeSpan = document.createElement("span");
	timeSpan.className = "pie-card-time";
	let ee = document.createElement("div");
	ee.className = "pie-card-time-div";
	let totaltime = document.createElement("span");
	totaltime.className = "pie-card-time-text";
	ee.append(document.createTextNode("("), totaltime, document.createTextNode(")"));
	let roundno = document.createElement("div");
	roundno.className = "pie-card-rounds";
	let roundnospan = document.createElement("span");
	roundnospan.className = "pie-card-rounds-span";
	roundno.append(document.createTextNode("Number of Rounds: "), roundnospan);
	timeHolder.append(text, timeSpan, ee, roundno);
	el.appendChild(timeHolder);
	return el;
}

function barGenerator(task, record = null) {
    let bar = document.createElement("div");
    bar.className = "bar";
    
    let barName = document.createElement("div");
    barName.className = "bar-name";
    barName.innerText = task;
    
    let barTime = document.createElement("div");
    barTime.className = "bar-time";
    
    let statValue = document.createElement("div");
    statValue.className = "stat-value";
    barTime.appendChild(statValue);
    
    bar.append(barName, barTime);
    
    // Add notes if they exist
    if (record && record.notes) {
        let barNotes = document.createElement("div");
        barNotes.className = "bar-notes";
        barNotes.innerText = record.notes;
        bar.appendChild(barNotes);
    }
    
    return bar;
}

function roundEntryGen(entry) {
	let roundEntry = document.createElement("div");
	roundEntry.className = "round-entry";
	
	let roundEntryHeader = document.createElement("div");
	roundEntryHeader.className = "round-entry-header";
	
	let roundEntryName = document.createElement("div");
	roundEntryName.className = "round-entry-name";
	roundEntryName.innerText = entry.n;
	
	let roundEntryDuration = document.createElement("div");
	roundEntryDuration.className = "round-entry-duration";
	roundEntryDuration.innerText = hmstrFull(entry.t);
	
	let roundEntryTime = document.createElement("div");
	roundEntryTime.className = "round-entry-time";
	roundEntryTime.innerText = format.format(entry.d);
	
	roundEntryHeader.append(roundEntryName, roundEntryDuration, roundEntryTime);
	roundEntry.appendChild(roundEntryHeader);
	
	if (entry.notes) {
		let roundEntryNotes = document.createElement("div");
		roundEntryNotes.className = "round-entry-notes";
		roundEntryNotes.innerText = entry.notes;
		roundEntry.appendChild(roundEntryNotes);
	}
	
	let entryDelete = document.createElement("button");
	entryDelete.className = "entry-delete";
	entryDelete.innerText = "Delete";
	entryDelete.addEventListener("click", () => {
		let p = confirm("Are you sure you want to delete this record? This cannot be undone.");
		if (!p) return;
		deleteRecord(entry.d);
		roundEntry.remove();
		loadStatistics(false);
	});
	
	roundEntry.appendChild(entryDelete);
	return roundEntry;
}

// Get references to stat summary elements
let pieSVG = document.querySelector("#pie svg");
let statSummaryTotal = document.getElementById("stat-summary-total");
let statSummaryRounds = document.getElementById("stat-summary-rounds");
let statSummaryAverage = document.getElementById("stat-summary-average");
let statSummaryShortest = document.getElementById("stat-summary-shortest");
let statSummaryLongest = document.getElementById("stat-summary-longest");

let remarkHourly = document.getElementById("remark-hourly");
let remarkMonthly = document.getElementById("remark-monthly");
let remarkDaily = document.getElementById("remark-daily");
let roundEntries = document.getElementById("round-entries");

// Create statistics containers dynamically
function createStatBars() {
    const timeSpentChart = document.getElementById("timespent");
    if (!timeSpentChart) return; // Guard against missing element

    timeSpentChart.innerHTML = ''; // Clear existing

    // Create hourly bars
    const hourlyContainer = document.createElement('div');
    hourlyContainer.className = 'stat-section';
    hourlyContainer.innerHTML = '<h3>Time Spent per 6 Hours:</h3>';
    hourlyNames.forEach(name => {
        const barContainer = document.createElement('div');
        barContainer.className = 'task-bar-container';
        
        const legend = document.createElement('div');
        legend.className = 'legend';
        legend.innerText = hourlyFullNames[hourlyNames.indexOf(name)];
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-container';
        
        const bar = document.createElement('div');
        bar.id = `hourly-${name}`;
        bar.className = 'bar';
        bar.style.width = '0%';
        
        const statValue = document.createElement('div');
        statValue.className = 'stat-value';
        statValue.innerText = '00:00';
        bar.appendChild(statValue);
        
        barWrapper.appendChild(bar);
        barContainer.append(legend, barWrapper);
        hourlyContainer.appendChild(barContainer);
    });
    timeSpentChart.appendChild(hourlyContainer);

    // Create daily bars
    const dailyContainer = document.createElement('div');
    dailyContainer.className = 'stat-section';
    dailyContainer.innerHTML = '<h3>Time Spent per Day:</h3>';
    dayNames.forEach(name => {
        const barContainer = document.createElement('div');
        barContainer.className = 'task-bar-container';
        
        const legend = document.createElement('div');
        legend.className = 'legend';
        legend.innerText = name.charAt(0).toUpperCase() + name.slice(1);
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-container';
        
        const bar = document.createElement('div');
        bar.id = `day-${name}`;
        bar.className = 'bar';
        bar.style.width = '0%';
        
        const statValue = document.createElement('div');
        statValue.className = 'stat-value';
        statValue.innerText = '00:00';
        bar.appendChild(statValue);
        
        barWrapper.appendChild(bar);
        barContainer.append(legend, barWrapper);
        dailyContainer.appendChild(barContainer);
    });
    timeSpentChart.appendChild(dailyContainer);

    // Create monthly bars
    const monthlyContainer = document.createElement('div');
    monthlyContainer.className = 'stat-section';
    monthlyContainer.innerHTML = '<h3>Time Spent per Month:</h3>';
    monthNames.forEach(name => {
        const barContainer = document.createElement('div');
        barContainer.className = 'task-bar-container';
        
        const legend = document.createElement('div');
        legend.className = 'legend';
        legend.innerText = name.charAt(0).toUpperCase() + name.slice(1);
        
        const barWrapper = document.createElement('div');
        barWrapper.className = 'bar-container';
        
        const bar = document.createElement('div');
        bar.id = `month-${name}`;
        bar.className = 'bar';
        bar.style.width = '0%';
        
        const statValue = document.createElement('div');
        statValue.className = 'stat-value';
        statValue.innerText = '00:00';
        bar.appendChild(statValue);
        
        barWrapper.appendChild(bar);
        barContainer.append(legend, barWrapper);
        monthlyContainer.appendChild(barContainer);
    });
    timeSpentChart.appendChild(monthlyContainer);
}

// Call this when initializing statistics
createStatBars();

let lastUpdate = null;
let lastSyncTime = 0;
const SYNC_THROTTLE = 1000; // Minimum time between syncs in ms

async function syncTimerState() {
    const now = Date.now();
    if (now - lastSyncTime < SYNC_THROTTLE) return;
    
    lastSyncTime = now;
    lastUpdate = new Date().toISOString();
    
    try {
        await updateTimerState({
            current: roundInfo.current,
            t: roundInfo.t,
            duration: config[roundInfo.current],
            running: roundInfo.running,
            focusNum: roundInfo.focusNum,
            selectedTask,
            session_pattern: currentSession?.pattern || null,
            session_goals: currentSession?.goals || null,
            pattern_position: currentSession?.currentRoundIndex || 0
        });
    } catch (error) {
        console.error('Error syncing timer state:', error);
        if (!isOnline) return;
    }
}

async function loadStatistics(updateEntryCards = true) {
    // Create/update the bar containers for time distribution
    createStatBars();
    
    // Get records
    let rec = await getRecords();
    let timeValue = statTimeSelect.value;
    
    // Get references to the bar elements
    const hourlyBars = hourlyNames.map(name => document.getElementById(`hourly-${name}`));
    const dayBars = dayNames.map(name => document.getElementById(`day-${name}`));
    const monthBars = monthNames.map(name => document.getElementById(`month-${name}`));
    
    if (!rec || rec.length === 0) {
        // Clear summary stats and time distribution bars
        if (statSummaryTotal) statSummaryTotal.innerText = "0 Minutes";
        if (statSummaryRounds) statSummaryRounds.innerText = "0";
        if (statSummaryAverage) statSummaryAverage.innerText = "0 Minutes";
        if (statSummaryShortest) statSummaryShortest.innerText = "0 Minutes";
        if (statSummaryLongest) statSummaryLongest.innerText = "0 Minutes";
        
        hourlyBars.forEach(bar => {
            if (bar) {
                const statValue = bar.querySelector('.stat-value');
                if (statValue) statValue.innerText = '00:00';
                bar.style.width = '0%';
            }
        });
        
        dayBars.forEach(bar => {
            if (bar) {
                const statValue = bar.querySelector('.stat-value');
                if (statValue) statValue.innerText = '00:00';
                bar.style.width = '0%';
            }
        });
        
        monthBars.forEach(bar => {
            if (bar) {
                const statValue = bar.querySelector('.stat-value');
                if (statValue) statValue.innerText = '00:00';
                bar.style.width = '0%';
            }
        });
        
        // Clear pie chart
        if (pieSVG) pieSVG.innerHTML = '';
        if (pieCardContainer) pieCardContainer.innerHTML = '';
        
        return;
    }

    // Filter records based on time period
    const now = new Date();
    const dayInMs = 24 * 60 * 60 * 1000;
    const timeFilter = (date) => {
        const d = new Date(date);
        switch (timeValue) {
            case "0": // Today
                const today = new Date();
                return d.getDate() === today.getDate() && 
                       d.getMonth() === today.getMonth() && 
                       d.getFullYear() === today.getFullYear();
            case "1": // Past Day
                return now - d <= dayInMs;
            case "7": // Past Week
                return now - d <= 7 * dayInMs;
            case "365": // Past Year
                return now - d <= 365 * dayInMs;
            case "all": // All Time
                return true;
            default:
                return true;
        }
    };
    
    // Filter records by time period and ensure they have actual duration
    rec = rec.filter(r => timeFilter(r.d) && r.t > 0);
    
    // Get unique tasks that have valid records in the selected time period
    const tasksWithRecords = new Set(rec.map(r => r.n));
    
    // Create pie cards for tasks with records
    tasksWithRecords.forEach(task => {
        if (!pieCards[task]) {
            pieCards[task] = pieCardGenerator(task);
            pieCardContainer.appendChild(pieCards[task]);
        }
    });
    
    // Initialize aggregation variables
    let charts = [];
    let maxvalue = 0;
    let minRoundValue = Infinity;
    let maxRoundValue = 0;
    let totalValue = 0;
    let hourlyTimes = new Array(4).fill(0);
    let dayTimes = new Array(7).fill(0);
    let monthTimes = new Array(12).fill(0);
    
    // Process records for each task
    for (let task of filteredTasks) {
        let chart = {
            t: 0,
            task: task,
            n: 0,
        };
        
        // Filter records for this task
        const taskRecords = rec.filter(r => r.n === task);
        taskRecords.forEach(r => {
            chart.t += r.t;
            totalValue += r.t;
            let d = new Date(r.d);
            hourlyTimes[Math.floor(d.getHours() / 6)] += r.t;
            dayTimes[d.getDay()] += r.t;
            monthTimes[d.getMonth()] += r.t;
            chart.n++;
            if (r.t > 0) { // Only consider non-zero durations for min/max
                minRoundValue = Math.min(minRoundValue, r.t);
                maxRoundValue = Math.max(maxRoundValue, r.t);
            }
        });
        
        if (chart.t > 0) { // Only add tasks with non-zero total time
            maxvalue = Math.max(maxvalue, chart.t);
            charts.push(chart);
        }
    }

    // Update summary stats
    if (statSummaryTotal) statSummaryTotal.innerText = hmstrFull(totalValue);
    if (statSummaryRounds) statSummaryRounds.innerText = rec.length.toString();
    if (statSummaryAverage) statSummaryAverage.innerText = hmstrFull(totalValue / (rec.length || 1));
    if (statSummaryShortest) statSummaryShortest.innerText = hmstrFull(minRoundValue === Infinity ? 0 : minRoundValue);
    if (statSummaryLongest) statSummaryLongest.innerText = hmstrFull(maxRoundValue);

    // Update remarks visibility and content
    if (totalValue === 0) {
        if (remarkDaily) remarkDaily.style.display = "none";
        if (remarkHourly) remarkHourly.style.display = "none";
        if (remarkMonthly) remarkMonthly.style.display = "none";
    } else {
        if (remarkDaily) remarkDaily.style.display = "block";
        if (remarkHourly) remarkHourly.style.display = "block";
        if (remarkMonthly) remarkMonthly.style.display = "block";

        // Update hourly remark
        let maxH = hourlyTimes.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);
        if (remarkHourly) {
            const remarkValue = remarkHourly.querySelector(".remark-value");
            if (remarkValue) remarkValue.innerText = hourlyFullNames[maxH];
        }

        // Update daily remark
        let maxD = dayTimes.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);
        if (remarkDaily) {
            const remarkValue = remarkDaily.querySelector(".remark-value");
            if (remarkValue) remarkValue.innerText = dayNames[maxD] + "s";
        }

        // Update monthly remark
        let maxM = monthTimes.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);
        if (remarkMonthly) {
            const remarkValue = remarkMonthly.querySelector(".remark-value");
            if (remarkValue) remarkValue.innerText = monthNames[maxM];
        }
    }

    // Update bar charts
    const hourlyMax = Math.max(1, ...hourlyTimes);
    hourlyTimes.forEach((t, i) => {
        const bar = hourlyBars[i];
        if (bar) {
            const statValue = bar.querySelector('.stat-value');
            if (statValue) statValue.innerText = hmstr(t);
            bar.style.width = t > 0 ? (t / hourlyMax * 100) + "%" : "0%";
        }
    });

    const dayMax = Math.max(1, ...dayTimes);
    dayTimes.forEach((t, i) => {
        const bar = dayBars[i];
        if (bar) {
            const statValue = bar.querySelector('.stat-value');
            if (statValue) statValue.innerText = hmstr(t);
            bar.style.width = t > 0 ? (t / dayMax * 100) + "%" : "0%";
        }
    });

    const monthMax = Math.max(1, ...monthTimes);
    monthTimes.forEach((t, i) => {
        const bar = monthBars[i];
        if (bar) {
            const statValue = bar.querySelector('.stat-value');
            if (statValue) statValue.innerText = hmstr(t);
            bar.style.width = t > 0 ? (t / monthMax * 100) + "%" : "0%";
        }
    });

    // Update pie chart
    if (pieSVG) {
        pieSVG.innerHTML = "";
        let sumOfPrev = 0;
        charts
            .sort((a, b) => b.t - a.t)
            .forEach((chart, i) => {
                const taskBar = taskBars[chart.task];
                const pieCard = pieCards[chart.task];
                
                if (taskBar) {
                    const statValue = taskBar.querySelector(".stat-value");
                    if (statValue) statValue.innerText = hmstr(chart.t);
                    taskBar.style.width = (chart.t / maxvalue * 100) + "%";
                    taskBar.style.order = i + 1;
                }
                
                if (pieCard) {
                    pieCard.style.order = i + 1;
                    const timeEl = pieCard.querySelector(".pie-card-time");
                    const timeTextEl = pieCard.querySelector(".pie-card-time-text");
                    const roundsEl = pieCard.querySelector(".pie-card-rounds-span");
                    
                    if (timeEl) timeEl.innerText = `${((chart.t / (totalValue || 1)) * 100).toFixed(2)}%`;
                    if (timeTextEl) timeTextEl.innerText = hmstrFull(chart.t);
                    if (roundsEl) roundsEl.innerText = chart.n.toString();
                }

                if (chart.t > 0) {
                    let pie = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    let a = (sumOfPrev / (totalValue || 1)) * Math.PI * 2;
                    let p1 = [60 + Math.sin(a) * 50, 60 - Math.cos(a) * 50];
                    let b = ((sumOfPrev + chart.t) / (totalValue || 1)) * Math.PI * 2;
                    let p2 = [60 + Math.sin(b) * 50, 60 - Math.cos(b) * 50];
                    let normal = (a + b) / 2;
                    
                    if (totalValue === chart.t) {
                        pie.setAttribute("d", `M60,10 A50 50 0 1 1 60 110 A50 50 0 1 1 60 10 z`);
                        pie.dataset.circle = true;
                    } else {
                        pie.setAttribute(
                            "d",
                            `M60,60 L${p1.join(",")} A50 50 0 ${b - a > Math.PI ? 1 : 0} 1 ${p2.join(" ")} L60,60 z`
                        );
                    }
                    
                    let title = document.createElementNS("http://www.w3.org/2000/svg", "title");
                    title.innerHTML = chart.task + " " + ((chart.t / (totalValue || 1)) * 100).toFixed(2) + "%";
                    pie.appendChild(title);
                    pie.dataset.normal = normal;
                    pie.dataset.task = chart.task;
                    pie.addEventListener("pointerenter", pathPointerEnter);
                    pie.addEventListener("pointerleave", pathPointerLeave);
                    pieSVG.appendChild(pie);
                    sumOfPrev += chart.t;
                }
            });
    }

    // Update round entries
    if (updateEntryCards && roundEntries) {
        roundEntries.innerHTML = "";
        rec.sort((a, b) => b.d - a.d).forEach((e) => {
            roundEntries.appendChild(roundEntryGen(e));
        });
    }
}

function pathPointerEnter(ev) {
	let el = pieCards[ev.target.dataset.task];
	if (!ev.target.dataset.circle) {
		let a = parseFloat(ev.target.dataset.normal);
		ev.target.style.transform = "translate(" + Math.sin(a) * 5 + "px, " + (-Math.cos(a) * 5) + "px)";
	}
	pieCardContainer.scrollTo({
		left: el.offsetLeft,
		top: el.offsetTop,
		behavior: "smooth"
	});
	el.classList.add("pie-card-active");
}

function pathPointerLeave(ev) {
	let el = pieCards[ev.target.dataset.task];
	ev.target.style.transform = "translate(0px, 0px)";
	el.classList.remove("pie-card-active");
}

//#endregion

//#region Statistics Backup

//todo

//#endregion

//#region Theming

const themes = {
	dark: {
		props: {
			"color-scheme": "dark",
			"--focus": "#d64f4f",
			"--short": "#26baba",
			"--long": "#5fbbe6",
		},
		defaccent: "lavender",
	},
	light: {
		props: {
			"color-scheme": "light",
			"--focus": "#d64f4f",
			"--short": "#26baba",
			"--long": "#5fbbe6",
		},
		defaccent: "red",
	},
	black: {
		props: {
			"color-scheme": "dark",
			"--focus": "#d64f4f",
			"--short": "#26baba",
			"--long": "#5fbbe6",
		},
		defaccent: "lavender",
	},
	white: {
		props: {
			"color-scheme": "light",
			"--focus": "#d64f4f",
			"--short": "#26baba",
			"--long": "#5fbbe6",
		},
		defaccent: "red",
	},
};

const accents = {
	dark: {
		red: {
			"--bgcolor": "#252222",
			"--bgcolor2": "#403333",
			"--color": "#ffeeee",
			"--coloraccent": "#ffaaaa",
		},
		violet: {
			"--bgcolor": "#252225",
			"--bgcolor2": "#3a2a3a",
			"--color": "#ffeeff",
			"--coloraccent": "#ee82ee",
		},
		blue: {
			"--bgcolor": "#131320",
			"--bgcolor2": "#1d3752",
			"--color": "#eeeeff",
			"--coloraccent": "#9bb2ff",
		},
		lavender: {
			"--bgcolor": "#222230",
			"--bgcolor2": "#333340",
			"--color": "#eeeeff",
			"--coloraccent": "#b2b2ff",
		},
		green: {
			"--bgcolor": "#1d201d",
			"--bgcolor2": "#143814",
			"--color": "#eeffee",
			"--coloraccent": "#8dd48d",
		},
		teal: {
			"--bgcolor": "#111f1f",
			"--bgcolor2": "#334040",
			"--color": "#eeffff",
			"--coloraccent": "#00aaaa",
		},
		grey: {
			"--bgcolor": "#222222",
			"--bgcolor2": "#444444",
			"--color": "#dddddd",
			"--coloraccent": "#aaaaaa",
		},
	},
	black: {
		red: {
			"--bgcolor2": "#403333",
			"--color": "#ffeeee",
			"--coloraccent": "#ffaaaa",
			"--bgcolor": "#000000",
		},
		violet: {
			"--bgcolor": "#000000",
			"--bgcolor2": "#312131",
			"--color": "#ffeeff",
			"--coloraccent": "#ee82ee",
		},
		blue: {
			"--bgcolor2": "#1d3752",
			"--color": "#eeeeff",
			"--coloraccent": "#9bb2ff",
			"--bgcolor": "#000000",
		},
		lavender: {
			"--bgcolor2": "#333340",
			"--color": "#eeeeff",
			"--coloraccent": "#b2b2ff",
			"--bgcolor": "#000000",
		},
		green: {
			"--bgcolor2": "#143814",
			"--color": "#eeffee",
			"--coloraccent": "#8dd48d",
			"--bgcolor": "#000000",
		},
		teal: {
			"--bgcolor": "#000000",
			"--bgcolor2": "#303f3f",
			"--color": "#eeffff",
			"--coloraccent": "#00aaaa",
		},
		grey: {
			"--bgcolor2": "#444444",
			"--color": "#dddddd",
			"--coloraccent": "#aaaaaa",
			"--bgcolor": "#000000",
		},
	},
	light: {
		red: {
			"--bgcolor": "#fff3f3",
			"--bgcolor2": "#ffd2d2",
			"--color": "#222222",
			"--coloraccent": "#d64f4f",
		},
		violet: {
			"--bgcolor": "#fff3ff",
			"--bgcolor2": "#ffd2ff",
			"--color": "#222222",
			"--coloraccent": "#ee82ee",
		},
		blue: {
			"--bgcolor": "#f3f3ff",
			"--bgcolor2": "#d2d2ff",
			"--color": "#222222",
			"--coloraccent": "#4169e4",
		},
		lavender: {
			"--bgcolor": "#faf1ff",
			"--bgcolor2": "#e2d4ff",
			"--color": "#222222",
			"--coloraccent": "#8b51ff",
		},
		teal: {
			"--bgcolor": "#faffff",
			"--bgcolor2": "#cbebeb",
			"--color": "#222222",
			"--coloraccent": "#008080",
		},
		green: {
			"--bgcolor": "#f3fff3",
			"--bgcolor2": "#cafcc1",
			"--color": "#222222",
			"--coloraccent": "#39743d",
		},
		grey: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#dddddd",
			"--color": "#333333",
			"--coloraccent": "#555555",
		},
	},
	white: {
		red: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#ffd2d2",
			"--color": "#222222",
			"--coloraccent": "#ee7777",
		},
		violet: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#ffd2ff",
			"--color": "#222222",
			"--coloraccent": "#ee82ee",
		},
		blue: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#d2d2ff",
			"--color": "#222222",
			"--coloraccent": "#4169e4",
		},
		lavender: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#e2d4ff",
			"--color": "#222222",
			"--coloraccent": "#8b51ff",
		},
		teal: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#cbebeb",
			"--color": "#222222",
			"--coloraccent": "#008080",
		},
		green: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#cafcc1",
			"--color": "#222222",
			"--coloraccent": "#39743d",
		},
		grey: {
			"--bgcolor": "#ffffff",
			"--bgcolor2": "#dddddd",
			"--color": "#333333",
			"--coloraccent": "#555555",
		},
	},
};

let theme = "dark";
let themeAccent = "lavender";
let colorsDiv = document.getElementById("colors");

function setTheme(basetheme = "dark", accent) {
	if (!accent) accent = themes[basetheme].defaccent;
	if (basetheme !== "custom") {
		for (let prop in themes[basetheme].props) {
			root.style.setProperty(prop, themes[basetheme].props[prop]);
		}
		document.getElementById("t-" + theme).removeAttribute("selected");
		addColorButtons(basetheme);
		document.getElementById("t-" + basetheme).setAttribute("selected", true);
		setAccent(basetheme, accent);
	}
}

let colorBtns = [];

function addColorButtons(basetheme) {
	colorsDiv.innerHTML = "";
	colorBtns = [];
	for (let accent in accents[basetheme]) {
		let btn = document.createElement("button");
		btn.className = "color";
		btn.style.backgroundColor = accents[basetheme][accent]["--coloraccent"];
		btn.dataset.color = basetheme + "-" + accent;
		btn.addEventListener("click", () => {
			setAccent(basetheme, accent);
		});
		btn.title = accent;
		colorBtns.push(btn);
		colorsDiv.appendChild(btn);
	}
}

let themeMeta = document.getElementById("theme-meta");

function setAccent(basetheme, accent) {
	for (let prop in accents[basetheme][accent]) {
		root.style.setProperty(prop, accents[basetheme][accent][prop]);
	}
	themeMeta.setAttribute("content", accents[basetheme][accent]["--bgcolor"]);
	colorBtns.forEach((btn) => {
		if (btn.dataset.active === "true") {
			btn.dataset.active = "false";
		}
		if (btn.dataset.color === basetheme + "-" + accent) {
			btn.dataset.active = "true";
		}
	});

	localStorage.setItem("pomo-theme", basetheme);
	localStorage.setItem("pomo-theme-accent", accent);
	theme = basetheme;
	themeAccent = accent;
}

document.getElementById("theme-select").addEventListener("change", function () {
	setTheme(this.value);
});

if (localStorage.getItem("pomo-theme")) {
	theme = localStorage.getItem("pomo-theme");
	if (localStorage.getItem("pomo-theme-accent")) {
		themeAccent = localStorage.getItem("pomo-theme-accent");
	}
}
setTheme(theme, themeAccent);

//#endregion

//#region Timer Durations

if (localStorage.getItem("pomo-config")) {
	config = JSON.parse(localStorage.getItem("pomo-config"));
	setTime();
}

function saveConfig() {
	localStorage.setItem("pomo-config", JSON.stringify(config));
	setTime();
}

//#endregion

//#region PIP Mode
let canvas = document.createElement("canvas");
canvas.width = canvas.height = 400;
let ctx = canvas.getContext("2d");

function loop() {
	ctx.fillStyle = accents[theme][themeAccent]["--bgcolor"];
	ctx.fillRect(0, 0, 400, 400);

	ctx.fillStyle = accents[theme][themeAccent]["--color"];
	ctx.font = "80px monospace";
	ctx.textAlign = "center";
	let seconds = config[roundInfo.current] - roundInfo.t;
	if (seconds < 0) {
		nextRound();
		return;
	}
	let timestr =
		Math.floor(seconds / 60)
			.toString()
			.padStart(2, "0") +
		":" +
		(seconds % 60).toString().padStart(2, "0");
	ctx.fillText(timestr, 200, 200, 280);

	ctx.font = "32px monospace";
	ctx.fillText(fullname[roundInfo.current].toUpperCase(), 200, 260, 280);

	ctx.strokeStyle = accents[theme][themeAccent]["--coloraccent"];
	ctx.lineWidth = 4;
	ctx.beginPath();
	ctx.arc(200, 200, 180, 0, Math.PI * 2);
	ctx.stroke();

	ctx.strokeStyle = themes[theme].props["--" + roundInfo.current];
	ctx.lineWidth = 16;
	ctx.beginPath();
	ctx.arc(200, 200, 180, -Math.PI / 2, (1 - roundInfo.t / config[roundInfo.current]) * Math.PI * 2 - Math.PI / 2);
	ctx.stroke();
}

if ("documentPictureInPicture" in window) {
	let timerContainer = null;
	let pipWindow = null;

	async function enterPiP() {
		const timer = document.querySelector("#timer");
		timerContainer = timer.parentNode;
		timerContainer.classList.add("pip");

		const pipOptions = {
			initialAspectRatio: timer.clientWidth / timer.clientHeight,
			lockAspectRatio: true,
			copyStyleSheets: true,
		};

		pipWindow = await documentPictureInPicture.requestWindow(pipOptions);

		// Copy style sheets over from the initial document
		// so that the player looks the same.
		[...document.styleSheets].forEach((styleSheet) => {
			try {
				const cssRules = [...styleSheet.cssRules].map((rule) => rule.cssText).join("");
				const style = document.createElement("style");

				style.textContent = cssRules;
				pipWindow.document.head.appendChild(style);
			} catch (e) {
				const link = document.createElement("link");

				link.rel = "stylesheet";
				link.type = styleSheet.type;
				link.media = styleSheet.media;
				link.href = styleSheet.href;
				pipWindow.document.head.appendChild(link);
			}
		});

		// Add timer to the PiP window.
		pipWindow.document.body.append(timer);

		// Listen for the PiP closing event to put the timer back.
		pipWindow.addEventListener("unload", onLeavePiP.bind(pipWindow), {
			once: true,
		});
	}

	// Called when the PiP window has closed.
	function onLeavePiP() {
		if (this !== pipWindow) {
			return;
		}

		// Add the timer back to the main window.
		const timer = pipWindow.document.querySelector("#timer");
		timerContainer.append(timer);
		timerContainer.classList.remove("pip");
		pipWindow.close();

		pipWindow = null;
		timerContainer = null;
	}
	document.getElementById("popupbtn").addEventListener("click", () => {
		if (!pipWindow) {
			enterPiP();
		} else {
			onLeavePiP.bind(pipWindow)();
		}
	});
} else {
	let video = document.createElement("video");

	if (document.pictureInPictureEnabled || document.fullscreenEnabled) {
		document.body.appendChild(video);
		document.body.appendChild(canvas);
		canvas.id = "canvas";
		let stream = canvas.captureStream();
		video.srcObject = stream;
		video.autoplay = false;
		video.controls = true;
		video.addEventListener("play", () => {
			if (!roundInfo.running) pauseplay();
		});
		video.addEventListener("pause", () => {
			if (roundInfo.running) pauseplay();
		});
		loop();

		video.onenterpictureinpicture = () => {
			pipActive = true;
			video.classList.add("pipactive");
		};
		video.onleavepictureinpicture = () => {
			if (document.fullscreenElement) return;
			pipActive = false;
			video.classList.remove("pipactive");
		};
		video.onfullscreenchange = (ev) => {
			if (document.fullscreenElement) {
				pipActive = true;
				video.classList.add("pipactive");
			} else {
				pipActive = false;
				video.classList.remove("pipactive");
			}
		};
		document.getElementById("popupbtn").addEventListener("click", () => {
			if (document.pictureInPictureElement) {
				document.exitPictureInPicture();
				video.classList.remove("pipactive");
				return;
			}
			if (pipActive) {
				pipActive = false;
				video.classList.remove("pipactive");
				return;
			}
			loop();
			video.play();
			video.classList.add("pipactive");
			if (document.pictureInPictureEnabled) {
				video.requestPictureInPicture();
			}
			pipActive = true;
		});
	} else {
		document.getElementById("popupbtn").style.display = "none";
	}
}
//#endregion

let versionNo = 1;

let savedNo = parseInt(localStorage.getItem("pomo-version"));

if (!savedNo) {
	if (localStorage.getItem("pomo-notfirstload")) {
		localStorage.removeItem("pomo-notfirstload");
	}
}

if (savedNo !== versionNo) {
	document.getElementById("firstload").style.display = "block";
	mainel.style.display = "none";
	document.getElementById("closeintro").addEventListener("click", () => {
		document.getElementById("firstload").style.display = "none";
		localStorage.setItem("pomo-version", versionNo);
		mainel.style.display = "flex";
	});
}

// Add auth state listener
supabase.auth.onAuthStateChange((event, session) => {
	if (event === 'SIGNED_IN') {
		// Initialize DB first, then sync
		loadTasks().then(async () => {
			await clearLocalData();
			await syncFromSupabase();
			await syncSessions();
		});
		startPeriodicSync();
		
		// Subscribe to timer changes with reconnection handling
		let timerStateSubscription;
		const setupSubscription = async () => {
			if (timerStateSubscription) {
				await timerStateSubscription.unsubscribe();
			}
			
			timerStateSubscription = await subscribeToTimerState(async (payload) => {
				// Ignore our own updates
				if (payload.new.updated_at === lastUpdate) return;
				
				const state = payload.new;
				// Only update if the state is newer than our current state
				if (lastUpdate && new Date(state.updated_at) <= new Date(lastUpdate)) return;
				
				roundInfo.current = state.current;
				roundInfo.running = state.running;
				roundInfo.focusNum = state.focus_num;
				roundInfo.t = state.time;
				roundInfo.remaining = state.remaining_time;
				
				// Restore session pattern if exists
				if (state.session_pattern) {
					currentSession = {
						pattern: state.session_pattern,
						goals: state.session_goals || '',
						rounds: state.session_pattern.split('-').map(Number),
						currentRoundIndex: state.pattern_position || 0
					};
					showCurrentSession();
					
					// Update round display for session pattern
					const totalRounds = Math.ceil(currentSession.rounds.length / 2);
					const currentRound = Math.floor(currentSession.currentRoundIndex / 2) + 1;
					roundnoDiv.innerText = `${currentRound}/${totalRounds}`;
					
					// Set duration based on current round
					if (currentSession.currentRoundIndex < currentSession.rounds.length) {
						const duration = currentSession.rounds[currentSession.currentRoundIndex] * 60;
						config[roundInfo.current] = duration;
					}
				} else {
					currentSession = null;
					roundnoDiv.innerText = roundInfo.focusNum + "/" + config.longGap;
				}
				
				if (state.selected_task && tasks.includes(state.selected_task)) {
					selectedTask = state.selected_task;
					taskSelect.value = selectedTask;
				}
				
				timer.className = "t-" + roundInfo.current;
				setTime();
				
				// Update play/pause button state to match actual state
				pauseplaybtn.className = state.running ? "playing" : "paused";
				pauseplaybtn.title = state.running ? "Pause Timer" : "Start Timer";
				
				if (state.running) {
					const duration = config[roundInfo.current];
					const elapsedTime = state.time || 0;
					timerWorker.postMessage({
						type: "start",
						t: elapsedTime,
						maxDuration: duration,
						sync: true
					});
				} else {
					timerWorker.postMessage({ type: "stop" });
				}
			});
		};
		
		setupSubscription();
		
		// Handle reconnection
		window.addEventListener('online', setupSubscription);
		
		// Get initial timer state
		getTimerState().then(state => {
			if (state) {
				roundInfo.current = state.current;
				roundInfo.t = state.time;
				roundInfo.running = state.running;
				roundInfo.focusNum = state.focus_num;
				roundInfo.remaining = state.remaining_time;
				
				// Restore session pattern if exists
				if (state.session_pattern) {
					currentSession = {
						pattern: state.session_pattern,
						goals: state.session_goals || '',
						rounds: state.session_pattern.split('-').map(Number),
						currentRoundIndex: state.pattern_position || 0
					};
					showCurrentSession();
					
					// Update round display for session pattern
					const totalRounds = Math.ceil(currentSession.rounds.length / 2);
					const currentRound = Math.floor(currentSession.currentRoundIndex / 2) + 1;
					roundnoDiv.innerText = `${currentRound}/${totalRounds}`;
					
					// Set duration based on current round
					if (currentSession.currentRoundIndex < currentSession.rounds.length) {
						const duration = currentSession.rounds[currentSession.currentRoundIndex] * 60;
						config[roundInfo.current] = duration;
					}
				} else {
					currentSession = null;
					roundnoDiv.innerText = roundInfo.focusNum + "/" + config.longGap;
				}
				
				if (state.selected_task && tasks.includes(state.selected_task)) {
					selectedTask = state.selected_task;
					taskSelect.value = selectedTask;
				}
				
				timer.className = "t-" + roundInfo.current;
				setTime();
				
				// Start worker if timer was running
				if (state.running) {
					timerWorker.postMessage({
						type: "start",
						t: state.time,
						maxDuration: config[roundInfo.current],
					});
				}
			}
		});
	} else if (event === 'SIGNED_OUT') {
		stopPeriodicSync();
		if (timerStateSubscription) {
				timerStateSubscription.unsubscribe();
		}
		window.removeEventListener('online', setupSubscription);
	}
});

// Add sync function
async function syncFromSupabase() {
	if (isSyncing) return;
	isSyncing = true;
	showSyncIndicator();

	try {
		const { data: remoteTasks } = await getTasks()
		// Just use whatever tasks we got from the server
		tasks = remoteTasks?.map(task => task.name) || [];
		// Clear existing UI elements before recreating
		taskSelect.innerHTML = "";
		taskContainer.innerHTML = "";
		filterContainer.innerHTML = "";
		filteredTasks.clear();  // Clear the filtered tasks set
		Object.keys(taskBars).forEach(key => {
			if (taskBars[key]) taskBars[key].remove();
		});
		Object.keys(pieCards).forEach(key => {
			if (pieCards[key]) pieCards[key].remove();
		});
		taskBars = {};
		pieCards = {};
		tasks.forEach(task => createTaskEl(task));
		return true
	} catch (error) {
		console.error('Error syncing tasks:', error)
		return false
	} finally {
		isSyncing = false;
		hideSyncIndicator();
	}
}

// Add session syncing function
async function syncSessions() {
	if (isSyncing) return;
	isSyncing = true;
	showSyncIndicator();

	try {
		const { data: { user } } = await supabase.auth.getUser()
		if (!user) return false

		// Get sessions from Supabase
		const { data: remoteSessions } = await supabase
			.from('daily_sessions')
			.select('*, task:task_id(name)')
			.order('start_time', { ascending: false })
			.gte('start_time', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()); // Last 30 days

		return true
	} catch (error) {
		console.error('Error syncing sessions:', error)
		return false
	} finally {
		isSyncing = false;
		hideSyncIndicator();
	}
}

// Initialize auth UI
createAuthUI()

// Add sync indicator
const syncIndicator = document.createElement('div')
syncIndicator.className = 'sync-indicator'
syncIndicator.innerHTML = '<div class="sync-spinner"></div><span>Syncing...</span>';
document.body.appendChild(syncIndicator);

function showSyncIndicator() {
  syncIndicator.classList.add('active')
}

function hideSyncIndicator() {
  syncIndicator.classList.remove('active')
}

// Set up periodic sync
let syncInterval

function startPeriodicSync() {
  // Sync every 5 minutes if logged in and online
  syncInterval = setInterval(() => {
    if (isOnline) {
      syncFromSupabase()
      syncSessions()
    }
  }, 5 * 60 * 1000)
}

function stopPeriodicSync() {
  clearInterval(syncInterval)
}

// Function to clear local data
async function clearLocalData() {
	return Promise.resolve();
}

async function saveTasksToSupabase(tasks) {
	const { data: { user } } = await supabase.auth.getUser()
	if (!user) return;  // Don't try to save if not authenticated

	try {
		const { data, error } = await saveTasks(tasks)
		if (error) throw error
		return data
	} catch (error) {
		console.error('Error saving tasks:', error)
		// Show offline warning if needed
		if (!isOnline) {
			console.warn('You are offline. Changes will sync when you reconnect.')
		}
	}
}

// Add new function to only update selected task
export async function updateSelectedTask(taskName) {
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) {
		console.warn('Must be logged in to update selected task');
		return null;
	}
	
	try {
		const existingState = await getTimerState();
		
		const timerState = {
			current: existingState?.current || 'focus',
			t: existingState?.time || 0,
			duration: config[existingState?.current || 'focus'],
			running: existingState?.running || false,
			focusNum: existingState?.focus_num || 1,
			selectedTask: taskName
		};
		
		return await updateTimerState(timerState);
	} catch (error) {
		console.error('Error updating selected task:', error);
		return null;
	}
}

document.getElementById("closemenu").addEventListener("click", () => {
	if (lastanim) lastanim.cancel();
	if (viewState === "menu") {
		mainel.style.display = "flex";
		lastanim = menu.animate(animations.out, animations.animoptions);
		lastanim.onfinish = () => {
			menu.style.display = "none";
		};
		menubtn.title = "Open Settings";
		viewState = "timer";
	}
});

// Theme initialization

// Initialize theme select
let themeSelect = document.getElementById("theme-select");
themeSelect.value = theme;
themeSelect.addEventListener("change", (e) => {
    theme = e.target.value;
    addColorButtons(theme);
    setAccent(theme, themes[theme].defaccent);
});

// Initialize accent colors
addColorButtons(theme);
setAccent(theme, themeAccent);

