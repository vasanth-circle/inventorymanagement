import { useState, useContext, useMemo } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
const Brands = () => {
    const { brands, categories, addBrand, editBrand, removeBrand, loading, confirmDelete } = useContext(InventoryContext);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBrand, setEditingBrand] = useState(null);
    const [search, setSearch] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [formData, setFormData] = useState({ name: '', description: '', categoryId: '' });

    const filtered = useMemo(() =>
        brands.filter(b => {
            const matchesSearch =
                b.name?.toLowerCase().includes(search.toLowerCase()) ||
                (b.description || '').toLowerCase().includes(search.toLowerCase());
            const matchesCat = filterCategory ? (b.categoryId?._id || b.categoryId) === filterCategory : true;
            return matchesSearch && matchesCat;
        }), [brands, search, filterCategory]);

    const handleOpenModal = (brand = null) => {
        if (brand) {
            setEditingBrand(brand);
            setFormData({
                name: brand.name,
                description: brand.description || '',
                categoryId: brand.categoryId?._id || brand.categoryId || '',
            });
        } else {
            setEditingBrand(null);
            setFormData({ name: '', description: '', categoryId: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingBrand(null);
        setFormData({ name: '', description: '', categoryId: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.categoryId) { toast.error('Please select a category'); return; }
        if (editingBrand) {
            const result = await editBrand(editingBrand._id, formData);
            if (result.success) { handleCloseModal(); toast.success('Brand updated successfully'); }
        } else {
            const result = await addBrand(formData);
            if (result.success) { handleCloseModal(); toast.success('Brand created successfully'); }
        }
    };

    const handleDelete = async (id) => {
        await confirmDelete('Are you sure you want to delete this brand?', async () => {
            await removeBrand(id);
            toast.success('Brand deleted successfully');
        });
    };

    // Helper: avatar color
    const avatarColor = (name = '') => {
        const colors = ['avatar-blue','avatar-purple','avatar-green','avatar-orange','avatar-red','avatar-gray'];
        return colors[(name.charCodeAt(0) || 0) % colors.length];
    };

    return (
        <div className="animate-in space-y-5">
            <div className="page-header">
                <div>
                    <h1 className="page-title">Brands</h1>
                    <p className="page-subtitle">Manage product brands and their associations</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    + Add Brand
                </button>
            </div>

            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{brands.length}</div>
                    <div className="stat-card-label">Total Brands</div>
                </div>
            </div>

            <div className="filter-bar">
                <span style={{color:'#94a3b8',fontSize:'14px',marginLeft:'4px'}}>search</span>
                <input
                    type="text"
                    placeholder="Search brands..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <div style={{width:'1px',height:'20px',background:'#e2e8f0',margin:'0 4px'}}></div>
                <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    style={{border:'none',background:'transparent',fontSize:'13px',color:'#475569',outline:'none',cursor:'pointer'}}
                >
                    <option value="">All Categories</option>
                    {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                </select>
            </div>

            {loading ? (
                <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                    <div style={{width:'40px',height:'40px',border:'3px solid #dbeafe',borderTop:'3px solid #2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="table-wrapper">
                    <EmptyState
                        icon="🏷️"
                        title="No brands found"
                        description="Create your first brand to organize your items."
                        action={<button className="btn-primary" onClick={() => handleOpenModal()}>+ Add Brand</button>}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(brand => (
                        <div key={brand._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`avatar ${avatarColor(brand.name)}`}>
                                        {brand.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm">{brand.name}</h3>
                                        <span className="badge badge-primary mt-1">
                                            {(brand.categoryId?.name) || 'No Category'}
                                        </span>
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn-icon edit" onClick={() => handleOpenModal(brand)} title="Edit">✏️</button>
                                    <button className="btn-icon delete" onClick={() => handleDelete(brand._id)} title="Delete">🗑️</button>
                                </div>
                            </div>
                            {brand.description && (
                                <p className="text-xs text-gray-500 mt-4 line-clamp-2">{brand.description}</p>
                            )}
                        </div>
                    ))}
                </div>
            )}

            <Drawer
                open={isModalOpen}
                onClose={handleCloseModal}
                title={editingBrand ? 'Edit Brand' : 'Add New Brand'}
                size="sm"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" form="brand-form" className="btn-primary">
                            {editingBrand ? 'Update' : 'Save Brand'}
                        </button>
                    </>
                }
            >
                <form id="brand-form" onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Brand Name" required>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Nike, Sony"
                        />
                    </FormField>
                    <FormField label="Parent Category" required>
                        <select
                            required
                            value={formData.categoryId}
                            onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                        >
                            <option value="">Select Category</option>
                            {categories.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
                        </select>
                    </FormField>
                    <FormField label="Description">
                        <textarea
                            rows="3"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description of this brand..."
                        />
                    </FormField>
                </form>
            </Drawer>
        </div>
    );
};

export default Brands;
