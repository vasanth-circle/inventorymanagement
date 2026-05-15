import { useState, useContext } from 'react';
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
    const [importType, setImportType] = useState('full'); // 'full' or 'stock'
    const [updateMode, setUpdateMode] = useState('add'); // 'add' or 'overwrite'

    const fullFields = [
        { key: 'name', label: 'Item Name', required: true, synonyms: ['item', 'product', 'name', 'title'] },
        { key: 'sku', label: 'SKU / Item Code', required: false, synonyms: ['sku', 'code', 'article', 'id'] },
        { key: 'category', label: 'Category', required: false, synonyms: ['category', 'type', 'group'] },
        { key: 'quantity', label: 'Quantity', required: false, synonyms: ['qty', 'quantity', 'stock', 'count'] },
        { key: 'price', label: 'Price / Unit Cost', required: false, synonyms: ['price', 'cost', 'rate', 'mrp'] },
        { key: 'barcode', label: 'Barcode', required: false, synonyms: ['barcode', 'upc', 'ean'] },
        { key: 'location', label: 'Storage Location', required: false, synonyms: ['location', 'warehouse', 'rack', 'shelf'] },
        { key: 'minStockThreshold', label: 'Min Stock Level', required: false, synonyms: ['min', 'threshold', 'alert', 'reorder'] },
        { key: 'description', label: 'Description', required: false, synonyms: ['description', 'desc', 'notes', 'info'] },
        { key: 'hsn', label: 'HSN Code', required: false, synonyms: ['hsn', 'hsn code', 'sac', 'tax code'] },
    ];

    const stockFields = [
        { key: 'name', label: 'Item Name', required: true, synonyms: ['item', 'product', 'name', 'title'] },
        { key: 'quantity', label: 'New Stock Quantity', required: true, synonyms: ['qty', 'quantity', 'stock', 'count'] },
        { key: 'location', label: 'Storage Location', required: false, synonyms: ['location', 'warehouse', 'rack', 'shelf'] },
    ];

    const appFields = importType === 'full' ? fullFields : stockFields;

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
        const result = await getExcelHeadersBulk(file);
        setLoading(false);

        if (result.success) {
            const { headers } = result.data;
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
                handleParse();
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
            const result = await importExcelData(validItems, { updateMode, importType });
            setLoading(false);
            if (result.success) resetAll();
        } else {
            const missingRequired = appFields.filter(f => f.required && !mapping[f.key]);
            if (missingRequired.length > 0) {
                toast.error(`Please map required field: ${missingRequired[0].label}`);
                return;
            }

            setLoading(true);
            const result = await importMappedData(file, mapping, { updateMode, importType });
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
        setMapping(prev => ({ ...prev, [fieldKey]: excelHeader }));
    };

    return (
        <div className="space-y-6 max-w-6xl mx-auto pb-12 px-4 md:px-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 tracking-tight">Bulk Stock Upload</h1>
                    <p className="text-sm text-gray-500 mt-1">Upload your inventory data quickly and easily.</p>
                </div>
                <button
                    onClick={downloadTemplate}
                    className="w-full md:w-auto group px-5 py-2.5 bg-white border border-gray-200 text-gray-700 rounded-xl shadow-sm hover:bg-gray-50 hover:border-gray-300 transition-all flex items-center justify-center gap-2 font-medium"
                >
                    <span className="text-xl">📥</span> Download Template
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-xs">A</span>
                        Select Workflow
                    </h3>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setImportType('full')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${importType === 'full' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Full Item Master
                        </button>
                        <button
                            onClick={() => setImportType('stock')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${importType === 'stock' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Stock Only Update
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 italic px-1">
                        {importType === 'full' 
                            ? 'Creates new items or updates all fields of existing items.' 
                            : 'Optimized for fast stock updates. Only name and quantity are required.'}
                    </p>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                    <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <span className="w-6 h-6 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-xs">B</span>
                        Update Logic
                    </h3>
                    <div className="flex bg-gray-100 p-1 rounded-xl">
                        <button
                            onClick={() => setUpdateMode('add')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${updateMode === 'add' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Add to Current
                        </button>
                        <button
                            onClick={() => setUpdateMode('overwrite')}
                            className={`flex-1 py-2 px-4 rounded-lg text-sm font-bold transition-all ${updateMode === 'overwrite' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Overwrite Current
                        </button>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-3 italic px-1">
                        {updateMode === 'add' 
                            ? 'New quantities will be ADDED to whatever you currently have in stock.' 
                            : 'Current stock levels will be COMPLETELY REPLACED by the values in your file.'}
                    </p>
                </div>
            </div>

            {!mappingData && !parsedData && (
                <div className="zoho-card !p-0 overflow-hidden">
                    <div className="p-6 md:p-8">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">1</div>
                            <h2 className="text-xl font-bold text-gray-900">Upload Excel File</h2>
                        </div>
                        
                        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-6 md:p-10 flex flex-col items-center justify-center bg-gray-50 hover:bg-gray-100/50 transition-colors cursor-pointer group relative text-center" onClick={() => document.getElementById('excel-upload').click()}>
                            <div className="w-16 h-16 bg-white rounded-2xl shadow-md flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <span className="text-3xl text-primary-600">📊</span>
                            </div>
                            <p className="text-base md:text-lg font-semibold text-gray-900 truncate max-w-xs">{file ? file.name : 'Click or Drag Excel file here'}</p>
                            <p className="text-xs text-gray-500 mt-1 italic">Supports .xlsx, .xls up to 5MB</p>
                            <input id="excel-upload" type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="hidden" />
                        </div>

                        <div className="mt-8 flex justify-end">
                            <button
                                onClick={handleUpload}
                                disabled={!file || loading}
                                className="w-full md:w-auto px-8 py-3 bg-primary-600 text-white rounded-xl shadow-lg hover:bg-primary-700 transition-all disabled:opacity-50 font-bold flex items-center justify-center gap-2"
                            >
                                {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent animate-spin rounded-full"></div> : '🔍 Analyze File'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {mappingData && mode === 'mapping' && (
                <div className="animate-fade-in space-y-6">
                    <div className="zoho-card !p-0">
                        <div className="p-6 md:p-8">
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold">2</div>
                                    <h2 className="text-xl font-bold text-gray-900">Map Your Columns</h2>
                                </div>
                                <span className="self-start px-3 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase tracking-wider">Custom Format Detected</span>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 md:gap-12">
                                <div className="space-y-4">
                                    <p className="text-xs text-gray-600 mb-6 bg-blue-50 p-4 rounded-xl border border-blue-100">
                                        Match the system fields with your Excel columns.
                                    </p>
                                    <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-100">
                                        {appFields.map((field) => (
                                            <div key={field.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-2 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-slate-100 group">
                                                <div>
                                                    <span className="text-xs font-bold text-slate-700 block">{field.label} {field.required && <span className="text-red-500">*</span>}</span>
                                                    <span className="text-[10px] text-slate-400">Target Field</span>
                                                </div>
                                                <select
                                                    className="text-xs border-slate-200 rounded-md bg-white focus:ring-primary-500 min-w-full sm:min-w-[160px]"
                                                    value={mapping[field.key] || ''}
                                                    onChange={(e) => handleMappingChange(field.key, e.target.value)}
                                                >
                                                    <option value="">-- Ignored --</option>
                                                    {mappingData.headers.map((h, i) => (
                                                        <option key={i} value={h}>{h}</option>
                                                    ))}
                                                </select>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Live Data Preview</h3>
                                    <div className="responsive-table-container bg-gray-900 rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
                                        <table className="w-full text-left text-gray-400">
                                            <thead className="bg-gray-800">
                                                <tr>
                                                    <th className="px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-tighter">Row</th>
                                                    {appFields.filter(f => mapping[f.key]).slice(0, 3).map(f => (
                                                        <th key={f.key} className="px-4 py-3 text-[10px] font-bold text-primary-400 uppercase tracking-tighter">{f.label}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-800">
                                                {mappingData.previewRows.map((row, idx) => (
                                                    <tr key={idx} className="hover:bg-gray-800/50 transition-colors">
                                                        <td className="px-4 py-3 text-[10px] text-gray-600">{idx + 1}</td>
                                                        {appFields.filter(f => mapping[f.key]).slice(0, 3).map(f => {
                                                            const headerIdx = mappingData.headers.indexOf(mapping[f.key]);
                                                            return <td key={f.key} className="px-4 py-3 text-[10px] truncate max-w-[100px]">{row[headerIdx] || '-'}</td>
                                                        })}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                    <p className="text-[10px] text-gray-400 italic px-1">Showing sample preview of first 5 rows.</p>
                                </div>
                            </div>

                            <div className="mt-12 flex flex-col sm:flex-row justify-between items-center bg-gray-50 -m-6 md:-m-8 p-6 md:p-8 rounded-b-2xl border-t border-gray-100 gap-4">
                                <button onClick={resetAll} className="text-gray-500 hover:text-gray-700 font-bold flex items-center gap-2 text-sm">↺ Start Over</button>
                                <button
                                    onClick={handleFinalImport}
                                    disabled={loading}
                                    className="w-full sm:w-auto px-10 py-4 bg-green-600 text-white rounded-xl shadow-xl hover:bg-green-700 transition-all disabled:opacity-50 font-bold flex items-center justify-center gap-2 text-lg"
                                >
                                    {loading ? 'Importing...' : '🚀 Launch Bulk Import'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {parsedData && mode === 'template' && (
                <div className="animate-fade-in space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center">
                            <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest mb-1">Total Found</p>
                            <p className="text-3xl font-black text-gray-900">{parsedData.totalRows}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center border-l-4 border-l-green-500">
                            <p className="text-[10px] text-green-500 uppercase font-black tracking-widest mb-1">Pass Checks</p>
                            <p className="text-3xl font-black text-green-600">{parsedData.validRows}</p>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 flex flex-col justify-center border-l-4 border-l-red-500">
                            <p className="text-[10px] text-red-500 uppercase font-black tracking-widest mb-1">Issues Found</p>
                            <p className="text-3xl font-black text-red-600">{parsedData.invalidRows}</p>
                        </div>
                    </div>

                    <div className="zoho-card !p-0 overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">Scan Results</h3>
                            <div className="flex w-full sm:w-auto gap-4">
                                <button onClick={resetAll} className="flex-1 sm:flex-none px-4 py-2 text-gray-500 font-bold text-sm">Discard</button>
                                <button
                                    onClick={handleFinalImport}
                                    disabled={parsedData.validRows === 0 || loading}
                                    className="flex-1 sm:flex-none px-6 py-2.5 bg-green-600 text-white rounded-xl shadow-lg hover:bg-green-700 transition-all disabled:opacity-50 font-bold text-sm"
                                >
                                    {loading ? 'Importing...' : '🚀 Finalize Import'}
                                </button>
                            </div>
                        </div>
                        <div className="responsive-table-container">
                            <table className="w-full text-left">
                                <thead className="bg-white border-b border-gray-100">
                                    <tr>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Status</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Name</th>
                                        <th className="px-6 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Details</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {parsedData.data.map((row, idx) => (
                                        <tr key={idx} className={`${row.isValid ? '' : 'bg-red-50/30'}`}>
                                            <td className="px-6 py-4">
                                                {row.isValid ? 
                                                    <span className="px-2 py-0.5 bg-green-100 text-green-700 text-[9px] font-black uppercase rounded-full">OK</span> : 
                                                    <span className="px-2 py-0.5 bg-red-100 text-red-700 text-[9px] font-black uppercase rounded-full">Error</span>
                                                }
                                            </td>
                                            <td className="px-6 py-4 text-xs font-bold text-gray-900">{row.data.name || 'Unnamed Item'}</td>
                                            <td className="px-6 py-4 text-[10px] text-gray-500 italic max-w-[200px] truncate">{row.errors.join(', ') || row.data.sku}</td>
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
