const jwt = require("jsonwebtoken");
const db = require("../config/database");

const ROLE = "CricketBox QR Handler";

// =====================================================
// AUTHENTICATE CRICKET BOX QR HANDLER
// =====================================================

const authenticateStaff = (req, res) => {
    try {
        const authHeader = req.headers.authorization || "";
        const parts = authHeader.split(" ");

        if (parts.length !== 2 || parts[0] !== "Bearer") {
            throw new Error("Access denied. Please login first.");
        }

        const token = parts[1];

        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );

        const role =
            decoded.role ||
            decoded.staff_role ||
            decoded.staffRole ||
            decoded.designation ||
            decoded.staffType ||
            "";

        const staffId =
            decoded.id ||
            decoded.staffId ||
            decoded.staff_id;

        if (!staffId) {
            throw new Error("Invalid staff token.");
        }

        if (
            String(role).trim().toLowerCase() !==
            ROLE.toLowerCase()
        ) {
            throw new Error(
                "Access denied. CricketBox QR Handler role required."
            );
        }

        return Number(staffId);
    } catch (error) {
        const statusCode = error.message.includes(
            "role required"
        )
            ? 403
            : 401;

        res.status(statusCode).json({
            success: false,
            message: error.message
        });

        return null;
    }
};

// =====================================================
// GET CRICKET BOX QR HANDLER STATS
// =====================================================

