import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import api from '../utils/api';
import toast from 'react-hot-toast';

const StockInward = () => {
    const { categories, createItem, createTransaction } = useContext(InventoryContext);
    const navigate = useNavigate();
    const [isNewItem, setIsNewItem] = useState(true);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        barcode: '',
        category: '',
        quantity: '',
        price: '',
        minStockThreshold: '10',
        location: 'Main Warehouse',
        reason: '',
        notes: '',
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    // Excel import states
    const [showExcelModal, setShowExcelModal] = useState(false);
    const [excelTab, setExcelTab] = useState('upload'); // upload, preview, import
    const [excelFile, setExcelFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [selectedRows, setSelectedRows] = useState([]);
    const [importProgress, setImportProgress] = useState(0);
    const [importResults, setImportResults] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            if (file.size > 5 * 1024 * 1024) {
                toast.error('Image size should be less than 5MB');
                return;
            }
            setImageFile(file);
            setImagePreview(URL.createObjectURL(file));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (isNewItem) {
                // Create new item with initial stock
                const itemFormData = new FormData();
                itemFormData.append('name', formData.name);
                itemFormData.append('barcode', formData.barcode);
                itemFormData.append('category', formData.category);
                itemFormData.append('quantity', formData.quantity);
                itemFormData.append('price', formData.price);
                itemFormData.append('minStockThreshold', formData.minStockThreshold);
                itemFormData.append('location', formData.location);

                if (imageFile) {
                    itemFormData.append('image', imageFile);
                }

                const result = await createItem(itemFormData);

                if (result.success) {
                    // Create transaction record
                    await createTransaction({
                        item: result.data._id,
                        type: 'inward',
                        quantity: parseInt(formData.quantity),
                        reason: formData.reason || 'Initial stock',
                        notes: formData.notes,
                    });

                    toast.success('Item created and stock added successfully!');
                    navigate('/inventory');
                }
            }
        } catch (error) {
            toast.error('Failed to add stock');
        } finally {
            setLoading(false);
        }
    };

    // Excel Import Functions
    const handleDownloadTemplate = async () => {
        try {
            const response = await api.get('/excel/template', {
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', 'stock_inward_template.xlsx');
            document.body.appendChild(link);
            link.click();
            link.remove();
            toast.success('Template downloaded successfully');
        } catch (error) {
            toast.error('Failed to download template');
        }
    };

    const handleExcelFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setExcelFile(file);
        }
    };

    const handleUploadExcel = async () => {
        if (!excelFile) {
            toast.error('Please select an Excel file');
            return;
        }

        const formData = new FormData();
        formData.append('file', excelFile);

        try {
            setLoading(true);
            const { data } = await api.post('/excel/parse', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setParsedData(data);
            // Select all valid rows by default
            const validRowIndices = data.data
                .map((item, index) => (item.isValid ? index : null))
                .filter(index => index !== null);
            setSelectedRows(validRowIndices);
            setExcelTab('preview');
            toast.success(`Parsed ${data.totalRows} rows (${data.validRows} valid, ${data.invalidRows} invalid)`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to parse Excel file');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleRow = (index) => {
        setSelectedRows(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const handleImportData = async () => {
        if (selectedRows.length === 0) {
            toast.error('Please select at least one row to import');
            return;
        }

        const itemsToImport = selectedRows.map(index => parsedData.data[index].data);

        try {
            setLoading(true);
            setExcelTab('import');
            setImportProgress(0);

            const { data } = await api.post('/excel/import', { items: itemsToImport });

            setImportProgress(100);
            setImportResults(data);
            toast.success(`Import completed! ${data.successCount + data.updatedCount} items processed successfully`);
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to import data');
        } finally {
            setLoading(false);
        }
    };

    const resetExcelModal = () => {
        setShowExcelModal(false);
        setExcelTab('upload');
        setExcelFile(null);
        setParsedData(null);
        setSelectedRows([]);
        setImportProgress(0);
        setImportResults(null);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Stock Inward</h1>
                    <p className="text-gray-600 mt-2">Add new items or increase existing stock</p>
                </div>
                <button
                    onClick={() => setShowExcelModal(true)}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-2 transition-colors"
                >
                    <span>📊</span>
                    Import from Excel
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <div className="mb-6">
                    <div className="flex space-x-4">
                        <button
                            onClick={() => setIsNewItem(true)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${isNewItem
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            New Item
                        </button>
                        <button
                            onClick={() => setIsNewItem(false)}
                            className={`px-4 py-2 rounded-lg font-medium transition-colors ${!isNewItem
                                    ? 'bg-primary-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                }`}
                        >
                            Existing Item
                        </button>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {isNewItem && (
                        <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Item Name <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        name="name"
                                        required
                                        value={formData.name}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter item name"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Barcode
                                    </label>
                                    <input
                                        type="text"
                                        name="barcode"
                                        value={formData.barcode}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter barcode (optional)"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Category <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        name="category"
                                        required
                                        value={formData.category}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    >
                                        <option value="">Select category</option>
                                        {categories.map(cat => (
                                            <option key={cat._id} value={cat._id}>{cat.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Price <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="number"
                                        name="price"
                                        required
                                        min="0"
                                        step="0.01"
                                        value={formData.price}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Enter price"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Minimum Stock Threshold
                                    </label>
                                    <input
                                        type="number"
                                        name="minStockThreshold"
                                        min="0"
                                        value={formData.minStockThreshold}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Minimum stock level"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Location
                                    </label>
                                    <input
                                        type="text"
                                        name="location"
                                        value={formData.location}
                                        onChange={handleChange}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                        placeholder="Storage location"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Item Image
                                </label>
                                <div className="flex items-center space-x-4">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleImageChange}
                                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                                    />
                                    {imagePreview && (
                                        <img src={imagePreview} alt="Preview" className="h-20 w-20 object-cover rounded-lg" />
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Quantity <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                name="quantity"
                                required
                                min="1"
                                value={formData.quantity}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Enter quantity"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Reason
                            </label>
                            <input
                                type="text"
                                name="reason"
                                value={formData.reason}
                                onChange={handleChange}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                                placeholder="Purchase, Return, etc."
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Notes
                        </label>
                        <textarea
                            name="notes"
                            value={formData.notes}
                            onChange={handleChange}
                            rows="3"
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                            placeholder="Additional notes (optional)"
                        />
                    </div>

                    <div className="flex space-x-4">
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                        >
                            {loading ? 'Processing...' : '📥 Add Stock'}
                        </button>
                        <button
                            type="button"
                            onClick={() => navigate('/inventory')}
                            className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                </form>
            </div>

            {/* Excel Import Modal */}
            {showExcelModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
                        {/* Modal Header */}
                        <div className="p-6 border-b">
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-gray-900">Import from Excel</h2>
                                <button
                                    onClick={resetExcelModal}
                                    className="text-gray-500 hover:text-gray-700 text-2xl"
                                >
                                    ×
                                </button>
                            </div>
                            {/* Tabs */}
                            <div className="flex space-x-4 mt-4">
                                <button
                                    onClick={() => setExcelTab('upload')}
                                    className={`px-4 py-2 rounded-lg font-medium ${excelTab === 'upload'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                        }`}
                                >
                                    1. Upload
                                </button>
                                <button
                                    onClick={() => parsedData && setExcelTab('preview')}
                                    disabled={!parsedData}
                                    className={`px-4 py-2 rounded-lg font-medium ${excelTab === 'preview'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                        } disabled:opacity-50`}
                                >
                                    2. Preview
                                </button>
                                <button
                                    onClick={() => importResults && setExcelTab('import')}
                                    disabled={!importResults}
                                    className={`px-4 py-2 rounded-lg font-medium ${excelTab === 'import'
                                            ? 'bg-primary-600 text-white'
                                            : 'bg-gray-200 text-gray-700'
                                        } disabled:opacity-50`}
                                >
                                    3. Results
                                </button>
                            </div>
                        </div>

                        {/* Modal Body */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {/* Upload Tab */}
                            {excelTab === 'upload' && (
                                <div className="space-y-6">
                                    <div>
                                        <button
                                            onClick={handleDownloadTemplate}
                                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
                                        >
                                            <span>📥</span>
                                            Download Excel Template
                                        </button>
                                        <p className="text-sm text-gray-600 mt-2">
                                            Download the template to see the required format
                                        </p>
                                    </div>

                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                        <input
                                            type="file"
                                            accept=".xlsx,.xls"
                                            onChange={handleExcelFileChange}
                                            className="hidden"
                                            id="excel-upload"
                                        />
                                        <label htmlFor="excel-upload" className="cursor-pointer">
                                            <div className="text-6xl mb-4">📊</div>
                                            <p className="text-lg font-medium text-gray-700">
                                                {excelFile ? excelFile.name : 'Click to select Excel file'}
                                            </p>
                                            <p className="text-sm text-gray-500 mt-2">
                                                Supports .xlsx and .xls files (max 5MB)
                                            </p>
                                        </label>
                                    </div>

                                    <button
                                        onClick={handleUploadExcel}
                                        disabled={!excelFile || loading}
                                        className="w-full px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Parsing...' : 'Parse Excel File'}
                                    </button>
                                </div>
                            )}

                            {/* Preview Tab */}
                            {excelTab === 'preview' && parsedData && (
                                <div className="space-y-4">
                                    <div className="flex justify-between items-center">
                                        <div className="text-sm text-gray-600">
                                            Total: {parsedData.totalRows} | Valid: {parsedData.validRows} | Invalid: {parsedData.invalidRows} | Selected: {selectedRows.length}
                                        </div>
                                        <button
                                            onClick={() => {
                                                const allValid = parsedData.data
                                                    .map((item, index) => (item.isValid ? index : null))
                                                    .filter(index => index !== null);
                                                setSelectedRows(selectedRows.length === allValid.length ? [] : allValid);
                                            }}
                                            className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded text-sm"
                                        >
                                            {selectedRows.length === parsedData.validRows ? 'Deselect All' : 'Select All Valid'}
                                        </button>
                                    </div>

                                    <div className="overflow-x-auto border rounded-lg">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">✓</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Row</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Status</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Item Name</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">SKU</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Category</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Qty</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Price</th>
                                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Errors</th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {parsedData.data.map((item, index) => (
                                                    <tr key={index} className={item.isValid ? '' : 'bg-red-50'}>
                                                        <td className="px-3 py-2">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedRows.includes(index)}
                                                                onChange={() => handleToggleRow(index)}
                                                                disabled={!item.isValid}
                                                                className="rounded"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-sm">{item.rowNumber}</td>
                                                        <td className="px-3 py-2">
                                                            <span className={`text-lg ${item.isValid ? 'text-green-600' : 'text-red-600'}`}>
                                                                {item.isValid ? '✓' : '✗'}
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-sm">{item.data.name}</td>
                                                        <td className="px-3 py-2 text-sm font-mono">{item.data.sku}</td>
                                                        <td className="px-3 py-2 text-sm">{item.data.category}</td>
                                                        <td className="px-3 py-2 text-sm">{item.data.quantity}</td>
                                                        <td className="px-3 py-2 text-sm">₹{item.data.price}</td>
                                                        <td className="px-3 py-2 text-xs text-red-600">
                                                            {item.errors.join(', ')}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    <button
                                        onClick={handleImportData}
                                        disabled={selectedRows.length === 0 || loading}
                                        className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {loading ? 'Importing...' : `Import ${selectedRows.length} Selected Rows`}
                                    </button>
                                </div>
                            )}

                            {/* Results Tab */}
                            {excelTab === 'import' && (
                                <div className="space-y-6">
                                    {importResults ? (
                                        <>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="bg-green-50 p-4 rounded-lg">
                                                    <div className="text-2xl font-bold text-green-600">{importResults.successCount}</div>
                                                    <div className="text-sm text-gray-600">New Items</div>
                                                </div>
                                                <div className="bg-blue-50 p-4 rounded-lg">
                                                    <div className="text-2xl font-bold text-blue-600">{importResults.updatedCount}</div>
                                                    <div className="text-sm text-gray-600">Updated Items</div>
                                                </div>
                                                <div className="bg-red-50 p-4 rounded-lg">
                                                    <div className="text-2xl font-bold text-red-600">{importResults.failedCount}</div>
                                                    <div className="text-sm text-gray-600">Failed</div>
                                                </div>
                                            </div>

                                            {importResults.results.failed.length > 0 && (
                                                <div className="border border-red-200 rounded-lg p-4">
                                                    <h3 className="font-bold text-red-600 mb-2">Failed Items:</h3>
                                                    <ul className="space-y-1 text-sm">
                                                        {importResults.results.failed.map((item, index) => (
                                                            <li key={index} className="text-red-600">
                                                                {item.sku} - {item.name}: {item.error}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}

                                            <button
                                                onClick={() => {
                                                    resetExcelModal();
                                                    window.location.reload();
                                                }}
                                                className="w-full px-6 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium"
                                            >
                                                Done
                                            </button>
                                        </>
                                    ) : (
                                        <div className="text-center py-8">
                                            <div className="text-4xl mb-4">⏳</div>
                                            <div className="text-lg font-medium">Importing data...</div>
                                            <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
                                                <div
                                                    className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                                                    style={{ width: `${importProgress}%` }}
                                                ></div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StockInward;
