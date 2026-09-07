const express = require("express");

const router = express.Router();

const {
    razorpayPayoutWebhook
} = require("../controllers/razorpayWebhookController");

router.post(
    "/razorpayx/payout",
    express.raw({
        type: "application/json"
    }),
    (req, res, next) => {
        try {
            req.rawBody = req.body;
            req.body = JSON.parse(req.body.toString("utf8"));
            next();
        } catch (error) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook JSON."
            });
        }
    },
    razorpayPayoutWebhook
);

module.exports = router;