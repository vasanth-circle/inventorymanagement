import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import PurchaseOrder from './models/PurchaseOrder.js';
import VendorLedger from './models/VendorLedger.js';
import { recalculateVendorBalance } from './controllers/vendorLedgerController.js';

async function updateAll() {
  const orders = await PurchaseOrder.find({ 
    $or: [
        { taxRate: 18 },
        { 'items.taxRate': 18 }
    ]
  });
  
  console.log('Found', orders.length, 'orders to update');

  for (const order of orders) {
    console.log('Updating PO:', order.orderNumber);
    
    // 1. Update items
    order.items.forEach(item => {
      item.taxRate = 0;
      item.taxAmount = 0;
    });
    order.taxRate = 0;
    
    // Pre-validate hook will recalculate itemsTotal, taxAmount, totalAmount
    await order.save();
    
    console.log('New totalAmount for PO', order.orderNumber, ':', order.totalAmount);

    // 2. Update VendorLedger
    await VendorLedger.findOneAndUpdate(
        { refId: order._id, refType: 'PurchaseOrder' },
        {
            $set: {
                credit: order.totalAmount,
            }
        }
    );

    // 3. Recalculate Vendor Balance
    await recalculateVendorBalance(order.vendor, order.tenantId);
  }

  console.log('All done');
  process.exit(0);
}

updateAll().catch(err => {
    console.error(err);
    process.exit(1);
});
