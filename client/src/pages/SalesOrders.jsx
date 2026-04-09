import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const SalesOrders = () => {
    const { items, billingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const [orders, setOrders] = useState([]);
    const [customers, setCustomers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState(null);
    const [formData, setFormData] = useState({
        customer: '',
        items: [{ 
            item: '', 
            quantity: 1, 
            price: 0, 
            boxCount: 0, 
            totalPcs: 0, 
            totalSqFt: 0,
            brand: '',
            size: '',
            batchId: '',
            availableBatches: []
        }],
        notes: '',
        isEstimation: false,
        status: 'quotation',
        loadingCharges: 0,
        transportCharges: 0,
        oldBalance: 0,
        advanceAmount: 0,
        taxAmount: 0
    });

    const API_URL = '/api/sales-orders';

    useEffect(() => {
        fetchOrders();
        fetchCustomersAndItems();
    }, []);

    const fetchOrders = async () => {
        try {
            setLoading(true);
            const res = await axios.get(API_URL, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            setOrders(res.data.data.orders);
        } catch (error) {
            console.error('Fetch Orders Error:', error.response || error);
            toast.error(`Order list failed: ${error.response?.data?.message || 'Server Error'}`);
        } finally {
            setLoading(false);
        }
    };

    const fetchCustomersAndItems = async () => {
        try {
            const token = localStorage.getItem('token');
            const [custRes, itemRes] = await Promise.all([
                axios.get('/api/customers', { headers: { Authorization: `Bearer ${token}` } }),
                axios.get('/api/items', { headers: { Authorization: `Bearer ${token}` } })
            ]);
            setCustomers(custRes.data.data.customers);
            setItems(itemRes.data.items);
        } catch (error) {
            console.error('Error fetching dependencies');
        }
    };

    const handleAddItem = () => {
        setFormData({
            ...formData,
            items: [...formData.items, { 
                item: '', 
                quantity: 1, 
                price: 0, 
                boxCount: 0, 
                totalPcs: 0, 
                totalSqFt: 0,
                brand: '',
                size: '',
                batchId: '',
                availableBatches: []
            }]
        });
    };

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;

        if (field === 'item') {
            const selectedItem = items.find(i => i._id === value);
            if (selectedItem) {
                newItems[index].name = selectedItem.name;
                newItems[index].price = selectedItem.price;
                newItems[index].brand = selectedItem.brand || '';
                newItems[index].size = selectedItem.size || '';
                newItems[index].hsn = selectedItem.hsn || '';
                newItems[index].pcsPerBox = selectedItem.pcsPerBox || 1;
                newItems[index].sqFtPerPc = selectedItem.sqFtPerPc || 0;
                newItems[index].availableBatches = selectedItem.batches || [];
                // Default to first batch if available
                if (selectedItem.batches && selectedItem.batches.length > 0) {
                    newItems[index].batchId = selectedItem.batches[0]._id;
                    newItems[index].price = selectedItem.batches[0].price;
                    newItems[index].batchNumber = selectedItem.batches[0].batchNumber;
                } else {
                    newItems[index].price = selectedItem.price;
                }
            }
        }

        if (field === 'batchId') {
            const row = newItems[index];
            const batch = row.availableBatches.find(b => b._id === value);
            if (batch) {
                row.batchId = batch._id;
                row.price = batch.price;
                row.batchNumber = batch.batchNumber;
            }
        }

        // Auto-calculations for tiles
        const item = newItems[index];
        if (field === 'boxCount' || field === 'item' || field === 'quantity' || field === 'price') {
            if (item.pcsPerBox) {
                const boxes = Number(item.boxCount) || 0;
                item.totalPcs = boxes * item.pcsPerBox;
                if (item.sqFtPerPc) {
                    item.totalSqFt = Number((item.totalPcs * item.sqFtPerPc).toFixed(2));
                    // Bill by SqFt
                    item.quantity = item.totalSqFt; 
                    item.total = Number((item.totalSqFt * (Number(item.price) || 0)).toFixed(2));
                } else {
                    // Fallback to boxes if sqft is not set
                    item.quantity = boxes;
                    item.total = Number((boxes * (Number(item.price) || 0)).toFixed(2));
                }
            }
        }

        setFormData({ ...formData, items: newItems });
    };

    const calculateTotals = () => {
        const itemsTotal = formData.items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
        const netTotal = (
            itemsTotal + 
            Number(formData.loadingCharges) + 
            Number(formData.transportCharges) + 
            Number(formData.taxAmount) + 
            Number(formData.oldBalance) - 
            Number(formData.advanceAmount)
        );
        return { itemsTotal, netTotal };
    };

    const handleEdit = (order) => {
        setEditingOrder(order);
        setFormData({
            customer: order.customer?._id || order.customer,
            items: order.items.map(item => ({
                ...item,
                item: item.item?._id || item.item,
                // Ensure calculations are preserved or recalculated
                total: item.total || (item.quantity * item.price)
            })),
            notes: order.notes || '',
            isEstimation: order.isEstimation || false,
            status: order.status || (order.isEstimation ? 'quotation' : 'confirmed'),
            loadingCharges: order.loadingCharges || 0,
            transportCharges: order.transportCharges || 0,
            oldBalance: order.oldBalance || 0,
            advanceAmount: order.advanceAmount || 0,
            taxAmount: order.taxAmount || 0,
            orderDate: order.orderDate
        });
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingOrder(null);
        setFormData({
            customer: '',
            items: [{ 
                item: '', 
                quantity: 1, 
                price: 0, 
                boxCount: 0, 
                totalPcs: 0, 
                totalSqFt: 0,
                brand: '',
                size: '',
                batchId: '',
                availableBatches: []
            }],
            notes: '',
            isEstimation: false,
            status: 'quotation',
            loadingCharges: 0,
            transportCharges: 0,
            oldBalance: 0,
            advanceAmount: 0,
            taxAmount: 0,
            orderDate: new Date().toISOString()
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const token = localStorage.getItem('token');
            if (editingOrder) {
                await axios.put(`${API_URL}/${editingOrder._id}`, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success('Order updated successfully');
            } else {
                await axios.post(API_URL, formData, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                toast.success(formData.isEstimation ? 'Estimation created' : 'Sales order created');
            }
            handleCloseModal();
            fetchOrders();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Error saving order');
        }
    };

    const handleStatusUpdate = async (id, status) => {
        try {
            await axios.patch(`${API_URL}/${id}/status`, { status }, {
                headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            toast.success(`Order marked as ${status}`);
            fetchOrders();
        } catch (error) {
            toast.error('Failed to update status');
        }
    };

    const numberToWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        if ((num = num.toString()).length > 9) return 'Amount too large';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return '';
        let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
        return 'Rupees ' + str;
    };

    const handlePrint = (order) => {
        const printContent = `
            <html>
                <head>
                    <title>Bill - ${order.orderNumber}</title>
                    <style>
                        @page { size: A4; margin: 5mm; }
                        body { 
                            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                            color: #000; 
                            line-height: 1.3; 
                            padding: 0; 
                            margin: 0;
                            font-size: 11px; 
                        }
                        .container { 
                            border: 1.5px solid #000; 
                            margin: 10px auto;
                            width: 190mm;
                            min-height: 270mm;
                            display: flex;
                            flex-direction: column;
                        }
                        
                        .company-header {
                            text-align: center;
                            padding: 10px;
                            border-bottom: 1.5px solid #000;
                            position: relative;
                        }
                        .contact-info {
                            position: absolute;
                            top: 5px;
                            right: 10px;
                            font-size: 9px;
                            font-weight: bold;
                            text-align: right;
                        }
                        .company-header h1 {
                            margin: 0;
                            font-size: 24px;
                            font-weight: 800;
                            letter-spacing: 1px;
                        }
                        .company-header p {
                            margin: 2px 0;
                            font-size: 10px;
                            font-weight: 600;
                        }
                        
                        .bill-type {
                            text-align: center;
                            background-color: #f0f0f0;
                            border-bottom: 1px solid #000;
                            padding: 3px;
                            font-weight: bold;
                            font-size: 14px;
                            letter-spacing: 2px;
                        }
                        
                        .details-grid {
                            display: flex;
                            border-bottom: 1px solid #000;
                        }
                        .bill-to, .bill-stats {
                            padding: 8px;
                            flex: 1;
                        }
                        .bill-to {
                            border-right: 1px solid #000;
                        }
                        .label-val {
                            display: flex;
                            margin-bottom: 3px;
                        }
                        .label {
                            width: 80px;
                            font-weight: bold;
                            font-size: 9px;
                            text-transform: uppercase;
                        }
                        .val {
                            flex: 1;
                            font-weight: bold;
                        }

                        .items-table {
                            flex-grow: 1;
                            border-bottom: 1.5px solid #000;
                            position: relative;
                            background-image: linear-gradient(to right, 
                                transparent 10mm, #000 10mm, #000 10.2mm, 
                                transparent 10.2mm, transparent 85mm, #000 85mm, #000 85.2mm, 
                                transparent 85.2mm, transparent 100mm, #000 100mm, #000 100.2mm, 
                                transparent 100.2mm, transparent 118mm, #000 118mm, #000 118.2mm, 
                                transparent 118.2mm, transparent 136mm, #000 136mm, #000 136.2mm, 
                                transparent 136.2mm, transparent 158mm, #000 158mm, #000 158.2mm, 
                                transparent 158.2mm, transparent 170mm, #000 170mm, #000 170.2mm, 
                                transparent 170.2mm
                            );
                            background-size: 100% 100%;
                            background-repeat: no-repeat;
                        }
                        table {
                            width: 100%;
                            border-collapse: collapse;
                        }
                        th, td {
                            padding: 4px 6px;
                            font-size: 9px; /* Slightly smaller to fit 8 columns */
                            border-right: 1.5px solid #000;
                        }
                        th:last-child, td:last-child {
                            border-right: none;
                        }
                        th {
                            border-bottom: 1.5px solid #000;
                            background-color: #fff;
                            font-weight: bold;
                            text-transform: uppercase;
                            font-size: 8px;
                        }
                        td {
                            vertical-align: top;
                        }
                        
                        .summary-section {
                            display: flex;
                            border-bottom: 1.5px solid #000;
                            min-height: 120px;
                        }
                        .summary-left {
                            flex: 1.8;
                            padding: 0;
                            display: flex;
                            flex-direction: column;
                            border-right: 1.5px solid #000;
                        }
                        .summary-right {
                            flex: 1;
                            padding: 0;
                        }
                        
                        .tax-table {
                            width: 100%;
                            border-collapse: collapse;
                            font-size: 8px;
                        }
                        .tax-table th, .tax-table td {
                            border: 1px solid #000;
                            padding: 2px 4px;
                            text-align: right;
                        }
                        
                        .math-row {
                            display: flex;
                            justify-content: space-between;
                            padding: 3px 8px;
                            font-size: 9px;
                        }
                        .grand-total {
                            background-color: #000;
                            color: #fff;
                            font-weight: bold;
                            font-size: 12px;
                            padding: 6px 8px;
                            margin-top: auto;
                        }
                        
                        .meta-grid {
                            display: grid;
                            grid-template-columns: 1.5fr 1fr;
                            border-bottom: 1.5px solid #000;
                        }
                        .meta-box {
                            padding: 5px 8px;
                            border-right: 1.5px solid #000;
                        }
                        .meta-box:last-child {
                            border-right: none;
                        }
                        .meta-item {
                            display: flex;
                            margin-bottom: 2px;
                            font-size: 10px;
                        }
                        .meta-label {
                            width: 100px;
                            font-weight: bold;
                        }
                        .meta-val {
                            flex: 1;
                            font-weight: bold;
                        }
                        
                        .footer {
                            padding: 10px;
                            display: flex;
                            justify-content: space-between;
                            align-items: flex-end;
                            font-size: 9px;
                        }
                        .terms {
                            font-size: 7.5px;
                            line-height: 1.2;
                        }
                    </style>
                </head>
                <body>
                    <div class="container">
                        <div class="company-header">
                            <div class="contact-info">
                                CELL: ${billingSettings?.phone1 || '90473 48191'}${billingSettings?.phone2 ? ', ' + billingSettings.phone2 : ', 90470 48191'}
                            </div>
                            <h1>SRI ALAGAR TILES & GRANITES</h1>
                            <p>No.29, M.M.Complex, Thiru Senthil Nagar,</p>
                            <p>K.Vadamudurai, MTP Road, Coimbatore.</p>
                        </div>
                        
                        <div class="bill-type">ESTIMATE CR</div>
                        
                        <div class="meta-grid">
                            <div class="meta-box">
                                <div class="meta-item"><span class="meta-label">To:</span> <span class="meta-val">${(order.customer?.companyName || order.customer?.name || 'Cash Sales').toUpperCase()}</span></div>
                                <div class="meta-item"><span class="meta-label"></span> <span class="meta-val">${order.customer?.address || ''}</span></div>
                            </div>
                            <div class="meta-box">
                                <div class="meta-item"><span class="meta-label">Payment Terms:</span> <span class="meta-val">${order.terms || 'Credit'}</span></div>
                                <div class="meta-item"><span class="meta-label">No:</span> <span class="meta-val" style="font-size: 14px;">${order.orderNumber}</span></div>
                                <div class="meta-item"><span class="meta-label">Date:</span> <span class="meta-val">${new Date(order.orderDate).toLocaleDateString()}</span></div>
                            </div>
                        </div>
                        
                        <div class="items-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th width="10mm">S.No</th>
                                        <th width="85mm">Description of Goods</th>
                                        <th width="15mm">HSN Code</th>
                                        <th width="18mm">Qty (SqFt)</th>
                                        <th width="18mm">Rate</th>
                                        <th width="18mm">Amount</th>
                                        <th width="12mm">Tax %</th>
                                        <th width="14mm">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${order.items.map((item, i) => {
                                        const taxPct = order.taxAmount > 0 ? 18 : 0;
                                        const totalAmt = item.total + (item.total * taxPct / 100);
                                        return `
                                            <tr>
                                                <td style="text-align: center;">${i + 1}</td>
                                                <td>
                                                    <div style="font-weight: bold;">${(item.name || '').toUpperCase()}</div>
                                                    <div style="font-size: 7.5px; color: #444;">${item.brand || ''} | ${item.size || ''}</div>
                                                </td>
                                                <td style="text-align: center;">${item.hsn || '690721'}</td>
                                                <td style="text-align: center; font-weight: bold;">
                                                    ${item.totalSqFt ? item.totalSqFt.toFixed(2) : item.quantity.toFixed(2)}<br/>
                                                    <span style="font-size: 7px; font-weight: normal;">(${item.boxCount || 0} Box)</span>
                                                </td>
                                                <td style="text-align: right;">${item.price.toFixed(2)}</td>
                                                <td style="text-align: right;">${item.total.toFixed(2)}</td>
                                                <td style="text-align: center;">${taxPct}%</td>
                                                <td style="text-align: right; font-weight: bold;">${(item.total + (item.total * taxPct / 100)).toFixed(2)}</td>
                                            </tr>
                                        `;
                                    }).join('')}
                                    ${Array(Math.max(0, 15 - order.items.length)).fill(0).map(() => `
                                        <tr style="height: 20px;">
                                            <td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                        
                        <div class="summary-section">
                            <div class="summary-left">
                                <div style="padding: 10px; border-bottom: 1px solid #000;">
                                    <div style="font-size: 8px; font-weight: bold; margin-bottom: 4px;">TAX ANALYSIS:</div>
                                    <table class="tax-table">
                                        <thead>
                                            <tr>
                                                <th>Taxable Value</th>
                                                <th>CGST%</th>
                                                <th>CGST Amt</th>
                                                <th>SGST%</th>
                                                <th>SGST Amt</th>
                                                <th>Total Tax</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <td>${(order.itemsTotal || 0).toFixed(2)}</td>
                                                <td>${order.taxAmount > 0 ? '9%' : '0%'}</td>
                                                <td>${(order.taxAmount / 2).toFixed(2)}</td>
                                                <td>${order.taxAmount > 0 ? '9%' : '0%'}</td>
                                                <td>${(order.taxAmount / 2).toFixed(2)}</td>
                                                <td>${(order.taxAmount || 0).toFixed(2)}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                                <div style="padding: 10px; flex: 1;">
                                    <div style="font-size: 8px; font-weight: bold; text-decoration: underline; margin-bottom: 3px;">AMOUNT IN WORDS:</div>
                                    <div style="font-weight: bold; text-transform: uppercase; font-size: 9px;">${numberToWords(Math.round(order.totalAmount))}</div>
                                    
                                    <div class="terms" style="margin-top: 10px;">
                                        <strong>E. & O.E.</strong><br/>
                                        1. Goods once sold will not be taken back.<br/>
                                        2. No responsibility for breakages after leaving premises.
                                    </div>
                                </div>
                            </div>
                            <div class="summary-right">
                                <div class="math-row" style="border-bottom: 1px solid #eee;"><span>Total Taxable Value:</span> <span>₹${(order.itemsTotal || 0).toLocaleString()}</span></div>
                                ${order.loadingCharges > 0 ? `<div class="math-row"><span>Loading:</span> <span>₹${order.loadingCharges.toLocaleString()}</span></div>` : ''}
                                ${order.transportCharges > 0 ? `<div class="math-row"><span>Auto Charges:</span> <span>₹${order.transportCharges.toLocaleString()}</span></div>` : ''}
                                ${order.oldBalance > 0 ? `<div class="math-row"><span>Old Balance:</span> <span>₹${order.oldBalance.toLocaleString()}</span></div>` : ''}
                                ${order.advanceAmount > 0 ? `<div class="math-row" style="color: green;"><span>Advance Paid:</span> <span>- ₹${order.advanceAmount.toLocaleString()}</span></div>` : ''}
                                <div class="math-row grand-total">
                                    <span>NET AMOUNT:</span>
                                    <span>₹${(order.totalTotalAmount || order.totalAmount).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>
                        
                        <div class="footer">
                            <div style="text-align: center; border-top: 1px solid #000; width: 150px; padding-top: 3px;">
                                RECEIVER'S SIGNATURE
                            </div>
                            <div style="text-align: center; width: 220px;">
                                <div style="font-weight: bold; margin-bottom: 40px;">For SRI ALAGAR TILES & GRANITES</div>
                                <div style="border-top: 1px solid #000; padding-top: 3px;">AUTHORIZED SIGNATORY</div>
                            </div>
                        </div>
                    </div>
                </body>
            </html>
        `;
        const win = window.open('', '_blank');
        win.document.write(printContent);
        win.document.close();
        win.focus();
        setTimeout(() => {
            win.print();
        }, 500);
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'quotation': return 'bg-purple-100 text-purple-800';
            case 'confirmed': return 'bg-blue-100 text-blue-800';
            case 'dispatched': return 'bg-green-100 text-green-800';
            case 'partially_dispatched': return 'bg-yellow-100 text-yellow-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            case 'draft': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const { itemsTotal, netTotal } = calculateTotals();

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-gray-800">Sales Orders & Estimations</h1>
                <button
                    onClick={() => {
                        setEditingOrder(null);
                        setIsModalOpen(true);
                    }}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors font-bold shadow-md"
                >
                    + Create New (Order/Quote)
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center items-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-bottom border-gray-100">
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Order #</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Customer</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Date</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Net Amount</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase">Status</th>
                                <th className="px-6 py-4 text-xs font-semibold text-gray-600 uppercase text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {orders.map((order) => (
                                <tr key={order._id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 font-medium text-primary-700">
                                        {order.orderNumber}
                                        {order.isEstimation && <span className="ml-2 text-[10px] bg-purple-100 text-purple-600 px-1 rounded">QUOTE</span>}
                                    </td>
                                    <td className="px-6 py-4 text-gray-900 font-medium">{order.customer?.companyName || order.customer?.name}</td>
                                    <td className="px-6 py-4 text-gray-600 text-sm">{new Date(order.orderDate).toLocaleDateString()}</td>
                                    <td className="px-6 py-4 font-bold text-gray-900">₹{order.totalAmount.toLocaleString()}</td>
                                    <td className="px-6 py-4">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase ${getStatusColor(order.status)}`}>
                                            {order.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right space-x-2">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => handlePrint(order)} className="text-primary-600 hover:text-primary-800 text-sm font-bold border-2 border-primary-100 px-3 py-1.5 rounded-lg bg-primary-50 transition-all flex items-center inline-flex">
                                                <span className="mr-1">📄</span> Bill
                                            </button>
                                            
                                            {['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && (
                                                <button 
                                                    onClick={() => handleEdit(order)} 
                                                    className="text-amber-600 hover:text-amber-800 text-sm font-bold border-2 border-amber-100 px-3 py-1.5 rounded-lg bg-amber-50 transition-all flex items-center inline-flex"
                                                >
                                                    <span className="mr-1">✏️</span> Edit
                                                </button>
                                            )}

                                            {order.status === 'quotation' && (
                                                <button onClick={() => handleStatusUpdate(order._id, 'confirmed')} className="bg-blue-600 text-white hover:bg-blue-700 px-3 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-all">Accept</button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center p-4 z-50 backdrop-blur-sm overflow-hidden">
                    <div className="bg-white rounded-2xl shadow-2xl w-[95%] max-w-5xl max-h-[95vh] flex flex-col overflow-hidden">
                        <div className="px-8 py-5 border-b border-gray-100 flex justify-between items-center bg-gray-50 rounded-t-2xl">
                            <div>
                                <h2 className="text-2xl font-black text-gray-800">
                                    {editingOrder ? 'Edit' : 'Create'} {formData.isEstimation ? 'Quotation' : 'Sales Order'}
                                </h2>
                                <p className="text-xs text-gray-500 font-medium">Specialized Tiles & Granites Billing</p>
                            </div>
                            <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600 text-3xl transition-colors">&times;</button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                            <form onSubmit={handleSubmit} className="space-y-8 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
                                <div className="md:col-span-1">
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Select Customer *</label>
                                    <select required value={formData.customer} onChange={(e) => setFormData({ ...formData, customer: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary-500 outline-none shadow-sm transition-all">
                                        <option value="">Select Customer</option>
                                        {customers.map(c => <option key={c._id} value={c._id}>{c.companyName || c.name}</option>)}
                                    </select>
                                </div>
                                <div className="flex items-center space-x-6 pb-3">
                                    <label className="flex items-center cursor-pointer group">
                                        <div className="relative">
                                            <input 
                                                type="checkbox" 
                                                className="sr-only" 
                                                checked={formData.isEstimation} 
                                                onChange={(e) => setFormData({ 
                                                    ...formData, 
                                                    isEstimation: e.target.checked, 
                                                    status: e.target.checked ? 'quotation' : 'confirmed' 
                                                })} 
                                            />
                                            <div className={`block w-14 h-8 rounded-full transition-colors ${formData.isEstimation ? 'bg-purple-600' : 'bg-gray-300'}`}></div>
                                            <div className={`dot absolute left-1 top-1 bg-white w-6 h-6 rounded-full transition-transform ${formData.isEstimation ? 'transform translate-x-6' : ''}`}></div>
                                        </div>
                                        <div className="ml-3 text-gray-700 font-bold select-none">
                                            {formData.isEstimation ? 'Estimation / Quote' : 'Final Bill'}
                                        </div>
                                    </label>
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Order Date</label>
                                    <input type="date" value={formData.orderDate?.split('T')[0]} onChange={(e) => setFormData({ ...formData, orderDate: e.target.value })} className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-500" />
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="text-lg font-black text-gray-800 flex items-center">
                                        <span className="bg-primary-100 text-primary-600 p-1 rounded mr-2 text-sm">📦</span>
                                        Item Details
                                    </h3>
                                </div>
                                <div className="overflow-x-auto border rounded-xl shadow-sm">
                                    <table className="w-full text-left min-w-[800px]">
                                        <thead className="bg-gray-100">
                                            <tr>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider">Item Name / Brand</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-24">Boxes (Qty)</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Total SqFt</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider w-32">Rate (₹/SqFt)</th>
                                                <th className="px-4 py-3 text-[10px] font-black text-gray-600 uppercase tracking-wider text-right w-32">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {formData.items.map((row, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3">
                                                        <select required value={row.item} onChange={(e) => handleItemChange(index, 'item', e.target.value)} className="w-full px-3 py-2 border rounded-lg focus:ring-1 focus:ring-primary-400 outline-none border-gray-200 font-medium text-sm">
                                                            <option value="">Select Item</option>
                                                            {items.map(i => <option key={i._id} value={i._id}>{i.name} ({i.brand} - {i.size})</option>)}
                                                        </select>
                                                        {row.availableBatches && row.availableBatches.length > 0 && (
                                                            <div className="mt-2 group relative">
                                                                <label className="text-[9px] font-bold text-primary-600 block mb-1 px-1">SELECT RATE/BATCH:</label>
                                                                <select
                                                                    value={row.batchId}
                                                                    onChange={(e) => handleItemChange(index, 'batchId', e.target.value)}
                                                                    className="w-full text-[10px] px-2 py-1.5 border-2 border-primary-200 rounded-lg bg-primary-50 text-primary-800 font-bold outline-none focus:border-primary-400 shadow-sm"
                                                                >
                                                                    {row.availableBatches.map(b => (
                                                                        <option key={b._id} value={b._id}>
                                                                            {b.batchNumber || 'Batch'} - ₹{b.price} ({b.quantity} Left)
                                                                        </option>
                                                                    ))}
                                                                </select>
                                                            </div>
                                                        )}
                                                        {row.brand && !row.availableBatches?.length && <div className="text-[10px] text-gray-400 mt-1 pl-1">{row.brand} | {row.size}</div>}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input type="number" step="0.01" min="0" value={row.boxCount} onChange={(e) => handleItemChange(index, 'boxCount', e.target.value)} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 text-center font-bold" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input required type="number" step="0.01" value={row.quantity} onChange={(e) => handleItemChange(index, 'quantity', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none bg-gray-50 font-medium" />
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <input required type="number" step="0.01" value={row.price} onChange={(e) => handleItemChange(index, 'price', parseFloat(e.target.value))} className="w-full px-3 py-2 border rounded-lg border-gray-200 outline-none focus:ring-1 focus:ring-primary-400 font-bold" />
                                                    </td>
                                                    <td className="px-4 py-3 text-right font-black text-gray-800">
                                                        ₹{(row.totalSqFt * row.price).toLocaleString()}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                <button type="button" onClick={handleAddItem} className="text-primary-600 hover:text-primary-700 text-sm font-black flex items-center bg-primary-50 px-4 py-2 rounded-lg transition-colors">
                                    <span className="text-xl mr-2">+</span> Add Line Item
                                </button>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                                <div className="space-y-4">
                                    <label className="block text-sm font-bold text-gray-700">Notes & Terms</label>
                                    <textarea 
                                        rows="4" 
                                        value={formData.notes} 
                                        onChange={(e) => setFormData({ ...formData, notes: e.target.value })} 
                                        placeholder="Add any specific instructions or terms..."
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-primary-400"
                                    ></textarea>
                                </div>
                                <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                                    <h4 className="font-bold text-gray-800 border-b pb-2 mb-4">Billing Extra & Offsets</h4>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Loading Charges</label>
                                            <input type="number" value={formData.loadingCharges} onChange={(e) => setFormData({ ...formData, loadingCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Transport / Auto</label>
                                            <input type="number" value={formData.transportCharges} onChange={(e) => setFormData({ ...formData, transportCharges: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Tax Amount</label>
                                            <input type="number" value={formData.taxAmount} onChange={(e) => setFormData({ ...formData, taxAmount: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Old Balance (Add)</label>
                                            <input type="number" value={formData.oldBalance} onChange={(e) => setFormData({ ...formData, oldBalance: e.target.value })} className="w-full px-3 py-2 border rounded-lg outline-none text-red-600 font-bold" />
                                        </div>
                                        <div className="col-span-2">
                                            <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Advance Amount (Subtract)</label>
                                            <input type="number" value={formData.advanceAmount} onChange={(e) => setFormData({ ...formData, advanceAmount: e.target.value })} className="w-full px-3 py-2 border rounded-lg border-primary-300 outline-none text-green-600 font-bold" />
                                        </div>
                                    </div>
                                    <div className="pt-6 border-t mt-6 space-y-3">
                                        <div className="flex justify-between text-gray-600 font-medium">
                                            <span>Subtotal Items:</span>
                                            <span>₹{itemsTotal.toLocaleString()}</span>
                                        </div>
                                        <div className="flex justify-between text-2xl font-black text-gray-900 pt-2 border-t border-dashed">
                                            <span>NET TOTAL:</span>
                                            <span className="text-primary-700">₹{netTotal.toLocaleString()}</span>
                                        </div>
                                    </div>
                            </div>
                        </div>
                        </form>
                        </div>
                        <div className="flex justify-end gap-4 p-6 border-t bg-gray-50 rounded-b-2xl">
                            <button type="button" onClick={handleCloseModal} className="px-8 py-3 text-gray-600 font-bold border border-gray-300 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
                            <button 
                                onClick={() => {
                                    const form = document.querySelector('form');
                                    if(form) form.requestSubmit();
                                }}
                                className="px-10 py-3 bg-primary-600 text-white rounded-xl hover:bg-primary-700 font-black shadow-lg shadow-primary-200 transition-all active:scale-95"
                            >
                                {editingOrder ? '💾 Update Changes' : (formData.isEstimation ? '💾 Save Quotation' : '✅ Generate Final Bill')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SalesOrders;
