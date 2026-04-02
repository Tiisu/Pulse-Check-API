
const express = require("express");
const monitorRoutes = require("./routes/monitors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.url}`);
  next();
});

app.use("/monitors", monitorRoutes);

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    service: "Pulse-Check-API",
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

// Root
app.get("/", (req, res) => {
  res.status(200).json({
    service: "Pulse-Check-API",
    description: "Dead Man's Switch — Device Heartbeat Monitoring",
    endpoints: {
      "POST /monitors": "Register a new monitor",
      "POST /monitors/:id/heartbeat": "Send a heartbeat (reset timer)",
      "POST /monitors/:id/pause": "Pause monitoring",
      "GET /monitors": "List all monitors",
      "GET /monitors/:id": "Get monitor details",
      "DELETE /monitors/:id": "Remove a monitor",
      "GET /health": "Service health check",
    },
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: "Endpoint not found" });
});

// Global error handler — catches unhandled errors in route handlers
// Express identifies this as an error handler by the 4-parameter signature
app.use((err, req, res, next) => {
  console.error(`\n Unhandled Error: ${req.method} ${req.url}`);
  console.error(err.stack || err);

  res.status(err.status || 500).json({
    error: "Internal server error",
    ...(process.env.NODE_ENV !== "production" && { detail: err.message }),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`\n Pulse-Check-API running on http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   Monitors: http://localhost:${PORT}/monitors\n`);
});
