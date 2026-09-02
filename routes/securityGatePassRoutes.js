const express = require("express");

const {
  scanGatePass,
  recordExit,
  recordEntry,
  getExitRecords,
  getEntryRecords,
} = require("../controllers/securityGatePassController");

const router = express.Router();

// Scan QR / Verify Gate Pass
router.post("/scan", scanGatePass);

// Student Exit
router.put("/:id/exit", recordExit);

// Student Entry
router.put("/:id/entry", recordEntry);

// Exit Records
router.get("/exit-records", getExitRecords);

// Entry Records
router.get("/entry-records", getEntryRecords);

module.exports = router;