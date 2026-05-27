// ─────────────────────────────────────────────────────────────────────────────
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
const buildItemRows = (items, settings, taxPct, isQuotation) => {
    return items.map((item, i) => {
        const total = item.total || item.quantity * item.price;
        const taxAmt = (total * taxPct / 100);
        const withTax = total + taxAmt;
        return `<tr style="height:10px">
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${(item.name || '').toUpperCase()}</strong><br/>
                <span style="font-size:8.5px;color:#666">${item.brand || ''} ${item.size || ''}</span>
            </td>
            <td style="text-align:center;font-weight:bold">
                ${item.totalSqFt ? formatIndianNumber(item.totalSqFt, 2) : formatIndianNumber(item.primaryQty || item.quantity || 0, 2)}
            </td>
            <td style="text-align:center">${item.boxCount ? item.boxCount + ' (' + (item.pcsPerBox || '') + ' pcs/box)' : (item.secondaryQty ? item.secondaryQty : '')}</td>
            <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
            <td style="text-align:right;font-weight:bold">${formatIndianNumber(withTax, 2)}</td>
        </tr>`;
    }).join('') +
    `<tr style="height:100%"><td></td><td></td><td></td><td></td><td></td><td></td></tr>`;
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
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty (SqFt)';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    return `<html><head><title>${title} - ${docNo}</title>
<style>
  @page { size: A4; margin: 5mm; }
  body { font-family: 'Arial', sans-serif; font-size: 10px; color: #000; margin: 0; display: flex; justify-content: center; }
  .container { border: 1.5px solid #000; width: 190mm; margin: 0 auto; }
  .company-header { text-align: center; padding: 10px; border-bottom: 1.5px solid #000; position: relative; }
  .contact-info { position: absolute; top: 8px; right: 10px; font-size: 8px; font-weight: bold; text-align: right; }
  .company-header h1 { margin: 0; font-size: 22px; font-weight: 900; letter-spacing: 0.5px; }
  .company-header p { margin: 2px 0; font-size: 9px; }
  .doc-title { text-align: center; font-size: 12px; font-weight: bold; letter-spacing: 5px; padding: 5px; border-bottom: 1.5px solid #000; }
  .meta-grid { display: grid; grid-template-columns: 1.5fr 1fr; border-bottom: 1.5px solid #000; }
  .meta-box { padding: 6px 10px; }
  .meta-box:first-child { border-right: 1.5px solid #000; }
  .meta-row { display: flex; margin-bottom: 2px; font-size: 9.5px; }
  .meta-label { width: 110px; font-weight: bold; }
  .items-table { border-bottom: 1.5px solid #000; height: 165mm; }
  table { width: 100%; height: 100%; border-collapse: collapse; }
  th, td { padding: 5px; font-size: 9.5px; border-right: 1.5px solid #000; }
  th:last-child, td:last-child { border-right: none; }
  th { border-bottom: 1.5px solid #000; background: #fff; font-weight: bold; text-transform: uppercase; font-size: 8.5px; }
  td { vertical-align: middle; border-bottom: none; }
  .summary-section { display: flex; border-bottom: 1.5px solid #000; min-height: 100px; }
  .summary-left { flex: 1.8; padding: 0; display: flex; flex-direction: column; border-right: 1.5px solid #000; }
  .summary-right { flex: 1; padding: 0; }
  .tax-table { width: 100%; border-collapse: collapse; font-size: 7.5px; }
  .tax-table th, .tax-table td { border: 1px solid #000; padding: 2px 4px; text-align: right; }
  .math-row { display: flex; justify-content: space-between; padding: 3px 8px; font-size: 9px; }
  .grand-total { background: #000; color: #fff; font-weight: bold; font-size: 12px; padding: 6px 8px; display: flex; justify-content: space-between; margin-top: auto; }
  .footer { padding: 10px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 9px; }
</style></head><body>
<div class="container">
  <div class="company-header" style="min-height: 80px; display: flex; flex-direction: column; justify-content: center;">
    ${logoSrc ? `<div style="position: absolute; left: 15px; top: 50%; transform: translateY(-50%);"><img src="${logoSrc}" alt="Logo" style="max-height:65px;max-width:180px;object-fit:contain;display:block;"/></div>` : ''}
    <div class="contact-info">CELL: ${s.phone1 || ''}${s.phone2 ? ', ' + s.phone2 : ''}</div>
    <div style="margin: 0 auto; width: 60%; z-index: 1;">
        <h1>${s.companyName || 'YOUR COMPANY'}</h1>
        <p>${s.address || ''}</p>
        ${s.gstNumber ? `<p><strong>GSTIN: ${s.gstNumber}</strong></p>` : ''}
    </div>
  </div>
  <div class="doc-title">${title}</div>
  <div class="meta-grid">
    <div class="meta-box">
      <div class="meta-row"><span class="meta-label">To:</span><strong>${(order.customer?.companyName || order.customer?.name || 'Cash Sales').toUpperCase()}</strong></div>
      ${order.siteName ? `<div class="meta-row"><span class="meta-label"></span><span style="font-weight:bold;color:#333">🏗️ ${order.siteName}</span></div>` : ''}
      ${order.siteAddress ? `<div class="meta-row"><span class="meta-label"></span><span style="color:#555;font-size:9px">${order.siteAddress}</span></div>` : ''}
      <div class="meta-row"><span class="meta-label"></span>${order.customer?.address || ''}</div>
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
        <th width="50%">Description of Goods</th>
        <th width="12%">${qtyLabel}</th>
        <th width="13%">Box Qty</th>
        <th width="10%">${rateLabel}</th>
        <th width="11%">Total</th>
      </tr></thead>
      <tbody>${buildItemRows(order.items, settings, taxPct, isQuotation)}</tbody>
    </table>
  </div>
  <div class="summary-section">
    <div class="summary-left">
      <div style="padding:8px 10px;border-bottom:1px solid #000">
        <div style="font-size:7.5px;font-weight:bold;margin-bottom:3px">TAX ANALYSIS:</div>
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
        <div style="font-size:7.5px;font-weight:bold;text-decoration:underline;margin-bottom:3px">AMOUNT IN WORDS:</div>
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
      ${order.advanceAmount > 0 ? `<div class="math-row" style="color:green"><span>Advance:</span><span>- ${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.advanceAmount, 2)}</span></div>` : ''}
      <div class="grand-total"><span>NET AMOUNT:</span><span>${s.documentConfig?.currencySymbol || '₹'}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>
  <div class="footer">
    <div style="text-align:center;border-top:1px solid #000;width:150px;padding-top:4px">RECEIVER'S SIGNATURE</div>
    <div style="text-align:center;width:200px">
      <div style="font-weight:bold;margin-bottom:35px;font-size:8.5px">For ${s.companyName || 'COMPANY'}</div>
      <div style="border-top:1px solid #000;padding-top:4px">AUTHORIZED SIGNATORY</div>
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
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const sym = s.documentConfig?.currencySymbol || '₹';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    return `<html><head><title>${title} - ${docNo}</title>
<style>
  @page { size: A4; margin: 5mm; }
  body { font-family: 'Arial', sans-serif; font-size: 10px; color: #1a1a2e; margin: 0; background: #fff; display: flex; justify-content: center; }
  .container { width: 190mm; margin: 0 auto; }
  .header { background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%); color: white; padding: 18px 20px; display: flex; justify-content: space-between; align-items: center; }
  .company-name { font-size: 20px; font-weight: 900; letter-spacing: 1px; }
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
  .meta-row2 { display: flex; justify-content: space-between; font-size: 8.5px; margin-bottom: 3px; }
  .items-section { border-top: 2px solid #1a1a2e; }
  table { width: 100%; border-collapse: collapse; }
  .item-table { height: 150mm; }
  th { background: #1a1a2e; color: white; padding: 6px 6px; font-size: 7.5px; text-transform: uppercase; letter-spacing: 0.5px; border-right: 1px solid #2d2d4e; text-align: left; }
  th:last-child { border-right: none; }
  td { padding: 5px 6px; font-size: 8.5px; border-bottom: 1px solid #f0f0f0; border-right: 1px solid #f0f0f0; vertical-align: top; }
  td:last-child { border-right: none; }
  tr:nth-child(even) td { background: #fafafa; }
  .totals-section { display: flex; border-top: 2px solid #1a1a2e; }
  .totals-left { flex: 1.6; padding: 12px 15px; border-right: 1px solid #e8e8e8; }
  .totals-right { flex: 1; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 12px; font-size: 9px; border-bottom: 1px solid #f5f5f5; }
  .net-total { background: #1a1a2e; color: white; font-weight: bold; font-size: 13px; padding: 7px 12px; display: flex; justify-content: space-between; }
  .footer { padding: 12px 20px; display: flex; justify-content: space-between; border-top: 1px solid #eee; }
  .sig { text-align: center; }
  .sig-label { font-size: 8px; font-weight: bold; color: #666; border-top: 1px solid #1a1a2e; padding-top: 4px; margin-top: 35px; }
  .words-box { background: #f0f4ff; border-left: 3px solid #1a1a2e; padding: 6px 10px; margin-bottom: 8px; font-size: 8.5px; }
  .tax-mini { font-size: 7.5px; color: #555; }
</style></head><body>
<div class="container">
  <div class="header">
    <div>
      ${logoSrc ? `<img src="${logoSrc}" alt="Logo" style="max-height:50px;max-width:150px;object-fit:contain;margin-bottom:6px;display:block;"/>` : ''}
      <div class="company-name">${s.companyName || 'YOUR COMPANY'}</div>
      <div class="company-sub">${s.address || ''}</div>
      ${s.gstNumber ? `<div class="company-sub">GSTIN: ${s.gstNumber}</div>` : ''}
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
      ${order.siteName ? `<div style="font-size:9px;font-weight:bold;color:#e84393;margin-top:2px">🏗️ ${order.siteName}</div>` : ''}
      ${order.siteAddress ? `<div style="font-size:8.5px;color:#555;margin-top:1px">📍 ${order.siteAddress}</div>` : ''}
      <div style="font-size:8.5px;color:#555;margin-top:3px">${order.customer?.address || ''}</div>
      ${order.customer?.phone ? `<div style="font-size:8px;color:#888">📞 ${order.customer.phone}</div>` : ''}
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
        <th width="4%">No.</th>
        <th width="52%">Description</th>
        <th width="11%">${qtyLabel}</th>
        <th width="13%">Box Qty</th>
        <th width="9%">${rateLabel}</th>
        <th width="11%">Total</th>
      </tr></thead>
      <tbody>
      ${order.items.map((item, i) => {
          const total = item.total || item.quantity * item.price;
          const withTax = total + (total * taxPct / 100);
          return `<tr>
            <td style="text-align:center">${i + 1}</td>
            <td><strong>${(item.name || '').toUpperCase()}</strong><span style="display:block;font-size:8.5px;color:#888">${item.brand || ''} ${item.size || ''}</span></td>
            <td style="text-align:center;font-weight:bold">${item.totalSqFt ? formatIndianNumber(item.totalSqFt, 2) : formatIndianNumber(item.primaryQty || item.quantity || 0, 2)}</td>
            <td style="text-align:center">${item.boxCount ? `${item.boxCount} (${item.pcsPerBox || ''} pcs/box)` : (item.secondaryQty ? `${item.secondaryQty}` : '')}</td>
            <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
            <td style="text-align:right;font-weight:bold">${formatIndianNumber(withTax, 2)}</td>
          </tr>`;
      }).join('')}
      <tr style="height:100%"><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td></tr>
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
      ${order.advanceAmount > 0 ? `<div class="total-row" style="color:green"><span>Advance:</span><span>- ${sym}${formatIndianNumber(order.advanceAmount, 2)}</span></div>` : ''}
      <div class="net-total"><span>TOTAL:</span><span>${sym}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>
  <div class="footer">
    <div class="sig"><div class="sig-label">CUSTOMER SIGNATURE</div></div>
    <div>
      ${s.branding?.bankName ? `<div style="font-size:7.5px;color:#888;text-align:right"><b>Bank:</b> ${s.branding.bankName} | <b>A/C:</b> ${s.branding.accountNumber || ''} | <b>IFSC:</b> ${s.branding.ifscCode || ''}</div>` : ''}
    </div>
    <div class="sig"><div style="font-size:7.5px;color:#777;margin-bottom:0">For ${s.companyName || 'COMPANY'}</div><div class="sig-label">AUTHORISED SIGNATORY</div></div>
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
    const qtyLabel = s.unitConfig?.quantityLabel || 'Qty';
    const rateLabel = s.unitConfig?.rateLabel || 'Rate';
    const terms = order.terms || s.branding?.termsAndConditions || 'E. & O.E.';
    const sym = s.documentConfig?.currencySymbol || '₹';
    const logoSrc = s.branding?.logoUrl
        ? (s.branding.logoUrl.startsWith('http') ? s.branding.logoUrl : `${window.location.origin}${s.branding.logoUrl}`)
        : '';

    return `<html><head><title>${title} - ${docNo}</title>
<style>
  @page { size: A4; margin: 10mm; }
  body { font-family: 'Helvetica Neue', Arial, sans-serif; font-size: 10px; color: #333; margin: 0; background: #fff; display: flex; justify-content: center; }
  .top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; width: 190mm; }
  .company-name { font-size: 24px; font-weight: 900; color: #111; letter-spacing: -0.5px; }
  .company-detail { font-size: 8.5px; color: #888; margin-top: 4px; line-height: 1.7; }
  .doc-info { text-align: right; }
  .doc-type { font-size: 22px; font-weight: 900; color: #111; }
  .doc-number { font-size: 12px; color: #888; font-weight: 600; }
  .doc-date { font-size: 9px; color: #aaa; margin-top: 3px; }
  .divider { height: 2px; background: #111; margin: 12px 0; }
  .thin-divider { height: 1px; background: #eee; margin: 10px 0; }
  .bill-section { display: flex; gap: 30px; margin-bottom: 14px; }
  .bill-to { flex: 1.5; }
  .bill-to-label { font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; color: #bbb; margin-bottom: 4px; }
  .bill-to-name { font-size: 13px; font-weight: 800; color: #111; }
  .bill-to-detail { font-size: 8.5px; color: #888; margin-top: 2px; }
  .bill-meta { flex: 1; }
  .bill-meta-row { display: flex; justify-content: space-between; font-size: 9px; padding: 2px 0; }
  .bill-meta-label { color: #aaa; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th { padding: 7px 6px; font-size: 7.5px; font-weight: 900; text-transform: uppercase; letter-spacing: 0.8px; color: #999; border-bottom: 1px solid #eee; text-align: left; }
  td { padding: 6px 6px; font-size: 8.5px; color: #333; border-bottom: 1px solid #f5f5f5; vertical-align: top; }
  tr:last-child td { border-bottom: none; }
  .item-table { min-height: 150mm; }
  .totals-section { display: flex; gap: 20px; margin-top: 15px; }
  .totals-left { flex: 1.5; font-size: 8px; color: #888; line-height: 1.7; }
  .totals-right { flex: 1; }
  .total-row { display: flex; justify-content: space-between; padding: 4px 0; font-size: 9px; border-bottom: 1px solid #f5f5f5; }
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
      ${order.siteName ? `<div style="font-size:9px;font-weight:800;color:#555;margin-top:2px">🏗️ ${order.siteName}</div>` : ''}
      ${order.siteAddress ? `<div class="bill-to-detail">📍 ${order.siteAddress}</div>` : ''}
      <div class="bill-to-detail">${order.customer?.address || ''}</div>
      ${order.customer?.phone ? `<div class="bill-to-detail">Tel: ${order.customer.phone}</div>` : ''}
    </div>
    <div class="bill-meta">
      ${order.terms ? `<div class="bill-meta-row"><span class="bill-meta-label">Terms:</span><span>${order.terms}</span></div>` : ''}
    </div>
  </div>

  <table class="item-table">
    <thead><tr>
      <th width="4%">No</th>
      <th width="52%">Description</th>
      <th width="11%">${qtyLabel}</th>
      <th width="13%">Box Qty</th>
      <th width="9%">${rateLabel}</th>
      <th width="11%">Total</th>
    </tr></thead>
    <tbody>
    ${order.items.map((item, i) => {
        const total = item.total || item.quantity * item.price;
        const withTax = total + (total * taxPct / 100);
        return `<tr>
          <td style="color:#aaa">${i + 1}</td>
          <td><strong style="color:#111">${(item.name || '').toUpperCase()}</strong><br/><span style="color:#aaa;font-size:8.5px">${item.brand || ''} ${item.size || ''}</span></td>
          <td style="text-align:center;font-weight:700">
            ${item.totalSqFt ? formatIndianNumber(item.totalSqFt, 2) : formatIndianNumber(item.primaryQty || item.quantity || 0, 2)}
          </td>
          <td style="text-align:center">${item.boxCount ? `${item.boxCount}-${item.pcsPerBox || ''} pcs/box` : (item.secondaryQty ? `${item.secondaryQty}` : '')}</td>
          <td style="text-align:right">${formatIndianNumber(item.price || 0, 2)}</td>
          <td style="text-align:right;font-weight:700">${formatIndianNumber(withTax, 2)}</td>
        </tr>`;
    }).join('')}
    <tr style="height:100%"><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td><td style="border:none"></td></tr>
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
      ${order.advanceAmount > 0 ? `<div class="total-row"><span class="lbl" style="color:green">Advance</span><span style="color:green">- ${sym}${formatIndianNumber(order.advanceAmount, 2)}</span></div>` : ''}
      <div class="grand-row"><span>TOTAL</span><span>${sym}${formatIndianNumber(order.totalAmount || 0, 2)}</span></div>
    </div>
  </div>

  <div class="footer">
    <div class="sig-block"><div class="sig-line">CUSTOMER SIGNATURE</div></div>
    ${s.branding?.bankName ? `<div style="font-size:7.5px;color:#aaa;text-align:center">Bank: ${s.branding.bankName}<br/>A/C: ${s.branding.accountNumber} | IFSC: ${s.branding.ifscCode}</div>` : '<div></div>'}
    <div class="sig-block"><div style="font-size:7.5px;color:#aaa">For ${s.companyName || ''}</div><div class="sig-line">AUTHORISED SIGNATORY</div></div>
  </div>
</body></html>`;
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
    else html = template1(order, settings, docType);

    const w = window.open('', '_blank', 'width=950,height=750');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
};

// ─────────────────────────────────────────────────────────────────────────────
// Preview HTML generator
// ─────────────────────────────────────────────────────────────────────────────
export const generatePreviewHtml = (templateNo, settings) => {
    const dummyOrder = {
        orderNumber: 'INV-0001',
        orderDate: new Date().toISOString(),
        customer: { name: 'Acme Corporation', companyName: 'Acme Corp', address: '123 Main St, Tech City', phone: '+91 9876543210' },
        terms: 'Payment within 7 days. Subject to local jurisdiction.',
        items: [
            { name: 'Premium Ceramic Tile', brand: 'Kajaria', size: '2x2', hsn: '6907', quantity: 15, primaryQty: 15, totalSqFt: 60, boxCount: 15, price: 50, total: 3000 },
            { name: 'Adhesive 20Kg', brand: 'Fevimate', size: '', hsn: '3506', quantity: 2, primaryQty: 2, price: 400, total: 800 },
            { name: 'Spacer 2mm', brand: 'Generic', size: '2mm', hsn: '3926', quantity: 10, primaryQty: 10, price: 50, total: 500 },
        ],
        itemsTotal: 4300,
        taxAmount: 774, // 18% of 4300
        loadingCharges: 100,
        unloadingCharges: 50,
        transportCharges: 300,
        discountAmount: 150,
        advanceAmount: 0,
        oldBalance: 0,
        totalAmount: 5374
    };

    let html;
    if (templateNo === 2) html = template2(dummyOrder, settings, 'invoice');
    else if (templateNo === 3) html = template3(dummyOrder, settings, 'invoice');
    else html = template1(dummyOrder, settings, 'invoice');
    
    return html;
};

// ─────────────────────────────────────────────────────────────────────────────
// ACCOUNT STATEMENT PRINT — Customer Ledger
// ─────────────────────────────────────────────────────────────────────────────
export const printAccountStatement = (customer, entries, summary, period, settings) => {
    const s = settings || {};
    const sym = s.documentConfig?.currencySymbol || '₹';
    const companyName = s.companyName || 'Your Company';
    const fromStr = period?.from ? new Date(period.from).toLocaleDateString('en-IN') : 'Beginning';
    const toStr = period?.to ? new Date(period.to).toLocaleDateString('en-IN') : new Date().toLocaleDateString('en-IN');

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
  body { font-family: Arial, sans-serif; font-size: 10px; color: #222; margin: 0; }
  .header { text-align: center; border-bottom: 2px solid #222; padding-bottom: 8px; margin-bottom: 8px; }
  .header h1 { margin: 0; font-size: 20px; font-weight: 900; }
  .header p { margin: 2px 0; font-size: 9px; color: #555; }
  .statement-title { text-align: center; font-size: 14px; font-weight: 900; letter-spacing: 4px; background: #1a1a2e; color: #fff; padding: 6px 0; margin-bottom: 10px; }
  .meta { display: flex; justify-content: space-between; margin-bottom: 10px; }
  .meta-box { background: #f5f7fb; border-radius: 6px; padding: 8px 12px; flex: 1; margin: 0 4px; }
  .meta-box:first-child { margin-left: 0; }
  .meta-box:last-child { margin-right: 0; }
  .meta-label { font-size: 8px; font-weight: 900; text-transform: uppercase; color: #999; }
  .meta-value { font-size: 12px; font-weight: 700; color: #222; }
  table { width: 100%; border-collapse: collapse; margin-top: 6px; }
  th { background: #1a1a2e; color: #fff; padding: 6px 6px; font-size: 8px; text-transform: uppercase; letter-spacing: 0.5px; text-align: left; }
  td { padding: 5px 6px; font-size: 9px; border-bottom: 1px solid #f0f0f0; vertical-align: top; }
  .summary { display: flex; justify-content: flex-end; margin-top: 12px; gap: 12px; }
  .sum-box { border: 1px solid #ddd; border-radius: 6px; padding: 8px 16px; text-align: right; min-width: 150px; }
  .sum-label { font-size: 8px; color: #999; font-weight: 700; text-transform: uppercase; }
  .sum-value { font-size: 14px; font-weight: 900; margin-top: 2px; }
  .footer { margin-top: 20px; display: flex; justify-content: space-between; font-size: 8px; color: #aaa; border-top: 1px solid #eee; padding-top: 8px; }
</style></head><body>
<div class="header">
  <h1>${companyName}</h1>
  <p>${s.address || ''} ${s.phone1 ? '| Tel: ' + s.phone1 : ''} ${s.gstNumber ? '| GSTIN: ' + s.gstNumber : ''}</p>
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

    const w = window.open('', '_blank', 'width=950,height=750');
    w.document.write(html);
    w.document.close();
    setTimeout(() => { w.focus(); w.print(); }, 600);
};

