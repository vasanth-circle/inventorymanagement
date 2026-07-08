import express from 'express';
import {
    createWarehouseTransfer,
    getWarehouseTransfers,
    getWarehouseTransfer,
    dispatchWarehouseTransfer,
    receiveWarehouseTransfer,
    cancelWarehouseTransfer,
} from '../controllers/phase1Controller.js';

const router = express.Router();

// @route   POST   /api/warehouse-transfers
router.post('/', createWarehouseTransfer);

// @route   GET    /api/warehouse-transfers
router.get('/', getWarehouseTransfers);

// @route   GET    /api/warehouse-transfers/:id
router.get('/:id', getWarehouseTransfer);

// @route   PUT    /api/warehouse-transfers/:id/dispatch
router.put('/:id/dispatch', dispatchWarehouseTransfer);

// @route   PUT    /api/warehouse-transfers/:id/receive
router.put('/:id/receive', receiveWarehouseTransfer);

// @route   PUT    /api/warehouse-transfers/:id/cancel
router.put('/:id/cancel', cancelWarehouseTransfer);

export default router;
