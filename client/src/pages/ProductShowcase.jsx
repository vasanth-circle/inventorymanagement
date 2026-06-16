import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ProductShowcase() {
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();

    const [showcases, setShowcases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingShowcase, setEditingShowcase] = useState(null);
    const [formData, setFormData] = useState({ name: '', description: '', isActive: true });
    const [images, setImages] = useState([]);
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [qrModal, setQrModal] = useState(null); // { showcase, qrCode, url }
    const [qrLoading, setQrLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const isAdmin = ['admin', 'tenant_admin', 'tenant_owner', 'super_admin'].includes(user?.role);
    const canManage = isAdmin || user?.role === 'manager';

    const getHeaders = () => ({
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        'x-tenant-id': user?.tenantId,
    });

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchShowcases = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_BASE}/product-showcase`, { headers: getHeaders() });
            setShowcases(data.data || []);
        } catch (err) {
            toast.error('Failed to load showcases');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchShowcases(); }, []);

    // ── Modal helpers ──────────────────────────────────────────────────────────
    const openCreateModal = () => {
        setEditingShowcase(null);
        setFormData({ name: '', description: '', isActive: true });
        setImages([]);
        setShowModal(true);
    };

    const openEditModal = (showcase) => {
        setEditingShowcase(showcase);
        setFormData({ name: showcase.name, description: showcase.description || '', isActive: showcase.isActive });
        setImages([]);
        setShowModal(true);
    };

    const closeModal = () => { setShowModal(false); setEditingShowcase(null); };

    // ── Save (create / update) ─────────────────────────────────────────────────
    const handleSave = async () => {
        if (!formData.name.trim()) { toast.error('Name is required'); return; }
        try {
            setSaving(true);
            
            const payload = new FormData();
            payload.append('name', formData.name);
            payload.append('description', formData.description);
            payload.append('isActive', formData.isActive);
            if (images && images.length > 0) {
                images.forEach(img => payload.append('images', img));
            }

            if (editingShowcase) {
                await axios.put(`${API_BASE}/product-showcase/${editingShowcase._id}`, payload, { headers: getHeaders() });
                toast.success('Showcase updated!');
            } else {
                await axios.post(`${API_BASE}/product-showcase`, payload, { headers: getHeaders() });
                toast.success('Showcase created!');
            }
            closeModal();
            fetchShowcases();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to save showcase');
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await axios.delete(`${API_BASE}/product-showcase/${deleteTarget._id}`, { headers: getHeaders() });
            toast.success('Showcase deleted');
            setDeleteTarget(null);
            fetchShowcases();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to delete');
        }
    };

    // ── Toggle Active ──────────────────────────────────────────────────────────
    const toggleActive = async (showcase) => {
        try {
            await axios.put(`${API_BASE}/product-showcase/${showcase._id}`, { isActive: !showcase.isActive }, { headers: getHeaders() });
            fetchShowcases();
        } catch {
            toast.error('Failed to update status');
        }
    };

    // ── QR Code ───────────────────────────────────────────────────────────────
    const openQR = async (showcase) => {
        try {
            setQrLoading(true);
            setQrModal({ showcase, qrCode: null, url: null });
            const { data } = await axios.get(`${API_BASE}/product-showcase/${showcase._id}/qrcode`, { headers: getHeaders() });
            setQrModal({ showcase, qrCode: data.qrCode, url: data.url });
        } catch {
            toast.error('Failed to generate QR code');
            setQrModal(null);
        } finally {
            setQrLoading(false);
        }
    };

    const downloadQR = () => {
        if (!qrModal?.qrCode) return;
        const a = document.createElement('a');
        a.href = qrModal.qrCode;
        a.download = `qr-${qrModal.showcase.slug}.png`;
        a.click();
    };

    const copyLink = () => {
        if (!qrModal?.url) return;
        navigator.clipboard.writeText(qrModal.url);
        toast.success('Link copied to clipboard!');
    };

    const shareWhatsApp = () => {
        if (!qrModal?.url) return;
        window.open(`https://wa.me/?text=${encodeURIComponent(`Check out this product: ${qrModal.url}`)}`, '_blank');
    };

    const shareEmail = () => {
        if (!qrModal?.url) return;
        window.open(`mailto:?subject=Product Showcase&body=${encodeURIComponent(`Check out this product: ${qrModal.url}`)}`, '_blank');
    };

    // ── Filtered list ──────────────────────────────────────────────────────────
    const filtered = showcases.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.slug.toLowerCase().includes(searchTerm.toLowerCase())
    );

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">QR Showcase</h1>
                    <p className="text-sm text-gray-500 mt-1">Create product galleries with scannable QR codes</p>
                </div>
                {canManage && (
                    <button
                        id="create-showcase-btn"
                        onClick={openCreateModal}
                        className="inline-flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors shadow-sm"
                    >
                        <span className="text-lg leading-none">+</span> New Showcase
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <span className="absolute inset-y-0 left-3 flex items-center text-gray-400 pointer-events-none">🔍</span>
                <input
                    type="text"
                    placeholder="Search showcases…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-gray-800 dark:border-gray-700 dark:text-white"
                />
            </div>

            {/* Table */}
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-48 text-gray-400">
                        <div className="animate-spin text-3xl">⏳</div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-48 text-gray-400 gap-2">
                        <span className="text-4xl">📱</span>
                        <p className="text-sm">{searchTerm ? 'No showcases match your search' : 'No showcases yet — create one!'}</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-300">Name</th>
                                    <th className="text-left px-5 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden md:table-cell">Slug</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Images</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300 hidden sm:table-cell">Scans</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Status</th>
                                    <th className="text-center px-4 py-3 font-semibold text-gray-600 dark:text-gray-300">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.map((s) => (
                                    <tr key={s._id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                                        <td className="px-5 py-3 font-medium text-gray-900 dark:text-white">
                                            <div>{s.name}</div>
                                            {s.description && <div className="text-xs text-gray-400 truncate max-w-[200px]">{s.description}</div>}
                                        </td>
                                        <td className="px-5 py-3 hidden md:table-cell">
                                            <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 px-2 py-0.5 rounded">{s.slug}</span>
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="inline-flex items-center gap-1 text-gray-600 dark:text-gray-300">
                                                <span>🖼️</span> {s.images?.length || 0}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center hidden sm:table-cell text-gray-600 dark:text-gray-300">
                                            {s.scanCount || 0}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            {canManage ? (
                                                <button
                                                    onClick={() => toggleActive(s)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${s.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                                                >
                                                    {s.isActive ? '✅ Active' : '⭕ Inactive'}
                                                </button>
                                            ) : (
                                                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                    {s.isActive ? 'Active' : 'Inactive'}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center justify-center gap-2 flex-wrap">
                                                {/* QR Code */}
                                                <button
                                                    title="View QR Code"
                                                    onClick={() => openQR(s)}
                                                    className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded-lg transition-colors"
                                                >📱</button>
                                                {/* Manage Images */}
                                                {canManage && (
                                                    <button
                                                        title="Manage Images"
                                                        onClick={() => navigate(`/product-showcase/${s._id}/images`)}
                                                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                                    >🖼️</button>
                                                )}
                                                {/* Edit */}
                                                {canManage && (
                                                    <button
                                                        title="Edit"
                                                        onClick={() => openEditModal(s)}
                                                        className="p-1.5 text-amber-500 hover:bg-amber-50 rounded-lg transition-colors"
                                                    >✏️</button>
                                                )}
                                                {/* Delete */}
                                                {isAdmin && (
                                                    <button
                                                        title="Delete"
                                                        onClick={() => setDeleteTarget(s)}
                                                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                                    >🗑️</button>
                                                )}
                                                {/* Public link */}
                                                <a
                                                    href={`/p/${s.slug}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    title="Open public page"
                                                    className="p-1.5 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                                                >🔗</a>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* ── Create / Edit Modal ─────────────────────────────────────────── */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-6 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                                {editingShowcase ? 'Edit Showcase' : 'New Product Showcase'}
                            </h2>
                        </div>
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Product Name *</label>
                                <input
                                    type="text"
                                    value={formData.name}
                                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Wooden Chair"
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Brief product description (optional)"
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-gray-800 dark:text-white resize-none"
                                />
                            </div>
                            <div className="flex items-center gap-3">
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.isActive}
                                        onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                    />
                                    <div className="w-10 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-rose-400 rounded-full peer peer-checked:bg-rose-500 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                                </label>
                                <span className="text-sm text-gray-600 dark:text-gray-300">Active (visible to public)</span>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                                    {editingShowcase ? 'Add Images (Optional)' : 'Images'}
                                </label>
                                <div 
                                    className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-4 text-center cursor-pointer hover:border-rose-400 dark:hover:border-rose-500 transition-colors"
                                    onClick={() => fileInputRef.current?.click()}
                                >
                                    <input 
                                        type="file" 
                                        multiple 
                                        accept="image/*" 
                                        className="hidden" 
                                        ref={fileInputRef} 
                                        onChange={(e) => {
                                            if (e.target.files.length) {
                                                setImages(Array.from(e.target.files));
                                            }
                                        }}
                                    />
                                    {images.length > 0 ? (
                                        <p className="text-sm text-rose-600 font-medium">{images.length} file(s) selected</p>
                                    ) : (
                                        <div className="text-sm text-gray-500">
                                            <span className="text-2xl block mb-1">📸</span>
                                            Click to select images
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="p-6 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <button onClick={closeModal} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : (editingShowcase ? 'Save Changes' : 'Create Showcase')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Delete Confirmation ─────────────────────────────────────────── */}
            {deleteTarget && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
                        <div className="text-center">
                            <div className="text-4xl mb-3">⚠️</div>
                            <h3 className="font-bold text-gray-900 dark:text-white">Delete Showcase?</h3>
                            <p className="text-sm text-gray-500 mt-1">
                                "<strong>{deleteTarget.name}</strong>" and all its images will be permanently deleted.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setDeleteTarget(null)} className="flex-1 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                            <button onClick={handleDelete} className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors">Delete</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── QR Code Modal ───────────────────────────────────────────────── */}
            {qrModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-sm">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
                            <h2 className="font-bold text-gray-900 dark:text-white">QR Code — {qrModal.showcase.name}</h2>
                            <button onClick={() => setQrModal(null)} className="text-gray-400 hover:text-gray-700 text-xl">✕</button>
                        </div>
                        <div className="p-6 flex flex-col items-center gap-4">
                            {qrLoading ? (
                                <div className="h-48 flex items-center justify-center text-4xl animate-spin">⏳</div>
                            ) : qrModal.qrCode ? (
                                <>
                                    <div className="p-3 bg-white rounded-xl border border-gray-200 shadow-inner">
                                        <img src={qrModal.qrCode} alt="QR Code" className="w-48 h-48" />
                                    </div>
                                    <div className="w-full bg-gray-50 dark:bg-gray-800 rounded-lg p-3 flex items-center gap-2">
                                        <span className="text-xs text-gray-500 break-all flex-1">{qrModal.url}</span>
                                        <button onClick={copyLink} title="Copy link" className="text-gray-400 hover:text-gray-700 flex-shrink-0">📋</button>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2 w-full">
                                        <button onClick={downloadQR} className="flex flex-col items-center gap-1 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-semibold transition-colors">
                                            <span className="text-xl">⬇️</span> Download
                                        </button>
                                        <button onClick={shareWhatsApp} className="flex flex-col items-center gap-1 py-2.5 bg-green-50 hover:bg-green-100 text-green-700 rounded-xl text-xs font-semibold transition-colors">
                                            <span className="text-xl">💬</span> WhatsApp
                                        </button>
                                        <button onClick={shareEmail} className="flex flex-col items-center gap-1 py-2.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-semibold transition-colors">
                                            <span className="text-xl">📧</span> Email
                                        </button>
                                    </div>
                                </>
                            ) : <p className="text-red-500 text-sm">Failed to generate QR code.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
