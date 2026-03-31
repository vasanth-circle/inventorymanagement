import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const BulkImport = () => {
    const { 
        parseExcelFile, 
        importExcelData, 
        downloadTemplate, 
        getExcelHeadersBulk, 
        importMappedData 
    } = useContext(InventoryContext);
    
    const [file, setFile] = useState(null);
    const [parsedData, setParsedData] = useState(null);
    const [mappingData, setMappingData] = useState(null); // { headers, previewRows, totalRows }
    const [mapping, setMapping] = useState({});
    const [loading, setLoading] = useState(false);
    const [mode, setMode] = useState('template'); // 'template' or 'mapping'

    const appFields = [
        { key: 'name', label: 'Item Name', required: true, synonyms: ['item', 'product', 'name', 'title'] },
        { key: 'sku', label: 'SKU / Item Code', required: false, synonyms: ['sku', 'code', 'article', 'id'] },
        { key: 'category', label: 'Category', required: false, synonyms: ['category', 'type', 'group'] },
        { key: 'quantity', label: 'Quantity', required: false, synonyms: ['qty', 'quantity', 'stock', 'count'] },
        { key: 'price', label: 'Price / Unit Cost', required: false, synonyms: ['price', 'cost', 'rate', 'mrp'] },
        { key: 'barcode', label: 'Barcode', required: false, synonyms: ['barcode', 'upc', 'ean'] },
        { key: 'location', label: 'Storage Location', required: false, synonyms: ['location', 'warehouse', 'rack', 'shelf'] },
        { key: 'minStockThreshold', label: 'Min Stock Level', required: false, synonyms: ['min', 'threshold', 'alert', 'reorder'] },
        { key: 'description', label: 'Description', required: false, synonyms: ['description', 'desc', 'notes', 'info'] },
    ];

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
            setParsedData(null);
            setMappingData(null);
            setMapping({});
        }
    };

    const handleUpload = async () => {
        if (!file) {
            toast.error('Please select a file first');
            return;
        }

        setLoading(true);
        // Try to get headers first to see if we need mapping
        const result = await getExcelHeadersBulk(file);
        setLoading(false);

        if (result.success) {
            const { headers, previewRows, totalRows } = result.data;
            setMappingData(result.data);
            
            // Auto-match logic
            const initialMapping = {};
            appFields.forEach(field => {
                const match = headers.find(h => 
                    field.synonyms.includes(h.toLowerCase().trim()) || 
                    h.toLowerCase().includes(field.key.toLowerCase())
                );
                if (match) initialMapping[field.key] = match;
            });
            setMapping(initialMapping);

            // Check if it matches our standard template
            const templateHeaders = ['Item Name', 'SKU', 'Category', 'Quantity', 'Price'];
            const matchesTemplate = templateHeaders.every(h => headers.includes(h));
            
            if (matchesTemplate) {
                setMode('template');
                handleParse(); // Auto-parse with existing logic if it matches
            } else {
                setMode('mapping');
                toast.success('File detected. Please map your columns below.');
            }
        }
    };

    const handleParse = async () => {
        setLoading(true);
        const result = await parseExcelFile(file);
        setLoading(false);

        if (result.success) {
            setParsedData(result.data);
            toast.success('File parsed successfully.');
        }
    };

    const handleFinalImport = async () => {
        if (mode === 'template') {
            if (!parsedData || parsedData.validRows === 0) {
                toast.error('No valid data to import');
                return;
            }
            const validItems = parsedData.data.filter(item => item.isValid).map(item => item.data);
            setLoading(true);
            const result = await importExcelData(validItems);
            setLoading(false);
            if (result.success) resetAll();
        } else {
            // Validation
            const missingRequired = appFields.filter(f => f.required && !mapping[f.key]);
            if (missingRequired.length > 0) {
                toast.error(`Please map required field: ${missingRequired[0].label}`);
                return;
            }

            setLoading(true);
            const result = await importMappedData(file, mapping);
            setLoading(false);
            if (result.success) resetAll();
        }
    };

    const resetAll = () => {
        setFile(null);
        setParsedData(null);
        setMappingData(null);
        setMapping({});
        const fileInput = document.getElementById('excel-upload');
        if (fileInput) fileInput.value = '';
    };

    const handleMappingChange = (fieldKey, excelHeader) => {
        setMapping(prev => ({
            ...prev,
            [fieldKey]: excelHeader
        }));
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Bulk Stock Upload</h1>
                    <p className="text-gray-500 mt-1">Upload your initial inventory data quickly and easily.</p>
                </div>
                <button
                    onClick={downloadTemplate}
                    className="group px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center gap-2 font-medium"
                >
                    <span className="text-xl">📥</span> Download Template
                </button>
            </div>

            {/* Step 1: Upload */}
            {!mappingData && !parsedData && (
                <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                    <div className="p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">1</div>
                            <h2 className="text-xl font-bold text-gray-900">Upload Excel File</h2>
                        </div>
                        
                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 transition-colors cursor-pointer group relative" onClick={() => document.getElementById('excel-upload').click()}>
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="text-3xl text-primary-600">📊</span>
                            </div>
                            <p className="text-lg font-semibold text-gray-900">{file ? file.name : 'Click or Drag Excel file here'}</p>
                            <p className="text-sm text-gray-500 mt-1 italic">Supports .xlsx, .xls up to 5MB</p>
                            
                            <input
                                id="excel-upload"
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="px-8 py-3 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50 font-bold flex items-center gap-2"
                            >
                                {loading ? (
                                    <>
                                        <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div>
                                        Processing...
                                    </>
                                ) : (
                                    <>🔍 Analyze File</>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Mapping (if not matching template) */}
            {mappingData && mode === 'mapping' && (
                <div className="animate-fade-in space-y-6">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-8">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">2</div>
                                <h2 className="text-xl font-bold text-gray-900">Map Your Columns</h2>
                            </div>
                            <span className="px-3 py-1 bg-yellow-100 text-yellow-700 text-xs font-bold rounded-full uppercase tracking-wider">Custom Format Detected</span>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                            <div>
                                <p className="text-sm text-gray-600 mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                    Match the fields in our application with the columns in your Excel file.
                                </p>
                                
                                <div className="space-y-4">
                                    {appFields.map((field) => (
                                        <div key={field.key} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 p-4 rounded-xl hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-100">
                                            <div className="flex-1">
                                                <label className="block text-sm font-bold text-gray-700">
                                                    {field.label} {field.required && <span className="text-red-500">*</span>}
                                                </label>
                                                <p className="text-xs text-gray-500">System Field</p>
                                            </div>
                                            <div className="flex-1">
                                                <select
                                                    value={mapping[field.key] || ''}
                                                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                                    className="w-full bg-white border border-gray-200 rounded-lg py-2 px-3 text-sm focus:ring-2 focus:ring-primary-500 transition-all font-medium"
                                                >
                                                    <option value="">-- Ignored --</option>
                                                    {mappingData.headers.map((h, i) => (
                                                        <option key={i} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="bg-gray-900 rounded-2xl overflow-hidden shadow-2xl h-fit">
                                <div className="bg-gray-800 px-6 py-3 flex items-center justify-between">
                                    <h3 className="text-sm font-bold text-gray-300">Data Preview (Mapped)</h3>
                                    <div className="flex gap-1.5Line">
                                        <div className="w-3 h-3 rounded-full bg-red-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                                        <div className="w-3 h-3 rounded-full bg-green-500"></div>
                                    </div>
                                </div>
                                <div className="p-6 overflow-x-auto">
                                    <table className="w-full text-xs text-left text-gray-400">
                                        <thead>
                                            <tr className="border-b border-gray-800">
                                                <th className="pb-3 pr-4 font-bold text-gray-500">Row</th>
                                                {appFields.filter(f => mapping[f.key]).slice(0, 4).map(f => (
                                                    <th key={f.key} className="pb-3 pr-4 font-bold text-primary-400">{f.label}</th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-800">
                                            {mappingData.previewRows.map((row, idx) => (
                                                <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                                                    <td className="py-3 pr-4 text-gray-600">{idx + 1}</td>
                                                    {appFields.filter(f => mapping[f.key]).slice(0, 4).map(f => {
                                                        // find the index of the header in the headers array
                                                        const headerIdx = mappingData.headers.indexOf(mapping[f.key]);
                                                        return (
                                                            <td key={f.key} className="py-3 pr-4 max-w-[120px] truncate">
                                                                {row[headerIdx] || '-'}
                                                            </td>
                                                        );
                                                    })}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                    {mappingData.totalRows > 5 && (
                                        <p className="mt-4 text-center text-[10px] text-gray-600 font-mono">
                                            + {mappingData.totalRows - 5} more rows found in file
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="mt-12 flex justify-between items-center bg-gray-50 -m-8 p-8 rounded-b-2xl border-t border-gray-100">
                            <button onClick={resetAll} className="text-gray-500 hover:text-gray-700 font-bold flex items-center gap-2">
                                ↺ Start Over
                            </button>
                            <button
                                onClick={handleFinalImport}
                                disabled={loading}
                                className="px-10 py-4 bg-green-600 text-white rounded-xl shadow-xl hover:bg-green-700 transition-all disabled:opacity-50 font-bold flex items-center gap-2 text-lg"
                            >
                                {loading ? 'Importing...' : '🚀 Launch Bulk Import'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Template Mode Preview */}
            {parsedData && mode === 'template' && (
                <div className="animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center">
                            <p className="text-xs text-gray-400 uppercase font-extrabold tracking-widest mb-1">Total Found</p>
                            <p className="text-4xl font-black text-gray-900">{parsedData.totalRows}</p>
                        </div>
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center border-l-4 border-l-green-500">
                            <p className="text-xs text-green-500 uppercase font-extrabold tracking-widest mb-1">Pass Checks</p>
                            <p className="text-4xl font-black text-green-600">{parsedData.validRows}</p>
                        </div>
                        <div className="bg-white p-8 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center border-l-4 border-l-red-500">
                            <p className="text-xs text-red-500 uppercase font-extrabold tracking-widest mb-1">Found Issues</p>
                            <p className="text-4xl font-black text-red-600">{parsedData.invalidRows}</p>
                        </div>
                    </div>

                    <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                        <div className="px-8 py-6 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
                            <div>
                                <h3 className="text-xl font-bold text-gray-900">Scan Results</h3>
                                <p className="text-sm text-gray-500">Standard template format detected and validated.</p>
                            </div>
                            <div className="flex gap-4">
                                <button onClick={resetAll} className="px-4 py-2 text-gray-500 font-bold">Discard</button>
                                <button
                                    onClick={handleFinalImport}
                                    disabled={parsedData.validRows === 0 || loading}
                                    className="px-8 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 font-bold"
                                >
                                    {loading ? 'Importing...' : '🚀 Finalize Import'}
                                </button>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-white border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                                        <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Item Name</th>
                                        <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">SKU</th>
                                        <th className="px-8 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Messages</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {parsedData.data.map((row, idx) => (
                                        <tr key={idx} className={`${row.isValid ? 'hover:bg-green-50/30' : 'bg-red-50/50'} transition-colors`}>
                                            <td className="px-8 py-5">
                                                {row.isValid ? (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 text-[10px] font-black uppercase rounded-full">✓ OK</span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-700 text-[10px] font-black uppercase rounded-full">! Error</span>
                                                )}
                                            </td>
                                            <td className="px-8 py-5 text-sm font-bold text-gray-900">{row.data.name}</td>
                                            <td className="px-8 py-5 text-sm font-mono text-gray-600 bg-gray-50/50">{row.data.sku}</td>
                                            <td className="px-8 py-5 text-xs text-red-600 font-medium italic">
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
