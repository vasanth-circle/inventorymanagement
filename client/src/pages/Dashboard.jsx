import React, { useState, useEffect, useContext, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
    DndContext, closestCenter, KeyboardSensor, PointerSensor,
    useSensor, useSensors,
} from '@dnd-kit/core';
import {
    arrayMove, SortableContext, sortableKeyboardCoordinates,
    rectSortingStrategy, useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Link, useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { formatCurrency } from '../utils/helpers';
import { AuthContext } from '../context/AuthContext';
import { InventoryContext } from '../context/InventoryContext';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, PieChart, Pie, Cell
} from 'recharts';

// ─── Color Palettes ──────────────────────────────────────────────────────────
const PIE_COLORS = ['#6366f1', '#0ea5e9', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#14b8a6', '#f97316'];

// ─── Compact Number Formatter ────────────────────────────────────────────────
const fmtCompact = (n) => {
    n = Number(n) || 0;
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(2)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(1)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
};

const relDate = (d) => {
    const diff = Date.now() - new Date(d);
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
};

// ─── SVG Icons for KPI Cards & Controls ──────────────────────────────────────
const Icons = {
    Products: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
            <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
            <line x1="12" y1="22.08" x2="12" y2="12"/>
        </svg>
    ),
    SKU: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7V4h16v3M9 20h6M12 4v16"/>
            <rect x="3" y="11" width="18" height="6" rx="2"/>
        </svg>
    ),
    Value: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
            <line x1="12" y1="6" x2="12" y2="8"/>
            <line x1="12" y1="16" x2="12" y2="18"/>
        </svg>
    ),
    Stock: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="12 2 2 7 12 12 22 7 12 2"/>
            <polyline points="2 17 12 22 22 17"/>
            <polyline points="2 12 12 17 22 12"/>
        </svg>
    ),
    Alert: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
    ),
    OutOfStock: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
        </svg>
    ),
    Overstock: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
            <polyline points="17 6 23 6 23 12"/>
        </svg>
    ),
    Damaged: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>
        </svg>
    ),
    Orders: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/>
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/>
        </svg>
    ),
    Calendar: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
    ),
    Inward: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0l-4-4m4 4l4-4"/>
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
        </svg>
    ),
    Outward: () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 15V3m0 0L8 7m4-4l4 4"/>
            <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
        </svg>
    ),
    Settings: () => (
        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
        </svg>
    ),
    DragHandle: () => (
        <svg className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-400 transition" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/>
            <circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/>
            <circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/>
        </svg>
    ),
};

// ─── Modern Glassmorphic KPI Card Component ──────────────────────────────────
const KpiCard = React.forwardRef(({ 
    id,
    icon, 
    label, 
    value, 
    sub, 
    badge,
    colorScheme = 'indigo', 
    onClick, 
    urgent, 
    style, 
    attributes, 
    listeners 
}, ref) => {
    // Curated high-contrast aesthetic themes
    const schemes = {
        indigo: {
            border: 'hover:border-indigo-300 dark:hover:border-indigo-600',
            glow: 'group-hover:shadow-indigo-500/10',
            iconBg: 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white shadow-indigo-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-indigo-500 to-indigo-600',
            pill: 'bg-indigo-50 text-indigo-700 border-indigo-100 dark:bg-indigo-950/50 dark:text-indigo-300 dark:border-indigo-800'
        },
        sky: {
            border: 'hover:border-sky-300 dark:hover:border-sky-600',
            glow: 'group-hover:shadow-sky-500/10',
            iconBg: 'bg-gradient-to-br from-sky-400 to-blue-500 text-white shadow-sky-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-sky-400 to-blue-500',
            pill: 'bg-sky-50 text-sky-700 border-sky-100 dark:bg-sky-950/50 dark:text-sky-300 dark:border-sky-800'
        },
        emerald: {
            border: 'hover:border-emerald-300 dark:hover:border-emerald-600',
            glow: 'group-hover:shadow-emerald-500/10',
            iconBg: 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-emerald-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-emerald-500 to-teal-600',
            pill: 'bg-emerald-50 text-emerald-700 border-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800'
        },
        violet: {
            border: 'hover:border-violet-300 dark:hover:border-violet-600',
            glow: 'group-hover:shadow-violet-500/10',
            iconBg: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-violet-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-violet-500 to-purple-600',
            pill: 'bg-violet-50 text-violet-700 border-violet-100 dark:bg-violet-950/50 dark:text-violet-300 dark:border-violet-800'
        },
        amber: {
            border: 'hover:border-amber-300 dark:hover:border-amber-600',
            glow: 'group-hover:shadow-amber-500/10',
            iconBg: 'bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-amber-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-amber-400 to-orange-500',
            pill: 'bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-800'
        },
        rose: {
            border: 'hover:border-rose-300 dark:hover:border-rose-600',
            glow: 'group-hover:shadow-rose-500/10',
            iconBg: 'bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-rose-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-rose-500 to-red-600',
            pill: 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800'
        },
        orange: {
            border: 'hover:border-orange-300 dark:hover:border-orange-600',
            glow: 'group-hover:shadow-orange-500/10',
            iconBg: 'bg-gradient-to-br from-orange-400 to-amber-500 text-white shadow-orange-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-orange-400 to-amber-500',
            pill: 'bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-950/50 dark:text-orange-300 dark:border-orange-800'
        },
        slate: {
            border: 'hover:border-slate-300 dark:hover:border-slate-600',
            glow: 'group-hover:shadow-slate-500/10',
            iconBg: 'bg-gradient-to-br from-slate-600 to-gray-700 text-white shadow-slate-200 dark:shadow-none',
            topBar: 'bg-gradient-to-r from-slate-500 to-gray-600',
            pill: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700'
        }
    };

    const scheme = schemes[colorScheme] || schemes.indigo;

    return (
        <div
            ref={ref}
            style={style}
            onClick={onClick}
            className={`group relative bg-white dark:bg-slate-900 rounded-2xl border transition-all duration-200 p-4 sm:p-5 flex flex-col justify-between overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-0.5 ${scheme.border} ${scheme.glow} ${
                onClick ? 'cursor-pointer' : ''
            } ${urgent ? 'border-rose-300 dark:border-rose-700 ring-2 ring-rose-200 dark:ring-rose-900/50' : 'border-gray-100 dark:border-slate-800/80'}`}
        >
            {/* Top Accent Gradient Bar */}
            <div className={`absolute top-0 left-0 right-0 h-1 ${scheme.topBar} opacity-90`} />

            {/* Header: Icon + Drag Grip + Badge */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md ${scheme.iconBg}`}>
                    {icon}
                </div>

                <div className="flex items-center gap-1.5">
                    {badge && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${scheme.pill}`}>
                            {badge}
                        </span>
                    )}
                    {urgent && (
                        <span className="flex h-2 w-2 relative">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
                        </span>
                    )}
                    {/* Drag handle button */}
                    <button
                        type="button"
                        {...(attributes || {})}
                        {...(listeners || {})}
                        className="p-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
                        title="Drag to reorder card"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <Icons.DragHandle />
                    </button>
                </div>
            </div>

            {/* Metrics Content */}
            <div>
                <p className="text-[11px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-1">
                    {label}
                </p>
                <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl sm:text-3xl font-black text-gray-900 dark:text-white tracking-tight">
                        {value}
                    </span>
                </div>
                {sub && (
                    <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1 font-medium truncate">
                        {sub}
                    </p>
                )}
            </div>
        </div>
    );
});

