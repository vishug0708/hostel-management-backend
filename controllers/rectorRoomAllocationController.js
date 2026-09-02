const db = require("../config/database");

// =====================================================
// GET STUDENTS WHO ARE NOT ALLOCATED
// =====================================================

const getAvailableStudents = async (req, res) => {
    try {
        const [students] = await db.query(`
           SELECT
        s.id,
        s.name,
        s.id AS student_id,
        s.email,
        s.college,
        s.course
    FROM students s
    LEFT JOIN room_allocation ra
        ON ra.student_id = s.id
        AND ra.status = 'Allocated'
    WHERE ra.id IS NULL
    ORDER BY s.id ASC
        `);

        return res.status(200).json({
            success: true,
            students
        });

    } catch (error) {
        console.error(
            "Get Available Students Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch available students.",
            error: error.message
        });
    }
};


// =====================================================
// GET ROOMS WITH BED AVAILABILITY
// =====================================================

const getAvailableRooms = async (req, res) => {
    try {
        const [rooms] = await db.query(`
            SELECT
                r.id,
                r.room_no,
                r.block,
                r.total_beds,
                r.status,
                r.hostel,

                COUNT(
                    CASE
                        WHEN ra.status = 'Allocated'
                        THEN ra.id
                    END
                ) AS allocated_beds,

                (
                    r.total_beds -
                    COUNT(
                        CASE
                            WHEN ra.status = 'Allocated'
                            THEN ra.id
                        END
                    )
                ) AS available_beds

            FROM rooms r

            LEFT JOIN room_allocation ra
                ON ra.room_id = r.id

            GROUP BY
                r.id,
                r.room_no,
                r.block,
                r.total_beds,
                r.status,
                r.hostel

            ORDER BY
                r.block ASC,
                r.room_no ASC
        `);

        const formattedRooms = rooms.map(
            (room) => {

                const totalBeds =
                    Number(room.total_beds);

                const allocatedBeds =
                    Number(room.allocated_beds);

                const availableBeds =
                    Math.max(
                        totalBeds -
                        allocatedBeds,
                        0
                    );

                let roomStatus = "Available";

                if (
                    room.status ===
                    "Maintenance"
                ) {
                    roomStatus = "Maintenance";
                } else if (
                    availableBeds <= 0
                ) {
                    roomStatus = "Occupied";
                }

                return {
                    ...room,
                    total_beds: totalBeds,
                    allocated_beds:
                        allocatedBeds,
                    available_beds:
                        availableBeds,
                    status: roomStatus
                };
            }
        );

        return res.status(200).json({
            success: true,
            rooms: formattedRooms
        });

    } catch (error) {
        console.error(
            "Get Available Rooms Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to fetch rooms.",
            error: error.message
        });
    }
};


// =====================================================
// ALLOCATE ROOM TO STUDENT
// =====================================================

