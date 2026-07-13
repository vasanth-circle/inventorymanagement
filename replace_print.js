const fs = require('fs');
let data = fs.readFileSync('client/src/utils/printTemplates.js', 'utf8');

data = data.replace(
    /        const crStr = entry.credit \? formatAmt\(entry.credit\) : '';\s*const dateStr = new Date\(entry.date\).toLocaleDateString\('en-IN'\);\s*const particulars = \(entry.description \|\| ''\).substring\(0, 25\);\s*const typeStr = entry.type === 'bill' \? 'Sales' : \(entry.type === 'payment' \? 'Receipt' : 'Journal'\);\s*rows \+= `<tr style="vertical-align:top;">\s*<td style="width:12%">${dateStr}<\/td>\s*<td style="width:25%">${particulars}<\/td>\s*<td style="width:15%"><\/td>\s*<td style="width:12%">${typeStr}<\/td>\s*<td style="width:10%">${entry.refNumber \|\| ''}<\/td>\s*<td style="width:13%;text-align:right">${drStr}<\/td>\s*<td style="width:13%;text-align:right">${crStr}<\/td>\s*<\/tr>`;/,
    `        const crStr = entry.credit ? formatAmt(entry.credit) : '';
        const balStr = entry.balance !== undefined ? \`\${formatAmt(Math.abs(entry.balance))} \${entry.balance >= 0 ? 'Dr' : 'Cr'}\` : '';
        const dateStr = new Date(entry.date).toLocaleDateString('en-IN');
        const particulars = (entry.description || '').substring(0, 25);
        const typeStr = entry.type === 'bill' ? 'Sales' : (entry.type === 'payment' ? 'Receipt' : 'Journal');
        
        rows += \`<tr style="vertical-align:top;">
            <td style="width:10%">\${dateStr}</td>
            <td style="width:25%">\${particulars}</td>
            <td style="width:10%">\${typeStr}</td>
            <td style="width:10%">\${entry.refNumber || ''}</td>
            <td style="width:13%;text-align:right">\${drStr}</td>
            <td style="width:13%;text-align:right">\${crStr}</td>
            <td style="width:19%;text-align:right"><b>\${balStr}</b></td>
        </tr>\`;`
);

data = data.replace(
    /    <th style="width:12%">Date<\/th>\s*<th style="width:25%">Particulars<\/th>\s*<th style="width:15%">Remarks<\/th>\s*<th style="width:12%">Vch Type<\/th>\s*<th style="width:10%">Vch No<\/th>\s*<th style="width:13%;text-align:right">Debit<\/th>\s*<th style="width:13%;text-align:right">Credit<\/th>/,
    `    <th style="width:10%">Date</th>
    <th style="width:25%">Particulars</th>
    <th style="width:10%">Vch Type</th>
    <th style="width:10%">Vch No</th>
    <th style="width:13%;text-align:right">Debit</th>
    <th style="width:13%;text-align:right">Credit</th>
    <th style="width:19%;text-align:right">Balance</th>`
);

data = data.replace(
    /    <td style="width:12%"><\/td>\s*<td style="width:25%"><b>Opening Balance :<\/b><\/td>\s*<td style="width:15%"><\/td>\s*<td style="width:12%"><\/td>\s*<td style="width:10%"><\/td>\s*<td style="width:13%;text-align:right"><b>\${openingBal >= 0 \? formatAmt\(openingBal\) : ''}<\/b><\/td>\s*<td style="width:13%;text-align:right"><b>\${openingBal < 0 \? formatAmt\(Math.abs\(openingBal\)\) : ''}<\/b><\/td>/,
    `    <td style="width:10%"></td>
    <td style="width:25%"><b>Opening Balance :</b></td>
    <td style="width:10%"></td>
    <td style="width:10%"></td>
    <td style="width:13%;text-align:right"><b>\${openingBal >= 0 ? formatAmt(openingBal) : ''}</b></td>
    <td style="width:13%;text-align:right"><b>\${openingBal < 0 ? formatAmt(Math.abs(openingBal)) : ''}</b></td>
    <td style="width:19%;text-align:right"><b>\${openingBal !== 0 ? formatAmt(Math.abs(openingBal)) + (openingBal > 0 ? ' Dr' : ' Cr') : ''}</b></td>`
);

data = data.replace(
    /    <td style="width:12%"><\/td>\s*<td style="width:25%"><b>Closing Balance :<\/b><\/td>\s*<td style="width:15%"><\/td>\s*<td style="width:12%"><\/td>\s*<td style="width:10%"><\/td>\s*<td style="width:13%;text-align:right"><b>\${closeBal < 0 \? formatAmt\(Math.abs\(closeBal\)\) : ''}<\/b><\/td>\s*<td style="width:13%;text-align:right"><b>\${closeBal >= 0 \? formatAmt\(closeBal\) : ''}<\/b><\/td>/,
    `    <td style="width:10%"></td>
    <td style="width:25%"><b>Closing Balance :</b></td>
    <td style="width:10%"></td>
    <td style="width:10%"></td>
    <td style="width:13%;text-align:right"><b>\${closeBal < 0 ? formatAmt(Math.abs(closeBal)) : ''}</b></td>
    <td style="width:13%;text-align:right"><b>\${closeBal >= 0 ? formatAmt(closeBal) : ''}</b></td>
    <td style="width:19%;text-align:right"><b>\${closeBal !== 0 ? formatAmt(Math.abs(closeBal)) + (closeBal > 0 ? ' Dr' : ' Cr') : ''}</b></td>`
);

data = data.replace(
    /    <td style="width:12%"><\/td>\s*<td style="width:25%"><\/td>\s*<td style="width:15%"><\/td>\s*<td style="width:12%"><\/td>\s*<td style="width:10%"><\/td>\s*<td style="width:13%;text-align:right"><b>\${formatAmt\(totalDr \+ \(openingBal > 0 \? openingBal : 0\) \+ \(closeBal < 0 \? Math.abs\(closeBal\) : 0\)\)}<\/b><\/td>\s*<td style="width:13%;text-align:right"><b>\${formatAmt\(totalCr \+ \(openingBal < 0 \? Math.abs\(openingBal\)\ : 0\) \+ \(closeBal > 0 \? closeBal : 0\)\)}<\/b><\/td>/,
    `    <td style="width:10%"></td>
    <td style="width:25%"></td>
    <td style="width:10%"></td>
    <td style="width:10%"></td>
    <td style="width:13%;text-align:right"><b>\${formatAmt(totalDr + (openingBal > 0 ? openingBal : 0) + (closeBal < 0 ? Math.abs(closeBal) : 0))}</b></td>
    <td style="width:13%;text-align:right"><b>\${formatAmt(totalCr + (openingBal < 0 ? Math.abs(openingBal) : 0) + (closeBal > 0 ? closeBal : 0))}</b></td>
    <td style="width:19%"></td>`
);


fs.writeFileSync('client/src/utils/printTemplates.js', data);
console.log("Done");
