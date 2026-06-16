const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'client', 'src');

const walkSync = (dir, filelist = []) => {
    fs.readdirSync(dir).forEach(file => {
        const filepath = path.join(dir, file);
        if (fs.statSync(filepath).isDirectory()) {
            filelist = walkSync(filepath, filelist);
        } else if (filepath.endsWith('.js') || filepath.endsWith('.jsx')) {
            filelist.push(filepath);
        }
    });
    return filelist;
};

const files = walkSync(srcDir);
let changedFiles = 0;

files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let newContent = content;

    // We only want to replace localStorage for 'token', 'user', and 'activeApp'
    // A simple regex approach:
    newContent = newContent.replace(/localStorage\.getItem\('token'\)/g, "sessionStorage.getItem('token')");
    newContent = newContent.replace(/localStorage\.setItem\('token'/g, "sessionStorage.setItem('token'");
    newContent = newContent.replace(/localStorage\.removeItem\('token'\)/g, "sessionStorage.removeItem('token')");

    newContent = newContent.replace(/localStorage\.getItem\('user'\)/g, "sessionStorage.getItem('user')");
    newContent = newContent.replace(/localStorage\.setItem\('user'/g, "sessionStorage.setItem('user'");
    newContent = newContent.replace(/localStorage\.removeItem\('user'\)/g, "sessionStorage.removeItem('user')");

    newContent = newContent.replace(/localStorage\.getItem\('activeApp'\)/g, "sessionStorage.getItem('activeApp')");
    newContent = newContent.replace(/localStorage\.setItem\('activeApp'/g, "sessionStorage.setItem('activeApp'");
    newContent = newContent.replace(/localStorage\.removeItem\('activeApp'\)/g, "sessionStorage.removeItem('activeApp')");

    if (newContent !== content) {
        fs.writeFileSync(file, newContent, 'utf8');
        console.log('Updated', file);
        changedFiles++;
    }
});

console.log('Total files changed:', changedFiles);
