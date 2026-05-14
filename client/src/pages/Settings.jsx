import { useState, useContext, useEffect, useRef } from 'react';
import { InventoryContext } from '../context/InventoryContext';
import { generatePreviewHtml } from '../utils/printTemplates';
import api from '../utils/api';
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
    const { billingSettings, fetchBillingSettings, updateBillingSettings } = useContext(InventoryContext);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('company');
    const [previewTemplate, setPreviewTemplate] = useState(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoPreview, setLogoPreview] = useState('');
    const logoInputRef = useRef(null);

    const [formData, setFormData] = useState({
        // Company
        companyName: '',
        address: '',
        phone1: '',
        phone2: '',
        gstNumber: '',
        invoicePrefix: 'INV',
        estimatePrefix: 'EST',
        industry: 'generic',
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
            logoUrl: '',
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
                industry: billingSettings.industry || 'generic',
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
                    logoUrl: billingSettings.branding?.logoUrl || '',
                    tagline: billingSettings.branding?.tagline || '',
                    website: billingSettings.branding?.website || '',
                    email: billingSettings.branding?.email || '',
                    bankName: billingSettings.branding?.bankName || '',
                    accountNumber: billingSettings.branding?.accountNumber || '',
                    ifscCode: billingSettings.branding?.ifscCode || '',
                    termsAndConditions: billingSettings.branding?.termsAndConditions || '1. Goods once sold will not be taken back.\n2. No responsibility for breakages after leaving premises.\n3. E. & O.E.',
                },
            });
            // Sync logo preview from saved settings
            setLogoPreview(billingSettings.branding?.logoUrl || '');
        }
    }, [billingSettings]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
    };

    const handleIndustryChange = (e) => {
        const industry = e.target.value;
        let unitConfig = { ...formData.unitConfig };

        if (industry === 'tiles') {
            unitConfig = {
                quantityBasis: 'sqft',
                secondaryUnit: 'boxes',
                rateBasis: 'per_sqft',
                quantityLabel: 'SqFt',
                secondaryLabel: 'Box',
                rateLabel: 'Rate (SqFt)'
            };
        } else if (industry === 'retail') {
            unitConfig = {
                quantityBasis: 'pieces',
                secondaryUnit: 'boxes',
                rateBasis: 'per_piece',
                quantityLabel: 'Qty',
                secondaryLabel: 'Packing',
                rateLabel: 'Rate'
            };
        } else if (industry === 'machine_shop') {
            unitConfig = {
                quantityBasis: 'pieces',
                secondaryUnit: 'none',
                rateBasis: 'per_piece',
                quantityLabel: 'Qty',
                secondaryLabel: '',
                rateLabel: 'Rate'
            };
        } else if (industry === 'electronics') {
            unitConfig = {
                quantityBasis: 'pieces',
                secondaryUnit: 'none',
                rateBasis: 'per_piece',
                quantityLabel: 'Qty',
                secondaryLabel: '',
                rateLabel: 'Rate'
            };
        } else if (industry === 'medical') {
            unitConfig = {
                quantityBasis: 'pieces',
                secondaryUnit: 'boxes',
                rateBasis: 'per_piece',
                quantityLabel: 'Strips / Pcs',
                secondaryLabel: 'Packing',
                rateLabel: 'Rate'
            };
        }

        setFormData(prev => ({ 
            ...prev, 
            industry,
            unitConfig
        }));
        toast.success(`Applied ${industry} preset! Don't forget to save.`);
    };

    const handleNested = (section, key, value) => {
        setFormData(prev => ({
            ...prev,
            [section]: { ...prev[section], [key]: value },
        }));
    };

    const handleLogoUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        // Local preview immediately
        setLogoPreview(URL.createObjectURL(file));
        setLogoUploading(true);
        try {
            const form = new FormData();
            form.append('logo', file);
            const res = await api.post('/settings/billing/logo', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const newLogoUrl = res.data?.data?.logoUrl;
            setLogoPreview(newLogoUrl || logoPreview);
            setFormData(prev => ({
                ...prev,
                branding: { ...prev.branding, logoUrl: newLogoUrl || prev.branding.logoUrl }
            }));
            if (fetchBillingSettings) await fetchBillingSettings();
            toast.success('Logo uploaded successfully!');
        } catch (err) {
            toast.error('Failed to upload logo');
            setLogoPreview(billingSettings?.branding?.logoUrl || '');
        } finally {
            setLogoUploading(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    const handleLogoRemove = async () => {
        setLogoUploading(true);
        try {
            await api.delete('/settings/billing/logo');
            setLogoPreview('');
            setFormData(prev => ({
                ...prev,
                branding: { ...prev.branding, logoUrl: '' }
            }));
            if (fetchBillingSettings) await fetchBillingSettings();
            toast.success('Logo removed');
        } catch {
            toast.error('Failed to remove logo');
        } finally {
            setLogoUploading(false);
        }
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
                                    💡 These settings define how items are measured and priced. Choose an industry preset for standard real-world configurations, then customize if needed.
                                </div>

                                <div className="pt-2">
                                    <SelectField label="Industry Template (Suggested Defaults)"
                                        name="industry" value={formData.industry}
                                        onChange={handleIndustryChange}
                                        options={[
                                            { value: 'generic', label: 'Generic (Manual Config)' },
                                            { value: 'retail', label: 'Fancy Store / Retail' },
                                            { value: 'tiles', label: 'Tiles & Sanitary Ware' },
                                            { value: 'machine_shop', label: 'Machine Shop / Fabrication' },
                                            { value: 'electronics', label: 'Electronics / Appliances' },
                                            { value: 'medical', label: 'Pharmacy / Medical' },
                                        ]}
                                    />
                                </div>

                                <div className="pt-4 border-t border-gray-100">
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
                                        Print Template Preview
                                    </h2>
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        {[1, 2, 3].map(t => (
                                            <button key={t} type="button"
                                                onClick={() => handleNested('documentConfig', 'invoiceTemplate', t)}
                                                className={`group border-2 rounded-xl p-4 text-center transition-all relative ${
                                                    formData.documentConfig.invoiceTemplate === t
                                                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-sm transform scale-[1.02]'
                                                        : 'border-gray-200 text-gray-400 hover:border-gray-400 hover:bg-gray-50'
                                                }`}
                                            >
                                                <div className="w-full aspect-[3/4] bg-white border border-gray-300 shadow-sm rounded-md mb-4 flex flex-col p-2 relative overflow-hidden mx-auto pointer-events-none">
                                                    {/* existing specific template code */}
                                                    {t === 1 && (
                                                        <>
                                                            <div className="w-full border-b-[2px] border-gray-900 pb-2 flex flex-col items-center">
                                                                <div className="w-3/4 h-2.5 bg-gray-900 rounded-sm mb-1.5"></div>
                                                                <div className="w-1/2 h-1.5 bg-gray-500 rounded-sm"></div>
                                                            </div>
                                                            <div className="w-full border-b border-gray-300 py-1.5 flex justify-between">
                                                                <div className="w-1/3 h-1.5 bg-gray-400 rounded-sm"></div>
                                                                <div className="w-1/3 h-1.5 bg-gray-400 rounded-sm flex flex-col items-end gap-1"><div className="w-full h-1.5 bg-gray-400"></div><div className="w-1/2 h-1 bg-gray-300"></div></div>
                                                            </div>
                                                            <div className="w-full flex-1 border-b-[2px] border-gray-900 my-1.5 flex">
                                                                <div className="w-full h-3 bg-gray-200 mb-0.5 border-b border-gray-800"></div>
                                                            </div>
                                                            <div className="mt-auto flex justify-between pt-1 h-12">
                                                                <div className="w-[45%] h-full border border-gray-800 p-1 flex flex-col gap-1"><div className="w-full h-0.5 bg-gray-300"></div><div className="w-3/4 h-0.5 bg-gray-300"></div></div>
                                                                <div className="w-[45%] h-full flex flex-col justify-end gap-1"><div className="w-full flex justify-between"><div className="w-1/3 h-0.5 bg-gray-400"></div><div className="w-1/3 h-0.5 bg-gray-400"></div></div><div className="w-full h-3 bg-gray-900 rounded-sm"></div></div>
                                                            </div>
                                                        </>
                                                    )}
                                                    {t === 2 && (
                                                        <>
                                                            <div className="flex justify-between items-start pb-2 border-b border-gray-200">
                                                                <div className="flex flex-col gap-1.5 w-[55%]">
                                                                    <div className="w-full h-2.5 bg-indigo-600 rounded-sm"></div>
                                                                    <div className="w-3/4 h-1.5 bg-gray-500 rounded-sm mb-1"></div>
                                                                    <div className="w-1/2 h-1 bg-gray-400 rounded-sm"></div>
                                                                </div>
                                                                <div className="flex flex-col gap-1 items-end w-1/3 text-right">
                                                                    <div className="w-full h-3 bg-gray-100 rounded-sm flex items-center justify-center text-[5px] text-gray-500 tracking-widest font-black uppercase">INVOICE</div>
                                                                    <div className="w-3/4 h-1 bg-gray-800 rounded-sm mt-1"></div>
                                                                    <div className="w-full h-1 bg-gray-400 rounded-sm"></div>
                                                                </div>
                                                            </div>
                                                            <div className="w-full flex-1 mt-2 flex">
                                                                <div className="w-full h-3 bg-indigo-50 border-y border-indigo-100"></div>
                                                            </div>
                                                            <div className="mt-auto flex flex-col items-end gap-1 pt-2 w-full border-t border-gray-200">
                                                                <div className="w-1/3 h-1 bg-gray-300 rounded-sm"></div>
                                                                <div className="w-1/3 h-1 bg-gray-300 rounded-sm"></div>
                                                                <div className="w-1/2 h-4 bg-indigo-600 rounded-sm mt-1"></div>
                                                            </div>
                                                        </>
                                                    )}
                                                    {t === 3 && (
                                                        <div className="h-full border border-gray-300 p-1 flex flex-col relative w-full">
                                                            <div className="w-full border-b border-gray-400 pb-1 pt-1">
                                                                <div className="flex justify-between items-center mb-1">
                                                                    <div className="w-1/5 h-1 bg-gray-400 rounded-sm"></div>
                                                                    <div className="w-1/2 h-2.5 bg-gray-800 rounded-sm"></div>
                                                                    <div className="w-1/5 h-1 bg-gray-400 rounded-sm"></div>
                                                                </div>
                                                                <div className="flex justify-center">
                                                                    <div className="w-1/3 h-1 bg-gray-300 rounded-sm"></div>
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-1 py-1.5 border-b border-gray-400">
                                                                <div className="flex-1 h-4 bg-gray-50 border-r border-gray-300"></div>
                                                                <div className="flex-1 h-4 bg-gray-50"></div>
                                                            </div>
                                                            <div className="w-full flex-1 flex border-b border-gray-400 my-1">
                                                                <div className="w-full h-2 bg-gray-200"></div>
                                                            </div>
                                                            <div className="mt-auto flex justify-between h-8">
                                                                <div className="w-1/2 h-full bg-gray-50 p-1"><div className="w-full h-1 bg-gray-300"></div></div>
                                                                <div className="w-[45%] h-full bg-gray-800 rounded-sm border-2 border-white flex flex-col items-end text-white text-[4px] p-1 justify-center">NET AMOUNT</div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                                <div className="absolute inset-0 bg-gray-900/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-xl pointer-events-auto cursor-pointer" onClick={(e) => { e.stopPropagation(); setPreviewTemplate(t); }}>
                                                    <span className="bg-white text-gray-900 text-[10px] font-black px-3 py-2 rounded-lg shadow border border-gray-200 hover:bg-gray-50 flex items-center gap-1 transform transition hover:scale-105">👁️ VIEW SAMPLE</span>
                                                </div>
                                                <div className="text-sm font-black text-gray-800">Template {t}</div>
                                                <div className="text-[10px] mt-1 font-bold text-gray-500 uppercase tracking-widest">
                                                    {t === 1 ? 'Standard' : t === 2 ? 'Minimal' : 'Classic'}
                                                </div>
                                                {formData.documentConfig.invoiceTemplate === t && (
                                                    <div className="text-[10px] mt-2 text-rose-600 font-extrabold flex items-center justify-center gap-1">
                                                        <span>✓</span> SELECTED
                                                    </div>
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
                                {/* ── Logo Upload ── */}
                                <h2 className="text-sm font-black text-gray-700 flex items-center gap-2">
                                    <span className="w-7 h-7 bg-purple-100 text-purple-600 rounded-lg flex items-center justify-center text-sm">🖼️</span>
                                    Company Logo
                                </h2>
                                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 bg-gray-50 border border-gray-200 rounded-xl">
                                    {/* Preview box */}
                                    <div className="w-24 h-24 border-2 border-dashed border-gray-300 rounded-xl flex items-center justify-center overflow-hidden bg-white flex-shrink-0">
                                        {logoPreview ? (
                                            <img
                                                src={logoPreview.startsWith('blob:') ? logoPreview : logoPreview}
                                                alt="Company Logo"
                                                className="w-full h-full object-contain p-1"
                                            />
                                        ) : (
                                            <span className="text-3xl opacity-30">🏢</span>
                                        )}
                                    </div>
                                    <div className="flex-1 space-y-2">
                                        <p className="text-xs font-bold text-gray-600">Upload your company logo to appear on invoices and quotations.</p>
                                        <p className="text-[10px] text-gray-400">PNG, JPG, WebP or SVG — Max 5MB. Recommended: transparent background, min 200×80px.</p>
                                        <div className="flex gap-2 flex-wrap">
                                            <input
                                                ref={logoInputRef}
                                                type="file"
                                                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                                className="hidden"
                                                id="logo-upload"
                                                onChange={handleLogoUpload}
                                            />
                                            <label
                                                htmlFor="logo-upload"
                                                className={`px-4 py-2 bg-rose-600 text-white text-xs font-black rounded-lg cursor-pointer hover:bg-rose-700 transition-all flex items-center gap-1.5 ${logoUploading ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                                            >
                                                {logoUploading ? '⏳ Uploading...' : '📤 Upload Logo'}
                                            </label>
                                            {logoPreview && (
                                                <button
                                                    type="button"
                                                    onClick={handleLogoRemove}
                                                    disabled={logoUploading}
                                                    className="px-4 py-2 border border-gray-300 text-gray-600 text-xs font-black rounded-lg hover:bg-gray-100 transition-all disabled:opacity-50"
                                                >
                                                    🗑️ Remove
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-2 border-t border-gray-100">
                                    <h2 className="text-sm font-black text-gray-700 flex items-center gap-2 mb-4">
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

            {/* Preview Modal */}
            {previewTemplate && (
                <div className="fixed inset-0 bg-gray-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-fade-in-up">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                            <div>
                                <h3 className="text-sm font-black text-gray-800 flex items-center gap-2">
                                    <span className="text-xl">👁️</span> 
                                    Sample Preview: Template {previewTemplate}
                                </h3>
                                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                                    This uses dummy data to showcase the layout.
                                </p>
                            </div>
                            <button type="button" onClick={() => setPreviewTemplate(null)} className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-200 text-gray-500 hover:bg-gray-300 hover:text-gray-800 transition">✕</button>
                        </div>
                        <div className="flex-1 bg-gray-200 p-4 md:p-8 overflow-hidden flex justify-center">
                            <iframe 
                                srcDoc={generatePreviewHtml(previewTemplate, formData)} 
                                className="w-[210mm] max-w-full h-full bg-white shadow-lg border-0"
                                title="Print Preview"
                            />
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settings;
