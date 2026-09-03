const db = require("../config/database");

// =====================================================
// GET ALL CRICKET GROUNDS
// =====================================================

const getGrounds = async (req, res) => {
    try {
        const sql = `
            SELECT
                id,
                name,
                location,
                description,
                capacity,
                price_per_hour,
                opening_time,
                closing_time,
                slot_duration,
                status,
                created_at
            FROM cricket_grounds
            ORDER BY id DESC
        `;

        const [grounds] = await db.query(sql);

        return res.status(200).json({
            success: true,
            grounds
        });

    } catch (error) {
        console.error("Get Cricket Grounds Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cricket grounds.",
            error: error.message
        });
    }
};


// =====================================================
// GET CRICKET GROUND BY ID
// =====================================================

const getGroundById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cricket ground ID."
            });
        }

        const sql = `
            SELECT
                id,
                name,
                location,
                description,
                capacity,
                price_per_hour,
                opening_time,
                closing_time,
                slot_duration,
                status,
                created_at
            FROM cricket_grounds
            WHERE id = ?
            LIMIT 1
        `;

        const [grounds] = await db.query(sql, [id]);

        if (grounds.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Cricket ground not found."
            });
        }

        return res.status(200).json({
            success: true,
            ground: grounds[0]
        });

    } catch (error) {
        console.error("Get Cricket Ground Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch cricket ground.",
            error: error.message
        });
    }
};


// =====================================================
// ADD CRICKET GROUND
// =====================================================

const addGround = async (req, res) => {
    try {
        const {
            name,
            location,
            description,
            capacity,
            price_per_hour,
            opening_time,
            closing_time,
            slot_duration,
            status
        } = req.body;

        if (
            !name ||
            price_per_hour === undefined ||
            price_per_hour === null
        ) {
            return res.status(400).json({
                success: false,
                message: "Ground name and price per hour are required."
            });
        }

        if (
            capacity !== null &&
            capacity !== undefined &&
            capacity !== "" &&
            Number(capacity) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Capacity must be greater than 0."
            });
        }

        const sql = `
            INSERT INTO cricket_grounds
            (
                name,
                location,
                description,
                capacity,
                price_per_hour,
                opening_time,
                closing_time,
                slot_duration,
                status
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            name.trim(),
            location || null,
            description || null,
            capacity === "" ? null : capacity,
            price_per_hour,
            opening_time || null,
            closing_time || null,
            slot_duration || 60,
            status || "Active"
        ];

        const [result] = await db.query(sql, values);

        return res.status(201).json({
            success: true,
            message: "Cricket ground added successfully.",
            groundId: result.insertId
        });

    } catch (error) {
        console.error("Add Cricket Ground Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to add cricket ground.",
            error: error.message
        });
    }
};


// =====================================================
// UPDATE CRICKET GROUND
// =====================================================

const updateGround = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cricket ground ID."
            });
        }

        const {
            name,
            location,
            description,
            capacity,
            price_per_hour,
            opening_time,
            closing_time,
            slot_duration,
            status
        } = req.body;

        if (
            !name ||
            price_per_hour === undefined ||
            price_per_hour === null
        ) {
            return res.status(400).json({
                success: false,
                message: "Ground name and price per hour are required."
            });
        }

        if (
            capacity !== null &&
            capacity !== undefined &&
            capacity !== "" &&
            Number(capacity) <= 0
        ) {
            return res.status(400).json({
                success: false,
                message: "Capacity must be greater than 0."
            });
        }

        const sql = `
            UPDATE cricket_grounds
            SET
                name = ?,
                location = ?,
                description = ?,
                capacity = ?,
                price_per_hour = ?,
                opening_time = ?,
                closing_time = ?,
                slot_duration = ?,
                status = ?
            WHERE id = ?
        `;

        const values = [
            name.trim(),
            location || null,
            description || null,
            capacity === "" ? null : capacity,
            price_per_hour,
            opening_time || null,
            closing_time || null,
            slot_duration || 60,
            status || "Active",
            id
        ];

        const [result] = await db.query(sql, values);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Cricket ground not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cricket ground updated successfully."
        });

    } catch (error) {
        console.error("Update Cricket Ground Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to update cricket ground.",
            error: error.message
        });
    }
};


// =====================================================
// DELETE CRICKET GROUND
// =====================================================

const deleteGround = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid cricket ground ID."
            });
        }

        const sql = `
            DELETE FROM cricket_grounds
            WHERE id = ?
        `;

        const [result] = await db.query(sql, [id]);

        if (result.affectedRows === 0) {
            return res.status(404).json({
                success: false,
                message: "Cricket ground not found."
            });
        }

        return res.status(200).json({
            success: true,
            message: "Cricket ground deleted successfully."
        });

    } catch (error) {
        console.error("Delete Cricket Ground Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to delete cricket ground.",
            error: error.message
        });
    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getGrounds,
    getGroundById,
    addGround,
    updateGround,
    deleteGround
};