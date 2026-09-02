const db = require("../config/database");

// =====================================================
// GET ALL ROOMS
// =====================================================

const getRooms = async (req, res) => {
    try {
        const [rooms] = await db.query(`
            SELECT
                id,
                block,
                room_no,
                total_beds,
                status,
                hostel,
                created_at
            FROM rooms
            ORDER BY block ASC, room_no ASC
        `);

        return res.status(200).json({
            success: true,
            rooms
        });
    } catch (error) {
        console.error("Get Rooms Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch rooms",
            error: error.message
        });
    }
};

// =====================================================
// GET SINGLE ROOM
// =====================================================

const getRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rooms] = await db.query(
            `
            SELECT
                id,
                block,
                room_no,
                total_beds,
                status,
                hostel,
                created_at
            FROM rooms
            WHERE id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Room not found"
            });
        }

        return res.status(200).json({
            success: true,
            room: rooms[0]
        });
    } catch (error) {
        console.error(
            "Get Room By ID Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch room",
            error: error.message
        });
    }
};

// =====================================================
// ADD ROOM
// =====================================================

const addRoom = async (req, res) => {
    try {
        const {
            block,
            room_no,
            total_beds,
            status,
            hostel
        } = req.body;

        // =================================================
        // VALIDATION
        // =================================================

        if (
            !block ||
            !room_no ||
            !total_beds ||
            !hostel
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Block, room number, total beds and hostel are required"
            });
        }

        const cleanBlock =
            String(block)
                .trim()
                .toUpperCase();

        const cleanRoomNo =
            String(room_no)
                .trim()
                .toUpperCase();

        const beds =
            Number(total_beds);

        const cleanHostel =
            String(hostel).trim();

        // =================================================
        // VALID BLOCK
        // =================================================

        const validBlocks = [
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H"
        ];

        if (
            !validBlocks.includes(
                cleanBlock
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid block. Allowed blocks are A to H."
            });
        }

        // =================================================
        // VALID BEDS
        // =================================================

        if (
            !Number.isInteger(beds) ||
            beds <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Total beds must be a positive number"
            });
        }

        // =================================================
        // ROOM NUMBER VALIDATION
        // =================================================

        const roomPattern =
            new RegExp(
                `^${cleanBlock}\\d+$`
            );

        if (
            !roomPattern.test(
                cleanRoomNo
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Room number must start with block ${cleanBlock}. Example: ${cleanBlock}101`
            });
        }

        // =================================================
        // CHECK DUPLICATE ROOM
        // =================================================

        const [existingRooms] =
            await db.query(
                `
                SELECT id
                FROM rooms
                WHERE room_no = ?
                LIMIT 1
                `,
                [cleanRoomNo]
            );

        if (existingRooms.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Room number already exists"
            });
        }

        // =================================================
        // STATUS
        // =================================================

        const allowedStatuses = [
            "Available",
            "Occupied",
            "Maintenance"
        ];

        const cleanStatus =
            allowedStatuses.includes(
                status
            )
                ? status
                : "Available";

        // =================================================
        // INSERT ROOM
        // =================================================

        const [result] =
            await db.query(
                `
                INSERT INTO rooms
                (
                    block,
                    room_no,
                    total_beds,
                    status,
                    hostel
                )
                VALUES (?, ?, ?, ?, ?)
                `,
                [
                    cleanBlock,
                    cleanRoomNo,
                    beds,
                    cleanStatus,
                    cleanHostel
                ]
            );

        // =================================================
        // SUCCESS
        // =================================================

        return res.status(201).json({
            success: true,
            message:
                "Room added successfully",
            room: {
                id: result.insertId,
                block: cleanBlock,
                room_no: cleanRoomNo,
                total_beds: beds,
                status: cleanStatus,
                hostel: cleanHostel
            }
        });

    } catch (error) {
        console.error(
            "Add Room Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to add room",
            error: error.message
        });
    }
};

// =====================================================
// UPDATE ROOM
// =====================================================

