import { useState, useContext, useEffect } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import toast from 'react-hot-toast';

const TABS = [
    { id: 'company',   label: 'Company',   icon: '🏢' },
    { id: 'units',     label: 'Units & Rates', icon: '📐' },
    { id: 'documents', label: 'Documents',  icon: '📄' },
    { id: 'branding',  label: 'Branding & Bank', icon: '🏦' },
];

const InputField = ({ label, name, value, onChange, type = 'text', placeholder = '' }) => (
    <div className="space-y-1">
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{label}</label>
        <input
            type={type}
            name={name}
            value={value || ''}
            onChange={onChange}
            placeholder={placeholder}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-semibold text-sm"
        />
    </div>
);

const SelectField = ({ label, name, value, onChange, options }) => (
    <div className="space-y-1">
        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">{label}</label>
        <select
            name={name}
            value={value || ''}
            onChange={onChange}
            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-semibold text-sm cursor-pointer"
        >
            {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
    </div>
);

const Settings = () => {
    const { billingSettings, updateBillingSettings } = useContext(InventoryContext);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('company');

    const [formData, setFormData] = useState({
        // Company
        companyName: '',
        address: '',
        phone1: '',
        phone2: '',
        gstNumber: '',
        invoicePrefix: 'INV',
        estimatePrefix: 'EST',
        // Unit config
        unitConfig: {
            quantityBasis: 'units',
            secondaryUnit: 'none',
            rateBasis: 'per_unit',
            quantityLabel: 'Qty',
            secondaryLabel: '',
            rateLabel: 'Rate',
        },
        // Document config
        documentConfig: {
            quotationPrefix: 'QUO',
            quotationTitle: 'Quotation',
            invoiceTitle: 'Tax Invoice',
            quotationTemplate: 1,
            invoiceTemplate: 1,
            currency: 'INR',
            currencySymbol: '₹',
            taxLabel: 'GST',
            defaultTaxRate: 18,
            showSecondaryQty: false,
        },
        // Branding
        branding: {
            tagline: '',
            website: '',
            email: '',
            bankName: '',
            accountNumber: '',
            ifscCode: '',
            termsAndConditions: '1. Goods once sold will not be taken back.\n2. No responsibility for breakages after leaving premises.\n3. E. & O.E.',
        },
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
                unitConfig: {
                    quantityBasis: billingSettings.unitConfig?.quantityBasis || 'units',
                    secondaryUnit: billingSettings.unitConfig?.secondaryUnit || 'none',
                    rateBasis: billingSettings.unitConfig?.rateBasis || 'per_unit',
                    quantityLabel: billingSettings.unitConfig?.quantityLabel || 'Qty',
                    secondaryLabel: billingSettings.unitConfig?.secondaryLabel || '',
                    rateLabel: billingSettings.unitConfig?.rateLabel || 'Rate',
                },
                documentConfig: {
                    quotationPrefix: billingSettings.documentConfig?.quotationPrefix || 'QUO',
                    quotationTitle: billingSettings.documentConfig?.quotationTitle || 'Quotation',
                    invoiceTitle: billingSettings.documentConfig?.invoiceTitle || 'Tax Invoice',
                    quotationTemplate: billingSettings.documentConfig?.quotationTemplate || 1,
                    invoiceTemplate: billingSettings.documentConfig?.invoiceTemplate || 1,
                    currency: billingSettings.documentConfig?.currency || 'INR',
                    currencySymbol: billingSettings.documentConfig?.currencySymbol || '₹',
                    taxLabel: billingSettings.documentConfig?.taxLabel || 'GST',
                    defaultTaxRate: billingSettings.documentConfig?.defaultTaxRate ?? 18,
                    showSecondaryQty: billingSettings.documentConfig?.showSecondaryQty || false,
                },
                branding: {
                    tagline: billingSettings.branding?.tagline || '',
                    website: billingSettings.branding?.website || '',
                    email: billingSettings.branding?.email || '',
                    bankName: billingSettings.branding?.bankName || '',
                    accountNumber: billingSettings.branding?.accountNumber || '',
                    ifscCode: billingSettings.branding?.ifscCode || '',
                    termsAndConditions: billingSettings.branding?.termsAndConditions || '1. Goods once sold will not be taken back.\n2. No responsibility for breakages after leaving premises.\n3. E. & O.E.',
                },
            });
        }
    }, [billingSettings]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleNested = (section, key, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: value },
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const result = await updateBillingSettings(formData);
        if (result?.success) toast.success('Settings saved successfully!');
        setLoading(false);
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between pb-2">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Business Settings</h1>
                    <p className="text-sm text-gray-400 mt-0.5">Configure your company profile, units, templates & branding</p>
                </div>
                <div className="text-4xl bg-gray-50 p-3 rounded-2xl border border-gray-100">⚙️</div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
                {TABS.map(tab => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setActiveTab(tab.id)}
                        className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all ${
                            activeTab === tab.id
                                ? 'bg-white text-gray-900 shadow-sm'
                                : 'text-gray-400 hover:text-gray-600'
                        }`}
                    >
                        <span>{tab.icon}</span>
                        <span className="hidden sm:inline">{tab.label}</span>
                    </button>
                ))}
            </div>

            <form onSubmit={handleSubmit}>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 space-y-6">

                        {/* ── TAB: COMPANY ─────────────────────────────────────────────────── */}
                        {activeTab === 'company' && (
                            <>
                                <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">🏢</span>
                                    Business Identity
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <div className="md:col-span-2">
                                        <InputField label="Company Name" name="companyName" value={formData.companyName} onChange={handleChange} placeholder="e.g. Sri Alagar Tiles & Granites" />
                                    </div>
                                    <div className="md:col-span-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest px-1 mb-1">Office Address</label>
                                        <textarea name="address" value={formData.address} onChange={handleChange} rows={3}
                                            className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-medium text-sm"
                                            placeholder="Full business address..." />
                                    </div>
                                    <InputField label="Primary Phone" name="phone1" value={formData.phone1} onChange={handleChange} placeholder="e.g. 98765 43210" />
                                    <InputField label="Secondary Phone" name="phone2" value={formData.phone2} onChange={handleChange} placeholder="Secondary contact" />
                                    <InputField label="GST / Tax Number" name="gstNumber" value={formData.gstNumber} onChange={handleChange} placeholder="Optional GSTIN" />
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                                        <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm">🔢</span>
                                        Number Prefixes
                                    </h2>
                                    <div className="grid grid-cols-2 gap-5">
                                        <InputField label="Invoice Prefix" name="invoicePrefix" value={formData.invoicePrefix} onChange={handleChange} placeholder="INV" />
                                        <InputField label="Estimate Prefix" name="estimatePrefix" value={formData.estimatePrefix} onChange={handleChange} placeholder="EST" />
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── TAB: UNITS & RATES ───────────────────────────────────────────── */}
                        {activeTab === 'units' && (
                            <>
                                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 font-medium">
                                    💡 These settings define how items are measured and priced. They affect all invoices and quotations for this company. Choose based on your industry.
                                </div>

                                <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-amber-100 text-amber-600 rounded-lg flex items-center justify-center text-sm">📦</span>
                                    Quantity Configuration
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <SelectField label="Primary Quantity Basis (what you sell in)"
                                        name="quantityBasis" value={formData.unitConfig.quantityBasis}
                                        onChange={e => handleNested('unitConfig', 'quantityBasis', e.target.value)}
                                        options={[
                                            { value: 'units', label: 'Units (Generic)' },
                                            { value: 'pieces', label: 'Pieces' },
                                            { value: 'boxes', label: 'Boxes' },
                                            { value: 'sqft', label: 'Square Feet (SqFt)' },
                                            { value: 'meters', label: 'Meters' },
                                            { value: 'kg', label: 'Kilograms (Kg)' },
                                            { value: 'liters', label: 'Liters' },
                                        ]}
                                    />
                                    <SelectField label="Secondary Unit (optional, shown with primary)"
                                        name="secondaryUnit" value={formData.unitConfig.secondaryUnit}
                                        onChange={e => handleNested('unitConfig', 'secondaryUnit', e.target.value)}
                                        options={[
                                            { value: 'none', label: 'None (no secondary unit)' },
                                            { value: 'pieces', label: 'Pieces' },
                                            { value: 'boxes', label: 'Boxes' },
                                            { value: 'sqft', label: 'Square Feet' },
                                            { value: 'meters', label: 'Meters' },
                                        ]}
                                    />
                                    <InputField label="Quantity Column Label (on invoice)"
                                        name="quantityLabel" value={formData.unitConfig.quantityLabel}
                                        onChange={e => handleNested('unitConfig', 'quantityLabel', e.target.value)}
                                        placeholder="e.g. Qty (SqFt)" />
                                    <InputField label="Secondary Column Label (leave blank to hide)"
                                        name="secondaryLabel" value={formData.unitConfig.secondaryLabel}
                                        onChange={e => handleNested('unitConfig', 'secondaryLabel', e.target.value)}
                                        placeholder="e.g. Boxes" />
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                                        <span className="w-7 h-7 bg-green-100 text-green-600 rounded-lg flex items-center justify-center text-sm">💰</span>
                                        Rate Configuration
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <SelectField label="Rate Basis (price is charged per...)"
                                            name="rateBasis" value={formData.unitConfig.rateBasis}
                                            onChange={e => handleNested('unitConfig', 'rateBasis', e.target.value)}
                                            options={[
                                                { value: 'per_unit', label: 'Per Unit' },
                                                { value: 'per_piece', label: 'Per Piece' },
                                                { value: 'per_box', label: 'Per Box' },
                                                { value: 'per_sqft', label: 'Per Square Foot' },
                                                { value: 'per_meter', label: 'Per Meter' },
                                                { value: 'per_kg', label: 'Per Kilogram' },
                                            ]}
                                        />
                                        <InputField label="Rate Column Label (on invoice)"
                                            name="rateLabel" value={formData.unitConfig.rateLabel}
                                            onChange={e => handleNested('unitConfig', 'rateLabel', e.target.value)}
                                            placeholder="e.g. Rate (per sqft)" />
                                    </div>
                                </div>

                                {/* Example Preview */}
                                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3">Preview — Invoice Column Headers</p>
                                    <div className="flex gap-2 text-xs font-bold text-gray-600">
                                        {['S.No', 'Description', 'HSN',
                                            formData.unitConfig.quantityLabel || 'Qty',
                                            ...(formData.unitConfig.secondaryLabel ? [formData.unitConfig.secondaryLabel] : []),
                                            formData.unitConfig.rateLabel || 'Rate',
                                            'Amount', 'Total'
                                        ].map((col, i) => (
                                            <span key={i} className="px-2 py-1 bg-white border border-gray-200 rounded text-[10px]">{col}</span>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── TAB: DOCUMENTS ──────────────────────────────────────────────── */}
                        {activeTab === 'documents' && (
                            <>
                                <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-rose-100 text-rose-600 rounded-lg flex items-center justify-center text-sm">📋</span>
                                    Quotation Settings
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <InputField label="Quotation Prefix" name="quotationPrefix"
                                        value={formData.documentConfig.quotationPrefix}
                                        onChange={e => handleNested('documentConfig', 'quotationPrefix', e.target.value)}
                                        placeholder="QUO" />
                                    <InputField label="Quotation Document Title"
                                        name="quotationTitle" value={formData.documentConfig.quotationTitle}
                                        onChange={e => handleNested('documentConfig', 'quotationTitle', e.target.value)}
                                        placeholder="Quotation" />
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                                        <span className="w-7 h-7 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center text-sm">🧾</span>
                                        Invoice Settings
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                        <InputField label="Invoice Document Title" name="invoiceTitle"
                                            value={formData.documentConfig.invoiceTitle}
                                            onChange={e => handleNested('documentConfig', 'invoiceTitle', e.target.value)}
                                            placeholder="Tax Invoice" />
                                        <InputField label="Currency Symbol" name="currencySymbol"
                                            value={formData.documentConfig.currencySymbol}
                                            onChange={e => handleNested('documentConfig', 'currencySymbol', e.target.value)}
                                            placeholder="₹" />
                                        <InputField label="Tax Label (CGST/SGST/VAT/GST)"
                                            name="taxLabel" value={formData.documentConfig.taxLabel}
                                            onChange={e => handleNested('documentConfig', 'taxLabel', e.target.value)}
                                            placeholder="GST" />
                                        <InputField label="Default Tax Rate (%)" type="number"
                                            name="defaultTaxRate" value={formData.documentConfig.defaultTaxRate}
                                            onChange={e => handleNested('documentConfig', 'defaultTaxRate', parseFloat(e.target.value))}
                                            placeholder="18" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                                        <span className="w-7 h-7 bg-gray-100 text-gray-600 rounded-lg flex items-center justify-center text-sm">🖨️</span>
                                        Print Template
                                    </h2>
                                    <div className="grid grid-cols-3 gap-4">
                                        {[1, 2, 3].map(t => (
                                            <button key={t} type="button"
                                                onClick={() => handleNested('documentConfig', 'invoiceTemplate', t)}
                                                className={`border-2 rounded-xl p-4 text-center transition-all ${
                                                    formData.documentConfig.invoiceTemplate === t
                                                        ? 'border-rose-500 bg-rose-50 text-rose-700'
                                                        : 'border-gray-200 text-gray-400 hover:border-gray-300'
                                                }`}
                                            >
                                                <div className="text-2xl mb-1">📊</div>
                                                <div className="text-xs font-black">Template {t}</div>
                                                <div className="text-[9px] mt-1 text-gray-400">
                                                    {t === 1 ? 'Standard (Current)' : t === 2 ? 'Minimal / Clean' : 'Classic with header'}
                                                </div>
                                                {formData.documentConfig.invoiceTemplate === t && (
                                                    <div className="text-[9px] mt-1 text-rose-600 font-bold">✓ Selected</div>
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── TAB: BRANDING & BANK ────────────────────────────────────────── */}
                        {activeTab === 'branding' && (
                            <>
                                <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center text-sm">✨</span>
                                    Branding
                                </h2>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                    <InputField label="Tagline / Slogan" name="tagline"
                                        value={formData.branding.tagline}
                                        onChange={e => handleNested('branding', 'tagline', e.target.value)}
                                        placeholder="Your business tagline..." />
                                    <InputField label="Website" name="website"
                                        value={formData.branding.website}
                                        onChange={e => handleNested('branding', 'website', e.target.value)}
                                        placeholder="www.yourcompany.com" />
                                    <InputField label="Business Email" name="email"
                                        value={formData.branding.email}
                                        onChange={e => handleNested('branding', 'email', e.target.value)}
                                        placeholder="info@yourcompany.com" />
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                                        <span className="w-7 h-7 bg-blue-100 text-blue-600 rounded-lg flex items-center justify-center text-sm">🏦</span>
                                        Bank Details (printed on invoice footer)
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                                        <div className="md:col-span-3">
                                            <InputField label="Bank Name" name="bankName"
                                                value={formData.branding.bankName}
                                                onChange={e => handleNested('branding', 'bankName', e.target.value)}
                                                placeholder="e.g. State Bank of India" />
                                        </div>
                                        <div className="md:col-span-2">
                                            <InputField label="Account Number" name="accountNumber"
                                                value={formData.branding.accountNumber}
                                                onChange={e => handleNested('branding', 'accountNumber', e.target.value)}
                                                placeholder="Account number" />
                                        </div>
                                        <InputField label="IFSC Code" name="ifscCode"
                                            value={formData.branding.ifscCode}
                                            onChange={e => handleNested('branding', 'ifscCode', e.target.value)}
                                            placeholder="e.g. SBIN0001234" />
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
                                        <span className="w-7 h-7 bg-orange-100 text-orange-600 rounded-lg flex items-center justify-center text-sm">📜</span>
                                        Default Terms & Conditions
                                    </h2>
                                    <textarea
                                        rows={5}
                                        value={formData.branding.termsAndConditions}
                                        onChange={e => handleNested('branding', 'termsAndConditions', e.target.value)}
                                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-4 focus:ring-rose-500/10 focus:border-rose-500 outline-none transition-all font-medium text-sm"
                                        placeholder="Terms printed on every invoice / quotation..."
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1 px-1">These are printed at the bottom of every invoice and quotation. Each line becomes a separate clause.</p>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Save Bar */}
                    <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
                        <p className="text-xs text-gray-400 italic">* Changes apply to all future invoices and quotations.</p>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-8 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-lg disabled:opacity-50 flex items-center gap-2"
                        >
                            <span>{loading ? 'Saving...' : 'Save Settings'}</span>
                            {!loading && <span>💾</span>}
                        </button>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default Settings;
