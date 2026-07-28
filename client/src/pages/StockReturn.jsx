import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { InventoryContext } from '../context/InventoryContext';

// ── Searchable Select Component (inline, lightweight) ──────────────────────
const SearchableDropdown = ({ options = [], value, onChange, placeholder = 'Search...', disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);

    const selected = options.find(o => o.value === value);

    const filtered = options.filter(o =>
        o.label.toLowerCase().includes(search.toLowerCase())
    );

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const handleSelect = (val) => {
        onChange(val);
        setSearch('');
        setOpen(false);
    };

    return (
        <div ref={ref} className="relative w-full">
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={`w-full h-11 px-4 text-left bg-gray-50 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all flex items-center justify-between ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
            >
                <span className={selected ? 'text-gray-800' : 'text-gray-400'}>
                    {selected ? selected.label : placeholder}
                </span>
                <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <input
                            autoFocus
                            type="text"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            placeholder="Type to search..."
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-rose-500"
                        />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0 ? (
                            <div className="px-4 py-3 text-xs text-gray-400 text-center">No results found</div>
                        ) : (
                            filtered.map(o => (
                                <button
                                    key={o.value}
                                    type="button"
                                    onClick={() => handleSelect(o.value)}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-rose-50 hover:text-rose-700 transition-colors ${o.value === value ? 'bg-rose-50 text-rose-700 font-bold' : 'text-gray-700'}`}
                                >
                                    {o.label}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Main Component ─────────────────────────────────────────────────────────
const StockReturn = () => {
    const navigate = useNavigate();
    const { billingSettings } = useContext(InventoryContext);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [allItems, setAllItems] = useState([]);

    // Step state
    const [returnType, setReturnType] = useState('customer');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedVendor, setSelectedVendor] = useState('');

    // Bills (invoices only — not quotations)
    const [invoices, setInvoices] = useState([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [selectedInvoice, setSelectedInvoice] = useState(null);

    // Return items table (for customer returns from a bill)
    const [returnItems, setReturnItems] = useState([]);

    // For vendor returns
    const [purchaseOrders, setPurchaseOrders] = useState([]);
    const [loadingPOs, setLoadingPOs] = useState(false);
    const [selectedPO, setSelectedPO] = useState(null);
    const [vendorItem, setVendorItem] = useState('');
    const [vendorQty, setVendorQty] = useState('');
    const [vendorRate, setVendorRate] = useState('');

    // Shared Form Fields
    const [referenceOrder, setReferenceOrder] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [settlementType, setSettlementType] = useState('ledger');

    useEffect(() => {
        fetchInitialData();
    }, []);

    const fetchInitialData = async () => {
        try {
            const [custRes, vendRes, itemsRes] = await Promise.allSettled([
                api.get('/customers?limit=5000'),
                api.get('/vendors?limit=1000'),
                api.get('/items?limit=5000'),
            ]);
            
            if (custRes.status === 'fulfilled') setCustomers(custRes.value.data.data?.customers || []);
            if (vendRes.status === 'fulfilled') setVendors(vendRes.value.data.data?.vendors || []);
            if (itemsRes.status === 'fulfilled') setAllItems(itemsRes.value.data.items || itemsRes.value.data.data?.items || []);

            if (custRes.status === 'rejected' && vendRes.status === 'rejected' && itemsRes.status === 'rejected') {
                throw new Error('All initial data requests failed');
            }
        } catch (error) {
            toast.error('Failed to load some initial data');
        }
    };

    // Fetch invoices (not quotations) for the selected customer
    const handleCustomerSelect = async (customerId) => {
        setSelectedCustomer(customerId);
        setSelectedInvoice(null);
        setReturnItems([]);
        setInvoices([]);
        if (!customerId) return;

        setLoadingInvoices(true);
        try {
            // Fetch only converted invoices (isEstimation=false)
            const res = await api.get(`/sales-orders?customer=${customerId}&limit=200`);
            const orders = res.data.data?.orders || [];
            // Filter: only real invoices (not quotations/estimations), and not cancelled/void
            const filteredInvoices = orders.filter(o =>
                !o.isEstimation &&
                o.status !== 'quotation' &&
                !['cancelled', 'void'].includes(o.status) &&
                !o.orderNumber.startsWith('E-') &&
                !o.orderNumber.startsWith('EST')
            );
            setInvoices(filteredInvoices);
        } catch (error) {
            toast.error('Failed to fetch invoices');
        } finally {
            setLoadingInvoices(false);
        }
    };

    // Fetch POs for selected vendor
    const handleVendorSelect = async (vendorId) => {
        setSelectedVendor(vendorId);
        setSelectedPO(null);
        setVendorItem('');
        setPurchaseOrders([]);
        if (!vendorId) return;

        setLoadingPOs(true);
        try {
            const res = await api.get(`/purchase-orders?vendor=${vendorId}&limit=200`);
            setPurchaseOrders(res.data.data?.orders || []);
        } catch (error) {
            toast.error('Failed to fetch purchase orders');
        } finally {
            setLoadingPOs(false);
        }
    };

    // When an invoice is selected — populate return items table
    const handleInvoiceSelect = (invoiceId) => {
        const invoice = invoices.find(i => i._id === invoiceId);
        setSelectedInvoice(invoice || null);
        setReferenceOrder(invoice?.orderNumber || '');
        if (invoice) {
            // Build return items rows with returnQty defaulting to 0
            const rows = invoice.items.map(lineItem => ({
                itemId: lineItem.item?._id || lineItem.item,
                itemName: lineItem.name || lineItem.item?.name || '',
                brand: lineItem.brand || lineItem.item?.brand || '',
                size: lineItem.size || lineItem.item?.size || '',
                hsn: lineItem.hsn || lineItem.item?.hsn || lineItem.item?.hsnCode || '',
                billingUnit: lineItem.billingUnit || lineItem.item?.unitType || lineItem.item?.billingUnit || 'Nos',
                taxRate: lineItem.taxRate || lineItem.item?.taxRate || 0,
                billedQty: lineItem.quantity || 0,
                rate: lineItem.price || 0,
                returnQty: '',
            }));
            setReturnItems(rows);
        } else {
            setReturnItems([]);
        }
    };

    const handlePOSelect = (poId) => {
        const po = purchaseOrders.find(p => p._id === poId);
        setSelectedPO(po || null);
        setReferenceOrder(po?.vendorBillNumber || po?.orderNumber || '');
        if (po) {
            const rows = po.items.map(lineItem => ({
                itemId: lineItem.item?._id || lineItem.item,
                itemName: lineItem.name || lineItem.item?.name || '',
                brand: lineItem.brand || lineItem.item?.brand || '',
                size: lineItem.size || lineItem.item?.size || '',
                hsn: lineItem.hsn || lineItem.item?.hsn || lineItem.item?.hsnCode || '',
                billingUnit: lineItem.billingUnit || lineItem.item?.unitType || lineItem.item?.billingUnit || 'Nos',
                taxRate: lineItem.taxRate || lineItem.item?.taxRate || 0,
                billedQty: lineItem.quantity || 0,
                rate: lineItem.price || 0,
                returnQty: '',
                isManual: false
            }));
            setReturnItems(rows);
        } else {
            setReturnItems([]);
        }
    };

    const handleVendorItemSelect = (itemId) => {
        if (!itemId) return;
        const selectedItem = allItems.find(i => i._id === itemId) || {};
        
        if (returnItems.find(r => r.itemId === itemId)) {
            toast.error('Item already added to return list');
            return;
        }

        const newRow = {
            itemId: selectedItem._id,
            itemName: selectedItem.name || 'Item',
            brand: selectedItem.brand,
            size: selectedItem.size,
            hsn: selectedItem.hsn,
            billingUnit: selectedItem.unitType || selectedItem.billingUnit || 'Nos',
            taxRate: selectedItem.taxRate || 0,
            billedQty: 0,
            rate: 0,
            returnQty: '',
            isManual: true
        };
        setReturnItems([...returnItems, newRow]);
    };

    const handleReturnQtyChange = (index, value) => {
        const updated = [...returnItems];
        updated[index] = { ...updated[index], returnQty: value };
        setReturnItems(updated);
    };

    const handleRateChange = (index, value) => {
        const updated = [...returnItems];
        updated[index] = { ...updated[index], rate: parseFloat(value) || 0 };
        setReturnItems(updated);
    };

    const removeReturnItem = (index) => {
        const updated = [...returnItems];
        updated.splice(index, 1);
        setReturnItems(updated);
    };

    // Calculate total refund amount
    const refundTotal = returnItems.reduce((sum, row) => {
        const qty = parseFloat(row.returnQty) || 0;
        return sum + qty * (row.rate || 0);
    }, 0);

    // Submit handler
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (loading) return;

        if (returnType === 'customer') {
            if (!selectedCustomer) return toast.error('Please select a customer');
            if (!selectedInvoice) return toast.error('Please select an invoice to return from');

            const itemsToReturn = returnItems.filter(r => parseFloat(r.returnQty) > 0);
            if (itemsToReturn.length === 0) return toast.error('Enter return quantity for at least one item');

            // Validate return qty <= billed qty
            for (const row of itemsToReturn) {
                if (parseFloat(row.returnQty) > row.billedQty) {
                    return toast.error(`Return qty for "${row.itemName}" cannot exceed billed qty (${row.billedQty})`);
                }
            }

            setLoading(true);
            try {
                // Submit each return item as a separate transaction
                for (const row of itemsToReturn) {
                    await api.post('/transactions/return', {
                        item: row.itemId,
                        returnType: 'customer',
                        quantity: parseFloat(row.returnQty),
                        rate: row.rate,
                        customer: selectedCustomer,
                        referenceOrder,
                        reason,
                        notes,
                        settlementType,
                    });
                }
                toast.success(`Return recorded! ₹${refundTotal.toLocaleString('en-IN')} refunded to customer ledger.`);
                if (window.confirm('Return recorded successfully! Would you like to print the return slip?')) {
                    const returnTx = {
                        returnType: 'customer',
                        customer: customers.find(c => c._id === selectedCustomer),
                        createdAt: new Date(),
                        quantity: itemsToReturn.reduce((sum, r) => sum + parseFloat(r.returnQty), 0),
                        referenceOrder,
                        reason,
                        notes,
                        items: itemsToReturn.map(r => ({
                            name: r.itemName,
                            brand: r.brand,
                            size: r.size,
                            hsnCode: r.hsn,
                            billingUnit: r.billingUnit,
                            taxRate: r.taxRate,
                            quantity: parseFloat(r.returnQty),
                            price: r.rate,
                            total: parseFloat(r.returnQty) * r.rate
                        }))
                    };
                    import('../utils/printTemplates').then(module => {
                        module.printReturnSlip(returnTx, billingSettings);
                        navigate('/inventory');
                    });
                } else {
                    navigate('/inventory');
                }

            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to record return');
            } finally {
                setLoading(false);
            }
        } else {
            // Vendor return
            if (!selectedVendor) return toast.error('Please select a vendor');
            
            const itemsToReturn = returnItems.filter(r => parseFloat(r.returnQty) > 0);
            if (itemsToReturn.length === 0) return toast.error('Enter return quantity for at least one item');

            for (const row of itemsToReturn) {
                if (!row.isManual && parseFloat(row.returnQty) > row.billedQty) {
                    return toast.error(`Return qty for "${row.itemName}" cannot exceed billed qty (${row.billedQty})`);
                }
            }

            setLoading(true);
            try {
                for (const row of itemsToReturn) {
                    await api.post('/transactions/return', {
                        item: row.itemId,
                        returnType: 'vendor',
                        quantity: parseFloat(row.returnQty),
                        rate: row.rate || 0,
                        vendor: selectedVendor,
                        referenceOrder,
                        reason,
                        notes,
                        settlementType,
                    });
                }
                toast.success('Vendor return recorded! Adjustments made to vendor ledger.');
                if (window.confirm('Return recorded successfully! Would you like to print the return slip?')) {
                    const returnTx = {
                        returnType: 'vendor',
                        vendor: vendors.find(v => v._id === selectedVendor),
                        createdAt: new Date(),
                        quantity: itemsToReturn.reduce((sum, r) => sum + parseFloat(r.returnQty), 0),
                        referenceOrder,
                        reason,
                        notes,
                        items: itemsToReturn.map(r => ({
                            name: r.itemName,
                            brand: r.brand,
                            size: r.size,
                            hsnCode: r.hsn,
                            billingUnit: r.billingUnit,
                            taxRate: r.taxRate,
                            quantity: parseFloat(r.returnQty),
                            price: r.rate,
                            total: parseFloat(r.returnQty) * r.rate
                        }))
                    };
                    import('../utils/printTemplates').then(module => {
                        module.printReturnSlip(returnTx, billingSettings);
                        navigate('/inventory');
                    });
                } else {
                    navigate('/inventory');
                }

            } catch (error) {
                toast.error(error.response?.data?.message || 'Failed to record return');
            } finally {
                setLoading(false);
            }
        }
    };

    const customerOptions = customers.map(c => ({
        value: c._id,
        label: `${c.companyName || c.name}${c.phone ? ` — ${c.phone}` : ''}`,
    }));

    const vendorOptions = vendors.map(v => ({
        value: v._id,
        label: v.name,
    }));

    const itemOptions = allItems.map(i => ({
        value: i._id,
        label: `${i.name} (${i.brand || ''} - ${i.size || ''})`,
    }));

    const invoiceOptions = invoices.map(inv => ({
        value: inv._id,
        label: `${inv.orderNumber}  •  ${new Date(inv.orderDate).toLocaleDateString('en-IN')}  •  ₹${(inv.totalAmount || 0).toLocaleString('en-IN')}`,
    }));

    const poOptions = purchaseOrders.map(po => ({
        value: po._id,
        label: `${po.vendorBillNumber ? `Bill: ${po.vendorBillNumber}` : `PO: ${po.orderNumber}`}  •  ${new Date(po.orderDate || po.createdAt).toLocaleDateString('en-IN')}  •  ₹${(po.totalAmount || 0).toLocaleString('en-IN')}`
    }));

    const vendorItemOptions = selectedPO 
        ? selectedPO.items.map(i => {
            const item = allItems.find(ai => ai._id === (i.item?._id || i.item));
            return {
                value: item?._id || i.item,
                label: `${item?.name || i.name} (Billed: ${i.quantity})`,
            };
        })
        : allItems.map(i => ({ value: i._id, label: `${i.name} (${i.brand || ''} - ${i.size || ''})` }));

    return (
        <div className="p-1 space-y-6 max-w-[1000px] mx-auto">
            {/* Header */}
            <div className="flex justify-between items-end pb-2 border-b border-gray-100">
                <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-white shadow-sm border border-gray-100 rounded-lg flex items-center justify-center text-xl">↩️</div>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-800">Stock Return Management</h1>
                        <p className="text-xs text-gray-400 font-medium">Record returns from customers or to vendors</p>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-visible">
                <form onSubmit={handleSubmit} className="divide-y divide-gray-50">

                    {/* ── Section 1: Return Type + Customer/Vendor ── */}
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Return Type */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Return Type</label>
                            <select
                                value={returnType}
                                onChange={e => {
                                    setReturnType(e.target.value);
                                    setSelectedCustomer('');
                                    setSelectedVendor('');
                                    setSelectedInvoice(null);
                                    setSelectedPO(null);
                                    setPurchaseOrders([]);
                                    setReturnItems([]);
                                    setInvoices([]);
                                }}
                                className="w-full h-11 px-4 bg-gray-50 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all cursor-pointer"
                            >
                                <option value="customer">Return from Customer (Stock In)</option>
                                <option value="vendor">Return to Vendor (Stock Out)</option>
                            </select>
                        </div>

                        {/* Customer or Vendor selector — FIRST after type */}
                        <div className="space-y-1">
                            {returnType === 'customer' ? (
                                <>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                                        👤 Customer <span className="text-rose-500">*</span>
                                    </label>
                                    <SearchableDropdown
                                        options={customerOptions}
                                        value={selectedCustomer}
                                        onChange={handleCustomerSelect}
                                        placeholder="Search & select customer..."
                                    />
                                </>
                            ) : (
                                <>
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                                        🏭 Vendor <span className="text-rose-500">*</span>
                                    </label>
                                    <SearchableDropdown
                                        options={vendorOptions}
                                        value={selectedVendor}
                                        onChange={handleVendorSelect}
                                        placeholder="Search & select vendor..."
                                    />
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Section 2: Items Selection (Customer & Vendor) ── */}
                    {(returnType === 'customer' && selectedCustomer) || (returnType === 'vendor' && selectedVendor) ? (
                        <div className={`p-6 space-y-4 ${returnType === 'customer' ? 'bg-rose-50/30' : 'bg-slate-50/30'}`}>
                            
                            {/* Bill/PO Selection */}
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                                    {returnType === 'customer' ? '📄 Select Invoice to Return From' : '📄 Select Bill / PO to Return From (Optional)'}
                                    {loadingInvoices && returnType === 'customer' && <span className="ml-2 text-rose-400 animate-pulse">⏳ Loading...</span>}
                                    {loadingPOs && returnType === 'vendor' && <span className="ml-2 text-slate-400 animate-pulse">⏳ Loading...</span>}
                                </label>
                                {returnType === 'customer' ? (
                                    <SearchableDropdown
                                        options={invoiceOptions}
                                        value={selectedInvoice?._id || ''}
                                        onChange={handleInvoiceSelect}
                                        placeholder="Search invoice by number or date..."
                                        disabled={loadingInvoices || invoices.length === 0}
                                    />
                                ) : (
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <SearchableDropdown
                                                options={poOptions}
                                                value={selectedPO?._id || ''}
                                                onChange={handlePOSelect}
                                                placeholder="Optional: Select PO to autofill items..."
                                                disabled={loadingPOs || purchaseOrders.length === 0}
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <SearchableDropdown
                                                options={vendorItemOptions}
                                                value={''}
                                                onChange={handleVendorItemSelect}
                                                placeholder="Or manually search & add item..."
                                            />
                                        </div>
                                    </div>
                                )}

                                {selectedInvoice && returnType === 'customer' && (
                                    <div className="mt-2 flex items-center gap-3 px-3 py-2 bg-white border border-rose-100 rounded-lg">
                                        <span className="text-xs text-gray-500">Invoice:</span>
                                        <span className="font-black text-rose-600 text-sm">{selectedInvoice.orderNumber}</span>
                                        <span className="text-xs text-gray-400">•</span>
                                        <span className="text-xs text-gray-500">{new Date(selectedInvoice.orderDate).toLocaleDateString('en-IN')}</span>
                                        <span className="text-xs text-gray-400">•</span>
                                        <span className="text-xs font-bold text-gray-700">₹{(selectedInvoice.totalAmount || 0).toLocaleString('en-IN')}</span>
                                        <span className={`ml-auto px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${selectedInvoice.status === 'confirmed' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                                            {selectedInvoice.status}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Reference Order input for Vendors */}
                            {returnType === 'vendor' && (
                                <div className="space-y-1 w-1/2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Order # / Ref</label>
                                    <input
                                        type="text"
                                        value={referenceOrder}
                                        onChange={e => setReferenceOrder(e.target.value)}
                                        placeholder="Reference number"
                                        className="w-full h-11 px-4 bg-white border border-gray-100 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-slate-500 transition-all"
                                    />
                                </div>
                            )}

                            {/* ── Return Items Table ── */}
                            {returnItems.length > 0 && (
                                <div className="space-y-2 mt-4">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">
                                        📦 Items to Return
                                    </label>
                                    <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
                                        <table className="w-full text-sm">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-100">
                                                    <th className="text-left px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item</th>
                                                    <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-28">Billed Qty</th>
                                                    <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Return Qty</th>
                                                    <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Rate</th>
                                                    <th className="text-right px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-32">Refund Amt</th>
                                                    <th className="text-center px-4 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest w-12"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-50">
                                                {returnItems.map((row, idx) => {
                                                    const returnQty = parseFloat(row.returnQty) || 0;
                                                    const rowRefund = returnQty * row.rate;
                                                    const isOverReturn = !row.isManual && returnQty > row.billedQty;
                                                    return (
                                                        <tr key={idx} className={`hover:bg-gray-50 transition-colors ${isOverReturn ? 'bg-red-50' : ''}`}>
                                                            <td className="px-4 py-3">
                                                                <div className="font-bold text-gray-800 text-sm">{row.itemName}</div>
                                                                <div className="text-xs text-gray-500">{row.brand || ''} {row.size ? `- ${row.size}` : ''}</div>
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                {row.isManual ? (
                                                                    <span className="text-xs text-gray-400 font-bold">—</span>
                                                                ) : (
                                                                    <span className="inline-block px-2 py-1 bg-blue-50 text-blue-700 font-black text-xs rounded-lg">
                                                                        {row.billedQty}
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <input
                                                                    type="number"
                                                                    min="0"
                                                                    max={row.isManual ? undefined : row.billedQty}
                                                                    step="0.01"
                                                                    value={row.returnQty}
                                                                    onChange={e => handleReturnQtyChange(idx, e.target.value)}
                                                                    placeholder="0"
                                                                    className={`w-full px-3 py-2 text-center font-bold rounded-lg border outline-none focus:ring-2 ${returnType === 'customer' ? 'focus:ring-rose-500' : 'focus:ring-slate-500'} text-sm ${isOverReturn ? 'border-red-400 bg-red-50 text-red-700' : 'border-gray-200 bg-gray-50'}`}
                                                                />
                                                                {isOverReturn && (
                                                                    <div className="text-[9px] text-red-500 font-bold text-center mt-0.5">Exceeds!</div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {row.isManual ? (
                                                                    <input
                                                                        type="number"
                                                                        min="0"
                                                                        step="0.01"
                                                                        value={row.rate || ''}
                                                                        onChange={e => handleRateChange(idx, e.target.value)}
                                                                        placeholder="0.00"
                                                                        className={`w-full px-3 py-2 text-right font-bold rounded-lg border border-gray-200 bg-gray-50 outline-none focus:ring-2 ${returnType === 'customer' ? 'focus:ring-rose-500' : 'focus:ring-slate-500'} text-sm`}
                                                                    />
                                                                ) : (
                                                                    <div className="text-right text-gray-600 font-medium text-sm pt-2">
                                                                        ₹{row.rate.toLocaleString('en-IN')}
                                                                    </div>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-right font-black text-gray-800">
                                                                {rowRefund > 0 ? (
                                                                    <span className={returnType === 'customer' ? 'text-rose-600' : 'text-slate-700'}>
                                                                        ₹{rowRefund.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-gray-300">—</span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3 text-center">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => removeReturnItem(idx)}
                                                                    className="text-gray-400 hover:text-red-500 transition-colors"
                                                                    title="Remove Item"
                                                                >
                                                                    🗑️
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                            {/* Summary Row */}
                                            {refundTotal > 0 && (
                                                <tfoot>
                                                    <tr className={returnType === 'customer' ? 'bg-rose-600 text-white' : 'bg-slate-700 text-white'}>
                                                        <td colSpan={4} className="px-4 py-3 font-black text-sm uppercase tracking-wider text-right">
                                                            Total Refunded Amount:
                                                        </td>
                                                        <td className="px-4 py-3 text-right font-black text-lg">
                                                            ₹{refundTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                        </td>
                                                        <td></td>
                                                    </tr>
                                                </tfoot>
                                            )}
                                        </table>
                                    </div>
                                    {returnType === 'customer' && (
                                        <p className="text-[10px] text-gray-400 pl-1 mt-2">
                                            💡 Only invoices (converted from quotation or directly created) can be returned. Quotations cannot be returned.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : null}

                    {/* ── Section 3: Reason & Notes ── */}
                    <div className="p-6 space-y-6">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Return Reason</label>
                            <input
                                type="text"
                                value={reason}
                                onChange={e => setReason(e.target.value)}
                                placeholder="e.g., Wrong Size, Damaged on arrival, Customer Choice"
                                className="w-full h-11 px-4 bg-gray-50 border-none rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Internal Notes</label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows="3"
                                placeholder="Any additional internal details..."
                                className="w-full p-4 bg-gray-50 border-none rounded-lg text-sm font-medium text-gray-700 focus:ring-2 focus:ring-rose-500 transition-all"
                            />
                        </div>
                        <div className="space-y-2 pt-4 border-t border-gray-100">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest pl-1">Settlement Method</label>
                            <div className="flex flex-col sm:flex-row gap-4">
                                <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${settlementType === 'ledger' ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                    <input type="radio" name="settlementType" value="ledger" checked={settlementType === 'ledger'} onChange={() => setSettlementType('ledger')} className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-gray-300" />
                                    <div>
                                        <div className="text-sm font-bold text-gray-900">Add to Ledger Balance (Credit)</div>
                                        <div className="text-[10px] font-medium text-gray-500">Refund amount will be added to the outstanding ledger balance.</div>
                                    </div>
                                </label>
                                <label className={`flex-1 flex items-center gap-3 p-4 border rounded-xl cursor-pointer transition-all ${settlementType === 'cash' ? 'border-rose-500 bg-rose-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
                                    <input type="radio" name="settlementType" value="cash" checked={settlementType === 'cash'} onChange={() => setSettlementType('cash')} className="w-4 h-4 text-rose-600 focus:ring-rose-500 border-gray-300" />
                                    <div>
                                        <div className="text-sm font-bold text-gray-900">Immediate Cash Refund</div>
                                        <div className="text-[10px] font-medium text-gray-500">A secondary cash payment entry will be created to settle the return immediately.</div>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>

                    {/* ── Action Bar ── */}
                    <div className="p-6 bg-gray-50 flex items-center justify-between">
                        {/* Refund summary badge */}
                        {returnType === 'customer' && refundTotal > 0 && (
                            <div className="flex items-center gap-2 bg-rose-50 border border-rose-100 rounded-xl px-4 py-2">
                                <span className="text-xs font-black text-rose-600 uppercase tracking-widest">{settlementType === 'cash' ? 'Cash to Pay:' : 'Refund to Ledger:'}</span>
                                <span className="text-lg font-black text-rose-700">₹{refundTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                            </div>
                        )}
                        {returnType !== 'customer' && <span />}
                        <div className="flex items-center space-x-3">
                            <button
                                type="button"
                                onClick={() => navigate('/inventory')}
                                className="px-6 py-2.5 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-8 py-2.5 bg-rose-600 text-white rounded-lg text-xs font-black uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg hover:shadow-rose-100 disabled:opacity-50"
                            >
                                {loading ? 'Processing...' : 'Confirm Stock Return ↩️'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default StockReturn;
