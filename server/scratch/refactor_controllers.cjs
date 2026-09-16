const fs = require('fs');

function refactorFile(filePath, type) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    if (type === 'sales') {
        content = content.replace(/import\s+CustomerLedger\s+from\s+['\"][.\/]+models\/CustomerLedger\.js['\"];?/g, "import Ledger from '../models/Ledger.js';");
        content = content.replace(/CustomerLedger/g, 'Ledger');
        content = content.replace(/Ledger\.find\(\{\s*customer:/g, "Ledger.find({ partyType: 'Customer', party:");
        content = content.replace(/Ledger\.findOne\(\{\s*customer:/g, "Ledger.findOne({ partyType: 'Customer', party:");
        content = content.replace(/Ledger\.create\(\{\s*tenantId:\s*([^,]+),\s*customer:/g, "Ledger.create({ tenantId: $1, partyType: 'Customer', party:");
        content = content.replace(/Ledger\.findOne\(\{\s*refId:/g, "Ledger.findOne({ partyType: 'Customer', refId:");
        content = content.replace(/Ledger\.deleteMany\(\{\s*refId:/g, "Ledger.deleteMany({ partyType: 'Customer', refId:");
        content = content.replace(/Ledger\.aggregate\(\[\s*\{\s*\$match:\s*\{\s*customer:/g, "Ledger.aggregate([ { $match: { partyType: 'Customer', party:");
        content = content.replace(/Ledger\.aggregate\(\[\s*\{\s*\$match:\s*\{\s*tenantId:\s*([^,]+),\s*customer:/g, "Ledger.aggregate([ { $match: { tenantId: $1, partyType: 'Customer', party:");
        content = content.replace(/Ledger\.updateOne\(\{\s*_id:/g, "Ledger.updateOne({ _id:");
        content = content.replace(/Ledger\.deleteMany\(\{\s*customer:/g, "Ledger.deleteMany({ partyType: 'Customer', party:");
    } else if (type === 'purchase') {
        content = content.replace(/import\s+VendorLedger\s+from\s+['\"][.\/]+models\/VendorLedger\.js['\"];?/g, "import Ledger from '../models/Ledger.js';");
        content = content.replace(/VendorLedger/g, 'Ledger');
        content = content.replace(/Ledger\.find\(\{\s*vendor:/g, "Ledger.find({ partyType: 'Vendor', party:");
        content = content.replace(/Ledger\.findOne\(\{\s*vendor:/g, "Ledger.findOne({ partyType: 'Vendor', party:");
        content = content.replace(/Ledger\.create\(\{\s*tenantId:\s*([^,]+),\s*vendor:/g, "Ledger.create({ tenantId: $1, partyType: 'Vendor', party:");
        content = content.replace(/Ledger\.findOne\(\{\s*refId:/g, "Ledger.findOne({ partyType: 'Vendor', refId:");
        content = content.replace(/Ledger\.deleteMany\(\{\s*refId:/g, "Ledger.deleteMany({ partyType: 'Vendor', refId:");
        content = content.replace(/Ledger\.aggregate\(\[\s*\{\s*\$match:\s*\{\s*vendor:/g, "Ledger.aggregate([ { $match: { partyType: 'Vendor', party:");
        content = content.replace(/Ledger\.aggregate\(\[\s*\{\s*\$match:\s*\{\s*tenantId:\s*([^,]+),\s*vendor:/g, "Ledger.aggregate([ { $match: { tenantId: $1, partyType: 'Vendor', party:");
        content = content.replace(/Ledger\.updateOne\(\{\s*_id:/g, "Ledger.updateOne({ _id:");
        content = content.replace(/Ledger\.deleteMany\(\{\s*vendor:/g, "Ledger.deleteMany({ partyType: 'Vendor', party:");
    }

    fs.writeFileSync(filePath, content);
}

refactorFile('server/controllers/customerController.js', 'sales');
refactorFile('server/controllers/vendorLedgerController.js', 'purchase');
refactorFile('server/controllers/dashboardController.js', 'sales');
