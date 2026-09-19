import express from 'express';
import {
    getAssets,
    getAssetById,
    createAsset,
    updateAsset,
    deleteAsset,
    getAssetStats,
    addMaintenanceLog,
    getAllMaintenanceLogs,
} from '../controllers/assetController.js';

const router = express.Router();

router.route('/dashboard').get(getAssetStats);
router.route('/maintenance/all').get(getAllMaintenanceLogs);

router.route('/')
    .get(getAssets)
    .post(createAsset);

router.route('/:id')
    .get(getAssetById)
    .put(updateAsset)
    .delete(deleteAsset);

router.route('/:id/maintenance')
    .post(addMaintenanceLog);

export default router;
