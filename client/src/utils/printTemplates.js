// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// Shared print execution utility (fixes iOS Safari popup blocker issues)
// ─────────────────────────────────────────────────────────────────────────────
export const executePrint = (html) => {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (isMobile || isIOS) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'fixed';
        iframe.style.right = '0';
        iframe.style.bottom = '0';
        iframe.style.width = '0';
        iframe.style.height = '0';
        iframe.style.border = '0';
        document.body.appendChild(iframe);

        iframe.contentWindow.document.open();
        iframe.contentWindow.document.write(html);
        iframe.contentWindow.document.close();

        setTimeout(() => {
            iframe.contentWindow.focus();
            iframe.contentWindow.print();
            setTimeout(() => {
                if (document.body.contains(iframe)) {
                    document.body.removeChild(iframe);
                }
            }, 60000); // 1 minute cleanup
        }, 800);
    } else {
        const w = window.open('', '_blank', 'width=900,height=700');
        if (w) {
            w.document.write(html);
            w.document.close();
            setTimeout(() => { w.focus(); w.print(); }, 600);
        } else {
            alert('Popup blocker prevented printing. Please allow popups for this site.');
        }
    }
};

// Shared Indian number formatting utility
// ─────────────────────────────────────────────────────────────────────────────
export const formatIndianNumber = (num, decimals = 2) => {
    if (num === null || num === undefined || isNaN(num) || num === '') return '0.00';
    return Number(num).toLocaleString('en-IN', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    });
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared number-to-words utility
// ─────────────────────────────────────────────────────────────────────────────
export const numberToWords = (num) => {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
    if ((num = num.toString()).length > 9) return 'Amount too large';
    let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
    if (!n) return '';
    let str = '';
    str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
    str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
    str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
    str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
    str += (n[5] != 0) ? ((str !== '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only' : 'Only';
    return 'Rupees ' + str;
};

// ─────────────────────────────────────────────────────────────────────────────
// Shared item rows builder
// ─────────────────────────────────────────────────────────────────────────────
// Get human readable unit string
const getUnitLabel = (item) => {
    let u = (item.billingUnit || item.stockUnit || item.unitType || '').toLowerCase();
    if (u === 'qty' || u === 'pieces' || u === 'units' || u === 'pcs') return 'nos';
    if (u === 'boxes') return 'box';
    return u;
};

// Detects if an item is a tile-type (has sqFt billing) vs simple qty (bags, paste, etc.)
const isTileItem = (item) => !!(item.totalSqFt > 0 || item.boxCount > 0);

// Detect if ANY item in order uses tiles columns — used to decide header labels
const orderHasTileItems = (items) => items.some(isTileItem);
const orderHasSimpleItems = (items) => items.some(i => !isTileItem(i));

// Build smart item rows — unified qty column with unit suffix
const buildItemRows = (items, settings, taxPct, isQuotation) => {
    return items.map((item, i) => {
        const total = item.total || item.quantity * item.price;
        const taxAmt = (total * taxPct / 100);
        const withTax = total + taxAmt;
        const brand = (item.brand || '').trim();
        const size  = (item.size  || '').trim();
        const namePart = (item.name || '').toUpperCase();
        const subPart  = [brand, size].filter(Boolean).join(' ');
        const fullDesc = subPart ? `${namePart}-${subPart}` : namePart;
        
        const isTile = isTileItem(item);
        let qtyCell;
        if (isTile) {
            qtyCell = item.boxCount ? parseFloat(Number(item.boxCount).toFixed(2)).toString() : '';
        } else {
            const u = getUnitLabel(item);
            const unitSuffix = u ? ` (${u})` : '';
            const qtyVal = formatIndianNumber(item.primaryQty || item.quantity || 0, 2);
            qtyCell = `${qtyVal}${unitSuffix}`;
        }
        const sqftCell = isTile ? formatIndianNumber(item.totalSqFt, 2) : '';

        return `<tr style="height:10px">
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${fullDesc}</strong></td>
            <td style="text-align:center;font-weight:bold">${qtyCell}</td>
            <td style="text-align:center">${sqftCell}</td>
            <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
            <td style="text-align:right;font-weight:bold">${formatIndianNumber(withTax, 2)}</td>
        </tr>`;
    }).join('');
};


// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 1  — Classic Black Border (Professional)
// ─────────────────────────────────────────────────────────────────────────────
const template1 = (order, settings, docType = 'invoice') => {
    const s = settings || {};
    const taxPct = (order.taxRate !== undefined && order.taxRate !== null && order.taxRate !== '')
        ? parseFloat(order.taxRate)
        : (order.taxAmount > 0 ? (s.documentConfig?.defaultTaxRate || 18) : 0);
    const isQuotation = docType === 'quotation';
    const title = isQuotation
        ? (s.documentConfig?.quotationTitle || 'QUOTATION')
        : (s.documentConfig?.invoiceTitle || 'TAX INVOICE');
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const docDate = isQuotation ? (order.quotationDate || order.orderDate || order.createdAt) : order.orderDate;
    const hasTiles = orderHasTileItems(order.items || []);
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    return `<html><head><meta charset="UTF-8"><title>${title}_${docNo}_${(order.customer?.companyName || order.customer?.name || 'Customer').replace(/[^a-zA-Z0-9\\s-]/g, '').trim().replace(/\\s+/g, '_')}</title>
<style>
  @page { size: A4; margin: 5mm; }
  body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; margin: 0; display: flex; justify-content: center; }
  .container { border: 1.5px solid #000; width: 190mm; margin: 0 auto; display: flex; flex-direction: column; min-height: 285mm; }
  .company-header { text-align: center; padding: 10px; border-bottom: 1.5px solid #000; position: relative; }
  .contact-info { position: absolute; top: 8px; right: 10px; font-size: 8px; font-weight: bold; text-align: right; }
  .company-header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
  .company-header p { margin: 2px 0; font-size: 11px; }
  .doc-title { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 5px; padding: 5px; border-bottom: 1.5px solid #000; }
  .meta-grid { display: grid; grid-template-columns: 1.5fr 1fr; border-bottom: 1.5px solid #000; }
  .meta-box { padding: 6px 10px; }
  .meta-box:first-child { border-right: 1.5px solid #000; }
  .meta-row { display: flex; margin-bottom: 2px; font-size: 11px; }
  .meta-label { width: 110px; font-weight: bold; }
  .items-table { border-bottom: 1.5px solid #000; flex: 1; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  .items-table > table { min-height: 201mm; height: 100%; }
  th, td { padding: 5px; font-size: 11px; border-right: 1.5px solid #000; }
  th:last-child, td:last-child { border-right: none; }
  th { border-bottom: 1.5px solid #000; background: #fff; font-weight: bold; text-transform: uppercase; font-size: 11px; }
  td { vertical-align: top; border-bottom: none; }
  .filler td { height: 100%; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  .summary-section { display: flex; border-bottom: 1.5px solid #000; min-height: 100px; }
  .summary-left { flex: 1.8; padding: 0; display: flex; flex-direction: column; border-right: 1.5px solid #000; }
  .summary-right { flex: 1; padding: 0; }
  .tax-table { width: 100%; border-collapse: collapse; font-size: 10px; }
  .tax-table th, .tax-table td { border: 1px solid #000; padding: 2px 4px; text-align: right; }
  .math-row { display: flex; justify-content: space-between; padding: 3px 8px; font-size: 11px; }
  .grand-total { background: #000; color: #fff; font-weight: bold; font-size: 12px; padding: 6px 8px; display: flex; justify-content: space-between; margin-top: auto; }
  .footer { padding: 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; }
</style></head><body>
<div class="container">
  <div class="company-header" style="min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
    ${logoSrc ? `<div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%);"><img src="${logoSrc}" alt="Logo" style="max-height:65px;max-width:180px;object-fit:contain;display:block;"/></div>` : ''}
    <div class="contact-info">CELL: ${s.phone1 || ''}${s.phone2 ? ', ' + s.phone2 : ''}</div>
    <div style="margin: 0 auto; width: 60%; z-index: 1;">
        <h1>${s.companyName || 'YOUR COMPANY'}</h1>
        <p>${s.address || ''}</p>
        ${s.gstNumber ? `<p><strong>GSTIN: ${s.gstNumber}</strong></p>` : ''}
        ${s.panNumber ? `<p><strong>PAN: ${s.panNumber}</strong></p>` : ''}
    </div>
  </div>
  <div class="doc-title">${title}</div>
  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">To:</span><strong>${(order.customer?.companyName || order.customer?.name || 'Cash Sales').toUpperCase()}</strong></div>
      ${order.customer?.name && order.customer?.companyName ? `<div class="meta-row"><span class="meta-label"></span>${order.customer.name}</div>` : ''}
      ${order.customer?.phone ? `<div class="meta-row"><span class="meta-label">Phone:</span>${order.customer.phone}</div>` : ''}
      ${order.customer?.gstin ? `<div class="meta-row"><span class="meta-label">GSTIN:</span>${order.customer.gstin}</div>` : ''}
      ${order.siteName ? `<div class="meta-row"><span class="meta-label"></span><span style="font-weight:bold;color:#333">🏗️ ${order.siteName}</span></div>` : ''}
      ${order.siteAddress ? `<div class="meta-row"><span class="meta-label"></span><span style="color:#555;font-size:9px">${order.siteAddress}</span></div>` : ''}
      ${(() => { const a = order.customer?.address?.billing || {}; const parts = [a.street, a.city, a.state, a.zipCode].filter(Boolean); return parts.length ? `<div class="meta-row"><span class="meta-label">Address:</span><span style="font-size:9px">${parts.join(', ')}</span></div>` : ''; })()}
    </div>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">No:</span><strong style="font-size:14px">${docNo}</strong></div>
      <div class="meta-row"><span class="meta-label">Date:</span>${new Date(docDate).toLocaleDateString()}</div>
      ${isQuotation ? `<div class="meta-row"><span class="meta-label">Valid Until:</span>${order.validUntil ? new Date(order.validUntil).toLocaleDateString() : '-'}</div>` : ''}
    </div>
  </div>
  <div class="items-table">
    <table>
      <thead><tr>
        <th width="4%">S.No</th>
        <th width="54%">Description</th>
        <th width="12%">Box</th>
        <th width="9%">Quantity</th>
        <th width="10%">Rate</th>
        <th width="11%">Amount</th>
      </tr></thead>
      <tbody>
        ${buildItemRows(order.items, settings, taxPct, isQuotation)}
        <tr class="filler"><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  <div class="summary-section">
    <div class="summary-left">
      <div style="padding:8px 10px;border-bottom:1px solid #000">
        <div style="font-size: 10px;font-weight:bold;margin-bottom:3px">TAX ANALYSIS:</div>
        <table class="tax-table">
          <thead><tr><th>Taxable Value</th><th>CGST%</th><th>CGST Amt</th><th>SGST%</th><th>SGST Amt</th><th>Total Tax</th></tr></thead>
          <tbody><tr>
            <td>${formatIndianNumber(order.itemsTotal || 0, 2)}</td>
            <td>${taxPct > 0 ? taxPct / 2 + '%' : '0%'}</td>
            <td>${formatIndianNumber((order.taxAmount || 0) / 2, 2)}</td>
            <td>${taxPct > 0 ? taxPct / 2 + '%' : '0%'}</td>
            <td>${formatIndianNumber((order.taxAmount || 0) / 2, 2)}</td>
            <td>${formatIndianNumber(order.taxAmount || 0, 2)}</td>
          </tr></tbody>
        </table>
      </div>
      <div style="padding:8px 10px;flex:1">
        <div style="font-size: 10px;font-weight:bold;text-decoration:underline;margin-bottom:3px">AMOUNT IN WORDS:</div>
        <div style="font-weight:bold;text-transform:uppercase;font-size:8.5px">${numberToWords(Math.round(order.totalAmount || 0))}</div>
        <div style="font-size:7px;margin-top:8px;line-height:1.4">${terms.replace(/\n/g, '<br/>')}</div>
      </div>
    </div>
    <div class="summary-right">
      <div class="math-row"><span>Taxable Value:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.itemsTotal || 0, 2)}</span></div>
      ${order.loadingCharges > 0 ? `<div class="math-row"><span>Loading:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.loadingCharges, 2)}</span></div>` : ''}
      ${order.unloadingCharges > 0 ? `<div class="math-row"><span>Unloading:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.unloadingCharges, 2)}</span></div>` : ''}
      ${order.transportCharges > 0 ? `<div class="math-row"><span>Transport:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.transportCharges, 2)}</span></div>` : ''}
      ${(order.discountAmount || 0) > 0 ? `<div class="math-row" style="color:green"><span>Discount:</span><span>- ${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.discountAmount, 2)}</span></div>` : ''}
      ${order.oldBalance > 0 ? `<div class="math-row"><span>Old Balance:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.oldBalance, 2)}</span></div>` : ''}
      ${order.advanceAmount > 0 ? `<div class="math-row" style="color:green"><span>Advance${order.advancePaymentType ? ' (' + order.advancePaymentType + ')' : ''}:</span><span>- ${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.advanceAmount, 2)}</span></div>` : ''}
      ${order.roundOffAmount !== undefined && order.roundOffAmount !== 0 ? `<div class="math-row"><span>Round Off:</span><span>${order.roundOffAmount > 0 ? '+' : ''}${formatIndianNumber(order.roundOffAmount, 2)}</span></div>` : ''}
      <div class="grand-total"><span>NET AMOUNT:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>
  <div class="footer">
    <div style="font-size:8px">
      ${order.user?.name ? `<div style="font-weight:bold">Created By: ${order.user.name}</div>` : ''}
      ${order.user?.phone ? `<div style="color:#555">${order.user.phone}</div>` : ''}
    </div>
    <div style="text-align:center;border-top:1px solid #000;width:150px;padding-top:4px">RECEIVER'S SIGNATURE</div>
    <div style="text-align:center;width:200px">
      ${s.branding?.bankName ? `<div style="font-size:7px;margin-bottom:6px"><b>Bank:</b> ${s.branding.bankName}${s.branding.branchName ? ', ' + s.branding.branchName : ''} | <b>A/C:</b> ${s.branding.accountNumber || ''} | <b>IFSC:</b> ${s.branding.ifscCode || ''}</div>` : ''}
      <div style="font-weight:bold;margin-bottom:35px;font-size:8.5px">For ${s.companyName || 'COMPANY'}</div>
      <div style="border-top:1px solid #000;padding-top:4px">AUTHORISED SIGNATORY</div>
    </div>
  </div>
