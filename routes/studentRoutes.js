const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const {
    getStudentProfile,
    updateStudentProfile,
    getStudentDashboard,
    getStudentRoom,
    getStudentLeaves,
    getStudentAttendance,
    getStudentComplaints
} = require("../controllers/studentController");

const router = express.Router();


// ===============================
// MULTER STORAGE
// ===============================

const uploadDirectory = path.join(
    __dirname,
    "../uploads/students"
);

if (!fs.existsSync(uploadDirectory)) {
    fs.mkdirSync(uploadDirectory, {
        recursive: true
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },

    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname);

        const fileName =
            `student-${req.params.id}-${Date.now()}${extension}`;

        cb(null, fileName);
    }
});


// ===============================
// FILE FILTER
// ===============================

const fileFilter = (req, file, cb) => {
    const allowedTypes = [
        "image/jpeg",
        "image/jpg",
        "image/png",
        "image/webp"
    ];

    if (allowedTypes.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(
            new Error(
                "Only JPG, JPEG, PNG and WEBP images are allowed."
            ),
            false
        );
    }
};


const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});


// ===============================
// STUDENT DASHBOARD
// ===============================

router.get(
    "/dashboard/:id",
    getStudentDashboard
);


// ===============================
// STUDENT PROFILE
// ===============================

router.get(
    "/profile/:id",
    getStudentProfile
);


// ===============================
// UPDATE STUDENT PROFILE
// ===============================

router.put(
    "/profile/:id",
    upload.single("photo"),
    updateStudentProfile
);


// ===============================
// STUDENT ROOM
// ===============================

router.get(
    "/room/:id",
    getStudentRoom
);


// ===============================
// STUDENT LEAVE REQUESTS
// ===============================

router.get(
    "/leaves/:id",
    getStudentLeaves
);


// ===============================
// STUDENT ATTENDANCE
// ===============================

router.get(
    "/attendance/:id",
    getStudentAttendance
);


// ===============================
// STUDENT COMPLAINTS
// ===============================

router.get(
    "/complaints/:id",
    getStudentComplaints
);


module.exports = router;