import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const Settings = () => {
    const { billingSettings, updateBillingSettings, fetchBillingSettings } = useContext(InventoryContext);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        companyName: '',
        address: '',
        phone1: '',
        phone2: '',
        gstNumber: '',
        invoicePrefix: '',
        estimatePrefix: '',
    });

    useEffect(() => {
        if (billingSettings) {
            setFormData({
                companyName: billingSettings.companyName || '',
                address: billingSettings.address || '',
                phone1: billingSettings.phone1 || '',
                phone2: billingSettings.phone2 || '',
                gstNumber: billingSettings.gstNumber || '',
                invoicePrefix: billingSettings.invoicePrefix || 'INV',
                estimatePrefix: billingSettings.estimatePrefix || 'EST',
            });
        }
    }, [billingSettings]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await updateBillingSettings(formData);
        if (result.success) {
            toast.success('Settings saved successfully');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Billing Settings</h1>
                    <p className="text-gray-500 mt-1">Customize your business profile and bill headers</p>
                </div>
                <div className="text-4xl text-primary-600 bg-primary-50 p-3 rounded-2xl shadow-sm">⚙️</div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl border border-gray-100 overflow-hidden">
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-8">
                        {/* Company Identity */}
                        <section className="space-y-6">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center">
                                <span className="w-8 h-8 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center mr-3 text-sm">🏢</span>
                                Business Identity
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Company Name</label>
                                    <input
                                        type="text"
                                        name="companyName"
                                        value={formData.companyName}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-semibold"
                                        placeholder="e.g. Sri Alagar Tiles & Granites"
                                    />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Office Address</label>
                                    <textarea
                                        name="address"
                                        value={formData.address}
                                        onChange={handleChange}
                                        rows="3"
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-medium"
                                        placeholder="Full business address..."
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">GST / Tax Number</label>
                                    <input
                                        type="text"
                                        name="gstNumber"
                                        value={formData.gstNumber}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold tracking-wider"
                                        placeholder="Optional GSTIN"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Contact Info */}
                        <section className="space-y-6 pt-6 border-t border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center">
                                <span className="w-8 h-8 bg-green-100 text-green-600 rounded-lg flex items-center justify-center mr-3 text-sm">📞</span>
                                Contact Details
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Primary Phone</label>
                                    <input
                                        type="text"
                                        name="phone1"
                                        value={formData.phone1}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-semibold"
                                        placeholder="e.g. 98765 43210"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Secondary Phone</label>
                                    <input
                                        type="text"
                                        name="phone2"
                                        value={formData.phone2}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-semibold"
                                        placeholder="Secondary contact"
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Invoice Preferences */}
                        <section className="space-y-6 pt-6 border-t border-gray-100">
                            <h2 className="text-lg font-bold text-gray-800 flex items-center">
                                <span className="w-8 h-8 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center mr-3 text-sm">📄</span>
                                Billing Preferences
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Invoice Prefix</label>
                                    <input
                                        type="text"
                                        name="invoicePrefix"
                                        value={formData.invoicePrefix}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-primary-700"
                                        placeholder="e.g. INV"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Estimate Prefix</label>
                                    <input
                                        type="text"
                                        name="estimatePrefix"
                                        value={formData.estimatePrefix}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-primary-500/10 focus:border-primary-500 outline-none transition-all font-bold text-purple-700"
                                        placeholder="e.g. EST"
                                    />
                                </div>
                            </div>
                        </section>

                        <div className="pt-8 items-center flex justify-end">
                            <button
                                type="submit"
                                disabled={loading}
                                className="px-10 py-4 bg-primary-600 hover:bg-primary-700 text-white font-black uppercase tracking-widest rounded-xl transition-all shadow-xl hover:shadow-primary-200 disabled:opacity-50 flex items-center space-x-2"
                            >
                                <span>{loading ? 'Saving...' : 'Save Settings'}</span>
                                {!loading && <span>💾</span>}
                            </button>
                        </div>
                    </form>
                </div>
                <div className="bg-gray-50 p-6 border-t border-gray-100">
                    <p className="text-xs text-gray-500 italic text-center">
                        * These details will appear as the header on all your printed bills and estimation sheets.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Settings;
