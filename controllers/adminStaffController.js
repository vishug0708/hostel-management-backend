const db = require("../config/database");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const allowedStatuses = ["active", "inactive"];

const normalizeStatus = (status) => {
    const value = String(status || "active").trim().toLowerCase();
    return allowedStatuses.includes(value) ? value : "active";
};

const getStaffById = async (id) => {
    const [rows] = await db.query(
        `SELECT id, staff_id, name, email, mobile, role, status, photo, salary, created_at
         FROM staff
         WHERE id = ?
         LIMIT 1`,
        [id]
    );

    return rows[0] || null;
};

// GET /api/admin/staff
const getStaff = async (req, res) => {
    try {
        const [staff] = await db.query(
            `SELECT id, staff_id, name, email, mobile, role, status, photo, salary, created_at
             FROM staff
             ORDER BY id DESC`
        );

        return res.status(200).json({
            success: true,
            staff
        });
    } catch (error) {
        console.error("Get Staff Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch staff.",
            error: error.message
        });
    }
};

// GET /api/admin/staff/:id
const getStaffByIdController = async (req, res) => {
    try {
        const staff = await getStaffById(req.params.id);

        if (!staff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found."
            });
        }

        return res.status(200).json({
            success: true,
            staff
        });
    } catch (error) {
        console.error("Get Staff By ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch staff.",
            error: error.message
        });
    }
};

