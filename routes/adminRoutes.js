const express = require("express");

const {
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword
} = require("../controllers/adminController");

const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();


// =====================================================
// GET ADMIN PROFILE
// =====================================================

router.get(
    "/profile",
    authMiddleware,
    getAdminProfile
);


// =====================================================
// UPDATE ADMIN PROFILE
// =====================================================

router.put(
    "/profile",
    authMiddleware,
    updateAdminProfile
);


// =====================================================
// CHANGE ADMIN PASSWORD
// =====================================================

router.put(
    "/change-password",
    authMiddleware,
    changeAdminPassword
);


module.exports = router;