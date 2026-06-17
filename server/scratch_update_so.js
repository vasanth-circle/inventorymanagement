import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

const token = jwt.sign(
    { id: '60c72b2f5f1b2c001f3e4b3e', role: 'admin', tenantId: '60c72b2f5f1b2c001f3e4b3d' },
    'supersecretkey123',
    { expiresIn: '1d' }
);

async function testUpdate() {
    try {
        const res1 = await fetch('http://localhost:5000/api/sales-orders', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data1 = await res1.json();
        const orders = data1.data?.orders || data1.orders;
        
        if (!orders || orders.length === 0) {
            console.log('No orders found');
            return;
        }
        
        const order = orders[0];
        console.log('Editing order:', order._id);
        
        const submissionData = {
            status: order.status,
            customer: order.customer._id
        };
        
        const res2 = await fetch(`http://localhost:5000/api/sales-orders/${order._id}`, {
            method: 'PUT',
            headers: { 
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(submissionData)
        });
        
        const data2 = await res2.json();
        if (!res2.ok) {
            console.log('Update failed:', data2.message);
        } else {
            console.log('Update success:', data2.message);
        }
    } catch (err) {
        console.log('Error:', err.message);
    }
}

testUpdate();
