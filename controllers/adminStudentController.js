const bcrypt = require("bcryptjs");
const db = require("../config/database");


// =====================================================
// ADD STUDENT
// =====================================================

const addStudent = async (req, res) => {
    try {
        const {
            name,
            email,
            mobile,
            password,
            confirm_password,
            parent_email,
            college,
            course,
            hostel
        } = req.body;

        if (
            !name ||
            !email ||
            !mobile ||
            !password ||
            !confirm_password ||
            !parent_email ||
            !college ||
            !course ||
            !hostel
        ) {
            return res.status(400).json({
                success: false,
                message: "Please fill all required fields"
            });
        }

        if (password !== confirm_password) {
            return res.status(400).json({
                success: false,
                message: "Password and confirm password do not match"
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters"
            });
        }

        if (!/^[0-9]{10}$/.test(mobile)) {
            return res.status(400).json({
                success: false,
                message: "Mobile number must contain exactly 10 digits"
            });
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address"
            });
        }

        const checkEmailSql = `
            SELECT id
            FROM students
            WHERE email = ?
            LIMIT 1
        `;

        const [existingStudents] = await db.query(
            checkEmailSql,
            [email]
        );

        if (existingStudents.length > 0) {
            return res.status(409).json({
                success: false,
                message: "Student with this email already exists"
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const insertSql = `
            INSERT INTO students
            (
                name,
                email,
                mobile,
                password,
                parent_email,
                college,
                course,
                hostel
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const [result] = await db.query(
            insertSql,
            [
                name,
                email,
                mobile,
                hashedPassword,
                parent_email,
                college,
                course,
                hostel
            ]
        );

        return res.status(201).json({
            success: true,
            message: "Student added successfully",
            student: {
                id: result.insertId,
                name,
                email,
                mobile,
                parent_email,
                college,
                course,
                hostel
            }
        });

    } catch (error) {
        console.error("Add Student Error:", error);

        return res.status(500).json({
            success: false,
            message: "Server error",
            error: error.message
        });
    }
};

// =====================================================
// GET ALL STUDENTS
// =====================================================

const getStudents = async (req, res) => {
    try {
        const sql = `
            SELECT
                id,
                name,
                email,
                mobile,
                parent_email,
                college,
                course,
                hostel,
                hostel_fee,
                photo
            FROM students
            ORDER BY id ASC
        `;

        const [results] = await db.query(sql);

        return res.status(200).json({
            success: true,
            students: results
        });
    } catch (error) {
        console.error("Get Students Database Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch students",
            error: error.message
        });
    }
};

// =====================================================
// GET STUDENT BY ID
// =====================================================

const getStudentById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!id || isNaN(id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student ID"
            });
        }

        const sql = `
            SELECT
                id,
                name,
                email,
                mobile,
                parent_email,
                college,
                course,
                hostel,
                hostel_fee,
                photo
            FROM students
            WHERE id = ?
            LIMIT 1
        `;

        const [results] = await db.query(sql, [id]);

        if (results.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Student not found"
            });
        }

        return res.status(200).json({
            success: true,
            student: results[0]
        });

    } catch (error) {
        console.error("Get Student By ID Error:", error);

        return res.status(500).json({
            success: false,
            message: "Failed to fetch student",
            error: error.message
        });
    }
};

// =====================================================
// UPDATE STUDENT
// =====================================================

const updateStudent = (req, res) => {

    const { id } = req.params;

    const {
        name,
        email,
        mobile,
        parent_email,
        college,
        course,
        hostel
    } = req.body;


    // =================================================
    // VALIDATE ID
    // =================================================

    if (!id || isNaN(id)) {

        return res.status(400).json({

            success: false,

            message: "Invalid student ID"

        });

    }


    // =================================================
    // REQUIRED FIELDS
    // =================================================

    if (
        !name ||
        !email ||
        !mobile ||
        !parent_email ||
        !college ||
        !course ||
        !hostel
    ) {

        return res.status(400).json({

            success: false,

            message:
                "Please fill all required fields"

        });

    }


    // =================================================
    // MOBILE VALIDATION
    // =================================================

    if (!/^[0-9]{10}$/.test(mobile)) {

        return res.status(400).json({

            success: false,

            message:
                "Mobile number must contain exactly 10 digits"

        });

    }


    // =================================================
    // EMAIL VALIDATION
    // =================================================

    const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (!emailRegex.test(email)) {

        return res.status(400).json({

            success: false,

            message:
                "Please enter a valid email address"

        });

    }


    // =================================================
    // CHECK EMAIL
    // =================================================

    const checkEmailSql = `
        SELECT id
        FROM students
        WHERE email = ?
        AND id != ?
        LIMIT 1
    `;


    db.query(
        checkEmailSql,
        [email, id],
        (checkErr, results) => {

            if (checkErr) {

                console.error(
                    "Check Student Email Error:",
                    checkErr
                );

                return res.status(500).json({

                    success: false,

                    message:
                        "Database error"

                });

            }


            if (results.length > 0) {

                return res.status(409).json({

                    success: false,

                    message:
                        "Another student already uses this email"

                });

            }


            // =============================================
            // UPDATE
            // =============================================

            const updateSql = `
                UPDATE students
                SET
                    name = ?,
                    email = ?,
                    mobile = ?,
                    parent_email = ?,
                    college = ?,
                    course = ?,
                    hostel = ?
                WHERE id = ?
            `;


            db.query(
                updateSql,
                [
                    name,
                    email,
                    mobile,
                    parent_email,
                    college,
                    course,
                    hostel,
                    id
                ],
                (updateErr, result) => {

                    if (updateErr) {

                        console.error(
                            "Update Student Error:",
                            updateErr
                        );

                        return res.status(500).json({

                            success: false,

                            message:
                                "Failed to update student",

                            error:
                                updateErr.message

                        });

                    }


                    if (result.affectedRows === 0) {

                        return res.status(404).json({

                            success: false,

                            message:
                                "Student not found"

                        });

                    }


                    return res.status(200).json({

                        success: true,

                        message:
                            "Student updated successfully"

                    });

                }
            );

        }
    );

};

// =====================================================
// EXPORT
// =====================================================

module.exports = {
    addStudent,
    getStudents,
    getStudentById,
    updateStudent
};
