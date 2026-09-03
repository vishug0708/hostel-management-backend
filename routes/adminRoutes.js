const express = require("express");
const {
    getAdminProfile,
    updateAdminProfile,
    changeAdminPassword
} = require("../controllers/adminController");
const authMiddleware = require("../middleware/authMiddleware");
const uploadAdminPhoto = require("../middleware/uploadAdminPhoto");

const router = express.Router();

router.get("/profile", authMiddleware, getAdminProfile);
router.put(
    "/profile",
    authMiddleware,
    (req, res, next) => {
        uploadAdminPhoto.single("photo")(req, res, (error) => {
            if (error) {
                return res.status(400).json({
                    success: false,
                    message: error.message || "Photo upload failed"
                });
            }
            next();
        });
    },
    updateAdminProfile
);
router.put("/change-password", authMiddleware, changeAdminPassword);

module.exports = router;
