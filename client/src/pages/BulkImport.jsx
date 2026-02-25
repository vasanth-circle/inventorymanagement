import { useState, useContext } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const BulkImport = () => {
    const { parseExcelFile, importExcelData, downloadTemplate } = useContext(InventoryContext);
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setParsedData(null);
        }
    };

    const handleParse = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setLoading(true);
        const result = await parseExcelFile(file);
        setLoading(false);

        if (result.success) {
            setParsedData(result.data);
            toast.success('File parsed successfully. Review the data below.');
        }
    };

    const handleImport = async () => {
        if (!parsedData || parsedData.validRows === 0) {
            toast.error('No valid data to import');
            return;
        }

        const validItems = parsedData.data
            .filter(item => item.isValid)
            .map(item => item.data);

        setLoading(true);
        const result = await importExcelData(validItems);
        setLoading(false);

        if (result.success) {
            setFile(null);
            setParsedData(null);
            // reset file input
            const fileInput = document.getElementById('excel-upload');
            if (fileInput) fileInput.value = '';
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Bulk Import</h1>
                <button
                    onClick={downloadTemplate}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                >
                    📥 Download Template
                </button>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Upload Excel File</h2>
                <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
                    <input
                        id="excel-upload"
                        type="file"
                        accept=".xlsx, .xls"
                        onChange={handleFileChange}
                        className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    />
                    <button
                        onClick={handleParse}
                        disabled={!file || loading}
                        className="w-full md:w-auto px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 font-medium"
                    >
                        {loading ? 'Parsing...' : '🔍 Parse File'}
                    </button>
                </div>
                <p className="mt-2 text-sm text-gray-500 italic">
                    Supported formats: .xlsx, .xls (Max 5MB)
                </p>
            </div>

            {parsedData && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-blue-500">
                            <p className="text-sm text-gray-500 uppercase font-bold">Total Rows</p>
                            <p className="text-2xl font-semibold text-gray-900">{parsedData.totalRows}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-green-500">
                            <p className="text-sm text-gray-500 uppercase font-bold">Valid Rows</p>
                            <p className="text-2xl font-semibold text-green-600">{parsedData.validRows}</p>
                        </div>
                        <div className="bg-white p-6 rounded-lg shadow-md border-l-4 border-red-500">
                            <p className="text-sm text-gray-500 uppercase font-bold">Invalid Rows</p>
                            <p className="text-2xl font-semibold text-red-600">{parsedData.invalidRows}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-lg shadow-md overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">Data Preview</h3>
                            <button
                                onClick={handleImport}
                                disabled={parsedData.validRows === 0 || loading}
                                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 font-medium"
                            >
                                {loading ? 'Importing...' : '🚀 Finalize Import'}
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Name</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Qty</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Errors</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {parsedData.data.map((row, idx) => (
                                        <tr key={idx} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50'}>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {row.isValid ? (
                                                    <span className="text-green-600 font-bold">✓ Valid</span>
                                                ) : (
                                                    <span className="text-red-600 font-bold">✗ Invalid</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.data.name}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{row.data.sku}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.data.quantity}</td>
                                            <td className="px-6 py-4 text-sm text-red-600 italic">
                                                {row.errors.join(', ')}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BulkImport;
