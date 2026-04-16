const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'controllers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const IMPORT_LINE = `import { tenantQuery } from '../utils/tenantQuery.js';\n`;

let totalPatched = 0;

files.forEach(filename => {
    const filePath = path.join(dir, filename);
    let content = fs.readFileSync(filePath, 'utf8');

    if (content.includes('tenantQuery')) {
        console.log(`SKIP (already patched): ${filename}`);
        return;
    }

    const original = content;

    // Add import after the first import line block
    const firstImportEnd = content.lastIndexOf('\nimport ');
    const afterLastImport = content.indexOf('\n', firstImportEnd + 1) + 1;
    content = content.slice(0, afterLastImport) + IMPORT_LINE + content.slice(afterLastImport);

    // 1. Replace: { tenantId: req.tenantId } → { ...tenantQuery(req) }
    content = content.replace(/\{\s*tenantId:\s*req\.tenantId\s*\}/g, '{ ...tenantQuery(req) }');

    // 2. Replace: { _id: X, tenantId: req.tenantId } → { _id: X, ...tenantQuery(req) }
    content = content.replace(
        /\{\s*_id:\s*([^,}]+),\s*tenantId:\s*req\.tenantId\s*\}/g,
        (_, id) => `{ _id: ${id.trim()}, ...tenantQuery(req) }`
    );

    // 3. Replace: tenantId: req.tenantId, (mid-object) → ...tenantQuery(req),
    content = content.replace(/tenantId:\s*req\.tenantId,/g, '...tenantQuery(req),');

    // 4. Replace remaining: tenantId: req.tenantId (end of object) → ...tenantQuery(req)
    content = content.replace(/tenantId:\s*req\.tenantId/g, '...tenantQuery(req)');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`PATCHED: ${filename}`);
        totalPatched++;
    } else {
        console.log(`NO CHANGE: ${filename}`);
    }
});

console.log(`\nDone. Patched ${totalPatched} files.`);
