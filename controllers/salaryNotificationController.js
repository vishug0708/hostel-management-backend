const db = require("../config/database");

const getStaffId = (req) => Number(req.user?.id);

const getRectorId = (req) => {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
    return /^rector-\d+$/i.test(token) ? Number(token.split("-")[1]) : null;
};

const getStaffNotifications = async (req, res) => {
    try {
        const personId = getStaffId(req);
        if (!Number.isInteger(personId) || personId <= 0) {
            return res.status(401).json({ success: false, message: "Invalid staff authentication." });
        }

        const [rows] = await db.query(
            `SELECT id, salary_id, notification_type, title, message, is_read, created_at
             FROM salary_notifications
             WHERE person_id = ? AND person_type = 'staff'
             ORDER BY created_at DESC, id DESC`,
            [personId]
        );
        return res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error("Staff salary notification error:", error);
        return res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
};

const markStaffNotificationRead = async (req, res) => {
    try {
        const personId = getStaffId(req);
        const notificationId = Number(req.params.id);
        if (!Number.isInteger(personId) || personId <= 0) return res.status(401).json({ success: false, message: "Invalid staff authentication." });
        if (!Number.isInteger(notificationId) || notificationId <= 0) return res.status(400).json({ success: false, message: "Invalid notification ID." });

        const [result] = await db.query(
            `UPDATE salary_notifications SET is_read = 1
             WHERE id = ? AND person_id = ? AND person_type = 'staff'`,
            [notificationId, personId]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Notification not found." });
        return res.json({ success: true, message: "Notification marked as read." });
    } catch (error) {
        console.error("Staff notification read error:", error);
        return res.status(500).json({ success: false, message: "Failed to update notification." });
    }
};

const getRectorNotifications = async (req, res) => {
    try {
        const personId = getRectorId(req);
        if (!Number.isInteger(personId) || personId <= 0) return res.status(401).json({ success: false, message: "Invalid Rector authentication." });

        const [rectorRows] = await db.query(`SELECT id, status FROM rectors WHERE id = ? LIMIT 1`, [personId]);
        if (!rectorRows[0]) return res.status(401).json({ success: false, message: "Rector account not found." });
        if (String(rectorRows[0].status).toLowerCase() !== "active") return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact the administrator." });

        const [rows] = await db.query(
            `SELECT id, salary_id, notification_type, title, message, is_read, created_at
             FROM salary_notifications
             WHERE person_id = ? AND person_type = 'rector'
             ORDER BY created_at DESC, id DESC`,
            [personId]
        );
        return res.json({ success: true, notifications: rows });
    } catch (error) {
        console.error("Rector salary notification error:", error);
        return res.status(500).json({ success: false, message: "Failed to load notifications." });
    }
};

const markRectorNotificationRead = async (req, res) => {
    try {
        const personId = getRectorId(req);
        const notificationId = Number(req.params.id);
        if (!Number.isInteger(personId) || personId <= 0) return res.status(401).json({ success: false, message: "Invalid Rector authentication." });
        if (!Number.isInteger(notificationId) || notificationId <= 0) return res.status(400).json({ success: false, message: "Invalid notification ID." });

        const [rectorRows] = await db.query(`SELECT id, status FROM rectors WHERE id = ? LIMIT 1`, [personId]);
        if (!rectorRows[0]) return res.status(401).json({ success: false, message: "Rector account not found." });
        if (String(rectorRows[0].status).toLowerCase() !== "active") return res.status(403).json({ success: false, message: "Your account has been deactivated. Please contact the administrator." });

        const [result] = await db.query(
            `UPDATE salary_notifications SET is_read = 1
             WHERE id = ? AND person_id = ? AND person_type = 'rector'`,
            [notificationId, personId]
        );
        if (!result.affectedRows) return res.status(404).json({ success: false, message: "Notification not found." });
        return res.json({ success: true, message: "Notification marked as read." });
    } catch (error) {
        console.error("Rector notification read error:", error);
        return res.status(500).json({ success: false, message: "Failed to update notification." });
    }
};

module.exports = {
    getStaffNotifications,
    markStaffNotificationRead,
    getRectorNotifications,
    markRectorNotificationRead
};
