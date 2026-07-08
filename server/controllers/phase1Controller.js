/**
 * phase1Controller.js
 * ═══════════════════════════════════════════════════════════════════════════
 * Phase 1 — Zoho Inventory Parity Features (All new logic in ONE file)
 *
 * SECTIONS:
 *   1. STOCK RESERVATION
 *   2. CREDIT NOTES
 *   3. GOODS RECEIPT NOTE (GRN)
 *   4. WAREHOUSE TRANSFER
 *   5. LANDED COST ALLOCATION
 *   6. PRODUCT VARIANTS
 * ═══════════════════════════════════════════════════════════════════════════
 */

import Item from '../models/Item.js';
import SalesOrder from '../models/SalesOrder.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import CreditNote from '../models/CreditNote.js';
import GoodsReceiptNote from '../models/GoodsReceiptNote.js';
import WarehouseTransfer from '../models/WarehouseTransfer.js';
import Transaction from '../models/Transaction.js';
import Customer from '../models/Customer.js';
import CustomerLedger from '../models/CustomerLedger.js';
import Vendor from '../models/Vendor.js';
import { sendResponse, sendError } from '../utils/standardResponse.js';
import { tenantQuery } from '../utils/tenantQuery.js';
import { allocateFIFO } from '../utils/stock.js';

