import express from 'express';
import { getBrands, createBrand, updateBrand, deleteBrand } from '../controllers/brandController.js';
import { checkMenuAccess } from '../middleware/accessMiddleware.js';

const router = express.Router();

router.get('/', getBrands);
router.post('/', checkMenuAccess('brands'), createBrand);
router.put('/:id', checkMenuAccess('brands'), updateBrand);
router.delete('/:id', checkMenuAccess('brands'), deleteBrand);

export default router;
