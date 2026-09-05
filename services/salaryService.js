const db = require("../config/database");

const generateMonthlySalaryRecords = async () => {
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        const [staffRows] = await connection.query(`SELECT id, salary FROM staff WHERE LOWER(status)='active'`);
        const [rectorRows] = await connection.query(`SELECT id, salary FROM rectors WHERE LOWER(status)='active'`);

        for (const person of staffRows) {
            await connection.query(
                `INSERT INTO salary (person_id, person_type, salary_month, salary_year, monthly_salary, payment_status)
                 VALUES (?, 'staff', ?, ?, ?, 'pending') ON DUPLICATE KEY UPDATE id=id`,
                [person.id, month, year, Number(person.salary || 0)]
            );
        }
        for (const person of rectorRows) {
            await connection.query(
                `INSERT INTO salary (person_id, person_type, salary_month, salary_year, monthly_salary, payment_status)
                 VALUES (?, 'rector', ?, ?, ?, 'pending') ON DUPLICATE KEY UPDATE id=id`,
                [person.id, month, year, Number(person.salary || 0)]
            );
        }

        const [pendingRows] = await connection.query(
            `SELECT id, person_id, person_type, salary_month, salary_year
             FROM salary WHERE salary_month=? AND salary_year=? AND payment_status='pending'`,
            [month, year]
        );
        const monthName = new Date(year, month - 1, 1).toLocaleString("en-IN", { month: "long" });
        for (const salary of pendingRows) {
            await connection.query(
                `INSERT INTO salary_notifications
                 (person_id, person_type, salary_id, notification_type, title, message)
                 VALUES (?, ?, ?, 'due', 'Salary Due', ?)
                 ON DUPLICATE KEY UPDATE id=id`,
                [salary.person_id, salary.person_type, salary.id, `Your salary for ${monthName} ${year} is pending.`]
            );
        }
        await connection.commit();
        return { month, year, staffCount: staffRows.length, rectorCount: rectorRows.length, salaryCount: pendingRows.length };
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
};

const createPaidNotification = async (salaryId, paymentDate) => {
    const [rows] = await db.query(
        `SELECT id, person_id, person_type, salary_month, salary_year FROM salary WHERE id=? LIMIT 1`,
        [salaryId]
    );
    if (!rows[0]) return;
    const salary = rows[0];
    const monthName = new Date(Number(salary.salary_year), Number(salary.salary_month) - 1, 1).toLocaleString("en-IN", { month: "long" });
    await db.query(
        `INSERT INTO salary_notifications
         (person_id, person_type, salary_id, notification_type, title, message)
         VALUES (?, ?, ?, 'paid', 'Salary Paid', ?)
         ON DUPLICATE KEY UPDATE id=id`,
        [salary.person_id, salary.person_type, salary.id, `Your salary for ${monthName} ${salary.salary_year} has been paid successfully${paymentDate ? ` on ${paymentDate}` : ""}.`]
    );
};

module.exports = { generateMonthlySalaryRecords, createPaidNotification };
