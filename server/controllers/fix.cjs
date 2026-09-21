const fs = require('fs');
let content = fs.readFileSync('c:/Users/Admin/Documents/GitHub/inventorymanagement/server/controllers/dashboardController.js', 'utf8');

// Replace imports
content = content.replace(/import Vendor from '\.\.\/models\/Vendor\.js';/, 'import Party from \'../models/Party.js\';');

// Replace Supplier Analytics
content = content.replace(/{ \$group: { _id: '\$vendor',/g, '{ $group: { _id: \'$party\',');
content = content.replace(/{ \$lookup: { from: 'vendors',/g, '{ $lookup: { from: \'parties\',');
content = content.replace(/as: 'vendorInfo'/g, 'as: \'partyInfo\'');
content = content.replace(/path: '\$vendorInfo'/g, 'path: \'$partyInfo\'');
content = content.replace(/\$vendorInfo\.name/g, '$partyInfo.name');

// Replace Recent Sales query
content = content.replace(/select\('orderNumber totalAmount status orderDate customer'\)/g, 'select(\'orderNumber totalAmount status orderDate party\')');
content = content.replace(/populate\('customer',/g, 'populate(\'party\',');
content = content.replace(/s\.customer\?/g, 's.party?');
content = content.replace(/s\.customer\?/g, 's.party?');

// Replace Recent POs query
content = content.replace(/select\('orderNumber totalAmount status orderDate vendor'\)/g, 'select(\'orderNumber totalAmount status orderDate party\')');
content = content.replace(/populate\('vendor',/g, 'populate(\'party\',');
content = content.replace(/p\.vendor\?/g, 'p.party?');

fs.writeFileSync('c:/Users/Admin/Documents/GitHub/inventorymanagement/server/controllers/dashboardController.js', content);
console.log('Fixed dashboardController!');
