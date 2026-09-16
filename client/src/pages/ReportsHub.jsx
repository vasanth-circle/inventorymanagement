import React from 'react';
import { useNavigate } from 'react-router-dom';

const ReportsHub = () => {
    const navigate = useNavigate();

    const reportCategories = [
        {
            title: "Analytics & Performance",
            description: "View sales performance, current stock, and item-wise analytics.",
            icon: "📊",
            reports: [
                { name: "Analytics Dashboard", path: "/reports", description: "Comprehensive dashboard for sales, stock, and damaged goods." }
            ]
        },
        {
            title: "Financials",
            description: "Track money owed, ledgers, and profitability.",
            icon: "💰",
            reports: [
                { name: "Financial Ledgers", path: "/ledger-reports", description: "Unified balances and positions for all your parties." },
                { name: "Profit Tracking", path: "/profit-tracking", description: "Analyze profit margins and cost of goods sold." }
            ]
        },
        {
            title: "Operations & Management",
            description: "Deep dive into custom data and track internal expenses.",
            icon: "⚙️",
            reports: [
                { name: "Custom Reports", path: "/custom-reports", description: "Build your own reports using custom filters and dates." },
                { name: "Company Expenses", path: "/expenses", description: "Manage and report on internal company expenses." }
            ]
        }
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto animate-in">
            <div className="mb-8">
                <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reports Hub</h1>
                <p className="text-gray-500 mt-1">Access all your analytics, financial statements, and operational reports in one place.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {reportCategories.map((category, idx) => (
                    <div key={idx} className="glass-panel p-6 flex flex-col h-full hover:shadow-lg transition-shadow duration-200">
                        <div className="flex items-center gap-3 mb-4">
                            <span className="text-4xl">{category.icon}</span>
                            <div>
                                <h2 className="text-xl font-bold text-gray-900">{category.title}</h2>
                            </div>
                        </div>
                        <p className="text-sm text-gray-500 mb-6 flex-grow">{category.description}</p>
                        
                        <div className="space-y-3">
                            {category.reports.map((report, rIdx) => (
                                <button
                                    key={rIdx}
                                    onClick={() => navigate(report.path)}
                                    className="w-full text-left p-3 rounded-lg border border-gray-200 hover:border-primary-500 hover:bg-primary-50 transition-colors duration-150 flex flex-col"
                                >
                                    <span className="font-semibold text-gray-900">{report.name}</span>
                                    <span className="text-xs text-gray-500 mt-1">{report.description}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default ReportsHub;
