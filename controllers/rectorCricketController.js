const db = require("../config/database");
const jwt = require("jsonwebtoken");

/*
 * Rector Cricket Box Controller
 *
 * New backend module only.
 * Existing admin/student/rector files are not modified.
 *
 * Authentication:
 * - Supports the project's current `rector-<id>` token format.
 * - Also accepts a normal JWT if the Rector login is later changed to JWT.
 */

const getRectorId = async (req) => {
    if (req.user && req.user.id) {
        return Number(req.user.id);
    }

    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
        ? authHeader.slice(7).trim()
        : "";

    if (!token) {
        return null;
    }

    // Current project RectorLogin stores: rector-<rector_id>
    const legacyMatch = token.match(/^rector-(\d+)$/);
    if (legacyMatch) {
        return Number(legacyMatch[1]);
    }

    // Future/normal JWT support
    try {
        const secret = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;
        if (!secret) {
            return null;
        }

        const decoded = jwt.verify(token, secret);
        return Number(decoded.id || decoded.rector_id || decoded.userId || 0) || null;
    } catch (error) {
        return null;
    }
};

const verifyRector = async (req, res) => {
    const rectorId = await getRectorId(req);

    if (!rectorId) {
        res.status(401).json({
            success: false,
            message: "Rector authentication required."
        });
        return null;
    }

    try {
        const [rectors] = await db.query(
            `SELECT id, rector_id, name, email, status, photo
             FROM rectors
             WHERE id = ?
             LIMIT 1`,
            [rectorId]
        );

        if (!rectors.length) {
            res.status(401).json({
                success: false,
                message: "Rector account not found."
            });
            return null;
        }

        const rector = rectors[0];

        if (String(rector.status).toLowerCase() !== "active") {
            res.status(403).json({
                success: false,
                message: "Your Rector account is inactive. Please contact the administrator."
            });
            return null;
        }

        req.rector = rector;
        return rector;
    } catch (error) {
        console.error("Rector Verification Error:", error);
        res.status(500).json({
            success: false,
            message: "Unable to verify Rector account."
        });
        return null;
    }
};

const getCricketStats = async (req, res) => {
    try {
        const rector = await verifyRector(req, res);
        if (!rector) return;

        const [rows] = await db.query(`
            SELECT
                COALESCE(SUM(CASE WHEN booking_status = 'Pending Approval' THEN 1 ELSE 0 END), 0) AS pendingApproval,
                COALESCE(SUM(CASE WHEN booking_status = 'Confirmed' THEN 1 ELSE 0 END), 0) AS confirmed,
                COALESCE(SUM(CASE WHEN booking_status = 'Rejected' THEN 1 ELSE 0 END), 0) AS rejected,
                COALESCE(SUM(CASE WHEN booking_status = 'Completed' THEN 1 ELSE 0 END), 0) AS completed
            FROM cricket_bookings
        `);

        const stats = rows[0] || {};

        return res.status(200).json({
            success: true,
            stats: {
                pendingApproval: Number(stats.pendingApproval || 0),
                confirmed: Number(stats.confirmed || 0),
                rejected: Number(stats.rejected || 0),
                completed: Number(stats.completed || 0)
            }
        });
    } catch (error) {
        console.error("Rector Cricket Stats Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load Cricket Box statistics.",
            error: error.message
        });
    }
};

const getCricketBookings = async (req, res) => {
    try {
        const rector = await verifyRector(req, res);
        if (!rector) return;

        const requestedStatus = String(req.query.status || "All").trim();

        const allowedStatuses = [
            "Pending Approval",
            "Confirmed",
            "Rejected",
            "Completed"
        ];

        let sql = `
            SELECT
                cb.id,
                cb.student_id,
                cb.ground_id,
                cb.booking_date,
                cb.start_time,
                cb.end_time,
                cb.total_amount,
                cb.booking_status,
                cb.payment_status,
                cb.rector_remark,
                cb.approved_at,
                cb.rejected_at,
                cb.created_at,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.photo AS student_photo,
                cg.name AS ground_name,
                cg.location AS ground_location,
                cp.transaction_id,
                cp.payment_method,
                cp.paid_at
            FROM cricket_bookings cb
            LEFT JOIN students s
                ON s.id = cb.student_id
            LEFT JOIN cricket_grounds cg
                ON cg.id = cb.ground_id
            LEFT JOIN cricket_payments cp
                ON cp.booking_id = cb.id
        `;

        const params = [];

        if (requestedStatus !== "All") {
            if (!allowedStatuses.includes(requestedStatus)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid booking status filter."
                });
            }

            sql += ` WHERE cb.booking_status = ? `;
            params.push(requestedStatus);
        }

        sql += `
            ORDER BY
                CASE
                    WHEN cb.booking_status = 'Pending Approval' THEN 1
                    WHEN cb.booking_status = 'Confirmed' THEN 2
                    WHEN cb.booking_status = 'Completed' THEN 3
                    WHEN cb.booking_status = 'Rejected' THEN 4
                    ELSE 5
                END,
                cb.booking_date ASC,
                cb.start_time ASC,
                cb.id DESC
        `;

        const [bookings] = await db.query(sql, params);

        return res.status(200).json({
            success: true,
            bookings
        });
    } catch (error) {
        console.error("Rector Cricket Bookings Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load Cricket Box bookings.",
            error: error.message
        });
    }
};

