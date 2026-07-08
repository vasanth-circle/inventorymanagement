const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

mongoose.connect('mongodb://127.0.0.1:27017/dev-siva').then(async () => {
    const db = mongoose.connection.useDb('dev-siva');
    const User = db.collection('users');
    
    // Hash password
    const hash = await bcrypt.hash('admin123', 8);
    
    // Update admin user
    await User.updateOne({ emailId: 'admin123@gmail.com' }, { $set: { password: hash } });
    
    console.log('Password reset successfully to admin123');
    process.exit(0);
});
