import xlsx from 'xlsx';
import Item from '../models/Item.js';
import Category from '../models/Category.js';
import Brand from '../models/Brand.js';
import Size from '../models/Size.js';
import Transaction from '../models/Transaction.js';
import Location from '../models/Location.js';
import { appConn } from '../config/db.js';
import { tenantQuery } from '../utils/tenantQuery.js';

// Parse Excel file and return data
export const parseExcel = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        // Read the Excel file
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const data = xlsx.utils.sheet_to_json(worksheet);

        if (data.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        // Validate and process each row
        const processedData = data.map((row, index) => {
            const errors = [];

            // Required field validation
            if (!row['Item Name'] || row['Item Name'].toString().trim() === '') {
                errors.push('Item Name is required');
            }
            if (!row['SKU'] || row['SKU'].toString().trim() === '') {
                errors.push('SKU is required');
            }
            if (!row['Category'] || row['Category'].toString().trim() === '') {
                errors.push('Category is required');
            }
            if (!row['Quantity'] || isNaN(row['Quantity']) || row['Quantity'] <= 0) {
                errors.push('Quantity must be a positive number');
            }
            if (!row['Unit'] || row['Unit'].toString().trim() === '') {
                errors.push('Unit is required');
            }
            if (!row['Price'] || isNaN(row['Price']) || row['Price'] < 0) {
                errors.push('Price must be a non-negative number');
            }

            // Optional field validation
            if (row['Min Stock Level'] && (isNaN(row['Min Stock Level']) || row['Min Stock Level'] < 0)) {
                errors.push('Min Stock Level must be a non-negative number');
            }

            return {
                rowNumber: index + 2, // Excel row number (1-indexed + header)
                data: {
                    name: row['Item Name']?.toString().trim() || '',
                    sku: row['SKU']?.toString().trim().toUpperCase() || '',
                    category: row['Category']?.toString().trim() || '',
                    quantity: parseFloat(row['Quantity']) || 0,
                    unit: row['Unit']?.toString().trim() || '',
                    price: parseFloat(row['Price']) || 0,
                    supplier: row['Supplier']?.toString().trim() || '',
                    location: row['Location']?.toString().trim() || '',
                    minStockLevel: row['Min Stock Level'] ? parseFloat(row['Min Stock Level']) : 0,
                    description: row['Description']?.toString().trim() || '',
                    date: row['Date'] ? new Date(row['Date']) : new Date(),
                    customFields: {},
                },
            };

            // Capture custom fields (any column that doesn't match standard fields)
            const standardFields = [
                'Item Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Price', 
                'Supplier', 'Location', 'Min Stock Level', 'Description', 'Date'
            ];

            Object.keys(row).forEach(key => {
                if (!standardFields.includes(key)) {
                    result.data.customFields[key] = row[key];
                }
            });

            return result;
        });

        // Check for duplicate SKUs in the file
        const skuMap = new Map();
        processedData.forEach((item) => {
            if (item.data.sku) {
                if (skuMap.has(item.data.sku)) {
                    item.isValid = false;
                    item.errors.push(`Duplicate SKU in file (also at row ${skuMap.get(item.data.sku)})`);
                } else {
                    skuMap.set(item.data.sku, item.rowNumber);
                }
            }
        });

        res.json({
            totalRows: processedData.length,
            validRows: processedData.filter(item => item.isValid).length,
            invalidRows: processedData.filter(item => !item.isValid).length,
            data: processedData,
        });
    } catch (error) {
        console.error('Excel parsing error:', error);
        res.status(500).json({ message: 'Error parsing Excel file', error: error.message });
    }
};

