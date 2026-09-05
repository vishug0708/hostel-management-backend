const db = require("../config/database");
const jwt = require("jsonwebtoken");
const {
    generateMonthlySalaryRecords,
    createPaidNotification
} = require("../services/salaryService");

const requireAdmin = (req, res) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ")
        ? header.slice(7).trim()
        : "";

    const secret = process.env.JWT_SECRET;

    if (!token) {
        res.status(401).json({
            success: false,
            message: "Unauthorized. Admin token required."
        });
        return null;
    }

    if (!secret) {
        res.status(500).json({
            success: false,
            message: "JWT secret is not configured."
        });
        return null;
    }

    try {
        const decoded = jwt.verify(token, secret);

        if (String(decoded.role).toLowerCase() !== "admin") {
            res.status(403).json({
                success: false,
                message: "Admin access only."
            });
            return null;
        }

        return decoded;
    } catch (error) {
        res.status(401).json({
            success: false,
            message: "Invalid or expired admin token."
        });
        return null;
    }
};

const buildSalaryQuery = async ({
    personType = null,
    paymentStatus = null,
    month = null,
    year = null
}) => {
    const conditions = [];
    const params = [];

    if (personType === "staff" || personType === "rector") {
        conditions.push("s.person_type = ?");
        params.push(personType);
    }

    if (paymentStatus === "pending" || paymentStatus === "paid") {
        conditions.push("s.payment_status = ?");
        params.push(paymentStatus);
    }

    if (
        month !== null &&
        month !== undefined &&
        String(month).match(/^([1-9]|1[0-2])$/)
    ) {
        conditions.push("s.salary_month = ?");
        params.push(Number(month));
    }

    if (
        year !== null &&
        year !== undefined &&
        String(year).match(/^\d{4}$/)
    ) {
        conditions.push("s.salary_year = ?");
        params.push(Number(year));
    }

    const where = conditions.length
        ? `WHERE ${conditions.join(" AND ")}`
        : "";

    const query = `
        SELECT
            s.id,
            s.person_id,
            s.person_type,

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
            END AS person_name,

            CASE
                WHEN s.person_type = 'staff'
                THEN st.email
                WHEN s.person_type = 'rector'
                THEN r.email
            END AS email,

            s.salary_month,
            s.salary_year,
            s.monthly_salary,
            s.payment_status,
            s.payment_date,
            s.payment_method,
            s.transaction_reference,
            s.remarks,
            s.created_at

        FROM salary s

        LEFT JOIN staff st
            ON s.person_type = 'staff'
            AND s.person_id = st.id

        LEFT JOIN rectors r
            ON s.person_type = 'rector'
            AND s.person_id = r.id

        ${where}

        ORDER BY
            s.salary_year DESC,
            s.salary_month DESC,
            person_name ASC
    `;

    const [rows] = await db.query(query, params);

    return rows;
};

const generateMonthly = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const result = await generateMonthlySalaryRecords();

        return res.json({
            success: true,
            message: "Monthly salary records generated successfully.",
            ...result
        });
    } catch (error) {
        console.error("Generate monthly salary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to generate monthly salary records."
        });
    }
};

const getAllSalary = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await generateMonthlySalaryRecords();

        const rows = await buildSalaryQuery({
            personType: req.query.personType,
            paymentStatus: req.query.paymentStatus,
            month: req.query.month,
            year: req.query.year
        });

        return res.json({
            success: true,
            salaries: rows
        });
    } catch (error) {
        console.error("Admin salary list error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load salary records."
        });
    }
};

const getStaffSalary = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await generateMonthlySalaryRecords();

        const rows = await buildSalaryQuery({
            personType: "staff",
            paymentStatus: req.query.paymentStatus,
            month: req.query.month,
            year: req.query.year
        });

        return res.json({
            success: true,
            salaries: rows
        });
    } catch (error) {
        console.error("Admin staff salary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load staff salary records."
        });
    }
};

const getRectorSalary = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await generateMonthlySalaryRecords();

        const rows = await buildSalaryQuery({
            personType: "rector",
            paymentStatus: req.query.paymentStatus,
            month: req.query.month,
            year: req.query.year
        });

        return res.json({
            success: true,
            salaries: rows
        });
    } catch (error) {
        console.error("Admin rector salary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load rector salary records."
        });
    }
};

const getPendingSalary = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        await generateMonthlySalaryRecords();

        const rows = await buildSalaryQuery({
            paymentStatus: "pending",
            personType:
                req.query.personType === "staff" ||
                req.query.personType === "rector"
                    ? req.query.personType
                    : null,
            month: req.query.month,
            year: req.query.year
        });

        return res.json({
            success: true,
            salaries: rows
        });
    } catch (error) {
        console.error("Pending salary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load pending salary records."
        });
    }
};

const getSalaryHistory = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const rows = await buildSalaryQuery({
            paymentStatus: "paid",
            personType:
                req.query.personType === "staff" ||
                req.query.personType === "rector"
                    ? req.query.personType
                    : null,
            month: req.query.month,
            year: req.query.year
        });

        return res.json({
            success: true,
            salaries: rows
        });
    } catch (error) {
        console.error("Salary history error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load salary payment history."
        });
    }
};

const getSalaryById = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid salary ID."
            });
        }

        const [rows] = await db.query(
            `
            SELECT
                s.*,

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
                END AS person_name,

                CASE
                    WHEN s.person_type = 'staff'
                    THEN st.email
                    WHEN s.person_type = 'rector'
                    THEN r.email
                END AS email

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

        if (!rows[0]) {
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
        console.error("Get salary by ID error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load salary record."
        });
    }
};

const paySalary = async (req, res) => {
    if (!requireAdmin(req, res)) return;

    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid salary ID."
            });
        }

        const {
            payment_date,
            payment_method,
            transaction_reference,
            remarks
        } = req.body;

        const [rows] = await db.query(
            `
            SELECT
                id,
                person_id,
                person_type,
                salary_month,
                salary_year,
                monthly_salary,
                payment_status
            FROM salary
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (!rows[0]) {
            return res.status(404).json({
                success: false,
                message: "Salary record not found."
            });
        }

        if (rows[0].payment_status === "paid") {
            return res.status(400).json({
                success: false,
                message: "This salary is already marked as paid."
            });
        }

        const dateValue =
            payment_date ||
            new Date().toISOString().slice(0, 10);

        const [result] = await db.query(
            `
            UPDATE salary
            SET
                payment_status = 'paid',
                payment_date = ?,
                payment_method = ?,
                transaction_reference = ?,
                remarks = ?
            WHERE id = ?
            AND payment_status = 'pending'
            `,
            [
                dateValue,
                payment_method || null,
                transaction_reference || null,
                remarks || null,
                id
            ]
        );

        if (!result.affectedRows) {
            return res.status(409).json({
                success: false,
                message: "Salary could not be marked as paid."
            });
        }

        await createPaidNotification(id, dateValue);

        return res.json({
            success: true,
            message: "Salary marked as paid successfully."
        });
    } catch (error) {
        console.error("Pay salary error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to process salary payment."
        });
    }
};

module.exports = {
    generateMonthly,
    getAllSalary,
    getStaffSalary,
    getRectorSalary,
    getPendingSalary,
    getSalaryHistory,
    getSalaryById,
    paySalary
};