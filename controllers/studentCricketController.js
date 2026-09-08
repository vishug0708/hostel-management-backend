const crypto = require("crypto");
const Razorpay = require("razorpay");
const db = require("../config/database");

// =====================================================
// GET AVAILABLE CRICKET GROUNDS
// =====================================================

const getGrounds = async (req, res) => {
    try {
        const [grounds] = await db.query(`
            SELECT
                id,
                name,
                location,
                description,
                capacity,
                price_per_hour,
                opening_time,
                closing_time,
                slot_duration,
                status
            FROM cricket_grounds
            WHERE status = 'Active'
            ORDER BY name ASC
        `);

        return res.status(200).json({
            success: true,
            grounds
        });
    } catch (error) {
        console.error("Student Cricket Grounds Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cricket grounds.",
            error: error.message
        });
    }
};


// =====================================================
// GET AVAILABLE SLOTS FOR GROUND
// =====================================================

const getGroundSlots = async (req, res) => {
    try {
        const { groundId } = req.params;

        const [groundRows] = await db.query(
            `
            SELECT
                id,
                name,
                status
            FROM cricket_grounds
            WHERE id = ?
            LIMIT 1
            `,
            [groundId]
        );

        if (groundRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cricket ground not found."
            });
        }

        if (groundRows[0].status !== "Active") {
            return res.status(400).json({
                success: false,
                message: "This cricket ground is currently inactive."
            });
        }

        const [slots] = await db.query(
            `
            SELECT
                id,
                ground_id,
                slot_name,
                start_time,
                end_time,
                price,
                status
            FROM cricket_slots
            WHERE ground_id = ?
              AND status = 'Active'
            ORDER BY start_time ASC
            `,
            [groundId]
        );

        return res.status(200).json({
            success: true,
            ground: groundRows[0],
            slots
        });
    } catch (error) {
        console.error("Student Cricket Slots Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cricket slots.",
            error: error.message
        });
    }
};


// =====================================================
// GET SINGLE SLOT
// =====================================================

