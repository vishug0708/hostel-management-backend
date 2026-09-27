const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
    createComplaint,
    getStudentComplaints,
    getStudentComplaintDetails,
    getBackupStudents
} = require("../controllers/studentComplaintController");

const router = express.Router();


// ============================================
// COMPLAINT UPLOAD DIRECTORY
// ============================================

const uploadDirectory = path.join(
    __dirname,
    "../uploads/complaints"
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}


// ============================================
// MULTER STORAGE
// ============================================

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(
            file.originalname
        );

        const uniqueName =
            `complaint-${Date.now()}-${Math.round(
                Math.random() * 1000000000
            )}${extension}`;

        cb(null, uniqueName);
    }
});


// ============================================
// FILE FILTER
// ============================================

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp",
        "application/pdf"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, JPEG, PNG, WEBP and PDF files are allowed."
            ),
            false
        );
    }
};


// ============================================
// MULTER CONFIGURATION
// ============================================

const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


// ============================================
// BACKUP STUDENTS
// GET /api/student/complaints/backup-students/:studentId
// ============================================

router.get(
    "/backup-students/:studentId",
    getBackupStudents
);


// ============================================
// CREATE COMPLAINT
// POST /api/student/complaints
// ============================================

router.post(
    "/",
    upload.single("attachment"),
    createComplaint
);


// ============================================
// GET ALL STUDENT COMPLAINTS
// GET /api/student/complaints/:studentId
// ============================================

router.get(
    "/:studentId",
    getStudentComplaints
);


// ============================================
// GET SINGLE COMPLAINT DETAILS
// GET /api/student/complaints/:studentId/:complaintId
// ============================================

router.get(
    "/:studentId/:complaintId",
    getStudentComplaintDetails
);


module.exports = router;