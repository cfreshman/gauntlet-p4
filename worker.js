let running = false;
let t = 0;
let maxDuration = 0;
let interval;

self.onmessage = (e) => {
	if (e.data.type === "start") {
		running = true;
		maxDuration = e.data.maxDuration;
		if (typeof e.data.t === 'number') {
			t = e.data.t;
		}
		if (!interval) {
			interval = setInterval(tick, 1000);
		}
	} else if (e.data.type === "stop") {
		running = false;
		if (interval) {
			clearInterval(interval);
			interval = null;
		}
	}
};

function tick() {
	t++;
	if (t > maxDuration) {
		postMessage({
			t: t - 1,
			running: false
		});
		clearInterval(interval);
		interval = null;
	} else {
		postMessage({
			t: t,
			running: true
		});
	}
}