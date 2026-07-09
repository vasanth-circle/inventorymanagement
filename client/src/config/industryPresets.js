/**
 * Industry Master Configuration
 * This file defines the behavior, fields, and rules for different industries.
 * The application dynamically reconfigures itself based on these presets.
 */

export const INDUSTRY_PRESETS = {
    generic: {
        name: "General Business",
        description: "Standard inventory and billing for any retail or wholesale business.",
        productFields: [],
        billing: {
            quantityBasis: 'units',
            secondaryUnit: 'none',
            rateBasis: 'per_unit',
            labels: { quantity: 'Qty', secondary: '', rate: 'Rate' }
        },
        terminology: {
            items: 'Items',
            customers: 'Customers',
            inward: 'Stock Inward'
        },
        dashboard: ['sales_overview', 'stock_status']
    },
    tiles: {
        name: "Tiles & Sanitary Ware",
        description: "Specialized for SqFt calculations, Box packing, and Shade tracking.",
        productFields: [
            { name: 'size', label: 'Tile Size (Dimensions)', type: 'text', placeholder: 'e.g. 600x600 or 12x18' },
            { name: 'pcsPerBox', label: 'Pcs per Box', type: 'number', default: 1 },
            { name: 'sqFtPerPc', label: 'SqFt per Piece', type: 'number', required: false, precision: 3 },
            { name: 'shadeNumber', label: 'Shade / Batch No', type: 'text' },
            { name: 'finish', label: 'Finish (Glossy/Matte)', type: 'select', options: ['Glossy', 'Matte', 'Satin', 'Sugar', 'Rustic'] }
        ],
        billing: {
            quantityBasis: 'sqft',
            secondaryUnit: 'boxes',
            rateBasis: 'per_sqft',
            labels: { quantity: 'SqFt', secondary: 'Box', rate: 'Rate (SqFt)' },
            calculationEngine: 'tiles_box_sqft'
        },
        terminology: {
            items: 'Tiles & Items',
            inward: 'Stock Inward',
            outward: 'Dispatch',
            customers: 'Clients',
            vendors: 'Suppliers'
        },
        dashboard: ['sqft_sales', 'shade_stock', 'lorry_dispatch']
    },
    electronics: {
        name: "Electronics & Appliances",
        description: "Focus on Serial Numbers, IMEI tracking, and Warranty management.",
        productFields: [
            { name: 'brand', label: 'Brand', type: 'text' },
            { name: 'modelNumber', label: 'Model Number', type: 'text' },
            { name: 'serialNumber', label: 'Serial / IMEI', type: 'text', isUnique: true },
            { name: 'warrantyMonths', label: 'Warranty (Months)', type: 'number' },
            { name: 'specifications', label: 'Tech Specs', type: 'textarea' }
        ],
        billing: {
            quantityBasis: 'pieces',
            secondaryUnit: 'none',
            rateBasis: 'per_piece',
            labels: { quantity: 'Qty', secondary: '', rate: 'Rate' }
        },
        terminology: {
            items: 'Products',
            customers: 'Customers',
            inward: 'Serial Inward'
        },
        dashboard: ['warranty_expiry', 'brand_sales', 'service_requests']
    },
    retail: {
        name: "Fancy Store / Garments",
        description: "Optimized for Barcode POS, Size-Color variants, and Brand tracking.",
        productFields: [
            { name: 'brand', label: 'Brand', type: 'text' },
            { name: 'size', label: 'Size (S/M/L/XL)', type: 'text' },
            { name: 'color', label: 'Color', type: 'text' },
            { name: 'material', label: 'Material', type: 'text' },
            { name: 'gender', label: 'Gender', type: 'select', options: ['Mens', 'Womens', 'Kids', 'Unisex'] }
        ],
        billing: {
            quantityBasis: 'pieces',
            secondaryUnit: 'boxes',
            rateBasis: 'per_piece',
            labels: { quantity: 'Qty', secondary: 'Packing', rate: 'Rate' }
        },
        terminology: {
            items: 'Inventory',
            customers: 'Retail Customers',
            inward: 'Stock Receipt'
        },
        dashboard: ['fast_moving_items', 'variant_stock', 'seasonal_trends']
    },
    medical: {
        name: "Medical Store / Pharmacy",
        description: "Strict Batch management, Expiry tracking, and Schedule H support.",
        productFields: [
            { name: 'composition', label: 'Composition / Salt', type: 'text' },
            { name: 'batchNumber', label: 'Batch No', type: 'text', required: true },
            { name: 'expiryDate', label: 'Expiry Date', type: 'date', required: true },
            { name: 'manufacturer', label: 'Manufacturer', type: 'text' },
            { name: 'schedule', label: 'Drug Schedule', type: 'select', options: ['H', 'H1', 'G', 'X', 'None'] }
        ],
        billing: {
            quantityBasis: 'strips',
            secondaryUnit: 'pieces',
            rateBasis: 'per_strip',
            labels: { quantity: 'Strips', secondary: 'Pcs', rate: 'Rate' }
        },
        terminology: {
            items: 'Medicines',
            customers: 'Patients',
            inward: 'Batch Entry'
        },
        dashboard: ['expiry_alerts', 'batch_tracking', 'prescriptions']
    },
    machinery: {
        name: "Machinery & Spare Parts",
        description: "Built for machine dealers, spare parts suppliers, and industrial equipment businesses.",
        productFields: [
            { name: 'machineType', label: 'Machine Type / Category', type: 'text', placeholder: 'e.g. Lathe, CNC, Compressor' },
            { name: 'modelNumber', label: 'Model Number', type: 'text', placeholder: 'e.g. CNC-5000X' },
            { name: 'serialNumber', label: 'Serial Number', type: 'text', placeholder: 'Unique serial / chassis no', isUnique: true },
            { name: 'manufacturer', label: 'Make / Manufacturer', type: 'text', placeholder: 'e.g. Kirloskar, Atlas Copco' },
            { name: 'horsePower', label: 'Horse Power / KW', type: 'text', placeholder: 'e.g. 5 HP or 3.7 KW' },
            { name: 'capacity', label: 'Capacity / Specification', type: 'text', placeholder: 'e.g. 500 kg/hr, 200 PSI' },
            { name: 'sparePartNo', label: 'Spare Part Number', type: 'text', placeholder: 'OEM Part No' },
            { name: 'condition', label: 'Condition', type: 'select', options: ['New', 'Refurbished', 'Used - Good', 'Used - Fair', 'For Parts'] }
        ],
        billing: {
            quantityBasis: 'pieces',
            secondaryUnit: 'none',
            rateBasis: 'per_piece',
            labels: { quantity: 'Qty / Pcs', secondary: '', rate: 'Unit Rate' }
        },
        terminology: {
            items: 'Machines & Parts',
            customers: 'Clients',
            vendors: 'Suppliers',
            inward: 'Parts Receipt',
            outward: 'Delivery / Dispatch',
            salesOrder: 'Work Order / Sale',
            purchaseOrder: 'Parts Purchase Order'
        },
        dashboard: ['machine_parts_stock', 'low_parts_alert', 'parts_movement']
    }
};

export const getIndustryPreset = (industryId) => {
    return INDUSTRY_PRESETS[industryId] || INDUSTRY_PRESETS.generic;
};
