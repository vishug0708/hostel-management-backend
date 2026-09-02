const bcrypt = require("bcryptjs");
const db = require("../config/database");

const rectorLogin = async (req, res) => {
    try {
        const { email, password } = req.body;

        // =============================================
        // VALIDATION
        // =============================================

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email and password are required."
            });
        }

        const cleanEmail = email
            .trim()
            .toLowerCase();

        // =============================================
        // FIND RECTOR
        // =============================================

        const sql = `
            SELECT
                id,
                name,
                email,
                password,
                phone
            FROM rectors
            WHERE LOWER(email) = ?
            LIMIT 1
        `;

        const [results] = await db.query(
            sql,
            [cleanEmail]
        );

        // =============================================
        // RECTOR NOT FOUND
        // =============================================

        if (results.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        const rector = results[0];

        // =============================================
        // PASSWORD CHECK
        // =============================================

        let passwordMatch = false;

        try {
            passwordMatch = await bcrypt.compare(
                password,
                rector.password
            );
        } catch (bcryptError) {
            console.error(
                "Bcrypt Error:",
                bcryptError
            );

            // Supports plain-text password
            // if your current DB contains one.
            passwordMatch =
                password === rector.password;
        }

        if (!passwordMatch) {
            return res.status(401).json({
                success: false,
                message: "Invalid email or password."
            });
        }

        // =============================================
        // REMOVE PASSWORD FROM RESPONSE
        // =============================================

        delete rector.password;

        // =============================================
        // SUCCESS
        // =============================================

        return res.status(200).json({
            success: true,
            message: "Rector login successful.",
            rector
        });

    } catch (error) {
        console.error(
            "Rector Login Error:",
            error
        );

        return res.status(500).json({
            success: false,
            message:
                "Server error during rector login.",
            error: error.message
        });
    }
};

module.exports = {
    rectorLogin
};