</div></body></html>`;
};


// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 2  — Executive (Dark Header + Color Accents)
// ─────────────────────────────────────────────────────────────────────────────
const template2 = (order, settings, docType = 'invoice') => {
    const s = settings || {};
    const taxPct = (order.taxRate !== undefined && order.taxRate !== null && order.taxRate !== '')
        ? parseFloat(order.taxRate)
        : (order.taxAmount > 0 ? (s.documentConfig?.defaultTaxRate || 18) : 0);
    const isQuotation = docType === 'quotation';
    const title = isQuotation ? (s.documentConfig?.quotationTitle || 'QUOTATION') : (s.documentConfig?.invoiceTitle || 'TAX INVOICE');
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const docDate = isQuotation ? (order.quotationDate || order.orderDate || order.createdAt) : order.orderDate;
    const hasTiles2 = orderHasTileItems(order.items || []);
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const sym = s.documentConfig?.currencySymbol || '₹';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    return `<html><head><meta charset="UTF-8"><title>${title}_${docNo}_${(order.customer?.companyName || order.customer?.name || 'Customer').replace(/[^a-zA-Z0-9\\s-]/g, '').trim().replace(/\\s+/g, '_')}</title>
<style>
  @page { size: A4; margin: 5mm; }
  body { font-family: 'Arial', sans-serif; font-size: 10px; color: #1a1a2e; margin: 0; background: #fff; display: flex; justify-content: center; }
  .container { width: 190mm; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .company-sub { font-size: 8px; opacity: 0.7; margin-top: 3px; }
  .company-contact { text-align: right; font-size: 8px; opacity: 0.85; line-height: 1.8; }
  .doc-band { background: #e84393; color: white; padding: 6px 20px; display: flex; justify-content: space-between; align-items: center; }
  .doc-band-title { font-size: 14px; font-weight: 900; letter-spacing: 4px; }
  .doc-band-no { font-size: 16px; font-weight: 900; }
  .meta-section { display: flex; padding: 12px 20px; border-bottom: 2px solid #f0f0f0; gap: 20px; }
  .meta-left { flex: 1.5; }
  .meta-right { flex: 1; background: #f8f9ff; border-radius: 8px; padding: 8px 12px; }
  .meta-title { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
  .meta-value { font-size: 11px; font-weight: 700; color: #1a1a2e; }
  .meta-row2 { display: flex; justify-content: space-between; font-size: 11px; margin-bottom: 3px; }
  .items-section { 
     border-top: 2px solid #1a1a2e; 
     min-height: 150mm;
     background-image: 
        linear-gradient(to right, transparent calc(4% - 0.5px), #f0f0f0 calc(4% - 0.5px), #f0f0f0 calc(4% + 0.5px), transparent calc(4% + 0.5px)),
        linear-gradient(to right, transparent calc(58% - 0.5px), #f0f0f0 calc(58% - 0.5px), #f0f0f0 calc(58% + 0.5px), transparent calc(58% + 0.5px)),
        linear-gradient(to right, transparent calc(69% - 0.5px), #f0f0f0 calc(69% - 0.5px), #f0f0f0 calc(69% + 0.5px), transparent calc(69% + 0.5px)),
        linear-gradient(to right, transparent calc(78% - 0.5px), #f0f0f0 calc(78% - 0.5px), #f0f0f0 calc(78% + 0.5px), transparent calc(78% + 0.5px)),
        linear-gradient(to right, transparent calc(87% - 0.5px), #f0f0f0 calc(87% - 0.5px), #f0f0f0 calc(87% + 0.5px), transparent calc(87% + 0.5px));
  }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; table-layout: fixed; }
  th { background: #1a1a2e; color: white; padding: 6px 6px; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; border-right: 1px solid #2d2d4e; text-align: left; }
  th:last-child { border-right: none; }
  td { padding: 5px 6px; font-size: 11px; border-bottom: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0; vertical-align: top; }
  td:last-child { border-right: none; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals-section { display: flex; border-top: 2px solid #1a1a2e; }
  .totals-left { flex: 1.6; padding: 12px 15px; border-right: 1px solid #e8e8e8; }
  .totals-right { flex: 1; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 12px; font-size: 11px; border-bottom: 1px solid #f5f5f5; }
  .net-total { background: #1a1a2e; color: white; font-weight: bold; font-size: 13px; padding: 7px 12px; display: flex; justify-content: space-between; }
  .footer { padding: 12px 20px; display: flex; justify-content: space-between; border-top: 1px solid #eee; }
  .sig { text-align: center; }
  .sig-label { font-size: 8px; font-weight: bold; color: #666; border-top: 1px solid #1a1a2e; padding-top: 4px; margin-top: 35px; }
  .words-box { background: #f0f4ff; border-left: 3px solid #1a1a2e; padding: 6px 10px; margin-bottom: 8px; font-size: 11px; }
  .tax-mini { font-size: 10px; color: #555; }
</style></head><body>
<div class="container">
  <div class="header">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height:50px;max-width:150px;object-fit:contain;margin-bottom:6px;display:block;"/>` : ''}
      <div class="company-name">${s.companyName || 'YOUR COMPANY'}</div>
      <div class="company-sub">${s.address || ''}</div>
      ${s.gstNumber ? `<div class="company-sub">GSTIN: ${s.gstNumber}</div>` : ''}
      ${s.panNumber ? `<div class="company-sub">PAN: ${s.panNumber}</div>` : ''}
    </div>
    <div class="company-contact">
      ${s.phone1 ? `📞 ${s.phone1}` : ''}${s.phone2 ? `<br/>📞 ${s.phone2}` : ''}
      ${s.branding?.email ? `<br/>✉ ${s.branding.email}` : ''}
      ${s.branding?.website ? `<br/>🌐 ${s.branding.website}` : ''}
    </div>
  </div>
  <div class="doc-band">
    <div class="doc-band-title">${title}</div>
    <div class="doc-band-no">${docNo}</div>
  </div>
  <div class="meta-section">
    <div class="meta-left">
      <div class="meta-title">Bill To</div>
      <div class="meta-value">${(order.customer?.companyName || order.customer?.name || 'Cash Sales').toUpperCase()}</div>
      ${order.customer?.name && order.customer?.companyName ? `<div style="font-size: 11px;color:#555;margin-top:1px">${order.customer.name}</div>` : ''}
      ${order.customer?.phone ? `<div style="font-size: 11px;color:#555;margin-top:2px">📞 ${order.customer.phone}</div>` : ''}
      ${order.customer?.gstin ? `<div style="font-size:8px;color:#777">GSTIN: ${order.customer.gstin}</div>` : ''}
      ${order.siteName ? `<div style="font-size: 11px;font-weight:bold;color:#e84393;margin-top:2px">🏗️ ${order.siteName}</div>` : ''}
      ${order.siteAddress ? `<div style="font-size: 11px;color:#555;margin-top:1px">📍 ${order.siteAddress}</div>` : ''}
      ${(() => { const a = order.customer?.address?.billing || {}; const parts = [a.street, a.city, a.state, a.zipCode].filter(Boolean); return parts.length ? `<div style="font-size: 11px;color:#555;margin-top:2px">${parts.join(', ')}</div>` : ''; })()}
    </div>
    <div class="meta-right">
      <div class="meta-row2"><span style="color:#999">Date:</span><strong>${new Date(docDate).toLocaleDateString()}</strong></div>
      ${isQuotation ? `<div class="meta-row2"><span style="color:#999">Valid Until:</span><strong>${order.validUntil ? new Date(order.validUntil).toLocaleDateString() : '-'}</strong></div>` : ''}
      ${order.terms ? `<div class="meta-row2"><span style="color:#999">Terms:</span><strong>${order.terms}</strong></div>` : ''}
    </div>
  </div>
  <div class="items-section">
    <table class="item-table">
      <thead><tr>
        <th width="4%">S.No</th>
        <th width="54%">Description</th>
        <th width="11%">Box</th>
        <th width="9%">Quantity</th>
        <th width="9%">Rate</th>
        <th width="13%">Amount</th>
      </tr></thead>
      <tbody>
      ${order.items.map((item, i) => {
          const total = item.total || item.quantity * item.price;
          const withTax = total + (total * taxPct / 100);
          const isTile = isTileItem(item);
          let qtyCell;
          if (isTile) {
              qtyCell = item.boxCount ? parseFloat(Number(item.boxCount).toFixed(2)).toString() : '';
          } else {
              const u = getUnitLabel(item);
              const unitSuffix = u ? ` (${u})` : '';
              const qtyVal = formatIndianNumber(item.primaryQty || item.quantity || 0, 2);
              qtyCell = `${qtyVal}${unitSuffix}`;
          }
          const sqftCell = isTile ? formatIndianNumber(item.totalSqFt, 2) : '';
          const desc = (() => { const b=(item.brand||'').trim(); const sz=(item.size||'').trim(); const n=(item.name||'').toUpperCase(); const sub=[b,sz].filter(Boolean).join(' '); return sub ? n+'-'+sub : n; })();
          return `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${desc}</strong></td>
            <td style="text-align:center;font-weight:bold">${qtyCell}</td>
            <td style="text-align:center">${sqftCell}</td>
            <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
            <td style="text-align:right;font-weight:bold">${formatIndianNumber(withTax, 2)}</td>
          </tr>`;
      }).join('')}
      </tbody>
    </table>
  </div>
  <div class="totals-section">
    <div class="totals-left">
      <div class="words-box">
        <strong>Amount in Words:</strong><br/>${numberToWords(Math.round(order.totalAmount || 0))}
      </div>
      <div class="tax-mini">
        <strong>Tax: </strong>Taxable: ${sym}${formatIndianNumber(order.itemsTotal, 2)} | CGST ${taxPct / 2}%: ${sym}${formatIndianNumber((order.taxAmount || 0) / 2, 2)} | SGST ${taxPct / 2}%: ${sym}${formatIndianNumber((order.taxAmount || 0) / 2, 2)}
      </div>
      <div style="font-size:7px;margin-top:6px;color:#888;line-height:1.5">${terms.replace(/\n/g, ' | ')}</div>
    </div>
    <div class="totals-right">
      <div class="total-row"><span>Subtotal:</span><span><b>${sym}${formatIndianNumber(order.itemsTotal || 0, 2)}</b></span></div>
      ${order.taxAmount > 0 ? `<div class="total-row"><span>Tax (${taxPct}%):</span><span>${sym}${formatIndianNumber(order.taxAmount || 0, 2)}</span></div>` : ''}
      ${order.loadingCharges > 0 ? `<div class="total-row"><span>Loading:</span><span>${sym}${formatIndianNumber(order.loadingCharges, 2)}</span></div>` : ''}
      ${order.unloadingCharges > 0 ? `<div class="total-row"><span>Unloading:</span><span>${sym}${formatIndianNumber(order.unloadingCharges, 2)}</span></div>` : ''}
      ${order.transportCharges > 0 ? `<div class="total-row"><span>Transport:</span><span>${sym}${formatIndianNumber(order.transportCharges, 2)}</span></div>` : ''}
      ${(order.discountAmount || 0) > 0 ? `<div class="total-row" style="color:green"><span>Discount:</span><span>- ${sym}${formatIndianNumber(order.discountAmount, 2)}</span></div>` : ''}
      ${order.advanceAmount > 0 ? `<div class="total-row" style="color:green"><span>Advance${order.advancePaymentType ? ' (' + order.advancePaymentType + ')' : ''}:</span><span>- ${sym}${formatIndianNumber(order.advanceAmount, 2)}</span></div>` : ''}
      ${order.roundOffAmount !== undefined && order.roundOffAmount !== 0 ? `<div class="total-row"><span>Round Off:</span><span>${order.roundOffAmount > 0 ? '+' : ''}${formatIndianNumber(order.roundOffAmount, 2)}</span></div>` : ''}
      <div class="net-total"><span>TOTAL:</span><span>${sym}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>
  <div class="footer">
    <div class="sig"><div class="sig-label">CUSTOMER SIGNATURE</div></div>
    <div style="text-align:center">
      ${s.branding?.bankName ? `<div style="font-size: 10px;color:#888"><b>Bank:</b> ${s.branding.bankName}${s.branding.branchName ? ', ' + s.branding.branchName : ''} | <b>A/C:</b> ${s.branding.accountNumber || ''} | <b>IFSC:</b> ${s.branding.ifscCode || ''}</div>` : ''}
      ${order.user?.name ? `<div style="font-size: 10px;color:#888;margin-top:3px"><b>Created By:</b> ${order.user.name}${order.user?.phone ? ' · ' + order.user.phone : ''}</div>` : ''}
    </div>
    <div class="sig"><div style="font-size: 10px;color:#777;margin-bottom:0">For ${s.companyName || 'COMPANY'}</div><div class="sig-label">AUTHORISED SIGNATORY</div></div>
  </div>
</div></body></html>`;
};


// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 3  — Minimal / Clean (Light & Modern)
// ─────────────────────────────────────────────────────────────────────────────
const template3 = (order, settings, docType = 'invoice') => {
    const s = settings || {};
    const taxPct = (order.taxRate !== undefined && order.taxRate !== null && order.taxRate !== '')
        ? parseFloat(order.taxRate)
        : (order.taxAmount > 0 ? (s.documentConfig?.defaultTaxRate || 18) : 0);
    const isQuotation = docType === 'quotation';
    const title = isQuotation ? (s.documentConfig?.quotationTitle || 'Quotation') : (s.documentConfig?.invoiceTitle || 'Tax Invoice');
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const docDate = isQuotation ? (order.quotationDate || order.orderDate || order.createdAt) : order.orderDate;
    const hasTiles3 = orderHasTileItems(order.items || []);
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const sym = s.documentConfig?.currencySymbol || '₹';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    return `<html><head><meta charset="UTF-8"><title>${title}_${docNo}_${(order.customer?.companyName || order.customer?.name || 'Customer').replace(/[^a-zA-Z0-9\\s-]/g, '').trim().replace(/\\s+/g, '_')}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #333; margin: 0; background: #fff; display: flex; justify-content: center; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; width: 190mm; }
  .company-name { font-size: 24px; font-weight: 900; color: #111; letter-spacing: -0.5px; }
  .company-detail { font-size: 11px; color: #888; margin-top: 4px; line-height: 1.7; }
  .doc-info { text-align: right; }
  .doc-type { font-size: 22px; font-weight: 900; color: #111; }
  .doc-number { font-size: 12px; color: #888; font-weight: 600; }
  .doc-date { font-size: 11px; color: #aaa; margin-top: 3px; }
  .divider { height: 2px; background: #111; margin: 12px 0; }
  .thin-divider { height: 1px; background: #eee; margin: 10px 0; }
  .bill-section { display: flex; gap: 30px; margin-bottom: 14px; }
  .bill-to { flex: 1.5; }
  .bill-to-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #bbb; margin-bottom: 4px; }
  .bill-to-name { font-size: 13px; font-weight: 800; color: #111; }
  .bill-to-detail { font-size: 11px; color: #888; margin-top: 2px; }
  .bill-meta { flex: 1; }
  .bill-meta-row { display: flex; justify-content: space-between; font-size: 11px; padding: 2px 0; }
  .bill-meta-label { color: #aaa; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  th { padding: 7px 6px; font-size: 10px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #999; border-bottom: 1px solid #eee; text-align: left; }
  td { padding: 6px 6px; font-size: 11px; color: #333; border-bottom: 1px solid #f5f5f5; vertical-align: top; }
  tr { page-break-inside: avoid; page-break-after: auto; }
  thead { display: table-header-group; }
  tr:last-child td { border-bottom: none; }
  .item-table { min-height: 150mm; }
  .totals-section { display: flex; gap: 20px; margin-top: 15px; }
  .totals-left { flex: 1.5; font-size: 8px; color: #888; line-height: 1.7; }
  .totals-right { flex: 1; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 11px; border-bottom: 1px solid #f5f5f5; }
  .total-row .lbl { color: #999; }
  .grand-row { display: flex; justify-content: space-between; padding: 8px 0; font-size: 15px; font-weight: 900; color: #111; border-top: 2px solid #111; margin-top: 4px; }
  .footer { display: flex; justify-content: space-between; margin-top: 30px; align-items: flex-end; }
  .sig-block { text-align: center; }
  .sig-line { border-top: 1px solid #ccc; padding-top: 4px; font-size: 8px; color: #888; margin-top: 35px; }
</style></head><body>
  <div class="top">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height:50px;max-width:160px;object-fit:contain;margin-bottom:6px;display:block;"/>` : ''}
      <div class="company-name">${s.companyName || 'YOUR COMPANY'}</div>
      <div class="company-detail">
        ${s.address || ''}<br/>
        ${s.phone1 ? `Tel: ${s.phone1}` : ''}${s.phone2 ? ` / ${s.phone2}` : ''}<br/>
        ${s.gstNumber ? `GSTIN: ${s.gstNumber}` : ''}
        ${s.panNumber ? `<br/>PAN: ${s.panNumber}` : ''}
      </div>
    </div>
    <div class="doc-info">
      <div class="doc-type">${title}</div>
      <div class="doc-number"># ${docNo}</div>
      <div class="doc-date">Date: ${new Date(docDate).toLocaleDateString()}</div>
      ${isQuotation && order.validUntil ? `<div class="doc-date">Valid: ${new Date(order.validUntil).toLocaleDateString()}</div>` : ''}
    </div>
  </div>

  <div class="divider"></div>

  <div class="bill-section">
    <div class="bill-to">
      <div class="bill-to-label">Bill To</div>
      <div class="bill-to-name">${(order.customer?.companyName || order.customer?.name || 'Cash Sales').toUpperCase()}</div>
      ${order.customer?.name && order.customer?.companyName ? `<div class="bill-to-detail" style="font-weight:700">${order.customer.name}</div>` : ''}
      ${order.customer?.phone ? `<div class="bill-to-detail">Tel: ${order.customer.phone}</div>` : ''}
      ${order.customer?.gstin ? `<div class="bill-to-detail">GSTIN: ${order.customer.gstin}</div>` : ''}
      ${order.siteName ? `<div style="font-size: 11px;font-weight:800;color:#555;margin-top:2px">🏗️ ${order.siteName}</div>` : ''}
      ${order.siteAddress ? `<div class="bill-to-detail">📍 ${order.siteAddress}</div>` : ''}
      ${(() => { const a = order.customer?.address?.billing || {}; const parts = [a.street, a.city, a.state, a.zipCode].filter(Boolean); return parts.length ? `<div class="bill-to-detail">${parts.join(', ')}</div>` : ''; })()}
    </div>
    <div class="bill-meta">
      ${order.terms ? `<div class="bill-meta-row"><span class="bill-meta-label">Terms:</span><span>${order.terms}</span></div>` : ''}
    </div>
  </div>

  <table class="item-table">
    <thead><tr>
      <th width="4%">S.No</th>
      <th width="54%">Description</th>
      <th width="11%">Box</th>
      <th width="9%">Quantity</th>
      <th width="9%">Rate</th>
      <th width="13%">Amount</th>
    </tr></thead>
    <tbody>
    ${order.items.map((item, i) => {
        const total = item.total || item.quantity * item.price;
        const withTax = total + (total * taxPct / 100);
        const isTile = isTileItem(item);
        let qtyCell;
        if (isTile) {
            qtyCell = item.boxCount ? parseFloat(Number(item.boxCount).toFixed(2)).toString() : '';
        } else {
            const u = getUnitLabel(item);
            const unitSuffix = u ? ` (${u})` : '';
            const qtyVal = formatIndianNumber(item.primaryQty || item.quantity || 0, 2);
            qtyCell = `${qtyVal}${unitSuffix}`;
        }
        const sqftCell = isTile ? formatIndianNumber(item.totalSqFt, 2) : '';
        const desc3 = (() => { const b=(item.brand||'').trim(); const sz=(item.size||'').trim(); const n=(item.name||'').toUpperCase(); const sub=[b,sz].filter(Boolean).join(' '); return sub ? n+'-'+sub : n; })();
        return `<tr>
          <td style="color:#aaa">${i + 1}</td>
          <td><strong style="color:#111">${desc3}</strong></td>
          <td style="text-align:center;font-weight:700">${qtyCell}</td>
          <td style="text-align:center">${sqftCell}</td>
          <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
          <td style="text-align:right;font-weight:700">${formatIndianNumber(withTax, 2)}</td>
        </tr>`;
    }).join('')}
    ${Array(Math.max(0, 25 - order.items.length)).fill('<tr style="height:22px"><td style="color:transparent; border-bottom:none">.</td><td style="border-bottom:none"></td><td style="border-bottom:none"></td><td style="border-bottom:none"></td><td style="border-bottom:none"></td><td style="border-bottom:none"></td></tr>').join('')}
    </tbody>
  </table>

  <div class="thin-divider"></div>

  <div class="totals-section">
    <div class="totals-left">
      <strong>Amount in Words:</strong><br/>${numberToWords(Math.round(order.totalAmount || 0))}
      <br/><br/>
      ${taxPct > 0 ? `Tax: CGST ${taxPct/2}% = ${sym}${formatIndianNumber((order.taxAmount||0)/2, 2)} | SGST ${taxPct/2}% = ${sym}${formatIndianNumber((order.taxAmount||0)/2, 2)}<br/><br/>` : ''}
      ${terms.replace(/\n/g, '<br/>')}
    </div>
    <div class="totals-right">
      <div class="total-row"><span class="lbl">Subtotal</span><span>${sym}${formatIndianNumber(order.itemsTotal || 0, 2)}</span></div>
      ${order.taxAmount > 0 ? `<div class="total-row"><span class="lbl">Tax (${taxPct}%)</span><span>${sym}${formatIndianNumber(order.taxAmount||0, 2)}</span></div>` : ''}
      ${order.loadingCharges > 0 ? `<div class="total-row"><span class="lbl">Loading</span><span>${sym}${formatIndianNumber(order.loadingCharges, 2)}</span></div>` : ''}
      ${order.unloadingCharges > 0 ? `<div class="total-row"><span class="lbl">Unloading</span><span>${sym}${formatIndianNumber(order.unloadingCharges, 2)}</span></div>` : ''}
      ${order.transportCharges > 0 ? `<div class="total-row"><span class="lbl">Transport</span><span>${sym}${formatIndianNumber(order.transportCharges, 2)}</span></div>` : ''}
      ${(order.discountAmount||0) > 0 ? `<div class="total-row"><span class="lbl" style="color:green">Discount</span><span style="color:green">- ${sym}${formatIndianNumber(order.discountAmount, 2)}</span></div>` : ''}
      ${order.advanceAmount > 0 ? `<div class="total-row"><span class="lbl" style="color:green">Advance${order.advancePaymentType ? ' (' + order.advancePaymentType + ')' : ''}</span><span style="color:green">- ${sym}${formatIndianNumber(order.advanceAmount, 2)}</span></div>` : ''}
      ${order.roundOffAmount !== undefined && order.roundOffAmount !== 0 ? `<div class="total-row"><span class="lbl">Round Off</span><span>${order.roundOffAmount > 0 ? '+' : ''}${formatIndianNumber(order.roundOffAmount, 2)}</span></div>` : ''}
      <div class="grand-row"><span>TOTAL</span><span>${sym}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>

  <div class="footer">
    <div class="sig-block"><div class="sig-line">CUSTOMER SIGNATURE</div></div>
    <div style="text-align:center">
      ${s.branding?.bankName ? `<div style="font-size: 10px;color:#aaa">Bank: ${s.branding.bankName}${s.branding.branchName ? ', ' + s.branding.branchName : ''}<br/>A/C: ${s.branding.accountNumber || ''} | IFSC: ${s.branding.ifscCode || ''}</div>` : '<div></div>'}
      ${order.user?.name ? `<div style="font-size: 10px;color:#999;margin-top:3px"><b>Created By:</b> ${order.user.name}${order.user?.phone ? ' · ' + order.user.phone : ''}</div>` : ''}
    </div>
    <div class="sig-block"><div style="font-size: 10px;color:#aaa">For ${s.companyName || ''}</div><div class="sig-line">AUTHORISED SIGNATORY</div></div>
  </div>
</body></html>`;
};


// ─────────────────────────────────────────────────────────────────────────────
// TEMPLATE 4 — Clean No-Tax, Interchanged Columns, Dense Items, Bank Details
// ─────────────────────────────────────────────────────────────────────────────
const template4 = (order, settings, docType = 'invoice') => {
    const s = settings || {};
    const taxPct = 0; // No tax calculation needed for this template
    const isQuotation = docType === 'quotation';
    const title = isQuotation ? (s.documentConfig?.quotationTitle || 'QUOTATION') : (s.documentConfig?.invoiceTitle || 'INVOICE');
    const docNo = isQuotation ? (order.quotationNumber || order.orderNumber) : order.orderNumber;
    const docDate = isQuotation ? (order.quotationDate || order.orderDate || order.createdAt) : order.orderDate;
    
    const hasTiles4 = orderHasTileItems(order.items || []);
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const sym = s.documentConfig?.currencySymbol || '₹';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    // Compute itemsTotal if not already set
    const itemsTotal = order.itemsTotal ?? (order.items || []).reduce((sum, item) => sum + (item.total || (item.quantity * item.price) || 0), 0);

    return `<html><head><meta charset="UTF-8"><title>${title}_${docNo}_${(order.customer?.companyName || order.customer?.name || 'Customer').replace(/[^a-zA-Z0-9\\s-]/g, '').trim().replace(/\\s+/g, '_')}</title>
<style>
  @page { size: A4 portrait; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; margin: 0; background: #fff; }
  .container { border: 1px solid #000; width: 200mm; min-height: 285mm; margin: 0 auto; display: flex; flex-direction: column; }
  .company-header { text-align: center; padding: 6px 5px; border-bottom: 1px solid #000; position: relative; min-height: 70px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .company-logo-wrap { position: absolute; left: 8px; top: 50%; transform: translateY(-50%); }
  .company-header h1 { margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
  .company-header .addr { margin: 2px 0; font-size: 11px; font-weight: bold; }
  .company-header .meta { margin: 2px 0; font-size: 11px; }
  .doc-title { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 3px; padding: 4px; border-bottom: 1px solid #000; }
  .meta-grid { display: grid; grid-template-columns: 1.6fr 1fr; border-bottom: 1px solid #000; }
  .meta-box { padding: 5px 8px; }
  .meta-box:first-child { border-right: 1px solid #000; }
  .meta-row { display: flex; margin-bottom: 2px; font-size: 11px; align-items: flex-start; }
  .meta-label { min-width: 85px; font-weight: bold; }
  .customer-name { font-size: 12px; font-weight: 900; }
  .customer-addr { font-size: 10px; font-weight: bold; margin-top: 1px; }
  .items-table { border-bottom: 1px solid #000; flex: 1; display: flex; flex-direction: column; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  .items-table > table { flex: 1; height: 100%; }
  th, td { padding: 4px 5px; border-right: 1px solid #000; word-wrap: break-word; }
  th:last-child, td:last-child { border-right: none; }
  th { border-bottom: 1px solid #000; background: #fff; font-weight: bold; text-transform: uppercase; font-size: 11px; text-align: center; }
  td { vertical-align: top; border-bottom: none; font-weight: bold; font-size: 10px; }
  .filler { height: 100%; }
  .filler td { border-bottom: none; }
  .totals-section { display: flex; border-bottom: 1px solid #000; min-height: 90px; }
  .totals-left { flex: 1.6; padding: 6px 8px; border-right: 1px solid #000; display: flex; flex-direction: column; justify-content: space-between; }
  .totals-right { flex: 1; padding: 5px 8px; }
  .total-row { display: flex; justify-content: space-between; margin-bottom: 3px; font-size: 11px; }
  .net-total { display: flex; justify-content: space-between; font-size: 13px; font-weight: 900; margin-top: 4px; padding-top: 4px; border-top: 1.5px solid #000; }
  .footer-section { padding: 5px 10px; display: flex; justify-content: space-between; align-items: flex-end; min-height: 40px; }
  .sig { text-align: center; }
  .sig-line { margin-top: 18px; border-top: 1px solid #000; padding-top: 2px; font-size: 11px; font-weight: bold; }
  @media print {
    body { margin: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .container { width: 100%; border: 1px solid #000; min-height: 280mm; }
    .items-table > table { min-height: 180mm; }
  }
</style>
</head><body>
<div class="container">
  <div class="company-header">
    ${logoSrc ? `<div class="company-logo-wrap"><img src="${logoSrc}" style="max-height:60px; max-width:160px; object-fit:contain;" /></div>` : ''}
    <h1>${s.companyName || 'COMPANY NAME'}</h1>
    <div class="addr">${s.address || ''}</div>
    <div class="meta">
      ${s.phone1 ? `Ph: ${s.phone1}` : ''}${s.phone2 ? `, ${s.phone2}` : ''}
      ${s.gstNumber ? ` | GSTIN: ${s.gstNumber}` : ''}
    </div>
  </div>
  <div class="doc-title">${title}</div>
  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-row"><strong>To:</strong></div>
      <div class="customer-name">${(order.customer?.companyName || order.customer?.name || 'Cash Sale').toUpperCase()}</div>
      ${(() => {
          let addr = order.customer?.address;
          if (typeof addr === 'object' && addr !== null) {
              const a = addr.billing || addr;
              addr = [a.street, a.city, a.state, a.zipCode].filter(Boolean).join(', ');
          }
          return addr ? `<div class="customer-addr">${addr}</div>` : '';
      })()}
      ${order.customer?.phone ? `<div class="meta-row" style="margin-top:2px;">Ph: ${order.customer.phone}</div>` : ''}
      ${order.customer?.gstin ? `<div class="meta-row">GSTIN: ${order.customer.gstin}</div>` : ''}
      ${order.siteName ? `<div class="meta-row" style="margin-top:2px;font-weight:bold;color:#555">🏗️ Site: ${order.siteName}</div>` : ''}
      ${order.siteAddress ? `<div class="meta-row" style="color:#777">📍 ${order.siteAddress}</div>` : ''}
    </div>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">No:</span> <span><b>${docNo}</b></span></div>
      <div class="meta-row"><span class="meta-label">Date:</span> <span><b>${new Date(docDate).toLocaleDateString('en-IN')}</b></span></div>
      ${order.user?.name ? `<div class="meta-row"><span class="meta-label">Created By:</span> <span><b>${order.user.name.toUpperCase()}</b>${order.user.phone ? ` - <b>${order.user.phone}</b>` : ''}</span></div>` : ''}
    </div>
  </div>
  <div class="items-table">
    <table>
      <thead><tr>
        <th width="5%" style="text-align:center">S.No</th>
        <th width="45%" style="text-align:left">Description</th>
        <th width="12%">Box</th>
        <th width="10%">SqFeet</th>
        <th width="12%">Rate</th>
        <th width="16%">Amount</th>
      </tr></thead>
      <tbody>
      ${order.items.map((item, i) => {
          const total = item.total || item.quantity * item.price;
          const brand = (item.brand || '').trim();
          const size  = (item.size || '').trim();
          const namePart = (item.name || '').toUpperCase();
          const subPart  = [brand, size].filter(Boolean).join(' ');
          const fullDesc = subPart ? `${namePart}-${subPart}` : namePart;
          const isTile4 = isTileItem(item);
          let qtyCell;
          if (isTile4) {
              qtyCell = item.boxCount ? parseFloat(Number(item.boxCount).toFixed(2)).toString() : '';
          } else {
              const u = getUnitLabel(item);
              const unitSuffix = u ? ` (${u})` : '';
              const qtyVal = formatIndianNumber(item.primaryQty || item.quantity || 0, 2);
              qtyCell = `${qtyVal}${unitSuffix}`;
          }
          const sqftCell = isTile4 ? formatIndianNumber(item.totalSqFt, 2) : '';
          
          return `<tr style="height:14px">
            <td style="text-align:center">${i + 1}</td>
            <td>${fullDesc}</td>
            <td style="text-align:center">${qtyCell}</td>
            <td style="text-align:center">${sqftCell}</td>
            <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
            <td style="text-align:right">${formatIndianNumber(total, 2)}</td>
          </tr>`;
      }).join('')}
      <tr class="filler"><td>&nbsp;</td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  <div class="totals-section">
    <div class="totals-left">
      <div>
        <strong style="font-size:10px">Amount in Words:</strong><br/>
        <span style="font-size:10px;font-weight:bold">${numberToWords(Math.round(order.totalAmount || 0))}</span>
      </div>
      <div style="margin-top: 6px;">
        <strong style="font-size:10px;text-decoration:underline;">Bank Details:</strong><br/>
        <div style="font-size:10px;font-weight:bold;margin-top:2px;">
            A/C:No: ${s.branding?.accountNumber || ''}<br/>
            IFSC: ${s.branding?.ifscCode || ''}<br/>
            BRANCH: ${s.branding?.branchName || ''}<br/>
            BANK: ${s.branding?.bankName || ''}
        </div>
      </div>
      <div style="font-size:7px;margin-top:4px;color:#555;">${terms.replace(/\n/g, ' | ')}</div>
    </div>
    <div class="totals-right">
      <div class="total-row"><span>Subtotal:</span><span><b>${sym}${formatIndianNumber(itemsTotal, 2)}</b></span></div>
      ${order.loadingCharges > 0 ? `<div class="total-row"><span>Loading:</span><span><b>${sym}${formatIndianNumber(order.loadingCharges, 2)}</b></span></div>` : ''}
      ${order.unloadingCharges > 0 ? `<div class="total-row"><span>Unloading:</span><span><b>${sym}${formatIndianNumber(order.unloadingCharges, 2)}</b></span></div>` : ''}
      ${order.transportCharges > 0 ? `<div class="total-row"><span>Transport:</span><span><b>${sym}${formatIndianNumber(order.transportCharges, 2)}</b></span></div>` : ''}
      ${(order.discountAmount || 0) > 0 ? `<div class="total-row"><span>Discount:</span><span><b>- ${sym}${formatIndianNumber(order.discountAmount, 2)}</b></span></div>` : ''}
      ${(order.oldBalance || 0) !== 0 ? `<div class="total-row"><span>Old Balance:</span><span><b>${sym}${formatIndianNumber(order.oldBalance, 2)}</b></span></div>` : ''}
      ${order.advanceAmount > 0 ? `<div class="total-row"><span>Advance${order.advancePaymentType ? ' (' + order.advancePaymentType + ')' : ''}:</span><span><b>- ${sym}${formatIndianNumber(order.advanceAmount, 2)}</b></span></div>` : ''}
      ${order.roundOffAmount !== undefined && order.roundOffAmount !== 0 ? `<div class="total-row"><span>Round Off:</span><span><b>${order.roundOffAmount > 0 ? '+' : ''}${formatIndianNumber(order.roundOffAmount, 2)}</b></span></div>` : ''}
      <div class="net-total"><span>TOTAL:</span><span>${sym}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>
  <div class="footer-section">
    <div class="sig"><div class="sig-line">CUSTOMER SIGNATURE</div></div>
    <div class="sig"><div style="font-size: 11px;">For ${s.companyName || 'COMPANY'}</div><div class="sig-line">AUTHORISED SIGNATORY</div></div>
  </div>
</div></body></html>`;
};



// ─────────────────────────────────────────────────────────────────────────────
// HTML generator (returns string, no window opened) — used for share/export
// ─────────────────────────────────────────────────────────────────────────────
export const generateInvoiceHtml = (order, settings, docType = 'invoice') => {
    const templateNo = docType === 'quotation'
        ? (settings?.documentConfig?.quotationTemplate || 1)
        : (settings?.documentConfig?.invoiceTemplate || 1);

    if (templateNo === 2) return template2(order, settings, docType);
    if (templateNo === 3) return template3(order, settings, docType);
    if (templateNo === 4) return template4(order, settings, docType);
    return template1(order, settings, docType);
};

// ─────────────────────────────────────────────────────────────────────────────
// Main print dispatcher
// ─────────────────────────────────────────────────────────────────────────────
export const printDocument = (order, settings, docType = 'invoice') => {
    const templateNo = docType === 'quotation'
        ? (settings?.documentConfig?.quotationTemplate || 1)
        : (settings?.documentConfig?.invoiceTemplate || 1);

    let html;
    if (templateNo === 2) html = template2(order, settings, docType);
    else if (templateNo === 3) html = template3(order, settings, docType);
    else if (templateNo === 4) html = template4(order, settings, docType);
    else html = template1(order, settings, docType);

    executePrint(html);
};

// ─────────────────────────────────────────────────────────────────────────────
// Preview HTML generator
// ─────────────────────────────────────────────────────────────────────────────
export const generatePreviewHtml = (templateNo, settings) => {
    const dummyOrder = {
        orderNumber: 'INV-0001',
        orderDate: new Date().toISOString(),
        customer: {
            name: 'Sample Customer',
            address: '123 Dummy Street, Sample City, 123456',
            phone: '+91-9876543210',
            email: 'sample@example.com'
        },
        items: [
            {
                name: 'Sample Product 1',
                hsnCode: '1234',
                quantity: 10,
                price: 1500,
                total: 15000,
                unitType: 'nos',
                brand: 'DummyBrand',
                size: 'Large'
            },
            {
                name: 'Sample Product 2',
                hsnCode: '5678',
                quantity: 5,
                price: 200,
                total: 1000,
                unitType: 'nos',
                brand: 'DummyBrand',
                size: 'Small'
            }
        ],
        subTotal: 16000,
        taxAmount: 2880,
        taxRate: 18,
        totalAmount: 18880,
        discountAmount: 0,
        loadingCharges: 0,
        unloadingCharges: 0,
        transportCharges: 0,
        amountPaid: 0,
        balanceDue: 18880,
    };

    let html = '';
    if (templateNo === 2) html = template2(dummyOrder, settings, 'TAX INVOICE');
    else if (templateNo === 3) html = template3(dummyOrder, settings, 'TAX INVOICE');
    else if (templateNo === 4) html = template4(dummyOrder, settings, 'TAX INVOICE');
    else html = template1(dummyOrder, settings, 'TAX INVOICE');

    return html;
}

export const printAccountStatement = (customer, entries, summary, period, settings) => {
    const s = settings || {};
    const sym = s.documentConfig?.currencySymbol || '₹';
    const companyName = s.companyName || 'Your Company';
    const fromStr = period?.from ? new Date(period.from).toLocaleDateString('en-IN') : 'Beginning';
    const toStr = period?.to ? new Date(period.to).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : window.location.origin + s.branding.logoUrl)
        : null;

    const rowColor = (type) => {
        if (type === 'payment') return '#f0fff4';
        if (type === 'bill') return '#fff8f0';
        if (type === 'opening') return '#f0f4ff';
        return '#fff';
    };

    const typeLabel = (type) => {
        if (type === 'bill') return '🧾 Bill';
        if (type === 'payment') return '✅ Payment';
        if (type === 'opening') return '📂 Opening';
        return '⚙️ Adj';
    };

    const rows = entries.map((e, i) => `
        <tr style="background:${rowColor(e.type)}">
            <td style="text-align:center">${i + 1}</td>
            <td>${new Date(e.date).toLocaleDateString('en-IN')}</td>
            <td><strong>${e.refNumber || ''}</strong></td>
            <td>${typeLabel(e.type)}<br/><span style="font-size:8px;color:#666">${e.description || ''}</span></td>
            <td style="text-align:right;color:#c0392b;font-weight:bold">${e.debit > 0 ? sym + e.debit.toLocaleString('en-IN') : '-'}</td>
            <td style="text-align:right;color:#27ae60;font-weight:bold">${e.credit > 0 ? sym + e.credit.toLocaleString('en-IN') : '-'}</td>
            <td style="text-align:right;font-weight:bold;color:${e.balance >= 0 ? '#c0392b' : '#27ae60'}">${sym}${Math.abs(e.balance).toLocaleString('en-IN')} ${e.balance >= 0 ? 'Dr' : 'Cr'}</td>
        </tr>`).join('');

    const html = `<html><head><title>Account Statement - ${customer.name}</title>
<style>
  @page { size: A4; margin: 8mm; }
  body { font-family: Arial, sans-serif; font-size: 12px; font-weight: bold; color: #222; margin: 0; }
  .header { border-bottom: 2.5px solid #1a1a2e; padding-bottom: 10px; margin-bottom: 10px; display: flex; align-items: center; position: relative; min-height: 70px; }
  .header-logo { position: absolute; left: 0; top: 50%; transform: translateY(-50%); }
  .header-logo img { max-height: 60px; max-width: 140px; object-fit: contain; }
  .header-center { text-align: center; flex: 1; }
  .header-center h1 { margin: 0; font-size: 22px; font-weight: 900; color: #1a1a2e; letter-spacing: 0.5px; }
  .header-center p { margin: 2px 0; font-size: 11px; color: #555; font-weight: normal; }
  .header-center .gstin { font-size: 11px; font-weight: bold; color: #333; margin-top: 2px; }
  .statement-title { text-align: center; font-size: 15px; font-weight: 900; letter-spacing: 4px; background: #1a1a2e; color: #fff; padding: 7px 0; margin-bottom: 10px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 10px; gap: 8px; }
  .meta-box { background: #f5f7fb; border-radius: 6px; padding: 8px 12px; flex: 1; border-left: 3px solid #1a1a2e; }
  .meta-label { font-size: 11px; font-weight: 900; text-transform: uppercase; color: #999; margin-bottom: 3px; }
  .meta-value { font-size: 13px; font-weight: 900; color: #222; }
  .meta-sub { font-size: 11px; color: #666; margin-top: 2px; font-weight: normal; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #1a1a2e; color: #fff; padding: 8px 7px; font-size: 11px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  td { padding: 6px 7px; font-size: 11px; font-weight: bold; border-bottom: 1px solid #eee; vertical-align: middle; }
  tr:nth-child(even) td { background: #fafafa; }
  .summary { display: flex; justify-content: flex-end; margin-top: 14px; gap: 10px; }
  .sum-box { border: 1.5px solid #ddd; border-radius: 6px; padding: 8px 16px; text-align: right; min-width: 150px; }
  .sum-label { font-size: 10px; color: #999; font-weight: 900; text-transform: uppercase; }
  .sum-value { font-size: 16px; font-weight: 900; margin-top: 2px; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 10px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
</style></head><body>
<div class="header">
  ${logoSrc ? '<div class="header-logo"><img src="' + logoSrc + '" alt="Logo"/></div>' : ''}
  <div class="header-center">
    <h1>${companyName}</h1>
    <p>${s.address || ''} ${s.phone1 ? '| Tel: ' + s.phone1 : ''}</p>
    ${s.gstNumber ? '<div class="gstin">GSTIN: ' + s.gstNumber + '</div>' : ''}
  </div>
</div>
<div class="statement-title">ACCOUNT STATEMENT</div>
<div class="meta">
  <div class="meta-box">
    <div class="meta-label">Customer</div>
    <div class="meta-value">${customer.companyName || customer.name}</div>
    <div style="font-size:8px;color:#666">${customer.name}${customer.phone ? ' | ' + customer.phone : ''}${customer.gstin ? ' | GSTIN: ' + customer.gstin : ''}</div>
  </div>
  <div class="meta-box">
    <div class="meta-label">Period</div>
    <div class="meta-value">${fromStr} → ${toStr}</div>
  </div>
  <div class="meta-box">
    <div class="meta-label">Print Date</div>
    <div class="meta-value">${new Date().toLocaleDateString('en-IN')}</div>
  </div>
</div>
<table>
  <thead><tr>
    <th width="4%">#</th>
    <th width="10%">Date</th>
    <th width="12%">Ref No.</th>
    <th width="30%">Particulars</th>
    <th width="14%" style="text-align:right">Debit (Dr)</th>
    <th width="14%" style="text-align:right">Credit (Cr)</th>
    <th width="16%" style="text-align:right">Balance</th>
  </tr></thead>
  <tbody>${rows || '<tr><td colspan="7" style="text-align:center;padding:20px;color:#aaa">No entries found for this period</td></tr>'}</tbody>
</table>
<div class="summary">
  <div class="sum-box">
    <div class="sum-label">Total Debit</div>
    <div class="sum-value" style="color:#c0392b">${sym}${(summary?.totalDebit || 0).toLocaleString('en-IN')}</div>
  </div>
  <div class="sum-box">
    <div class="sum-label">Total Credit</div>
    <div class="sum-value" style="color:#27ae60">${sym}${(summary?.totalCredit || 0).toLocaleString('en-IN')}</div>
  </div>
  <div class="sum-box" style="background:#1a1a2e;color:#fff;border-color:#1a1a2e">
    <div class="sum-label" style="color:#aaa">Closing Balance</div>
    <div class="sum-value" style="color:#fff">${sym}${Math.abs(summary?.closingBalance || 0).toLocaleString('en-IN')} ${(summary?.closingBalance || 0) >= 0 ? 'Dr' : 'Cr'}</div>
  </div>
</div>
<div class="footer">
  <span>Generated by ${companyName} | ${new Date().toLocaleString('en-IN')}</span>
  <span style="font-weight:bold;font-size:9px">Authorised Signatory ________________</span>
</div>
</body></html>`;

    executePrint(html);
};

// ─────────────────────────────────────────────────────────────────────────────
// NEW TEMPLATES for Dot-Matrix / Tally Style Ledgers
// ─────────────────────────────────────────────────────────────────────────────

export const printTallyLedger = (customer, entries, summary) => {
    const formatAmt = (num) => {
        if (!num) return '';
        return Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const openingBal = customer.openingBalance || 0;

    let rows = '';
    let totalDr = 0;
    let totalCr = 0;

    entries.forEach(entry => {
        totalDr += (entry.debit || 0);
        totalCr += (entry.credit || 0);
        const drStr = entry.debit ? formatAmt(entry.debit) : '';
        const crStr = entry.credit ? formatAmt(entry.credit) : '';
        const dateStr = new Date(entry.date).toLocaleDateString('en-IN');
        const particulars = (entry.description || '').substring(0, 25);
        const typeStr = entry.type === 'bill' ? 'Sales' : (entry.type === 'payment' ? 'Receipt' : 'Journal');
        
        rows += `<tr style="vertical-align:top;">
            <td style="width:12%">${dateStr}</td>
            <td style="width:25%">${particulars}</td>
            <td style="width:15%"></td>
            <td style="width:12%">${typeStr}</td>
            <td style="width:10%">${entry.refNumber || ''}</td>
            <td style="width:13%;text-align:right">${drStr}</td>
            <td style="width:13%;text-align:right">${crStr}</td>
        </tr>`;
    });

    const closeBal = summary?.closingBalance || 0;

    const html = `<html><head><meta charset="UTF-8"><title>Ledger - ${customer.name}</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; font-weight: bold; }
  .header-table { width: 100%; border: none; margin-bottom: 10px; }
  .header-table td { padding: 0; }
  .line { border-bottom: 1px dashed #000; margin: 4px 0; }
  .line-double { border-bottom: 1px dashed #000; border-top: 1px dashed #000; margin: 4px 0; height: 1px; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 4px 0; font-weight: bold; }
  td { padding: 4px 0; }
</style></head><body>

<table class="header-table">
  <tr>
    <td>Ledger of: <b>${customer.companyName || customer.name}</b></td>
    <td style="text-align:right">Page No: 1</td>
  </tr>
  <tr>
    <td>${[customer.address?.billing?.street, customer.address?.billing?.city].filter(Boolean).join(', ')}</td>
    <td></td>
  </tr>
</table>

<div class="line"></div>
<table>
  <tr>
    <th style="width:10%">Date</th>
    <th style="width:25%">Particulars</th>
    <th style="width:10%">Vch Type</th>
    <th style="width:10%">Vch No</th>
    <th style="width:13%;text-align:right">Debit</th>
    <th style="width:13%;text-align:right">Credit</th>
    <th style="width:19%;text-align:right">Balance</th>
  </tr>
</table>
<div class="line"></div>

<table style="margin-bottom: 10px;">
  <tr>
    <td style="width:10%"></td>
    <td style="width:25%"><b>Opening Balance :</b></td>
    <td style="width:10%"></td>
    <td style="width:10%"></td>
    <td style="width:13%;text-align:right"><b>${openingBal >= 0 ? formatAmt(openingBal) : ''}</b></td>
    <td style="width:13%;text-align:right"><b>${openingBal < 0 ? formatAmt(Math.abs(openingBal)) : ''}</b></td>
    <td style="width:19%;text-align:right"><b>${openingBal !== 0 ? formatAmt(Math.abs(openingBal)) + (openingBal > 0 ? ' Dr' : ' Cr') : ''}</b></td>
  </tr>
</table>

<table>
  ${rows}
</table>

<div class="line" style="margin-top:20px;"></div>
<table>
  <tr>
    <td style="width:10%"></td>
    <td style="width:25%"><b>Closing Balance :</b></td>
    <td style="width:10%"></td>
    <td style="width:10%"></td>
    <td style="width:13%;text-align:right"><b>${closeBal < 0 ? formatAmt(Math.abs(closeBal)) : ''}</b></td>
    <td style="width:13%;text-align:right"><b>${closeBal >= 0 ? formatAmt(closeBal) : ''}</b></td>
    <td style="width:19%;text-align:right"><b>${closeBal !== 0 ? formatAmt(Math.abs(closeBal)) + (closeBal > 0 ? ' Dr' : ' Cr') : ''}</b></td>
  </tr>
</table>
<div class="line"></div>

</body></html>`;

    executePrint(html);
};

export const printTallyReceivables = (receivablesData) => {
    const formatAmt = (num) => Number(num).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    let content = '';

    receivablesData.forEach(cust => {
        let rows = '';
        cust.pendingBills.forEach(bill => {
            const dateStr = new Date(bill.date).toLocaleDateString('en-GB'); // DD/MM/YYYY like Tally
            rows += `<tr style="vertical-align:top;">
                <td style="width:20%">${bill.refNumber}</td>
                <td style="width:20%;text-align:right">${formatAmt(bill.pendingAmount)}</td>
                <td style="width:20%;text-align:center">${dateStr}</td>
                <td style="width:15%;text-align:right">${bill.osDays}</td>
                <td style="width:25%"></td>
            </tr>`;
        });

        const addressHtml = (cust.address && Array.isArray(cust.address) && cust.address.length > 0) 
            ? cust.address.map(line => `<tr><td>${line}</td></tr>`).join('')
            : '';

        content += `
<table class="header-table" style="margin-top:20px;">
  <tr>
    <td>Name : <b>${cust.name}</b></td>
  </tr>
  ${addressHtml}
</table>
<div class="line"></div>
<table>
  <tr>
    <th style="width:20%">Ref No</th>
    <th style="width:20%;text-align:right">Pending Amt</th>
    <th style="width:20%;text-align:center">Due Date</th>
    <th style="width:15%;text-align:right">OS Days</th>
    <th style="width:25%"></th>
  </tr>
</table>
<div class="line"></div>
<div style="margin: 8px 0;"><b>Customer</b></div>
<table>
  ${rows}
</table>
<div style="text-align:right;width:40%;font-weight:bold;margin-top:5px;border-top:1px dashed #000;border-bottom:1px dashed #000;padding:4px 0;">
  ${formatAmt(cust.totalPending)}
</div>
<div class="line" style="margin-top:20px;"></div>
<div style="text-align:right;width:40%;font-weight:bold;">
  ${formatAmt(cust.totalPending)}
</div>
<div class="line"></div>
<br/>
`;
    });

    const html = `<html><head><meta charset="UTF-8"><title>Receivables Report</title>
<style>
  @page { size: A4; margin: 15mm; }
  body { font-family: 'Courier New', Courier, monospace; font-size: 11px; color: #000; font-weight: bold; line-height: 1.2; }
  .header-table { width: 100%; border: none; margin-bottom: 5px; }
  .header-table td { padding: 0; }
  .line { border-bottom: 1px dashed #000; margin: 4px 0; }
  table { width: 100%; border-collapse: collapse; }
  th { text-align: left; padding: 4px 0; font-weight: bold; }
  td { padding: 4px 0; }
</style></head><body>

<div style="display:flex; justify-content:space-between;">
    <div><b>Receivables</b></div>
    <div>Page No: 1</div>
</div>

${content}

</body></html>`;

    executePrint(html);
};

// ─────────────────────────────────────────────────────────────────────────────
// SHIPPING LABEL PRINTING
// ─────────────────────────────────────────────────────────────────────────────
export const printShippingLabels = (dispatch, fullOrder, settings) => {
    const s = settings || {};
    const company = s.companyName || 'Our Company';
    const address = s.address || '';
    const phone = s.phone1 || '';
    
    const custName = fullOrder.customer?.companyName || fullOrder.customer?.name || 'Walk-in Customer';
    
    // Fix object Object issue
    const custBilling = fullOrder.customer?.address?.billing || {};
    const custShipping = fullOrder.customer?.address?.shipping || custBilling;
    const street = custShipping.street || custBilling.street || '';
    const city = custShipping.city || custBilling.city || '';
    const state = custShipping.state || custBilling.state || '';
    const zipCode = custShipping.zipCode || custBilling.zipCode || '';
    
    const fullCustAddress = [street, city, state, zipCode].filter(Boolean).join(', ');
    const custPhone = fullOrder.customer?.contactNumber || fullOrder.customer?.phone || '';

    const orderNo = fullOrder.orderNumber;
    const date = new Date(dispatch.createdAt || dispatch.date).toLocaleDateString();
    
    // Calculate total boxes
    let totalBoxes = 0;
    dispatch.items.forEach(di => { totalBoxes += Number(di.quantity) || 0; });
    
    let itemsRows = dispatch.items.map(di => `
        <tr>
            <td style="padding:6px 4px; border-bottom:1px solid #000; font-size:11px; font-weight:bold;">${di.item?.name || 'Item'}</td>
            <td style="padding:6px 4px; border-bottom:1px solid #000; font-size:11px; text-align:right; font-weight:bold;">${di.quantity} Box</td>
        </tr>
    `).join('');

    const html = `<html><head><meta charset="UTF-8"><title>Shipping Label - ${orderNo}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Libre+Barcode+39&family=Inter:wght@400;700;900&display=swap');
  
  @page { size: 100mm 150mm; margin: 0; }
  body { 
    font-family: 'Inter', sans-serif; 
    color: #000; 
    margin: 0; 
    padding: 0; 
    background: #fff; 
    width: 100mm; 
    height: 150mm; 
    box-sizing: border-box;
  }
  
  .label-container { 
    width: 100%;
    height: 100%;
    box-sizing: border-box; 
    display: flex; 
    flex-direction: column; 
    border: 3px solid #000;
    padding: 2mm;
  }
  
  .inner-border {
    border: 2px solid #000;
    height: 100%;
    display: flex;
    flex-direction: column;
  }

  .header-banner {
    background: #000;
    color: #fff;
    text-align: center;
    padding: 6px;
    font-size: 14px;
    font-weight: 900;
    letter-spacing: 4px;
    text-transform: uppercase;
  }

  .from-section {
    padding: 8px;
    border-bottom: 2px solid #000;
    font-size: 11px;
    line-height: 1.3;
  }
  .from-section strong { font-size: 11px; }

  .to-section {
    padding: 12px 10px;
    border-bottom: 2px solid #000;
    flex: 1;
  }
  .to-badge {
    font-size: 12px;
    font-weight: 900;
    margin-bottom: 5px;
  }
  .to-name {
    font-size: 20px;
    font-weight: 900;
    text-transform: uppercase;
    line-height: 1.1;
    margin-bottom: 5px;
  }
  .to-address {
    font-size: 14px;
    font-weight: 700;
    line-height: 1.3;
    margin-bottom: 8px;
  }
  .to-phone {
    font-size: 12px;
    font-weight: bold;
    border: 1px solid #000;
    display: inline-block;
    padding: 3px 6px;
  }

  .barcode-section {
    padding: 10px;
    text-align: center;
    border-bottom: 2px solid #000;
  }
  .barcode {
    font-family: 'Libre Barcode 39', cursive;
    font-size: 42px;
    line-height: 1;
    margin: 0;
  }
  .barcode-text {
    font-size: 12px;
    font-weight: 900;
    letter-spacing: 2px;
  }

  .meta-grid {
    display: flex;
    border-bottom: 2px solid #000;
  }
  .meta-box {
    flex: 1;
    padding: 6px;
    text-align: center;
  }
  .meta-box:first-child {
    border-right: 2px solid #000;
  }
  .meta-label {
    font-size: 8px;
    text-transform: uppercase;
    font-weight: 900;
  }
  .meta-val {
    font-size: 14px;
    font-weight: 900;
  }

  .items-section {
    padding: 8px;
  }
  .items-title {
    font-size: 10px;
    font-weight: 900;
    text-transform: uppercase;
    margin-bottom: 4px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th {
    text-align: left;
    border-bottom: 2px solid #000;
    font-size: 11px;
    padding: 2px 4px;
    text-transform: uppercase;
  }
</style>
</head>
<body>
    <div class="label-container">
      <div class="inner-border">
        <div class="header-banner">PRIORITY DISPATCH</div>
        
        <div class="from-section">
            <strong>FROM: ${company}</strong><br>
            ${address}<br>
            ${phone ? 'Ph: ' + phone : ''}
        </div>
        
        <div class="to-section">
            <div class="to-badge">SHIP TO:</div>
            <div class="to-name">${custName}</div>
            <div class="to-address">${fullCustAddress || 'Address Not Provided'}</div>
            ${custPhone ? '<div class="to-phone">📞 ' + custPhone + '</div>' : ''}
        </div>
        
        <div class="barcode-section">
            <div class="barcode">*${orderNo}*</div>
            <div class="barcode-text">${orderNo}</div>
        </div>

        <div class="meta-grid">
            <div class="meta-box">
                <div class="meta-label">Total Boxes</div>
                <div class="meta-val">${totalBoxes}</div>
            </div>
            <div class="meta-box">
                <div class="meta-label">Dispatch Date</div>
                <div class="meta-val">${date}</div>
            </div>
        </div>

        <div class="items-section">
            <div class="items-title">Contents / Description</div>
            <table>
                <tr>
                    <th>Item</th>
                    <th style="text-align:right">Qty</th>
                </tr>
                ${itemsRows}
            </table>
        </div>
      </div>
    </div>
</body></html>`;

    executePrint(html);
};

// ─────────────────────────────────────────────────────────────────────────────
// RETURN SLIP PRINTING
// ─────────────────────────────────────────────────────────────────────────────
export const printReturnSlip = (returnTx, settings) => {
    const s = settings || {};
    const sym = s.documentConfig?.currencySymbol || '₹';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';
    
    const entityType = returnTx.returnType === 'customer' ? 'Customer' : 'Vendor';
    const entity = returnTx.customer || returnTx.vendor || { name: 'Unknown' };
    const title = returnTx.returnType === 'customer' ? 'credit note' : 'debit note';

    // Support both `returnTx.items` (array from StockReturn) and `returnTx.item` (single from ActionLogs)
    const itemsList = returnTx.items || (returnTx.item ? [{
        name: returnTx.item.name || 'Unknown Item',
        brand: returnTx.item.brand,
        size: returnTx.item.size,
        hsnCode: returnTx.item.hsnCode || returnTx.item.hsn || '',
        quantity: returnTx.quantity || 0,
        price: returnTx.rate || 0,
        total: (returnTx.quantity || 0) * (returnTx.rate || 0),
        taxRate: returnTx.item.taxRate || 0,
        billingUnit: returnTx.item.billingUnit || returnTx.item.unitType || 'Nos'
    }] : []);

    // In Returns, we typically don't track tax breakdown unless fully integrated.
    // We'll compute basic totals from the items array.
    const itemsTotal = itemsList.reduce((sum, it) => sum + (it.total || it.quantity * it.price || 0), 0);
    const taxAmount = 0; // If you add tax tracking to returns later, add it here
    const grandTotal = itemsTotal + taxAmount;
    
    // Build item rows
    let totQty = 0;
    const itemRows = itemsList.map((item, i) => {
        const subtotal = item.total || (item.quantity * item.price) || 0;
        totQty += Number(item.quantity || 0);
        const qtyVal = formatIndianNumber(item.quantity || 0, 3) + ' ' + (item.billingUnit || 'Nos').substring(0,3);
        
        const desc = (() => {
            const b = (item.brand || '').trim();
            const sz = (item.size || '').trim();
            const n = (item.name || '').toUpperCase();
            const sub = [b, sz].filter(Boolean).join(' ');
            return sub ? `${n} - ${sub}` : n;
        })();
        
        return `<tr>
          <td style="text-align:center">${i + 1}</td>
          <td><strong>${desc}</strong></td>
          <td style="text-align:center">${item.hsnCode || item.hsn || ''}</td>
          <td style="text-align:center;font-weight:bold">${qtyVal}</td>
          <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
          <td style="text-align:right">${formatIndianNumber(subtotal, 2)}</td>
          <td style="text-align:center">0</td>
          <td style="text-align:right;font-weight:bold">${formatIndianNumber(subtotal, 2)}</td>
        </tr>`;
    }).join('');

    const taxAnalysisHtml = `<table style="width:90%; text-align:center; border:none; font-size: 11px; margin-bottom:15px">
        <thead><tr><th style="border:none;border-bottom:1px solid #000;text-align:left">Taxable Value</th><th style="border:none;border-bottom:1px solid #000">CGST%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th><th style="border:none;border-bottom:1px solid #000">SGST%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th><th style="border:none;border-bottom:1px solid #000">NET%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th></tr></thead>
        <tbody><tr>
          <td style="border:none;text-align:left">${formatIndianNumber(itemsTotal, 2)}</td>
          <td style="border:none">0.00</td>
          <td style="border:none;text-align:right">0.00</td>
          <td style="border:none">0.00</td>
          <td style="border:none;text-align:right">0.00</td>
          <td style="border:none">0.00</td>
          <td style="border:none;text-align:right">0.00</td>
        </tr></tbody>
       </table>`;

    const html = `<html><head><meta charset="UTF-8"><title>Return_Slip</title>
<style>
  @page { size: A4 portrait; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #000; margin: 0; background: #fff; }
  .container { border: 1.5px solid #000; width: 200mm; min-height: 285mm; margin: 0 auto; display: flex; flex-direction: column; }
  /* Header */
  .company-header { text-align: center; padding: 6px 5px; border-bottom: 1.5px solid #000; position: relative; min-height: 70px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .company-header .contact-info { position: absolute; top: 6px; right: 8px; font-size: 10px; font-weight: bold; text-align: right; }
  .company-header h1 { margin: 0; font-size: 24px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.5px; }
  .company-header p { margin: 1px 0; font-size: 11px; font-weight: bold; }
  /* Doc title */
  .doc-title { text-align: center; font-size: 11px; font-weight: bold; letter-spacing: 3px; padding: 4px; border-bottom: 1.5px solid #000; text-transform: uppercase; }
  /* Meta grid */
  .meta-grid { display: grid; grid-template-columns: 1.6fr 1fr; border-bottom: 1.5px solid #000; }
  .meta-box { padding: 5px 8px; }
  .meta-box:first-child { border-right: 1.5px solid #000; }
  .meta-row { display: flex; margin-bottom: 2px; font-size: 11px; align-items: flex-start; }
  .meta-label { min-width: 95px; font-weight: bold; }
  /* Items table */
  .items-table { flex: 1; display: flex; flex-direction: column; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  .items-table > table { flex: 1; height: 100%; min-height: 150mm; border-bottom: 1.5px solid #000; }
  th, td { padding: 4px 5px; font-size: 11px; border-right: 1.5px solid #000; }
  th:last-child, td:last-child { border-right: none; }
  th { border-bottom: 1.5px solid #000; font-weight: bold; font-size: 11px; text-align: center; }
  td { vertical-align: top; border-bottom: none; }
  .filler td { height: auto; border-bottom: none; }
  tr.filler { height: 100%; }
  thead { display: table-header-group; }
  /* Math section */
  .math-section { display: flex; border-bottom: 1.5px solid #000; min-height: 60px; }
  .math-left { flex: 1.5; padding: 6px 8px; border-right: 1.5px solid #000; display:flex; flex-direction:column; justify-content:space-between;}
  .math-right { flex: 1; padding: 6px 15px; display:flex; flex-direction:column; justify-content:flex-end; font-size:10px; font-weight:bold; }
  .math-row { display: flex; justify-content: space-between; margin-bottom:6px; }
  /* Footer */
  .words-bar { padding: 5px 8px; border-bottom: 1.5px solid #000; font-weight: bold; font-size: 11px; }
  .footer { padding: 8px 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; margin-top: auto; }
</style></head><body>
<div class="container">
  <div class="company-header">
    ${logoSrc ? `<div style="position:absolute;left:8px;top:50%;transform:translateY(-50%)"><img src="${logoSrc}" alt="Logo" style="max-height:55px;max-width:130px;object-fit:contain"/></div>` : ''}
    <div class="contact-info">CELL: ${s.phone1 || ''}${s.phone2 ? ', ' + s.phone2 : ''}</div>
    <div style="z-index:1; margin-top:15px;">
      <h1>${s.companyName || 'YOUR COMPANY'}</h1>
      <p>${s.address || ''}</p>
      ${s.gstNumber ? `<p><strong>GSTIN: ${s.gstNumber}</strong></p>` : ''}
    </div>
  </div>

  <div class="doc-title">${title}</div>

  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label" style="min-width:25px">To.</span><strong>${(entity.companyName || entity.name || 'Unknown').toUpperCase()}</strong></div>
      ${entity.name && entity.companyName ? `<div class="meta-row"><span style="min-width:25px"></span>${entity.name}</div>` : ''}
      ${(() => { 
        const entityAddress = entityType === 'Customer' ? entity.address?.billing : entity.address;
        const parts = [entityAddress?.street, entityAddress?.city, entityAddress?.state, entityAddress?.zipCode].filter(Boolean); 
        return parts.length ? `<div class="meta-row"><span style="min-width:25px"></span><span style="font-size:8.5px">${parts.join(', ')}</span></div>` : ''; 
      })()}
    </div>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">Payment Terms</span><span>: Credit</span></div>
      ${returnTx.referenceOrder ? `<div class="meta-row"><span class="meta-label">Ref. Order / Inv</span><strong style="font-size:10px">: ${returnTx.referenceOrder}</strong></div>` : ''}
      <div class="meta-row"><span class="meta-label">Date</span><span>: ${new Date(returnTx.createdAt).toLocaleDateString('en-GB')}</span></div>
    </div>
  </div>

  <div class="items-table">
    <table>
      <thead>
        <tr>
          <th width="5%">S.No</th>
          <th width="38%">Description</th>
          <th width="10%">HSN<br/>Code</th>
          <th width="12%">Qty</th>
          <th width="10%">Rate</th>
          <th width="12%">Amount</th>
          <th width="5%">Tax<br/>%</th>
          <th width="12%">Total<br/>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="filler"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  
  <div style="border-bottom:1.5px solid #000; border-top:1.5px solid #000; padding:2px 5px; font-weight:bold; font-size:10px; display:flex">
    <div style="width:53%; padding-left:15px">Total</div>
    <div style="width:12%; text-align:center">${formatIndianNumber(totQty, 3)}</div>
    <div style="width:10%"></div>
    <div style="width:12%; text-align:right">${formatIndianNumber(itemsTotal, 2)}</div>
    <div style="width:5%"></div>
    <div style="width:12%; text-align:right">${formatIndianNumber(grandTotal, 2)}</div>
  </div>

  <div class="math-section">
    <div class="math-left">
      ${taxAnalysisHtml}
      <div style="font-weight:bold; font-size:10px">E. &amp; O.E.</div>
    </div>
    <div class="math-right">
      <div class="math-row" style="font-size:11px; margin-top:2px"><span>Net Amount :</span><span>${formatIndianNumber(grandTotal, 2)}</span></div>
    </div>
  </div>
  
  <div class="words-bar">
    ${numberToWords(Math.round(grandTotal))}
  </div>

  <div class="footer">
    <div style="font-size:8px; width:50%">
      ${returnTx.notes ? `<div style="font-size: 11px; margin-bottom: 5px;"><b>Notes:</b> ${returnTx.notes}</div>` : ''}
    </div>
    <div style="text-align:right; width:50%">
      <div style="font-weight:bold;font-size:10px;margin-bottom:30px">For ${s.companyName || 'COMPANY'}</div>
      <div style="font-size:9.5px">Authorised Signatory</div>
    </div>
  </div>

</div></body></html>`;

    executePrint(html);
};

// ─────────────────────────────────────────────────────────────────────────────
// PURCHASE ORDER PRINT TEMPLATE — Portrait A4, matching sample bill format
// ─────────────────────────────────────────────────────────────────────────────

// Extract 2-digit state code from a GSTIN string
const getGstStateCode = (gstin) => {
    if (!gstin || gstin.length < 2) return '';
    return gstin.substring(0, 2).toUpperCase();
};

export const generatePurchaseOrderHtml = (order, settings) => {
    const s = settings || {};
    const sym = s.documentConfig?.currencySymbol || '₹';

    const companyGstin = s.gstNumber || '';
    const vendorGstin = order.vendor?.gstin || '';
    const companyState = getGstStateCode(companyGstin);
    const vendorState = getGstStateCode(vendorGstin);
    
    // Use taxType explicitly saved, or fallback to GSTIN comparison for older records
    const isInterState = order.taxType 
        ? order.taxType === 'igst' 
        : (vendorState && companyState && vendorState !== companyState);

    const docNo = order.orderNumber;
    const docDate = order.orderDate || order.createdAt;
    const terms = order.notes || s.branding?.termsAndConditions || 'E. & O.E.';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    // Compute totals
    const itemsTotal = order.itemsTotal ?? (order.items || []).reduce((sum, it) => sum + (it.total || it.quantity * it.price || 0), 0);
    const taxAmount = order.taxAmount ?? (order.items || []).reduce((sum, it) => {
        const rate = parseFloat(it.taxRate) || 0;
        const base = it.total || it.quantity * it.price || 0;
        return sum + base * rate / 100;
    }, 0);
    const grandTotal = order.totalAmount ?? (itemsTotal + taxAmount);
    const roundOff = order.roundOffAmount || 0;

    // Build item rows
    let totQty = 0;
    const itemRows = (order.items || []).map((item, i) => {
        const subtotal = item.total || (item.quantity * item.price) || 0;
        const itemTaxPct = parseFloat(item.taxRate) || 0;
        const itemTaxAmt = subtotal * itemTaxPct / 100;
        const totalAmt = subtotal + itemTaxAmt;
        const isTile = !!(item.totalSqFt > 0 || item.boxCount > 0);
        
        let qtyVal;
        if (isTile) {
            totQty += Number(item.boxCount || 0);
            qtyVal = item.boxCount ? `${parseFloat(Number(item.boxCount).toFixed(2))} Nos` : '';
        } else {
            totQty += Number(item.quantity || 0);
            qtyVal = formatIndianNumber(item.quantity || 0, 3) + ' ' + (item.billingUnit || 'Nos').substring(0,3);
        }

        const hsnVal = item.hsnCode || item.hsn || '';
        const desc = (() => {
            const b = (item.item?.brand || item.brand || '').trim();
            const sz = (item.item?.size || item.size || '').trim();
            const n = (item.item?.name || item.name || '').toUpperCase();
            const sub = [b, sz].filter(Boolean).join(' ');
            return sub ? `${n} - ${sub}` : n;
        })();

        return `<tr>
          <td style="text-align:center">${i + 1}</td>
          <td><strong>${desc}</strong></td>
          <td style="text-align:center">${hsnVal}</td>
          <td style="text-align:center;font-weight:bold">${qtyVal}</td>
          <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
          <td style="text-align:right">${formatIndianNumber(subtotal, 2)}</td>
          <td style="text-align:center">${itemTaxPct > 0 ? itemTaxPct : '0'}</td>
          <td style="text-align:right;font-weight:bold">${formatIndianNumber(totalAmt, 2)}</td>
        </tr>`;
    }).join('');

    // Bottom tax analysis table — exact match to screenshot
    const basePct = taxAmount > 0 ? (taxAmount / itemsTotal * 100) : 0;
    
    const taxAnalysisHtml = isInterState
        ? `<table style="width:70%; text-align:center; border:none; font-size: 11px; margin-bottom:15px">
            <thead><tr><th style="border:none;border-bottom:1px solid #000;text-align:left">Taxable Value</th><th style="border:none;border-bottom:1px solid #000">IGST%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th></tr></thead>
            <tbody><tr>
              <td style="border:none;text-align:left">${formatIndianNumber(itemsTotal, 2)}</td>
              <td style="border:none">${formatIndianNumber(basePct, 2)}</td>
              <td style="border:none;text-align:right">${formatIndianNumber(taxAmount, 2)}</td>
            </tr></tbody>
           </table>`
        : `<table style="width:90%; text-align:center; border:none; font-size: 11px; margin-bottom:15px">
            <thead><tr><th style="border:none;border-bottom:1px solid #000;text-align:left">Taxable Value</th><th style="border:none;border-bottom:1px solid #000">CGST%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th><th style="border:none;border-bottom:1px solid #000">SGST%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th><th style="border:none;border-bottom:1px solid #000">NET%</th><th style="border:none;border-bottom:1px solid #000;text-align:right">AMT</th></tr></thead>
            <tbody><tr>
              <td style="border:none;text-align:left">${formatIndianNumber(itemsTotal, 2)}</td>
              <td style="border:none">${formatIndianNumber(basePct / 2, 2)}</td>
              <td style="border:none;text-align:right">${formatIndianNumber(taxAmount / 2, 2)}</td>
              <td style="border:none">${formatIndianNumber(basePct / 2, 2)}</td>
              <td style="border:none;text-align:right">${formatIndianNumber(taxAmount / 2, 2)}</td>
              <td style="border:none">${formatIndianNumber(basePct, 2)}</td>
              <td style="border:none;text-align:right">${formatIndianNumber(taxAmount, 2)}</td>
            </tr></tbody>
           </table>`;

    return `<html><head><meta charset="UTF-8"><title>Purchase_Bill_${docNo}</title>
<style>
  @page { size: A4 portrait; margin: 5mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Arial', sans-serif; font-size: 11px; color: #000; margin: 0; background: #fff; }
  .container { border: 1.5px solid #000; width: 200mm; min-height: 285mm; margin: 0 auto; display: flex; flex-direction: column; }
  /* Header */
  .company-header { text-align: center; padding: 6px 5px; border-bottom: 1.5px solid #000; position: relative; min-height: 70px; display: flex; flex-direction: column; justify-content: center; align-items: center; }
  .company-header .contact-info { position: absolute; top: 6px; right: 8px; font-size: 10px; font-weight: bold; text-align: right; }
  .company-header h1 { margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 0.5px; text-transform: uppercase; }
  .company-header p { margin: 1px 0; font-size: 11px; font-weight: bold; }
  /* Doc title */
  .doc-title { text-align: center; font-size: 14px; font-weight: bold; letter-spacing: 1px; padding: 4px; border-bottom: 1.5px solid #000; text-transform: uppercase; }
  /* Meta grid */
  .meta-grid { display: grid; grid-template-columns: 1.6fr 1fr; border-bottom: 1.5px solid #000; }
  .meta-box { padding: 5px 8px; }
  .meta-box:first-child { border-right: 1.5px solid #000; }
  .meta-row { display: flex; margin-bottom: 2px; font-size: 11px; align-items: flex-start; }
  .meta-label { min-width: 95px; font-weight: bold; }
  /* Items table */
  .items-table { flex: 1; display: flex; flex-direction: column; }
  table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
  .items-table > table { flex: 1; height: 100%; min-height: 150mm; border-bottom: 1.5px solid #000; }
  th, td { padding: 4px 5px; font-size: 11px; border-right: 1.5px solid #000; font-weight: bold; }
  th:last-child, td:last-child { border-right: none; }
  th { border-bottom: 1.5px solid #000; font-weight: 900; font-size: 11px; text-align: center; }
  td { vertical-align: top; border-bottom: none; }
  .filler td { height: auto; border-bottom: none; }
  tr.filler { height: 100%; }
  thead { display: table-header-group; }
  /* Math section */
  .math-section { display: flex; border-bottom: 1.5px solid #000; min-height: 60px; }
  .math-left { flex: 1.5; padding: 6px 8px; border-right: 1.5px solid #000; display:flex; flex-direction:column; justify-content:space-between;}
  .math-right { flex: 1; padding: 6px 15px; display:flex; flex-direction:column; justify-content:flex-end; font-size:12px; font-weight:900; }
  .math-row { display: flex; justify-content: space-between; margin-bottom:6px; }
  /* Footer */
  .words-bar { padding: 5px 8px; border-bottom: 1.5px solid #000; font-weight: 900; font-size: 11px; }
  .footer { padding: 8px 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 11px; margin-top: auto; font-weight: bold; }
</style></head><body>
<div class="container">

  <!-- Company Header -->
  <div class="company-header">
    ${logoSrc ? `<div style="position:absolute;left:8px;top:50%;transform:translateY(-50%)"><img src="${logoSrc}" alt="Logo" style="max-height:55px;max-width:130px;object-fit:contain"/></div>` : ''}
    <div class="contact-info">CELL: ${s.phone1 || ''}${s.phone2 ? ', ' + s.phone2 : ''}</div>
    <div style="z-index:1">
      <h1>${s.companyName || 'YOUR COMPANY'}</h1>
      <p>${s.address || ''}</p>
      ${s.gstNumber ? `<p><strong>GSTIN: ${s.gstNumber}</strong></p>` : ''}
    </div>
  </div>

  <!-- Doc Title -->
  <div class="doc-title">Purchase Bill</div>

  <!-- Vendor & PO Meta -->
  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label" style="min-width:35px">From.</span><strong>${(order.vendor?.companyName || order.vendor?.name || 'Vendor').toUpperCase()}</strong></div>
      ${order.vendor?.name && order.vendor?.companyName ? `<div class="meta-row"><span style="min-width:35px"></span>${order.vendor.name}</div>` : ''}
      ${(() => { const parts = [order.vendor?.address?.street, order.vendor?.address?.city, order.vendor?.address?.state, order.vendor?.address?.zipCode].filter(Boolean); return parts.length ? `<div class="meta-row"><span style="min-width:35px"></span><span style="font-size:8.5px">${parts.join(', ')}</span></div>` : ''; })()}
      ${vendorGstin ? `<br/><div class="meta-row"><span class="meta-label" style="min-width:60px">GSTIN :</span>${vendorGstin}</div>` : ''}
    </div>
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">Payment Terms</span><span>: Credit</span></div>
      ${order.vendorBillNumber ? `<div class="meta-row"><span class="meta-label">Inv. No</span><strong style="font-size:11px">: ${order.vendorBillNumber}</strong></div>` : ''}
      <div class="meta-row"><span class="meta-label">Inv.Date</span><span>: ${new Date(docDate).toLocaleDateString('en-GB')}</span></div>
      <div class="meta-row"><span class="meta-label">S.No</span><span>: ${docNo}</span></div>
    </div>
  </div>

  <!-- Items Table -->
  <div class="items-table">
    <table>
      <thead>
        <tr>
          <th width="5%">S.No</th>
          <th width="38%">Description</th>
          <th width="10%">HSN<br/>Code</th>
          <th width="12%">Qty</th>
          <th width="10%">Rate</th>
          <th width="12%">Amount</th>
          <th width="5%">Tax<br/>%</th>
          <th width="12%">Total<br/>Amount</th>
        </tr>
      </thead>
      <tbody>
        ${itemRows}
        <tr class="filler"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>
      </tbody>
    </table>
  </div>
  
  <div style="border-bottom:1.5px solid #000; border-top:1.5px solid #000; padding:2px 5px; font-weight:bold; font-size:10px; display:flex">
    <div style="width:53%; padding-left:15px">Total</div>
    <div style="width:12%; text-align:center">${formatIndianNumber(totQty, 3)}</div>
    <div style="width:10%"></div>
    <div style="width:12%; text-align:right">${formatIndianNumber(itemsTotal, 2)}</div>
    <div style="width:5%"></div>
    <div style="width:12%; text-align:right">${formatIndianNumber(itemsTotal + taxAmount, 2)}</div>
  </div>

  <!-- Math & Tax block -->
  <div class="math-section">
    <div class="math-left">
      ${taxAnalysisHtml}
      <div style="font-weight:bold; font-size:10px">E. &amp; O.E.</div>
    </div>
    <div class="math-right">
      ${roundOff !== 0 ? `<div class="math-row"><span>Rounded Off (${roundOff > 0 ? 'Add' : 'Sub'}) :</span><span>${formatIndianNumber(roundOff, 2)}</span></div>` : ''}
      <div class="math-row" style="font-size:11px; margin-top:2px"><span>Net Amount :</span><span>${formatIndianNumber(grandTotal, 2)}</span></div>
    </div>
  </div>
  
  <div class="words-bar">
    ${numberToWords(Math.round(grandTotal))}
  </div>

  <!-- Footer -->
  <div class="footer">
    <div style="font-size:8px">
      ${order.user?.name ? `<div style="font-weight:bold">Created by: ${order.user.name}</div>` : ''}
      <div>E. &amp; O.E.</div>
    </div>
    <div style="text-align:right">
      <div style="font-weight:bold;font-size:10px;margin-bottom:30px">For ${s.companyName || 'COMPANY'}</div>
      <div style="font-size:9.5px">Authorised Signatory</div>
    </div>
  </div>

</div></body></html>`;
};

// ─────────────────────────────────────────────────────────────────────────────
// PAYMENT RECEIPT PRINTING
// ─────────────────────────────────────────────────────────────────────────────
export const printPaymentReceipt = (entry, entity, settings, type = 'customer') => {
    const s = settings || {};
    const sym = s.documentConfig?.currencySymbol || '₹';
    const companyName = s.companyName || 'Your Company';
    const amount = type === 'customer' ? entry.credit : entry.debit;
    const isReceived = type === 'customer';
    
    // Convert number to words (simple version)
    const toWords = (num) => {
        const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
        const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
        if ((num = num.toString()).length > 9) return 'overflow';
        let n = ('000000000' + num).substr(-9).match(/^(\d{2})(\d{2})(\d{2})(\d{1})(\d{2})$/);
        if (!n) return; let str = '';
        str += (n[1] != 0) ? (a[Number(n[1])] || b[n[1][0]] + ' ' + a[n[1][1]]) + 'Crore ' : '';
        str += (n[2] != 0) ? (a[Number(n[2])] || b[n[2][0]] + ' ' + a[n[2][1]]) + 'Lakh ' : '';
        str += (n[3] != 0) ? (a[Number(n[3])] || b[n[3][0]] + ' ' + a[n[3][1]]) + 'Thousand ' : '';
        str += (n[4] != 0) ? (a[Number(n[4])] || b[n[4][0]] + ' ' + a[n[4][1]]) + 'Hundred ' : '';
        str += (n[5] != 0) ? ((str != '') ? 'and ' : '') + (a[Number(n[5])] || b[n[5][0]] + ' ' + a[n[5][1]]) + 'Only ' : '';
        return str;
    };
    
    const amountInWords = toWords(Math.floor(amount)) + (amount % 1 > 0 ? ` and ${Math.round((amount % 1) * 100)} Paise Only` : '');

    const html = `<html><head><meta charset="UTF-8"><title>Payment Receipt - ${entity.name}</title>
<style>
  @page { size: A5 landscape; margin: 10mm; }
  body { font-family: Arial, sans-serif; font-size: 14px; color: #222; margin: 0; line-height: 1.5; }
  .receipt-container { border: 2px solid #222; padding: 20px; border-radius: 8px; position: relative; }
  .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #222; padding-bottom: 10px; margin-bottom: 15px; }
  .header h1 { margin: 0; font-size: 24px; font-weight: 900; color: #1a1a2e; }
  .header p { margin: 2px 0; font-size: 11px; color: #555; }
  .title-box { background: #1a1a2e; color: #fff; padding: 8px 16px; font-size: 16px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; border-radius: 4px; }
  .row { display: flex; margin-bottom: 15px; }
  .label { width: 150px; font-weight: bold; color: #555; }
  .value { flex: 1; border-bottom: 1px dashed #999; padding-bottom: 2px; font-weight: bold; color: #222; font-size: 15px; }
  .amount-box { border: 2px solid #222; background: #f9f9f9; padding: 10px 20px; font-size: 24px; font-weight: 900; text-transform: uppercase; display: inline-block; margin-top: 10px; border-radius: 4px; }
  .footer { display: flex; justify-content: space-between; margin-top: 40px; align-items: flex-end; }
  .signature { text-align: center; width: 200px; }
  .signature-line { border-bottom: 1px solid #222; margin-bottom: 5px; }
  .signature-text { font-size: 12px; font-weight: bold; color: #555; }
</style></head><body>
<div class="receipt-container">
  <div class="header">
    <div>
      <h1>${companyName}</h1>
      <p>${s.address || ''} ${s.phone1 ? '| Tel: ' + s.phone1 : ''}</p>
    </div>
    <div class="title-box">PAYMENT RECEIPT</div>
  </div>
  
  <div style="display: flex; justify-content: space-between; margin-bottom: 20px; font-weight: bold;">
    <div>Receipt No: ${entry.refNumber || ('REC-' + Math.floor(Math.random()*10000))}</div>
    <div>Date: ${new Date(entry.date).toLocaleDateString('en-IN')}</div>
  </div>
  
  <div class="row">
    <div class="label">${isReceived ? 'Received with thanks from:' : 'Paid to:'}</div>
    <div class="value">${entity.companyName || entity.name}</div>
  </div>
  
  <div class="row">
    <div class="label">The sum of Rupees:</div>
    <div class="value" style="font-style: italic;">${amountInWords}</div>
  </div>
  
  <div class="row">
    <div class="label">By ${entry.paymentMode || 'Cash'} / Ref:</div>
    <div class="value">${entry.description || ''} ${entry.notes ? '(' + entry.notes + ')' : ''}</div>
  </div>
  
  <div class="footer">
    <div class="amount-box">${sym} ${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
    <div class="signature">
      <div class="signature-line"></div>
      <div class="signature-text">Authorized Signatory</div>
    </div>
  </div>
</div>
</body></html>`;

    executePrint(html);
};