const getCricketBookingById = async (req, res) => {
    try {
        const rector = await verifyRector(req, res);
        if (!rector) return;

        const bookingId = Number(req.params.id);

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }

        const [bookings] = await db.query(
            `
            SELECT
                cb.id,
                cb.student_id,
                cb.ground_id,
                cb.booking_date,
                cb.start_time,
                cb.end_time,
                cb.total_amount,
                cb.booking_status,
                cb.payment_status,
                cb.rector_remark,
                cb.approved_at,
                cb.rejected_at,
                cb.created_at,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile,
                s.photo AS student_photo,
                cg.name AS ground_name,
                cg.location AS ground_location,
                cg.description AS ground_description,
                cg.capacity AS ground_capacity,
                cg.price_per_hour,
                cp.transaction_id,
                cp.payment_method,
                cp.paid_at,
                cp.refunded_at
            FROM cricket_bookings cb
            LEFT JOIN students s
                ON s.id = cb.student_id
            LEFT JOIN cricket_grounds cg
                ON cg.id = cb.ground_id
            LEFT JOIN cricket_payments cp
                ON cp.booking_id = cb.id
            WHERE cb.id = ?
            LIMIT 1
            `,
            [bookingId]
        );

        if (!bookings.length) {
            return res.status(404).json({
                success: false,
                message: "Cricket Box booking not found."
            });
        }

        const booking = bookings[0];

        const [players] = await db.query(
            `
            SELECT
                id,
                booking_id,
                student_name,
                student_id,
                mobile,
                created_at
            FROM cricket_booking_players
            WHERE booking_id = ?
            ORDER BY id ASC
            `,
            [bookingId]
        );

        return res.status(200).json({
            success: true,
            booking: {
                ...booking,
                players
            },
            players
        });
    } catch (error) {
        console.error("Rector Cricket Booking Details Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load Cricket Box booking details.",
            error: error.message
        });
    }
};

const updateCricketBookingStatus = async (req, res) => {
    const connection = await db.getConnection();

    try {
        const rector = await verifyRector(req, res);
        if (!rector) {
            connection.release();
            return;
        }

        const bookingId = Number(req.params.id);
        const requestedStatus = String(req.body.booking_status || "").trim();
        const rectorRemark =
            req.body.rector_remark === undefined ||
            req.body.rector_remark === null
                ? ""
                : String(req.body.rector_remark).trim();

        const allowedStatuses = ["Confirmed", "Rejected"];

        if (!Number.isInteger(bookingId) || bookingId <= 0) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: "Invalid booking ID."
            });
        }

        if (!allowedStatuses.includes(requestedStatus)) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: "Only Confirmed or Rejected status is allowed."
            });
        }

        if (requestedStatus === "Rejected" && !rectorRemark) {
            connection.release();
            return res.status(400).json({
                success: false,
                message: "Please enter a reason before rejecting the booking."
            });
        }

        await connection.beginTransaction();

        const [bookingRows] = await connection.query(
            `
            SELECT
                id,
                student_id,
                ground_id,
                booking_date,
                start_time,
                end_time,
                total_amount,
                booking_status,
                payment_status
            FROM cricket_bookings
            WHERE id = ?
            FOR UPDATE
            `,
            [bookingId]
        );

        if (!bookingRows.length) {
            await connection.rollback();
            connection.release();

            return res.status(404).json({
                success: false,
                message: "Cricket Box booking not found."
            });
        }

        const booking = bookingRows[0];

        if (booking.booking_status !== "Pending Approval") {
            await connection.rollback();
            connection.release();

            return res.status(409).json({
                success: false,
                message: `This booking is already ${booking.booking_status}.`
            });
        }

        // When approving, make sure another active booking has not
        // taken the same ground/date/time while this request was pending.
        if (requestedStatus === "Confirmed") {
            const [conflictRows] = await connection.query(
                `
                SELECT id
                FROM cricket_bookings
                WHERE ground_id = ?
                  AND booking_date = ?
                  AND start_time = ?
                  AND end_time = ?
                  AND id <> ?
                  AND booking_status IN ('Pending Approval', 'Confirmed')
                LIMIT 1
                `,
                [
                    booking.ground_id,
                    booking.booking_date,
                    booking.start_time,
                    booking.end_time,
                    bookingId
                ]
            );

            if (conflictRows.length) {
                await connection.rollback();
                connection.release();

                return res.status(409).json({
                    success: false,
                    message: "This Cricket Box time slot is no longer available."
                });
            }
        }

        if (requestedStatus === "Confirmed") {
            await connection.query(
                `
                UPDATE cricket_bookings
                SET
                    booking_status = 'Confirmed',
                    rector_remark = ?,
                    approved_at = NOW(),
                    rejected_at = NULL
                WHERE id = ?
                `,
                [rectorRemark || null, bookingId]
            );
        } else {
            await connection.query(
                `
                UPDATE cricket_bookings
                SET
                    booking_status = 'Rejected',
                    rector_remark = ?,
                    rejected_at = NOW(),
                    approved_at = NULL
                WHERE id = ?
                `,
                [rectorRemark, bookingId]
            );
        }

        await connection.commit();
        connection.release();

        return res.status(200).json({
            success: true,
            message:
                requestedStatus === "Confirmed"
                    ? "Cricket Box booking approved successfully."
                    : "Cricket Box booking rejected successfully.",
            booking_status: requestedStatus
        });
    } catch (error) {
        try {
            await connection.rollback();
        } catch (rollbackError) {
            console.error("Rector Cricket Rollback Error:", rollbackError);
        }

        connection.release();

        console.error("Rector Cricket Booking Status Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to update Cricket Box booking status.",
            error: error.message
        });
    }
};

module.exports = {
    getCricketStats,
    getCricketBookings,
    getCricketBookingById,
    updateCricketBookingStatus
};
