const express = require("express");

const { getCricketStats, scanCricketQr, getScanHistory } = require("../controllers/staffCricketController");

const router = express.Router();

router.get("/stats", getCricketStats);

router.post("/scan", scanCricketQr);

router.get("/history", getScanHistory);

module.exports = router;