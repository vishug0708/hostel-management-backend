const db = require("../config/database");

// =====================================================
// GET CRICKET BOOKING HISTORY
// =====================================================

const getBookingHistory = (req, res) => {
    const sql = `
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
            s.name AS student_name,
            s.email AS student_email,
            cp.transaction_id,
            cp.payment_method,
            cp.paid_at,
            cp.refunded_at
        FROM cricket_bookings cb
        LEFT JOIN cricket_grounds cg
            ON cb.ground_id = cg.id
        LEFT JOIN students s
            ON cb.student_id = s.id
        LEFT JOIN cricket_payments cp
            ON cb.id = cp.booking_id
        ORDER BY cb.created_at DESC
    `;

    db.query(sql, (err, bookings) => {
        if (err) {
            console.error(
                "Get Cricket Booking History Error:",
                err
            );

            return res.status(500).json({
                success: false,
                message: "Failed to fetch cricket booking history.",
                error: err.message
            });
        }

        return res.status(200).json({
            success: true,
            bookings
        });
    });
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getBookingHistory
};