import express from 'express';
import { getSizes, createSize, updateSize, deleteSize } from '../controllers/sizeController.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.route('/')
    .get(getSizes)
    .post(createSize);

router.route('/:id')
    .put(updateSize)
    .delete(deleteSize);

export default router;
