import { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { InventoryContext } from '../context/InventoryContext';
import { AuthContext } from '../context/AuthContext';
import { INDUSTRY_PRESETS } from '../config/industryPresets';
import { toast } from 'react-hot-toast';

const Onboarding = () => {
    const { updateBillingSettings } = useContext(InventoryContext);
    const { user } = useContext(AuthContext);
    const navigate = useNavigate();
    const [selectedIndustry, setSelectedIndustry] = useState(null);
    const [loading, setLoading] = useState(false);

    const industries = Object.keys(INDUSTRY_PRESETS).map(id => ({
        id,
        ...INDUSTRY_PRESETS[id]
    }));

    const handleComplete = async () => {
        if (!selectedIndustry) {
            toast.error('Please select an industry to continue');
            return;
        }

        setLoading(true);
        try {
            const preset = INDUSTRY_PRESETS[selectedIndustry];
            const { labels, ...billingConfig } = preset.billing;
            const settingsData = {
                industry: selectedIndustry,
                unitConfig: {
                    ...billingConfig,
                    quantityLabel: labels.quantity,
                    secondaryLabel: labels.secondary,
                    rateLabel: labels.rate,
                }
            };

            const result = await updateBillingSettings(settingsData);
            if (result.success) {
                toast.success(`Welcome! Your ${preset.name} workspace is ready.`);
                navigate('/dashboard');
            }
        } catch (error) {
            toast.error('Setup failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
            <div className="max-w-4xl w-full">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-gray-900 mb-4 tracking-tight">
                        Welcome to <span className="text-rose-600">InventoryPro</span>
                    </h1>
                    <p className="text-lg text-gray-600 font-medium">
                        Let's personalize your workspace. Which industry best describes your business?
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                    {industries.map((industry) => (
                        <div 
                            key={industry.id}
                            onClick={() => setSelectedIndustry(industry.id)}
                            className={`relative cursor-pointer group rounded-2xl p-6 border-2 transition-all duration-300 ${
                                selectedIndustry === industry.id 
                                ? 'bg-rose-50 border-rose-600 shadow-xl scale-105' 
                                : 'bg-white border-gray-100 hover:border-rose-200 hover:shadow-lg'
                            }`}
                        >
                            {selectedIndustry === industry.id && (
                                <div className="absolute top-4 right-4 w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center text-white text-xs">
                                    ✓
                                </div>
                            )}
                            <div className="text-3xl mb-4 group-hover:scale-110 transition-transform">
                                {industry.id === 'tiles' ? '🧱' : 
                                 industry.id === 'electronics' ? '⚡' : 
                                 industry.id === 'retail' ? '👕' : 
                                 industry.id === 'medical' ? '💊' : '📦'}
                            </div>
                            <h3 className={`text-lg font-black mb-2 ${selectedIndustry === industry.id ? 'text-rose-900' : 'text-gray-800'}`}>
                                {industry.name}
                            </h3>
                            <p className="text-xs text-gray-500 font-medium leading-relaxed">
                                {industry.description}
                            </p>
                        </div>
                    ))}
                </div>

                <div className="flex justify-center">
                    <button
                        onClick={handleComplete}
                        disabled={loading || !selectedIndustry}
                        className="group relative px-12 py-4 bg-gray-900 text-white rounded-full font-black text-lg shadow-2xl hover:bg-rose-600 disabled:bg-gray-300 transition-all active:scale-95 overflow-hidden"
                    >
                        <span className="relative z-10">Finish Setup & Start Selling</span>
                        <div className="absolute inset-0 bg-rose-600 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
                    </button>
                </div>

                <p className="text-center mt-8 text-sm text-gray-400 font-bold uppercase tracking-widest">
                    You can change these settings later in the settings panel
                </p>
            </div>
        </div>
    );
};

export default Onboarding;
