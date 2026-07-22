import { useState, useEffect, useCallback, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';

const api = (path, opts = {}) =>
    axios({ url: `/api${path}`, ...opts, headers: { Authorization: `Bearer ${sessionStorage.getItem('token')}`, ...opts.headers } });

const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN') : '';
const escHtml = (s) => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const fmtDateTime = () => new Date().toLocaleString('en-IN', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit', second:'2-digit', hour12:true });

// Searchable Dropdown
const SearchableDropdown = ({ options = [], value, onChange, placeholder = 'Search...', disabled = false }) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef(null);
    const selected = options.find(o => o.value === value);
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div ref={ref} className="relative w-full">
            <button type="button" disabled={disabled} onClick={() => setOpen(o => !o)}
                className={`w-full px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-bold text-gray-800 focus:ring-2 focus:ring-indigo-500 transition-all flex items-center justify-between shadow-sm ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                <span className={selected ? 'text-gray-800' : 'text-gray-400'}>{selected ? selected.label : placeholder}</span>
                <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
            </button>
            {open && (
                <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                    <div className="p-2 border-b border-gray-100">
                        <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
                            placeholder="Type to search..." className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500" />
                    </div>
                    <div className="max-h-52 overflow-y-auto">
                        {filtered.length === 0
                            ? <div className="px-4 py-3 text-xs text-gray-400 text-center">No results found</div>
                            : filtered.map(o => (
                                <button key={o.value} type="button"
                                    onClick={() => { onChange(o.value); setSearch(''); setOpen(false); }}
                                    className={`w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 hover:text-indigo-700 transition-colors ${o.value === value ? 'bg-indigo-50 text-indigo-700 font-bold' : 'text-gray-700'}`}>
                                    {o.label}
                                </button>
                            ))
                        }
                    </div>
                </div>
            )}
        </div>
    );
};

// Date Filter Bar
const DateFilterBar = ({ from, to, onFromChange, onToChange, onApply, onClear, disabled }) => (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-3 items-end">
        <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">From Date</label>
            <input type="date" value={from} onChange={e => onFromChange(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1">To Date</label>
            <input type="date" value={to} onChange={e => onToChange(e.target.value)}
                className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 outline-none" />
        </div>
        <button onClick={onApply} disabled={disabled}
            className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors">
            Apply Filter
        </button>
        {(from || to) && (
            <button onClick={onClear} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm hover:bg-gray-50 transition-colors">
                Clear
            </button>
        )}
    </div>
);

const Spinner = () => (
    <div className="flex justify-center items-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600"></div>
    </div>
);

const EmptyState = ({ icon, title, subtitle }) => (
    <div className="text-center py-16 text-gray-400">
        <p className="text-4xl mb-3">{icon}</p>
        <p className="text-lg font-medium text-gray-600">{title}</p>
        <p className="text-sm mt-1">{subtitle}</p>
    </div>
);

// Print / Download helper
const openOrDownload = (html, filename, mode = 'print') => {
    if (mode === 'download') {
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 2000);
    } else {
        const w = window.open('', '_blank');
        w.document.write(html);
        w.document.close();
        setTimeout(() => w.print(), 700);
    }
};

const A4 = `
@page { size: A4 portrait; margin: 12mm 10mm 12mm 10mm; }
@media print { html, body { width: 210mm; } body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

// Build Ledger HTML
const buildLedgerHtml = ({ entityName, entityAddress, entries, openingBalance, currentBalance, from, to, settings }) => {
    const company = settings?.companyName || 'Company';
    const period = from && to ? `${fmtDate(from)} To ${fmtDate(to)}` : from ? `From ${fmtDate(from)}` : to ? `Till ${fmtDate(to)}` : 'All Dates';
    const allEntries = [];
    if (openingBalance !== 0 || entries.length === 0) allEntries.push({ isOpening: true, amount: openingBalance });
    allEntries.push(...entries);
    const totDr = entries.reduce((s, e) => s + (e.debit || 0), 0);
    const totCr = entries.reduce((s, e) => s + (e.credit || 0), 0);

    const rows = allEntries.map(e => {
        if (e.isOpening) {
            return `<tr style="background:#f8f8f8"><td colspan="5"><b>Opening Balance :</b></td><td style="text-align:right"><b>${fmt(e.amount)}</b></td><td></td></tr>`;
        }
        const vt = e.type === 'bill' ? 'Sales/Purch' : e.type === 'payment' ? 'Receipt' : e.type === 'adjustment' ? 'Journal' : escHtml(e.type);
        return `<tr>
<td style="white-space:nowrap">${fmtDate(e.date)}</td>
<td>${escHtml(e.description)}</td>
<td>${escHtml(e.notes)}</td>
<td>${vt}</td>
<td>${escHtml(e.refNumber)}</td>
<td style="text-align:right">${e.debit > 0 ? fmt(e.debit) : ''}</td>
<td style="text-align:right">${e.credit > 0 ? fmt(e.credit) : ''}</td>
</tr>`;
    }).join('');

    const addr    = settings?.address  || '';
    const phone1  = settings?.phone1   || '';
    const phone2  = settings?.phone2   || '';
    const gst     = settings?.gstNumber || '';
    const phones  = [phone1, phone2].filter(Boolean).join(' / ');
    const addrLine  = [addr, phones].filter(Boolean).join('  |  ');
    const gstLine   = gst ? `GST No: ${gst}` : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Ledger - ${escHtml(entityName)}</title>
<style>
${A4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:5mm}
.co-name{text-align:center;font-size:22px;font-weight:900;letter-spacing:0.5px;margin-bottom:2px;text-transform:uppercase}
.co-addr{text-align:center;font-size:11px;color:#111;margin-bottom:1px}
.co-gst{text-align:center;font-size:11px;color:#111;margin-bottom:4px}
.rpt-title{text-align:center;font-size:14px;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin-bottom:5px}
.en{font-weight:bold;font-size:14px;margin:3px 0 1px}
.ea{font-size:12px;color:#444}
.pr{font-size:12px;color:#444;margin:2px 0 5px}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid #000}
th{border:1.5px solid #000;padding:5px 6px;font-size:13px;font-weight:bold;background:#d8d8d8;text-align:left;white-space:nowrap}
th.r{text-align:right}
td{border:1px solid #444;padding:3px 6px;font-size:13px;font-weight:bold;color:#000;overflow:hidden;word-break:break-word}
td.r{text-align:right;white-space:nowrap}
tfoot td{font-weight:900;background:#c8c8c8!important;border:1.5px solid #000;font-size:14px}
tfoot .cls{border-top:1.5px solid #000;border-bottom:3px double #000;text-align:right;font-size:14px}
</style></head><body>
<div class="co-name">${escHtml(company)}</div>
${addrLine ? `<div class="co-addr">${escHtml(addrLine)}</div>` : ''}
${gstLine  ? `<div class="co-gst">${escHtml(gstLine)}</div>`   : ''}
<div class="rpt-title">Ledger &nbsp;&nbsp; Date : ${period}</div>
<div class="en">Account: ${escHtml(entityName)}</div>
${entityAddress ? `<div class="ea">${escHtml(entityAddress)}</div>` : ''}
<div style="margin-bottom:8px"></div>
<table>
<colgroup>
<col style="width:80px"/><col style="width:160px"/><col style="width:90px"/>
<col style="width:80px"/><col style="width:70px"/>
<col style="width:90px"/><col style="width:90px"/>
</colgroup>
<thead><tr>
<th>Date</th><th>Particulars</th><th>Remarks</th>
<th>Vch Type</th><th>Vch No</th>
<th class="r">Debit</th><th class="r">Credit</th>
</tr></thead>
<tbody>${rows}</tbody>
<tfoot>
<tr>
<td colspan="3" style="font-size:12px">Tot Cr: ${fmt(totCr)} &nbsp; Tot Dr: ${fmt(totDr)} &nbsp; Closing Balance:</td>
<td colspan="2"></td>
<td style="text-align:right">${fmt(totDr)}</td>
<td style="text-align:right">${fmt(totCr)}</td>
</tr>
<tr>
<td colspan="5" style="font-weight:900;font-size:12px;padding-top:2px">Closing Balance</td>
<td colspan="2" class="cls">${fmt(currentBalance)}</td>
</tr>
</tfoot>
</table>
<div style="margin-top:6px;font-size:8.5px;color:#666;text-align:right">Generated on: ${fmtDateTime()}</div>
</body></html>`;
};

// Build Receivables / Payables HTML
const buildRPHtml = ({ type, entityName, entityAddress, pendingBills, totalPending, settings }) => {
    const company = settings?.companyName || 'Company';
    const title = type === 'receivable' ? 'Receivables' : 'Payables';
    const label = type === 'receivable' ? 'Customer' : 'Vendor';

    const rows = pendingBills.map(b => `<tr>
<td>${escHtml(b.refNumber || '-')}</td>
<td style="text-align:right">${fmt(b.pendingAmount)}</td>
<td>${fmtDate(b.date)}</td>
<td style="text-align:right">${b.osDays}</td>
</tr>`).join('');

    // Build company header lines from settings
    const addr    = settings?.address  || '';
    const phone1  = settings?.phone1   || '';
    const phone2  = settings?.phone2   || '';
    const gst     = settings?.gstNumber || '';
    const phones  = [phone1, phone2].filter(Boolean).join(' / ');
    const addrLine  = [addr, phones].filter(Boolean).join('  |  ');
    const gstLine   = gst ? `GST No: ${gst}` : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${title} - ${escHtml(entityName)}</title>
<style>
${A4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:5mm}
.co-name{text-align:center;font-size:22px;font-weight:900;letter-spacing:0.5px;margin-bottom:2px;text-transform:uppercase}
.co-addr{text-align:center;font-size:11px;color:#111;margin-bottom:1px}
.co-gst{text-align:center;font-size:11px;color:#111;margin-bottom:4px}
.rpt-title{text-align:center;font-size:14px;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin-bottom:5px}
.en{font-weight:bold;font-size:14px;margin:3px 0 1px}
.ea{font-size:12px;color:#444}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid #000}
th{border:1.5px solid #000;padding:5px 6px;font-size:13px;font-weight:bold;background:#d8d8d8;text-align:left;white-space:nowrap}
th.r{text-align:right}
td{border:1px solid #444;padding:3px 6px;font-size:13px;font-weight:bold;color:#000;overflow:hidden;word-break:break-word}
td.r{text-align:right;white-space:nowrap}
.sec td{font-weight:900;background:#bbb!important;border:1.5px solid #000;font-size:14px}
.tot1 td.a{border-top:1.5px solid #000;border-bottom:1.5px solid #000;text-align:right;font-weight:900}
.tot2 td.a{font-weight:900;font-size:14px;text-align:right}
.grand td{font-weight:900;font-size:15px;padding:5px 6px;text-align:right;background:#c8c8c8!important;border:1.5px solid #000}
</style></head><body>
<div class="co-name">${escHtml(company)}</div>
${addrLine ? `<div class="co-addr">${escHtml(addrLine)}</div>` : ''}
${gstLine  ? `<div class="co-gst">${escHtml(gstLine)}</div>`   : ''}
<div class="rpt-title">${title} &nbsp;&nbsp; Date : All Dates</div>
<div class="en">Name: ${escHtml(entityName)}</div>
${entityAddress ? `<div class="ea" style="margin-bottom:8px">${escHtml(entityAddress)}</div>` : '<div style="margin-bottom:8px"></div>'}
<table>
<colgroup>
<col style="width:120px"/><col style="width:140px"/><col style="width:110px"/><col/>
</colgroup>
<thead><tr>
<th>Ref No</th><th class="r">Pending Amt</th><th>Due Date</th><th class="r">OD Days</th>
</tr></thead>
<tbody>
<tr class="sec"><td colspan="4">${label}</td></tr>
${rows}
<tr class="tot1"><td></td><td class="a">${fmt(totalPending)}</td><td></td><td></td></tr>
<tr class="tot2"><td></td><td class="a">${fmt(totalPending)}</td><td colspan="2"></td></tr>
</tbody>
</table>
<div style="margin-top:12px"></div>
<table>
<colgroup><col style="width:120px"/><col style="width:140px"/><col style="width:110px"/><col/></colgroup>
<tbody><tr class="grand"><td colspan="4">Total: &nbsp; ${fmt(totalPending)}</td></tr></tbody>
</table>
<div style="margin-top:6px;font-size:9px;color:#555;text-align:right">Generated on: ${fmtDateTime()}</div>
</body></html>`;
};

// Build Outstanding Summary HTML
const buildOSSHtml = ({ entityType, summaries, from, to, settings }) => {
    const company = settings?.companyName || 'Company';
    const period = from && to ? `${fmtDate(from)} To ${fmtDate(to)}` : from ? `From ${fmtDate(from)}` : to ? `Till ${fmtDate(to)}` : 'All Dates';
    const title = entityType === 'customer' ? 'Customer' : 'Vendor';
    const grandDr  = summaries.reduce((s, r) => s + (r.closingBalance > 0 ? r.closingBalance : 0), 0);
    const grandCr  = summaries.reduce((s, r) => s + (r.closingBalance < 0 ? Math.abs(r.closingBalance) : 0), 0);
    const grandBal = summaries.reduce((s, r) => s + r.closingBalance, 0);

    const rows = summaries.map(r => `<tr>
<td>${escHtml(r.name)}</td>
<td style="text-align:right">${r.closingBalance > 0 ? fmt(r.closingBalance) : ''}</td>
<td style="text-align:right">${r.closingBalance < 0 ? fmt(Math.abs(r.closingBalance)) : ''}</td>
<td style="text-align:right">${r.closingBalance < 0 ? '-' : ''}${fmt(Math.abs(r.closingBalance))}</td>
<td>${escHtml(r.phone)}</td>
</tr>`).join('');

    // Build company header lines from settings
    const addr   = settings?.address   || '';
    const phone1 = settings?.phone1    || '';
    const phone2 = settings?.phone2    || '';
    const gst    = settings?.gstNumber || '';
    const phones  = [phone1, phone2].filter(Boolean).join(' / ');
    const addrLine = [addr, phones].filter(Boolean).join('  |  ');
    const gstLine  = gst ? `GST No: ${gst}` : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Outstanding Summary - ${title}</title>
<style>
${A4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:5mm}
.co-name{text-align:center;font-size:22px;font-weight:900;letter-spacing:0.5px;margin-bottom:2px;text-transform:uppercase}
.co-addr{text-align:center;font-size:11px;color:#111;margin-bottom:1px}
.co-gst{text-align:center;font-size:11px;color:#111;margin-bottom:4px}
.rpt-title{text-align:center;font-size:14px;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin-bottom:5px}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid #000}
th{border:1.5px solid #000;padding:5px 6px;font-size:13px;font-weight:bold;
   background:#d8d8d8;text-align:left;white-space:nowrap}
th.r{text-align:right}
td{border:1px solid #444;padding:3px 6px;font-size:13px;font-weight:bold;color:#000;overflow:hidden}
td.r{text-align:right;white-space:nowrap}
.sec td{font-weight:900;background:#bbb!important;border:1.5px solid #000;font-size:14px}
.tot td{font-weight:900;background:#c8c8c8!important;border:1.5px solid #000;font-size:14px}
</style></head><body>
<div class="co-name">${escHtml(company)}</div>
${addrLine ? `<div class="co-addr">${escHtml(addrLine)}</div>` : ''}
${gstLine  ? `<div class="co-gst">${escHtml(gstLine)}</div>`   : ''}
<div class="rpt-title">${title} &nbsp;&nbsp; Date : ${period}</div>
<table>
<colgroup><col/><col style="width:100px"/><col style="width:100px"/><col style="width:100px"/><col style="width:115px"/></colgroup>
<thead><tr>
<th>Particulars</th><th class="r">Pending (Dr)</th><th class="r">Advance (Cr)</th><th class="r">Closing</th><th>Cell</th>
</tr></thead>
<tbody>
<tr class="sec"><td colspan="5"><b>${title}</b></td></tr>
${rows}
<tr class="tot">
<td></td>
<td class="r">${fmt(grandDr)}</td>
<td class="r">${fmt(grandCr)}</td>
<td class="r">${grandBal < 0 ? '-' : ''}${fmt(Math.abs(grandBal))}</td>
<td></td>
</tr>
</tbody>
</table>
<div style="margin-top:6px;font-size:9px;color:#555;text-align:right">Generated on: ${fmtDateTime()}</div>
</body></html>`;
};

// Convenience wrappers — actual emoji chars used directly in strings (these are JS strings, not JSX text)
const printLedger                 = (opts) => openOrDownload(buildLedgerHtml(opts), `Ledger_${opts.entityName}.html`,        'print');
const downloadLedger              = (opts) => openOrDownload(buildLedgerHtml(opts), `Ledger_${opts.entityName}.html`,        'download');
const printReceivablesPayables    = (opts) => openOrDownload(buildRPHtml(opts),     `${opts.type}_${opts.entityName}.html`,  'print');
const downloadReceivablesPayables = (opts) => openOrDownload(buildRPHtml(opts),     `${opts.type}_${opts.entityName}.html`,  'download');
const printOutstandingSummary     = (opts) => openOrDownload(buildOSSHtml(opts),    `Outstanding_${opts.entityType}.html`,   'print');
const downloadOutstandingSummary  = (opts) => openOrDownload(buildOSSHtml(opts),    `Outstanding_${opts.entityType}.html`,   'download');

// Build Purchase Report HTML
const buildPurchaseHtml = ({ orders, from, to, settings }) => {
    const company = settings?.companyName || 'Company';
    const period = from && to ? `${fmtDate(from)} To ${fmtDate(to)}` : from ? `From ${fmtDate(from)}` : to ? `Till ${fmtDate(to)}` : 'All Dates';
    const grandTotal = orders.reduce((s, o) => s + o.totalAmount, 0);

    const rows = orders.map((o, i) => `<tr>
<td>${i + 1}</td>
<td>${fmtDate(o.orderDate)}</td>
<td>${escHtml(o.vendorBillNumber || '-')}</td>
<td>${fmtDate(o.billDate || o.orderDate)}</td>
<td>Credit</td>
<td>Purchase</td>
<td>${escHtml(o.vendor?.name || '-')}</td>
<td class="r">${fmt(o.totalAmount)}</td>
</tr>`).join('');

    // Build company header lines from settings
    const addr    = settings?.address  || '';
    const phone1  = settings?.phone1   || '';
    const phone2  = settings?.phone2   || '';
    const gst     = settings?.gstNumber || '';
    const phones  = [phone1, phone2].filter(Boolean).join(' / ');
    const addrLine  = [addr, phones].filter(Boolean).join('  |  ');
    const gstLine   = gst ? `GST No: ${gst}` : '';

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Purchase Report</title>
<style>
${A4}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,sans-serif;font-size:13px;color:#000;padding:5mm}
.co-name{text-align:center;font-size:22px;font-weight:900;letter-spacing:0.5px;margin-bottom:2px;text-transform:uppercase}
.co-addr{text-align:center;font-size:11px;color:#111;margin-bottom:1px}
.co-gst{text-align:center;font-size:11px;color:#111;margin-bottom:4px}
.rpt-title{text-align:center;font-size:14px;font-weight:bold;border-top:2px solid #000;border-bottom:2px solid #000;padding:3px 0;margin-bottom:5px}
table{width:100%;border-collapse:collapse;table-layout:fixed;border:1.5px solid #000}
th{border:1.5px solid #000;padding:5px 6px;font-size:13px;font-weight:bold;background:#ebd77b;text-align:left;white-space:nowrap}
th.r{text-align:right}
td{border:1px solid #444;padding:3px 6px;font-size:13px;font-weight:bold;color:#000;overflow:hidden;word-break:break-word}
td.r{text-align:right;white-space:nowrap}
.tot td{font-weight:900;background:#ebd77b!important;border:1.5px solid #000;font-size:14px}
</style></head><body>
<div class="co-name">${escHtml(company)}</div>
${addrLine ? `<div class="co-addr">${escHtml(addrLine)}</div>` : ''}
${gstLine  ? `<div class="co-gst">${escHtml(gstLine)}</div>`   : ''}
<div class="rpt-title">Purchase Display &nbsp;&nbsp; Date : ${period}</div>
<div style="margin-bottom:8px"></div>
<table>
<colgroup><col style="width:45px"/><col style="width:85px"/><col style="width:85px"/><col style="width:85px"/><col style="width:75px"/><col style="width:75px"/><col/><col style="width:95px"/></colgroup>
<thead><tr>
<th>S.No</th><th>Date</th><th>Inv No</th><th>Inv Date</th><th>Inv Type</th><th>Series</th><th>Party Name</th><th class="r">Net Amount</th>
</tr></thead>
<tbody>
${rows}
<tr class="tot">
<td colspan="7" class="r">TOTAL</td>
<td class="r">${fmt(grandTotal)}</td>
</tr>
</tbody>
</table>
<div style="margin-top:6px;font-size:9px;color:#555;text-align:right">Generated on: ${fmtDateTime()}</div>
</body></html>`;
};

const printPurchaseReport    = (opts) => openOrDownload(buildPurchaseHtml(opts), `Purchase_Report.html`, 'print');
const downloadPurchaseReport = (opts) => openOrDownload(buildPurchaseHtml(opts), `Purchase_Report.html`, 'download');

// Shared button styles
const BtnPrint    = ({ onClick, disabled, children }) => (
    <button onClick={onClick} disabled={disabled}
        className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5">
        {children}
    </button>
);
const BtnDownload = ({ onClick, disabled, children }) => (
    <button onClick={onClick} disabled={disabled}
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm flex items-center gap-1.5">
        {children}
    </button>
);
const BtnPrintSm    = ({ onClick, children }) => (
    <button onClick={onClick}
        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1">
        {children}
    </button>
);
const BtnDownloadSm = ({ onClick, children }) => (
    <button onClick={onClick}
        className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-semibold hover:bg-emerald-700 transition-colors flex items-center gap-1">
        {children}
    </button>
);

// TAB 1 - Ledger Report
const LedgerReport = ({ settings }) => {
    const [entityType, setEntityType] = useState('customer');
    const [customers, setCustomers] = useState([]);
    const [vendors, setVendors] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api('/customers?limit=2000').then(r => setCustomers(r.data.data.customers || [])).catch(() => {});
        api('/vendors?limit=2000').then(r => setVendors(r.data.data.vendors || [])).catch(() => {});
    }, []);

    useEffect(() => { setSelectedId(''); setData(null); }, [entityType]);

    const fetchLedger = useCallback(async () => {
        if (!selectedId) { setData(null); return; }
        setLoading(true);
        try {
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const r = entityType === 'customer'
                ? await api(`/customers/${selectedId}/ledger`, { params })
                : await api(`/vendor-ledger/${selectedId}`, { params });
            setData(r.data.data);
        } catch { toast.error('Failed to fetch ledger'); }
        finally { setLoading(false); }
    }, [selectedId, from, to, entityType]);

    useEffect(() => { if (selectedId) fetchLedger(); }, [selectedId]);

    const entityList = entityType === 'customer'
        ? customers.map(c => ({ value: c._id, label: c.companyName || c.name }))
        : vendors.map(v => ({ value: v._id, label: v.companyName || v.name }));

    const selectedEntity = entityType === 'customer'
        ? customers.find(c => c._id === selectedId)
        : vendors.find(v => v._id === selectedId);

    const rawEntries     = entityType === 'customer' ? (data?.entries || []) : (data?.ledger || []);
    const bbf            = entityType === 'customer' ? (data?.bbf ?? 0) : (data?.bbf ?? (selectedEntity?.openingBalance || 0));
    const currentBalance = entityType === 'customer'
        ? (data?.currentBalance ?? 0)
        : (data?.currentBalance ?? (selectedEntity?.currentBalance || 0));

    const displayEntries = [...rawEntries];
    if (bbf !== 0) {
        displayEntries.unshift({
            _id: 'bbf', date: from ? new Date(from).toISOString() : new Date().toISOString(),
            type: 'opening', refNumber: from ? 'B/F' : 'OPENING',
            description: from ? 'Balance Brought Forward' : 'Opening Balance',
            debit: bbf > 0 ? bbf : 0, credit: bbf < 0 ? Math.abs(bbf) : 0, balance: bbf
        });
    }

    const totDr = rawEntries.reduce((s, e) => s + (e.debit || 0), 0);
    const totCr = rawEntries.reduce((s, e) => s + (e.credit || 0), 0);

    const entityAddress = selectedEntity
        ? [selectedEntity.address?.billing?.street, selectedEntity.address?.billing?.city, selectedEntity.address?.billing?.state].filter(Boolean).join(', ')
        : '';

    const printOpts = {
        entityName: selectedEntity ? (selectedEntity.companyName || selectedEntity.name) : '',
        entityAddress, entries: rawEntries, openingBalance: bbf, currentBalance, from, to, settings
    };

    const typeLabel = (type) => {
        if (type === 'bill')    return { badge: 'bg-orange-100 text-orange-700', label: 'Bill' };
        if (type === 'payment') return { badge: 'bg-green-100 text-green-700',  label: 'Payment' };
        if (type === 'opening') return { badge: 'bg-blue-100 text-blue-700',    label: 'Opening' };
        return { badge: 'bg-gray-100 text-gray-600', label: 'Adj' };
    };
    const vchType = (type) => {
        if (type === 'bill')       return entityType === 'customer' ? 'Sales' : 'Purchase';
        if (type === 'payment')    return 'Receipt';
        if (type === 'adjustment') return 'Journal';
        return type || '';
    };

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">Account Type</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {['customer', 'vendor'].map(t => (
                            <button key={t} onClick={() => setEntityType(t)}
                                className={`px-5 py-2 text-sm font-semibold transition-colors ${entityType === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {t === 'customer' ? 'Customer' : 'Vendor'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">
                        Select {entityType === 'customer' ? 'Customer' : 'Vendor'}
                    </label>
                    <SearchableDropdown options={entityList} value={selectedId} onChange={setSelectedId}
                        placeholder={`-- Select ${entityType === 'customer' ? 'Customer' : 'Vendor'} --`} />
                </div>
                <BtnPrint onClick={() => printLedger(printOpts)} disabled={!selectedId || !data}>
                    Print Ledger
                </BtnPrint>
                <BtnDownload onClick={() => downloadLedger(printOpts)} disabled={!selectedId || !data}>
                    Download
                </BtnDownload>
            </div>

            <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
                onApply={fetchLedger} onClear={() => { setFrom(''); setTo(''); }}
                disabled={!selectedId} />

            {selectedId && data && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className={`rounded-xl p-4 shadow-sm border ${currentBalance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-green-50 border-green-200'}`}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Closing Balance</p>
                        <p className={`text-2xl font-black mt-1 ${currentBalance > 0 ? 'text-orange-600' : 'text-green-600'}`}>
                            {'\u20B9'}{fmt(Math.abs(currentBalance))}
                        </p>
                        <p className="text-xs mt-1 text-gray-500">{currentBalance > 0 ? 'Dr (Outstanding)' : currentBalance < 0 ? 'Cr (Advance)' : 'Settled'}</p>
                    </div>
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Pending (Dr)</p>
                        <p className="text-2xl font-black mt-1 text-red-600">{'\u20B9'}{fmt(totDr)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Advance (Cr)</p>
                        <p className="text-2xl font-black mt-1 text-green-600">{'\u20B9'}{fmt(totCr)}</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">
                        {selectedEntity ? (selectedEntity.companyName || selectedEntity.name) : 'Ledger Entries'}
                    </h2>
                    <span className="text-sm text-gray-400">{displayEntries.length} entries</span>
                </div>
                {loading ? <Spinner /> : !selectedId ? (
                    <EmptyState icon="📒" title="Select an Account" subtitle="Choose a customer or vendor to view their ledger." />
                ) : displayEntries.length === 0 ? (
                    <EmptyState icon="📭" title="No entries found" subtitle="No ledger entries for the selected period." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Date</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Particulars</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase">Remarks</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Vch Type</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase whitespace-nowrap">Vch No</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right whitespace-nowrap">Debit (Dr)</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right whitespace-nowrap">Credit (Cr)</th>
                                    <th className="px-3 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right whitespace-nowrap">Balance</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {displayEntries.map((entry, i) => {
                                    const tl = typeLabel(entry.type);
                                    return (
                                        <tr key={entry._id || i} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-3 py-2.5 text-gray-700 whitespace-nowrap text-xs">{fmtDate(entry.date)}</td>
                                            <td className="px-3 py-2.5 text-gray-800">
                                                <div className="text-xs">{entry.description}</div>
                                                <span className={`inline-block text-[10px] font-semibold px-1.5 py-0.5 rounded-full mt-0.5 ${tl.badge}`}>{tl.label}</span>
                                            </td>
                                            <td className="px-3 py-2.5 text-gray-500 text-xs">{entry.notes || ''}</td>
                                            <td className="px-3 py-2.5 text-gray-600 text-xs whitespace-nowrap">{vchType(entry.type)}</td>
                                            <td className="px-3 py-2.5 font-mono text-gray-700 text-xs whitespace-nowrap">{entry.refNumber || '-'}</td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-red-600 whitespace-nowrap text-xs">
                                                {entry.debit > 0 ? <>{'\u20B9'}{fmt(entry.debit)}</> : <span className="text-gray-200">-</span>}
                                            </td>
                                            <td className="px-3 py-2.5 text-right font-semibold text-green-600 whitespace-nowrap text-xs">
                                                {entry.credit > 0 ? <>{'\u20B9'}{fmt(entry.credit)}</> : <span className="text-gray-200">-</span>}
                                            </td>
                                            <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap text-xs ${(entry.balance ?? 0) >= 0 ? 'text-orange-600' : 'text-green-600'}`}>
                                                {'\u20B9'}{fmt(Math.abs(entry.balance ?? 0))}
                                                <span className="text-[10px] font-normal ml-1">{(entry.balance ?? 0) >= 0 ? 'Dr' : 'Cr'}</span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={5} className="px-3 py-3 font-bold text-sm">TOTALS</td>
                                    <td className="px-3 py-3 text-right font-bold text-red-300 text-sm">{'\u20B9'}{fmt(totDr)}</td>
                                    <td className="px-3 py-3 text-right font-bold text-green-300 text-sm">{'\u20B9'}{fmt(totCr)}</td>
                                    <td className={`px-3 py-3 text-right font-bold text-sm ${currentBalance >= 0 ? 'text-orange-300' : 'text-green-300'}`}>
                                        {'\u20B9'}{fmt(Math.abs(currentBalance))} {currentBalance >= 0 ? 'Dr' : 'Cr'}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// TAB 2 - Receivables
const ReceivablesReport = ({ settings }) => {
    const [customers, setCustomers] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api('/customers?limit=2000').then(r => setCustomers(r.data.data.customers || [])).catch(() => {});
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedId) params.customer = selectedId;
            if (from) params.from = from;
            if (to) params.to = to;
            const r = await api('/customers/reports/receivables', { params });
            setData(r.data.data);
        } catch { toast.error('Failed to fetch receivables'); }
        finally { setLoading(false); }
    }, [selectedId, from, to]);

    useEffect(() => { fetchData(); }, []);

    const grandTotal = (data || []).reduce((s, r) => s + r.totalPending, 0);

    const makePrintOpts = (row) => ({
        type: 'receivable',
        entityName: row.name,
        entityAddress: (row.address || []).join(', '),
        pendingBills: row.pendingBills,
        totalPending: row.totalPending,
        settings
    });

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Customer (optional)</label>
                    <SearchableDropdown
                        options={[{ value: '', label: 'All Customers' }, ...customers.map(c => ({ value: c._id, label: c.companyName || c.name }))]}
                        value={selectedId} onChange={setSelectedId} placeholder="-- All Customers --" />
                </div>
            </div>
            <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
                onApply={fetchData} onClear={() => { setFrom(''); setTo(''); }} />

            {data && data.length > 0 && (
                <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-xl p-4 shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold uppercase opacity-80">Total Receivables</p>
                        <p className="text-3xl font-black">{'\u20B9'}{fmt(grandTotal)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs opacity-80">{data.length} {data.length === 1 ? 'Customer' : 'Customers'}</p>
                        <p className="text-sm font-semibold">{data.reduce((s, r) => s + r.pendingBills.length, 0)} Pending Bills</p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {loading ? <Spinner /> : !data || data.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                        <EmptyState icon="🎉" title="No Pending Receivables" subtitle="All bills are settled!" />
                    </div>
                ) : data.map(row => (
                    <div key={row.customerId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-orange-50 border-b border-orange-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800">{row.name}</h3>
                                {row.contact && <p className="text-xs text-gray-500">{row.contact}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right mr-2">
                                    <p className="text-xs text-gray-500">Total Pending</p>
                                    <p className="font-bold text-orange-600">{'\u20B9'}{fmt(row.totalPending)}</p>
                                </div>
                                <BtnPrintSm onClick={() => printReceivablesPayables(makePrintOpts(row))}>Print</BtnPrintSm>
                                <BtnDownloadSm onClick={() => downloadReceivablesPayables(makePrintOpts(row))}>Download</BtnDownloadSm>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Ref No</th>
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Pending Amt</th>
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">OD Days</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {row.pendingBills.map((bill, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2.5 font-mono font-semibold text-gray-800 text-xs">{bill.refNumber}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-orange-600 text-xs">{'\u20B9'}{fmt(bill.pendingAmount)}</td>
                                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs">{fmtDate(bill.date)}</td>
                                            <td className={`px-4 py-2.5 text-right font-bold text-xs ${bill.osDays > 60 ? 'text-red-600' : bill.osDays > 30 ? 'text-orange-500' : 'text-gray-600'}`}>
                                                {bill.osDays}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 border-t-2 border-orange-200">
                                        <td colSpan={3} className="px-4 py-2 font-bold text-gray-700 text-sm">Total</td>
                                        <td className="px-4 py-2 text-right font-bold text-orange-600 text-sm">{'\u20B9'}{fmt(row.totalPending)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// TAB 3 - Payables
const PayablesReport = ({ settings }) => {
    const [vendors, setVendors] = useState([]);
    const [selectedId, setSelectedId] = useState('');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        api('/vendors?limit=2000').then(r => setVendors(r.data.data.vendors || [])).catch(() => {});
    }, []);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (selectedId) params.vendor = selectedId;
            if (from) params.from = from;
            if (to) params.to = to;
            const r = await api('/vendor-ledger/reports/payables', { params });
            setData(r.data.data);
        } catch { toast.error('Failed to fetch payables'); }
        finally { setLoading(false); }
    }, [selectedId, from, to]);

    useEffect(() => { fetchData(); }, []);

    const grandTotal = (data || []).reduce((s, r) => s + r.totalPending, 0);

    const makePrintOpts = (row) => ({
        type: 'payable',
        entityName: row.name,
        entityAddress: '',
        pendingBills: row.pendingBills,
        totalPending: row.totalPending,
        settings
    });

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-48">
                    <label className="block text-xs font-semibold text-gray-500 mb-1">Filter by Vendor (optional)</label>
                    <SearchableDropdown
                        options={[{ value: '', label: 'All Vendors' }, ...vendors.map(v => ({ value: v._id, label: v.companyName || v.name }))]}
                        value={selectedId} onChange={setSelectedId} placeholder="-- All Vendors --" />
                </div>
            </div>
            <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
                onApply={fetchData} onClear={() => { setFrom(''); setTo(''); }} />

            {data && data.length > 0 && (
                <div className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-xl p-4 shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold uppercase opacity-80">Total Payables</p>
                        <p className="text-3xl font-black">{'\u20B9'}{fmt(grandTotal)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs opacity-80">{data.length} {data.length === 1 ? 'Vendor' : 'Vendors'}</p>
                        <p className="text-sm font-semibold">{data.reduce((s, r) => s + r.pendingBills.length, 0)} Pending Bills</p>
                    </div>
                </div>
            )}

            <div className="space-y-4">
                {loading ? <Spinner /> : !data || data.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                        <EmptyState icon="✅" title="No Pending Payables" subtitle="All vendor dues are cleared!" />
                    </div>
                ) : data.map(row => (
                    <div key={row.vendorId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="px-5 py-3 bg-blue-50 border-b border-blue-100 flex items-center justify-between">
                            <div>
                                <h3 className="font-bold text-gray-800">{row.name}</h3>
                                {row.contact && <p className="text-xs text-gray-500">{row.contact}</p>}
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="text-right mr-2">
                                    <p className="text-xs text-gray-500">Total Pending</p>
                                    <p className="font-bold text-blue-600">{'\u20B9'}{fmt(row.totalPending)}</p>
                                </div>
                                <BtnPrintSm onClick={() => printReceivablesPayables(makePrintOpts(row))}>Print</BtnPrintSm>
                                <BtnDownloadSm onClick={() => downloadReceivablesPayables(makePrintOpts(row))}>Download</BtnDownloadSm>
                            </div>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-100">
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Ref No</th>
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Pending Amt</th>
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Due Date</th>
                                        <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">OD Days</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {row.pendingBills.map((bill, i) => (
                                        <tr key={i} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-2.5 font-mono font-semibold text-gray-800 text-xs">{bill.refNumber}</td>
                                            <td className="px-4 py-2.5 text-right font-semibold text-blue-600 text-xs">{'\u20B9'}{fmt(bill.pendingAmount)}</td>
                                            <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap text-xs">{fmtDate(bill.date)}</td>
                                            <td className={`px-4 py-2.5 text-right font-bold text-xs ${bill.osDays > 60 ? 'text-red-600' : bill.osDays > 30 ? 'text-orange-500' : 'text-gray-600'}`}>
                                                {bill.osDays}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot>
                                    <tr className="bg-gray-100 border-t-2 border-blue-200">
                                        <td colSpan={3} className="px-4 py-2 font-bold text-gray-700 text-sm">Total</td>
                                        <td className="px-4 py-2 text-right font-bold text-blue-600 text-sm">{'\u20B9'}{fmt(row.totalPending)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

// TAB 4 - Outstanding Summary
const OutstandingSummary = ({ settings }) => {
    const [entityType, setEntityType] = useState('customer');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            const endpoint = entityType === 'customer'
                ? '/customers/reports/outstanding-summary'
                : '/vendor-ledger/reports/outstanding-summary';
            const r = await api(endpoint, { params });
            setData(r.data.data);
        } catch { toast.error('Failed to fetch outstanding summary'); }
        finally { setLoading(false); }
    }, [entityType, from, to]);

    useEffect(() => { fetchData(); setSearch(''); }, [entityType]);

    const allRows = (data || []).filter(r => Math.abs(r.closingBalance) > 0.001);
    const rows = search.trim()
        ? allRows.filter(r => r.name?.toLowerCase().includes(search.trim().toLowerCase()))
        : allRows;
    const grandDebit   = rows.reduce((s, r) => s + (r.closingBalance > 0 ? r.closingBalance : 0), 0);
    const grandCredit  = rows.reduce((s, r) => s + (r.closingBalance < 0 ? Math.abs(r.closingBalance) : 0), 0);
    const grandBalance = rows.reduce((s, r) => s + r.closingBalance, 0);
    const printOpts = { entityType, summaries: rows, from, to, settings };

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-end justify-between">
                <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-2">Account Type</label>
                    <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                        {['customer', 'vendor'].map(t => (
                            <button key={t} onClick={() => setEntityType(t)}
                                className={`px-5 py-2 text-sm font-semibold transition-colors ${entityType === t ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>
                                {t === 'customer' ? 'Customer' : 'Vendor'}
                            </button>
                        ))}
                    </div>
                </div>
                <div className="flex gap-2">
                    <BtnPrint onClick={() => printOutstandingSummary(printOpts)} disabled={!data || rows.length === 0}>
                        Print Summary
                    </BtnPrint>
                    <BtnDownload onClick={() => downloadOutstandingSummary(printOpts)} disabled={!data || rows.length === 0}>
                        Download
                    </BtnDownload>
                </div>
            </div>

            <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
                onApply={fetchData} onClear={() => { setFrom(''); setTo(''); }} />

            {data && rows.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Pending (Dr)</p>
                        <p className="text-2xl font-black mt-1 text-red-600">{'\u20B9'}{fmt(grandDebit)}</p>
                    </div>
                    <div className="bg-green-50 border border-green-200 rounded-xl p-4 shadow-sm">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Advance (Cr)</p>
                        <p className="text-2xl font-black mt-1 text-green-600">{'\u20B9'}{fmt(grandCredit)}</p>
                    </div>
                    <div className={`rounded-xl p-4 shadow-sm border ${grandBalance > 0 ? 'bg-orange-50 border-orange-200' : 'bg-blue-50 border-blue-200'}`}>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Outstanding</p>
                        <p className={`text-2xl font-black mt-1 ${grandBalance > 0 ? 'text-orange-600' : 'text-blue-600'}`}>{'\u20B9'}{fmt(Math.abs(grandBalance))}</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                    <h2 className="font-bold text-gray-800">{entityType === 'customer' ? 'Customer' : 'Vendor'} Outstanding Summary</h2>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
                            <input
                                type="text"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder={`Search ${entityType === 'customer' ? 'customer' : 'vendor'}...`}
                                className="pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 w-56"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm">✕</button>
                            )}
                        </div>
                        <span className="text-sm text-gray-400 whitespace-nowrap">
                            {search ? `${rows.length} of ${allRows.length}` : `${rows.length}`} accounts
                        </span>
                    </div>
                </div>
                {loading ? <Spinner /> : !data || rows.length === 0 ? (
                    <EmptyState icon="📊" title="No data" subtitle="No outstanding balances found." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-gray-50 border-b border-gray-100">
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">#</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Particulars</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Debit (Dr)</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Credit (Cr)</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Closing Balance</th>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Contact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {rows.map((row, i) => (
                                    <tr key={row.customerId || row.vendorId} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-4 py-2.5 text-gray-400 text-xs">{i + 1}</td>
                                        <td className="px-4 py-2.5 font-semibold text-gray-800 text-sm">{row.name}</td>
                                        <td className="px-4 py-2.5 text-right text-red-600 font-semibold text-xs">
                                            {row.closingBalance > 0 ? <>{'\u20B9'}{fmt(row.closingBalance)}</> : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className="px-4 py-2.5 text-right text-green-600 font-semibold text-xs">
                                            {row.closingBalance < 0 ? <>{'\u20B9'}{fmt(Math.abs(row.closingBalance))}</> : <span className="text-gray-300">-</span>}
                                        </td>
                                        <td className={`px-4 py-2.5 text-right font-bold text-xs ${row.closingBalance > 0 ? 'text-orange-600' : row.closingBalance < 0 ? 'text-blue-600' : 'text-gray-400'}`}>
                                            {row.closingBalance !== 0
                                                ? <>{row.closingBalance < 0 ? '-' : ''}{'\u20B9'}{fmt(Math.abs(row.closingBalance))}</>
                                                : 'Settled'}
                                        </td>
                                        <td className="px-4 py-2.5 text-gray-500 text-xs">{row.phone || ''}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-gray-800 text-white">
                                    <td colSpan={2} className="px-4 py-3 font-bold text-sm">GRAND TOTAL</td>
                                    <td className="px-4 py-3 text-right font-bold text-red-300">{'\u20B9'}{fmt(grandDebit)}</td>
                                    <td className="px-4 py-3 text-right font-bold text-green-300">{'\u20B9'}{fmt(grandCredit)}</td>
                                    <td className={`px-4 py-3 text-right font-bold text-lg ${grandBalance >= 0 ? 'text-orange-300' : 'text-blue-300'}`}>
                                        {grandBalance < 0 ? '-' : ''}{'\u20B9'}{fmt(Math.abs(grandBalance))}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// TAB 5 - Purchase Report
const PurchaseReport = ({ settings }) => {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const params = {};
            if (from) params.from = from;
            if (to) params.to = to;
            params.limit = 5000;
            const r = await api('/purchase-orders', { params });
            setData(r.data.data.orders.filter(o => o.totalAmount > 0));
        } catch { toast.error('Failed to fetch purchase orders'); }
        finally { setLoading(false); }
    }, [from, to]);

    useEffect(() => { fetchData(); }, []);

    const grandTotal = (data || []).reduce((s, r) => s + r.totalAmount, 0);
    const printOpts = { orders: data || [], from, to, settings };

    return (
        <div className="space-y-5">
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex flex-wrap gap-4 items-end justify-between">
                <div>
                    <h2 className="font-bold text-gray-800">Purchase Report</h2>
                    <p className="text-xs text-gray-500 mt-1">View all purchases within a date range.</p>
                </div>
                <div className="flex gap-2">
                    <BtnPrint onClick={() => printPurchaseReport(printOpts)} disabled={!data || data.length === 0}>
                        Print Report
                    </BtnPrint>
                    <BtnDownload onClick={() => downloadPurchaseReport(printOpts)} disabled={!data || data.length === 0}>
                        Download
                    </BtnDownload>
                </div>
            </div>

            <DateFilterBar from={from} to={to} onFromChange={setFrom} onToChange={setTo}
                onApply={fetchData} onClear={() => { setFrom(''); setTo(''); }} />

            {data && data.length > 0 && (
                <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-xl p-4 shadow-md flex justify-between items-center">
                    <div>
                        <p className="text-xs font-bold uppercase opacity-80">Total Purchase Amount</p>
                        <p className="text-3xl font-black">{'\u20B9'}{fmt(grandTotal)}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-xs opacity-80">{data.length} {data.length === 1 ? 'Bill' : 'Bills'}</p>
                    </div>
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h2 className="font-bold text-gray-800">Purchase Display</h2>
                    <span className="text-sm text-gray-400">{data ? data.length : 0} bills</span>
                </div>
                {loading ? <Spinner /> : !data || data.length === 0 ? (
                    <EmptyState icon="📦" title="No Purchases" subtitle="No purchase records found." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead>
                                <tr className="bg-amber-100 border-b border-amber-200">
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">S.No</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">Date</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">Inv No</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">Inv Date</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">Inv Type</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">Series</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase">Party Name</th>
                                    <th className="px-4 py-2.5 text-xs font-bold text-amber-900 uppercase text-right">Net Amount</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {data.map((row, i) => (
                                    <tr key={row._id} className="hover:bg-amber-50 transition-colors">
                                        <td className="px-4 py-2.5 text-gray-500 text-xs">{i + 1}</td>
                                        <td className="px-4 py-2.5 text-gray-800 text-xs whitespace-nowrap">{fmtDate(row.orderDate)}</td>
                                        <td className="px-4 py-2.5 font-mono text-gray-800 text-xs">{row.vendorBillNumber || '-'}</td>
                                        <td className="px-4 py-2.5 text-gray-800 text-xs whitespace-nowrap">{fmtDate(row.billDate || row.orderDate)}</td>
                                        <td className="px-4 py-2.5 text-gray-800 text-xs">Credit</td>
                                        <td className="px-4 py-2.5 text-gray-800 text-xs">Purchase</td>
                                        <td className="px-4 py-2.5 font-semibold text-gray-800 text-sm">{row.vendor?.name}</td>
                                        <td className="px-4 py-2.5 text-right font-bold text-gray-900 text-sm">{'\u20B9'}{fmt(row.totalAmount)}</td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot>
                                <tr className="bg-amber-200">
                                    <td colSpan={7} className="px-4 py-3 font-bold text-amber-900 text-right text-sm">TOTAL</td>
                                    <td className="px-4 py-3 text-right font-bold text-amber-900 text-sm">{'\u20B9'}{fmt(grandTotal)}</td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// Main Component
const TABS = [
    { id: 'ledger',      label: 'Ledger Report'       },
    { id: 'purchase',    label: 'Purchase Report'      },
    { id: 'receivables', label: 'Receivables'          },
    { id: 'payables',    label: 'Payables'             },
    { id: 'outstanding', label: 'Outstanding Summary'  },
];

const TAB_COLORS = {
    ledger:      { active: 'bg-indigo-600 text-white', inactive: 'border border-indigo-200 text-indigo-700 hover:bg-indigo-50' },
    purchase:    { active: 'bg-amber-500 text-white',  inactive: 'border border-amber-200 text-amber-700 hover:bg-amber-50' },
    receivables: { active: 'bg-orange-500 text-white', inactive: 'border border-orange-200 text-orange-700 hover:bg-orange-50' },
    payables:    { active: 'bg-blue-600 text-white',   inactive: 'border border-blue-200 text-blue-700 hover:bg-blue-50'       },
    outstanding: { active: 'bg-purple-600 text-white', inactive: 'border border-purple-200 text-purple-700 hover:bg-purple-50' },
};

const CustomReports = () => {
    const [activeTab, setActiveTab] = useState('ledger');
    const [settings, setSettings] = useState(null);

    useEffect(() => {
        api('/settings/billing').then(r => setSettings(r.data.data)).catch(() => {});
    }, []);

    return (
        <div className="space-y-6 pb-24 lg:pb-8">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-gray-100">
                <div>
                    <h1 className="text-2xl font-black text-gray-900">Custom Reports</h1>
                    <p className="text-sm text-gray-500 mt-0.5">Ledger, Purchases, Receivables, Payables &amp; Outstanding Summary</p>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-3">
                <div className="flex flex-wrap gap-2">
                    {TABS.map(tab => {
                        const isActive = activeTab === tab.id;
                        const colors = TAB_COLORS[tab.id];
                        return (
                            <button key={tab.id} id={`custom-report-tab-${tab.id}`}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-4 py-2.5 rounded-lg text-sm font-bold transition-all duration-200 shadow-sm ${isActive ? colors.active + ' shadow-md' : 'bg-white ' + colors.inactive}`}>
                                {tab.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="min-h-64">
                {activeTab === 'ledger'      && <LedgerReport      settings={settings} />}
                {activeTab === 'purchase'    && <PurchaseReport    settings={settings} />}
                {activeTab === 'receivables' && <ReceivablesReport  settings={settings} />}
                {activeTab === 'payables'    && <PayablesReport     settings={settings} />}
                {activeTab === 'outstanding' && <OutstandingSummary settings={settings} />}
            </div>
        </div>
    );
};

export default CustomReports;