function SortableKpiCard(props) {
    const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: props.id });
    const style = { transform: CSS.Transform.toString(transform), transition };
    return <KpiCard ref={setNodeRef} style={style} attributes={attributes} listeners={listeners} {...props} />;
}

// ─── Section Card Wrapper ────────────────────────────────────────────────────
const SectionCard = ({ title, icon, children, action, noPad }) => (
    <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden hover:shadow-md transition-shadow">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-800/40">
            <h3 className="text-xs font-black text-gray-800 dark:text-gray-200 uppercase tracking-widest flex items-center gap-2">
                <span className="text-base">{icon}</span>
                {title}
            </h3>
            {action}
        </div>
        <div className={noPad ? '' : 'p-5'}>
            {children}
        </div>
    </div>
);

// ─── Custom Floating Tooltip for Charts ──────────────────────────────────────
const CustomTooltip = ({ active, payload, label }) => {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-white/95 dark:bg-slate-900/95 backdrop-blur-md rounded-xl shadow-xl border border-gray-100 dark:border-slate-700 p-3 text-xs">
            <p className="font-black text-gray-800 dark:text-gray-100 mb-1 border-b border-gray-100 dark:border-slate-800 pb-1">{label}</p>
            {payload.map((p, i) => (
                <div key={i} className="flex items-center justify-between gap-4 py-0.5 font-bold">
                    <span style={{ color: p.color }}>{p.name}:</span>
                    <span className="text-gray-900 dark:text-white">
                        {p.name === 'Qty' || p.name === 'Stock In' || p.name === 'Stock Out' ? p.value?.toLocaleString() : fmtCompact(p.value)}
                    </span>
                </div>
            ))}
        </div>
    );
};

// ─── Alert Banner ────────────────────────────────────────────────────────────
const AlertBadge = ({ alert, onDismiss }) => {
    const cfg = {
        low_stock:   { bg: 'from-amber-50 to-orange-50 border-amber-200 dark:from-amber-950/40 dark:to-orange-950/40 dark:border-amber-800/60', text: 'text-amber-900 dark:text-amber-200', count: 'bg-amber-500 text-white', icon: '⚠️' },
        out_of_stock:{ bg: 'from-rose-50 to-red-50 border-rose-200 dark:from-rose-950/40 dark:to-red-950/40 dark:border-rose-800/60',       text: 'text-rose-900 dark:text-rose-200',   count: 'bg-rose-500 text-white',  icon: '🔴' },
        pending_po:  { bg: 'from-indigo-50 to-blue-50 border-indigo-200 dark:from-indigo-950/40 dark:to-blue-950/40 dark:border-indigo-800/60', text: 'text-indigo-900 dark:text-indigo-200', count: 'bg-indigo-600 text-white', icon: '📋' },
        damaged:     { bg: 'from-orange-50 to-amber-50 border-orange-200 dark:from-orange-950/40 dark:to-amber-950/40 dark:border-orange-800/60', text: 'text-orange-900 dark:text-orange-200', count: 'bg-orange-500 text-white', icon: '🔧' },
    };
    const c = cfg[alert.type] || cfg.low_stock;
    const cleanMessage = alert.count === 1 && alert.message?.includes('purchase orders are')
        ? '1 purchase order is pending delivery'
        : alert.message;

    return (
        <div className={`relative flex items-center justify-between gap-3 px-4 py-3 border rounded-xl bg-gradient-to-r ${c.bg} shadow-sm`}>
            <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-base shrink-0">{c.icon}</span>
                <p className={`text-xs font-bold ${c.text} truncate`}>{cleanMessage}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
                <span className={`text-xs font-black px-2 py-0.5 rounded-full ${c.count}`}>
                    {alert.count}
                </span>
                <button
                    onClick={onDismiss}
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 text-sm font-bold ml-1 p-0.5 rounded"
                    title="Dismiss alert"
                >
                    ✕
                </button>
            </div>
        </div>
    );
};

