const express = require("express");

const {
    securityLogin
} = require("../controllers/securityAuthController");

const router = express.Router();

// ===============================
// SECURITY LOGIN
// ===============================

router.post(
    "/login",
    securityLogin
);

module.exports = router;