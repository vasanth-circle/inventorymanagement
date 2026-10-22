/**
 * Master Currencies Configuration
 * Provides symbols, ISO codes, display formatting, and locale settings
 * for multi-currency support across all transactions, reports, and invoices.
 */

export const CURRENCIES = [
    {
        code: 'INR',
        symbol: '₹',
        name: 'Indian Rupee (INR)',
        country: 'India',
        flag: '🇮🇳',
        locale: 'en-IN',
        format: 'indian',
        decimals: 2,
        wordsUnit: 'Rupees',
        wordsSubUnit: 'Paise',
    },
    {
        code: 'USD',
        symbol: '$',
        name: 'US Dollar (USD)',
        country: 'United States',
        flag: '🇺🇸',
        locale: 'en-US',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Dollars',
        wordsSubUnit: 'Cents',
    },
    {
        code: 'EUR',
        symbol: '€',
        name: 'Euro (EUR)',
        country: 'European Union',
        flag: '🇪🇺',
        locale: 'en-IE',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Euros',
        wordsSubUnit: 'Cents',
    },
    {
        code: 'GBP',
        symbol: '£',
        name: 'British Pound (GBP)',
        country: 'United Kingdom',
        flag: '🇬🇧',
        locale: 'en-GB',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Pounds',
        wordsSubUnit: 'Pence',
    },
    {
        code: 'AED',
        symbol: 'د.إ',
        name: 'UAE Dirham (AED)',
        country: 'United Arab Emirates',
        flag: '🇦🇪',
        locale: 'en-AE',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Dirhams',
        wordsSubUnit: 'Fils',
    },
    {
        code: 'SAR',
        symbol: '﷼',
        name: 'Saudi Riyal (SAR)',
        country: 'Saudi Arabia',
        flag: '🇸🇦',
        locale: 'en-SA',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Riyals',
        wordsSubUnit: 'Halalas',
    },
    {
        code: 'CAD',
        symbol: 'CA$',
        name: 'Canadian Dollar (CAD)',
        country: 'Canada',
        flag: '🇨🇦',
        locale: 'en-CA',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Dollars',
        wordsSubUnit: 'Cents',
    },
    {
        code: 'AUD',
        symbol: 'A$',
        name: 'Australian Dollar (AUD)',
        country: 'Australia',
        flag: '🇦🇺',
        locale: 'en-AU',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Dollars',
        wordsSubUnit: 'Cents',
    },
    {
        code: 'SGD',
        symbol: 'S$',
        name: 'Singapore Dollar (SGD)',
        country: 'Singapore',
        flag: '🇸🇬',
        locale: 'en-SG',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Dollars',
        wordsSubUnit: 'Cents',
    },
    {
        code: 'QAR',
        symbol: 'QR',
        name: 'Qatari Riyal (QAR)',
        country: 'Qatar',
        flag: '🇶🇦',
        locale: 'en-QA',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Riyals',
        wordsSubUnit: 'Dirhams',
    },
    {
        code: 'KWD',
        symbol: 'KD',
        name: 'Kuwaiti Dinar (KWD)',
        country: 'Kuwait',
        flag: '🇰🇼',
        locale: 'en-KW',
        format: 'standard',
        decimals: 3,
        wordsUnit: 'Dinars',
        wordsSubUnit: 'Fils',
    },
    {
        code: 'JPY',
        symbol: '¥',
        name: 'Japanese Yen (JPY)',
        country: 'Japan',
        flag: '🇯🇵',
        locale: 'ja-JP',
        format: 'standard',
        decimals: 0,
        wordsUnit: 'Yen',
        wordsSubUnit: 'Sen',
    },
    {
        code: 'CNY',
        symbol: '¥',
        name: 'Chinese Yuan (CNY)',
        country: 'China',
        flag: '🇨🇳',
        locale: 'zh-CN',
        format: 'standard',
        decimals: 2,
        wordsUnit: 'Yuan',
        wordsSubUnit: 'Fen',
    },
];

export const getCurrencyConfig = (currencyCode = 'INR') => {
    const code = (currencyCode || 'INR').toUpperCase();
    return CURRENCIES.find(c => c.code === code) || {
        code,
        symbol: currencyCode === 'USD' ? '$' : '₹',
        name: code,
        country: '',
        flag: '🌐',
        locale: 'en-US',
        format: 'standard',
        decimals: 2,
        wordsUnit: code,
        wordsSubUnit: 'Units',
    };
};

/**
 * Format a number using appropriate locale and currency symbol
 */
export const formatCurrencyAmount = (amount, currencyCode = 'INR', overrideSymbol = null, decimals = null) => {
    if (amount === null || amount === undefined || isNaN(amount) || amount === '') {
        return (overrideSymbol || '₹') + '0.00';
    }

    const num = Number(amount);
    const config = getCurrencyConfig(currencyCode);
    const symbol = overrideSymbol !== null && overrideSymbol !== undefined && overrideSymbol !== ''
        ? overrideSymbol
        : config.symbol;

    const fractionDigits = decimals !== null ? decimals : config.decimals;

    try {
        const formattedNumber = num.toLocaleString(config.locale, {
            minimumFractionDigits: fractionDigits,
            maximumFractionDigits: fractionDigits,
        });
        return `${symbol}${formattedNumber}`;
    } catch (_) {
        return `${symbol}${num.toFixed(fractionDigits)}`;
    }
};
