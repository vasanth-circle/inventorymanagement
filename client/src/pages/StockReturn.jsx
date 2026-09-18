import { useState, useEffect, useRef, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import toast from 'react-hot-toast';
import { InventoryContext } from '../context/InventoryContext';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';

// â”€â”€ Searchable Select Component (inline, lightweight) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
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
                <span className="text-gray-400 text-xs">{open ? 'â–²' : 'â–¼'}</span>
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

// â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const StockReturn = () => {
    const navigate = useNavigate();
    const { billingSettings, calculateItemValues } = useContext(InventoryContext);
    const [loading, setLoading] = useState(false);
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [allItems, setAllItems] = useState([]);

    const [activeTab, setActiveTab] = useState('new');
    const [returns, setReturns] = useState([]);
    const [loadingReturns, setLoadingReturns] = useState(false);

    // Step state
    const [returnType, setReturnType] = useState('customer');
    const [selectedCustomer, setSelectedCustomer] = useState('');
    const [selectedVendor, setSelectedVendor] = useState('');

    // Bills (invoices only â€” not quotations)
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
            const [custRes, vendRes, itemsRes, returnsRes] = await Promise.allSettled([
                api.get('/customers?limit=5000'),
                api.get('/vendors?limit=1000'),
                api.get('/items?limit=5000'),
                api.get('/transactions?type=return&limit=100')
            ]);
            
            if (custRes.status === 'fulfilled') setCustomers(custRes.value.data.data?.customers || []);
            if (vendRes.status === 'fulfilled') setVendors(vendRes.value.data.data?.vendors || []);
            if (itemsRes.status === 'fulfilled') setAllItems(itemsRes.value.data.items || itemsRes.value.data.data?.items || []);
            if (returnsRes.status === 'fulfilled') setReturns(returnsRes.value.data.data?.transactions || returnsRes.value.data.data || []);

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

    // When an invoice is selected â€” populate return items table
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
                price: lineItem.price || 0,
                returnQty: '',
                pcsPerBox: lineItem.item?.pcsPerBox || 1,
                sqFtPerPc: lineItem.item?.sqFtPerPc || 0,
                unitType: lineItem.item?.unitType || 'pieces',
                total: 0,
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
            const poNumber = po.vendorBillNumber || po.orderNumber;
            const newRows = po.items.map(lineItem => {
                const itemId = lineItem.item?._id || lineItem.item;
                return {
                    itemId: itemId,
                    itemName: lineItem.name || lineItem.item?.name || '',
                    brand: lineItem.brand || lineItem.item?.brand || '',
                    size: lineItem.size || lineItem.item?.size || '',
                    hsn: lineItem.hsn || lineItem.item?.hsn || lineItem.item?.hsnCode || '',
                    billingUnit: lineItem.billingUnit || lineItem.item?.unitType || lineItem.item?.billingUnit || 'Nos',
                    taxRate: lineItem.taxRate || lineItem.item?.taxRate || 0,
                    billedQty: lineItem.quantity || 0,
                    rate: lineItem.price || 0,
                    price: lineItem.price || 0,
                    returnQty: '',
                    pcsPerBox: lineItem.item?.pcsPerBox || 1,
                    sqFtPerPc: lineItem.item?.sqFtPerPc || 0,
                    unitType: lineItem.item?.unitType || 'pieces',
                    total: 0,
                    isManual: false,
                    poNumber: poNumber,
                    poId: po._id,
                    uniqueId: `po-${po._id}-item-${itemId}`
                };
            });
            const filteredNewRows = newRows.filter(r => !returnItems.find(existing => existing.uniqueId === r.uniqueId));
            setReturnItems([...returnItems, ...filteredNewRows]);
        }
    };

    const handleVendorItemSelect = (val) => {
        if (!val) return;
        
        const selectedVendorItem = allVendorItems.find(vi => vi.uniqueId === val);
        
        if (selectedVendorItem) {
            if (returnItems.find(r => r.uniqueId === val)) {
                toast.error('Item from this bill is already added');
                return;
            }
            const newRow = {
                itemId: selectedVendorItem.itemId,
                itemName: selectedVendorItem.itemName,
                brand: selectedVendorItem.brand,
                size: selectedVendorItem.size,
                hsn: selectedVendorItem.hsn,
                billingUnit: selectedVendorItem.billingUnit,
                taxRate: selectedVendorItem.taxRate,
                billedQty: selectedVendorItem.billedQty,
                rate: selectedVendorItem.rate,
                price: selectedVendorItem.price,
                pcsPerBox: selectedVendorItem.pcsPerBox,
                sqFtPerPc: selectedVendorItem.sqFtPerPc,
                unitType: selectedVendorItem.unitType,
                total: 0,
                returnQty: '',
                isManual: false,
                poNumber: selectedVendorItem.poNumber,
                poId: selectedVendorItem.poId,
                uniqueId: selectedVendorItem.uniqueId
            };
            setReturnItems([...returnItems, newRow]);
        } else {
            const selectedItem = allItems.find(i => i._id === val) || {};
            
            if (returnItems.find(r => r.itemId === val && r.isManual)) {
                toast.error('Manual item already added to return list');
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
                price: 0,
                returnQty: '',
                pcsPerBox: selectedItem.pcsPerBox || 1,
                sqFtPerPc: selectedItem.sqFtPerPc || 0,
                unitType: selectedItem.unitType || 'pieces',
                total: 0,
                isManual: true,
                uniqueId: `manual-${selectedItem._id}`
            };
            setReturnItems([...returnItems, newRow]);
        }
    };

    const handleReturnQtyChange = (index, value) => {
        const updated = [...returnItems];
        let row = { ...updated[index], returnQty: value };
        
        if (returnType === 'vendor') {
            row.quantity = parseFloat(value) || 0;
            if (billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0) {
                 row.boxCount = parseFloat(value) || 0;
            }
            row.total = row.quantity * (row.rate || 0);
        } else if (!row.isManual && billingSettings?.industry) {
            const isTile = billingSettings.industry === 'tiles' && row.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((row.unitType || '').toLowerCase());
            
            if (isTile) {
                row.boxCount = parseFloat(value) || 0;
                row = calculateItemValues(row, 'boxCount', row.boxCount, billingSettings.industry);
            } else {
                row.quantity = parseFloat(value) || 0;
                row = calculateItemValues(row, 'quantity', row.quantity, billingSettings.industry);
            }
        } else {
            row.total = (parseFloat(value) || 0) * (row.rate || 0);
        }
        
        updated[index] = row;
        setReturnItems(updated);
    };

    const handleRateChange = (index, value) => {
        const updated = [...returnItems];
        const newRate = parseFloat(value) || 0;
        let row = { ...updated[index], rate: newRate, price: newRate };
        
        if (returnType === 'vendor') {
            row.quantity = parseFloat(row.returnQty) || 0;
            row.total = row.quantity * newRate;
        } else if (!row.isManual && billingSettings?.industry) {
            const isTile = billingSettings.industry === 'tiles' && row.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((row.unitType || '').toLowerCase());
            
            if (isTile) {
                row.boxCount = parseFloat(row.returnQty) || 0;
            } else {
                row.quantity = parseFloat(row.returnQty) || 0;
            }
            row = calculateItemValues(row, 'price', newRate, billingSettings.industry);
        } else {
            row.total = (parseFloat(row.returnQty) || 0) * newRate;
        }
        
        updated[index] = row;
        setReturnItems(updated);
    };

    const removeReturnItem = (index) => {
        const updated = [...returnItems];
        updated.splice(index, 1);
        setReturnItems(updated);
    };

    // Calculate total refund amount
    const refundTotal = returnItems.reduce((sum, row) => {
        return sum + (row.total || 0);
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
                    const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((row.unitType || '').toLowerCase());
                    const actualQty = isTile ? row.quantity : parseFloat(row.returnQty);
                    const actualTotal = row.total !== undefined ? row.total : (actualQty * row.rate);
                    
                    await api.post('/transactions/return', {
                        item: row.itemId,
                        returnType: 'customer',
                        quantity: actualQty,
                        rate: row.rate,
                        total: actualTotal,
                        reason,
                        notes,
                        customer: selectedCustomer,
                        referenceOrder,
                        settlementType,
                    });
                }
                toast.success(`Return recorded! â‚¹${refundTotal.toLocaleString('en-IN')} refunded to customer ledger.`);
                if (window.confirm('Return recorded successfully! Would you like to print the return slip?')) {
                    const returnTx = {
                        returnType: 'customer',
                        customer: customers.find(c => c._id === selectedCustomer),
                        createdAt: new Date(),
                        quantity: itemsToReturn.reduce((sum, r) => sum + parseFloat(r.returnQty), 0),
                        referenceOrder,
                        reason,
                        notes,
                        items: itemsToReturn.map(r => {
                            const isTile = billingSettings?.industry === 'tiles' && r.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((r.unitType || '').toLowerCase());
                            const actualQty = isTile ? r.quantity : parseFloat(r.returnQty);
                            return {
                                name: r.itemName,
                                brand: r.brand,
                                size: r.size,
                                hsnCode: r.hsn,
                                billingUnit: r.billingUnit,
                                taxRate: r.taxRate,
                                quantity: actualQty,
                                boxCount: isTile ? parseFloat(r.returnQty) : undefined,
                                price: r.rate,
                                total: r.total || (actualQty * r.rate)
                            };
                        })
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
                    const isTile = billingSettings?.industry === 'tiles' && row.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((row.unitType || '').toLowerCase());
                    const actualQty = isTile ? row.quantity : parseFloat(row.returnQty);
                    const actualTotal = row.total !== undefined ? row.total : (actualQty * (row.rate || 0));

                    await api.post('/transactions/return', {
                        item: row.itemId,
                        returnType: 'vendor',
                        quantity: actualQty,
                        rate: row.rate || 0,
                        total: actualTotal,
                        vendor: selectedVendor,
                        referenceOrder: row.poNumber || referenceOrder,
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
                        items: itemsToReturn.map(r => {
                            const isTile = billingSettings?.industry === 'tiles' && r.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((r.unitType || '').toLowerCase());
                            const actualQty = isTile ? r.quantity : parseFloat(r.returnQty);
                            return {
                                name: r.itemName,
                                brand: r.brand,
                                size: r.size,
                                hsnCode: r.hsn,
                                billingUnit: r.billingUnit,
                                taxRate: r.taxRate,
                                quantity: actualQty,
                                boxCount: isTile ? parseFloat(r.returnQty) : undefined,
                                price: r.rate,
                                total: r.total || (actualQty * r.rate)
                            };
                        })
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
        label: `${c.companyName || c.name}${c.phone ? ` â€” ${c.phone}` : ''}`,
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
        label: `${inv.orderNumber}  â€¢  ${new Date(inv.orderDate).toLocaleDateString('en-IN')}  â€¢  â‚¹${(inv.totalAmount || 0).toLocaleString('en-IN')}`,
    }));

    const poOptions = purchaseOrders.map(po => ({
        value: po._id,
        label: `${po.vendorBillNumber ? `Bill: ${po.vendorBillNumber}` : `PO: ${po.orderNumber}`}  â€¢  ${new Date(po.orderDate || po.createdAt).toLocaleDateString('en-IN')}  â€¢  â‚¹${(po.totalAmount || 0).toLocaleString('en-IN')}`
    }));

    const allVendorItems = purchaseOrders.flatMap(po => 
        po.items.map(i => {
            const item = allItems.find(ai => ai._id === (i.item?._id || i.item));
            return {
                poId: po._id,
                poNumber: po.vendorBillNumber || po.orderNumber,
                itemId: item?._id || i.item,
                itemName: item?.name || i.name,
                brand: item?.brand || '',
                size: item?.size || '',
                hsn: item?.hsn || item?.hsnCode || '',
                billingUnit: item?.unitType || item?.billingUnit || 'Nos',
                taxRate: item?.taxRate || 0,
                billedQty: i.quantity,
                rate: i.price,
                price: i.price,
                pcsPerBox: item?.pcsPerBox || 1,
                sqFtPerPc: item?.sqFtPerPc || 0,
                unitType: item?.unitType || 'pieces',
                total: 0,
                uniqueId: `po-${po._id}-item-${item?._id || i.item}`
            };
        })
    );

    const vendorItemOptions = [
        ...allVendorItems.map(vi => ({
            value: vi.uniqueId,
            label: `${vi.itemName} ${vi.brand ? `(${vi.brand})` : ''} - Bill: ${vi.poNumber} - Qty: ${vi.billedQty}`
        })),
        ...allItems.map(i => ({ 
            value: i._id, 
            label: `${i.name} (${i.brand || ''} - ${i.size || ''}) (Manual)` 
        }))
    ];

    return (
        <div className="animate-in space-y-5">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Stock Returns</h1>
                    <p className="page-subtitle">Manage customer returns and refunds</p>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{returns.length}</div>
                    <div className="stat-card-label">Total Returns</div>
                </div>
                <div className="stat-card">
                    <div className="stat-card-value text-green-600">
                        {'Rs.'}{(returns.filter(r => r.returnType === 'customer').reduce((sum, r) => sum + (r.total || 0), 0) / 1000).toFixed(1)}k
                    </div>
                    <div className="stat-card-label">Total Refunded</div>
                </div>
            </div>

            {/* Main Tabs */}
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="tab-bar">
                    <button className={`tab-btn ${activeTab === 'new' ? 'active' : ''}`} onClick={() => setActiveTab('new')}>
                        + New Return
                    </button>
                    <button className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                        Return History
                    </button>
                </div>
            </div>

            {/* --- NEW RETURN TAB --- */}
            {activeTab === 'new' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <FormSection icon="🧑" title="Customer & Invoice Selection" color="#eff6ff">
                        <div className="form-grid-2">
                            <FormField label="Select Ledger Name" required>
                                <SearchableDropdown
                                    options={customers.map(c => ({ value: c._id, label: `${c.companyName || c.name} - ${c.phone}` }))}
                                    value={selectedCustomer}
                                    onChange={setSelectedCustomer}
                                    placeholder="Search Customer..."
                                />
                            </FormField>
                            <FormField label="Select Invoice" required>
                                <select
                                    value={selectedInvoice}
                                    onChange={(e) => handleInvoiceSelect(e.target.value)}
                                    disabled={!selectedCustomer || loadingInvoices}
                                    className="w-full h-11 px-4 bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-rose-500"
                                >
                                    <option value="">{loadingInvoices ? 'Loading...' : 'Select Invoice'}</option>
                                    {invoices.map(inv => (
                                        <option key={inv._id} value={inv._id}>{inv.orderNumber} ({new Date(inv.orderDate).toLocaleDateString()}) - Rs.{inv.totalAmount}</option>
                                    ))}
                                </select>
                            </FormField>
                        </div>
                    </FormSection>

                    {selectedInvoice && (
                        <FormSection icon="📦" title="Select Items to Return" color="#faf5ff">
                            <div className="table-wrapper">
                                <table className="table-premium">
                                    <thead>
                                        <tr>
                                            <th>Item Details</th>
                                            <th className="text-center">Billed Qty</th>
                                            <th className="text-right">Price</th>
                                            <th className="text-center">Return Qty</th>
                                            <th className="text-right">Refund Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {returnItems.map((item, idx) => {
                                            const isTile = billingSettings?.industry === 'tiles' && item.sqFtPerPc > 0 && !['pieces', 'pcs', 'nos', 'piece'].includes((item.unitType || '').toLowerCase());
                                            return (
                                                <tr key={idx}>
                                                    <td>
                                                        <div className="font-bold text-gray-900">{item.itemName}</div>
                                                        <div className="text-[10px] text-gray-500 mt-1">
                                                            {item.brand && <span className="mr-2">Brand: {item.brand}</span>}
                                                            {item.size && <span>Size: {item.size}</span>}
                                                        </div>
                                                    </td>
                                                    <td className="text-center">
                                                        <div className="font-bold">{item.billedQty} {isTile ? 'Boxes' : item.unitType}</div>
                                                        {isTile && <div className="text-[10px] text-gray-400">{(item.billedQty * item.sqFtPerPc * item.pcsPerBox).toFixed(2)} sqft</div>}
                                                    </td>
                                                    <td className="text-right font-medium">Rs.{item.rate}</td>
                                                    <td className="w-40 text-center">
                                                        <input
                                                            type="number"
                                                            min="0"
                                                            max={item.billedQty}
                                                            step="0.01"
                                                            value={item.returnQty}
                                                            onChange={(e) => handleReturnQtyChange(idx, e.target.value)}
                                                            className="w-full text-center py-2 px-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                                        />
                                                    </td>
                                                    <td className="text-right font-bold text-green-600">
                                                        Rs.{item.total > 0 ? item.total.toFixed(2) : '0.00'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="mt-6">
                                <FormSection icon="💰" title="Return Summary" color="#fef9c3">
                                    <div className="form-grid-2">
                                        <FormField label="Reason for Return" required className="form-full">
                                            <textarea rows="2" value={reason} onChange={e => setReason(e.target.value)} placeholder="e.g. Damaged, Excess quantity" />
                                        </FormField>
                                        <FormField label="Additional Notes" className="form-full">
                                            <textarea rows="2" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Optional internal notes" />
                                        </FormField>
                                        <div className="bg-green-50 p-4 rounded-xl border border-green-100 flex justify-between items-center form-full">
                                            <span className="font-bold text-green-800">Total Refund Amount:</span>
                                            <span className="text-2xl font-black text-green-600">Rs.{refundTotal.toLocaleString('en-IN')}</span>
                                        </div>
                                    </div>
                                    <div className="mt-6 flex justify-end">
                                        <button onClick={handleSubmit} disabled={loading} className="btn-primary" style={{background:'#10b981'}}>
                                            {loading ? 'Processing...' : '✓ Confirm & Record Return'}
                                        </button>
                                    </div>
                                </FormSection>
                            </div>
                        </FormSection>
                    )}
                </div>
            )}

            {/* --- HISTORY TAB --- */}
            {activeTab === 'history' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    {loadingReturns ? (
                        <div className="flex justify-center items-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                        </div>
                    ) : returns.length === 0 ? (
                        <EmptyState icon="📦" title="No returns found" description="You have not processed any returns yet." />
                    ) : (
                        <div className="table-wrapper">
                            <table className="table-premium">
                                <thead>
                                    <tr>
                                        <th>Date</th>
                                        <th>Ledger Name</th>
                                        <th>Items Returned</th>
                                        <th className="text-right">Refund Amount</th>
                                        <th>Reason</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {returns.map(r => (
                                        <tr key={r._id}>
                                            <td className="text-sm font-medium">{new Date(r.createdAt).toLocaleDateString()}</td>
                                            <td>
                                                <div className="font-bold text-gray-900">{r.customer?.companyName || r.customer?.name || r.vendor?.companyName || r.vendor?.name}</div>
                                                <div className="text-xs text-gray-500">Ref: {r.referenceOrder}</div>
                                            </td>
                                            <td>
                                                <span className="badge badge-primary">{r.quantity} qty</span>
                                            </td>
                                            <td className="text-right font-bold text-green-600">
                                                Rs.{r.total?.toLocaleString('en-IN')}
                                            </td>
                                            <td className="text-xs text-gray-600">{r.reason}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default StockReturn;
