import express from 'express';
import multer from 'multer';
import { parseExcel, importExcelData, downloadTemplate } from '../controllers/excelController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only Excel files
        if (
            file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
            file.mimetype === 'application/vnd.ms-excel'
        ) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files are allowed'), false);
        }
    },
});

// Routes
router.post('/parse', protect, upload.single('file'), parseExcel);
router.post('/import', protect, importExcelData);
router.get('/template', protect, downloadTemplate);

export default router;