const allocateRoom = async (req, res) => {
    let connection;

    try {
        const {
            student_id,
            room_id
        } = req.body;

        // -------------------------------------------------
        // VALIDATION
        // -------------------------------------------------

        if (
            !student_id ||
            !room_id
        ) {
            return res.status(400).json({
                success: false,
                message:
                    "Student and room are required."
            });
        }

        connection =
            await db.getConnection();

        await connection.beginTransaction();

        // -------------------------------------------------
        // CHECK STUDENT
        // -------------------------------------------------

        const [studentRows] =
            await connection.query(
                `
                SELECT
                id,
                name,
                id AS student_id
                FROM students
                WHERE id = ?
                LIMIT 1
                `,
                [student_id]
            );

        if (
            studentRows.length === 0
        ) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Student not found."
            });
        }

        const student =
            studentRows[0];

        // -------------------------------------------------
        // CHECK IF STUDENT ALREADY ALLOCATED
        // -------------------------------------------------

        const [existingAllocation] =
            await connection.query(
                `
                SELECT
                    ra.id,
                    ra.room_id,
                    r.room_no,
                    r.block
                FROM room_allocation ra
                INNER JOIN rooms r
                    ON r.id = ra.room_id
                WHERE
                    ra.student_id = ?
                    AND ra.status = 'Allocated'
                LIMIT 1
                `,
                [student_id]
            );

        if (
            existingAllocation.length > 0
        ) {
            await connection.rollback();

            const existing =
                existingAllocation[0];

            return res.status(409).json({
                success: false,
                message:
                    `${student.name} is already allocated to Room ${existing.room_no} (Block ${existing.block}).`
            });
        }

        // -------------------------------------------------
        // LOCK ROOM ROW
        // -------------------------------------------------

        const [roomRows] =
            await connection.query(
                `
                SELECT
                    id,
                    room_no,
                    block,
                    total_beds,
                    status,
                    hostel
                FROM rooms
                WHERE id = ?
                FOR UPDATE
                `,
                [room_id]
            );

        if (
            roomRows.length === 0
        ) {
            await connection.rollback();

            return res.status(404).json({
                success: false,
                message:
                    "Room not found."
            });
        }

        const room =
            roomRows[0];

        // -------------------------------------------------
        // CHECK ROOM STATUS
        // -------------------------------------------------

        if (
            room.status ===
            "Maintenance"
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    `Room ${room.room_no} is under maintenance.`
            });
        }

        // -------------------------------------------------
        // COUNT CURRENT ALLOCATIONS
        // -------------------------------------------------

        const [countRows] =
            await connection.query(
                `
                SELECT
                    COUNT(*) AS allocated_beds
                FROM room_allocation
                WHERE
                    room_id = ?
                    AND status = 'Allocated'
                `,
                [room_id]
            );

        const allocatedBeds =
            Number(
                countRows[0]
                    .allocated_beds
            );

        const totalBeds =
            Number(room.total_beds);

        const availableBeds =
            totalBeds -
            allocatedBeds;

        // -------------------------------------------------
        // FIND NEXT AVAILABLE BED
        // -------------------------------------------------

        const [bedRows] = await connection.query(
            `
    SELECT bed_no
    FROM room_allocation
    WHERE room_id = ?
    AND status = 'Allocated'
    ORDER BY bed_no ASC
    `,
            [room_id]
        );

        const occupiedBeds = bedRows.map(
            (row) => Number(row.bed_no)
        );

        let nextBedNo = 1;

        for (let i = 1; i <= totalBeds; i++) {
            if (!occupiedBeds.includes(i)) {
                nextBedNo = i;
                break;
            }
        }

        // -------------------------------------------------
        // ROOM FULL
        // -------------------------------------------------

        if (
            availableBeds <= 0
        ) {
            await connection.rollback();

            return res.status(400).json({
                success: false,
                message:
                    `Room ${room.room_no} is already full.`
            });
        }

        // -------------------------------------------------
        // CREATE ALLOCATION
        // -------------------------------------------------

        await connection.query(
            `
    INSERT INTO room_allocation
    (
        student_id,
        room_id,
        bed_no,
        allocation_date,
        status
    )
    VALUES
    (
        ?,
        ?,
        ?,
        CURDATE(),
        'Allocated'
    )
    `,
            [
                student_id,
                room_id,
                nextBedNo
            ]
        );

        // -------------------------------------------------
        // UPDATE ROOM STATUS
        // -------------------------------------------------

        const newAllocatedBeds =
            allocatedBeds + 1;

        const newRoomStatus =
            newAllocatedBeds >=
                totalBeds
                ? "Occupied"
                : "Available";

        await connection.query(
            `
            UPDATE rooms
            SET status = ?
            WHERE id = ?
            `,
            [
                newRoomStatus,
                room_id
            ]
        );

        await connection.commit();

        // -------------------------------------------------
        // SUCCESS
        // -------------------------------------------------

        return res.status(201).json({
            success: true,
            message:
                `Room ${room.room_no} allocated successfully to ${student.name}.`,
            allocation: {
                student_id:
                    student.id,
                student_name:
                    student.name,
                room_id:
                    room.id,
                room_no:
                    room.room_no,
                block:
                    room.block,
                total_beds:
                    totalBeds,
                allocated_beds:
                    newAllocatedBeds,
                available_beds:
                    totalBeds -
                    newAllocatedBeds,
                status:
                    newRoomStatus
            }
        });

    } catch (error) {

        if (connection) {
            try {
                await connection.rollback();
            } catch (
            rollbackError
            ) {
                console.error(
                    "Rollback Error:",
                    rollbackError
                );
            }
        }

        console.error(
            "Allocate Room Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Failed to allocate room.",
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
    getAvailableStudents,
    getAvailableRooms,
    allocateRoom
};