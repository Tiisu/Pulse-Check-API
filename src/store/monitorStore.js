const monitors = new Map();

// Create a new monitor entry
function create(id, timeout, alertEmail) {
  const now = new Date().toISOString();
  const monitor = {
    id,
    timeout,
    alertEmail,
    status: "active",
    createdAt: now,
    lastHeartbeat: now,
  };
  monitors.set(id, monitor);
  return monitor;
}


function get(id) {
  return monitors.get(id);
}

function getAll() {
  return Array.from(monitors.values());
}


function update(id, updates) {
  const monitor = monitors.get(id);
  if (!monitor) return null;
  Object.assign(monitor, updates);
  monitors.set(id, monitor);
  return monitor;
}


function remove(id) {
  return monitors.delete(id);
}


function exists(id) {
  return monitors.has(id);
}

module.exports = { create, get, getAll, update, remove, exists };
