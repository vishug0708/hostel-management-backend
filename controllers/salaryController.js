const db = require("../config/database");

// =====================================================
// CREATE SALARY
// =====================================================
const createSalary = async (req, res) => {
    try {
        const {
            person_id,
            person_type,
            salary_month,
            salary_year,
            monthly_salary,
            remarks
        } = req.body;

        if (
            !person_id ||
            !person_type ||
            !salary_month ||
            !salary_year ||
            monthly_salary === undefined ||
            monthly_salary === null ||
            monthly_salary === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "All required salary fields are required."
            });
        }

        if (!["staff", "rector"].includes(String(person_type).toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: "Person type must be staff or rector."
            });
        }

        const month = Number(salary_month);
        const year = Number(salary_year);
        const amount = Number(monthly_salary);

        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: "Salary month must be between 1 and 12."
            });
        }

        if (!Number.isInteger(year) || year < 2000) {
            return res.status(400).json({
                success: false,
                message: "Invalid salary year."
            });
        }

        if (Number.isNaN(amount) || amount < 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid monthly salary."
            });
        }

        const type = String(person_type).toLowerCase();

        // =================================================
        // CHECK PERSON
        // =================================================
        let personRows;

        if (type === "staff") {
            [personRows] = await db.query(
                `SELECT id, staff_id, name, email, mobile, status, salary
                 FROM staff
                 WHERE id = ?
                 LIMIT 1`,
                [person_id]
            );
        } else {
            [personRows] = await db.query(
                `SELECT id, rector_id, name, email, phone, status, salary
                 FROM rectors
                 WHERE id = ?
                 LIMIT 1`,
                [person_id]
            );
        }

        if (personRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: `${type === "staff" ? "Staff" : "Rector"} not found.`
            });
        }

        const person = personRows[0];

        // =================================================
        // CHECK DUPLICATE MONTHLY SALARY
        // =================================================
        const [existing] = await db.query(
            `SELECT id
             FROM salary
             WHERE person_id = ?
             AND person_type = ?
             AND salary_month = ?
             AND salary_year = ?
             LIMIT 1`,
            [person_id, type, month, year]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Salary record for this month already exists."
            });
        }

        // =================================================
        // CREATE SALARY
        // =================================================
        const [result] = await db.query(
            `INSERT INTO salary
            (
                person_id,
                person_type,
                salary_month,
                salary_year,
                monthly_salary,
                payment_status,
                remarks
            )
            VALUES (?, ?, ?, ?, ?, 'pending', ?)`,
            [
                person_id,
                type,
                month,
                year,
                amount,
                remarks || null
            ]
        );

        // =================================================
        // CREATE DUE NOTIFICATION
        // =================================================
        const monthName = new Date(year, month - 1, 1).toLocaleString(
            "en-US",
            { month: "long" }
        );

        const title = "Salary Due";

        const message =
            `Your ${monthName} ${year} salary is due.`;

        await db.query(
            `INSERT INTO salary_notifications
            (
                salary_id,
                person_id,
                person_type,
                notification_type,
                title,
                message
            )
            VALUES (?, ?, ?, 'due', ?, ?)
            ON DUPLICATE KEY UPDATE id = id`,
            [
                result.insertId,
                person_id,
                type,
                title,
                message
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Salary created successfully.",
            salary: {
                id: result.insertId,
                person_id,
                person_type: type,
                salary_month: month,
                salary_year: year,
                monthly_salary: amount,
                payment_status: "pending",
                person
            }
        });

    } catch (error) {
        console.error("Create Salary Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while creating salary.",
            error: error.message
        });
    }
};


// =====================================================
// GET ALL SALARIES
// =====================================================
const getAllSalaries = async (req, res) => {
    try {
        const { person_type, payment_status, salary_month, salary_year } = req.query;

        let sql = `
            SELECT
                s.id,
                s.person_id,
                s.person_type,
                s.salary_month,
                s.salary_year,
                s.monthly_salary,
                s.payment_status,
                s.payment_date,
                s.payment_method,
                s.transaction_reference,
                s.razorpay_payout_id,
                s.razorpay_status,
                s.remarks,
                s.created_at,
                CASE
                    WHEN s.person_type = 'staff' THEN st.name
                    WHEN s.person_type = 'rector' THEN r.name
                END AS person_name,
                CASE
                    WHEN s.person_type = 'staff' THEN st.staff_id
                    WHEN s.person_type = 'rector' THEN r.rector_id
                END AS person_code
            FROM salary s
            LEFT JOIN staff st
                ON s.person_type = 'staff'
                AND s.person_id = st.id
            LEFT JOIN rectors r
                ON s.person_type = 'rector'
                AND s.person_id = r.id
            WHERE 1 = 1
        `;

        const params = [];

        if (person_type) {
            sql += ` AND s.person_type = ?`;
            params.push(person_type);
        }

        if (payment_status) {
            sql += ` AND s.payment_status = ?`;
            params.push(payment_status);
        }

        if (salary_month) {
            sql += ` AND s.salary_month = ?`;
            params.push(Number(salary_month));
        }

        if (salary_year) {
            sql += ` AND s.salary_year = ?`;
            params.push(Number(salary_year));
        }

        sql += `
            ORDER BY s.salary_year DESC,
                     s.salary_month DESC,
                     s.id DESC
        `;

        const [rows] = await db.query(sql, params);

        return res.json({
            success: true,
            salaries: rows
        });

    } catch (error) {
        console.error("Get Salaries Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching salaries.",
            error: error.message
        });
    }
};


