import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { getBillingSettings, updateBillingSettings, uploadLogo, deleteLogo, getQuotationCounter, resetQuotationCounter } from '../controllers/settingController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Multer for logo upload ─────────────────────────────────────────────────────
const logoDir = path.join(__dirname, '..', 'uploads', 'logos');
if (!fs.existsSync(logoDir)) fs.mkdirSync(logoDir, { recursive: true });

const logoStorage = multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, logoDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `logo-${Date.now()}${ext}`);
    },
});

const logoFilter = (_req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|svg/;
    if (allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype.split('/')[1])) {
        return cb(null, true);
    }
    cb(new Error('Only image files are allowed (jpeg, jpg, png, webp, svg)'));
};

const uploadMiddleware = multer({ storage: logoStorage, fileFilter: logoFilter, limits: { fileSize: 5 * 1024 * 1024 } });

// ── Routes ─────────────────────────────────────────────────────────────────────
router.use(protect);

router.get('/billing', getBillingSettings);
router.patch('/billing', updateBillingSettings);
router.post('/billing/logo', uploadMiddleware.single('logo'), uploadLogo);
router.delete('/billing/logo', deleteLogo);

// Quotation Number Series Counter
router.get('/quotation-counter', getQuotationCounter);
router.patch('/quotation-counter', resetQuotationCounter);

export default router;
