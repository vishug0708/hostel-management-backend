const express = require("express");

const router = express.Router();

const {
    getRectorDashboard,
    getRectorProfile
} = require("../controllers/rectorController");

router.get(
    "/dashboard",
    getRectorDashboard
);

router.get(
    "/profile/:id",
    getRectorProfile
);

module.exports = router;