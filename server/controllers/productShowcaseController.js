import QRCode from 'qrcode';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import ProductShowcase from '../models/ProductShowcase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Convert a product name to a URL-safe slug.
 * e.g. "Wooden Chair!" → "wooden-chair"
 */
const generateSlug = (name) => {
    return name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

/**
 * Ensure slug is unique within the tenant. Appends -1, -2, … if needed.
 */
const ensureUniqueSlug = async (baseSlug, tenantId, excludeId = null) => {
    let slug = baseSlug;
    let counter = 1;
    while (true) {
        const query = { slug, tenantId };
        if (excludeId) query._id = { $ne: excludeId };
        const exists = await ProductShowcase.findOne(query);
        if (!exists) return slug;
        slug = `${baseSlug}-${counter}`;
        counter++;
    }
};

/**
 * Build the public URL for a showcase slug.
 * Falls back to a reasonable default if APP_PUBLIC_URL is not set.
 */
const buildPublicUrl = (slug) => {
    const base = process.env.APP_PUBLIC_URL || 'http://localhost:5173';
    return `${base}/p/${slug}`;
};

// ─── Protected Controllers (Admin Panel) ──────────────────────────────────────

// @desc    Get all showcases for tenant
// @route   GET /api/product-showcase
// @access  Private
export const getShowcases = async (req, res, next) => {
    try {
        const tenantId = req.tenantId;
        const showcases = await ProductShowcase.find({ tenantId })
            .sort({ createdAt: -1 })
            .lean();
        res.json({ success: true, data: showcases });
    } catch (error) {
        next(error);
    }
};

// @desc    Get single showcase by ID
// @route   GET /api/product-showcase/:id
// @access  Private
export const getShowcaseById = async (req, res, next) => {
    try {
        const showcase = await ProductShowcase.findOne({
            _id: req.params.id,
            tenantId: req.tenantId,
        });
        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Showcase not found' });
        }
        res.json({ success: true, data: showcase });
    } catch (error) {
        next(error);
    }
};

// @desc    Create a new showcase
// @route   POST /api/product-showcase
// @access  Private (Admin / Manager / Tenant Admin)
export const createShowcase = async (req, res, next) => {
    try {
        const { name, description, productId, isActive } = req.body;

        if (!name) {
            return res.status(400).json({ success: false, message: 'Showcase name is required' });
        }

        const baseSlug = generateSlug(name);
        const slug = await ensureUniqueSlug(baseSlug, req.tenantId);
        const qrCodeUrl = buildPublicUrl(slug);

        const showcase = await ProductShowcase.create({
            name,
            slug,
            description: description || '',
            productId: productId || null,
            tenantId: req.tenantId,
            isActive: isActive !== undefined ? isActive : true,
            qrCodeUrl,
            createdBy: req.user._id,
        });

        res.status(201).json({ success: true, data: showcase });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(400).json({ success: false, message: 'A showcase with this name/slug already exists.' });
        }
        next(error);
    }
};

