
const monitorStore = require("../store/monitorStore");
const timerService = require("../services/timerService");


// Create a new monitor with a countdown timer

function createMonitor(req, res) {
  const { id, timeout, alert_email } = req.body;

  // Validate required fields
  if (!id || !timeout || !alert_email) {
    return res.status(400).json({
      error: "Missing required fields: id, timeout, and alert_email are required",
    });
  }

  // Validate if timeout is a positive number
  if (typeof timeout !== "number" || timeout <= 0) {
    return res.status(400).json({
      error: "timeout must be a positive number (seconds)",
    });
  }

  // Check for duplicate
  if (monitorStore.exists(id)) {
    return res.status(409).json({
      error: `Monitor with id '${id}' already exists`,
    });
  }

  // Create the monitor and start the timer
  const monitor = monitorStore.create(id, timeout, alert_email);
  timerService.startTimer(id, timeout);

  console.log(` Monitor registered: ${id} (timeout: ${timeout}s)`);

  return res.status(201).json({
    message: `Monitor created for ${id}`,
    monitor: formatMonitor(monitor),
  });
}


// Reset the countdown timer for a device

function heartbeat(req, res) {
  const { id } = req.params;
  const monitor = monitorStore.get(id);

  if (!monitor) {
    return res.status(404).json({
      error: `Monitor '${id}' not found`,
    });
  }

  // Update last heartbeat and set status to active
  monitorStore.update(id, {
    status: "active",
    lastHeartbeat: new Date().toISOString(),
  });

  // Reset the countdown timer
  timerService.startTimer(id, monitor.timeout);

  console.log(` Heartbeat received: ${id}`);

  return res.status(200).json({
    message: "Heartbeat received. Timer reset.",
    monitor: formatMonitor(monitorStore.get(id)),
  });
}

// Pause monitoring — stop the timer, no alerts will fire

function pause(req, res) {
  const { id } = req.params;
  const monitor = monitorStore.get(id);

  if (!monitor) {
    return res.status(404).json({
      error: `Monitor '${id}' not found`,
    });
  }

  if (monitor.status === "paused") {
    return res.status(400).json({
      error: `Monitor '${id}' is already paused`,
    });
  }

  // Stop the timer and update status
  timerService.clearTimer(id);
  monitorStore.update(id, { status: "paused" });

  console.log(` Monitor paused: ${id}`);

  return res.status(200).json({
    message: `Monitor '${id}' has been paused. Send a heartbeat to resume.`,
    monitor: formatMonitor(monitorStore.get(id)),
  });
}


// List all monitors with their current status

function listMonitors(req, res) {
  const monitors = monitorStore.getAll().map(formatMonitor);

  return res.status(200).json({
    count: monitors.length,
    monitors,
  });
}


// Get details of a single monitor

function getMonitor(req, res) {
  const { id } = req.params;
  const monitor = monitorStore.get(id);

  if (!monitor) {
    return res.status(404).json({
      error: `Monitor '${id}' not found`,
    });
  }

  return res.status(200).json({
    monitor: formatMonitor(monitor),
  });
}


// Remove a monitor and its timer

function deleteMonitor(req, res) {
  const { id } = req.params;

  if (!monitorStore.exists(id)) {
    return res.status(404).json({
      error: `Monitor '${id}' not found`,
    });
  }

  timerService.clearTimer(id);
  monitorStore.remove(id);

  console.log(`🗑️  Monitor deleted: ${id}`);

  return res.status(200).json({
    message: `Monitor '${id}' has been deleted`,
  });
}

// Format a monitor object for API responses
function formatMonitor(monitor) {
  const remaining = timerService.getRemainingTime(monitor.id);

  return {
    id: monitor.id,
    status: monitor.status,
    timeout: monitor.timeout,
    remaining: monitor.status === "active" ? remaining : null,
    alert_email: monitor.alertEmail,
    last_heartbeat: monitor.lastHeartbeat,
    created_at: monitor.createdAt,
  };
}

module.exports = {
  createMonitor,
  heartbeat,
  pause,
  listMonitors,
  getMonitor,
  deleteMonitor,
};
