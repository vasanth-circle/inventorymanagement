import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * SearchableSelect - A searchable dropdown that replaces native <select>
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
    allowCreate = false,
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(-1);
    const [dropdownStyles, setDropdownStyles] = useState({});
    const wrapperRef = useRef(null);
    const searchRef = useRef(null);
    const optionsRef = useRef([]);

    // Close on outside click or scroll
    useEffect(() => {
        const handler = (e) => {
            if (open) {
                // If clicked inside the portal, don't close
                if (e.target.closest('.searchable-select-portal')) return;
                
                if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                    setOpen(false);
                    setSearch('');
                    setHighlightedIndex(-1);
                }
            }
        };
        
        const scrollHandler = (e) => {
            if (open && !e.target.closest('.searchable-select-portal')) {
                setOpen(false);
            }
        };

        document.addEventListener('mousedown', handler);
        window.addEventListener('scroll', scrollHandler, true); // capture phase for all scrolls
        return () => {
            document.removeEventListener('mousedown', handler);
            window.removeEventListener('scroll', scrollHandler, true);
        };
    }, [open]);

    // Update position when opened
    useEffect(() => {
        if (open && wrapperRef.current) {
            const rect = wrapperRef.current.getBoundingClientRect();
            setDropdownStyles({
                top: rect.bottom + window.scrollY + 4 + 'px',
                left: rect.left + window.scrollX + 'px',
                width: rect.width + 'px',
            });
            if (searchRef.current) {
                searchRef.current.focus({ preventScroll: true });
                setHighlightedIndex(0);
            }
        }
    }, [open]);

    const filtered = options.filter(opt =>
        opt.label?.toLowerCase().includes(search.toLowerCase())
    );

    const selectedLabel = options.find(o => String(o.value) === String(value))?.label || value || '';

    const handleSelect = (val) => {
        setOpen(false);
        setSearch('');
        setHighlightedIndex(-1);
        if (onChange) {
            onChange({ target: { name, value: val } });
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setHighlightedIndex(prev => {
                const next = Math.min(prev + 1, filtered.length);
                if (optionsRef.current[next]) {
                    optionsRef.current[next].scrollIntoView({ block: 'nearest' });
                }
                return next;
            });
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setHighlightedIndex(prev => {
                const next = Math.max(prev - 1, 0);
                if (optionsRef.current[next]) {
                    optionsRef.current[next].scrollIntoView({ block: 'nearest' });
                }
                return next;
            });
        } else if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (highlightedIndex === 0) {
                handleSelect('');
            } else if (highlightedIndex > 0 && highlightedIndex <= filtered.length) {
                handleSelect(filtered[highlightedIndex - 1].value);
            }
        }
    };

    const portalContent = open ? createPortal(
        <div 
            className="searchable-select-portal absolute z-[99999] bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
            style={dropdownStyles}
        >
            {/* Search bar */}
            <div className="p-2 border-b border-gray-100">
                <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-50 rounded-lg border border-gray-200 focus-within:border-primary-400 focus-within:ring-1 focus-within:ring-primary-200">
                    <span className="text-gray-400 text-xs">🔍</span>
                    <input
                        ref={searchRef}
                        type="text"
                        value={search}
                        onChange={e => { setSearch(e.target.value); setHighlightedIndex(0); }}
                        onKeyDown={handleKeyDown}
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
                <li ref={el => optionsRef.current[0] = el}>
                    <button
                        type="button"
                        onClick={() => handleSelect('')}
                        onMouseEnter={() => setHighlightedIndex(0)}
                        className={`w-full text-left px-4 py-2 text-sm transition-colors
                            ${!value ? 'bg-primary-50 text-primary-700 font-semibold' : 'text-gray-400'}
                            ${highlightedIndex === 0 && value ? 'bg-gray-100' : ''}
                        `}
                    >
                        {placeholder}
                    </button>
                </li>
                {filtered.length > 0 ? (
                    filtered.map((opt, i) => (
                        <li key={opt.value} ref={el => optionsRef.current[i + 1] = el}>
                            <button
                                type="button"
                                onClick={() => handleSelect(opt.value)}
                                onMouseEnter={() => setHighlightedIndex(i + 1)}
                                className={`w-full text-left px-4 py-2 text-sm transition-colors
                                    ${opt.value === value
                                        ? 'bg-primary-600 text-white font-semibold'
                                        : 'text-gray-700'
                                    }
                                    ${highlightedIndex === i + 1 && opt.value !== value ? 'bg-gray-100' : ''}
                                `}
                            >
                                {opt.label}
                            </button>
                        </li>
                    ))
                ) : (
                    !allowCreate && (
                        <li className="px-4 py-3 text-sm text-gray-400 text-center">
                            No results for "{search}"
                        </li>
                    )
                )}
                {allowCreate && search && !options.some(o => o.label?.toLowerCase() === search.toLowerCase()) && (
                    <li className="border-t border-gray-100">
                        <button
                            type="button"
                            onClick={() => handleSelect(search)}
                            className="w-full text-left px-4 py-2 text-sm text-primary-600 hover:bg-primary-50 font-medium flex items-center gap-2"
                        >
                            <span>➕</span> Add "{search}"
                        </button>
                    </li>
                )}
            </ul>
        </div>,
        document.body
    ) : null;

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
            {portalContent}
        </div>
    );
};

export default SearchableSelect;