const getSlotById = async (req, res) => {
    try {
        const { slotId } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                cs.id,
                cs.ground_id,
                cs.slot_name,
                cs.start_time,
                cs.end_time,
                cs.price,
                cs.status,
                cg.name AS ground_name,
                cg.location AS ground_location,
                cg.capacity AS ground_capacity
            FROM cricket_slots cs
            INNER JOIN cricket_grounds cg
                ON cs.ground_id = cg.id
            WHERE cs.id = ?
            LIMIT 1
            `,
            [slotId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cricket slot not found."
            });
        }

        if (rows[0].status !== "Active") {
            return res.status(400).json({
                success: false,
                message: "This slot is currently inactive."
            });
        }

        if (rows[0].ground_capacity === null) {
            return res.status(200).json({
                success: true,
                slot: rows[0]
            });
        }

        return res.status(200).json({
            success: true,
            slot: rows[0]
        });
    } catch (error) {
        console.error("Student Cricket Slot Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cricket slot.",
            error: error.message
        });
    }
};


// =====================================================
// CREATE CRICKET BOOKING
// =====================================================

const createBooking = async (req, res) => {
    let connection;

    try {
        const studentId = Number(req.user.id);

        const {
            ground_id,
            slot_id,
            booking_date,
            players = []
        } = req.body;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Student authentication required."
            });
        }

        if (!ground_id || !slot_id || !booking_date) {
            return res.status(400).json({
                success: false,
                message: "Ground, slot and booking date are required."
            });
        }

        if (!Array.isArray(players) || players.length === 0) {
            return res.status(400).json({
                success: false,
                message: "At least one player is required."
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        // -------------------------------------------------
        // CHECK STUDENT
        // -------------------------------------------------

        const [studentRows] = await connection.query(
            `
            SELECT
                id,
                name,
                email,
                mobile
            FROM students
            WHERE id = ?
            LIMIT 1
            `,
            [studentId]
        );

        if (studentRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Student not found."
            });
        }

        const student = studentRows[0];

        // -------------------------------------------------
        // CHECK GROUND + SLOT
        // -------------------------------------------------

        const [slotRows] = await connection.query(
            `
            SELECT
                cs.id,
                cs.ground_id,
                cs.slot_name,
                cs.start_time,
                cs.end_time,
                cs.price,
                cs.status AS slot_status,
                cg.name AS ground_name,
                cg.capacity,
                cg.status AS ground_status
            FROM cricket_slots cs
            INNER JOIN cricket_grounds cg
                ON cs.ground_id = cg.id
            WHERE cs.id = ?
              AND cs.ground_id = ?
            LIMIT 1
            `,
            [slot_id, ground_id]
        );

        if (slotRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message: "Selected cricket slot not found."
            });
        }

        const slot = slotRows[0];

        // -------------------------------------------------
        // CHECK PLAYER CAPACITY
        // -------------------------------------------------

        const capacity = Number(slot.capacity || 0);

        if (capacity > 0 && players.length > capacity) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: `Maximum ${capacity} students are allowed for this cricket box.`
            });
        }

        if (
            slot.slot_status !== "Active" ||
            slot.ground_status !== "Active"
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Selected cricket slot is not available."
            });
        }

        // -------------------------------------------------
        // DATE VALIDATION
        // -------------------------------------------------

        const selectedDate = new Date(`${booking_date}T00:00:00`);
        const today = new Date();

        today.setHours(0, 0, 0, 0);

        if (
            Number.isNaN(selectedDate.getTime()) ||
            selectedDate < today
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message: "Booking date must be today or a future date."
            });
        }

        // -------------------------------------------------
        // CHECK EXISTING BOOKING FOR SAME SLOT
        // -------------------------------------------------

        const [existingBookings] = await connection.query(
            `
            SELECT
                id
            FROM cricket_bookings
            WHERE ground_id = ?
              AND booking_date = ?
              AND start_time = ?
              AND end_time = ?
              AND booking_status IN ('Pending Approval', 'Confirmed')
            LIMIT 1
            `,
            [
                ground_id,
                booking_date,
                slot.start_time,
                slot.end_time
            ]
        );

        if (existingBookings.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "This slot is already booked for the selected date."
            });
        }

        // -------------------------------------------------
        // PREVENT STUDENT DOUBLE BOOKING
        // -------------------------------------------------

        const [studentExistingBooking] = await connection.query(
            `
            SELECT
                id
            FROM cricket_bookings
            WHERE student_id = ?
              AND booking_date = ?
              AND start_time = ?
              AND end_time = ?
              AND booking_status IN ('Pending Approval', 'Confirmed')
            LIMIT 1
            `,
            [
                studentId,
                booking_date,
                slot.start_time,
                slot.end_time
            ]
        );

        if (studentExistingBooking.length > 0) {
            await connection.rollback();

            return res.status(409).json({
                success: false,
                message: "You already have a booking for this time slot."
            });
        }

        // -------------------------------------------------
        // TOTAL AMOUNT
        // -------------------------------------------------

        const totalAmount = Number(slot.price || 0);

        // -------------------------------------------------
        // CREATE BOOKING
        // -------------------------------------------------

        const [bookingResult] = await connection.query(
            `
    INSERT INTO cricket_bookings
    (
        student_id,
        ground_id,
        booking_date,
        start_time,
        end_time,
        total_amount,
        booking_status,
        payment_status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'Pending Approval', 'Pending')
    `,
            [
                studentId,
                ground_id,
                booking_date,
                slot.start_time,
                slot.end_time,
                totalAmount
            ]
        );

        const bookingId = bookingResult.insertId;

        // -------------------------------------------------
        // ADD BOOKING STUDENT AS FIRST PLAYER
        // -------------------------------------------------

        await connection.query(
            `
            INSERT INTO cricket_booking_players
            (
                booking_id,
                student_name,
                student_id,
                mobile
            )
            VALUES (?, ?, ?, ?)
            `,
            [
                bookingId,
                student.name,
                String(student.id),
                student.mobile || null
            ]
        );

        // -------------------------------------------------
        // ADD OTHER PLAYERS
        // -------------------------------------------------

        for (const player of players) {
            const playerName = String(player.student_name || "").trim();

            if (!playerName) {
                continue;
            }

            const playerId = player.student_id
                ? String(player.student_id).trim()
                : null;

            const playerMobile = player.mobile
                ? String(player.mobile).trim()
                : null;

            const isSameStudent =
                playerId &&
                playerId === String(student.id);

            if (isSameStudent) {
                continue;
            }

            await connection.query(
                `
                INSERT INTO cricket_booking_players
                (
                    booking_id,
                    student_name,
                    student_id,
                    mobile
                )
                VALUES (?, ?, ?, ?)
                `,
                [
                    bookingId,
                    playerName,
                    playerId,
                    playerMobile
                ]
            );
        }

        await connection.commit();

        return res.status(201).json({
            success: true,
            message: "Cricket booking created successfully.",
            booking: {
                id: bookingId,
                student_id: studentId,
                student_name: student.name,
                ground_id: Number(ground_id),
                ground_name: slot.ground_name,
                slot_id: Number(slot_id),
                slot_name: slot.slot_name,
                booking_date,
                start_time: slot.start_time,
                end_time: slot.end_time,
                total_amount: totalAmount,
                booking_status: "Pending Approval",
                payment_status: "Pending"
            }
        });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error("Cricket Booking Rollback Error:", rollbackError);
            }
        }

        console.error("Create Cricket Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to create cricket booking.",
            error: error.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// =====================================================
// GET MY BOOKINGS
// =====================================================

const getMyBookings = async (req, res) => {
    try {
        const studentId = Number(req.user.id);

        const [bookings] = await db.query(
            `
            SELECT
                cb.id,
                cb.id AS booking_id,
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
                cg.name AS ground_name,
                cg.location AS ground_location
            FROM cricket_bookings cb
            LEFT JOIN cricket_grounds cg
                ON cb.ground_id = cg.id
            WHERE cb.student_id = ?
            ORDER BY cb.created_at DESC
            `,
            [studentId]
        );

        return res.status(200).json({
            success: true,
            bookings
        });
    } catch (error) {
        console.error("Get My Cricket Bookings Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch your cricket bookings.",
            error: error.message
        });
    }
};


// =====================================================
// GET MY BOOKING BY ID
// =====================================================

const getMyBookingById = async (req, res) => {
    try {
        const studentId = Number(req.user.id);
        const { id } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                cb.id,
                cb.id AS booking_id,
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
                cg.name AS ground_name,
                cg.location AS ground_location,
                cp.transaction_id,
                cp.payment_method,
                cp.paid_at,
                cp.refunded_at
            FROM cricket_bookings cb
            LEFT JOIN cricket_grounds cg
                ON cb.ground_id = cg.id
            LEFT JOIN cricket_payments cp
                ON cb.id = cp.booking_id
            WHERE cb.id = ?
              AND cb.student_id = ?
            LIMIT 1
            `,
            [id, studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        const [players] = await db.query(
            `
            SELECT
                id,
                booking_id,
                student_name,
                student_id,
                mobile
            FROM cricket_booking_players
            WHERE booking_id = ?
            ORDER BY id ASC
            `,
            [id]
        );

        const [qrRows] = await db.query(
            `
            SELECT
                id,
                booking_id,
                qr_token,
                qr_status,
                generated_at,
                expires_at,
                used_at,
                scan_count
            FROM cricket_booking_qr
            WHERE booking_id = ?
            LIMIT 1
            `,
            [id]
        );

        return res.status(200).json({
            success: true,
            booking: rows[0],
            players,
            qr: qrRows[0] || null
        });
    } catch (error) {
        console.error("Get My Cricket Booking Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch booking details.",
            error: error.message
        });
    }
};


