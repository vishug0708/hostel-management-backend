const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(__dirname, "..", "uploads", "students");

fs.mkdirSync(uploadDir, { recursive: true });

const pad = (value) => String(value).padStart(2, "0");

const getDateTime = () => {
    const now = new Date();

    const date = [
        now.getFullYear(),
        pad(now.getMonth() + 1),
        pad(now.getDate())
    ].join("");

    const time = [
        pad(now.getHours()),
        pad(now.getMinutes()),
        pad(now.getSeconds())
    ].join("");
    
    return { date, time };
};

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const studentId =
            req.user?.id ||
            req.user?.student_id ||
            req.params?.studentId ||
            req.body?.student_id ||
            "unknown";

        const { date, time } = getDateTime();

        const isUpdate =
            req.body?.isUpdate === "true" ||
            req.body?.isUpdate === true ||
            req.body?.update === "true" ||
            req.body?.photoUpdate === "true";

        const action = isUpdate ? "update" : "upload";

        const filename =
            `student-${studentId}-${date}-${time}-${action}${extension}`;

        cb(null, filename);
    }
});

const fileFilter = (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
        return cb(new Error("Only image files are allowed."));
    }

    cb(null, true);
};

module.exports = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});