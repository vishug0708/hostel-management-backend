const db = require("../config/database");

// =====================================================
// GET ALL ACTIVE ROOM ALLOCATIONS
// =====================================================

const getRectorRoomAllocations = async (req, res) => {
    try {
        const [allocations] = await db.query(
            `
            SELECT
                ra.id,
                ra.student_id,
                ra.room_id,
                ra.bed_no,
                ra.allocation_date,
                ra.status,
                r.room_no AS room_number,
                r.block,
                r.total_beds,
                r.hostel,
                s.name AS student_name,
                s.email AS student_email
            FROM room_allocation ra
            INNER JOIN rooms r
                ON r.id = ra.room_id
            LEFT JOIN students s
                ON s.id = ra.student_id
            WHERE ra.status = 'Allocated'
            ORDER BY
                r.block ASC,
                r.room_no ASC,
                ra.bed_no ASC
            `
        );

        return res.status(200).json({
            success: true,
            message: "Room allocations fetched successfully.",
            allocations: allocations.map((allocation) => ({
                id: allocation.id,
                student_id: allocation.student_id,
                student_name:
                    allocation.student_name ||
                    "Unknown Student",
                student_email:
                    allocation.student_email || "",
                room_id: allocation.room_id,
                room_number: allocation.room_number,
                block: allocation.block,
                bed_no: Number(allocation.bed_no || 0),
                total_beds:
                    Number(allocation.total_beds || 0),
                hostel:
                    allocation.hostel ||
                    "Virtuous Hostel",
                allocation_date:
                    allocation.allocation_date,
                status: allocation.status
            }))
        });

    } catch (error) {
        console.error(
            "Rector Get Room Allocations Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch room allocations.",
            error: error.message
        });
    }
};


// =====================================================
// DEALLOCATE STUDENT FROM ROOM
// =====================================================

const deallocateRoom = async (req, res) => {
    let connection;

    try {
        const {
            allocation_id
        } = req.body;

        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (!allocation_id) {
            return res.status(400).json({
                success: false,
                message:
                    "Allocation ID is required."
            });
        }

        connection = await db.getConnection();

        await connection.beginTransaction();

        // -------------------------------------------------
        // GET ACTIVE ALLOCATION
        // -------------------------------------------------

        const [allocationRows] =
            await connection.query(
                `
                SELECT
                    ra.id,
                    ra.student_id,
                    ra.room_id,
                    ra.bed_no,
                    ra.status,
                    r.room_no,
                    r.block,
                    r.total_beds,
                    s.name AS student_name
                FROM room_allocation ra
                INNER JOIN rooms r
                    ON r.id = ra.room_id
                LEFT JOIN students s
                    ON s.id = ra.student_id
                WHERE
                    ra.id = ?
                    AND ra.status = 'Allocated'
                LIMIT 1
                FOR UPDATE
                `,
                [allocation_id]
            );

        // -------------------------------------------------
        // ALLOCATION NOT FOUND
        // -------------------------------------------------

        if (allocationRows.length === 0) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Active room allocation not found."
            });
        }

        const allocation =
            allocationRows[0];

        // -------------------------------------------------
        // DEALLOCATE
        // -------------------------------------------------

        await connection.query(
            `
            UPDATE room_allocation
            SET status = 'Deallocated'
            WHERE id = ?
              AND status = 'Allocated'
            `,
            [allocation_id]
        );

        // -------------------------------------------------
        // COUNT REMAINING ACTIVE ALLOCATIONS
        // -------------------------------------------------

        const [countRows] =
            await connection.query(
                `
                SELECT
                    COUNT(*) AS allocated_beds
                FROM room_allocation
                WHERE room_id = ?
                  AND status = 'Allocated'
                `,
                [allocation.room_id]
            );

        const allocatedBeds =
            Number(
                countRows[0].allocated_beds || 0
            );

        const totalBeds =
            Number(
                allocation.total_beds || 0
            );

        // -------------------------------------------------
        // UPDATE ROOM STATUS
        // -------------------------------------------------

        let newRoomStatus = "Available";

        if (
            totalBeds > 0 &&
            allocatedBeds >= totalBeds
        ) {
            newRoomStatus = "Occupied";
        } else {
            newRoomStatus = "Available";
        }

        await connection.query(
            `
            UPDATE rooms
            SET status = ?
            WHERE id = ?
            `,
            [
                newRoomStatus,
                allocation.room_id
            ]
        );

        // -------------------------------------------------
        // COMMIT
        // -------------------------------------------------

        await connection.commit();

        return res.status(200).json({
            success: true,
            message:
                `${allocation.student_name || "Student"} has been deallocated from Room ${allocation.room_no}.`,
            deallocation: {
                allocation_id:
                    allocation.id,
                student_id:
                    allocation.student_id,
                student_name:
                    allocation.student_name,
                room_id:
                    allocation.room_id,
                room_no:
                    allocation.room_no,
                block:
                    allocation.block,
                bed_no:
                    Number(
                        allocation.bed_no || 0
                    ),
                allocated_beds:
                    allocatedBeds,
                vacant_beds:
                    Math.max(
                        totalBeds -
                        allocatedBeds,
                        0
                    ),
                room_status:
                    newRoomStatus
            }
        });

    } catch (error) {

        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error(
                    "Rollback Error:",
                    rollbackError
                );
            }
        }

        console.error(
            "Rector Deallocate Room Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to deallocate student.",
            error: error.message
        });

    } finally {

        if (connection) {
            connection.release();
        }

    }
};


// =====================================================
// EXPORT
// =====================================================

module.exports = {
    getRectorRoomAllocations,
    deallocateRoom
};