const jwt = require("jsonwebtoken");

const authMiddleware = (req, res, next) => {

    try {

        // Authorization header
        const authHeader = req.headers.authorization;

        if (!authHeader) {

            return res.status(401).json({
                success: false,
                message: "Access denied. Please login first."
            });

        }


        // Expected:
        // Authorization: Bearer TOKEN

        const parts = authHeader.split(" ");

        if (
            parts.length !== 2 ||
            parts[0] !== "Bearer"
        ) {

            return res.status(401).json({
                success: false,
                message: "Invalid authorization format"
            });

        }


        const token = parts[1];


        // Verify JWT
        const decoded = jwt.verify(
            token,
            process.env.JWT_SECRET
        );


        // Store user information
        req.user = decoded;


        // Continue
        next();


    } catch (error) {

        console.error("JWT Error:", error.message);

        return res.status(401).json({
            success: false,
            message: "Invalid or expired token"
        });

    }

};


module.exports = authMiddleware;