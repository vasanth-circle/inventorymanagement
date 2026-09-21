const fs = require('fs');
let content = fs.readFileSync('c:/Users/Admin/Documents/GitHub/inventorymanagement/client/src/pages/SalesOrders.jsx', 'utf8');

content = content.replace("import React, { useState, useEffect, useContext } from 'react';", "import React, { useState, useEffect, useContext } from 'react';\nimport { useLocation } from 'react-router-dom';");

content = content.replace("const CUSTOMERS_API = '/api/customers';", "const CUSTOMERS_API = '/api/parties';");

content = content.replace("res.data.data?.customers || res.data.customers", "res.data.data?.partys || res.data.partys");

content = content.replace("const [searchTerm, setSearchTerm] = useState('');", "const location = useLocation();\n    const [searchTerm, setSearchTerm] = useState(location.state?.searchOrderNumber || '');");

fs.writeFileSync('c:/Users/Admin/Documents/GitHub/inventorymanagement/client/src/pages/SalesOrders.jsx', content);
console.log('Fixed SalesOrders.jsx!');