// ─── Shared sequence helper (mirrors existing pattern in other controllers) ─
const generateDocNumber = (prefix) => {
    const date = new Date();
    const dateStr = `${date.getFullYear()}${(date.getMonth() + 1).toString().padStart(2, '0')}${date.getDate().toString().padStart(2, '0')}`;
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `${prefix}-${dateStr}-${rand}`;
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 1 — STOCK RESERVATION                                          ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * Reserve stock for all items in a Sales Order.
 * Called after SO is confirmed/saved.
 * @param {string} orderId
 * @param {string} tenantId
 */
export const reserveStockForOrder = async (orderId, tenantId) => {
    try {
        const order = await SalesOrder.findOne({ _id: orderId, tenantId });
        if (!order || order.isEstimation) return;

        for (const lineItem of order.items) {
            const stockQty = lineItem.stockQty || lineItem.quantity || 0;
            if (stockQty <= 0) continue;

            await Item.findOneAndUpdate(
                { _id: lineItem.item, tenantId },
                { $inc: { reservedQuantity: stockQty } },
            );
        }
    } catch (err) {
        console.error('[Phase1] reserveStockForOrder error:', err.message);
    }
};

/**
 * Release reservation when an SO is cancelled/voided.
 * @param {string} orderId
 * @param {string} tenantId
 */
export const releaseReservationForOrder = async (orderId, tenantId) => {
    try {
        const order = await SalesOrder.findOne({ _id: orderId, tenantId });
        if (!order) return;

        for (const lineItem of order.items) {
            const stockQty = lineItem.stockQty || lineItem.quantity || 0;
            if (stockQty <= 0) continue;

            await Item.findOneAndUpdate(
                { _id: lineItem.item, tenantId },
                { $inc: { reservedQuantity: -stockQty } },
            );

            // Clamp to zero — never go negative
            await Item.updateOne(
                { _id: lineItem.item, tenantId, reservedQuantity: { $lt: 0 } },
                { $set: { reservedQuantity: 0 } }
            );
        }
    } catch (err) {
        console.error('[Phase1] releaseReservationForOrder error:', err.message);
    }
};

/**
 * GET /api/phase1/reserved-stock
 * Returns all items with their available vs reserved quantities.
 */
export const getReservedStock = async (req, res, next) => {
    try {
        const items = await Item.find({
            ...tenantQuery(req),
            reservedQuantity: { $gt: 0 }
        }).populate('category', 'name').select('name sku quantity reservedQuantity minStockThreshold location');

        const result = items.map(item => ({
            _id: item._id,
            name: item.name,
            sku: item.sku,
            location: item.location,
            totalQuantity: item.quantity,
            reservedQuantity: item.reservedQuantity,
            availableQuantity: Math.max(0, item.quantity - item.reservedQuantity),
        }));

        sendResponse(res, 200, result);
    } catch (err) {
        next(err);
    }
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 2 — CREDIT NOTES                                               ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * POST /api/credit-notes
 * Create a credit note linked to an SO (optional) and post to customer ledger.
 */
export const createCreditNote = async (req, res, next) => {
    try {
        const { customer, salesOrder, salesOrderNumber, items, reason, notes, taxAmount, issueDate } = req.body;

        if (!customer || !reason || !items?.length) {
            return sendError(res, 400, 'customer, reason, and items are required');
        }

        const creditNoteNumber = generateDocNumber('CN');

        const creditNote = await CreditNote.create({
            creditNoteNumber,
            tenantId: req.tenantId,
            customer,
            salesOrder: salesOrder || null,
            salesOrderNumber: salesOrderNumber || '',
            items,
            reason,
            notes,
            taxAmount: taxAmount || 0,
            issueDate: issueDate || new Date(),
            status: 'issued',
            createdBy: req.user._id,
        });

        // ─── Post credit to customer ledger ─────────────────────────────────
        const customerDoc = await Customer.findById(customer);
        if (customerDoc) {
            const lastEntry = await CustomerLedger.findOne({
                customer, tenantId: req.tenantId
            }).sort({ date: -1, createdAt: -1 });

            const previousBalance = lastEntry ? lastEntry.balance : (customerDoc.openingBalance || 0);
            const newBalance = previousBalance - creditNote.totalAmount;

            await CustomerLedger.create({
                tenantId: req.tenantId,
                customer,
                date: creditNote.issueDate,
                type: 'credit_note',
                refType: 'CreditNote',
                refId: creditNote._id,
                refNumber: creditNoteNumber,
                description: `Credit Note #${creditNoteNumber}${reason ? ` - ${reason}` : ''}`,
                debit: 0,
                credit: creditNote.totalAmount,
                balance: newBalance,
                createdBy: req.user._id,
            });

            await Customer.findByIdAndUpdate(customer, { currentBalance: newBalance });
        }

        await CreditNote.findByIdAndUpdate(creditNote._id, { ledgerPosted: true });

        const populated = await CreditNote.findById(creditNote._id)
            .populate('customer', 'name companyName phone')
            .populate('salesOrder', 'orderNumber')
            .populate('items.item', 'name sku');

        sendResponse(res, 201, populated, `Credit Note ${creditNoteNumber} created and posted to ledger`);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/credit-notes
 */
export const getCreditNotes = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, customer, status, from, to } = req.query;
        const query = { ...tenantQuery(req) };

        if (customer) query.customer = customer;
        if (status) query.status = status;
        if (from || to) {
            query.issueDate = {};
            if (from) query.issueDate.$gte = new Date(from);
            if (to) { const d = new Date(to); d.setHours(23,59,59,999); query.issueDate.$lte = d; }
        }

        const [creditNotes, total] = await Promise.all([
            CreditNote.find(query)
                .populate('customer', 'name companyName')
                .populate('salesOrder', 'orderNumber')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit)),
            CreditNote.countDocuments(query)
        ]);

        sendResponse(res, 200, { creditNotes, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/credit-notes/:id
 */
export const getCreditNote = async (req, res, next) => {
    try {
        const cn = await CreditNote.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate('customer', 'name companyName phone address gstin')
            .populate('salesOrder', 'orderNumber orderDate')
            .populate('items.item', 'name sku hsn');

        if (!cn) return sendError(res, 404, 'Credit note not found');
        sendResponse(res, 200, cn);
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/credit-notes/:id/void
 * Void a credit note — reverses the ledger credit entry.
 */
export const voidCreditNote = async (req, res, next) => {
    try {
        const cn = await CreditNote.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!cn) return sendError(res, 404, 'Credit note not found');
        if (cn.status === 'void') return sendError(res, 400, 'Credit note is already voided');

        // Reverse the ledger credit entry
        if (cn.ledgerPosted) {
            const customer = await Customer.findById(cn.customer);
            const lastEntry = await CustomerLedger.findOne({ customer: cn.customer, tenantId: req.tenantId }).sort({ date: -1, createdAt: -1 });
            const previousBalance = lastEntry ? lastEntry.balance : (customer?.openingBalance || 0);
            const newBalance = previousBalance + cn.totalAmount;

            await CustomerLedger.create({
                tenantId: req.tenantId,
                customer: cn.customer,
                date: new Date(),
                type: 'adjustment',
                refType: 'CreditNote',
                refId: cn._id,
                refNumber: cn.creditNoteNumber,
                description: `Void of Credit Note #${cn.creditNoteNumber}`,
                debit: cn.totalAmount,
                credit: 0,
                balance: newBalance,
                createdBy: req.user._id,
            });

            await Customer.findByIdAndUpdate(cn.customer, { currentBalance: newBalance });
        }

        cn.status = 'void';
        await cn.save();

        sendResponse(res, 200, cn, 'Credit note voided and ledger reversed');
    } catch (err) {
        next(err);
    }
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 3 — GOODS RECEIPT NOTE (GRN)                                  ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * POST /api/grn
 * Create a GRN against a PO (partial delivery supported).
 */
export const createGRN = async (req, res, next) => {
    try {
        const { purchaseOrder: poId, items, notes, receiptDate, inspectedBy } = req.body;

        if (!poId || !items?.length) return sendError(res, 400, 'purchaseOrder and items are required');

        const po = await PurchaseOrder.findOne({ _id: poId, ...tenantQuery(req) });
        if (!po) return sendError(res, 404, 'Purchase order not found');
        if (po.status === 'void') return sendError(res, 400, 'Cannot create GRN for a void PO');

        // Check we are not receiving more than what was ordered
        const existingGRNs = await GoodsReceiptNote.find({ purchaseOrder: poId, tenantId: req.tenantId, status: 'received' });

        for (const grnItem of items) {
            const poItem = po.items.find(i => i.item.toString() === grnItem.item.toString());
            if (!poItem) return sendError(res, 400, `Item ${grnItem.item} not found in PO`);

            const alreadyReceived = existingGRNs.reduce((sum, g) => {
                const match = g.items.find(gi => gi.item.toString() === grnItem.item.toString());
                return sum + (match ? match.receivedQuantity : 0);
            }, 0);

            const maxReceivable = (poItem.boxCount || poItem.quantity) - alreadyReceived;
            if (grnItem.receivedQuantity > maxReceivable) {
                return sendError(res, 400, `Cannot receive ${grnItem.receivedQuantity} units for item — only ${maxReceivable} remaining on PO`);
            }
        }

        const grnNumber = generateDocNumber('GRN');

        const grn = await GoodsReceiptNote.create({
            grnNumber,
            tenantId: req.tenantId,
            purchaseOrder: poId,
            purchaseOrderNumber: po.orderNumber,
            vendor: po.vendor,
            items: items.map(i => ({
                ...i,
                orderedQuantity: po.items.find(p => p.item.toString() === i.item.toString())?.boxCount ||
                                 po.items.find(p => p.item.toString() === i.item.toString())?.quantity || 0,
            })),
            notes,
            receiptDate: receiptDate || new Date(),
            inspectedBy: inspectedBy || req.user._id,
            status: 'draft',
            createdBy: req.user._id,
        });

        sendResponse(res, 201, grn, `GRN ${grnNumber} created. Click "Receive" to update stock.`);
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/grn
 */
export const getGRNs = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status, vendor } = req.query;
        const query = { ...tenantQuery(req) };
        if (status) query.status = status;
        if (vendor) query.vendor = vendor;

        const [grns, total] = await Promise.all([
            GoodsReceiptNote.find(query)
                .populate('purchaseOrder', 'orderNumber')
                .populate('vendor', 'name')
                .populate('items.item', 'name sku')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit)),
            GoodsReceiptNote.countDocuments(query)
        ]);

        sendResponse(res, 200, { grns, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/grn/po/:poId
 */
export const getGRNsByPO = async (req, res, next) => {
    try {
        const grns = await GoodsReceiptNote.find({ purchaseOrder: req.params.poId, ...tenantQuery(req) })
            .populate('items.item', 'name sku')
            .populate('createdBy', 'name')
            .sort({ createdAt: -1 });

        sendResponse(res, 200, grns);
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/grn/:id/receive
 * Mark GRN as received — triggers stock inward for accepted quantities.
 */
export const receiveGRN = async (req, res, next) => {
    try {
        const grn = await GoodsReceiptNote.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!grn) return sendError(res, 404, 'GRN not found');
        if (grn.status === 'received') return sendError(res, 400, 'GRN already received');
        if (grn.status === 'cancelled') return sendError(res, 400, 'GRN is cancelled');
        if (grn.stockUpdated) return sendError(res, 400, 'Stock already updated for this GRN');

        // ─── Update item stock for each accepted line ─────────────────────
        for (const grnItem of grn.items) {
            const accepted = grnItem.acceptedQuantity || 0;
            const damaged = grnItem.damagedQuantity || 0;
            if (accepted <= 0 && damaged <= 0) continue;

            const itemDoc = await Item.findOne({ _id: grnItem.item, ...tenantQuery(req) });
            if (!itemDoc) continue;

            const previousQuantity = itemDoc.quantity;

            // If batch number provided, add to item's batches array
            if (grnItem.batchNumber && itemDoc.isBatchTracked) {
                const existingBatch = itemDoc.batches.find(b => b.batchNumber === grnItem.batchNumber);
                if (existingBatch) {
                    existingBatch.quantity += accepted;
                } else {
                    itemDoc.batches.push({
                        batchNumber: grnItem.batchNumber,
                        expiryDate: grnItem.expiryDate,
                        quantity: accepted,
                        binLocation: grnItem.binLocation,
                        costPrice: grnItem.price || itemDoc.purchasePrice,
                        receivedDate: grn.receiptDate,
                    });
                }
            }

            itemDoc.quantity += accepted;
            itemDoc.damagedQuantity = (itemDoc.damagedQuantity || 0) + damaged;
            await itemDoc.save();

            // ─── Create inward transaction ─────────────────────────────────
            await Transaction.create({
                item: grnItem.item,
                type: 'inward',
                quantity: accepted,
                damagedQuantity: damaged,
                rate: grnItem.price || 0,
                reason: `GRN ${grn.grnNumber} - PO ${grn.purchaseOrderNumber}`,
                notes: grn.notes,
                user: req.user._id,
                previousQuantity,
                newQuantity: itemDoc.quantity,
                batchNumber: grnItem.batchNumber || null,
                vendor: grn.vendor,
                tenantId: req.tenantId,
            });
        }

        // ─── Mark GRN as received ─────────────────────────────────────────
        grn.status = 'received';
        grn.stockUpdated = true;
        await grn.save();

        // ─── Update PO receivedStatus ──────────────────────────────────────
        const po = await PurchaseOrder.findById(grn.purchaseOrder);
        if (po) {
            if (!po.grnIds) po.grnIds = [];
            po.grnIds.push(grn._id);

            // Calculate total received qty across all GRNs
            const allGRNs = await GoodsReceiptNote.find({ purchaseOrder: po._id, status: 'received', tenantId: req.tenantId });
            const fullyReceived = po.items.every(poItem => {
                const totalReceived = allGRNs.reduce((sum, g) => {
                    const match = g.items.find(gi => gi.item.toString() === poItem.item.toString());
                    return sum + (match ? match.acceptedQuantity : 0);
                }, 0);
                const ordered = poItem.boxCount || poItem.quantity;
                return totalReceived >= ordered;
            });

            po.receivedStatus = fullyReceived ? 'fully_received' : 'partially_received';
            if (fullyReceived) po.status = 'received';
            await po.save();
        }

        sendResponse(res, 200, grn, 'GRN received — stock updated successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/grn/:id/cancel
 */
export const cancelGRN = async (req, res, next) => {
    try {
        const grn = await GoodsReceiptNote.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!grn) return sendError(res, 404, 'GRN not found');
        if (grn.stockUpdated) return sendError(res, 400, 'Cannot cancel GRN — stock has already been updated. Create a return instead.');

        grn.status = 'cancelled';
        await grn.save();
        sendResponse(res, 200, grn, 'GRN cancelled');
    } catch (err) {
        next(err);
    }
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 4 — WAREHOUSE TRANSFER                                         ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * POST /api/warehouse-transfers
 */
export const createWarehouseTransfer = async (req, res, next) => {
    try {
        const { fromLocation, toLocation, items, reason, notes, expectedReceiptDate } = req.body;

        if (!fromLocation?.id || !toLocation?.id) return sendError(res, 400, 'fromLocation and toLocation are required');
        if (!items?.length) return sendError(res, 400, 'At least one item is required');
        if (fromLocation.id === toLocation.id) return sendError(res, 400, 'Source and destination cannot be the same');

        // Validate stock availability
        for (const transferItem of items) {
            const itemDoc = await Item.findOne({ _id: transferItem.item, ...tenantQuery(req) });
            if (!itemDoc) return sendError(res, 404, `Item ${transferItem.item} not found`);

            const available = itemDoc.quantity - (itemDoc.reservedQuantity || 0);
            if (transferItem.quantity > available) {
                return sendError(res, 400,
                    `Insufficient available stock for ${itemDoc.name}. Available: ${available}, Requested: ${transferItem.quantity}`
                );
            }
        }

        const transferNumber = generateDocNumber('WHT');

        const transfer = await WarehouseTransfer.create({
            transferNumber,
            tenantId: req.tenantId,
            fromLocation,
            toLocation,
            items,
            reason,
            notes,
            expectedReceiptDate,
            status: 'draft',
            createdBy: req.user._id,
        });

        sendResponse(res, 201, transfer, `Warehouse Transfer ${transferNumber} created`);
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/warehouse-transfers/:id/dispatch
 * Mark transfer as in-transit — deducts stock from source location.
 */
export const dispatchWarehouseTransfer = async (req, res, next) => {
    try {
        const transfer = await WarehouseTransfer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!transfer) return sendError(res, 404, 'Transfer not found');
        if (transfer.status !== 'draft') return sendError(res, 400, `Transfer is already ${transfer.status}`);

        for (const transferItem of transfer.items) {
            const itemDoc = await Item.findOne({ _id: transferItem.item, ...tenantQuery(req) });
            if (!itemDoc) continue;

            const available = itemDoc.quantity - (itemDoc.reservedQuantity || 0);
            if (transferItem.quantity > available) {
                return sendError(res, 400, `Insufficient stock for ${itemDoc.name}`);
            }

            const allocations = allocateFIFO(itemDoc, transferItem.quantity);
            transferItem.batchAllocations = allocations;

            const previousQuantity = itemDoc.quantity;
            itemDoc.quantity -= transferItem.quantity;
            await itemDoc.save();

            // Outward transaction from source
            await Transaction.create({
                item: transferItem.item,
                type: 'transfer',
                quantity: transferItem.quantity,
                reason: `Transfer ${transfer.transferNumber} → ${transfer.toLocation.name}`,
                notes: transfer.notes,
                user: req.user._id,
                previousQuantity,
                newQuantity: itemDoc.quantity,
                fromLocation: transfer.fromLocation.name,
                toLocation: transfer.toLocation.name,
                tenantId: req.tenantId,
            });
        }

        transfer.status = 'in_transit';
        transfer.transferDate = new Date();
        await transfer.save();

        sendResponse(res, 200, transfer, 'Transfer dispatched — stock deducted from source');
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/warehouse-transfers/:id/receive
 * Receive the transfer — adds stock to destination location.
 */
export const receiveWarehouseTransfer = async (req, res, next) => {
    try {
        const transfer = await WarehouseTransfer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!transfer) return sendError(res, 404, 'Transfer not found');
        if (transfer.status !== 'in_transit') return sendError(res, 400, 'Transfer must be in_transit to receive');

        for (const transferItem of transfer.items) {
            const itemDoc = await Item.findOne({ _id: transferItem.item, ...tenantQuery(req) });
            if (!itemDoc) continue;

            // Re-add batches if batch-tracked
            if (itemDoc.isBatchTracked && transferItem.batchAllocations?.length) {
                for (const alloc of transferItem.batchAllocations) {
                    const existingBatch = itemDoc.batches.find(b => b._id?.toString() === alloc.batchId?.toString());
                    if (existingBatch) {
                        existingBatch.quantity += alloc.quantity;
                        existingBatch.binLocation = transfer.toLocation.name;
                    } else {
                        itemDoc.batches.push({
                            batchNumber: alloc.batchNumber || 'TRANSFER',
                            quantity: alloc.quantity,
                            binLocation: transfer.toLocation.name,
                            costPrice: alloc.purchasePrice || itemDoc.purchasePrice,
                        });
                    }
                }
            }

            const previousQuantity = itemDoc.quantity;
            itemDoc.quantity += transferItem.quantity;
            itemDoc.location = transfer.toLocation.name;
            await itemDoc.save();

            // Inward transaction to destination
            await Transaction.create({
                item: transferItem.item,
                type: 'transfer',
                quantity: transferItem.quantity,
                reason: `Received Transfer ${transfer.transferNumber} from ${transfer.fromLocation.name}`,
                user: req.user._id,
                previousQuantity,
                newQuantity: itemDoc.quantity,
                fromLocation: transfer.fromLocation.name,
                toLocation: transfer.toLocation.name,
                tenantId: req.tenantId,
            });
        }

        transfer.status = 'received';
        transfer.receivedDate = new Date();
        transfer.receivedBy = req.user._id;
        await transfer.save();

        sendResponse(res, 200, transfer, 'Transfer received — stock added to destination');
    } catch (err) {
        next(err);
    }
};

/**
 * PUT /api/warehouse-transfers/:id/cancel
 */
export const cancelWarehouseTransfer = async (req, res, next) => {
    try {
        const transfer = await WarehouseTransfer.findOne({ _id: req.params.id, ...tenantQuery(req) });
        if (!transfer) return sendError(res, 404, 'Transfer not found');
        if (transfer.status === 'received') return sendError(res, 400, 'Cannot cancel a completed transfer');
        if (transfer.status === 'cancelled') return sendError(res, 400, 'Already cancelled');

        // If in_transit, restore stock to source
        if (transfer.status === 'in_transit') {
            for (const transferItem of transfer.items) {
                await Item.findOneAndUpdate(
                    { _id: transferItem.item, ...tenantQuery(req) },
                    { $inc: { quantity: transferItem.quantity } }
                );
            }
        }

        transfer.status = 'cancelled';
        await transfer.save();

        sendResponse(res, 200, transfer, 'Transfer cancelled');
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/warehouse-transfers
 */
export const getWarehouseTransfers = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, status } = req.query;
        const query = { ...tenantQuery(req) };
        if (status) query.status = status;

        const [transfers, total] = await Promise.all([
            WarehouseTransfer.find(query)
                .populate('items.item', 'name sku')
                .populate('createdBy', 'name')
                .sort({ createdAt: -1 })
                .skip((page - 1) * limit)
                .limit(Number(limit)),
            WarehouseTransfer.countDocuments(query)
        ]);

        sendResponse(res, 200, { transfers, total, page: Number(page), totalPages: Math.ceil(total / limit) });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/warehouse-transfers/:id
 */
export const getWarehouseTransfer = async (req, res, next) => {
    try {
        const transfer = await WarehouseTransfer.findOne({ _id: req.params.id, ...tenantQuery(req) })
            .populate('items.item', 'name sku unitType')
            .populate('createdBy', 'name')
            .populate('receivedBy', 'name');

        if (!transfer) return sendError(res, 404, 'Transfer not found');
        sendResponse(res, 200, transfer);
    } catch (err) {
        next(err);
    }
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 5 — LANDED COST ALLOCATION                                     ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * PUT /api/grn/po/:poId/landed-costs
 * Add or update landed costs on a Purchase Order, with proportional allocation.
 */
export const addLandedCostToPO = async (req, res, next) => {
    try {
        const { landedCosts } = req.body; // array of { type, description, amount, allocationMethod }

        if (!landedCosts?.length) return sendError(res, 400, 'landedCosts array is required');

        const po = await PurchaseOrder.findOne({ _id: req.params.poId, ...tenantQuery(req) });
        if (!po) return sendError(res, 404, 'Purchase order not found');

        po.landedCosts = landedCosts;
        await po.save();

        // ─── Compute effective per-item cost ─────────────────────────────────
        const totalLandedAmount = landedCosts.reduce((sum, lc) => sum + (lc.amount || 0), 0);
        const breakdown = [];

        for (const poItem of po.items) {
            let allocatedCost = 0;

            for (const lc of landedCosts) {
                if (lc.allocationMethod === 'quantity') {
                    // Divide by total items count
                    allocatedCost += (lc.amount || 0) / po.items.length;
                } else {
                    // Default: proportional by item value
                    const itemValue = poItem.total || (poItem.quantity * poItem.price);
                    const proportion = itemValue / (po.itemsTotal || 1);
                    allocatedCost += (lc.amount || 0) * proportion;
                }
            }

            const basePrice = poItem.price;
            const baseQty = poItem.boxCount || poItem.quantity;
            const effectivePricePerUnit = basePrice + (baseQty > 0 ? allocatedCost / baseQty : 0);

            breakdown.push({
                item: poItem.item,
                name: poItem.name,
                basePrice,
                allocatedLandedCost: Math.round(allocatedCost * 100) / 100,
                effectivePricePerUnit: Math.round(effectivePricePerUnit * 100) / 100,
            });
        }

        sendResponse(res, 200, { po, breakdown, totalLandedAmount }, 'Landed costs saved');
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/purchase-orders/:poId/landed-cost-breakdown
 */
export const getLandedCostBreakdown = async (req, res, next) => {
    try {
        const po = await PurchaseOrder.findOne({ _id: req.params.poId, ...tenantQuery(req) })
            .populate('items.item', 'name sku');
        if (!po) return sendError(res, 404, 'PO not found');

        const totalLanded = (po.landedCosts || []).reduce((s, lc) => s + (lc.amount || 0), 0);

        const breakdown = po.items.map(poItem => {
            let allocatedCost = 0;
            for (const lc of po.landedCosts || []) {
                if (lc.allocationMethod === 'quantity') {
                    allocatedCost += (lc.amount || 0) / po.items.length;
                } else {
                    const itemValue = poItem.total || (poItem.quantity * poItem.price);
                    const proportion = itemValue / (po.itemsTotal || 1);
                    allocatedCost += (lc.amount || 0) * proportion;
                }
            }
            const baseQty = poItem.boxCount || poItem.quantity;
            return {
                item: poItem.item,
                name: poItem.name,
                basePrice: poItem.price,
                allocatedLandedCost: Math.round(allocatedCost * 100) / 100,
                effectivePricePerUnit: Math.round((poItem.price + (baseQty > 0 ? allocatedCost / baseQty : 0)) * 100) / 100,
            };
        });

        sendResponse(res, 200, { landedCosts: po.landedCosts || [], breakdown, totalLanded });
    } catch (err) {
        next(err);
    }
};

// ╔═══════════════════════════════════════════════════════════════════════════╗
// ║  SECTION 6 — PRODUCT VARIANTS                                           ║
// ╚═══════════════════════════════════════════════════════════════════════════╝

/**
 * POST /api/items/:parentId/variants
 * Create a variant child item under a parent item.
 */
export const createVariant = async (req, res, next) => {
    try {
        const parentItem = await Item.findOne({ _id: req.params.parentId, ...tenantQuery(req) });
        if (!parentItem) return sendError(res, 404, 'Parent item not found');

        const { variantAttributes, name, sku, barcode, price, purchasePrice, quantity } = req.body;
        if (!variantAttributes || Object.keys(variantAttributes).length === 0) {
            return sendError(res, 400, 'variantAttributes is required (e.g. { size: "60x60", finish: "Matt" })');
        }

        // Inherit parent fields unless overridden
        const variantData = {
            name: name || `${parentItem.name} - ${Object.values(variantAttributes).join(' ')}`,
            tenantId: req.tenantId,
            category: parentItem.category,
            parentItem: parentItem._id,
            variantAttributes,
            sku: sku || '',
            barcode: barcode || '',
            price: price !== undefined ? price : parentItem.price,
            purchasePrice: purchasePrice !== undefined ? purchasePrice : parentItem.purchasePrice,
            quantity: quantity || 0,
            unitType: parentItem.unitType,
            pcsPerBox: parentItem.pcsPerBox,
            sqFtPerPc: parentItem.sqFtPerPc,
            isBatchTracked: parentItem.isBatchTracked,
            isSerialTracked: parentItem.isSerialTracked,
            minStockThreshold: parentItem.minStockThreshold,
        };

        if (variantData.sku === '') delete variantData.sku;
        if (variantData.barcode === '') delete variantData.barcode;

        const variant = await Item.create(variantData);
        const populated = await Item.findById(variant._id).populate('category', 'name');

        sendResponse(res, 201, populated, 'Variant created successfully');
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/items/:parentId/variants
 * Get all variants of a parent item.
 */
export const getVariantsByParent = async (req, res, next) => {
    try {
        const parent = await Item.findOne({ _id: req.params.parentId, ...tenantQuery(req) }).populate('category', 'name');
        if (!parent) return sendError(res, 404, 'Parent item not found');

        const variants = await Item.find({ parentItem: req.params.parentId, ...tenantQuery(req) })
            .populate('category', 'name')
            .sort({ createdAt: 1 });

        const totalStock = variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
        const totalReserved = variants.reduce((sum, v) => sum + (v.reservedQuantity || 0), 0);

        sendResponse(res, 200, {
            parent,
            variants,
            summary: {
                variantCount: variants.length,
                totalStock,
                totalReserved,
                totalAvailable: totalStock - totalReserved,
            }
        });
    } catch (err) {
        next(err);
    }
};

/**
 * GET /api/items/parent-items
 * Get all items that are parents (have at least one variant child).
 */
export const getParentItems = async (req, res, next) => {
    try {
        // Find all items that appear as parentItem in at least one child
        const parentIds = await Item.distinct('parentItem', {
            parentItem: { $ne: null },
            ...tenantQuery(req)
        });

        const parents = await Item.find({
            _id: { $in: parentIds },
            ...tenantQuery(req)
        }).populate('category', 'name');

        sendResponse(res, 200, parents);
    } catch (err) {
        next(err);
    }
};