const getCricketStats = async (req, res) => {
    const staffId = authenticateStaff(req, res);

    if (!staffId) {
        return;
    }

    try {
        const [[bookingStats]] = await db.query(`
            SELECT COUNT(*) AS total
            FROM cricket_bookings
            WHERE booking_date = CURDATE()
              AND booking_status = 'Confirmed'
        `);

        const [[scanStats]] = await db.query(
            `
            SELECT
                COUNT(*) AS scannedToday,
                SUM(scan_status = 'Valid') AS validToday,
                SUM(scan_status <> 'Valid') AS rejectedToday
            FROM cricket_booking_qr_logs
            WHERE DATE(scanned_at) = CURDATE()
              AND scanned_by = ?
            `,
            [staffId]
        );

        return res.json({
            success: true,
            stats: {
                todayBookings:
                    Number(bookingStats.total) || 0,

                scannedToday:
                    Number(scanStats.scannedToday) || 0,

                validToday:
                    Number(scanStats.validToday) || 0,

                rejectedToday:
                    Number(scanStats.rejectedToday) || 0
            }
        });
    } catch (error) {
        console.error(
            "Cricket QR Handler Stats Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================================
// SCAN AND VERIFY CRICKET BOOKING QR
// ENTRY + EXIT
// =====================================================

const getIndiaDateTime = () => {
    const now = new Date();

    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: "Asia/Kolkata",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23"
    }).formatToParts(now);

    const getPart = (type) =>
        parts.find((part) => part.type === type)?.value || "00";

    return {
        date: `${getPart("year")}-${getPart("month")}-${getPart("day")}`,
        time: `${getPart("hour")}:${getPart("minute")}:${getPart("second")}`,
        now
    };
};

const makeIndiaDate = (date, time) => {
    const cleanDate = String(date || "").slice(0, 10);
    const cleanTime = String(time || "00:00:00").slice(0, 8);

    return new Date(`${cleanDate}T${cleanTime}+05:30`);
};

const scanCricketQr = async (req, res) => {
    const staffId = authenticateStaff(req, res);

    if (!staffId) {
        return;
    }

    const qrToken = String(
        req.body.qr_token || ""
    ).trim();

    if (!qrToken) {
        return res.status(400).json({
            success: false,
            message: "QR token is required."
        });
    }

    let connection;

    try {
        connection = await db.getConnection();
        await connection.beginTransaction();

        // =================================================
        // FIND QR + BOOKING DETAILS
        // =================================================

        const [rows] = await connection.query(
            `
            SELECT
                q.id AS qr_id,
                q.booking_id AS booking_id,
                q.qr_token,
                q.qr_status,
                q.expires_at,
                q.scan_count,

                b.student_id,
                DATE_FORMAT(b.booking_date, '%Y-%m-%d') AS booking_date,
                b.start_time,
                b.end_time,
                b.payment_status,
                b.booking_status,

                s.name AS student_name,
                s.mobile AS student_mobile,

                cg.name AS ground_name

            FROM cricket_booking_qr q
            INNER JOIN cricket_bookings b
                ON b.id = q.booking_id
            INNER JOIN students s
                ON s.id = b.student_id
            INNER JOIN cricket_grounds cg
                ON cg.id = b.ground_id
            WHERE q.qr_token = ?
            LIMIT 1
            FOR UPDATE
            `,
            [qrToken]
        );

        // =================================================
        // QR NOT FOUND
        // =================================================

        if (rows.length === 0) {
            await connection.query(
                `
                INSERT INTO cricket_booking_qr_logs
                (
                    booking_id,
                    qr_id,
                    scanned_by,
                    scan_status,
                    remarks
                )
                VALUES
                (
                    NULL,
                    NULL,
                    ?,
                    'Invalid',
                    ?
                )
                `,
                [
                    staffId,
                    "QR token not found."
                ]
            );

            await connection.commit();

            return res.status(404).json({
                success: false,
                message: "Invalid QR code.",
                scan_status: "Invalid",
                action: "DENIED"
            });
        }

        const booking = rows[0];
        const india = getIndiaDateTime();
        const today = india.date;
        const now = india.now;

        const bookingDate = String(
            booking.booking_date || ""
        ).trim().slice(0, 10);

        const bookingStartTime = String(
            booking.start_time || "00:00:00"
        ).slice(0, 8);

        const bookingEndTime = String(
            booking.end_time || "00:00:00"
        ).slice(0, 8);

        // =================================================
        // BASIC VALIDATION
        // =================================================

        let scanStatus = "Valid";
        let remarks = "QR verified successfully.";

        // =================================================
        // BOOKING STATUS
        // =================================================

        if (booking.booking_status !== "Confirmed") {
            scanStatus = "Rejected";
            remarks = "Booking is not confirmed.";
        }

        // =================================================
        // PAYMENT STATUS
        // =================================================

        else if (booking.payment_status !== "Paid") {
            scanStatus = "Rejected";
            remarks = "Payment has not been completed.";
        }

        // =================================================
        // QR REVOKED
        // =================================================

        else if (booking.qr_status === "Revoked") {
            scanStatus = "Rejected";
            remarks = "QR code has been revoked.";
        }

        // =================================================
        // BOOKING TIME VALIDATION - INDIA TIME
        // =================================================

        else {
            const startDateTime = makeIndiaDate(
                bookingDate,
                bookingStartTime
            );

            const isOvernight =
                bookingEndTime <= bookingStartTime;

            const endDate = isOvernight
                ? (() => {
                    const date = new Date(
                        `${bookingDate}T00:00:00+05:30`
                    );
                    date.setUTCDate(date.getUTCDate() + 1);
                    return date.toISOString().slice(0, 10);
                })()
                : bookingDate;

            const endDateTime = makeIndiaDate(
                endDate,
                bookingEndTime
            );

            // Before booking starts
            if (now < startDateTime) {
                scanStatus = "Rejected";
                remarks = "QR code is not active yet. Booking has not started.";
            }

            // At or after booking end
            else if (now >= endDateTime) {
                scanStatus = "Expired";
                remarks = "QR code has expired.";

                await connection.query(
                    `
                    UPDATE cricket_booking_qr
                    SET qr_status = 'Expired'
                    WHERE id = ?
                    `,
                    [booking.qr_id]
                );
            }

            // Booking is currently active
            else {
                // If an old QR was marked Expired by the previous
                // timezone-bugged logic, reactivate it while the
                // actual booking window is still active.
                if (booking.qr_status === "Expired") {
                    await connection.query(
                        `
                        UPDATE cricket_booking_qr
                        SET qr_status = 'Active',
                            expires_at = DATE_ADD(
                                STR_TO_DATE(
                                    CONCAT(
                                        ?,
                                        ' ',
                                        ?
                                    ),
                                    '%Y-%m-%d %H:%i:%s'
                                ),
                                INTERVAL IF(
                                    TIME(?) <= TIME(?),
                                    1,
                                    0
                                ) DAY
                            )
                        WHERE id = ?
                        `,
                        [
                            bookingDate,
                            bookingEndTime,
                            bookingEndTime,
                            bookingStartTime,
                            booking.qr_id
                        ]
                    );
                }
            }
        }

        // =================================================
        // GET PREVIOUS VALID SCANS
        // =================================================

        let validScanCount = 0;

        if (scanStatus === "Valid") {
            const [validScans] = await connection.query(
                `
                SELECT
                    id,
                    scanned_at,
                    remarks
                FROM cricket_booking_qr_logs
                WHERE booking_id = ?
                  AND qr_id = ?
                  AND scan_status = 'Valid'
                ORDER BY scanned_at ASC
                `,
                [
                    booking.booking_id,
                    booking.qr_id
                ]
            );

            validScanCount = validScans.length;
        }

        // =================================================
        // ENTRY
        // =================================================

        if (
            scanStatus === "Valid" &&
            validScanCount === 0
        ) {
            remarks =
                "ENTRY ALLOWED. Student is allowed to enter the cricket box.";
        }

        // =================================================
        // EXIT
        // =================================================

        else if (
            scanStatus === "Valid" &&
            validScanCount === 1
        ) {
            remarks =
                "EXIT ALLOWED. Student is allowed to exit the cricket box.";
        }

        // =================================================
        // THIRD OR MORE VALID SCAN
        // =================================================

        else if (
            scanStatus === "Valid" &&
            validScanCount >= 2
        ) {
            scanStatus = "Rejected";
            remarks =
                "Entry and exit have already been completed for this booking.";
        }

        // =================================================
        // SAVE SCAN LOG
        // =================================================

        await connection.query(
            `
            INSERT INTO cricket_booking_qr_logs
            (
                booking_id,
                qr_id,
                scanned_by,
                scan_status,
                remarks
            )
            VALUES
            (?, ?, ?, ?, ?)
            `,
            [
                booking.booking_id,
                booking.qr_id,
                staffId,
                scanStatus,
                remarks
            ]
        );

        // =================================================
        // UPDATE SCAN COUNT
        // =================================================

        await connection.query(
            `
            UPDATE cricket_booking_qr
            SET scan_count = scan_count + 1,
                scanned_by = ?
            WHERE id = ?
            `,
            [
                staffId,
                booking.qr_id
            ]
        );

        // =================================================
        // FIRST VALID SCAN = ENTRY
        // =================================================

        if (
            scanStatus === "Valid" &&
            validScanCount === 0
        ) {
            await connection.query(
                `
                UPDATE cricket_booking_qr
                SET qr_status = 'Used',
                    used_at = NOW()
                WHERE id = ?
                `,
                [booking.qr_id]
            );
        }

        await connection.commit();

        // =================================================
        // RESPONSE BOOKING
        // =================================================

        const responseBooking = {
            booking_id: booking.booking_id,
            student_name: booking.student_name,
            student_mobile: booking.student_mobile,
            ground_name: booking.ground_name,
            booking_date: booking.booking_date,
            start_time: booking.start_time,
            end_time: booking.end_time,
            payment_status: booking.payment_status,
            booking_status: booking.booking_status
        };

        // =================================================
        // DENIED / EXPIRED
        // =================================================

        if (scanStatus !== "Valid") {
            return res.status(400).json({
                success: false,
                message: remarks,
                scan_status: scanStatus,
                action: "DENIED",
                booking: responseBooking
            });
        }

        // =================================================
        // ENTRY RESPONSE
        // =================================================

        if (validScanCount === 0) {
            return res.json({
                success: true,
                message:
                    "ENTRY ALLOWED. Student may enter the cricket box.",
                scan_status: "Valid",
                action: "ENTRY",
                booking: responseBooking
            });
        }

        // =================================================
        // EXIT RESPONSE
        // =================================================

        if (validScanCount === 1) {
            return res.json({
                success: true,
                message:
                    "EXIT ALLOWED. Student may exit the cricket box.",
                scan_status: "Valid",
                action: "EXIT",
                booking: responseBooking
            });
        }

        return res.status(400).json({
            success: false,
            message:
                "Entry and exit have already been completed.",
            scan_status: "Rejected",
            action: "DENIED",
            booking: responseBooking
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Cricket QR Rollback Error:",
                    rollbackError
                );
            }
        }

        console.error(
            "Cricket QR Scan Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Unable to verify QR code.",
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// =====================================================
// GET QR SCAN HISTORY
// =====================================================

const getScanHistory = async (req, res) => {
    const staffId = authenticateStaff(req, res);

    if (!staffId) {
        return;
    }

    try {
        const allowedStatuses = [
            "Valid",
            "Expired",
            "Invalid",
            "Already Used",
            "Rejected"
        ];

        const status = String(
            req.query.status || ""
        ).trim();

        let condition = "";

        const params = [staffId];

        if (
            allowedStatuses.includes(status)
        ) {
            condition =
                "AND l.scan_status = ?";

            params.push(status);
        }

        const [logs] = await db.query(
            `
            SELECT
                l.id,
                l.booking_id,
                l.qr_id,
                l.scanned_at,
                l.scan_status,
                l.remarks,

                s.name AS student_name,

                cg.name AS ground_name

            FROM cricket_booking_qr_logs l

            LEFT JOIN cricket_bookings b
                ON b.id = l.booking_id

            LEFT JOIN students s
                ON s.id = b.student_id

            LEFT JOIN cricket_grounds cg
                ON cg.id = b.ground_id

            WHERE l.scanned_by = ?

            ${condition}

            ORDER BY l.scanned_at DESC

            LIMIT 200
            `,
            params
        );

        return res.json({
            success: true,
            logs
        });
    } catch (error) {
        console.error(
            "Cricket QR Scan History Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getCricketStats,
    scanCricketQr,
    getScanHistory
};