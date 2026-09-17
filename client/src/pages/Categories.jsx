import { useState, useContext, useMemo } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';
import Drawer from '../components/ui/Drawer';
import FormField, { FormSection } from '../components/ui/FormField';
import EmptyState from '../components/ui/EmptyState';
const Categories = () => {
    const { categories, addCategory, editCategory, removeCategory, loading, confirmDelete } = useContext(InventoryContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '' });
    const [search, setSearch] = useState('');

    const filtered = useMemo(() =>
        categories.filter(c =>
            c.name.toLowerCase().includes(search.toLowerCase()) ||
            (c.description || '').toLowerCase().includes(search.toLowerCase())
        ), [categories, search]);

    const handleOpenModal = (category = null) => {
        if (category) {
            setEditingCategory(category);
            setFormData({ name: category.name, description: category.description || '' });
        } else {
            setEditingCategory(null);
            setFormData({ name: '', description: '' });
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setEditingCategory(null);
        setFormData({ name: '', description: '' });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (editingCategory) {
            const result = await editCategory(editingCategory._id, formData);
            if (result.success) { handleCloseModal(); toast.success('Category updated successfully'); }
        } else {
            const result = await addCategory(formData);
            if (result.success) { handleCloseModal(); toast.success('Category created successfully'); }
        }
    };

    const handleDelete = async (id) => {
        await confirmDelete('Are you sure you want to delete this category?', async () => {
            await removeCategory(id);
            toast.success('Category deleted successfully');
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
                    <h1 className="page-title">Categories</h1>
                    <p className="page-subtitle">Manage item classifications and groups</p>
                </div>
                <button className="btn-primary" onClick={() => handleOpenModal()}>
                    + Add Category
                </button>
            </div>

            <div className="stat-cards">
                <div className="stat-card">
                    <div className="stat-card-value">{categories.length}</div>
                    <div className="stat-card-label">Total Categories</div>
                </div>
            </div>

            <div className="filter-bar">
                <span style={{color:'#94a3b8',fontSize:'14px',marginLeft:'4px'}}>search</span>
                <input
                    type="text"
                    placeholder="Search categories..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {loading ? (
                <div className="table-wrapper" style={{display:'flex',justifyContent:'center',alignItems:'center',height:'240px'}}>
                    <div style={{width:'40px',height:'40px',border:'3px solid #dbeafe',borderTop:'3px solid #2563eb',borderRadius:'50%',animation:'spin 0.8s linear infinite'}}></div>
                </div>
            ) : filtered.length === 0 ? (
                <div className="table-wrapper">
                    <EmptyState
                        icon="📁"
                        title="No categories found"
                        description="Create your first category to organize your items."
                        action={<button className="btn-primary" onClick={() => handleOpenModal()}>+ Add Category</button>}
                    />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map(cat => (
                        <div key={cat._id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`avatar ${avatarColor(cat.name)}`}>
                                        {cat.name.substring(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-gray-900 text-sm">{cat.name}</h3>
                                        {cat.description && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{cat.description}</p>}
                                    </div>
                                </div>
                                <div className="flex gap-2">
                                    <button className="btn-icon edit" onClick={() => handleOpenModal(cat)} title="Edit">✏️</button>
                                    <button className="btn-icon delete" onClick={() => handleDelete(cat._id)} title="Delete">🗑️</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Drawer
                open={isModalOpen}
                onClose={handleCloseModal}
                title={editingCategory ? 'Edit Category' : 'Add New Category'}
                size="sm"
                footer={
                    <>
                        <button type="button" className="btn-secondary" onClick={handleCloseModal}>Cancel</button>
                        <button type="submit" form="category-form" className="btn-primary">
                            {editingCategory ? 'Update' : 'Save Category'}
                        </button>
                    </>
                }
            >
                <form id="category-form" onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Category Name" required>
                        <input
                            type="text"
                            required
                            autoFocus
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g. Electronics, Building Materials"
                        />
                    </FormField>
                    <FormField label="Description">
                        <textarea
                            rows="3"
                            value={formData.description}
                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                            placeholder="Brief description of this category..."
                        />
                    </FormField>
                </form>
            </Drawer>
        </div>
    );
};

export default Categories;
