let running = false;
let t = 0;
let maxDuration = 0;
let interval = null;

function tick() {
	if (!running) return;
	
	t++;
	if (t >= maxDuration) {
		running = false;
		clearInterval(interval);
		interval = null;
		self.postMessage({ t: maxDuration, running: false, maxDuration });
		return;
	}
	self.postMessage({ t, running: true, maxDuration });
}

self.addEventListener("message", (e) => {
	if (e.data.type === "start") {
		// Validate maxDuration
		if (typeof e.data.maxDuration !== 'number' || e.data.maxDuration <= 0) {
			console.error('Invalid maxDuration:', e.data.maxDuration);
			return;
		}
		
		// Set initial state
		maxDuration = e.data.maxDuration;
		t = typeof e.data.t === 'number' ? e.data.t : 0;
		running = true;
		
		// Clear any existing interval and start a new one
		if (interval) {
			clearInterval(interval);
		}
		interval = setInterval(tick, 1000);
		
		// Send initial state immediately
		self.postMessage({ t, running: true, maxDuration });
		
	} else if (e.data.type === "stop") {
		running = false;
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
		self.postMessage({ t, running: false, maxDuration });
	}
});