// =====================================================
// GET BOOKING PLAYERS
// =====================================================

const getBookingPlayers = async (req, res) => {
    try {
        const studentId = Number(req.user.id);
        const { id } = req.params;

        const [bookingRows] = await db.query(
            `
            SELECT
                id
            FROM cricket_bookings
            WHERE id = ?
              AND student_id = ?
            LIMIT 1
            `,
            [id, studentId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

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
            [id]
        );

        return res.status(200).json({
            success: true,
            players
        });
    } catch (error) {
        console.error("Get Cricket Booking Players Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch booking players.",
            error: error.message
        });
    }
};


// =====================================================
// GET BOOKING QR
// =====================================================

const getBookingQr = async (req, res) => {
    try {
        const studentId = Number(req.user.id);
        const { id } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                cb.id AS booking_id,
                cb.booking_status,
                cb.payment_status,
                q.id AS qr_id,
                q.qr_token,
                q.qr_status,
                q.generated_at,
                q.expires_at,
                q.used_at,
                q.scan_count
            FROM cricket_bookings cb
            LEFT JOIN cricket_booking_qr q
                ON cb.id = q.booking_id
            WHERE cb.id = ?
              AND cb.student_id = ?
            LIMIT 1
            `,
            [id, studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        return res.status(200).json({
            success: true,
            qr: rows[0].qr_id ? rows[0] : null
        });
    } catch (error) {
        console.error("Get Cricket Booking QR Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch booking QR.",
            error: error.message
        });
    }
};

// =====================================================
// SEARCH STUDENTS FOR CRICKET BOOKING
// =====================================================

const searchStudents = async (req, res) => {
    try {
        const { name } = req.query;

        if (!name || name.trim().length < 2) {
            return res.status(200).json({
                success: true,
                students: []
            });
        }

        const searchName = `%${name.trim()}%`;

        const [students] = await db.query(
            `
            SELECT
                id,
                name,
                mobile
            FROM students
            WHERE name LIKE ?
            ORDER BY name ASC
            LIMIT 10
            `,
            [searchName]
        );

        return res.status(200).json({
            success: true,
            students
        });
    } catch (error) {
        console.error("Search Cricket Students Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to search students.",
            error: error.message
        });
    }
};



// =====================================================
// CREATE RAZORPAY TEST ORDER
// =====================================================

const createPaymentOrder = async (req, res) => {
    try {
        const studentId = Number(req.user.id);
        const { id } = req.params;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Student authentication required."
            });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Razorpay test keys are not configured on the server."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                cb.id,
                cb.student_id,
                cb.total_amount,
                cb.booking_status,
                cb.payment_status,
                s.name AS student_name,
                s.email AS student_email,
                s.mobile AS student_mobile
            FROM cricket_bookings cb
            LEFT JOIN students s
                ON cb.student_id = s.id
            WHERE cb.id = ?
              AND cb.student_id = ?
            LIMIT 1
            `,
            [id, studentId]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        const booking = rows[0];

        if (booking.booking_status !== "Confirmed") {
            return res.status(400).json({
                success: false,
                message: "Payment is available only after Rector approval."
            });
        }

        if (booking.payment_status === "Paid") {
            return res.status(400).json({
                success: false,
                message: "This booking has already been paid."
            });
        }

        const amount = Number(booking.total_amount || 0);
        const amountInPaise = Math.round(amount * 100);

        if (!Number.isFinite(amountInPaise) || amountInPaise <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid booking amount."
            });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        const order = await razorpay.orders.create({
            amount: amountInPaise,
            currency: "INR",
            receipt: `cricket_${booking.id}_${Date.now()}`,
            notes: {
                booking_id: String(booking.id),
                student_id: String(studentId)
            }
        });

        return res.status(200).json({
            success: true,
            key_id: process.env.RAZORPAY_KEY_ID,
            order_id: order.id,
            amount: order.amount,
            currency: order.currency,
            booking_id: booking.id,
            student: {
                name: booking.student_name || "",
                email: booking.student_email || "",
                mobile: booking.student_mobile || ""
            }
        });
    } catch (error) {
        console.error("Create Razorpay Order Error:", error);

        return res.status(500).json({
            success: false,
            message: "Unable to create Razorpay payment order.",
            error: error.message
        });
    }
};


