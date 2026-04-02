
const express = require("express");
const router = express.Router();
const controller = require("../controllers/monitorController");

router.post("/", controller.createMonitor);
router.post("/:id/heartbeat", controller.heartbeat);

router.post("/:id/pause", controller.pause);

router.get("/", controller.listMonitors);
router.get("/:id", controller.getMonitor);
router.delete("/:id", controller.deleteMonitor);

module.exports = router;
