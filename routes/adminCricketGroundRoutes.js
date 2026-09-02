const express = require("express");

const router = express.Router();

const {
    getGrounds,
    getGroundById,
    addGround,
    updateGround,
    deleteGround
} = require("../controllers/adminCricketGroundController");

router.get(
    "/",
    getGrounds
);

router.get(
    "/:id",
    getGroundById
);

router.post(
    "/",
    addGround
);

router.put(
    "/:id",
    updateGround
);

router.delete(
    "/:id",
    deleteGround
);

module.exports = router;