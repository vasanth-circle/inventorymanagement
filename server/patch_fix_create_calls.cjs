const fs = require('fs');
const path = require('path');

const dir = path.join(__dirname, 'controllers');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

let totalPatched = 0;

files.forEach(filename => {
    const filePath = path.join(dir, filename);
    let content = fs.readFileSync(filePath, 'utf8');
    const original = content;

    // In .create({...tenantQuery(req),...}) and {tenantId: req.tenantId} in object literals
    // that are WRITE contexts - find ...tenantQuery(req), inside .create( or new Model( contexts

    // Fix: ...tenantQuery(req), inside create calls → tenantId: req.tenantId,
    // Strategy: look for pattern where ...tenantQuery(req), appears right after .create({
    // or after the opening brace of a create/Model() call

    // Simple heuristic: if ...tenantQuery(req) appears in a line that also has "create(" 
    // or the line above has "create({"  => replace with tenantId: req.tenantId

    // Split into lines for context-aware replacement
    const lines = content.split('\n');
    const result = [];
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Check if this line has ...tenantQuery(req) (and NOT in a .find or .findOne context)
        if (line.includes('...tenantQuery(req)')) {
            // Look at surrounding context (1-3 lines back) for create( or new 
            const context = lines.slice(Math.max(0, i-3), i+1).join('\n');
            const isCreateContext = /\.create\s*\(|await\s+\w+\.create\s*\(/.test(context);
            const isFindOneAndUpdateUpsert = /findOneAndUpdate\s*\(/.test(context);
            
            // For findOneAndUpdate, the FIRST arg is the filter (ok with $in)
            // The SECOND arg is the update (bad with $in). 
            // In our case the pattern puts it only in filter, so it's fine.
            // Only fix explicit create() calls.
            
            if (isCreateContext && !line.includes('findOne') && !line.includes('.find(')) {
                line = line.replace(/\.\.\.(tenantQuery\(req\))/g, 'tenantId: req.tenantId');
                console.log(`  Fixed create in ${filename} line ${i+1}`);
            }
        }
        
        result.push(line);
    }
    
    content = result.join('\n');

    if (content !== original) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`PATCHED: ${filename}`);
        totalPatched++;
    }
});

console.log(`\nDone. Patched ${totalPatched} files.`);