const updateRoom = async (req, res) => {
    try {
        const { id } = req.params;

        const {
            block,
            room_no,
            total_beds,
            status,
            hostel
        } = req.body;

        if (
            !block ||
            !room_no ||
            !total_beds ||
            !hostel
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Block, room number, total beds and hostel are required"
            });
        }

        const cleanBlock =
            String(block)
                .trim()
                .toUpperCase();

        const cleanRoomNo =
            String(room_no)
                .trim()
                .toUpperCase();

        const beds =
            Number(total_beds);

        const cleanHostel =
            String(hostel).trim();

        const validBlocks = [
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H"
        ];

        if (
            !validBlocks.includes(
                cleanBlock
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Invalid block"
            });
        }

        if (
            !Number.isInteger(beds) ||
            beds <= 0
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Total beds must be a positive number"
            });
        }

        const roomPattern =
            new RegExp(
                `^${cleanBlock}\\d+$`
            );

        if (
            !roomPattern.test(
                cleanRoomNo
            )
        ) {
            return res.status(400).json({
                success: false,
                message:
                    `Room number must start with block ${cleanBlock}`
            });
        }

        // =================================================
        // CHECK ROOM EXISTS
        // =================================================

        const [roomRows] =
            await db.query(
                `
                SELECT id
                FROM rooms
                WHERE id = ?
                LIMIT 1
                `,
                [id]
            );

        if (roomRows.length === 0) {
            return res.status(404).json({
                success: false,
                message:
                    "Room not found"
            });
        }

        // =================================================
        // CHECK DUPLICATE ROOM NUMBER
        // =================================================

        const [duplicateRows] =
            await db.query(
                `
                SELECT id
                FROM rooms
                WHERE room_no = ?
                AND id != ?
                LIMIT 1
                `,
                [
                    cleanRoomNo,
                    id
                ]
            );

        if (duplicateRows.length > 0) {
            return res.status(409).json({
                success: false,
                message:
                    "Room number already exists"
            });
        }

        const allowedStatuses = [
            "Available",
            "Occupied",
            "Maintenance"
        ];

        const cleanStatus =
            allowedStatuses.includes(
                status
            )
                ? status
                : "Available";

        // =================================================
        // UPDATE
        // =================================================

        await db.query(
            `
            UPDATE rooms
            SET
                block = ?,
                room_no = ?,
                total_beds = ?,
                status = ?,
                hostel = ?
            WHERE id = ?
            `,
            [
                cleanBlock,
                cleanRoomNo,
                beds,
                cleanStatus,
                cleanHostel,
                id
            ]
        );

        return res.status(200).json({
            success: true,
            message:
                "Room updated successfully"
        });

    } catch (error) {
        console.error(
            "Update Room Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to update room",
            error: error.message
        });
    }
};

// =====================================================
// DELETE ROOM
// =====================================================

const deleteRoom = async (req, res) => {
    try {
        const { id } = req.params;

        // =================================================
        // CHECK ALLOCATION
        // =================================================

        const [allocations] =
            await db.query(
                `
                SELECT id
                FROM room_allocation
                WHERE room_id = ?
                LIMIT 1
                `,
                [id]
            );

        if (allocations.length > 0) {
            return res.status(400).json({
                success: false,
                message:
                    "This room cannot be deleted because allocation records exist"
            });
        }

        const [result] =
            await db.query(
                `
                DELETE FROM rooms
                WHERE id = ?
                `,
                [id]
            );

        if (
            result.affectedRows === 0
        ) {
            return res.status(404).json({
                success: false,
                message:
                    "Room not found"
            });
        }

        return res.status(200).json({
            success: true,
            message:
                "Room deleted successfully"
        });

    } catch (error) {
        console.error(
            "Delete Room Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to delete room",
            error: error.message
        });
    }
};

// =====================================================
// GET ROOM STATISTICS
// =====================================================

const getRoomStats = async (req, res) => {
    try {
        const [stats] =
            await db.query(`
                SELECT
                    COUNT(*) AS total_rooms,
                    COALESCE(
                        SUM(total_beds),
                        0
                    ) AS total_beds,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN status = 'Available'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS available_rooms,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN status = 'Occupied'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS occupied_rooms,
                    COALESCE(
                        SUM(
                            CASE
                                WHEN status = 'Maintenance'
                                THEN 1
                                ELSE 0
                            END
                        ),
                        0
                    ) AS maintenance_rooms
                FROM rooms
            `);

        return res.status(200).json({
            success: true,
            stats: stats[0]
        });

    } catch (error) {
        console.error(
            "Room Stats Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch room statistics",
            error: error.message
        });
    }
};

// =====================================================
// GET BLOCKS
// =====================================================

const getBlocks = async (req, res) => {
    try {
        const blocks = [
            "A",
            "B",
            "C",
            "D",
            "E",
            "F",
            "G",
            "H"
        ];

        return res.status(200).json({
            success: true,
            blocks
        });

    } catch (error) {
        console.error(
            "Get Blocks Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch blocks"
        });
    }
};

// =====================================================
// EXPORTS
// =====================================================

module.exports = {
    getRooms,
    getRoomById,
    addRoom,
    updateRoom,
    deleteRoom,
    getRoomStats,
    getBlocks
};