import { useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import { INDUSTRY_PRESETS } from '../config/industryPresets';
import { CURRENCIES, getCurrencyConfig } from '../config/currencies';
import { toast } from 'react-hot-toast';

const INDUSTRY_ICONS = {
    tiles:               '🧱',
    electrical_hardware: '🔌',
    medical:             '💊',
    supermarket:         '🛒',
    electronics:         '⚡',
    retail:              '👕',
    machinery:           '⚙️',
    generic:             '📦',
};

const Onboarding = () => {
    const { updateBillingSettings, billingSettings, loading: settingsLoading } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [selectedIndustry, setSelectedIndustry] = useState(null);
    const [selectedCurrency, setSelectedCurrency] = useState('INR');
    const [loading, setLoading] = useState(false);

    // If industry is already set (not generic), skip onboarding and go to dashboard
    useEffect(() => {
        if (!settingsLoading && billingSettings?.industry && billingSettings.industry !== 'generic') {
            navigate('/dashboard');
        }
    }, [billingSettings, settingsLoading, navigate]);

    const industries = Object.entries(INDUSTRY_PRESETS)
        .filter(([id]) => id !== 'generic' && !['hardware', 'grocery', 'fmcg', 'machine_shop'].includes(id))
        .map(([id, preset]) => ({ id, ...preset }));

    const handleComplete = async () => {
        if (!selectedIndustry) {
            toast.error('Please select an industry to continue');
            return;
        }

        setLoading(true);
        try {
            const preset = INDUSTRY_PRESETS[selectedIndustry];
            const { labels, ...billingConfig } = preset.billing;
            const currencyConfig = getCurrencyConfig(selectedCurrency);

            let taxLabel = 'GST';
            if (['USD'].includes(selectedCurrency)) taxLabel = 'Sales Tax';
            else if (['EUR', 'GBP', 'AED', 'SAR'].includes(selectedCurrency)) taxLabel = 'VAT';

            const settingsData = {
                industry: selectedIndustry,
                unitConfig: {
                    ...billingConfig,
                    quantityLabel: labels.quantity,
                    secondaryLabel: labels.secondary,
                    rateLabel: labels.rate,
                },
                documentConfig: {
                    currency: currencyConfig.code,
                    currencySymbol: currencyConfig.symbol,
                    taxLabel: taxLabel,
                }
            };

            const result = await updateBillingSettings(settingsData);
            if (result.success) {
                toast.success(`Welcome! Your ${preset.name} workspace (${currencyConfig.code}) is ready.`);
                navigate('/dashboard');
            } else {
                toast.error('Setup failed. Please try again.');
            }
        } catch (error) {
            toast.error('Setup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleSkip = async () => {
        // Mark as skipped so Dashboard doesn't redirect back to onboarding
        sessionStorage.setItem('onboarding_skipped', 'true');
        // Save industry as 'generic' (confirmed) so the dashboard loop check is satisfied
        try {
            await updateBillingSettings({ industry: 'generic' });
        } catch (_) {
            // If update fails, still allow navigation via sessionStorage flag
        }
        navigate('/dashboard');
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-slate-800 flex flex-col items-center justify-center p-6">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-20 left-10 w-72 h-72 bg-rose-600/10 rounded-full blur-3xl" />
                <div className="absolute bottom-20 right-10 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl" />
            </div>

            <div className="relative max-w-4xl w-full">
                {/* Header */}
                <div className="text-center mb-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 border border-white/20 rounded-full text-xs font-bold text-white/70 uppercase tracking-widest mb-6">
                        <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
                        First-Time Setup
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
                        Welcome, <span className="text-rose-400">{user?.name?.split(' ')[0] || 'there'}!</span>
                    </h1>
                    <p className="text-lg text-slate-300 font-medium max-w-xl mx-auto">
                        Choose your industry and we'll tailor the entire app — labels, fields, and workflows — specifically for your business.
                    </p>
                </div>

                {/* Industry Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-10">
                    {industries.map((industry) => {
                        const isSelected = selectedIndustry === industry.id;
                        return (
                            <div
                                key={industry.id}
                                onClick={() => setSelectedIndustry(industry.id)}
                                className={`relative cursor-pointer group rounded-2xl p-5 border-2 transition-all duration-200 ${
                                    isSelected
                                        ? 'bg-rose-600/20 border-rose-500 shadow-2xl shadow-rose-900/30 scale-[1.02]'
                                        : 'bg-white/5 border-white/10 hover:border-white/30 hover:bg-white/10'
                                }`}
                            >
                                {isSelected && (
                                    <div className="absolute top-4 right-4 w-6 h-6 bg-rose-500 rounded-full flex items-center justify-center text-white text-xs font-black shadow-lg">
                                        ✓
                                    </div>
                                )}
                                <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200 inline-block">
                                    {INDUSTRY_ICONS[industry.id] || '📦'}
                                </div>
                                <h3 className={`text-base font-black mb-1.5 ${isSelected ? 'text-rose-300' : 'text-white'}`}>
                                    {industry.name}
                                </h3>
                                <p className="text-xs text-slate-400 font-medium leading-relaxed">
                                    {industry.description}
                                </p>
                                {/* Show key features for each industry */}
                                {industry.productFields?.length > 0 && (
                                    <div className="mt-3 flex flex-wrap gap-1">
                                        {industry.productFields.slice(0, 3).map(f => (
                                            <span key={f.name} className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                isSelected ? 'bg-rose-500/30 text-rose-300' : 'bg-white/10 text-slate-400'
                                            }`}>
                                                {f.label}
                                            </span>
                                        ))}
                                        {industry.productFields.length > 3 && (
                                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                                                isSelected ? 'bg-rose-500/30 text-rose-300' : 'bg-white/10 text-slate-400'
                                            }`}>
                                                +{industry.productFields.length - 3} more
                                            </span>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* Currency Selection Section */}
                <div className="mb-10 p-6 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                        <div>
                            <h3 className="text-lg font-black text-white flex items-center gap-2">
                                <span>💰</span> Choose Base Currency
                            </h3>
                            <p className="text-xs text-slate-300">
                                Select the currency your business operates in (Invoices, Quotations, POs, and Reports).
                            </p>
                        </div>
                        <div className="px-3 py-1.5 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-300 font-black text-sm">
                            Selected: {selectedCurrency} ({getCurrencyConfig(selectedCurrency).symbol})
                        </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2.5">
                        {CURRENCIES.slice(0, 12).map((curr) => {
                            const isSelected = selectedCurrency === curr.code;
                            return (
                                <button
                                    key={curr.code}
                                    type="button"
                                    onClick={() => setSelectedCurrency(curr.code)}
                                    className={`p-2.5 rounded-xl border text-left transition-all ${
                                        isSelected
                                            ? 'bg-rose-600 border-rose-400 text-white shadow-lg shadow-rose-900/50 scale-[1.03]'
                                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:border-white/20'
                                    }`}
                                >
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="text-base">{curr.flag}</span>
                                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-slate-400'}`}>
                                            {curr.symbol}
                                        </span>
                                    </div>
                                    <div className="text-xs font-black truncate">{curr.code}</div>
                                    <div className={`text-[10px] truncate ${isSelected ? 'text-rose-100' : 'text-slate-400'}`}>
                                        {curr.country || curr.name}
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={handleComplete}
                        disabled={loading || !selectedIndustry}
                        className="group relative px-10 py-3.5 bg-rose-600 text-white rounded-full font-black text-base shadow-2xl shadow-rose-900/40 hover:bg-rose-500 disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed transition-all duration-200 active:scale-95 min-w-[220px]"
                    >
                        {loading ? (
                            <span className="flex items-center gap-2 justify-center">
                                <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Setting up...
                            </span>
                        ) : (
                            'Finish Setup & Start →'
                        )}
                    </button>

                    <button
                        onClick={handleSkip}
                        className="px-8 py-3.5 bg-transparent border border-white/20 text-slate-400 rounded-full font-bold text-sm hover:border-white/40 hover:text-white transition-all duration-200"
                    >
                        Skip for now →
                    </button>
                </div>

                <p className="text-center mt-8 text-xs text-slate-600 font-bold uppercase tracking-widest">
                    You can change your industry anytime from Settings
                </p>
            </div>
        </div>
    );
};

export default Onboarding;
