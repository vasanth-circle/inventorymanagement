import xlsx from 'xlsx';
import Item from '../models/Item.js';
import Category from '../models/Category.js';
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
export const getExcelHeaders = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Get headers (first row)
        const range = xlsx.utils.decode_range(worksheet['!ref']);
        const headers = [];
        for (let C = range.s.c; C <= range.e.c; ++C) {
            const address = xlsx.utils.encode_col(C) + '1';
            const cell = worksheet[address];
            headers.push(cell ? cell.v : `Column ${C + 1}`);
        }

        // Get first 5 rows for preview
        const data = xlsx.utils.sheet_to_json(worksheet, { range: 0, header: 1 });
        const previewRows = data.slice(1, 6); // Skip header, take next 5

        res.json({
            headers,
            previewRows,
            totalRows: data.length - 1
        });
    } catch (error) {
        console.error('Error extracting headers:', error);
        res.status(500).json({ message: 'Error parsing Excel file', error: error.message });
    }
};

// Bulk import with custom mapping
export const importBulkMapped = async (req, res, next) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const options = JSON.parse(req.body.options || '{}');
        const updateMode = options.updateMode || 'add'; // 'add' or 'overwrite'
        const mapping = JSON.parse(req.body.mapping || '{}');
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = xlsx.utils.sheet_to_json(worksheet);

        if (rawData.length === 0) {
            return res.status(400).json({ message: 'Excel file is empty' });
        }

        const results = {
            success: [],
            failed: [],
            updated: [],
        };

        // Standard fields mapping: { appField: excelHeader }
        for (const row of rawData) {
            try {
                // Transform row based on mapping
                const itemData = {
                    name: row[mapping.name]?.toString().trim(),
                    sku: row[mapping.sku]?.toString().trim() || row[mapping.barcode]?.toString().trim(),
                    barcode: row[mapping.barcode]?.toString().trim(),
                    category: row[mapping.category]?.toString().trim(),
                    quantity: parseFloat(row[mapping.quantity]) || 0,
                    price: parseFloat(row[mapping.price]) || 0,
                    location: row[mapping.location]?.toString().trim(),
                    minStockThreshold: parseFloat(row[mapping.minStockThreshold]) || 10,
                    description: row[mapping.description]?.toString().trim(),
                };

                // Ensure required fields
                if (!itemData.name) throw new Error('Item name is missing or mapped to empty column');
                
                // Resolve Category
                let categoryId;
                const categoryName = itemData.category || 'Uncategorized';
                const category = await Category.findOne({ 
                    name: { $regex: new RegExp(`^${categoryName}$`, 'i') },
                    ...tenantQuery(req)
                });

                if (category) {
                    categoryId = category._id;
                } else {
                    const newCategory = await Category.create({ 
                        name: categoryName,
                        tenantId: req.tenantId
                    });
                    categoryId = newCategory._id;
                }

                // Check for existing item
                let item = null;
                if (itemData.sku) {
                    item = await Item.findOne({ sku: itemData.sku, ...tenantQuery(req) });
                }
                
                if (!item) {
                    item = await Item.findOne({ name: itemData.name, ...tenantQuery(req) });
                }

                if (item) {
                    // Update existing
                    const previousQuantity = item.quantity;
                    if (updateMode === 'overwrite') {
                        item.quantity = itemData.quantity;
                    } else {
                        item.quantity += itemData.quantity;
                    }
                    item.price = itemData.price || item.price;
                    if (itemData.location) item.location = itemData.location;
                    if (itemData.description) item.description = itemData.description;
                    if (itemData.barcode) item.barcode = itemData.barcode;
                    
                    await item.save();

                    // Log transaction
                    await Transaction.create({
                        item: item._id,
                        type: 'inward',
                        quantity: itemData.quantity,
                        previousQuantity: previousQuantity,
                        newQuantity: item.quantity,
                        reason: 'Bulk Mapping Import',
                        location: itemData.location || item.location,
                        user: req.user._id,
                        ...tenantQuery(req)
                    });

                    results.updated.push({ name: item.name, sku: item.sku });
                } else {
                    // Create new
                    item = await Item.create({
                        name: itemData.name,
                        sku: itemData.sku || `SKU-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        barcode: itemData.barcode,
                        category: categoryId,
                        quantity: itemData.quantity,
                        price: itemData.price,
                        location: itemData.location,
                        minStockThreshold: itemData.minStockThreshold,
                        description: itemData.description,
                        ...tenantQuery(req)
                    });

                    // Log transaction
                    await Transaction.create({
                        item: item._id,
                        type: 'inward',
                        quantity: itemData.quantity,
                        previousQuantity: 0,
                        newQuantity: item.quantity,
                        reason: 'Bulk Mapping Import',
                        location: itemData.location || item.location,
                        user: req.user._id,
                        ...tenantQuery(req)
                    });

                    results.success.push({ name: item.name, sku: item.sku });
                }
            } catch (error) {
                results.failed.push({ name: row[mapping.name] || 'Unknown', error: error.message });
            }
        }

        res.json({
            message: 'Bulk import completed',
            totalProcessed: rawData.length,
            successCount: results.success.length,
            updatedCount: results.updated.length,
            failedCount: results.failed.length,
            results
        });

    } catch (error) {
        next(error);
    }
};
