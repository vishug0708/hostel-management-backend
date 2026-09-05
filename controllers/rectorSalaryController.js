const db = require("../config/database");
const { generateMonthlySalaryRecords } = require("../services/salaryService");

const getRectorIdFromToken = (req) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    if (!/^rector-\d+$/i.test(token)) return null;
    return Number(token.split("-")[1]);
};

const getMySalary = async (req, res) => {
    try {
        const rectorId = getRectorIdFromToken(req);
        if (!Number.isInteger(rectorId) || rectorId <= 0) {
            return res.status(401).json({ success: false, message: "Invalid Rector authentication." });
        }

        const [rectorRows] = await db.query(
            `SELECT id, status FROM rectors WHERE id = ? LIMIT 1`,
            [rectorId]
        );

        if (!rectorRows[0]) {
            return res.status(401).json({ success: false, message: "Rector account not found." });
        }

        if (String(rectorRows[0].status).toLowerCase() !== "active") {
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact the administrator."
            });
        }

        await generateMonthlySalaryRecords();

        const [rows] = await db.query(
            `SELECT id, salary_month, salary_year, monthly_salary, payment_status,
                    payment_date, payment_method, transaction_reference, remarks, created_at
             FROM salary
             WHERE person_id = ? AND person_type = 'rector'
             ORDER BY salary_year DESC, salary_month DESC, id DESC`,
            [rectorId]
        );

        return res.json({ success: true, salary: rows });
    } catch (error) {
        console.error("Rector salary error:", error);
        return res.status(500).json({ success: false, message: "Failed to load salary information." });
    }
};

module.exports = { getMySalary };
