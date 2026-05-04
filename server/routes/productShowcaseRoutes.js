import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { authorize } from '../middleware/authMiddleware.js';
import {
    getShowcases,
    getShowcaseById,
    createShowcase,
    updateShowcase,
    deleteShowcase,
    uploadImages,
    deleteImage,
    generateQRCode,
} from '../controllers/productShowcaseController.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Multer setup for showcase image uploads ──────────────────────────────────
const uploadDir = path.join(__dirname, '..', 'uploads', 'showcase');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadDir),
    filename: (_req, file, cb) => {
        const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
        const ext = path.extname(file.originalname);
        cb(null, `showcase-${unique}${ext}`);
    },
});

const fileFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);
    if (extOk && mimeOk) return cb(null, true);
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp)'));
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB max

// ─── Routes ───────────────────────────────────────────────────────────────────

// Roles that can manage showcases
const managerRoles = ['admin', 'manager', 'tenant_admin', 'tenant_owner', 'super_admin'];

router.route('/')
    .get(getShowcases)
    .post(authorize(...managerRoles), createShowcase);

router.route('/:id')
    .get(getShowcaseById)
    .put(authorize(...managerRoles), updateShowcase)
    .delete(authorize('admin', 'tenant_admin', 'tenant_owner', 'super_admin'), deleteShowcase);

// Image upload (multi-file)
router.post(
    '/:id/images',
    authorize(...managerRoles),
    upload.array('images', 20),
    uploadImages
);

// Delete single image
router.delete(
    '/:id/images/:imageId',
    authorize(...managerRoles),
    deleteImage
);

// QR Code generation
router.get('/:id/qrcode', generateQRCode);

export default router;
