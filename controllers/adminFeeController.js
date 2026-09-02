const db = require("../config/database");

// =====================================================
// FEES DASHBOARD
// =====================================================

const getFeesDashboard = (req, res) => {
    const dashboardSql = `
        SELECT
            COALESCE(
                (SELECT SUM(hostel_fee)
                 FROM students),
                0
            ) AS totalFees,

            COALESCE(
                (SELECT SUM(amount)
                 FROM fees
                 WHERE LOWER(status) IN (
                     'paid',
                     'success',
                     'completed'
                 )),
                0
            ) AS collectedFees,

            COALESCE(
                (SELECT SUM(hostel_fee)
                 FROM students),
                0
            )
            -
            COALESCE(
                (SELECT SUM(amount)
                 FROM fees
                 WHERE LOWER(status) IN (
                     'paid',
                     'success',
                     'completed'
                 )),
                0
            ) AS pendingFees,

            COALESCE(
                (SELECT SUM(amount)
                 FROM fees
                 WHERE LOWER(status) IN (
                     'paid',
                     'success',
                     'completed'
                 )
                 AND MONTH(payment_date) = MONTH(CURDATE())
                 AND YEAR(payment_date) = YEAR(CURDATE())
                ),
                0
            ) AS monthlyCollection,

            (
                SELECT COUNT(*)
                FROM students
            ) AS totalStudents,

            (
                SELECT COUNT(*)
                FROM students s
                WHERE
                    s.hostel_fee > 0
                    AND (
                        SELECT COALESCE(SUM(f.amount), 0)
                        FROM fees f
                        WHERE f.student_id = s.id
                        AND LOWER(f.status) IN (
                            'paid',
                            'success',
                            'completed'
                        )
                    ) >= s.hostel_fee
            ) AS paidStudents,

            (
                SELECT COUNT(*)
                FROM students s
                WHERE
                    s.hostel_fee > 0
                    AND (
                        SELECT COALESCE(SUM(f.amount), 0)
                        FROM fees f
                        WHERE f.student_id = s.id
                        AND LOWER(f.status) IN (
                            'paid',
                            'success',
                            'completed'
                        )
                    ) < s.hostel_fee
            ) AS pendingStudents
    `;

    const recentPaymentsSql = `
        SELECT
            f.id,
            f.student_id,
            f.room_id,
            f.amount,
            f.status,
            f.payment_method,
            f.payment_date,
            s.name AS student_name
        FROM fees f
        LEFT JOIN students s
            ON s.id = f.student_id
        ORDER BY
            f.payment_date DESC,
            f.id DESC
        LIMIT 10
    `;

    db.query(
        dashboardSql,
        (dashboardError, dashboardResults) => {
            if (dashboardError) {
                console.error(
                    "Fees Dashboard Error:",
                    dashboardError
                );

                return res.status(500).json({
                    success: false,
                    message: "Failed to load fees dashboard.",
                    error: dashboardError.message
                });
            }

            db.query(
                recentPaymentsSql,
                (paymentError, paymentResults) => {
                    if (paymentError) {
                        console.error(
                            "Recent Payments Error:",
                            paymentError
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Failed to load recent payments.",
                            error: paymentError.message
                        });
                    }

                    const stats = dashboardResults[0];

                    return res.status(200).json({
                        success: true,
                        stats: {
                            totalFees: Number(stats.totalFees || 0),
                            collectedFees: Number(
                                stats.collectedFees || 0
                            ),
                            pendingFees: Math.max(
                                Number(stats.pendingFees || 0),
                                0
                            ),
                            monthlyCollection: Number(
                                stats.monthlyCollection || 0
                            ),
                            totalStudents: Number(
                                stats.totalStudents || 0
                            ),
                            paidStudents: Number(
                                stats.paidStudents || 0
                            ),
                            pendingStudents: Number(
                                stats.pendingStudents || 0
                            )
                        },
                        recentPayments: paymentResults
                    });
                }
            );
        }
    );
};


// =====================================================
// PAYMENT HISTORY
// =====================================================

const getPaymentHistory = (req, res) => {
    const sql = `
        SELECT
            f.id,
            f.student_id,
            f.room_id,
            f.amount,
            f.status,
            f.payment_method,
            f.payment_date,
            s.name AS student_name,
            s.email AS student_email,
            s.mobile AS student_mobile
        FROM fees f
        LEFT JOIN students s
            ON s.id = f.student_id
        ORDER BY
            f.payment_date DESC,
            f.id DESC
    `;

    db.query(
        sql,
        (err, results) => {
            if (err) {
                console.error(
                    "Payment History Error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Failed to load payment history.",
                    error: err.message
                });
            }

            return res.status(200).json({
                success: true,
                payments: results
            });
        }
    );
};


// =====================================================
// PENDING FEES
// =====================================================

const getPendingFees = (req, res) => {
    const sql = `
        SELECT
            s.id AS student_id,
            s.name,
            s.email,
            s.mobile,
            s.hostel_fee,

            COALESCE(
                (
                    SELECT SUM(f.amount)
                    FROM fees f
                    WHERE f.student_id = s.id
                    AND LOWER(f.status) IN (
                        'paid',
                        'success',
                        'completed'
                    )
                ),
                0
            ) AS paid_amount

        FROM students s

        WHERE s.hostel_fee > 0

        HAVING paid_amount < s.hostel_fee

        ORDER BY
            (s.hostel_fee - paid_amount) DESC
    `;

    db.query(
        sql,
        (err, results) => {
            if (err) {
                console.error(
                    "Pending Fees Error:",
                    err
                );

                return res.status(500).json({
                    success: false,
                    message: "Failed to load pending fees.",
                    error: err.message
                });
            }

            const pendingStudents = results.map(
                (student) => ({
                    ...student,
                    hostel_fee: Number(
                        student.hostel_fee || 0
                    ),
                    paid_amount: Number(
                        student.paid_amount || 0
                    ),
                    pending_amount:
                        Math.max(
                            Number(
                                student.hostel_fee || 0
                            ) -
                            Number(
                                student.paid_amount || 0
                            ),
                            0
                        )
                })
            );

            return res.status(200).json({
                success: true,
                students: pendingStudents
            });
        }
    );
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getFeesDashboard,
    getPaymentHistory,
    getPendingFees
};