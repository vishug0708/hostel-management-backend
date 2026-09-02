const express = require("express");

const router = express.Router();

const {
    rectorLogin
} = require("../controllers/rectorAuthController");

router.post(
    "/login",
    rectorLogin
);

module.exports = router;