// POST /api/admin/staff
const addStaff = async (req, res) => {
    try {
        const {
            staff_id,
            name,
            email,
            mobile,
            password,
            role,
            status,
            salary
        } = req.body;

        if (
            !staff_id ||
            !name ||
            !email ||
            !password ||
            !role ||
            salary === undefined ||
            salary === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Staff ID, name, email, password, role and salary are required."
            });
        }

        const cleanStaffId = String(staff_id).trim();
        const cleanName = String(name).trim();
        const cleanEmail = String(email).trim().toLowerCase();
        const cleanMobile = mobile ? String(mobile).trim() : null;
        const cleanRole = String(role).trim();
        const cleanStatus = normalizeStatus(status);
        const cleanSalary = Number(salary);

        if (!Number.isFinite(cleanSalary) || cleanSalary < 0) {
            return res.status(400).json({
                success: false,
                message: "Salary must be a valid non-negative number."
            });
        }

        const [existing] = await db.query(
            `SELECT id
             FROM staff
             WHERE staff_id = ? OR email = ?
             LIMIT 1`,
            [cleanStaffId, cleanEmail]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Staff ID or email already exists."
            });
        }

        const hashedPassword = await bcrypt.hash(
            String(password),
            10
        );

        const photo = req.file
            ? `staff/${req.file.filename}`
            : null;

        const [result] = await db.query(
            `INSERT INTO staff
             (staff_id, name, email, mobile, password, role, status, photo, salary)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                cleanStaffId,
                cleanName,
                cleanEmail,
                cleanMobile,
                hashedPassword,
                cleanRole,
                cleanStatus,
                photo,
                cleanSalary
            ]
        );

        const staff = await getStaffById(result.insertId);

        return res.status(201).json({
            success: true,
            message: "Staff added successfully.",
            staff
        });
    } catch (error) {
        console.error("Add Staff Error:", error);

        if (req.file) {
            const uploadedPath = path.join(
                __dirname,
                "..",
                "uploads",
                "staff",
                req.file.filename
            );

            if (fs.existsSync(uploadedPath)) {
                fs.unlinkSync(uploadedPath);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to add staff.",
            error: error.message
        });
    }
};

// PUT /api/admin/staff/:id
const updateStaff = async (req, res) => {
    try {
        const { id } = req.params;

        const existingStaff = await getStaffById(id);

        if (!existingStaff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found."
            });
        }

        const {
            staff_id,
            name,
            email,
            mobile,
            password,
            role,
            status,
            salary
        } = req.body;

        if (
            !staff_id ||
            !name ||
            !email ||
            !role ||
            salary === undefined ||
            salary === ""
        ) {
            return res.status(400).json({
                success: false,
                message: "Staff ID, name, email, role and salary are required."
            });
        }

        const cleanStaffId = String(staff_id).trim();
        const cleanName = String(name).trim();
        const cleanEmail = String(email).trim().toLowerCase();
        const cleanMobile = mobile ? String(mobile).trim() : null;
        const cleanRole = String(role).trim();
        const cleanStatus = normalizeStatus(status);
        const cleanSalary = Number(salary);

        if (!Number.isFinite(cleanSalary) || cleanSalary < 0) {
            return res.status(400).json({
                success: false,
                message: "Salary must be a valid non-negative number."
            });
        }

        const [duplicate] = await db.query(
            `SELECT id
             FROM staff
             WHERE (staff_id = ? OR email = ?) AND id <> ?
             LIMIT 1`,
            [cleanStaffId, cleanEmail, id]
        );

        if (duplicate.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Staff ID or email already exists."
            });
        }

        let newPassword = existingStaff.password;

        if (password && String(password).trim()) {
            newPassword = await bcrypt.hash(
                String(password),
                10
            );
        }

        let newPhoto = existingStaff.photo;

        if (req.file) {
            newPhoto = `staff/${req.file.filename}`;
        }

        await db.query(
            `UPDATE staff
             SET staff_id = ?,
                 name = ?,
                 email = ?,
                 mobile = ?,
                 password = ?,
                 role = ?,
                 status = ?,
                 photo = ?,
                 salary = ?
             WHERE id = ?`,
            [
                cleanStaffId,
                cleanName,
                cleanEmail,
                cleanMobile,
                newPassword,
                cleanRole,
                cleanStatus,
                newPhoto,
                cleanSalary,
                id
            ]
        );

        if (req.file && existingStaff.photo) {
            const oldPhotoName = String(existingStaff.photo)
                .replace(/^uploads\/staff\//, "")
                .replace(/^staff\//, "")
                .replace(/^\/+/, "");

            const oldPhotoPath = path.join(
                __dirname,
                "..",
                "uploads",
                "staff",
                oldPhotoName
            );

            if (
                oldPhotoName &&
                fs.existsSync(oldPhotoPath)
            ) {
                fs.unlinkSync(oldPhotoPath);
            }
        }

        const staff = await getStaffById(id);

        return res.status(200).json({
            success: true,
            message: "Staff updated successfully.",
            staff
        });
    } catch (error) {
        console.error("Update Staff Error:", error);

        if (req.file) {
            const uploadedPath = path.join(
                __dirname,
                "..",
                "uploads",
                "staff",
                req.file.filename
            );

            if (fs.existsSync(uploadedPath)) {
                fs.unlinkSync(uploadedPath);
            }
        }

        return res.status(500).json({
            success: false,
            message: "Failed to update staff.",
            error: error.message
        });
    }
};

// PATCH /api/admin/staff/:id/status
const updateStaffStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const status = normalizeStatus(req.body.status);

        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Status must be active or inactive."
            });
        }

        const existingStaff = await getStaffById(id);

        if (!existingStaff) {
            return res.status(404).json({
                success: false,
                message: "Staff not found."
            });
        }

        await db.query(
            `UPDATE staff
             SET status = ?
             WHERE id = ?`,
            [status, id]
        );

        const staff = await getStaffById(id);

        return res.status(200).json({
            success: true,
            message: `Staff ${status === "active" ? "activated" : "deactivated"} successfully.`,
            staff
        });
    } catch (error) {
        console.error("Update Staff Status Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update staff status.",
            error: error.message
        });
    }
};

module.exports = {
    getStaff,
    getStaffById: getStaffByIdController,
    addStaff,
    updateStaff,
    updateStaffStatus
};
