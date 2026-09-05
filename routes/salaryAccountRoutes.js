const express = require("express");

const router = express.Router();

const {
    getSalaryAccount,
    saveSalaryAccount,
    deactivateSalaryAccount
} = require("../controllers/salaryAccountController");

router.get(
    "/:personType/:personId",
    getSalaryAccount
);

router.post(
    "/",
    saveSalaryAccount
);

router.patch(
    "/:personType/:personId/deactivate",
    deactivateSalaryAccount
);

module.exports = router;