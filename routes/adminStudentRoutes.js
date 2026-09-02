const express = require("express");

const {
    addStudent,
    getStudents,
    getStudentById,
    updateStudent
} = require("../controllers/adminStudentController");

const authMiddleware = require("../middleware/authMiddleware");

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
    updateStudent
);

module.exports = router;