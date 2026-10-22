// Format date to readable string
export const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
};

// Format date and time
export const formatDateTime = (date) => {
    return new Date(date).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

// Multi-Currency helpers
import { formatCurrencyAmount, getCurrencyConfig } from '../config/currencies';

export const getAppCurrency = () => {
    try {
        return {
            currency: localStorage.getItem('app_currency') || 'INR',
            symbol: localStorage.getItem('app_currency_symbol') || '₹'
        };
    } catch (_) {
        return { currency: 'INR', symbol: '₹' };
    }
};

export const setAppCurrency = (currency = 'INR', symbol = '₹') => {
    try {
        if (currency) localStorage.setItem('app_currency', currency);
        if (symbol) localStorage.setItem('app_currency_symbol', symbol);
    } catch (_) {}
};

// Format currency dynamically based on active tenant currency
export const formatCurrency = (amount, overrideCurrency = null, overrideSymbol = null, decimals = null) => {
    const { currency: savedCurrency, symbol: savedSymbol } = getAppCurrency();
    const curr = overrideCurrency || savedCurrency || 'INR';
    const sym = overrideSymbol || savedSymbol || '₹';
    return formatCurrencyAmount(amount, curr, sym, decimals);
};

// Export to CSV
export const exportToCSV = (data, filename) => {
    if (!data || data.length === 0) return;

    const headers = Object.keys(data[0]);
    const csvContent = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                let cell = row[header];
                if (cell === null || cell === undefined) cell = '';
                else cell = String(cell);
                
                if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
                    return `"${cell.replace(/"/g, '""')}"`;
                }
                return cell;
            }).join(',')
        )
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);

    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

// Get stock status color
export const getStockStatusColor = (status) => {
    switch (status) {
        case 'in-stock':
            return 'text-green-600 bg-green-100';
        case 'low-stock':
            return 'text-yellow-600 bg-yellow-100';
        case 'out-of-stock':
            return 'text-red-600 bg-red-100';
        default:
            return 'text-gray-600 bg-gray-100';
    }
};

// Get transaction type color
export const getTransactionTypeColor = (type) => {
    switch (type) {
        case 'inward':
            return 'text-green-600 bg-green-100';
        case 'outward':
            return 'text-red-600 bg-red-100';
        case 'transfer':
            return 'text-blue-600 bg-blue-100';
        case 'adjustment':
            return 'text-orange-600 bg-orange-100';
        default:
            return 'text-gray-600 bg-gray-100';
    }
};

// Debounce function
export const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
};
