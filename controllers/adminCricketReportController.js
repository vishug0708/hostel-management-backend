const db = require("../config/database");

const getCricketReports = (req, res) => {
    const {
        from_date,
        to_date,
        ground_id,
        status
    } = req.query;

    let where = "WHERE 1 = 1";
    const params = [];

    if (from_date) {
        where += " AND cb.booking_date >= ?";
        params.push(from_date);
    }

    if (to_date) {
        where += " AND cb.booking_date <= ?";
        params.push(to_date);
    }

    if (ground_id) {
        where += " AND cb.ground_id = ?";
        params.push(ground_id);
    }

    if (status) {
        where += " AND cb.booking_status = ?";
        params.push(status);
    }

    const summarySql = `
        SELECT
            COUNT(*) AS totalBookings,
            SUM(
                CASE
                    WHEN cb.booking_status = 'Confirmed'
                    THEN 1
                    ELSE 0
                END
            ) AS confirmedBookings,
            SUM(
                CASE
                    WHEN cb.booking_status = 'Pending'
                    THEN 1
                    ELSE 0
                END
            ) AS pendingBookings,
            SUM(
                CASE
                    WHEN cb.booking_status = 'Completed'
                    THEN 1
                    ELSE 0
                END
            ) AS completedBookings,
            COALESCE(
                SUM(cb.total_amount),
                0
            ) AS totalRevenue,
            COALESCE(
                SUM(
                    CASE
                        WHEN cb.payment_status = 'Paid'
                        THEN cb.total_amount
                        ELSE 0
                    END
                ),
                0
            ) AS paidRevenue
        FROM cricket_bookings cb
        ${where}
    `;

    db.query(
        summarySql,
        params,
        (summaryError, summaryRows) => {
            if (summaryError) {
                console.error(
                    "Cricket Report Summary Error:",
                    summaryError
                );

                return res.status(500).json({
                    success: false,
                    message: "Failed to fetch report summary.",
                    error: summaryError.message
                });
            }

            const groundSql = `
                SELECT
                    cg.id AS ground_id,
                    cg.name AS ground_name,
                    cg.location,
                    COUNT(cb.id) AS total_bookings,
                    SUM(
                        CASE
                            WHEN cb.booking_status = 'Confirmed'
                            THEN 1
                            ELSE 0
                        END
                    ) AS confirmed_bookings,
                    SUM(
                        CASE
                            WHEN cb.booking_status = 'Completed'
                            THEN 1
                            ELSE 0
                        END
                    ) AS completed_bookings,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN cb.payment_status = 'Paid'
                                THEN cb.total_amount
                                ELSE 0
                            END
                        ),
                        0
                    ) AS revenue
                FROM cricket_grounds cg
                LEFT JOIN cricket_bookings cb
                    ON cb.ground_id = cg.id
                    ${from_date ? "AND cb.booking_date >= ?" : ""}
                    ${to_date ? "AND cb.booking_date <= ?" : ""}
                    ${ground_id ? "AND cb.ground_id = ?" : ""}
                    ${status ? "AND cb.booking_status = ?" : ""}
                GROUP BY
                    cg.id,
                    cg.name,
                    cg.location
                HAVING COUNT(cb.id) > 0
                ORDER BY total_bookings DESC
            `;

            const groundParams = [];

            if (from_date) {
                groundParams.push(from_date);
            }

            if (to_date) {
                groundParams.push(to_date);
            }

            if (ground_id) {
                groundParams.push(ground_id);
            }

            if (status) {
                groundParams.push(status);
            }

            db.query(
                groundSql,
                groundParams,
                (groundError, groundReport) => {
                    if (groundError) {
                        console.error(
                            "Cricket Ground Report Error:",
                            groundError
                        );

                        return res.status(500).json({
                            success: false,
                            message: "Failed to fetch ground report.",
                            error: groundError.message
                        });
                    }

                    const dailySql = `
                        SELECT
                            cb.booking_date,
                            COUNT(*) AS total_bookings,
                            SUM(
                                CASE
                                    WHEN cb.booking_status = 'Confirmed'
                                    THEN 1
                                    ELSE 0
                                END
                            ) AS confirmed_bookings,
                            SUM(
                                CASE
                                    WHEN cb.booking_status = 'Completed'
                                    THEN 1
                                    ELSE 0
                                END
                            ) AS completed_bookings,
                            COALESCE(
                                SUM(
                                    CASE
                                        WHEN cb.payment_status = 'Paid'
                                        THEN cb.total_amount
                                        ELSE 0
                                    END
                                ),
                                0
                            ) AS revenue
                        FROM cricket_bookings cb
                        ${where}
                        GROUP BY cb.booking_date
                        ORDER BY cb.booking_date DESC
                    `;

                    db.query(
                        dailySql,
                        params,
                        (dailyError, dailyReport) => {
                            if (dailyError) {
                                console.error(
                                    "Cricket Daily Report Error:",
                                    dailyError
                                );

                                return res.status(500).json({
                                    success: false,
                                    message: "Failed to fetch daily report.",
                                    error: dailyError.message
                                });
                            }

                            const groundsSql = `
                                SELECT
                                    id,
                                    name
                                FROM cricket_grounds
                                WHERE status = 'Active'
                                ORDER BY name ASC
                            `;

                            db.query(
                                groundsSql,
                                (groundsError, grounds) => {
                                    if (groundsError) {
                                        console.error(
                                            "Cricket Grounds Report Error:",
                                            groundsError
                                        );

                                        return res.status(500).json({
                                            success: false,
                                            message:
                                                "Failed to fetch cricket grounds.",
                                            error:
                                                groundsError.message
                                        });
                                    }

                                    return res.status(200).json({
                                        success: true,
                                        summary:
                                            summaryRows[0] || {},
                                        groundReport,
                                        dailyReport,
                                        grounds
                                    });
                                }
                            );
                        }
                    );
                }
            );
        }
    );
};

module.exports = {
    getCricketReports
};