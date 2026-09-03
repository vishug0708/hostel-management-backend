const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");

const authMiddleware = require("../middleware/authMiddleware");

const {
    getStaff,
    getStaffById,
    addStaff,
    updateStaff,
    updateStaffStatus
} = require("../controllers/adminStaffController");

const router = express.Router();

const uploadDir = path.join(
    __dirname,
    "..",
    "uploads",
    "staff"
);

if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, {
        recursive: true
    });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();
        const baseName = path
            .basename(file.originalname, extension)
            .replace(/[^a-zA-Z0-9_-]/g, "-")
            .substring(0, 40);

        cb(
            null,
            `${Date.now()}-${baseName || "staff"}${extension}`
        );
    }
});

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
            )
        );
    }
};

const uploadStaffPhoto = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 5 * 1024 * 1024
    }
});

// GET /api/admin/staff
router.get("/", authMiddleware, getStaff);

// GET /api/admin/staff/:id
router.get("/:id", authMiddleware, getStaffById);

// POST /api/admin/staff
router.post(
    "/",
    authMiddleware,
    uploadStaffPhoto.single("photo"),
    addStaff
);

// PUT /api/admin/staff/:id
router.put(
    "/:id",
    authMiddleware,
    uploadStaffPhoto.single("photo"),
    updateStaff
);

// PATCH /api/admin/staff/:id/status
router.patch(
    "/:id/status",
    authMiddleware,
    updateStaffStatus
);

module.exports = router;
