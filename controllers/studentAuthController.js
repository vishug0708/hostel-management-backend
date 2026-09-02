const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");

const studentLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const [students] = await db.query(
            `
            SELECT
                id,
                name,
                email,
                password,
                mobile 
            FROM students
            WHERE email = ?
            LIMIT 1
            `,
            [email.trim()]
        );

        if (students.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const student = students[0];

        if (
            student.status &&
            String(student.status).toLowerCase() !== "active"
        ) {
            return res.status(403).json({
                success: false,
                message: "Your student account is not active."
            });
        }

        const passwordMatch = await bcrypt.compare(
            password,
            student.password
        );

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const secret =
            process.env.JWT_SECRET ||
            "hostel_management_secret";

        const token = jwt.sign(
            {
                id: student.id,
                student_id: student.id,
                role: "student"
            },
            secret,
            {
                expiresIn: "1d"
            }
        );

        return res.status(200).json({
            success: true,
            message: "Student login successful.",
            token,
            student: {
                id: student.id,
                name: student.name,
                email: student.email,
                mobile: student.mobile,
                role: "student"
            }
        });

    } catch (error) {
        console.error(
            "Student Login Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message: "Server error during student login.",
            error: error.message
        });
    }
};

module.exports = {
    studentLogin
};