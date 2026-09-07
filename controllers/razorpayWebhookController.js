const crypto = require("crypto");
const db = require("../config/database");
const { createPaidNotification } = require("../services/salaryService");

function verifyWebhookSignature(rawBody, signature, secret) {
    if (!rawBody || !signature || !secret) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");

    return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
    );
}

const razorpayPayoutWebhook = async (req, res) => {
    try {
        const signature =
            req.headers["x-razorpay-signature"];

        const webhookSecret =
            process.env.RAZORPAYX_WEBHOOK_SECRET;

        if (!webhookSecret) {
            console.error(
                "RAZORPAYX_WEBHOOK_SECRET is not configured."
            );

            return res.status(500).json({
                success: false,
                message: "Webhook secret is not configured."
            });
        }

        /*
         * IMPORTANT:
         * req.rawBody must contain the original
         * unparsed webhook body.
         */
        const rawBody = req.rawBody;

        if (!rawBody) {
            return res.status(400).json({
                success: false,
                message: "Raw webhook body is missing."
            });
        }

        const isValid = verifyWebhookSignature(
            rawBody,
            signature,
            webhookSecret
        );

        if (!isValid) {
            return res.status(400).json({
                success: false,
                message: "Invalid webhook signature."
            });
        }

        const event = req.body;

        const eventName = event?.event;

        const payout =
            event?.payload?.payout?.entity;

        if (!eventName || !payout?.id) {
            return res.status(200).json({
                success: true,
                message: "Webhook received but no payout data found."
            });
        }

        const payoutId = payout.id;

        /*
         * Save webhook event.
         * Duplicate event will be ignored safely.
         */
        const [insertResult] = await db.query(
            `
            INSERT IGNORE INTO salary_payout_webhook_logs
            (
                razorpay_payout_id,
                event_name,
                payload
            )
            VALUES (?, ?, ?)
            `,
            [
                payoutId,
                eventName,
                JSON.stringify(event)
            ]
        );

        /*
         * If same payout + same event was already processed,
         * don't process it again.
         */
        if (insertResult.affectedRows === 0) {
            return res.status(200).json({
                success: true,
                message: "Duplicate webhook ignored."
            });
        }

        /*
         * Find salary using Razorpay payout ID.
         */
        const [salaryRows] = await db.query(
            `
            SELECT
                id,
                person_id,
                person_type,
                payment_status
            FROM salary
            WHERE razorpay_payout_id = ?
            LIMIT 1
            `,
            [payoutId]
        );

        /*
         * Webhook can arrive for a payout that our
         * application doesn't know about.
         */
        if (!salaryRows[0]) {
            return res.status(200).json({
                success: true,
                message: "Payout received but salary record not found."
            });
        }

        const salary = salaryRows[0];

        const payoutStatus =
            String(payout.status || "").toLowerCase();

        /*
         * PROCESSED
         */
        if (
            eventName === "payout.processed" ||
            payoutStatus === "processed"
        ) {
            const paymentDate =
                new Date().toISOString().slice(0, 10);

            const [result] = await db.query(
                `
                UPDATE salary
                SET
                    payment_status = 'paid',
                    payment_date = ?,
                    payment_method = 'RazorpayX Test',
                    transaction_reference = ?,
                    razorpay_status = 'processed'
                WHERE id = ?
                  AND payment_status <> 'paid'
                `,
                [
                    paymentDate,
                    payoutId,
                    salary.id
                ]
            );

            /*
             * Only create notification when the DB
             * actually changed to paid.
             */
            if (result.affectedRows > 0) {
                await createPaidNotification(
                    salary.id,
                    paymentDate
                );
            }

            return res.status(200).json({
                success: true,
                message: "Salary marked as paid."
            });
        }

        /*
         * REVERSED
         */
        if (
            eventName === "payout.reversed" ||
            payoutStatus === "reversed"
        ) {
            await db.query(
                `
                UPDATE salary
                SET
                    payment_status = 'pending',
                    payment_date = NULL,
                    razorpay_status = 'reversed'
                WHERE id = ?
                `,
                [salary.id]
            );

            return res.status(200).json({
                success: true,
                message: "Payout reversed. Salary returned to pending."
            });
        }

        /*
         * FAILED / REJECTED
         */
        if (
            eventName === "payout.failed" ||
            eventName === "payout.rejected" ||
            payoutStatus === "failed" ||
            payoutStatus === "rejected"
        ) {
            await db.query(
                `
                UPDATE salary
                SET
                    payment_status = 'pending',
                    payment_date = NULL,
                    razorpay_status = ?
                WHERE id = ?
                `,
                [
                    payoutStatus || "failed",
                    salary.id
                ]
            );

            return res.status(200).json({
                success: true,
                message: "Payout failed. Salary remains pending."
            });
        }

        /*
         * QUEUED / INITIATED / PROCESSING
         */
        await db.query(
            `
            UPDATE salary
            SET
                razorpay_status = ?
            WHERE id = ?
            `,
            [
                payoutStatus || eventName,
                salary.id
            ]
        );

        return res.status(200).json({
            success: true,
            message: "Payout status updated."
        });

    } catch (error) {
        console.error(
            "RazorpayX webhook error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Webhook processing failed."
        });
    }
};

module.exports = {
    razorpayPayoutWebhook
};