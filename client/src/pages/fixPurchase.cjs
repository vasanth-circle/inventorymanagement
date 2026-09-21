const fs = require('fs');
let content = fs.readFileSync('c:/Users/Admin/Documents/GitHub/inventorymanagement/client/src/pages/PurchaseOrders.jsx', 'utf8');

content = content.replace("import { useState, useEffect, useContext } from 'react';", "import { useState, useEffect, useContext } from 'react';\nimport { useLocation } from 'react-router-dom';");

content = content.replace("const CUSTOMERS_API = '/api/customers';", "const CUSTOMERS_API = '/api/parties';");

content = content.replace("res.data.data?.vendors || res.data.vendors", "res.data.data?.partys || res.data.partys");

content = content.replace("const [search, setSearch] = useState('');", "const location = useLocation();\n    const [search, setSearch] = useState(location.state?.searchOrderNumber || '');");

fs.writeFileSync('c:/Users/Admin/Documents/GitHub/inventorymanagement/client/src/pages/PurchaseOrders.jsx', content);
console.log('Fixed PurchaseOrders.jsx!');
