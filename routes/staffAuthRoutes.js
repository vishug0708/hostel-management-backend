const express = require("express");
const { staffLogin } = require("../controllers/staffAuthController");

const router = express.Router();

router.post("/login", staffLogin);

module.exports = router;
