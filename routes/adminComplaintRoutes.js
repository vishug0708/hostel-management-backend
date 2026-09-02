const express = require("express");

const router = express.Router();

const {
    getComplaints,
    getComplaintHistory
} = require("../controllers/adminComplaintController");

router.get(
    "/",
    getComplaints
);

router.get(
    "/history",
    getComplaintHistory
);

module.exports = router;