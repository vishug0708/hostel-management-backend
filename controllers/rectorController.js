const bcrypt = require("bcryptjs");
const db = require("../config/database");

const rectorLogin = (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "Email and password are required."
        });
    }

    const sql = `
        SELECT
            id,
            name,
            email,
            password,
            phone
        FROM rectors
        WHERE email = ?
        LIMIT 1
    `;

    db.query(sql, [email.trim()], async (error, results) => {
        if (error) {
            console.error("Rector Login Database Error:", error);

            return res.status(500).json({
                success: false,
                message: "Server error during rector login.",
                error: error.message
            });
        }

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const rector = results[0];

        let passwordMatch = false;

        try {
            passwordMatch = await bcrypt.compare(
                password,
                rector.password
            );
        } catch (bcryptError) {
            console.error("Bcrypt Error:", bcryptError);

            // Your current DB contains plain password,
            // so this also supports that format.
            passwordMatch = password === rector.password;
        }

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        delete rector.password;

        return res.status(200).json({
            success: true,
            message: "Rector login successful.",
            rector
        });
    });
};


const getRectorDashboard = async (req, res) => {
    try {
        const queries = {
            students: `
                SELECT COUNT(*) AS totalStudents
                FROM students
            `,
            leaves: `
                SELECT COUNT(*) AS pendingLeaves
                FROM leave_requests
                WHERE status = 'Pending'
            `,
            complaints: `
                SELECT COUNT(*) AS pendingComplaints
                FROM complaints
                WHERE status IN ('Pending', 'In Progress')
            `,
            bookings: `
                SELECT COUNT(*) AS pendingBookings
                FROM cricket_bookings
                WHERE booking_status = 'Pending Approval'
            `,
            allocatedRooms: `
                SELECT COUNT(*) AS allocatedRooms
                FROM room_allocation
            `,
            rooms: `
                SELECT COUNT(*) AS totalRooms
                FROM rooms
            `
        };

        const [
            [studentRows],
            [leaveRows],
            [complaintRows],
            [bookingRows],
            [allocatedRows],
            [roomRows]
        ] = await Promise.all([
            db.query(queries.students),
            db.query(queries.leaves),
            db.query(queries.complaints),
            db.query(queries.bookings),
            db.query(queries.allocatedRooms),
            db.query(queries.rooms)
        ]);

        const totalStudents = Number(
            studentRows[0]?.totalStudents || 0
        );

        const pendingLeaves = Number(
            leaveRows[0]?.pendingLeaves || 0
        );

        const pendingComplaints = Number(
            complaintRows[0]?.pendingComplaints || 0
        );

        const pendingBookings = Number(
            bookingRows[0]?.pendingBookings || 0
        );

        const allocatedRooms = Number(
            allocatedRows[0]?.allocatedRooms || 0
        );

        const totalRooms = Number(
            roomRows[0]?.totalRooms || 0
        );

        const availableRooms = Math.max(
            totalRooms - allocatedRooms,
            0
        );

        return res.status(200).json({
            success: true,
            stats: {
                totalStudents,
                pendingLeaves,
                pendingComplaints,
                pendingBookings,
                allocatedRooms,
                availableRooms
            }
        });

    } catch (error) {
        console.error("Rector Dashboard Database Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to load rector dashboard.",
            error: error.message
        });
    }
};


const getRectorProfile = (req, res) => {

    const rectorId = req.params.id;

    const sql = `
        SELECT
            id,
            name,
            email,
            phone
        FROM rectors
        WHERE id = ?
        LIMIT 1
    `;

    db.query(sql, [rectorId], (error, results) => {

        if (error) {
            console.error(
                "Get Rector Profile Database Error:",
                error
            );

            return res.status(500).json({
                success: false,
                message: "Failed to fetch rector profile.",
                error: error.message
            });
        }

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Rector not found."
            });
        }

        return res.status(200).json({
            success: true,
            rector: results[0]
        });
    });
};


module.exports = {
    rectorLogin,
    getRectorDashboard,
    getRectorProfile
};