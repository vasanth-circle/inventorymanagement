import { useState, useEffect, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { formatCurrency, formatDate, getStockStatusColor, exportToCSV, debounce } from '../utils/helpers';
import toast from 'react-hot-toast';
import SearchableSelect from '../components/SearchableSelect';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';

const Inventory = () => {
    const {
        items, fetchItems, deleteItem, createItem, updateItem,
        categories, locations, fetchLocations, loading, confirmDelete,
        billingSettings, activePreset, hsnCodes, fetchHsnCodes, sizes, brands, finishes
    } = useContext(InventoryContext);
    const [filters, setFilters] = useState({
        search: '',
        category: '',
        status: '',
        location: '',
        page: 1,
        limit: 10,
    });

    const [pagination, setPagination] = useState({ totalPages: 1, currentPage: 1, totalItems: 0 });
    const [editingItem, setEditingItem] = useState(null);
    const [editFormData, setEditFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        price: '',
        purchasePrice: '',
        minStockThreshold: '',
        location: '',
        description: '',
        brand: '',
        partNumber: '',
        size: '',
        hsn: '',
        pcsPerBox: '',
        sqFtPerPc: '',
        unitType: 'box',
    });
    const [editCustomFields, setEditCustomFields] = useState([]);
    const [editLoading, setEditLoading] = useState(false);

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [createFormData, setCreateFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        price: '',
        purchasePrice: '',
        minStockThreshold: '',
        location: '',
        description: '',
        brand: '',
        partNumber: '',
        size: '',
        hsn: '',
        pcsPerBox: '',
        sqFtPerPc: '',
        unitType: 'box',
    });
    const [createCustomFields, setCreateCustomFields] = useState([]);
    const [createLoading, setCreateLoading] = useState(false);

    // Auto-calculate SqFt from Size text ONLY when no managed size selected
    // (Only applies to small numbers that are likely in feet, e.g. '2x4' = 8 sqft)
    // For mm/cm sizes like '2400X800', user should use managed sizes list or enter sqFtPerPc manually
    useEffect(() => {
        if (billingSettings?.industry === 'tiles' && createFormData.size) {
            // Skip auto-calc if a managed size matches (dropdown already handled it)
            if (sizes.find(s => s.name === createFormData.size)) return;
            const parts = createFormData.size.split(/[x*]/i);
            if (parts.length === 2) {
                const w = parseFloat(parts[0]);
                const h = parseFloat(parts[1]);
                // Only auto-calc for feet-range values (< 50), skip mm/cm values like 2400, 800
                if (!isNaN(w) && !isNaN(h) && w < 50 && h < 50) {
                    setCreateFormData(prev => ({ ...prev, sqFtPerPc: (w * h).toFixed(3) }));
                }
            }
        }
    }, [createFormData.size, billingSettings?.industry]);

    useEffect(() => {
        if (billingSettings?.industry === 'tiles' && editFormData.size) {
            // Skip auto-calc if a managed size matches (dropdown already handled it)
            if (sizes.find(s => s.name === editFormData.size)) return;
            const parts = editFormData.size.split(/[x*]/i);
            if (parts.length === 2) {
                const w = parseFloat(parts[0]);
                const h = parseFloat(parts[1]);
                // Only auto-calc for feet-range values (< 50), skip mm/cm values like 2400, 800
                if (!isNaN(w) && !isNaN(h) && w < 50 && h < 50) {
                    setEditFormData(prev => ({ ...prev, sqFtPerPc: (w * h).toFixed(3) }));
                }
            }
        }
    }, [editFormData.size, billingSettings?.industry]);

    useEffect(() => {
        loadItems();
        fetchLocations();
        fetchHsnCodes();
    }, [filters]);

    /**
     * Renders industry-specific fields dynamically
     */
    const renderDynamicFields = (formData, setFormData) => {
        if (!activePreset?.productFields?.length) return null;

        const handleChange = (name, value) => {
            setFormData(prev => ({ ...prev, [name]: value }));
        };

        // Helper: avatar color by category
    const avatarColor = (name = '') => {
        const colors = ['avatar-blue','avatar-purple','avatar-green','avatar-orange','avatar-red','avatar-gray'];
        return colors[(name.charCodeAt(0) || 0) % colors.length];
    };

    return (
        <div className="animate-in space-y-5">
            {/* Page Header */}
            <div className="page-header">
                <div>
                    <h1 className="page-title">Inventory</h1>
                    <p className="page-subtitle">Manage your products, stock levels, and pricing</p>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                    <button className="btn-secondary" onClick={handleExport}>
                        📊 Export CSV
                    </button>
                    <button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>
                        + Add Item
                    </button>
                </div>
            </div>

            {/* Stat Cards */}
            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{pagination.totalItems}</div>
                    <div className="stat-card-label">Total Items</div>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="filter-bar">
                <span style={{color:'#94a3b8',fontSize:'14px',marginLeft:'4px'}}>search</span>
                <input
                    type="text"
                    placeholder="Search by name, barcode..."
                    value={filters.search}
                    onChange={(e) => handleSearch(e.target.value)}
                />

                <select
                    value={filters.category}
                    onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value, page: 1 }))}
                    style={{border:'none',background:'transparent',fontSize:'13px',color:'#475569',outline:'none',cursor:'pointer'}}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
                <div style={{width:'1px',height:'20px',background:'#e2e8f0',margin:'0 4px'}}></div>
                <select
                    value={filters.location}
                    onChange={(e) => setFilters(prev => ({ ...prev, location: e.target.value, page: 1 }))}
                    style={{border:'none',background:'transparent',fontSize:'13px',color:'#475569',outline:'none',cursor:'pointer'}}
                >
                    <option value="">All Locations</option>
                    {locations.map(l => <option key={l._id} value={l._id}>{l.name}</option>)}
                </select>
                <div style={{width:'1px',height:'20px',background:'#e2e8f0',margin:'0 4px'}}></div>
                <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value, page: 1 }))}
                    style={{border:'none',background:'transparent',fontSize:'13px',color:'#475569',outline:'none',cursor:'pointer'}}
                >
                    <option value="">All Statuses</option>
                    <option value="In Stock">In Stock</option>
                    <option value="Low Stock">Low Stock</option>
                    <option value="Out of Stock">Out of Stock</option>
                </select>
            </div>

            {/* Main Table */}
            {loading ? (
                <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                    <div style={{width:'40px',height:'40px',border:'3px solid #dbeafe',borderTop:'3px solid #2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                </div>
            ) : items.length === 0 ? (
                <div className="table-wrapper">
                    <EmptyState
                        icon="📦"
                        title="No items found"
                        description="Try adjusting your search or filters, or add a new item."
                        action={<button className="btn-primary" onClick={() => setIsCreateModalOpen(true)}>+ Add Item</button>}
                    />
                </div>
            ) : (
                <div className="table-wrapper">
                    <table className="table-premium">
                        <thead>
                            <tr>
                                <th>Item Details</th>
                                <th>Category</th>
                                <th style={{textAlign:'center'}}>Stock</th>
                                <th>Price</th>
                                <th>Status</th>
                                <th style={{textAlign:'right'}}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((item) => {
                                const initial = (item.name || 'P').substring(0,2).toUpperCase();
                                return (
                                    <tr key={item._id}>
                                        <td>
                                            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                                                <div className={`avatar ${avatarColor(item.category?.name || '')}`}>{initial}</div>
                                                <div>
                                                    <div style={{fontWeight:'700',color:'#0f172a',fontSize:'14px',display:'flex',alignItems:'center',gap:'6px'}}>
                                                        {item.name}
                                                    </div>
                                                    <div style={{display:'flex',alignItems:'center',gap:'6px',marginTop:'4px',flexWrap:'wrap'}}>
                                                        {item.barcode && <span style={{fontFamily:'monospace',fontSize:'10px',background:'#f8fafc',border:'1px solid #e2e8f0',padding:'2px 6px',borderRadius:'4px',color:'#64748b'}}>{item.barcode}</span>}
                                                        {item.brand && <span className="badge badge-primary">{item.brand}</span>}
                                                        {item.size && <span className="badge badge-purple">{item.size}</span>}
                                                        {item.hsn && <span className="badge badge-gray">HSN:{item.hsn}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td>
                                            <span style={{background:'#f1f5f9',color:'#475569',padding:'4px 8px',borderRadius:'6px',fontSize:'11px',fontWeight:'600'}}>
                                                {item.category?.name || 'Uncategorized'}
                                            </span>
                                        </td>
                                        <td style={{textAlign:'center'}}>
                                            <div style={{fontSize:'14px',fontWeight:'800',color:'#0f172a'}}>{item.quantity}</div>
                                            <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:'700',textTransform:'uppercase'}}>{item.unitType || 'BOX'}</div>
                                        </td>
                                        <td>
                                            <div style={{fontSize:'14px',fontWeight:'800',color:'#0f172a'}}>{formatCurrency(item.price)}</div>
                                            {item.purchasePrice && <div style={{fontSize:'10px',color:'#94a3b8',textDecoration:'line-through'}}>₹{item.purchasePrice}</div>}
                                        </td>
                                        <td>
                                            <span className={`badge ${item.stockStatus === 'In Stock' ? 'badge-success' : item.stockStatus === 'Low Stock' ? 'badge-warning' : 'badge-danger'}`}>
                                                {item.stockStatus}
                                            </span>
                                        </td>
                                        <td style={{textAlign:'right'}}>
                                            <div style={{display:'flex',justifyContent:'flex-end',gap:'4px'}}>
                                                <button className="btn-icon edit" onClick={() => handleEdit(item)} title="Edit">✏️</button>
                                                <button className="btn-icon delete" onClick={() => confirmDelete(item._id)} title="Delete">🗑️</button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    {/* Pagination */}
                    {pagination.totalItems > 0 && (
                        <div className="pagination">
                            <div className="pagination-info">
                                Showing {(pagination.currentPage - 1) * filters.limit + 1}–{Math.min(pagination.currentPage * filters.limit, pagination.totalItems)} of {pagination.totalItems}
                            </div>
                            <div className="pagination-controls">
                                <button className="page-btn" onClick={() => handlePageChange(pagination.currentPage - 1)} disabled={pagination.currentPage === 1}>‹</button>
                                <span className="page-btn active">{pagination.currentPage} / {pagination.totalPages}</span>
                                <button className="page-btn" onClick={() => handlePageChange(pagination.currentPage + 1)} disabled={pagination.currentPage === pagination.totalPages}>›</button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Create Item Drawer */}
            <Drawer
                open={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Add New Item"
                subtitle="Fill in the details to add a new inventory item"
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Cancel</button>
                        <button type="submit" form="create-item-form" className="btn-primary" disabled={createLoading}>
                            {createLoading ? 'Adding...' : '+ Add Item'}
                        </button>
                    </>
                }
            >
                <form id="create-item-form" onSubmit={handleCreateSubmit}>
                    <FormSection icon="📦" title="Basic Information" color="#eff6ff">
                        <div className="form-grid-2">
                            <FormField label="Item Name" required>
                                <input required type="text" value={createFormData.name} onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })} placeholder="e.g. Premium Floor Tile" />
                            </FormField>
                            <FormField label="Category" required>
                                <select required value={createFormData.category} onChange={(e) => setCreateFormData({ ...createFormData, category: e.target.value })}>
                                    <option value="">Select Category</option>
                                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Selling Price (₹)" required>
                                <input required type="number" step="0.01" value={createFormData.price} onChange={(e) => setCreateFormData({ ...createFormData, price: e.target.value })} placeholder="0.00" />
                            </FormField>
                            <FormField label="Purchase Price (₹)">
                                <input type="number" step="0.01" value={createFormData.purchasePrice} onChange={(e) => setCreateFormData({ ...createFormData, purchasePrice: e.target.value })} placeholder="0.00" />
                            </FormField>
                            <FormField label="Barcode">
                                <input type="text" value={createFormData.barcode} onChange={(e) => setCreateFormData({ ...createFormData, barcode: e.target.value })} placeholder="Scan or type barcode" />
                            </FormField>
                            <FormField label="Description" className="form-full">
                                <textarea rows="2" value={createFormData.description} onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })} placeholder="Item details..." />
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="📊" title="Stock Settings" color="#f0fdf4">
                        <div className="form-grid-3">
                            <FormField label="Min Stock Threshold">
                                <input type="number" value={createFormData.minStockThreshold} onChange={(e) => setCreateFormData({ ...createFormData, minStockThreshold: e.target.value })} placeholder="10" />
                            </FormField>
                            <FormField label="Base Unit Type">
                                <select value={createFormData.unitType} onChange={(e) => setCreateFormData({ ...createFormData, unitType: e.target.value })}>
                                    <option value="box">Box</option>
                                    <option value="pcs">Pieces (Pcs)</option>
                                    <option value="sqft">Sq.Ft</option>
                                    <option value="kg">Kilograms (Kg)</option>
                                    <option value="meters">Meters (M)</option>
                                </select>
                            </FormField>
                            <FormField label="Location">
                                <select value={createFormData.location} onChange={(e) => setCreateFormData({ ...createFormData, location: e.target.value })}>
                                    <option value="">Select Location</option>
                                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                                </select>
                            </FormField>
                        </div>
                    </FormSection>

                    {renderDynamicFields(createFormData, setCreateFormData)}
                </form>
            </Drawer>

            {/* Edit Item Drawer */}
            <Drawer
                open={!!editingItem}
                onClose={() => setEditingItem(null)}
                title="Edit Item"
                subtitle={editingItem ? `Editing details for ${editingItem.name}` : ''}
                size="lg"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={() => setEditingItem(null)}>Cancel</button>
                        <button type="submit" form="edit-item-form" className="btn-primary" disabled={editLoading}>
                            {editLoading ? 'Saving...' : '✓ Save Changes'}
                        </button>
                    </>
                }
            >
                <form id="edit-item-form" onSubmit={handleUpdateSubmit}>
                    <FormSection icon="📦" title="Basic Information" color="#eff6ff">
                        <div className="form-grid-2">
                            <FormField label="Item Name" required>
                                <input required type="text" value={editFormData.name} onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })} placeholder="e.g. Premium Floor Tile" />
                            </FormField>
                            <FormField label="Category" required>
                                <select required value={editFormData.category} onChange={(e) => setEditFormData({ ...editFormData, category: e.target.value })}>
                                    <option value="">Select Category</option>
                                    {categories.map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
                                </select>
                            </FormField>
                            <FormField label="Selling Price (₹)" required>
                                <input required type="number" step="0.01" value={editFormData.price} onChange={(e) => setEditFormData({ ...editFormData, price: e.target.value })} placeholder="0.00" />
                            </FormField>
                            <FormField label="Purchase Price (₹)">
                                <input type="number" step="0.01" value={editFormData.purchasePrice} onChange={(e) => setEditFormData({ ...editFormData, purchasePrice: e.target.value })} placeholder="0.00" />
                            </FormField>
                            <FormField label="Barcode">
                                <input type="text" value={editFormData.barcode} onChange={(e) => setEditFormData({ ...editFormData, barcode: e.target.value })} placeholder="Scan or type barcode" />
                            </FormField>
                            <FormField label="Description" className="form-full">
                                <textarea rows="2" value={editFormData.description} onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })} placeholder="Item details..." />
                            </FormField>
                        </div>
                    </FormSection>

                    <FormSection icon="📊" title="Stock Settings" color="#f0fdf4">
                        <div className="form-grid-3">
                            <FormField label="Min Stock Threshold">
                                <input type="number" value={editFormData.minStockThreshold} onChange={(e) => setEditFormData({ ...editFormData, minStockThreshold: e.target.value })} placeholder="10" />
                            </FormField>
                            <FormField label="Base Unit Type">
                                <select value={editFormData.unitType} onChange={(e) => setEditFormData({ ...editFormData, unitType: e.target.value })}>
                                    <option value="box">Box</option>
                                    <option value="pcs">Pieces (Pcs)</option>
                                    <option value="sqft">Sq.Ft</option>
                                    <option value="kg">Kilograms (Kg)</option>
                                    <option value="meters">Meters (M)</option>
                                </select>
                            </FormField>
                            <FormField label="Location">
                                <select value={editFormData.location} onChange={(e) => setEditFormData({ ...editFormData, location: e.target.value })}>
                                    <option value="">Select Location</option>
                                    {locations.map((l) => <option key={l._id} value={l._id}>{l.name}</option>)}
                                </select>
                            </FormField>
                        </div>
                    </FormSection>

                    {renderDynamicFields(editFormData, setEditFormData)}
                </form>
            </Drawer>
        </div>
    );
};

export default Inventory;
