const express = require("express");

const {
    adminLogin
} = require("../controllers/adminAuthController");

const router = express.Router();


// =====================================================
// ADMIN LOGIN
// =====================================================

router.post(
    "/login",
    adminLogin
);


module.exports = router;