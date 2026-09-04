const db = require("../config/database");
const bcrypt = require("bcryptjs");

const getStaffId = (req) => req.user?.id || req.staff?.id;

const getStaffProfile = async (req, res) => {
    try {
        const id = getStaffId(req);
        if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });
        const [rows] = await db.query(`SELECT id, staff_id, name, email, mobile, role, status, photo, salary, created_at FROM staff WHERE id = ? LIMIT 1`, [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Staff not found." });
        return res.json({ success: true, staff: rows[0] });
    } catch (error) {
        console.error("Get Staff Profile Error:", error);
        return res.status(500).json({ success: false, message: "Failed to fetch staff profile.", error: error.message });
    }
};

const updateStaffProfile = async (req, res) => {
    try {
        const id = getStaffId(req);
        if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });
        const { name, email, mobile } = req.body;
        const [currentRows] = await db.query(`SELECT photo FROM staff WHERE id = ? LIMIT 1`, [id]);
        if (!currentRows.length) return res.status(404).json({ success: false, message: "Staff not found." });
        const photo = req.file ? `uploads/staff/${req.file.filename}` : currentRows[0].photo;
        await db.query(`UPDATE staff SET name = ?, email = ?, mobile = ?, photo = ? WHERE id = ?`, [name, email, mobile, photo, id]);
        const [rows] = await db.query(`SELECT id, staff_id, name, email, mobile, role, status, photo, salary, created_at FROM staff WHERE id = ? LIMIT 1`, [id]);
        return res.json({ success: true, message: "Staff profile updated successfully.", staff: rows[0], photo: rows[0].photo });
    } catch (error) {
        console.error("Update Staff Profile Error:", error);
        return res.status(500).json({ success: false, message: "Profile update failed.", error: error.message });
    }
};

const changeStaffPassword = async (req, res) => {
    try {
        const id = getStaffId(req);
        if (!id) return res.status(401).json({ success: false, message: "Unauthorized." });
        const { currentPassword, newPassword, confirmPassword } = req.body;
        if (!currentPassword || !newPassword || !confirmPassword) return res.status(400).json({ success: false, message: "Please fill all password fields." });
        if (newPassword.length < 6) return res.status(400).json({ success: false, message: "New password must be at least 6 characters." });
        if (newPassword !== confirmPassword) return res.status(400).json({ success: false, message: "New password and confirm password do not match." });
        if (currentPassword === newPassword) return res.status(400).json({ success: false, message: "New password must be different from current password." });
        const [rows] = await db.query(`SELECT password FROM staff WHERE id = ? LIMIT 1`, [id]);
        if (!rows.length) return res.status(404).json({ success: false, message: "Staff not found." });
        const ok = await bcrypt.compare(String(currentPassword), rows[0].password);
        if (!ok) return res.status(400).json({ success: false, message: "Current password is incorrect." });
        const hash = await bcrypt.hash(String(newPassword), 10);
        await db.query(`UPDATE staff SET password = ? WHERE id = ?`, [hash, id]);
        return res.json({ success: true, message: "Password changed successfully." });
    } catch (error) {
        console.error("Staff Change Password Error:", error);
        return res.status(500).json({ success: false, message: "Password change failed.", error: error.message });
    }
};

module.exports = { getStaffProfile, updateStaffProfile, changeStaffPassword };