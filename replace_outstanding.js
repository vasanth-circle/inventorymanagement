const fs = require('fs');
let data = fs.readFileSync('client/src/pages/CustomReports.jsx', 'utf8');

// 1. Update grand totals in buildOSSHtml
data = data.replace(
    /    const grandDr  = summaries.reduce\(\(s, r\) => s \+ r.totalDebit, 0\);\n    const grandCr  = summaries.reduce\(\(s, r\) => s \+ r.totalCredit, 0\);/g,
    `    const grandDr  = summaries.reduce((s, r) => s + (r.closingBalance > 0 ? r.closingBalance : 0), 0);\n    const grandCr  = summaries.reduce((s, r) => s + (r.closingBalance < 0 ? Math.abs(r.closingBalance) : 0), 0);`
);

// 2. Update rows in buildOSSHtml
data = data.replace(
    /<td style="text-align:right">\$\{r\.totalDebit > 0 \? fmt\(r\.totalDebit\) : ''\}<\/td>\n<td style="text-align:right">\$\{r\.totalCredit > 0 \? fmt\(r\.totalCredit\) : ''\}<\/td>\n<td style="text-align:right">\$\{r\.closingBalance < 0 \? '-' : ''\}\$\{fmt\(Math\.abs\(r\.closingBalance\)\)\}<\/td>/g,
    `<td style="text-align:right">\${r.closingBalance > 0 ? fmt(r.closingBalance) : ''}</td>\n<td style="text-align:right">\${r.closingBalance < 0 ? fmt(Math.abs(r.closingBalance)) : ''}</td>`
);

// 3. Update table headers in buildOSSHtml
data = data.replace(
    /<colgroup><col\/><col style="width:100px"\/><col style="width:100px"\/><col style="width:100px"\/><col style="width:115px"\/><\/colgroup>\n<thead><tr>\n<th>Particulars<\/th><th class="r">Debit<\/th><th class="r">Credit<\/th><th class="r">Closing<\/th><th>Cell<\/th>/g,
    `<colgroup><col/><col style="width:120px"/><col style="width:120px"/><col style="width:115px"/></colgroup>\n<thead><tr>\n<th>Particulars</th><th class="r">Pending (Dr)</th><th class="r">Advance (Cr)</th><th>Cell</th>`
);

// 4. Update sec and tot rows in buildOSSHtml
data = data.replace(
    /<tr class="sec"><td colspan="5"><b>\$\{title\}<\/b><\/td><\/tr>/g,
    `<tr class="sec"><td colspan="4"><b>\${title}</b></td></tr>`
);
data = data.replace(
    /<tr class="tot">\n<td><\/td>\n<td class="r">\$\{fmt\(grandDr\)\}<\/td>\n<td class="r">\$\{fmt\(grandCr\)\}<\/td>\n<td class="r">\$\{grandBal < 0 \? '-' : ''\}\$\{fmt\(Math\.abs\(grandBal\)\)\}<\/td>\n<td><\/td>\n<\/tr>/g,
    `<tr class="tot">\n<td></td>\n<td class="r">\${fmt(grandDr)}</td>\n<td class="r">\${fmt(grandCr)}</td>\n<td></td>\n</tr>`
);

// 5. Update grand totals in OutstandingSummary component
data = data.replace(
    /    const grandDebit   = rows.reduce\(\(s, r\) => s \+ r.totalDebit, 0\);\n    const grandCredit  = rows.reduce\(\(s, r\) => s \+ r.totalCredit, 0\);/g,
    `    const grandDebit   = rows.reduce((s, r) => s + (r.closingBalance > 0 ? r.closingBalance : 0), 0);\n    const grandCredit  = rows.reduce((s, r) => s + (r.closingBalance < 0 ? Math.abs(r.closingBalance) : 0), 0);`
);

// 6. Update card headers
data = data.replace(
    /<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Debit<\/p>/g,
    `<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Pending (Dr)</p>`
);
data = data.replace(
    /<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Credit<\/p>/g,
    `<p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Advance (Cr)</p>`
);

// 7. Update UI table headers
data = data.replace(
    /<th className="px-4 py-2\.5 text-xs font-semibold text-gray-500 uppercase text-right">Debit<\/th>\n                                    <th className="px-4 py-2\.5 text-xs font-semibold text-gray-500 uppercase text-right">Credit<\/th>\n                                    <th className="px-4 py-2\.5 text-xs font-semibold text-gray-500 uppercase text-right">Closing Balance<\/th>/g,
    `<th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Pending (Dr)</th>\n                                    <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase text-right">Advance (Cr)</th>`
);

// 8. Update UI table rows
data = data.replace(
    /<td className="px-4 py-2\.5 text-right text-red-600 font-semibold text-xs">\n                                            \{row\.totalDebit > 0 \? <>\s*\{'\\u20B9'\}\{fmt\(row\.totalDebit\)\}\s*<\/>\s*: <span className="text-gray-300">-<\/span>\}\n                                        <\/td>\n                                        <td className="px-4 py-2\.5 text-right text-green-600 font-semibold text-xs">\n                                            \{row\.totalCredit > 0 \? <>\s*\{'\\u20B9'\}\{fmt\(row\.totalCredit\)\}\s*<\/>\s*: <span className="text-gray-300">-<\/span>\}\n                                        <\/td>\n                                        <td className=\{`px-4 py-2\.5 text-right font-bold text-xs \$\{row\.closingBalance > 0 \? 'text-orange-600' : row\.closingBalance < 0 \? 'text-blue-600' : 'text-gray-400'\}`\}>\n                                            \{row\.closingBalance !== 0\n                                                \? <>\s*\{row\.closingBalance < 0 \? '-' : ''\}\s*\{'\\u20B9'\}\{fmt\(Math\.abs\(row\.closingBalance\)\)\}\s*<\/>\n                                                : 'Settled'\}\n                                        <\/td>/g,
    `<td className="px-4 py-2.5 text-right text-red-600 font-semibold text-xs">\n                                            {row.closingBalance > 0 ? <>{'\\u20B9'}{fmt(row.closingBalance)}</> : <span className="text-gray-300">-</span>}\n                                        </td>\n                                        <td className="px-4 py-2.5 text-right text-green-600 font-semibold text-xs">\n                                            {row.closingBalance < 0 ? <>{'\\u20B9'}{fmt(Math.abs(row.closingBalance))}</> : <span className="text-gray-300">-</span>}\n                                        </td>`
);

// 9. Update UI table footer
data = data.replace(
    /<td className="px-4 py-3 text-right font-bold text-red-300">\{'\\u20B9'\}\{fmt\(grandDebit\)\}<\/td>\n                                    <td className="px-4 py-3 text-right font-bold text-green-300">\{'\\u20B9'\}\{fmt\(grandCredit\)\}<\/td>\n                                    <td className=\{`px-4 py-3 text-right font-bold text-lg \$\{grandBalance >= 0 \? 'text-orange-300' : 'text-blue-300'\}`\}>\n                                        \{grandBalance < 0 \? '-' : ''\}\{'\\u20B9'\}\{fmt\(Math\.abs\(grandBalance\)\)\}\n                                    <\/td>/g,
    `<td className="px-4 py-3 text-right font-bold text-red-300">{'\\u20B9'}{fmt(grandDebit)}</td>\n                                    <td className="px-4 py-3 text-right font-bold text-green-300">{'\\u20B9'}{fmt(grandCredit)}</td>`
);

fs.writeFileSync('client/src/pages/CustomReports.jsx', data);
console.log("Done");