// Import validated data
export const importExcelData = async (req, res, next) => {
    try {
        const { items, options = {} } = req.body;
        const updateMode = options.updateMode || 'add'; // 'add' or 'overwrite'

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'No items to import' });
        }

        const results = {
            success: [],
            failed: [],
            updated: [],
        };

        // Process each item
        for (const itemData of items) {
            try {
                // Resolve Category ID
                let categoryId;
                const category = await Category.findOne({ 
                    name: { $regex: new RegExp(`^${itemData.category}$`, 'i') },
                    ...tenantQuery(req)
                });

                if (category) {
                    categoryId = category._id;
                } else {
                    // Create category if it doesn't exist
                    const newCategory = await Category.create({ 
                        name: itemData.category,
                        tenantId: req.tenantId
                    });
                    categoryId = newCategory._id;
                }

                // Check if item exists by SKU or Name within the tenant
                let item = await Item.findOne({
                    $or: [
                        { sku: itemData.sku },
                        { name: itemData.name }
                    ],
                    ...tenantQuery(req)
                });

                if (item) {
                    // Item exists - update quantity
                    const previousQuantity = item.quantity;
                    if (updateMode === 'overwrite') {
                        item.quantity = itemData.quantity;
                    } else {
                        item.quantity += itemData.quantity;
                    }
                    // Update price and location if provided
                    if (itemData.price) item.price = itemData.price;
                    if (itemData.location) item.location = itemData.location;
                    if (itemData.customFields) {
                        item.customFields = { ...item.customFields, ...itemData.customFields };
                    }
                    await item.save();

                    // Create inward transaction
                    await Transaction.create({
                        item: item._id,
                        type: 'inward',
                        quantity: itemData.quantity,
                        previousQuantity: previousQuantity,
                        newQuantity: item.quantity,
                        reason: 'Excel Import',
                        location: itemData.location || item.location,
                        user: req.user._id,
                        ...tenantQuery(req)
                    });

                    results.updated.push({
                        sku: itemData.sku,
                        name: itemData.name,
                        message: 'Quantity updated',
                    });
                } else {
                    // Create new item
                    item = await Item.create({
                        name: itemData.name,
                        sku: itemData.sku,
                        category: categoryId,
                        quantity: itemData.quantity,
                        price: itemData.price,
                        location: itemData.location,
                        minStockThreshold: itemData.minStockLevel || 0,
                        customFields: itemData.customFields || {},
                        ...tenantQuery(req)
                    });

                    // Create inward transaction
                    await Transaction.create({
                        item: item._id,
                        type: 'inward',
                        quantity: itemData.quantity,
                        previousQuantity: 0,
                        newQuantity: itemData.quantity,
                        reason: 'Excel Import',
                        location: itemData.location || item.location,
                        user: req.user._id,
                        ...tenantQuery(req)
                    });

                    results.success.push({
                        sku: itemData.sku,
                        name: itemData.name,
                        message: 'Item created',
                    });
                }
            } catch (error) {
                results.failed.push({
                    sku: itemData.sku,
                    name: itemData.name,
                    error: error.message,
                });
            }
        }

        res.json({
            message: 'Import completed',
            totalProcessed: items.length,
            successCount: results.success.length,
            updatedCount: results.updated.length,
            failedCount: results.failed.length,
            results: results,
        });
    } catch (error) {
        next(error);
    }
};

