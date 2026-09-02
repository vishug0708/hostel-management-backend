const db = require("../config/database");

// ==========================================
// GET ALL ROOMS FOR RECTOR
// ==========================================
const getRectorRooms = async (req, res) => {
    try {
        const [rooms] = await db.query(`
            SELECT
                r.id,
                r.room_no,
                r.block,
                r.total_beds,
                r.hostel
            FROM rooms r
            ORDER BY
                r.block ASC,
                r.room_no ASC
        `);

        // Get active room allocations
        const [allocations] = await db.query(`
            SELECT
                ra.id,
                ra.student_id,
                ra.room_id,
                ra.bed_no,
                ra.allocation_date,
                ra.status,
                s.name AS student_name,
                s.email AS student_email
            FROM room_allocation ra
            LEFT JOIN students s
                ON s.id = ra.student_id
            WHERE ra.status = 'Allocated'
            ORDER BY
                ra.room_id ASC,
                ra.bed_no ASC
        `);

        // Attach allocations to each room
        const formattedRooms = rooms.map((room) => {
            const roomAllocations = allocations.filter(
                (allocation) =>
                    Number(allocation.room_id) === Number(room.id)
            );

            const totalBeds = Number(room.total_beds || 0);

            const allocatedBeds = roomAllocations.length;

            const vacantBeds = Math.max(
                totalBeds - allocatedBeds,
                0
            );

            let roomStatus = "Available";

            if (totalBeds > 0 && allocatedBeds >= totalBeds) {
                roomStatus = "Full";
            } else if (allocatedBeds > 0) {
                roomStatus = "Partially Allocated";
            }

            return {
                id: room.id,
                room_no: room.room_no,
                block: room.block,
                total_beds: totalBeds,
                hostel: room.hostel || "Virtuous Hostel",

                allocated_beds: allocatedBeds,
                vacant_beds: vacantBeds,
                room_status: roomStatus,

                allocations: roomAllocations.map((allocation) => ({
                    id: allocation.id,
                    student_id: allocation.student_id,
                    student_name: allocation.student_name,
                    student_email: allocation.student_email,
                    room_id: allocation.room_id,
                    bed_no: Number(allocation.bed_no),
                    allocation_date:
                        allocation.allocation_date,
                    status: allocation.status
                }))
            };
        });

        return res.status(200).json({
            success: true,
            message: "Rooms fetched successfully.",
            rooms: formattedRooms
        });

    } catch (error) {
        console.error(
            "Rector Get Rooms Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch rooms.",
            error: error.message
        });
    }
};


// ==========================================
// GET SINGLE ROOM DETAILS
// ==========================================
const getRectorRoomById = async (req, res) => {
    try {
        const { id } = req.params;

        const [rooms] = await db.query(
            `
            SELECT
                r.id,
                r.room_no,
                r.block,
                r.total_beds,
                r.hostel
            FROM rooms r
            WHERE r.id = ?
            LIMIT 1
            `,
            [id]
        );

        if (rooms.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Room not found."
            });
        }

        const room = rooms[0];

        const [allocations] = await db.query(
            `
            SELECT
                ra.id,
                ra.student_id,
                ra.room_id,
                ra.bed_no,
                ra.allocation_date,
                ra.status,
                s.name AS student_name,
                s.email AS student_email
            FROM room_allocation ra
            LEFT JOIN students s
                ON s.id = ra.student_id
            WHERE ra.room_id = ?
              AND ra.status = 'Allocated'
            ORDER BY ra.bed_no ASC
            `,
            [id]
        );

        const totalBeds = Number(
            room.total_beds || 0
        );

        const allocatedBeds = allocations.length;

        const vacantBeds = Math.max(
            totalBeds - allocatedBeds,
            0
        );

        let roomStatus = "Available";

        if (
            totalBeds > 0 &&
            allocatedBeds >= totalBeds
        ) {
            roomStatus = "Full";
        } else if (allocatedBeds > 0) {
            roomStatus = "Partially Allocated";
        }

        return res.status(200).json({
            success: true,
            room: {
                id: room.id,
                room_no: room.room_no,
                block: room.block,
                total_beds: totalBeds,
                hostel:
                    room.hostel ||
                    "Virtuous Hostel",

                allocated_beds: allocatedBeds,
                vacant_beds: vacantBeds,
                room_status: roomStatus,

                allocations: allocations.map(
                    (allocation) => ({
                        id: allocation.id,
                        student_id:
                            allocation.student_id,
                        student_name:
                            allocation.student_name,
                        student_email:
                            allocation.student_email,
                        room_id:
                            allocation.room_id,
                        bed_no:
                            Number(
                                allocation.bed_no
                            ),
                        allocation_date:
                            allocation.allocation_date,
                        status:
                            allocation.status
                    })
                )
            }
        });

    } catch (error) {
        console.error(
            "Rector Get Room By ID Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Failed to fetch room details.",
            error: error.message
        });
    }
};


module.exports = {
    getRectorRooms,
    getRectorRoomById
};