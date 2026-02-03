import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { createWorker } from 'tesseract.js';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const ScanBill = () => {
    const { categories, createItem, createTransaction } = useContext(InventoryContext);
    const navigate = useNavigate();
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);
    const [isScanning, setIsScanning] = useState(false);
    const [extractedItems, setExtractedItems] = useState([]);
    const [scanProgress, setScanProgress] = useState(0);

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 10 * 1024 * 1024) {
                toast.error('Image size should be less than 10MB');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
            setExtractedItems([]);
        }
    };

    const parseTextToItems = (text) => {
        const lines = text.split('\n').filter(line => line.trim());
        const items = [];

        // Simple parsing logic - looks for patterns like:
        // "Item Name 5" or "5 Item Name" or "Item Name x5"
        lines.forEach(line => {
            // Remove special characters and extra spaces
            const cleaned = line.trim().replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ');

            // Try to find quantity patterns
            const qtyPatterns = [
                /(\d+)\s+(.+)/, // "5 Item Name"
                /(.+)\s+x\s*(\d+)/i, // "Item Name x5"
                /(.+)\s+(\d+)$/, // "Item Name 5"
            ];

            for (const pattern of qtyPatterns) {
                const match = cleaned.match(pattern);
                if (match) {
                    let name, quantity;

                    if (pattern.source.startsWith('(\\d+)')) {
                        // Quantity first
                        quantity = parseInt(match[1]);
                        name = match[2].trim();
                    } else {
                        // Name first
                        name = match[1].trim();
                        quantity = parseInt(match[2]);
                    }

                    // Only add if name is reasonable length and quantity is valid
                    if (name.length > 2 && quantity > 0 && quantity < 10000) {
                        items.push({
                            id: Date.now() + Math.random(),
                            name: name,
                            quantity: quantity,
                            category: '',
                            price: 0,
                            minStockThreshold: 10,
                        });
                        break;
                    }
                }
            }
        });

        return items;
    };

    const handleScanBill = async () => {
        if (!imageFile) {
            toast.error('Please select an image first');
            return;
        }

        setIsScanning(true);
        setScanProgress(0);

        try {
            const worker = await createWorker('eng', 1, {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        setScanProgress(Math.round(m.progress * 100));
                    }
                },
            });

            const { data: { text } } = await worker.recognize(imageFile);
            await worker.terminate();

            console.log('Extracted text:', text);

            const items = parseTextToItems(text);

            if (items.length === 0) {
                toast.error('No items found. Please try a clearer image or add items manually.');
            } else {
                setExtractedItems(items);
                toast.success(`Found ${items.length} items!`);
            }
        } catch (error) {
            console.error('OCR Error:', error);
            toast.error('Failed to scan bill. Please try again.');
        } finally {
            setIsScanning(false);
            setScanProgress(0);
        }
    };

    const handleItemChange = (id, field, value) => {
        setExtractedItems(items =>
            items.map(item =>
                item.id === id ? { ...item, [field]: value } : item
            )
        );
    };

    const handleRemoveItem = (id) => {
        setExtractedItems(items => items.filter(item => item.id !== id));
    };

    const handleAddToInventory = async () => {
        if (extractedItems.length === 0) {
            toast.error('No items to add');
            return;
        }

        // Validate all items have required fields
        const invalidItems = extractedItems.filter(
            item => !item.name || !item.category || item.quantity <= 0
        );

        if (invalidItems.length > 0) {
            toast.error('Please fill in all required fields (name, category, quantity)');
            return;
        }

        const loadingToast = toast.loading('Adding items to inventory...');

        try {
            let successCount = 0;
            let errorCount = 0;

            for (const item of extractedItems) {
                const formData = new FormData();
                formData.append('name', item.name);
                formData.append('category', item.category);
                formData.append('quantity', item.quantity);
                formData.append('price', item.price || 0);
                formData.append('minStockThreshold', item.minStockThreshold || 10);
                formData.append('location', 'Main Warehouse');

                const result = await createItem(formData);

                if (result.success) {
                    // Create transaction record
                    await createTransaction({
                        item: result.data._id,
                        type: 'inward',
                        quantity: item.quantity,
                        reason: 'Bill scan import',
                        notes: 'Imported from scanned bill',
                    });
                    successCount++;
                } else {
                    errorCount++;
                }
            }

            toast.dismiss(loadingToast);

            if (successCount > 0) {
                toast.success(`Successfully added ${successCount} items!`);
                if (errorCount === 0) {
                    navigate('/inventory');
                }
            }

            if (errorCount > 0) {
                toast.error(`Failed to add ${errorCount} items`);
            }
        } catch (error) {
            toast.dismiss(loadingToast);
            toast.error('Failed to add items to inventory');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">📸 Scan Bill</h1>
                <p className="text-gray-600 mt-2">Upload a bill image to automatically extract items and quantities</p>
            </div>

            {/* Image Upload */}
            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">1. Upload Bill Image</h2>

                <div className="space-y-4">
                    <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />

                    {imagePreview && (
                        <div className="mt-4">
                            <img
                                src={imagePreview}
                                alt="Bill preview"
                                className="max-w-full h-auto max-h-96 rounded-lg border border-gray-300"
                            />
                        </div>
                    )}

                    <button
                        onClick={handleScanBill}
                        disabled={!imageFile || isScanning}
                        className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                        {isScanning ? `Scanning... ${scanProgress}%` : '🔍 Scan Bill'}
                    </button>

                    {isScanning && (
                        <div className="w-full bg-gray-200 rounded-full h-2.5">
                            <div
                                className="bg-primary-600 h-2.5 rounded-full transition-all duration-300"
                                style={{ width: `${scanProgress}%` }}
                            ></div>
                        </div>
                    )}
                </div>
            </div>

            {/* Extracted Items */}
            {extractedItems.length > 0 && (
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">
                        2. Review Extracted Items ({extractedItems.length})
                    </h2>

                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Quantity</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Price</th>
                                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {extractedItems.map((item) => (
                                    <tr key={item.id}>
                                        <td className="px-4 py-3">
                                            <input
                                                type="text"
                                                value={item.name}
                                                onChange={(e) => handleItemChange(item.id, 'name', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={item.quantity}
                                                onChange={(e) => handleItemChange(item.id, 'quantity', parseInt(e.target.value))}
                                                className="w-20 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <select
                                                value={item.category}
                                                onChange={(e) => handleItemChange(item.id, 'category', e.target.value)}
                                                className="w-full px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            >
                                                <option value="">Select category</option>
                                                {categories.map(cat => (
                                                    <option key={cat._id} value={cat._id}>{cat.name}</option>
                                                ))}
                                            </select>
                                        </td>
                                        <td className="px-4 py-3">
                                            <input
                                                type="number"
                                                value={item.price}
                                                onChange={(e) => handleItemChange(item.id, 'price', parseFloat(e.target.value))}
                                                className="w-24 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                            />
                                        </td>
                                        <td className="px-4 py-3">
                                            <button
                                                onClick={() => handleRemoveItem(item.id)}
                                                className="text-red-600 hover:text-red-900"
                                            >
                                                🗑️ Remove
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex space-x-4">
                        <button
                            onClick={handleAddToInventory}
                            className="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium"
                        >
                            ✅ Add All to Inventory
                        </button>
                        <button
                            onClick={() => navigate('/inventory')}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ScanBill;
