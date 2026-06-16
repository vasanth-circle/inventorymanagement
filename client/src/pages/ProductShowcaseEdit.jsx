import { useState, useEffect, useContext, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { AuthContext } from '../context/AuthContext';
import { useParams, useNavigate } from 'react-router-dom';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

export default function ProductShowcaseEdit() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { user } = useContext(AuthContext);

    const [showcase, setShowcase] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editingImage, setEditingImage] = useState(null); // { _id, title, description, order }
    const fileInputRef = useRef(null);

    const getHeaders = () => ({
        Authorization: `Bearer ${sessionStorage.getItem('token')}`,
        'x-tenant-id': user?.tenantId,
    });

    // ── Fetch ──────────────────────────────────────────────────────────────────
    const fetchShowcase = async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`${API_BASE}/product-showcase/${id}`, { headers: getHeaders() });
            const sc = data.data;
            // Sort images by order
            if (sc.images) sc.images.sort((a, b) => (a.order || 0) - (b.order || 0));
            setShowcase(sc);
        } catch {
            toast.error('Failed to load showcase');
            navigate('/product-showcase');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchShowcase(); }, [id]);

    // ── Upload Images ──────────────────────────────────────────────────────────
    const handleFileChange = async (e) => {
        const files = Array.from(e.target.files);
        if (!files.length) return;
        try {
            setUploading(true);
            const formData = new FormData();
            files.forEach(f => formData.append('images', f));
            await axios.post(`${API_BASE}/product-showcase/${id}/images`, formData, {
                headers: { ...getHeaders(), 'Content-Type': 'multipart/form-data' },
            });
            toast.success(`${files.length} image(s) uploaded`);
            fetchShowcase();
        } catch (err) {
            toast.error(err.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    // ── Delete Image ───────────────────────────────────────────────────────────
    const handleDeleteImage = async (imageId) => {
        try {
            await axios.delete(`${API_BASE}/product-showcase/${id}/images/${imageId}`, { headers: getHeaders() });
            toast.success('Image removed');
            fetchShowcase();
        } catch {
            toast.error('Failed to remove image');
        }
    };

    // ── Edit Image Metadata ────────────────────────────────────────────────────
    const openEditImage = (img) => {
        setEditingImage({ _id: img._id, title: img.title || '', description: img.description || '', order: img.order || 0 });
    };

    const saveImageEdit = async () => {
        if (!editingImage) return;
        try {
            setSaving(true);
            const updatedImages = showcase.images.map(img =>
                img._id === editingImage._id
                    ? { ...img, title: editingImage.title, description: editingImage.description, order: editingImage.order }
                    : img
            );
            await axios.put(`${API_BASE}/product-showcase/${id}`, { images: updatedImages }, { headers: getHeaders() });
            toast.success('Image updated');
            setEditingImage(null);
            fetchShowcase();
        } catch {
            toast.error('Failed to save image');
        } finally {
            setSaving(false);
        }
    };

    // ── Move Order ─────────────────────────────────────────────────────────────
    const moveImage = async (imgId, direction) => {
        const imgs = [...showcase.images];
        const idx = imgs.findIndex(i => i._id === imgId);
        if (idx === -1) return;
        const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
        if (swapIdx < 0 || swapIdx >= imgs.length) return;
        // Swap order values
        const tempOrder = imgs[idx].order;
        imgs[idx] = { ...imgs[idx], order: imgs[swapIdx].order };
        imgs[swapIdx] = { ...imgs[swapIdx], order: tempOrder };
        try {
            await axios.put(`${API_BASE}/product-showcase/${id}`, { images: imgs }, { headers: getHeaders() });
            fetchShowcase();
        } catch {
            toast.error('Failed to reorder');
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex items-center justify-center h-64 text-gray-400 text-3xl animate-spin">⏳</div>
        );
    }

    if (!showcase) return null;

    const sortedImages = [...(showcase.images || [])].sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <button
                    onClick={() => navigate('/product-showcase')}
                    className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors text-gray-500"
                >
                    ← Back
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Image Gallery</h1>
                    <p className="text-sm text-gray-500">{showcase.name} · {sortedImages.length} image(s)</p>
                </div>
            </div>

            {/* Upload Zone */}
            <div
                className="border-2 border-dashed border-rose-300 dark:border-rose-800 rounded-2xl p-8 text-center cursor-pointer hover:border-rose-500 hover:bg-rose-50/30 dark:hover:bg-rose-900/10 transition-all"
                onClick={() => fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={handleFileChange}
                />
                {uploading ? (
                    <div className="flex flex-col items-center gap-2 text-rose-500">
                        <div className="animate-spin text-3xl">⏳</div>
                        <p className="text-sm font-medium">Uploading…</p>
                    </div>
                ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-500">
                        <div className="text-4xl">📸</div>
                        <p className="font-semibold text-gray-700 dark:text-gray-300">Click to upload images</p>
                        <p className="text-xs">JPG, PNG, GIF, WebP · Max 10 MB each · Multiple allowed</p>
                    </div>
                )}
            </div>

            {/* Image Grid */}
            {sortedImages.length === 0 ? (
                <div className="text-center text-gray-400 py-8">No images yet — upload some above!</div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {sortedImages.map((img, idx) => (
                        <div
                            key={img._id}
                            className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden group"
                        >
                            {/* Image */}
                            <div className="relative aspect-video bg-gray-100 dark:bg-gray-800">
                                <img
                                    src={`${API_BASE.replace('/api', '')}${img.url}`}
                                    alt={img.title || 'Product image'}
                                    className="w-full h-full object-cover"
                                    onError={e => { e.target.src = 'https://via.placeholder.com/400x250?text=Image'; }}
                                />
                                {/* Order badge */}
                                <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full font-mono">
                                    #{img.order || idx + 1}
                                </div>
                                {/* Hover actions */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <button
                                        onClick={() => moveImage(img._id, 'up')}
                                        disabled={idx === 0}
                                        className="p-2 bg-white/80 hover:bg-white rounded-lg disabled:opacity-30 transition"
                                        title="Move up"
                                    >⬆️</button>
                                    <button
                                        onClick={() => moveImage(img._id, 'down')}
                                        disabled={idx === sortedImages.length - 1}
                                        className="p-2 bg-white/80 hover:bg-white rounded-lg disabled:opacity-30 transition"
                                        title="Move down"
                                    >⬇️</button>
                                </div>
                            </div>

                            {/* Metadata */}
                            <div className="p-3 space-y-1">
                                <p className="font-semibold text-sm text-gray-800 dark:text-white truncate">{img.title || <span className="text-gray-400 italic">No title</span>}</p>
                                <p className="text-xs text-gray-500 line-clamp-2">{img.description || <span className="italic">No description</span>}</p>
                            </div>

                            {/* Actions */}
                            <div className="px-3 pb-3 flex gap-2">
                                <button
                                    onClick={() => openEditImage(img)}
                                    className="flex-1 py-1.5 text-xs bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg font-medium transition-colors"
                                >✏️ Edit</button>
                                <button
                                    onClick={() => handleDeleteImage(img._id)}
                                    className="flex-1 py-1.5 text-xs bg-red-50 hover:bg-red-100 text-red-600 rounded-lg font-medium transition-colors"
                                >🗑️ Remove</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Edit Image Modal ────────────────────────────────────────────── */}
            {editingImage && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="p-5 border-b border-gray-100 dark:border-gray-800">
                            <h2 className="font-bold text-gray-900 dark:text-white">Edit Image Details</h2>
                        </div>
                        <div className="p-5 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
                                <input
                                    type="text"
                                    value={editingImage.title}
                                    onChange={e => setEditingImage({ ...editingImage, title: e.target.value })}
                                    placeholder="e.g. Front View"
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                                <textarea
                                    rows={3}
                                    value={editingImage.description}
                                    onChange={e => setEditingImage({ ...editingImage, description: e.target.value })}
                                    placeholder="e.g. Smooth matte finish with premium wood"
                                    className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-gray-800 dark:text-white resize-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Display Order</label>
                                <input
                                    type="number"
                                    min={1}
                                    value={editingImage.order}
                                    onChange={e => setEditingImage({ ...editingImage, order: parseInt(e.target.value) || 0 })}
                                    className="w-24 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 dark:bg-gray-800 dark:text-white"
                                />
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 dark:border-gray-800 flex justify-end gap-3">
                            <button onClick={() => setEditingImage(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 transition-colors">Cancel</button>
                            <button
                                onClick={saveImageEdit}
                                disabled={saving}
                                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
