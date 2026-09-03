const express = require("express");

const {
    addStudent,
    getStudents,
    getStudentById,
    updateStudent
} = require("../controllers/adminStudentController");

const authMiddleware = require("../middleware/authMiddleware");
const uploadStudentPhoto = require("../middleware/uploadStudentPhoto");

const router = express.Router();


// =====================================================
// GET ALL STUDENTS
// =====================================================

router.get(
    "/",
    authMiddleware,
    getStudents
);


// =====================================================
// ADD STUDENT
// =====================================================

router.post(
    "/",
    authMiddleware,
    uploadStudentPhoto.single("photo"),
    addStudent
);

// =====================================================
// GET STUDENT BY ID
// =====================================================

router.get(
    "/:id",
    authMiddleware,
    getStudentById
);


// =====================================================
// UPDATE STUDENT
// =====================================================

router.put(
    "/:id",
    authMiddleware,
    uploadStudentPhoto.single("photo"),
    updateStudent
);

module.exports = router;