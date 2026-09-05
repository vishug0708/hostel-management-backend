const db = require("../config/database");
const { generateMonthlySalaryRecords } = require("../services/salaryService");

const getMySalary = async (req, res) => {
    try {
        const staffId = Number(req.user?.id);
        if (!Number.isInteger(staffId) || staffId <= 0) {
            return res.status(401).json({ success: false, message: "Invalid staff authentication." });
        }

        await generateMonthlySalaryRecords();

        const [rows] = await db.query(
            `SELECT id, salary_month, salary_year, monthly_salary, payment_status,
                    payment_date, payment_method, transaction_reference, remarks, created_at
             FROM salary
             WHERE person_id = ? AND person_type = 'staff'
             ORDER BY salary_year DESC, salary_month DESC, id DESC`,
            [staffId]
        );

        return res.json({ success: true, salary: rows });
    } catch (error) {
        console.error("Staff salary error:", error);
        return res.status(500).json({ success: false, message: "Failed to load salary information." });
    }
};

module.exports = { getMySalary };
