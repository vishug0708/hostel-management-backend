const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const authMiddleware = require("../middleware/authMiddleware");

const {
    getBackupStudents,
    createComplaint,
    getStudentComplaints,
    getComplaintById,
    getComplaintRating,
    submitComplaintRating
} = require("../controllers/studentComplaintController");

const router = express.Router();

const uploadDirectory = path.join(__dirname, "../uploads/complaints");

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDirectory),
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const safeName = `complaint-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;
        cb(null, safeName);
    }
});

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        return cb(null, true);
    }

    return cb(
        new Error("Only JPG, JPEG, PNG, WEBP and PDF files are allowed."),
        false
    );
};

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// =====================================================
// RATING ROUTES
// IMPORTANT: These routes MUST come before /:studentId
// No authMiddleware here because rating uses secure token
// =====================================================

router.get(
    "/rating/:token",
    getComplaintRating
);

router.post(
    "/rating/:token",
    submitComplaintRating
);

// =====================================================
// BACKUP STUDENTS
// =====================================================

router.get(
    "/backup-students/:studentId",
    authMiddleware,
    getBackupStudents
);

// =====================================================
// CREATE COMPLAINT
// =====================================================

router.post(
    "/",
    authMiddleware,
    upload.single("attachment"),
    createComplaint
);

// =====================================================
// GET STUDENT COMPLAINTS
// =====================================================

router.get(
    "/:studentId",
    authMiddleware,
    getStudentComplaints
);

// =====================================================
// GET SINGLE COMPLAINT DETAILS
// =====================================================

router.get(
    "/:studentId/:complaintId",
    authMiddleware,
    getComplaintById
);

module.exports = router;