// =====================================================
// VERIFY RAZORPAY PAYMENT
// =====================================================

const verifyPayment = async (req, res) => {
    let connection;

    try {
        const studentId = Number(req.user.id);
        const { id } = req.params;
        const {
            razorpay_order_id,
            razorpay_payment_id,
            razorpay_signature
        } = req.body;

        if (!studentId) {
            return res.status(401).json({
                success: false,
                message: "Student authentication required."
            });
        }

        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment verification data is incomplete."
            });
        }

        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({
                success: false,
                message: "Razorpay test keys are not configured on the server."
            });
        }

        const [bookingRows] = await db.query(
            `
            SELECT
                cb.id,
                cb.student_id,
                cb.total_amount,
                cb.booking_status,
                cb.payment_status
            FROM cricket_bookings cb
            WHERE cb.id = ?
              AND cb.student_id = ?
            LIMIT 1
            `,
            [id, studentId]
        );

        if (bookingRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Booking not found."
            });
        }

        const booking = bookingRows[0];

        if (booking.booking_status !== "Confirmed") {
            return res.status(400).json({
                success: false,
                message: "Payment is allowed only for Rector-approved bookings."
            });
        }

        if (booking.payment_status === "Paid") {
            return res.status(200).json({
                success: true,
                message: "Payment is already completed.",
                payment_id: razorpay_payment_id
            });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET
        });

        // Fetch the order from Razorpay so the server verifies the order
        // amount/receipt instead of trusting client-supplied amount data.
        const order = await razorpay.orders.fetch(razorpay_order_id);
        const expectedAmount = Math.round(Number(booking.total_amount || 0) * 100);

        if (
            !order ||
            order.id !== razorpay_order_id ||
            order.currency !== "INR" ||
            Number(order.amount) !== expectedAmount ||
            !String(order.receipt || "").startsWith(`cricket_${booking.id}_`)
        ) {
            return res.status(400).json({
                success: false,
                message: "Razorpay order verification failed."
            });
        }

        const generatedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${order.id}|${razorpay_payment_id}`)
            .digest("hex");

        if (generatedSignature !== razorpay_signature) {
            return res.status(400).json({
                success: false,
                message: "Invalid Razorpay payment signature."
            });
        }

        const payment = await razorpay.payments.fetch(razorpay_payment_id);

        if (
            !payment ||
            payment.id !== razorpay_payment_id ||
            payment.order_id !== order.id ||
            Number(payment.amount) !== expectedAmount ||
            payment.currency !== "INR"
        ) {
            return res.status(400).json({
                success: false,
                message: "Razorpay payment details do not match this booking."
            });
        }

        if (payment.status !== "captured") {
            return res.status(400).json({
                success: false,
                message: `Payment is not captured yet. Current status: ${payment.status || "unknown"}.`
            });
        }

        connection = await db.getConnection();
        await connection.beginTransaction();

        const [existingPayment] = await connection.query(
            `
            SELECT id, transaction_id
            FROM cricket_payments
            WHERE booking_id = ?
            LIMIT 1
            `,
            [booking.id]
        );

        if (existingPayment.length > 0) {
            await connection.query(
                `
        UPDATE cricket_payments
        SET student_id = ?,
            amount = ?,
            transaction_id = ?,
            payment_method = ?,
            paid_at = NOW()
        WHERE booking_id = ?
        `,
                [
                    studentId,
                    Number(booking.total_amount),
                    razorpay_payment_id,
                    "Razorpay",
                    booking.id
                ]
            );
        } else {
            await connection.query(
                `
    INSERT INTO cricket_payments
    (
        booking_id,
        student_id,
        amount,
        transaction_id,
        payment_method,
        paid_at
    )
    VALUES (?, ?, ?, ?, 'Razorpay', NOW())
    `,
                [
                    booking.id,
                    studentId,
                    Number(booking.total_amount),
                    payment.id
                ]
            );
        }

        await connection.query(
            `
            UPDATE cricket_bookings
            SET payment_status = 'Paid'
            WHERE id = ?
              AND student_id = ?
            `,
            [booking.id, studentId]
        );

        await connection.commit();

        return res.status(200).json({
            success: true,
            message: "Payment verified successfully.",
            payment_id: razorpay_payment_id,
            payment_status: "Paid"
        });
    } catch (error) {
        console.error("Razorpay Payment Verification Error:", error);
        console.error(
            "Razorpay Verification Error Details:",
            error?.error?.description ||
            error?.description ||
            error?.message
        );

        return res.status(500).json({
            success: false,
            message: "Payment verification failed.",
            error:
                error?.error?.description ||
                error?.description ||
                error?.message
        });
    } finally {
        if (connection) {
            connection.release();
        }
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getGrounds,
    getGroundSlots,
    getSlotById,
    createBooking,
    getMyBookings,
    getMyBookingById,
    getBookingPlayers,
    getBookingQr,
    searchStudents,
    createPaymentOrder,
    verifyPayment
};