// Generate Excel template
export const downloadTemplate = async (req, res, next) => {
    try {
        // Fetch all unique custom field keys across all items for this tenant
        const allItems = await Item.find({ ...tenantQuery(req) }, 'customFields');
        const customFieldKeys = new Set();
        allItems.forEach(item => {
            if (item.customFields) {
                Object.keys(item.customFields).forEach(key => customFieldKeys.add(key));
            }
        });

        // Fetch all managed locations for this tenant
        const locations = await Location.find({ ...tenantQuery(req), isActive: true });
        const locationNames = locations.map(loc => loc.name).join(', ') || 'Main Warehouse';

        // Create sample data with dynamic headers
        const headers = [
            'Item Name', 'SKU', 'Category', 'Quantity', 'Unit', 'Price', 
            'Supplier', 'Location', 'Min Stock Level', 'Description', 'Date'
        ];
        
        // Add custom field keys to headers
        const customHeaderStartIdx = headers.length;
        customFieldKeys.forEach(key => headers.push(key));

        const sampleData = [
            {
                'Item Name': 'Laptop Dell XPS 15',
                'SKU': 'LAP-001',
                'Category': 'Electronics',
                'Quantity': 10,
                'Unit': 'pieces',
                'Price': 45000,
                'Supplier': 'Dell India',
                'Location': locations[0]?.name || 'Warehouse A',
                'Min Stock Level': 5,
                'Description': '15-inch laptop with i7 processor',
                'Date': '2024-01-15',
            },
        ];

        // Add empty values for custom fields in sample data
        customFieldKeys.forEach(key => {
            sampleData[0][key] = '';
        });

        // Create workbook and worksheet
        const workbook = xlsx.utils.book_new();
        const worksheet = xlsx.utils.json_to_sheet(sampleData, { header: headers });

        // Set column widths
        const colWidths = [
            { wch: 25 }, // Item Name
            { wch: 15 }, // SKU
            { wch: 15 }, // Category
            { wch: 10 }, // Quantity
            { wch: 10 }, // Unit
            { wch: 10 }, // Price
            { wch: 20 }, // Supplier
            { wch: 15 }, // Location
            { wch: 15 }, // Min Stock Level
            { wch: 30 }, // Description
            { wch: 12 }, // Date
        ];

        // Add widths for custom field columns
        customFieldKeys.forEach(() => colWidths.push({ wch: 20 }));
        
        worksheet['!cols'] = colWidths;

        // Add comment to Location header explaining how to use managed locations
        if (!worksheet['H1'].c) worksheet['H1'].c = [];
        worksheet['H1'].c.push({ a: 'System', t: `Available Locations: ${locationNames}` });

        xlsx.utils.book_append_sheet(workbook, worksheet, 'Stock Inward');

        // Generate buffer
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set headers for download
        res.setHeader('Content-Disposition', 'attachment; filename=stock_inward_template.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (error) {
        next(error);
    }
};
// Get headers and preview from Excel file
// Auto-detects the actual header row (skips blank or purely numeric rows at top)
export const getExcelHeaders = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Read all rows as raw arrays
        const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });

        // Find the first row that has mostly text (non-numeric) values — that's our header row
        const isGoodHeaderRow = (row) => {
            const nonEmpty = row.filter(v => v !== '' && v !== null && v !== undefined);
            if (nonEmpty.length === 0) return false;
            // A header row should have at least some string values
            const textCells = nonEmpty.filter(v => typeof v === 'string');
            return textCells.length >= Math.ceil(nonEmpty.length * 0.5);
        };

        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(5, allRows.length); i++) {
            if (isGoodHeaderRow(allRows[i])) {
                headerRowIdx = i;
                break;
            }
        }

        // Build headers from the detected header row, fall back to 'Column N' for blank cells
        const rawHeaders = allRows[headerRowIdx] || [];
        const range = xlsx.utils.decode_range(worksheet['!ref']);
        const headers = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const val = rawHeaders[C];
            headers.push((val !== undefined && val !== '') ? String(val).trim() : `Column ${C + 1}`);
        }

        // Data rows start after the header row
        const dataRows = allRows.slice(headerRowIdx + 1);
        const previewRows = dataRows.slice(0, 5);

        res.json({
            headers,
            previewRows,
            totalRows: dataRows.length,
            headerRowIdx,
        });
    } catch (error) {
        console.error('Error extracting headers:', error);
        res.status(500).json({ message: 'Error parsing Excel file', error: error.message });
    }
};