// @desc    Update showcase (name, description, status)
// @route   PUT /api/product-showcase/:id
// @access  Private (Admin / Manager / Tenant Admin)
export const updateShowcase = async (req, res, next) => {
    try {
        const { name, description, isActive, productId, images } = req.body;

        const showcase = await ProductShowcase.findOne({
            _id: req.params.id,
            tenantId: req.tenantId,
        });
        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Showcase not found' });
        }

        // Update name & re-generate slug only if name changed
        if (name && name !== showcase.name) {
            const baseSlug = generateSlug(name);
            showcase.slug = await ensureUniqueSlug(baseSlug, req.tenantId, showcase._id);
            showcase.qrCodeUrl = buildPublicUrl(showcase.slug);
            showcase.name = name;
        }

        if (description !== undefined) showcase.description = description;
        if (isActive !== undefined) showcase.isActive = isActive;
        if (productId !== undefined) showcase.productId = productId || null;

        // Allow direct image array update (for reorder/edit from frontend)
        if (images !== undefined && Array.isArray(images)) {
            showcase.images = images;
        }

        await showcase.save();
        res.json({ success: true, data: showcase });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete showcase
// @route   DELETE /api/product-showcase/:id
// @access  Private (Admin / Tenant Admin only)
export const deleteShowcase = async (req, res, next) => {
    try {
        const showcase = await ProductShowcase.findOneAndDelete({
            _id: req.params.id,
            tenantId: req.tenantId,
        });
        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Showcase not found' });
        }

        // Clean up uploaded image files from disk
        for (const img of showcase.images) {
            if (img.url && img.url.startsWith('/uploads/')) {
                const filePath = path.join(__dirname, '..', img.url);
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }
        }

        res.json({ success: true, message: 'Showcase deleted successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Upload images to a showcase
// @route   POST /api/product-showcase/:id/images
// @access  Private
export const uploadImages = async (req, res, next) => {
    try {
        const showcase = await ProductShowcase.findOne({
            _id: req.params.id,
            tenantId: req.tenantId,
        });
        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Showcase not found' });
        }

        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ success: false, message: 'No files uploaded' });
        }

        const currentMaxOrder = showcase.images.reduce((max, img) => Math.max(max, img.order || 0), 0);

        const newImages = req.files.map((file, idx) => ({
            url: `/uploads/showcase/${file.filename}`,
            title: '',
            description: '',
            order: currentMaxOrder + idx + 1,
        }));

        showcase.images.push(...newImages);
        await showcase.save();

        res.json({ success: true, data: showcase });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a single image from a showcase
// @route   DELETE /api/product-showcase/:id/images/:imageId
// @access  Private
export const deleteImage = async (req, res, next) => {
    try {
        const showcase = await ProductShowcase.findOne({
            _id: req.params.id,
            tenantId: req.tenantId,
        });
        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Showcase not found' });
        }

        const imageIndex = showcase.images.findIndex(
            (img) => img._id.toString() === req.params.imageId
        );
        if (imageIndex === -1) {
            return res.status(404).json({ success: false, message: 'Image not found' });
        }

        const [removedImage] = showcase.images.splice(imageIndex, 1);

        // Remove file from disk if it was a local upload
        if (removedImage.url && removedImage.url.startsWith('/uploads/')) {
            const filePath = path.join(__dirname, '..', removedImage.url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }

        await showcase.save();
        res.json({ success: true, data: showcase });
    } catch (error) {
        next(error);
    }
};

// @desc    Generate/return QR code as a data URL (PNG base64)
// @route   GET /api/product-showcase/:id/qrcode
// @access  Private
export const generateQRCode = async (req, res, next) => {
    try {
        const showcase = await ProductShowcase.findOne({
            _id: req.params.id,
            tenantId: req.tenantId,
        });
        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Showcase not found' });
        }

        const url = showcase.qrCodeUrl || buildPublicUrl(showcase.slug);

        const qrDataUrl = await QRCode.toDataURL(url, {
            errorCorrectionLevel: 'M',
            margin: 2,
            color: {
                dark: '#1a1f2e',
                light: '#ffffff',
            },
            width: 400,
        });

        res.json({ success: true, qrCode: qrDataUrl, url });
    } catch (error) {
        next(error);
    }
};

// ─── Public Controller ─────────────────────────────────────────────────────────

// @desc    Get public product showcase by slug (no auth required)
// @route   GET /api/public/product/:slug
// @access  Public
export const getPublicProduct = async (req, res, next) => {
    try {
        const { slug } = req.params;

        const showcase = await ProductShowcase.findOne({
            slug,
            isActive: true,
        }).lean();

        if (!showcase) {
            return res.status(404).json({ success: false, message: 'Product not found or is inactive.' });
        }

        // Increment scan/view count (fire-and-forget, don't block response)
        ProductShowcase.findByIdAndUpdate(showcase._id, { $inc: { scanCount: 1 } }).exec();

        // Sort images by order before sending
        if (showcase.images) {
            showcase.images.sort((a, b) => (a.order || 0) - (b.order || 0));
        }

        res.json({ success: true, data: showcase });
    } catch (error) {
        next(error);
    }
};
