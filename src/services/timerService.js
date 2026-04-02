const monitorStore = require("../store/monitorStore");

// Stores active setTimeout references keyed by device ID
const timers = new Map();

// Stores the start time of each timer for remaining-time calculations
const timerMeta = new Map();

// Start (or restart) a countdown timer for a monitor
function startTimer(id, timeoutSeconds) {
  // Clear any existing timer for this device
  clearTimer(id);

  // Record when this timer was started
  timerMeta.set(id, {
    startedAt: Date.now(),
    duration: timeoutSeconds * 1000,
  });

  const timer = setTimeout(() => {
    onTimerExpired(id);
  }, timeoutSeconds * 1000);

  // Prevent the timer from keeping the Node.js process alive during shutdown
  timer.unref();

  timers.set(id, timer);
}


function clearTimer(id) {
  const existing = timers.get(id);
  if (existing) {
    clearTimeout(existing);
    timers.delete(id);
  }
  timerMeta.delete(id);
}


function getRemainingTime(id) {
  const meta = timerMeta.get(id);
  if (!meta) return null;

  const elapsed = Date.now() - meta.startedAt;
  const remaining = Math.max(0, meta.duration - elapsed);
  return Math.round(remaining / 1000);
}

// Called when a device's countdown reaches zero
function onTimerExpired(id) {
  const monitor = monitorStore.get(id);
  if (!monitor) return;

  // Update status to down
  monitorStore.update(id, { status: "down" });

  // Fire the alert
  const alert = {
    ALERT: `Device ${id} is down!`,
    device_id: id,
    alert_email: monitor.alertEmail,
    time: new Date().toISOString(),
  };

  console.log("\n ALERT TRIGGERED:");
  console.log(JSON.stringify(alert, null, 2));
  console.log("");

  // Clean up timer metadata
  timers.delete(id);
  timerMeta.delete(id);
}

module.exports = { startTimer, clearTimer, getRemainingTime };