// Bulk import with custom mapping — supports brand, size, sqFtPerPc, pcsPerBox, hsn
export const importBulkMapped = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const options = JSON.parse(req.body.options || '{}');
        const updateMode = options.updateMode || 'add'; // 'add' or 'overwrite'
        const mapping = JSON.parse(req.body.mapping || '{}');
        const headerRowIdx = parseInt(req.body.headerRowIdx || '0', 10);

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Read all raw rows, then slice from headerRowIdx+1 to get data rows
        const allRows = xlsx.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        const headerRow = allRows[headerRowIdx] || [];
        const dataRows = allRows.slice(headerRowIdx + 1).filter(row =>
            row.some(cell => cell !== '' && cell !== null && cell !== undefined)
        );

        if (dataRows.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty or has no data rows' });
        }

        // Build a helper to get a value from a row by header name
        const getCell = (row, headerName) => {
            if (!headerName) return undefined;
            const colIdx = headerRow.findIndex(h => String(h).trim() === String(headerName).trim());
            return colIdx >= 0 ? row[colIdx] : undefined;
        };

        const results = { success: [], failed: [], updated: [] };


        // ─── In-memory caches (per import batch) ───────────────────────────
        // Keys are lower-cased name strings; values are resolved DB documents
        const categoryCache = {};  // { 'tiles': Category }
        const brandCache    = {};  // { 'tiles::solorex': Brand }
        const sizeCache     = {};  // { '4x2': true }

        // Helper: resolve or create a Category (cached)
        const resolveCategory = async (name) => {
            const key = name.toLowerCase().trim();
            if (categoryCache[key]) return categoryCache[key];
            let cat = await Category.findOne({
                name: { $regex: new RegExp(`^${name}$`, 'i') },
                ...tenantQuery(req)
            });
            if (!cat) cat = await Category.create({ name, tenantId: req.tenantId });
            categoryCache[key] = cat;
            return cat;
        };

        // Helper: resolve or create a Brand (cached per category)
        const resolveBrand = async (brandName, categoryId) => {
            const key = `${categoryId}::${brandName.toLowerCase().trim()}`;
            if (brandCache[key]) return brandCache[key];
            let brand = await Brand.findOne({
                name: { $regex: new RegExp(`^${brandName}$`, 'i') },
                categoryId,
                ...tenantQuery(req)
            });
            if (!brand) brand = await Brand.create({ name: brandName, categoryId, tenantId: req.tenantId });
            brandCache[key] = brand;
            return brand;
        };

        // Helper: resolve or create a Size (cached)
        const resolveSize = async (sizeName) => {
            const key = sizeName.toLowerCase().trim();
            if (sizeCache[key] !== undefined) return; // already handled
            const existing = await Size.findOne({
                name: { $regex: new RegExp(`^${sizeName}$`, 'i') },
                ...tenantQuery(req)
            });
            if (!existing) {
                const dimMatch = sizeName.match(/(\d+(?:\.\d+)?)[xX×](\d+(?:\.\d+)?)/);
                const width  = dimMatch ? parseFloat(dimMatch[1]) : 0;
                const height = dimMatch ? parseFloat(dimMatch[2]) : 0;
                await Size.create({ name: sizeName, width, height, unit: 'inches', tenantId: req.tenantId });
            }
            sizeCache[key] = true;
        };
        // ───────────────────────────────────────────────────────────────────

        for (const row of dataRows) {
            try {
                const rawName = getCell(row, mapping.name);
                if (!rawName) continue; // skip empty rows

                const itemData = {
                    name: String(rawName).trim(),
                    sku: mapping.sku ? String(getCell(row, mapping.sku) || '').trim() : '',
                    barcode: mapping.barcode ? String(getCell(row, mapping.barcode) || '').trim() : '',
                    partNumber: mapping.partNumber ? String(getCell(row, mapping.partNumber) || '').trim() : '',
                    category: mapping.category ? String(getCell(row, mapping.category) || '').trim() : '',
                    brand: mapping.brand ? String(getCell(row, mapping.brand) || '').trim() : '',
                    size: mapping.size ? String(getCell(row, mapping.size) || '').trim() : '',
                    hsn: mapping.hsn ? String(getCell(row, mapping.hsn) || '').trim() : '',
                    quantity: parseFloat(getCell(row, mapping.quantity)) || 0,
                    price: parseFloat(getCell(row, mapping.price)) || 0,
                    purchasePrice: parseFloat(getCell(row, mapping.purchasePrice)) || 0,
                    sqFtPerPc: parseFloat(getCell(row, mapping.sqFtPerPc)) || 0,
                    sqFtPerBox: parseFloat(getCell(row, mapping.sqFtPerBox)) || 0,
                    pcsPerBox: parseFloat(getCell(row, mapping.pcsPerBox)) || 1,
                    unitType: mapping.unitType ? String(getCell(row, mapping.unitType) || 'box').trim().toLowerCase() : 'box',
                    location: mapping.location ? String(getCell(row, mapping.location) || '').trim() : '',
                    minStockThreshold: parseFloat(getCell(row, mapping.minStockThreshold)) || 10,
                    description: mapping.description ? String(getCell(row, mapping.description) || '').trim() : '',
                };

                // Sanitize empty strings
                if (!itemData.sku) delete itemData.sku;
                if (!itemData.barcode) delete itemData.barcode;
                if (!itemData.partNumber) delete itemData.partNumber;

                // --- Resolve / auto-create Category (uses cache) ---
                const categoryName = itemData.category || 'Uncategorized';
                const category = await resolveCategory(categoryName);
                const categoryId = category._id;

                // --- Resolve / auto-create Brand (uses cache) ---
                const brandName = itemData.brand || '';
                if (brandName) await resolveBrand(brandName, categoryId);

                // --- Resolve / auto-create Size (uses cache) ---
                const sizeName = itemData.size || '';
                if (sizeName) await resolveSize(sizeName);

                // --- Check for existing item by SKU or name ---
                let item = null;
                if (itemData.sku) {
                    item = await Item.findOne({ sku: itemData.sku, ...tenantQuery(req) });
                }
                if (!item) {
                    item = await Item.findOne({ name: itemData.name, ...tenantQuery(req) });
                }

                // Whether the user actually mapped a quantity column
                const hasQuantityMapping = !!mapping.quantity;
                const stockQty = hasQuantityMapping ? (parseFloat(getCell(row, mapping.quantity)) || 0) : null;

                if (item) {
                    // --- Update existing item ---
                    // Only touch quantity if the user mapped a quantity column
                    if (hasQuantityMapping && stockQty !== null) {
                        const previousQuantity = item.quantity;
                        if (updateMode === 'overwrite') {
                            item.quantity = stockQty;
                        } else {
                            item.quantity += stockQty;
                        }

                        await item.save();

                        // Only create a transaction if there was actual stock movement
                        if (stockQty > 0) {
                            await Transaction.create({
                                item: item._id,
                                type: 'inward',
                                quantity: stockQty,
                                previousQuantity,
                                newQuantity: item.quantity,
                                reason: 'Bulk Mapping Import',
                                location: itemData.location || item.location,
                                user: req.user._id,
                                ...tenantQuery(req)
                            });
                        }
                    }

                    // Always update item master fields (no stock touched)
                    if (itemData.price) item.price = itemData.price;
                    if (itemData.purchasePrice) item.purchasePrice = itemData.purchasePrice;
                    if (itemData.location) item.location = itemData.location;
                    if (itemData.description) item.description = itemData.description;
                    if (itemData.barcode) item.barcode = itemData.barcode;
                    if (itemData.partNumber) item.partNumber = itemData.partNumber;
                    if (brandName) item.brand = brandName;
                    if (sizeName) item.size = sizeName;
                    if (itemData.hsn) item.hsn = itemData.hsn;
                    if (itemData.sqFtPerPc > 0) item.sqFtPerPc = itemData.sqFtPerPc;
                    if (itemData.sqFtPerBox > 0) item.sqFtPerBox = itemData.sqFtPerBox;
                    if (itemData.pcsPerBox >= 1) item.pcsPerBox = itemData.pcsPerBox;
                    if (itemData.unitType) item.unitType = itemData.unitType;
                    if (categoryId) item.category = categoryId;

                    await item.save();

                    results.updated.push({ name: item.name, sku: item.sku });
                } else {
                    // --- Create new item (mirrors item create controller) ---
                    const newItemPayload = {
                        name: itemData.name,
                        category: categoryId,
                        quantity: hasQuantityMapping ? (stockQty || 0) : 0, // 0 if no qty column
                        price: itemData.price,
                        minStockThreshold: itemData.minStockThreshold,
                        pcsPerBox: itemData.pcsPerBox,
                        sqFtPerPc: itemData.sqFtPerPc,
                        sqFtPerBox: itemData.sqFtPerBox,
                        unitType: itemData.unitType,
                        tenantId: req.tenantId,
                    };

                    if (itemData.sku) newItemPayload.sku = itemData.sku;
                    if (itemData.barcode) newItemPayload.barcode = itemData.barcode;
                    if (itemData.partNumber) newItemPayload.partNumber = itemData.partNumber;
                    if (itemData.purchasePrice) newItemPayload.purchasePrice = itemData.purchasePrice;
                    if (itemData.location) newItemPayload.location = itemData.location;
                    if (itemData.description) newItemPayload.description = itemData.description;
                    if (brandName) newItemPayload.brand = brandName;
                    if (sizeName) newItemPayload.size = sizeName;
                    if (itemData.hsn) newItemPayload.hsn = itemData.hsn;

                    item = await Item.create(newItemPayload);

                    // Only create an inward transaction if there's actual stock to record
                    if (hasQuantityMapping && stockQty > 0) {
                        await Transaction.create({
                            item: item._id,
                            type: 'inward',
                            quantity: stockQty,
                            previousQuantity: 0,
                            newQuantity: item.quantity,
                            reason: 'Bulk Mapping Import',
                            location: itemData.location || '',
                            user: req.user._id,
                            ...tenantQuery(req)
                        });
                    }

                    results.success.push({ name: item.name, sku: item.sku });
                }
            } catch (error) {
                const rowName = mapping.name ? String(getCell(row, mapping.name) || 'Unknown').trim() : 'Unknown';
                results.failed.push({ name: rowName, error: error.message });
            }
        }

        res.json({
            message: 'Bulk import completed',
            totalProcessed: dataRows.length,
            successCount: results.success.length,
            updatedCount: results.updated.length,
            failedCount: results.failed.length,
            results
        });

    } catch (error) {
        next(error);
    }
};
