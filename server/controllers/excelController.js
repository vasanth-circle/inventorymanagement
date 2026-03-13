import xlsx from 'xlsx';
import Item from '../models/Item.js';
import Category from '../models/Category.js';
import Transaction from '../models/Transaction.js';
import Location from '../models/Location.js';

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
        const { items } = req.body;

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
                const category = await Category.findOne({ name: { $regex: new RegExp(`^${itemData.category}$`, 'i') } });

                if (category) {
                    categoryId = category._id;
                } else {
                    // Create category if it doesn't exist
                    const newCategory = await Category.create({ name: itemData.category });
                    categoryId = newCategory._id;
                }

                // Check if item exists by SKU or Name
                let item = await Item.findOne({
                    $or: [
                        { sku: itemData.sku },
                        { name: itemData.name }
                    ]
                });

                if (item) {
                    // Item exists - update quantity
                    const previousQuantity = item.quantity;
                    item.quantity += itemData.quantity;
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
                        minStockThreshold: itemData.minStockLevel || 10,
                        customFields: itemData.customFields || {},
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
        // Fetch all unique custom field keys across all items
        const allItems = await Item.find({}, 'customFields');
        const customFieldKeys = new Set();
        allItems.forEach(item => {
            if (item.customFields) {
                Object.keys(item.customFields).forEach(key => customFieldKeys.add(key));
            }
        });

        // Fetch all managed locations
        const locations = await Location.find({ isActive: true });
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
