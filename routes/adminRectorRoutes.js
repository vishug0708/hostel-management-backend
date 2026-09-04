const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const authMiddleware = require('../middleware/authMiddleware');
const controller = require('../controllers/adminRectorController');
const router = express.Router();
const uploadDir = path.join(__dirname, '..', 'uploads', 'rectors');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const upload = multer({
  storage: multer.diskStorage({ destination: (_, __, cb) => cb(null, uploadDir), filename: (_, file, cb) => cb(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-')}`) }),
  fileFilter: (_, file, cb) => cb(null, ['image/jpeg','image/jpg','image/png','image/webp'].includes(file.mimetype)),
  limits: { fileSize: 5 * 1024 * 1024 }
});
router.get('/', authMiddleware, controller.getRectors);
router.get('/:id', authMiddleware, controller.getRector);
router.post('/', authMiddleware, upload.single('photo'), controller.addRector);
router.put('/:id', authMiddleware, upload.single('photo'), controller.updateRector);
router.patch('/:id/status', authMiddleware, controller.updateRectorStatus);
module.exports = router;
