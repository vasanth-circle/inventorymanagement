import mongoose from 'mongoose';
import { appConn } from './config/db.js';
import PurchaseOrder from './models/PurchaseOrder.js';

async function check() {
  const orders = await PurchaseOrder.find({ 
    $or: [
        { taxRate: 18 },
        { 'items.taxRate': 18 }
    ]
  }).select('orderNumber vendorBillNumber totalAmount taxAmount items.name items.taxRate').lean();
  
  console.log(JSON.stringify(orders, null, 2));
  process.exit(0);
}
check();
