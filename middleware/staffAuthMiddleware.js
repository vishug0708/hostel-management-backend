const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET || process.env.JWT_SECRET_KEY;

module.exports = (req, res, next) => {
    try {
        const header = req.headers.authorization || "";
        const token = header.startsWith("Bearer ") ? header.slice(7) : null;
        if (!token) return res.status(401).json({ success: false, message: "Unauthorized. Staff token required." });
        if (!JWT_SECRET) return res.status(500).json({ success: false, message: "JWT_SECRET is not configured." });
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded.userType !== "staff") return res.status(403).json({ success: false, message: "Staff access only." });
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: "Invalid or expired staff token." });
    }
};