// ─── Activity Item Component ─────────────────────────────────────────────────
const ActivityItem = ({ item }) => {
    const cfg = {
        stock_in: { icon: '📥', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
        stock_out:{ icon: '📤', color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-950/50' },
        sale:     { icon: '🧾', color: 'text-indigo-600',  bg: 'bg-indigo-50 dark:bg-indigo-950/50' },
        purchase: { icon: '🏭', color: 'text-sky-600',     bg: 'bg-sky-50 dark:bg-sky-950/50' },
        inward:   { icon: '📥', color: 'text-emerald-600', bg: 'bg-emerald-50 dark:bg-emerald-950/50' },
        outward:  { icon: '📤', color: 'text-rose-600',    bg: 'bg-rose-50 dark:bg-rose-950/50' },
        adjustment:{ icon: '⚙️', color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-950/50' },
        return:   { icon: '↩️', color: 'text-violet-600',  bg: 'bg-violet-50 dark:bg-violet-950/50' },
        transfer: { icon: '🔄', color: 'text-slate-600',   bg: 'bg-slate-50 dark:bg-slate-950/50' },
    };
    const c = cfg[item.type] || cfg.adjustment;
    return (
        <div className="flex items-start gap-3 py-3 border-b border-gray-100 dark:border-slate-800 last:border-0">
            <div className={`w-8 h-8 rounded-xl shrink-0 flex items-center justify-center text-sm ${c.bg}`}>
                {c.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold truncate ${c.color}`}>{item.label}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500 truncate mt-0.5">
                    {item.sub || item.user || ''}
                    {item.qty ? ` · ${item.qty} units` : ''}
                    {item.amount ? ` · ${fmtCompact(item.amount)}` : ''}
                </p>
            </div>
            <span className="text-[10px] text-gray-400 font-medium whitespace-nowrap mt-0.5">
                {relDate(item.date)}
            </span>
        </div>
    );
};

// ─── Default Dashboard Settings ──────────────────────────────────────────────
const ALL_KPI_METRICS = [
    { id: 'total_products', label: 'Total Products', icon: 'Products', color: 'indigo', category: 'Catalog', defaultVisible: true },
    { id: 'total_skus', label: 'Total SKUs', icon: 'SKU', color: 'sky', category: 'Catalog', defaultVisible: true },
    { id: 'inventory_value', label: 'Inventory Value', icon: 'Value', color: 'emerald', category: 'Finance', defaultVisible: true, financeOnly: true },
    { id: 'available_stock', label: 'Available Stock', icon: 'Stock', color: 'violet', category: 'Inventory', defaultVisible: true },
    { id: 'low_stock', label: 'Low Stock Alert', icon: 'Alert', color: 'amber', category: 'Alerts', defaultVisible: true },
    { id: 'out_of_stock', label: 'Out of Stock', icon: 'OutOfStock', color: 'rose', category: 'Alerts', defaultVisible: true },
    { id: 'overstocked', label: 'Overstocked Items', icon: 'Overstock', color: 'orange', category: 'Inventory', defaultVisible: true },
    { id: 'damaged_units', label: 'Damaged Goods', icon: 'Damaged', color: 'slate', category: 'Quality', defaultVisible: true, financeOnly: true },
    { id: 'pending_pos', label: 'Pending POs', icon: 'Orders', color: 'indigo', category: 'Purchasing', defaultVisible: true, financeOnly: true },
    { id: 'purchase_this_month', label: 'Month Spend', icon: 'Calendar', color: 'sky', category: 'Purchasing', defaultVisible: true, financeOnly: true },
    { id: 'today_stock_in', label: 'Today Stock In', icon: 'Inward', color: 'emerald', category: 'Movement', defaultVisible: true },
    { id: 'today_stock_out', label: 'Today Stock Out', icon: 'Outward', color: 'rose', category: 'Movement', defaultVisible: true },
];

const DEFAULT_SECTIONS = {
    alertsBanner: true,
    purchaseTrend: true,
    stockMovement: true,
    categoryDistribution: true,
    purchaseOverview: true,
    stockMonitoring: true,
    productPerformance: true,
    salesSnapshot: true,
    recentActivity: true,
    quickActions: true,
};

// ─── MAIN DASHBOARD COMPONENT ────────────────────────────────────────────────
const Dashboard = () => {
    const { user } = useContext(AuthContext);
    const { billingSettings, updateBillingSettings, loading: settingsLoading } = useContext(InventoryContext);
    const { theme, toggleTheme } = useContext(ThemeContext);
    const isDark = theme === 'dark';
    const navigate = useNavigate();

    const tenantId = user?.tenantId ? user.tenantId.toString() : 'default_tenant';

    // State
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [stockTab, setStockTab] = useState('low'); // 'low' | 'out' | 'damaged'
    const [perfTab, setPerfTab] = useState('top');   // 'top' | 'slow'
    const [dismissedAlerts, setDismissedAlerts] = useState([]);
    const [salesFilter, setSalesFilter] = useState({ startDate: '', endDate: '' });
    const [oldStats, setOldStats] = useState(null);
    const [trendData, setTrendData] = useState([]);

    // Customization Drawer State
    const [isCustomizeOpen, setIsCustomizeOpen] = useState(false);
    const [gridCols, setGridCols] = useState(4); // 3 | 4 | 5

    // Lock body scroll and listen for Escape key when customize modal is open
    useEffect(() => {
        if (isCustomizeOpen) {
            document.body.style.overflow = 'hidden';
            const handleKeyDown = (e) => {
                if (e.key === 'Escape') setIsCustomizeOpen(false);
            };
            window.addEventListener('keydown', handleKeyDown);
            return () => {
                document.body.style.overflow = '';
                window.removeEventListener('keydown', handleKeyDown);
            };
        } else {
            document.body.style.overflow = '';
        }
    }, [isCustomizeOpen]);

    // Tenant-isolated Dashboard Preferences
    const storageKey = `tenant_dashboard_config_${tenantId}`;

    const [visibleCards, setVisibleCards] = useState(() => {
        try {
            const saved = localStorage.getItem(`${storageKey}_cards`);
            if (saved) return JSON.parse(saved);
        } catch {}
        return ALL_KPI_METRICS.map(m => m.id);
    });

    const [visibleSections, setVisibleSections] = useState(() => {
        try {
            const saved = localStorage.getItem(`${storageKey}_sections`);
            if (saved) return JSON.parse(saved);
        } catch {}
        return DEFAULT_SECTIONS;
    });

    const [cardOrder, setCardOrder] = useState(() => {
        try {
            const saved = localStorage.getItem(`${storageKey}_order`);
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed) && parsed.length > 0) return parsed;
            }
        } catch {}
        return ALL_KPI_METRICS.map(m => m.id);
    });

    // Drag and Drop Sensors
    const dndSensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = ({ active, over }) => {
        if (!over || active.id === over.id) return;
        setCardOrder(items => {
            const newOrder = arrayMove(items, items.indexOf(active.id), items.indexOf(over.id));
            localStorage.setItem(`${storageKey}_order`, JSON.stringify(newOrder));
            return newOrder;
        });
    };

    const isFinancialAdmin = ['super_admin', 'admin', 'tenant_owner', 'tenant_admin', 'manager', 'accounts'].includes(user?.role);
    const isMachinery = billingSettings?.industry === 'machinery';

    // Sync saved configuration from server billingSettings on load
    useEffect(() => {
        if (billingSettings?.dashboardConfig) {
            const cfg = billingSettings.dashboardConfig;
            if (cfg.visibleCards) setVisibleCards(cfg.visibleCards);
            if (cfg.visibleSections) setVisibleSections(cfg.visibleSections);
            if (cfg.cardOrder) setCardOrder(cfg.cardOrder);
            if (cfg.gridCols) setGridCols(cfg.gridCols);
        }
    }, [billingSettings]);

    useEffect(() => {
        const skipped = sessionStorage.getItem('onboarding_skipped');
        if (!skipped && !settingsLoading && billingSettings && (!billingSettings.industry || billingSettings.industry === 'generic')) {
            navigate('/onboarding');
        }
    }, [billingSettings, settingsLoading, navigate]);

    // Data fetching
    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const queryParams = salesFilter.startDate && salesFilter.endDate 
                ? `?startDate=${salesFilter.startDate}&endDate=${salesFilter.endDate}` 
                : '';
            const [invRes, statsRes, trendRes] = await Promise.all([
                api.get('/dashboard/inventory'),
                api.get(`/dashboard/stats${queryParams}`),
                api.get('/dashboard/stock-trend'),
            ]);
            setData(invRes.data);
            setOldStats(statsRes.data);

            const dateMap = {};
            (trendRes.data || []).forEach(item => {
                const date = item._id.date;
                if (!dateMap[date]) dateMap[date] = { date, inward: 0, outward: 0 };
                dateMap[date][item._id.type] = item.total;
            });
            setTrendData(Object.values(dateMap).sort((a,b) => new Date(a.date) - new Date(b.date)));
        } catch (err) {
            toast.error('Failed to load dashboard data');
        } finally {
            setLoading(false);
        }
    }, [salesFilter.startDate, salesFilter.endDate]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    // Save dashboard configuration (persisted to tenant storage & cloud settings)
    const handleSaveDashboardConfig = async (newCards, newSections, newCols) => {
        const cardsToSave = newCards || visibleCards;
        const sectionsToSave = newSections || visibleSections;
        const colsToSave = newCols || gridCols;

        localStorage.setItem(`${storageKey}_cards`, JSON.stringify(cardsToSave));
        localStorage.setItem(`${storageKey}_sections`, JSON.stringify(sectionsToSave));
        localStorage.setItem(`${storageKey}_order`, JSON.stringify(cardOrder));

        // If user has admin capabilities, sync to backend tenant settings
        if (['super_admin', 'admin', 'tenant_owner', 'tenant_admin'].includes(user?.role) && updateBillingSettings) {
            try {
                await updateBillingSettings({
                    dashboardConfig: {
                        visibleCards: cardsToSave,
                        visibleSections: sectionsToSave,
                        cardOrder,
                        gridCols: colsToSave
                    }
                });
            } catch (err) {
                console.warn('Could not sync dashboard config to server:', err);
            }
        }
        toast.success('Dashboard layout saved for your tenant!');
    };

    // Preset Layout Appliers
    const applyPreset = (presetType) => {
        let cards = [];
        let sections = { ...DEFAULT_SECTIONS };

        if (presetType === 'executive') {
            cards = ALL_KPI_METRICS.map(m => m.id);
        } else if (presetType === 'warehouse') {
            cards = ['total_products', 'available_stock', 'low_stock', 'out_of_stock', 'overstocked', 'damaged_units', 'today_stock_in', 'today_stock_out'];
            sections.purchaseTrend = false;
            sections.salesSnapshot = false;
        } else if (presetType === 'finance') {
            cards = ['inventory_value', 'total_products', 'pending_pos', 'purchase_this_month', 'today_stock_in', 'today_stock_out'];
            sections.stockMonitoring = false;
        } else if (presetType === 'minimal') {
            cards = ['total_products', 'inventory_value', 'available_stock', 'low_stock'];
            sections.categoryDistribution = false;
            sections.recentActivity = false;
        }

        setVisibleCards(cards);
        setVisibleSections(sections);
        handleSaveDashboardConfig(cards, sections, gridCols);
    };

    // Reset layout
    const handleResetDefaults = () => {
        const allCards = ALL_KPI_METRICS.map(m => m.id);
        setVisibleCards(allCards);
        setVisibleSections(DEFAULT_SECTIONS);
        setCardOrder(allCards);
        setGridCols(4);

        localStorage.removeItem(`${storageKey}_cards`);
        localStorage.removeItem(`${storageKey}_sections`);
        localStorage.removeItem(`${storageKey}_order`);

        toast.success('Dashboard restored to default layout');
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[75vh] flex-col gap-4">
            <div className="relative">
                <div className="w-14 h-14 rounded-full border-4 border-indigo-100 border-t-indigo-600 animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center text-xl">✨</div>
            </div>
            <p className="text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest animate-pulse">
                Synchronizing Tenant Dashboard...
            </p>
        </div>
    );

    const kpi = data?.kpi || {};
    const alerts = (data?.alerts || []).filter(a => !dismissedAlerts.includes(a.type));
    const stockMonitoring = data?.stockMonitoring || { lowStock: [], outOfStock: [], damaged: [] };
    const productPerformance = data?.productPerformance || { topSelling: [], slowMoving: [] };

    const stockTabData = stockTab === 'low' ? stockMonitoring.lowStock : stockTab === 'out' ? stockMonitoring.outOfStock : stockMonitoring.damaged;
    const perfData = perfTab === 'top' ? productPerformance.topSelling : productPerformance.slowMoving;

    // Filter cards to show based on tenant preferences & permissions
    const activeDisplayCards = cardOrder.filter(id => {
        if (!visibleCards.includes(id)) return false;
        const metric = ALL_KPI_METRICS.find(m => m.id === id);
        if (metric?.financeOnly && !isFinancialAdmin) return false;
        return true;
    });

    return (
        <div className="space-y-6 pb-24 lg:pb-12 max-w-[1700px] mx-auto">
            {/* ─── Top Header & Controls ───────────────────────────── */}
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-gray-200 dark:border-slate-800">
                <div className="flex items-center gap-3.5">
                    <div className="w-12 h-12 bg-white dark:bg-slate-900 shadow-sm border border-gray-200 dark:border-slate-700 rounded-2xl flex items-center justify-center overflow-hidden p-1.5">
                        {billingSettings?.branding?.logoUrl ? (
                            <img src={billingSettings.branding.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-2xl">{isMachinery ? '⚙️' : '🏢'}</span>
                        )}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h1 className="text-xl sm:text-2xl font-black text-gray-900 dark:text-white tracking-tight leading-tight">
                                {isMachinery ? 'Machinery & Parts Hub' : 'Inventory & Analytics Hub'}
                            </h1>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                Live Sync
                            </span>
                        </div>
                        <p className="text-xs text-gray-400 dark:text-gray-500 font-bold uppercase tracking-wider mt-0.5">
                            {oldStats?.companyName || user?.name || 'Workspace Dashboard'}
                        </p>
                    </div>
                </div>

                {/* Header Action Buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* CUSTOMIZE DASHBOARD BUTTON */}
                    <button
                        onClick={() => setIsCustomizeOpen(true)}
                        className="px-3.5 py-2 bg-gradient-to-r from-indigo-50 to-purple-50 hover:from-indigo-100 hover:to-purple-100 dark:from-indigo-950/40 dark:to-purple-950/40 border border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-2"
                    >
                        <Icons.Settings />
                        <span>Customise Dashboard</span>
                        <span className="px-1.5 py-0.5 text-[10px] bg-indigo-600 text-white rounded-full font-bold">
                            {activeDisplayCards.length}
                        </span>
                    </button>

                    <button
                        onClick={toggleTheme}
                        className="p-2 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl text-xs font-bold text-gray-600 dark:text-gray-300 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all shadow-sm"
                        title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
                    >
                        {isDark ? '☀️' : '🌙'}
                    </button>

                    <button
                        onClick={fetchAll}
                        className="px-3.5 py-2 bg-white dark:bg-slate-900 border border-gray-200 dark:border-slate-800 rounded-xl text-xs font-bold text-gray-700 dark:text-gray-200 hover:border-indigo-300 transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>Refresh</span>
                    </button>

                    <Link
                        to="/inventory"
                        className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 text-white rounded-xl text-xs font-black transition-all shadow-sm flex items-center gap-1.5"
                    >
                        <span>{isMachinery ? 'Manage Parts' : 'Manage Stock'}</span>
                        <span>→</span>
                    </Link>
                </div>
            </div>

            {/* ─── Alerts Banner ───────────────────────────────────── */}
            {visibleSections.alertsBanner && alerts.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                    {alerts.map(a => (
                        <AlertBadge
                            key={a.type}
                            alert={a}
                            onDismiss={() => setDismissedAlerts(d => [...d, a.type])}
                        />
                    ))}
                </div>
            )}

            {/* ─── Drag & Drop Customisable KPI Metrics Cards ──────── */}
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={cardOrder} strategy={rectSortingStrategy}>
                    <div className={`grid gap-4 ${
                        gridCols === 3 
                            ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' 
                            : gridCols === 5
                            ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-5'
                            : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4'
                    }`}>
                        {cardOrder.map(id => {
                            if (!visibleCards.includes(id)) return null;

                            // 1. Total Products
                            if (id === 'total_products') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Products />}
                                        label={isMachinery ? 'Machines & Parts' : 'Total Products'}
                                        value={kpi.totalProducts?.toLocaleString() ?? '0'}
                                        sub={isMachinery ? 'Active machines & catalog' : 'Unique items in catalog'}
                                        badge="Live Catalog"
                                        colorScheme="indigo"
                                        onClick={() => navigate('/inventory')}
                                    />
                                );
                            }

                            // 2. Total SKUs
                            if (id === 'total_skus') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.SKU />}
                                        label="Total SKUs"
                                        value={kpi.totalSKUs?.toLocaleString() ?? '0'}
                                        sub="Barcoded & coded items"
                                        badge="Tracking"
                                        colorScheme="sky"
                                        onClick={() => navigate('/inventory')}
                                    />
                                );
                            }

                            // 3. Inventory Value
                            if (id === 'inventory_value') {
                                return isFinancialAdmin ? (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Value />}
                                        label={isMachinery ? 'Parts Stock Value' : 'Inventory Value'}
                                        value={fmtCompact(kpi.inventoryValue)}
                                        sub="Valued at purchase cost"
                                        badge="Total Assets"
                                        colorScheme="emerald"
                                    />
                                ) : null;
                            }

                            // 4. Available Stock
                            if (id === 'available_stock') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Stock />}
                                        label={isMachinery ? 'Parts in Stock' : 'Available Stock'}
                                        value={kpi.availableStock?.toLocaleString() ?? '0'}
                                        sub={isMachinery ? 'Total parts in warehouse' : 'Total units in warehouse'}
                                        badge="In Hand"
                                        colorScheme="violet"
                                        onClick={() => navigate('/stocks')}
                                    />
                                );
                            }

                            // 5. Low Stock
                            if (id === 'low_stock') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Alert />}
                                        label={isMachinery ? 'Low Parts Alert' : 'Low Stock Alert'}
                                        value={kpi.lowStockCount ?? 0}
                                        sub="At or below minimum limit"
                                        badge={kpi.lowStockCount > 0 ? 'Action Needed' : 'Healthy'}
                                        colorScheme="amber"
                                        urgent={kpi.lowStockCount > 0}
                                        onClick={() => { setStockTab('low'); window.scrollTo({ top: 600, behavior: 'smooth' }); }}
                                    />
                                );
                            }

                            // 6. Out of Stock
                            if (id === 'out_of_stock') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.OutOfStock />}
                                        label={isMachinery ? 'Parts Depleted' : 'Out of Stock'}
                                        value={kpi.outOfStockCount ?? 0}
                                        sub="Zero inventory in stock"
                                        badge={kpi.outOfStockCount > 0 ? 'Critical' : 'All Clear'}
                                        colorScheme="rose"
                                        urgent={kpi.outOfStockCount > 0}
                                        onClick={() => { setStockTab('out'); window.scrollTo({ top: 600, behavior: 'smooth' }); }}
                                    />
                                );
                            }

                            // 7. Overstocked
                            if (id === 'overstocked') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Overstock />}
                                        label="Overstocked Items"
                                        value={kpi.overStockedCount ?? 0}
                                        sub="3x above safety threshold"
                                        badge="Surplus"
                                        colorScheme="orange"
                                    />
                                );
                            }

                            // 8. Damaged Goods
                            if (id === 'damaged_units') {
                                return isFinancialAdmin ? (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Damaged />}
                                        label={isMachinery ? 'Damaged Parts' : 'Damaged Stock'}
                                        value={kpi.damagedTotal?.toLocaleString() ?? 0}
                                        sub={kpi.damagedValue > 0 ? `Cost: ${fmtCompact(kpi.damagedValue)} · ${kpi.damagedCount ?? 0} items` : `${kpi.damagedCount ?? 0} damaged items logged`}
                                        badge="Loss Risk"
                                        colorScheme="slate"
                                        onClick={() => { setStockTab('damaged'); window.scrollTo({ top: 600, behavior: 'smooth' }); }}
                                    />
                                ) : null;
                            }

                            // 9. Pending POs
                            if (id === 'pending_pos') {
                                return isFinancialAdmin ? (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Orders />}
                                        label={isMachinery ? 'Pending Part POs' : 'Pending POs'}
                                        value={kpi.pendingPOs ?? 0}
                                        sub="Awaiting vendor shipment"
                                        badge="Inbound"
                                        colorScheme="indigo"
                                        onClick={() => navigate('/purchase-orders')}
                                    />
                                ) : null;
                            }

                            // 10. Purchase This Month
                            if (id === 'purchase_this_month') {
                                return isFinancialAdmin ? (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Calendar />}
                                        label="Month PO Spend"
                                        value={fmtCompact(kpi.purchaseThisMonth)}
                                        sub="Current billing cycle"
                                        badge="Spend"
                                        colorScheme="sky"
                                    />
                                ) : null;
                            }

                            // 11. Today Stock In
                            if (id === 'today_stock_in') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Inward />}
                                        label={isMachinery ? 'Parts Received Today' : 'Today Stock In'}
                                        value={oldStats?.todayInward?.total?.toLocaleString() ?? 0}
                                        sub={`${oldStats?.todayInward?.count ?? 0} inward entries`}
                                        badge="Inward"
                                        colorScheme="emerald"
                                        onClick={() => navigate('/stock-inward')}
                                    />
                                );
                            }

                            // 12. Today Stock Out
                            if (id === 'today_stock_out') {
                                return (
                                    <SortableKpiCard
                                        key={id}
                                        id={id}
                                        icon={<Icons.Outward />}
                                        label={isMachinery ? 'Parts Dispatched' : 'Today Stock Out'}
                                        value={oldStats?.todayOutward?.total?.toLocaleString() ?? 0}
                                        sub={`${oldStats?.todayOutward?.count ?? 0} dispatch entries`}
                                        badge="Dispatched"
                                        colorScheme="rose"
                                        onClick={() => navigate('/dispatch-management')}
                                    />
                                );
                            }

                            return null;
                        })}
                    </div>
                </SortableContext>
            </DndContext>

            {/* ─── Analytics Row: Trends & Movement ────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* 1. Monthly Purchase vs Sales Trend */}
                {visibleSections.purchaseTrend && isFinancialAdmin && (
                    <SectionCard 
                        title="Purchase vs Sales Trend" 
                        icon="📈"
                        action={
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold text-gray-400">Monthly Comparison</span>
                            </div>
                        }
                    >
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data?.monthlyTrend || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gPurchase" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.35}/>
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0}/>
                                        </linearGradient>
                                        <linearGradient id="gSales" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.35}/>
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5}/>
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={v => fmtCompact(v)} width={60} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Area type="monotone" dataKey="purchase" name="Purchase" stroke="#6366f1" strokeWidth={3} fill="url(#gPurchase)" dot={{ fill: '#6366f1', r: 3 }} />
                                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#10b981" strokeWidth={3} fill="url(#gSales)" dot={{ fill: '#10b981', r: 3 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>
                )}

                {/* 2. Stock Movement Bar Chart */}
                {visibleSections.stockMovement && (
                    <SectionCard title="Stock Inflow vs Outflow (4 Weeks)" icon="📦">
                        <div className="h-[240px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data?.stockMovement || []} margin={{ top: 10, right: 10, left: -10, bottom: 0 }} barSize={16} barGap={4}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" strokeOpacity={0.5}/>
                                    <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8', fontWeight: 700 }} />
                                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="inward" name="Stock In" fill="#10b981" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="outward" name="Stock Out" fill="#f43f5e" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </SectionCard>
                )}

                {/* 3. Category Distribution Donut */}
                {visibleSections.categoryDistribution && (
                    <SectionCard title="Stock Distribution by Category" icon="🗂️">
                        {(data?.categoryDistribution || []).length === 0 ? (
                            <div className="flex items-center justify-center h-[220px] text-gray-300 dark:text-gray-600 flex-col gap-2">
                                <span className="text-3xl">📂</span>
                                <p className="text-xs font-bold">No categorized inventory yet</p>
                            </div>
                        ) : (
                            <div className="flex flex-col sm:flex-row items-center gap-4 h-[240px]">
                                <div className="w-full sm:w-52 h-[220px] relative flex items-center justify-center">
                                    <ResponsiveContainer width="100%" height="100%">
                                        <PieChart>
                                            <Pie 
                                                data={data.categoryDistribution} 
                                                dataKey="totalQty" 
                                                nameKey="name" 
                                                cx="50%" 
                                                cy="50%" 
                                                innerRadius={50} 
                                                outerRadius={80} 
                                                paddingAngle={4}
                                            >
                                                {data.categoryDistribution.map((_, i) => (
                                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                                ))}
                                            </Pie>
                                            <Tooltip formatter={(v) => [`${v?.toLocaleString()} units`, 'Stock']} />
                                        </PieChart>
                                    </ResponsiveContainer>
                                    <div className="absolute text-center pointer-events-none">
                                        <span className="text-xs font-black text-gray-400 uppercase">Categories</span>
                                        <p className="text-base font-black text-gray-800 dark:text-gray-100">{data.categoryDistribution.length}</p>
                                    </div>
                                </div>
                                <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px] w-full pr-1">
                                    {data.categoryDistribution.map((c, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-slate-800/60 transition">
                                            <div className="flex items-center gap-2.5 min-w-0">
                                                <div className="w-3 h-3 rounded-md shrink-0 shadow-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                                <span className="text-xs font-semibold text-gray-700 dark:text-gray-300 truncate max-w-[140px]">{c.name}</span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-xs font-black text-gray-900 dark:text-gray-100">{c.totalQty?.toLocaleString()}</p>
                                                <p className="text-[10px] text-gray-400">{c.count} items</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SectionCard>
                )}

                {/* 4. Purchase Overview & Suppliers */}
                {visibleSections.purchaseOverview && isFinancialAdmin && (
                    <SectionCard title="Procurement & Top Vendors" icon="🏭">
                        <div className="grid grid-cols-2 gap-3 mb-4">
                            {[
                                { label: 'Total Purchase Orders', value: data?.purchaseStats?.total ?? 0, color: 'text-gray-900 dark:text-white', bg: 'bg-indigo-50/50 dark:bg-indigo-950/20' },
                                { label: 'Pending Delivery', value: data?.purchaseStats?.pending ?? 0, color: 'text-amber-600', bg: 'bg-amber-50/50 dark:bg-amber-950/20' },
                                { label: 'Received & Inwarded', value: data?.purchaseStats?.received ?? 0, color: 'text-emerald-600', bg: 'bg-emerald-50/50 dark:bg-emerald-950/20' },
                                { label: 'POs This Month', value: data?.purchaseStats?.monthCount ?? 0, color: 'text-indigo-600', bg: 'bg-sky-50/50 dark:bg-sky-950/20' },
                            ].map((s, i) => (
                                <div key={i} className={`rounded-xl p-3 border border-gray-100 dark:border-slate-800 ${s.bg}`}>
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-wider">{s.label}</p>
                                    <p className={`text-2xl font-black mt-1 ${s.color}`}>{s.value}</p>
                                </div>
                            ))}
                        </div>
                        {(data?.supplierAnalytics || []).length > 0 && (
                            <div>
                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Key Vendor Spend</p>
                                <div className="space-y-1.5 max-h-[120px] overflow-y-auto">
                                    {data.supplierAnalytics.map((s, i) => (
                                        <div key={i} className="flex items-center justify-between py-1.5 px-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-800/60 text-xs">
                                            <div className="flex items-center gap-2">
                                                <span className="w-5 h-5 bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded-full text-[10px] font-black flex items-center justify-center">{i + 1}</span>
                                                <span className="font-semibold text-gray-700 dark:text-gray-200 truncate max-w-[150px]">{s.name}</span>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-gray-900 dark:text-gray-100">{fmtCompact(s.totalValue)}</p>
                                                <p className="text-[9px] text-gray-400">{s.count} orders</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </SectionCard>
                )}
            </div>

            {/* ─── Stock Monitoring Alert Table ───────────────────── */}
            {visibleSections.stockMonitoring && (
                <SectionCard
                    title="Stock Health & Threshold Monitor"
                    icon="🔍"
                    noPad
                    action={
                        <Link to="/inventory" className="text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
                            <span>Open Full Inventory</span>
                            <span>→</span>
                        </Link>
                    }
                >
                    {/* Tabs */}
                    <div className="flex border-b border-gray-100 dark:border-slate-800 px-5 bg-gray-50/50 dark:bg-slate-800/30 gap-2">
                        {[
                            { id: 'low', label: `⚠️ Low Stock (${stockMonitoring.lowStock?.length ?? 0})`, urgent: (stockMonitoring.lowStock?.length ?? 0) > 0 },
                            { id: 'out', label: `🔴 Out of Stock (${stockMonitoring.outOfStock?.length ?? 0})`, urgent: (stockMonitoring.outOfStock?.length ?? 0) > 0 },
                            { id: 'damaged', label: `🔧 Damaged (${stockMonitoring.damaged?.length ?? 0})` },
                        ].map(t => (
                            <button
                                key={t.id}
                                onClick={() => setStockTab(t.id)}
                                className={`px-4 py-3 text-xs font-black uppercase tracking-wider transition-all border-b-2 -mb-px ${
                                    stockTab === t.id 
                                        ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400' 
                                        : 'border-transparent text-gray-400 hover:text-gray-600'
                                } ${t.urgent && stockTab !== t.id ? 'text-rose-500 font-extrabold' : ''}`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    <div className="overflow-x-auto">
                        {stockTabData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-gray-300 dark:text-gray-600 gap-2">
                                <span className="text-3xl">✅</span>
                                <p className="text-xs font-bold text-gray-400">All inventory thresholds in healthy state!</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-slate-800 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30 dark:bg-slate-800/10">
                                        <th className="px-5 py-3">Item Details</th>
                                        <th className="px-5 py-3">Category</th>
                                        <th className="px-5 py-3 text-right">
                                            {stockTab === 'damaged' ? 'Damaged Qty' : 'Current Qty'}
                                        </th>
                                        {stockTab === 'damaged' && isFinancialAdmin && (
                                            <th className="px-5 py-3 text-right">Estimated Loss</th>
                                        )}
                                        {stockTab === 'low' && (
                                            <th className="px-5 py-3 text-right">Safety Threshold</th>
                                        )}
                                        <th className="px-5 py-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {stockTabData.slice(0, 8).map((item, i) => (
                                        <tr key={item._id || i} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40 transition">
                                            <td className="px-5 py-3">
                                                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[200px]">{item.name}</p>
                                                {item.sku && <p className="text-[10px] text-gray-400 font-mono mt-0.5">SKU: {item.sku}</p>}
                                            </td>
                                            <td className="px-5 py-3">
                                                <span className="text-[10px] bg-gray-100 dark:bg-slate-800 text-gray-700 dark:text-gray-300 px-2.5 py-0.5 rounded-full font-semibold">
                                                    {item.category?.name || 'Uncategorized'}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-right">
                                                <span className={`text-sm font-black ${stockTab === 'out' ? 'text-rose-600' : stockTab === 'low' ? 'text-amber-600' : 'text-orange-600'}`}>
                                                    {stockTab === 'damaged' ? item.damagedQuantity : item.quantity}
                                                </span>
                                            </td>
                                            {stockTab === 'damaged' && isFinancialAdmin && (
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-sm font-black text-rose-600">
                                                        {fmtCompact((item.damagedQuantity || 0) * (item.purchasePrice || item.price || 0))}
                                                    </span>
                                                </td>
                                            )}
                                            {stockTab === 'low' && (
                                                <td className="px-5 py-3 text-right text-xs font-bold text-gray-400">
                                                    {item.minStockThreshold}
                                                </td>
                                            )}
                                            <td className="px-5 py-3 text-right">
                                                <Link 
                                                    to="/stock-inward" 
                                                    className="inline-flex items-center text-xs font-black text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:text-indigo-300 px-3 py-1.5 rounded-xl transition shadow-xs"
                                                >
                                                    + Restock
                                                </Link>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* ─── Product Performance (Top & Slow Moving) ────────── */}
            {visibleSections.productPerformance && (
                <SectionCard
                    title="Product Performance Analytics"
                    icon="🏆"
                    noPad
                    action={
                        <div className="flex bg-gray-100 dark:bg-slate-800 p-0.5 rounded-xl">
                            {[{ id: 'top', label: 'Top Moving' }, { id: 'slow', label: 'Slow Moving (30d)' }].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setPerfTab(t.id)}
                                    className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                                        perfTab === t.id 
                                            ? 'bg-white dark:bg-slate-900 text-indigo-600 shadow-sm font-black' 
                                            : 'text-gray-500 hover:text-gray-800'
                                    }`}
                                >
                                    {t.label}
                                </button>
                            ))}
                        </div>
                    }
                >
                    <div className="overflow-x-auto">
                        {perfData.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-300 dark:text-gray-600 gap-2">
                                <span className="text-3xl">📊</span>
                                <p className="text-xs font-bold text-gray-400">No product sales movements recorded yet</p>
                            </div>
                        ) : (
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b border-gray-100 dark:border-slate-800 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-gray-50/30 dark:bg-slate-800/10">
                                        <th className="px-5 py-3">Rank</th>
                                        <th className="px-5 py-3">Product Name</th>
                                        {perfTab === 'top' && <th className="px-5 py-3 text-right">Units Sold</th>}
                                        {perfTab === 'top' && isFinancialAdmin && <th className="px-5 py-3 text-right">Revenue</th>}
                                        {perfTab === 'slow' && <th className="px-5 py-3 text-right">Current Stock (Stagnant)</th>}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                                    {perfData.slice(0, 6).map((item, i) => (
                                        <tr key={item._id || i} className="hover:bg-gray-50/60 dark:hover:bg-slate-800/40">
                                            <td className="px-5 py-3">
                                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black ${
                                                    i === 0 ? 'bg-amber-100 text-amber-800' :
                                                    i === 1 ? 'bg-slate-100 text-slate-800' :
                                                    i === 2 ? 'bg-orange-100 text-orange-800' :
                                                    'bg-gray-100 text-gray-500'
                                                }`}>
                                                    {i + 1}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3">
                                                <p className="text-xs font-bold text-gray-900 dark:text-gray-100 truncate max-w-[220px]">{item.name}</p>
                                                {item.category?.name && <p className="text-[10px] text-gray-400">{item.category.name}</p>}
                                            </td>
                                            {perfTab === 'top' && (
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-sm font-black text-emerald-600">{item.totalSold?.toLocaleString()} units</span>
                                                </td>
                                            )}
                                            {perfTab === 'top' && isFinancialAdmin && (
                                                <td className="px-5 py-3 text-right text-xs font-black text-gray-900 dark:text-gray-100">
                                                    {fmtCompact(item.revenue)}
                                                </td>
                                            )}
                                            {perfTab === 'slow' && (
                                                <td className="px-5 py-3 text-right">
                                                    <span className="text-sm font-black text-orange-500">{item.quantity?.toLocaleString()} units</span>
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </SectionCard>
            )}

            {/* ─── Bottom Row: Sales Snapshot & Activity Feed ─────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                {/* Sales Snapshot */}
                {visibleSections.salesSnapshot && isFinancialAdmin && (
                    <SectionCard
                        title="Sales & Period Snapshot"
                        icon="💰"
                        action={
                            <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-slate-800 px-2 py-1 rounded-xl border border-gray-200 dark:border-slate-700 text-xs">
                                <input 
                                    type="date" 
                                    value={salesFilter.startDate} 
                                    onChange={(e) => setSalesFilter(f => ({ ...f, startDate: e.target.value }))} 
                                    className="text-[10px] bg-transparent font-bold text-gray-700 dark:text-gray-200 outline-none w-[85px]" 
                                />
                                <span className="text-[9px] text-gray-400 font-black">TO</span>
                                <input 
                                    type="date" 
                                    value={salesFilter.endDate} 
                                    onChange={(e) => setSalesFilter(f => ({ ...f, endDate: e.target.value }))} 
                                    className="text-[10px] bg-transparent font-bold text-gray-700 dark:text-gray-200 outline-none w-[85px]" 
                                />
                                {(salesFilter.startDate || salesFilter.endDate) && (
                                    <button onClick={() => setSalesFilter({ startDate: '', endDate: '' })} className="text-gray-400 hover:text-red-500 font-bold ml-1">✕</button>
                                )}
                            </div>
                        }
                    >
                        <div className="space-y-2.5">
                            {[
                                ...(salesFilter.startDate && salesFilter.endDate ? [
                                    { label: "Selected Period Sales", value: oldStats?.periodSales, color: 'text-indigo-600 bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-100 p-2.5 rounded-xl' },
                                    { label: "Selected Period Purchases", value: oldStats?.periodPurchase, color: 'text-amber-600 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 p-2.5 rounded-xl' }
                                ] : []),
                                { label: "Today's Sales", value: oldStats?.todaySales, color: 'text-indigo-600' },
                                { label: "This Week", value: oldStats?.weekSales, color: 'text-blue-600' },
                                { label: "This Month", value: oldStats?.monthSales, color: 'text-emerald-600' },
                                { label: "All Time Sales", value: oldStats?.totalSales, color: 'text-gray-900 dark:text-white' },
                                { label: "Total Purchases", value: oldStats?.totalPurchase, color: 'text-amber-600' },
                            ].map((row, i) => (
                                <div key={i} className={`flex items-center justify-between py-2 px-3 rounded-xl transition ${row.color?.includes('bg-') ? row.color : 'hover:bg-gray-50 dark:hover:bg-slate-800/40'}`}>
                                    <span className={`text-xs font-bold uppercase tracking-wider ${row.color?.includes('bg-') ? '' : 'text-gray-500'}`}>{row.label}</span>
                                    <span className={`text-sm font-black ${row.color?.includes('bg-') ? '' : row.color}`}>{formatCurrency(row.value ?? 0)}</span>
                                </div>
                            ))}
                        </div>
                    </SectionCard>
                )}

                {/* Recent Activity */}
                {visibleSections.recentActivity && (
                    <SectionCard
                        title="Recent Inventory Events"
                        icon="🕐"
                        action={
                            <Link to="/reports" className="text-xs font-bold text-indigo-600 hover:text-indigo-800">
                                View Full Log →
                            </Link>
                        }
                    >
                        {(data?.activityFeed || []).length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-gray-300 dark:text-gray-600 gap-2">
                                <span className="text-3xl">📋</span>
                                <p className="text-xs font-bold text-gray-400">No recent transactions</p>
                            </div>
                        ) : (
                            <div className="overflow-y-auto max-h-[300px] pr-1">
                                {data.activityFeed.map((item, i) => <ActivityItem key={i} item={item} />)}
                            </div>
                        )}
                    </SectionCard>
                )}
            </div>

            {/* ─── Quick Shortcuts ─────────────────────────────────── */}
            {visibleSections.quickActions && (
                <SectionCard title="Quick Operations" icon="⚡">
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                        {[
                            { to: '/stock-inward', icon: '📥', label: 'Stock Inward', color: 'hover:border-emerald-300 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20' },
                            { to: '/purchase-orders', icon: '🏭', label: 'Purchase Entry', color: 'hover:border-sky-300 hover:bg-sky-50/50 dark:hover:bg-sky-950/20' },
                            { to: '/sales-orders', icon: '🧾', label: 'Sales Orders', color: 'hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/20' },
                            { to: '/inventory', icon: '📦', label: 'Catalog Items', color: 'hover:border-violet-300 hover:bg-violet-50/50 dark:hover:bg-violet-950/20' },
                            { to: '/reports-hub', icon: '📊', label: 'Reports Hub', color: 'hover:border-amber-300 hover:bg-amber-50/50 dark:hover:bg-amber-950/20' },
                            { to: '/parties', icon: '🤝', label: 'Parties & Vendors', color: 'hover:border-rose-300 hover:bg-rose-50/50 dark:hover:bg-rose-950/20' },
                        ].map(link => (
                            <Link
                                key={link.to}
                                to={link.to}
                                className={`flex flex-col items-center gap-2.5 p-4 rounded-2xl border border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 transition-all hover:scale-105 shadow-sm text-center ${link.color}`}
                            >
                                <span className="text-2xl">{link.icon}</span>
                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 tracking-wide">{link.label}</span>
                            </Link>
                        ))}
                    </div>
                </SectionCard>
            )}

            {/* ══════════════════════════════════════════════════════════════
                TENANT DASHBOARD CUSTOMIZATION MODAL / DRAWER
            ══════════════════════════════════════════════════════════════ */}
            {isCustomizeOpen && typeof document !== 'undefined' && createPortal(
                <div 
                    className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-sm"
                    onClick={() => setIsCustomizeOpen(false)}
                >
                    <div 
                        className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl border border-gray-200 dark:border-slate-800 w-full max-w-2xl overflow-hidden flex flex-col max-h-[88vh] my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drawer Header */}
                        <div className="p-5 border-b border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gradient-to-r from-indigo-50/80 to-purple-50/80 dark:from-slate-800/80 dark:to-slate-800/40">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-md">
                                    <Icons.Settings />
                                </div>
                                <div>
                                    <h2 className="text-lg font-black text-gray-900 dark:text-white">
                                        Customise Tenant Dashboard
                                    </h2>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        Choose exactly which KPI metrics and graph panels your team sees.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsCustomizeOpen(false)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl font-bold p-1"
                            >
                                ×
                            </button>
                        </div>

                        {/* Drawer Body */}
                        <div className="p-6 overflow-y-auto space-y-6">
                            {/* Preset Templates */}
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                    Quick Layout Presets
                                </label>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {[
                                        { id: 'executive', name: '🌟 Full Suite', desc: 'All 12 KPIs + charts' },
                                        { id: 'warehouse', name: '📦 Warehouse', desc: 'Stock & Inward/Outward' },
                                        { id: 'finance', name: '💼 Financial', desc: 'Value, POs, spend' },
                                        { id: 'minimal', name: '⚡ Minimal', desc: 'Clean 4 core cards' },
                                    ].map(p => (
                                        <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => applyPreset(p.id)}
                                            className="p-3 text-left rounded-xl border border-gray-200 dark:border-slate-700 hover:border-indigo-500 hover:bg-indigo-50/30 dark:hover:bg-slate-800 transition"
                                        >
                                            <p className="text-xs font-bold text-gray-900 dark:text-white">{p.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{p.desc}</p>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* KPI Metrics Toggles */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-black text-gray-400 uppercase tracking-widest">
                                        Metric Cards Visibility ({visibleCards.length}/{ALL_KPI_METRICS.length})
                                    </label>
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setVisibleCards(ALL_KPI_METRICS.map(m => m.id))}
                                            className="text-[11px] font-bold text-indigo-600 hover:text-indigo-800"
                                        >
                                            Show All
                                        </button>
                                        <span className="text-gray-300">·</span>
                                        <button
                                            type="button"
                                            onClick={() => setVisibleCards(['total_products', 'inventory_value', 'available_stock', 'low_stock'])}
                                            className="text-[11px] font-bold text-gray-500 hover:text-gray-700"
                                        >
                                            Core Only
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {ALL_KPI_METRICS.map(metric => {
                                        const isChecked = visibleCards.includes(metric.id);
                                        return (
                                            <label
                                                key={metric.id}
                                                className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                                                    isChecked 
                                                        ? 'bg-indigo-50/40 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800' 
                                                        : 'bg-gray-50/40 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-gray-400'
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <span className={`w-2 h-2 rounded-full ${isChecked ? 'bg-indigo-600' : 'bg-gray-300'}`} />
                                                    <div>
                                                        <p className="text-xs font-bold text-gray-900 dark:text-white leading-tight">
                                                            {metric.label}
                                                        </p>
                                                        <span className="text-[10px] text-gray-400">Category: {metric.category}</span>
                                                    </div>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    checked={isChecked}
                                                    onChange={(e) => {
                                                        const updated = e.target.checked
                                                            ? [...visibleCards, metric.id]
                                                            : visibleCards.filter(id => id !== metric.id);
                                                        setVisibleCards(updated);
                                                    }}
                                                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                                                />
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Section Visibility Toggles */}
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-3">
                                    Analytics & Charts Panels
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {[
                                        { key: 'alertsBanner', label: 'Action Alerts Banner' },
                                        { key: 'purchaseTrend', label: 'Purchase vs Sales Trend Area Chart' },
                                        { key: 'stockMovement', label: '4-Week Movement Bar Chart' },
                                        { key: 'categoryDistribution', label: 'Category Distribution Donut Chart' },
                                        { key: 'purchaseOverview', label: 'Procurement & Vendor Overview' },
                                        { key: 'stockMonitoring', label: 'Threshold & Restock Monitor Table' },
                                        { key: 'productPerformance', label: 'Product Performance (Top & Slow)' },
                                        { key: 'salesSnapshot', label: 'Sales & Revenue Date Snapshot' },
                                        { key: 'recentActivity', label: 'Recent Transactions Activity Feed' },
                                        { key: 'quickActions', label: 'Quick Operations Shortcuts' },
                                    ].map(sec => (
                                        <label
                                            key={sec.key}
                                            className={`flex items-center justify-between p-3 rounded-xl border cursor-pointer transition ${
                                                visibleSections[sec.key]
                                                    ? 'bg-purple-50/40 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800'
                                                    : 'bg-gray-50/40 dark:bg-slate-800/40 border-gray-200 dark:border-slate-800 text-gray-400'
                                            }`}
                                        >
                                            <span className="text-xs font-bold text-gray-800 dark:text-gray-200">{sec.label}</span>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(visibleSections[sec.key])}
                                                onChange={(e) => {
                                                    setVisibleSections({
                                                        ...visibleSections,
                                                        [sec.key]: e.target.checked
                                                    });
                                                }}
                                                className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500"
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Card Grid Density */}
                            <div>
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2">
                                    Card Grid Density
                                </label>
                                <div className="flex gap-2">
                                    {[
                                        { cols: 3, label: 'Spacious (3 cols)' },
                                        { cols: 4, label: 'Balanced (4 cols)' },
                                        { cols: 5, label: 'Compact (5 cols)' },
                                    ].map(opt => (
                                        <button
                                            key={opt.cols}
                                            type="button"
                                            onClick={() => setGridCols(opt.cols)}
                                            className={`flex-1 py-2 px-3 rounded-xl border text-xs font-bold transition ${
                                                gridCols === opt.cols 
                                                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                                    : 'bg-gray-50 dark:bg-slate-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-slate-700'
                                            }`}
                                        >
                                            {opt.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Drawer Footer Actions */}
                        <div className="p-5 border-t border-gray-100 dark:border-slate-800 flex items-center justify-between bg-gray-50/50 dark:bg-slate-800/50">
                            <button
                                type="button"
                                onClick={handleResetDefaults}
                                className="text-xs font-bold text-gray-500 hover:text-red-600 transition"
                            >
                                Reset to Default
                            </button>

                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsCustomizeOpen(false)}
                                    className="px-4 py-2 rounded-xl border border-gray-300 dark:border-slate-700 text-xs font-bold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-800 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleSaveDashboardConfig();
                                        setIsCustomizeOpen(false);
                                    }}
                                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-black transition shadow-md"
                                >
                                    Save Preferences
                                </button>
                            </div>
                        </div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
};

export default Dashboard;
