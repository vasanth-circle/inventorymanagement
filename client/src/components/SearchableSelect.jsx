import { useState, useRef, useEffect } from 'react';

/**
 * SearchableSelect - A searchable dropdown that replaces native <select>
 *
 * Props:
 *   value        - current selected value
 *   onChange     - (value) => void
 *   options      - [{ value, label }]
 *   placeholder  - string shown when nothing selected
 *   searchPlaceholder - string inside search box
 *   disabled     - boolean
 *   className    - extra class on wrapper div
 *   name         - for form compatibility (calls onChange with a synthetic-style event { target: {name, value} })
 */
const SearchableSelect = ({
    value = '',
    onChange,
    options = [],
    placeholder = 'Select...',
    searchPlaceholder = 'Search...',
    disabled = false,
    className = '',
    name = '',
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const wrapperRef = useRef(null);
    const searchRef = useRef(null);

    // Close on outside click
    useEffect(() => {
        const handler = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false);
                setSearch('');
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // Focus search input when opened
    useEffect(() => {
        if (open && searchRef.current) {
            searchRef.current.focus();
        }
    }, [open]);

    const filtered = options.filter(opt =>
        opt.label?.toLowerCase().includes(search.toLowerCase())
    );

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || value || '';

    const handleSelect = (val) => {
        setOpen(false);
        setSearch('');
        if (onChange) {
            // Support both direct (value) and synthetic event style ({target:{name,value}})
            onChange({ target: { name, value: val } });
        }
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {/* Trigger */}
            <button
                type="button"
                disabled={disabled}
                onClick={() => setOpen(o => !o)}
                className={`w-full flex items-center justify-between px-3 py-2 border rounded-lg text-sm text-left transition-all outline-none
                    ${open ? 'border-primary-500 ring-2 ring-primary-200' : 'border-gray-300'}
                    ${disabled ? 'bg-gray-100 cursor-not-allowed text-gray-400' : 'bg-white hover:border-gray-400 cursor-pointer'}
                `}
            >
                <span className={selectedLabel ? 'text-gray-900' : 'text-gray-400'}>
                    {selectedLabel || placeholder}
                </span>
                <span className={`ml-2 transition-transform duration-150 text-gray-400 text-xs ${open ? 'rotate-180' : ''}`}>▼</span>
            </button>

            {/* Dropdown Panel */}
            {open && (
                <div className="absolute z-[9999] mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    {/* Search bar */}
                    <div className="p-2 border-b border-gray-100">
                        <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
                            <span className="text-gray-400 text-xs">🔍</span>
                            <input
                                ref={searchRef}
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={searchPlaceholder}
                                className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400 min-w-0"
                            />
                            {search && (
                                <button
                                    type="button"
                                    onClick={() => setSearch('')}
                                    className="text-gray-400 hover:text-gray-600 text-xs"
                                >✕</button>
                            )}
                        </div>
                    </div>

                    {/* Options list */}
                    <ul className="max-h-52 overflow-y-auto py-1">
                        {/* Clear / placeholder option */}
                        <li>
                            <button
                                type="button"
                                onClick={() => handleSelect('')}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors
                                    ${!value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-400 hover:bg-gray-50'}
                                `}
                            >
                                {placeholder}
                            </button>
                        </li>
                        {filtered.length > 0 ? (
                            filtered.map(opt => (
                                <li key={opt.value}>
                                    <button
                                        type="button"
                                        onClick={() => handleSelect(opt.value)}
                                        className={`w-full text-left px-4 py-2 text-sm transition-colors
                                            ${opt.value === value
                                                ? 'bg-primary-600 text-white font-semibold'
                                                : 'text-gray-700 hover:bg-gray-50'
                                            }
                                        `}
                                    >
                                        {opt.label}
                                    </button>
                                </li>
                            ))
                        ) : (
                            <li className="px-4 py-3 text-sm text-gray-400 text-center">
                                No results for "{search}"
                            </li>
                        )}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchableSelect;
