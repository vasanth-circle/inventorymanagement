import { useState, useEffect } from 'react';
import api from '../utils/api';
import toast from 'react-hot-toast';

const AssetReports = () => {
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAssets = async () => {
            try {
                const { data } = await api.get('/assets');
                if(data.success) {
                    setAssets(data.data);
                }
            } catch (error) {
                toast.error(error.response?.data?.message || 'Error fetching assets for report');
            } finally {
                setLoading(false);
            }
        };
        fetchAssets();
    }, []);

    const handleExportCode = () => {
        // Simple CSV Export
        const headers = ['Asset Name', 'Type', 'Serial Number', 'Status', 'Branch', 'Assignee'];
        
        const rows = assets.map(a => [
            `"${a.name}"`,
            `"${a.assetType}"`,
            `"${a.serialNumber || 'N/A'}"`,
            `"${a.status}"`,
            `"${a.branch?.name || 'N/A'}"`,
            `"${a.assignee?.name || 'Unassigned'}"`
        ]);

        const csvContent = "data:text/csv;charset=utf-8," 
            + headers.join(",") + "\n"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", "Asset_Report.csv");
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-full min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold text-gray-900">Asset Reports</h1>
                <button
                    onClick={handleExportCode}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm font-semibold flex items-center"
                >
                    <span className="mr-2">📥</span> Export to CSV
                </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-lg font-bold text-gray-800">Complete Asset Directory</h2>
                    <span className="text-sm px-3 py-1 bg-blue-100 text-blue-800 rounded-full font-bold">{assets.length} Active Records</span>
                </div>
                <div className="p-6">
                    <p className="text-gray-600 mb-4">This table lists all historically tracked assets connected to your workspace. Use the export feature above to run advanced analytics.</p>
                    
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Name</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Type</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Identifier</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Location</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Assigned To</th>
                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {assets.map(asset => (
                                    <tr key={asset._id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">{asset.name}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{asset.assetType}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600 font-mono text-xs">
                                            {asset.serialNumber || asset.insuranceData?.policyNumber || 'N/A'}
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{asset.branch?.name || 'N/A'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{asset.assignee?.name || 'Unassigned'}</td>
                                        <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                                            <span className={`px-2 py-1 rounded-full text-xs ${asset.status === 'Available' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                                {asset.status}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AssetReports;