// =====================================================
// GET SINGLE SALARY
// =====================================================
const getSalary = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `
            SELECT
                s.*,
                CASE
                    WHEN s.person_type = 'staff' THEN st.name
                    WHEN s.person_type = 'rector' THEN r.name
                END AS person_name,
                CASE
                    WHEN s.person_type = 'staff' THEN st.staff_id
                    WHEN s.person_type = 'rector' THEN r.rector_id
                END AS person_code
            FROM salary s
            LEFT JOIN staff st
                ON s.person_type = 'staff'
                AND s.person_id = st.id
            LEFT JOIN rectors r
                ON s.person_type = 'rector'
                AND s.person_id = r.id
            WHERE s.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Salary record not found."
            });
        }

        return res.json({
            success: true,
            salary: rows[0]
        });

    } catch (error) {
        console.error("Get Salary Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching salary.",
            error: error.message
        });
    }
};


// =====================================================
// MARK SALARY AS PAID
// =====================================================
const markSalaryPaid = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            payment_date,
            payment_method,
            transaction_reference,
            razorpay_payout_id,
            razorpay_status,
            remarks
        } = req.body;

        const [salaryRows] = await db.query(
            `SELECT *
             FROM salary
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (salaryRows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Salary record not found."
            });
        }

        const salary = salaryRows[0];

        if (salary.payment_status === "paid") {
            return res.status(400).json({
                success: false,
                message: "Salary is already marked as paid."
            });
        }

        const finalPaymentDate =
            payment_date ||
            new Date().toISOString().slice(0, 10);

        await db.query(
            `UPDATE salary
             SET
                payment_status = 'paid',
                payment_date = ?,
                payment_method = ?,
                transaction_reference = ?,
                razorpay_payout_id = ?,
                razorpay_status = ?,
                remarks = ?
             WHERE id = ?`,
            [
                finalPaymentDate,
                payment_method || null,
                transaction_reference || null,
                razorpay_payout_id || null,
                razorpay_status || null,
                remarks || salary.remarks || null,
                id
            ]
        );

        // =================================================
        // PAID NOTIFICATION
        // =================================================
        const monthName = new Date(
            Number(salary.salary_year),
            Number(salary.salary_month) - 1,
            1
        ).toLocaleString(
            "en-US",
            { month: "long" }
        );

        await db.query(
            `INSERT INTO salary_notifications
            (
                salary_id,
                person_id,
                person_type,
                notification_type,
                title,
                message
            )
            VALUES (?, ?, ?, 'paid', ?, ?)
            ON DUPLICATE KEY UPDATE id = id`,
            [
                salary.id,
                salary.person_id,
                salary.person_type,
                "Salary Paid",
                `Your ${monthName} ${salary.salary_year} salary has been paid.`
            ]
        );

        const [updatedRows] = await db.query(
            `SELECT *
             FROM salary
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        return res.json({
            success: true,
            message: "Salary marked as paid successfully.",
            salary: updatedRows[0]
        });

    } catch (error) {
        console.error("Mark Salary Paid Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while marking salary as paid.",
            error: error.message
        });
    }
};


// =====================================================
// DELETE SALARY
// =====================================================
const deleteSalary = async (req, res) => {
    try {
        const { id } = req.params;

        const [rows] = await db.query(
            `SELECT id
             FROM salary
             WHERE id = ?
             LIMIT 1`,
            [id]
        );

        if (rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Salary record not found."
            });
        }

        await db.query(
            `DELETE FROM salary
             WHERE id = ?`,
            [id]
        );

        return res.json({
            success: true,
            message: "Salary record deleted successfully."
        });

    } catch (error) {
        console.error("Delete Salary Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while deleting salary.",
            error: error.message
        });
    }
};


// =====================================================
// GET STAFF SALARY
// =====================================================
const getStaffSalaries = async (req, res) => {
    try {
        const {
            salary_month,
            salary_year,
            payment_status
        } = req.query;

        let sql = `
            SELECT
                s.id,
                s.person_id,
                s.person_type,
                s.salary_month,
                s.salary_year,
                s.monthly_salary,
                s.payment_status,
                s.payment_date,
                s.payment_method,
                s.transaction_reference,
                s.razorpay_payout_id,
                s.razorpay_status,
                s.remarks,
                s.created_at,
                st.staff_id AS person_code,
                st.name AS person_name,
                st.email,
                st.mobile,
                st.status AS person_status
            FROM salary s
            INNER JOIN staff st
                ON s.person_id = st.id
            WHERE s.person_type = 'staff'
        `;

        const params = [];

        if (salary_month) {
            sql += ` AND s.salary_month = ?`;
            params.push(Number(salary_month));
        }

        if (salary_year) {
            sql += ` AND s.salary_year = ?`;
            params.push(Number(salary_year));
        }

        if (payment_status) {
            sql += ` AND s.payment_status = ?`;
            params.push(payment_status);
        }

        sql += `
            ORDER BY
                s.salary_year DESC,
                s.salary_month DESC,
                st.name ASC
        `;

        const [rows] = await db.query(sql, params);

        return res.json({
            success: true,
            salaries: rows
        });

    } catch (error) {
        console.error("Get Staff Salaries Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching staff salaries.",
            error: error.message
        });
    }
};


// =====================================================
// GET RECTOR SALARY
// =====================================================
const getRectorSalaries = async (req, res) => {
    try {
        const {
            salary_month,
            salary_year,
            payment_status
        } = req.query;

        let sql = `
            SELECT
                s.id,
                s.person_id,
                s.person_type,
                s.salary_month,
                s.salary_year,
                s.monthly_salary,
                s.payment_status,
                s.payment_date,
                s.payment_method,
                s.transaction_reference,
                s.razorpay_payout_id,
                s.razorpay_status,
                s.remarks,
                s.created_at,
                r.rector_id AS person_code,
                r.name AS person_name,
                r.email,
                r.phone,
                r.status AS person_status
            FROM salary s
            INNER JOIN rectors r
                ON s.person_id = r.id
            WHERE s.person_type = 'rector'
        `;

        const params = [];

        if (salary_month) {
            sql += ` AND s.salary_month = ?`;
            params.push(Number(salary_month));
        }

        if (salary_year) {
            sql += ` AND s.salary_year = ?`;
            params.push(Number(salary_year));
        }

        if (payment_status) {
            sql += ` AND s.payment_status = ?`;
            params.push(payment_status);
        }

        sql += `
            ORDER BY
                s.salary_year DESC,
                s.salary_month DESC,
                r.name ASC
        `;

        const [rows] = await db.query(sql, params);

        return res.json({
            success: true,
            salaries: rows
        });

    } catch (error) {
        console.error("Get Rector Salaries Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching rector salaries.",
            error: error.message
        });
    }
};


// =====================================================
// GET PENDING SALARIES
// =====================================================
const getPendingSalaries = async (req, res) => {
    try {
        const {
            person_type,
            salary_month,
            salary_year
        } = req.query;

        let sql = `
            SELECT
                s.id,
                s.person_id,
                s.person_type,
                s.salary_month,
                s.salary_year,
                s.monthly_salary,
                s.payment_status,
                s.payment_date,
                s.payment_method,
                s.transaction_reference,
                s.remarks,
                CASE
                    WHEN s.person_type = 'staff'
                        THEN st.staff_id
                    WHEN s.person_type = 'rector'
                        THEN r.rector_id
                END AS person_code,
                CASE
                    WHEN s.person_type = 'staff'
                        THEN st.name
                    WHEN s.person_type = 'rector'
                        THEN r.name
                END AS person_name
            FROM salary s
            LEFT JOIN staff st
                ON s.person_type = 'staff'
                AND s.person_id = st.id
            LEFT JOIN rectors r
                ON s.person_type = 'rector'
                AND s.person_id = r.id
            WHERE s.payment_status = 'pending'
        `;

        const params = [];

        if (person_type) {
            if (!["staff", "rector"].includes(person_type)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid person type."
                });
            }

            sql += ` AND s.person_type = ?`;
            params.push(person_type);
        }

        if (salary_month) {
            sql += ` AND s.salary_month = ?`;
            params.push(Number(salary_month));
        }

        if (salary_year) {
            sql += ` AND s.salary_year = ?`;
            params.push(Number(salary_year));
        }

        sql += `
            ORDER BY
                s.salary_year DESC,
                s.salary_month DESC,
                s.id DESC
        `;

        const [rows] = await db.query(sql, params);

        return res.json({
            success: true,
            salaries: rows
        });

    } catch (error) {
        console.error("Get Pending Salaries Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching pending salaries.",
            error: error.message
        });
    }
};


// =====================================================
// GET PAYMENT HISTORY
// =====================================================
const getPaymentHistory = async (req, res) => {
    try {
        const {
            person_type,
            salary_month,
            salary_year,
            payment_method
        } = req.query;

        let sql = `
            SELECT
                s.id,
                s.person_id,
                s.person_type,
                s.salary_month,
                s.salary_year,
                s.monthly_salary,
                s.payment_status,
                s.payment_date,
                s.payment_method,
                s.transaction_reference,
                s.razorpay_payout_id,
                s.razorpay_status,
                s.remarks,
                s.created_at,
                CASE
                    WHEN s.person_type = 'staff'
                        THEN st.staff_id
                    WHEN s.person_type = 'rector'
                        THEN r.rector_id
                END AS person_code,
                CASE
                    WHEN s.person_type = 'staff'
                        THEN st.name
                    WHEN s.person_type = 'rector'
                        THEN r.name
                END AS person_name
            FROM salary s
            LEFT JOIN staff st
                ON s.person_type = 'staff'
                AND s.person_id = st.id
            LEFT JOIN rectors r
                ON s.person_type = 'rector'
                AND s.person_id = r.id
            WHERE s.payment_status = 'paid'
        `;

        const params = [];

        if (person_type) {
            if (!["staff", "rector"].includes(person_type)) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid person type."
                });
            }

            sql += ` AND s.person_type = ?`;
            params.push(person_type);
        }

        if (salary_month) {
            sql += ` AND s.salary_month = ?`;
            params.push(Number(salary_month));
        }

        if (salary_year) {
            sql += ` AND s.salary_year = ?`;
            params.push(Number(salary_year));
        }

        if (payment_method) {
            sql += ` AND s.payment_method = ?`;
            params.push(payment_method);
        }

        sql += `
            ORDER BY
                s.payment_date DESC,
                s.id DESC
        `;

        const [rows] = await db.query(sql, params);

        return res.json({
            success: true,
            salaries: rows
        });

    } catch (error) {
        console.error("Get Payment History Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while fetching payment history.",
            error: error.message
        });
    }
};


// =====================================================
// MONTHLY SALARY REPORT
// =====================================================
const getSalaryReport = async (req, res) => {
    try {
        const {
            salary_month,
            salary_year
        } = req.query;

        if (!salary_month || !salary_year) {
            return res.status(400).json({
                success: false,
                message: "Salary month and year are required."
            });
        }

        const month = Number(salary_month);
        const year = Number(salary_year);

        if (month < 1 || month > 12) {
            return res.status(400).json({
                success: false,
                message: "Invalid salary month."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                person_type,
                COUNT(*) AS total_records,
                SUM(monthly_salary) AS total_salary,
                SUM(
                    CASE
                        WHEN payment_status = 'paid'
                        THEN monthly_salary
                        ELSE 0
                    END
                ) AS total_paid,
                SUM(
                    CASE
                        WHEN payment_status = 'pending'
                        THEN monthly_salary
                        ELSE 0
                    END
                ) AS total_pending
            FROM salary
            WHERE salary_month = ?
            AND salary_year = ?
            GROUP BY person_type
            ORDER BY person_type
            `,
            [month, year]
        );

        const [overallRows] = await db.query(
            `
            SELECT
                COUNT(*) AS total_records,
                SUM(monthly_salary) AS total_salary,
                SUM(
                    CASE
                        WHEN payment_status = 'paid'
                        THEN monthly_salary
                        ELSE 0
                    END
                ) AS total_paid,
                SUM(
                    CASE
                        WHEN payment_status = 'pending'
                        THEN monthly_salary
                        ELSE 0
                    END
                ) AS total_pending
            FROM salary
            WHERE salary_month = ?
            AND salary_year = ?
            `,
            [month, year]
        );

        return res.json({
            success: true,
            month,
            year,
            report: rows,
            overall: overallRows[0]
        });

    } catch (error) {
        console.error("Salary Report Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error while generating salary report.",
            error: error.message
        });
    }
};


// =====================================================
// EXPORT
// =====================================================
module.exports = {
    createSalary,
    getAllSalaries,
    getSalary,
    markSalaryPaid,
    deleteSalary,
    getStaffSalaries,
    getRectorSalaries,
    getPendingSalaries,
    getPaymentHistory,
    getSalaryReport
};