/**
 * Industry Master Configuration
 * Defines specialized behaviors, product fields, calculation engines, units, and terminology
 * for multiple industries (Tiles, Electricals & Hardware, Medical/Pharmacy, Supermarket/Grocery, Machinery, Retail).
 */

export const INDUSTRY_PRESETS = {
    generic: {
        id: 'generic',
        name: "General Business",
        icon: "📦",
        description: "Standard inventory and billing suitable for any general trading, wholesale, or distribution business.",
        productFields: [],
        billing: {
            quantityBasis: 'units',
            secondaryUnit: 'none',
            rateBasis: 'per_unit',
            labels: { quantity: 'Qty', secondary: '', rate: 'Rate' },
            calculationEngine: 'standard_qty_price'
        },
        terminology: {
            items: 'Items & Products',
            customers: 'Customers',
            vendors: 'Suppliers',
            inward: 'Stock Inward',
            outward: 'Dispatch',
            salesOrder: 'Sales Orders',
            purchaseOrder: 'Purchase Orders'
        },
        dashboard: ['sales_overview', 'stock_status']
    },

    tiles: {
        id: 'tiles',
        name: "Tiles & Sanitary Ware",
        icon: "🧱",
        description: "Specialized for SqFt calculations, Box packing, Managed Tile Sizes, Finishes, and Shade tracking.",
        productFields: [
            { name: 'size', label: 'Tile Size (Dimensions)', type: 'text', placeholder: 'e.g. 600x600, 12x18, 2x2' },
            { name: 'pcsPerBox', label: 'Pcs per Box', type: 'number', default: 1 },
            { name: 'sqFtPerPc', label: 'SqFt per Piece', type: 'number', required: false, precision: 3 },
            { name: 'shadeNumber', label: 'Shade / Batch No', type: 'text', placeholder: 'e.g. S-102, LOT-A' },
            { name: 'finish', label: 'Finish', type: 'select', options: ['Glossy', 'Matte', 'Satin', 'Sugar', 'Rustic', 'High Gloss', 'Carving'] }
        ],
        billing: {
            quantityBasis: 'sqft',
            secondaryUnit: 'boxes',
            rateBasis: 'per_sqft',
            labels: { quantity: 'SqFt', secondary: 'Box', rate: 'Rate (SqFt)' },
            calculationEngine: 'tiles_box_sqft'
        },
        terminology: {
            items: 'Tiles & Sanitary',
            customers: 'Clients',
            vendors: 'Suppliers',
            inward: 'Tile Inward',
            outward: 'Lorry Dispatch',
            salesOrder: 'Sales Orders',
            purchaseOrder: 'Purchase Orders'
        },
        dashboard: ['sqft_sales', 'shade_stock', 'lorry_dispatch']
    },

    electrical_hardware: {
        id: 'electrical_hardware',
        name: "Electricals & Hardware",
        icon: "🔌",
        description: "Specialized for wire coils, cut meters, electrical specifications, hardware fittings, fasteners, and warranties.",
        productFields: [
            { name: 'wireGauge', label: 'Gauge / Spec / Size', type: 'text', placeholder: 'e.g. 1.5 sq mm, 2.5 sq mm, 14 AWG, 1/2" Pipe' },
            { name: 'voltageRating', label: 'Voltage / Power Rating', type: 'text', placeholder: 'e.g. 240V 16A, 415V 3-Phase, 40W' },
            { name: 'material', label: 'Material / Grade', type: 'select', options: ['Copper', 'Aluminum', 'Brass', 'Stainless Steel (SS)', 'Mild Steel (MS)', 'PVC / Conduit', 'CPVC / UPVC', 'GI / Galvanized'] },
            { name: 'rollLengthMeters', label: 'Coil / Roll Length (Meters)', type: 'number', placeholder: 'e.g. 90m roll, 180m coil, 3m pipe' },
            { name: 'packQuantity', label: 'Pcs per Box / Packet', type: 'number', placeholder: 'e.g. 100 pcs/packet for screws' },
            { name: 'warrantyMonths', label: 'Warranty (Months)', type: 'number', placeholder: 'e.g. 12, 24, 60' },
            { name: 'brand', label: 'Brand / Manufacturer', type: 'text', placeholder: 'e.g. Havells, Polycab, Finolex, Philips, Schneider' }
        ],
        billing: {
            quantityBasis: 'coils',
            secondaryUnit: 'meters',
            rateBasis: 'per_coil',
            labels: { quantity: 'Coils / Pcs', secondary: 'Meters', rate: 'Rate' },
            calculationEngine: 'hardware_coil_meter'
        },
        terminology: {
            items: 'Electrical & Hardware',
            customers: 'Contractors / Clients',
            vendors: 'Manufacturers / Dealers',
            inward: 'Material Inward',
            outward: 'Dispatch / Delivery',
            salesOrder: 'Sales Estimates & Orders',
            purchaseOrder: 'Procurement PO'
        },
        dashboard: ['coil_meter_stock', 'fasteners_stock', 'brand_movement']
    },

    medical: {
        id: 'medical',
        name: "Pharmacy & Medical Store",
        icon: "💊",
        description: "Strict Batch & Lot tracking, Expiry date monitoring, Salt/Composition, Drug Schedules, and Strip/Box conversions.",
        productFields: [
            { name: 'composition', label: 'Salt / Composition', type: 'text', placeholder: 'e.g. Paracetamol 500mg, Amoxicillin 250mg' },
            { name: 'batchNumber', label: 'Batch / Lot Number', type: 'text', required: true, placeholder: 'e.g. BATCH-9921' },
            { name: 'expiryDate', label: 'Expiry Date', type: 'date', required: true },
            { name: 'mfgDate', label: 'Mfg Date', type: 'date' },
            { name: 'manufacturer', label: 'Pharma Company', type: 'text', placeholder: 'e.g. Cipla, Sun Pharma, Abbott, Mankind' },
            { name: 'schedule', label: 'Drug Schedule', type: 'select', options: ['OTC (General)', 'Schedule H', 'Schedule H1', 'Schedule X', 'Schedule G', 'Prescription Only'] },
            { name: 'tabletsPerStrip', label: 'Tablets per Strip', type: 'number', default: 10, placeholder: 'e.g. 10 or 15' },
            { name: 'stripsPerBox', label: 'Strips per Box', type: 'number', default: 10, placeholder: 'e.g. 10 or 20' },
            { name: 'rackShelf', label: 'Rack / Shelf Location', type: 'text', placeholder: 'e.g. Rack A-3, Shelf 2' }
        ],
        billing: {
            quantityBasis: 'strips',
            secondaryUnit: 'boxes',
            rateBasis: 'per_strip',
            labels: { quantity: 'Strips', secondary: 'Boxes', rate: 'Rate / Strip' },
            calculationEngine: 'medical_batch_expiry'
        },
        terminology: {
            items: 'Medicines & Pharma',
            customers: 'Patients / Clients',
            vendors: 'Pharma Distributors',
            inward: 'Batch Inward',
            outward: 'Dispensing / Sale',
            salesOrder: 'Prescriptions / Billing',
            purchaseOrder: 'Pharma Purchase Order'
        },
        dashboard: ['expiry_alerts', 'batch_tracking', 'schedule_h_logs']
    },

    supermarket: {
        id: 'supermarket',
        name: "Supermarket & Grocery / FMCG",
        icon: "🛒",
        description: "Fast POS Barcode scanning, MRP discounts, Weight & Volume measures, Pack sizes, and Expiry tracking.",
        productFields: [
            { name: 'barcode', label: 'Barcode / EAN-13', type: 'text', placeholder: 'Scan or enter barcode' },
            { name: 'mrp', label: 'MRP (Max Retail Price)', type: 'number', placeholder: 'e.g. 100.00' },
            { name: 'netWeight', label: 'Net Weight / Volume', type: 'text', placeholder: 'e.g. 500g, 1kg, 250ml, 1L' },
            { name: 'casePack', label: 'Units per Case / Carton', type: 'number', placeholder: 'e.g. 24 cans/case' },
            { name: 'expiryDate', label: 'Best Before / Expiry', type: 'date' },
            { name: 'isPerishable', label: 'Perishable Good?', type: 'select', options: ['No', 'Yes (Refrigerated)', 'Yes (Fresh Daily)'] },
            { name: 'aisleNumber', label: 'Aisle / Shelf / Bay', type: 'text', placeholder: 'e.g. Aisle 3 - Dairy' },
            { name: 'brand', label: 'FMCG Brand', type: 'text', placeholder: 'e.g. Nestlé, Unilever, Britannia, Amul' }
        ],
        billing: {
            quantityBasis: 'pieces',
            secondaryUnit: 'cartons',
            rateBasis: 'per_piece',
            labels: { quantity: 'Qty', secondary: 'Case/Pack', rate: 'Sale Price' },
            calculationEngine: 'supermarket_mrp_pos'
        },
        terminology: {
            items: 'Products & Groceries',
            customers: 'Shoppers / Customers',
            vendors: 'FMCG Distributors',
            inward: 'GRN / Inward Receipt',
            outward: 'POS Checkout / Dispatch',
            salesOrder: 'Counter POS / Orders',
            purchaseOrder: 'Replenishment PO'
        },
        dashboard: ['fast_moving_items', 'mrp_margin_report', 'perishable_alerts']
    },

    machinery: {
        id: 'machinery',
        name: "Machinery & Spare Parts",
        icon: "⚙️",
        description: "Built for industrial machinery, spare parts, serial tracking, equipment specs, and maintenance support.",
        productFields: [
            { name: 'machineType', label: 'Machine Type / Group', type: 'text', placeholder: 'e.g. Lathe, CNC, Compressor, Motor' },
            { name: 'modelNumber', label: 'Model Number', type: 'text', placeholder: 'e.g. CNC-5000X' },
            { name: 'serialNumber', label: 'Serial Number / Chassis', type: 'text', placeholder: 'Unique serial no', isUnique: true },
            { name: 'manufacturer', label: 'Make / Manufacturer', type: 'text', placeholder: 'e.g. Kirloskar, Atlas Copco, Siemens' },
            { name: 'horsePower', label: 'Horse Power / KW', type: 'text', placeholder: 'e.g. 5 HP / 3.7 KW' },
            { name: 'capacity', label: 'Capacity / Specifications', type: 'text', placeholder: 'e.g. 500 kg/hr, 200 PSI' },
            { name: 'sparePartNo', label: 'Spare Part OEM Number', type: 'text', placeholder: 'OEM Part No' },
            { name: 'condition', label: 'Condition', type: 'select', options: ['New', 'Refurbished', 'Used - Good', 'Used - Fair', 'For Parts'] }
        ],
        billing: {
            quantityBasis: 'pieces',
            secondaryUnit: 'none',
            rateBasis: 'per_piece',
            labels: { quantity: 'Qty / Pcs', secondary: '', rate: 'Unit Rate' },
            calculationEngine: 'standard_qty_price'
        },
        terminology: {
            items: 'Machines & Spare Parts',
            customers: 'Clients',
            vendors: 'Suppliers',
            inward: 'Parts Receipt',
            outward: 'Delivery / Dispatch',
            salesOrder: 'Work Order / Sale',
            purchaseOrder: 'Parts Purchase Order'
        },
        dashboard: ['machine_parts_stock', 'low_parts_alert', 'parts_movement']
    },

    retail: {
        id: 'retail',
        name: "Fancy Store / Apparel & Retail",
        icon: "👕",
        description: "Optimized for fashion, garments, retail stores with size/color variants and barcode POS.",
        productFields: [
            { name: 'brand', label: 'Brand', type: 'text' },
            { name: 'size', label: 'Size (S/M/L/XL/XXL)', type: 'text' },
            { name: 'color', label: 'Color / Shade', type: 'text' },
            { name: 'material', label: 'Fabric / Material', type: 'text' },
            { name: 'gender', label: 'Category', type: 'select', options: ['Mens', 'Womens', 'Kids', 'Unisex', 'General'] }
        ],
        billing: {
            quantityBasis: 'pieces',
            secondaryUnit: 'boxes',
            rateBasis: 'per_piece',
            labels: { quantity: 'Qty', secondary: 'Packing', rate: 'Rate' },
            calculationEngine: 'standard_qty_price'
        },
        terminology: {
            items: 'Inventory',
            customers: 'Retail Customers',
            vendors: 'Suppliers',
            inward: 'Stock Receipt',
            outward: 'POS Sales / Billing',
            salesOrder: 'Retail Sales',
            purchaseOrder: 'Stock Purchase'
        },
        dashboard: ['fast_moving_items', 'variant_stock', 'seasonal_trends']
    },

    electronics: {
        id: 'electronics',
        name: "Electronics & Appliances",
        icon: "⚡",
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
            labels: { quantity: 'Qty', secondary: '', rate: 'Rate' },
            calculationEngine: 'standard_qty_price'
        },
        terminology: {
            items: 'Electronics & Gadgets',
            customers: 'Customers',
            vendors: 'Suppliers',
            inward: 'Serial Inward',
            outward: 'Dispatch',
            salesOrder: 'Sales Orders',
            purchaseOrder: 'Purchase Orders'
        },
        dashboard: ['warranty_expiry', 'brand_sales', 'service_requests']
    }
};

// Aliases for compatibility
INDUSTRY_PRESETS.hardware = INDUSTRY_PRESETS.electrical_hardware;
INDUSTRY_PRESETS.grocery = INDUSTRY_PRESETS.supermarket;
INDUSTRY_PRESETS.fmcg = INDUSTRY_PRESETS.supermarket;
INDUSTRY_PRESETS.machine_shop = INDUSTRY_PRESETS.machinery;

export const getIndustryPreset = (industryId) => {
    return INDUSTRY_PRESETS[industryId] || INDUSTRY_PRESETS.generic;
};
