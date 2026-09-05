const db = require("../config/database");
const jwt = require("jsonwebtoken");
const {
    generateMonthlySalaryRecords,
    createPaidNotification
} = require("../services/salaryService");

const {
    createPayout,
    getPayout
} = require("../services/razorpayXService");

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

        const [rows] = await db.query(
            `
            SELECT
                s.id,
                s.person_id,
                s.person_type,
                s.salary_month,
                s.salary_year,
                s.monthly_salary,
                s.payment_status
            FROM salary s
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

        const salary = rows[0];

        if (salary.payment_status === "paid") {
            return res.status(400).json({
                success: false,
                message: "This salary is already paid."
            });
        }

        // Find RazorpayX salary account
        const [accountRows] = await db.query(
            `
            SELECT
                id,
                person_id,
                person_type,
                razorpay_contact_id,
                razorpay_fund_account_id,
                status
            FROM salary_accounts
            WHERE person_id = ?
              AND person_type = ?
              AND status = 'active'
            LIMIT 1
            `,
            [
                salary.person_id,
                salary.person_type
            ]
        );

        if (!accountRows[0]) {
            return res.status(400).json({
                success: false,
                message:
                    "RazorpayX salary account is not configured for this Staff/Rector."
            });
        }

        const salaryAccount = accountRows[0];

        if (!salaryAccount.razorpay_fund_account_id) {
            return res.status(400).json({
                success: false,
                message:
                    "RazorpayX Fund Account is missing. Please configure the salary account first."
            });
        }

        /*
         * Unique salary reference.
         * Example:
         * SAL-2026-09-25
         */
        const referenceId =
            `SAL-${salary.salary_year}-${String(
                salary.salary_month
            ).padStart(2, "0")}-${salary.id}`;

        /*
         * Create RazorpayX Test Payout
         */
        const payout = await createPayout({
            fundAccountId:
                salaryAccount.razorpay_fund_account_id,

            amount: salary.monthly_salary,

            referenceId,

            narration:
                `${salary.person_type === "staff" ? "Staff" : "Rector"} Salary`,

            salaryId: salary.id
        });

        if (!payout || !payout.id) {
            return res.status(500).json({
                success: false,
                message:
                    "RazorpayX payout was not created."
            });
        }

        /*
         * IMPORTANT:
         * RazorpayX may initially return processing.
         * Do NOT immediately mark salary as paid.
         */
        const razorpayStatus =
            String(payout.status || "processing").toLowerCase();

        const paymentStatus =
            razorpayStatus === "processed"
                ? "paid"
                : "pending";

        const paymentDate =
            paymentStatus === "paid"
                ? new Date().toISOString().slice(0, 10)
                : null;

        /*
         * Save RazorpayX payout information.
         */
        await db.query(
            `
            UPDATE salary
            SET
                payment_status = ?,
                payment_date = ?,
                payment_method = 'RazorpayX Test',
                transaction_reference = ?,
                razorpay_payout_id = ?,
                razorpay_status = ?
            WHERE id = ?
              AND payment_status = 'pending'
            `,
            [
                paymentStatus,
                paymentDate,
                payout.id,
                payout.id,
                razorpayStatus,
                salary.id
            ]
        );

        /*
         * Create paid notification only when
         * RazorpayX says the payout is processed.
         */
        if (paymentStatus === "paid") {
            await createPaidNotification(
                salary.id,
                paymentDate
            );
        }

        return res.json({
            success: true,
            message:
                paymentStatus === "paid"
                    ? "Salary paid successfully through RazorpayX Test Mode."
                    : "RazorpayX Test payout created successfully. Payment is processing.",

            salary_status: paymentStatus,

            payout: {
                id: payout.id,
                status: payout.status,
                amount: payout.amount,
                currency: payout.currency,
                reference_id: payout.reference_id
            }
        });

    } catch (error) {
        console.error(
            "Pay salary / RazorpayX error:",
            error.response?.data || error
        );

        return res.status(500).json({
            success: false,
            message:
                error.response?.data?.error?.description ||
                error.response?.data?.message ||
                error.message ||
                "Failed to process salary payment through RazorpayX."
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