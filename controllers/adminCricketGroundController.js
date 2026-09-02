const db = require("../config/database");

// =====================================================
// GET ALL CRICKET GROUNDS
// =====================================================

const getGrounds = (req, res) => {
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

    db.query(sql, (err, grounds) => {
        if (err) {
            console.error("Get Cricket Grounds Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch cricket grounds.",
                error: err.message
            });
        }

        return res.status(200).json({
            success: true,
            grounds
        });
    });
};


// =====================================================
// GET CRICKET GROUND BY ID
// =====================================================

const getGroundById = (req, res) => {
    const { id } = req.params;

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
    `;

    db.query(sql, [id], (err, grounds) => {
        if (err) {
            console.error("Get Cricket Ground Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to fetch cricket ground.",
                error: err.message
            });
        }

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
    });
};


// =====================================================
// ADD CRICKET GROUND
// =====================================================

const addGround = (req, res) => {
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

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Add Cricket Ground Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to add cricket ground.",
                error: err.message
            });
        }

        return res.status(201).json({
            success: true,
            message: "Cricket ground added successfully.",
            groundId: result.insertId
        });
    });
};


// =====================================================
// UPDATE CRICKET GROUND
// =====================================================

const updateGround = (req, res) => {
    const { id } = req.params;

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

    db.query(sql, values, (err, result) => {
        if (err) {
            console.error("Update Cricket Ground Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to update cricket ground.",
                error: err.message
            });
        }

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
    });
};


// =====================================================
// DELETE CRICKET GROUND
// =====================================================

const deleteGround = (req, res) => {
    const { id } = req.params;

    const sql = `
        DELETE FROM cricket_grounds
        WHERE id = ?
    `;

    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error("Delete Cricket Ground Error:", err);

            return res.status(500).json({
                success: false,
                message: "Failed to delete cricket ground.",
                error: err.message
            });
        }

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
    });
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