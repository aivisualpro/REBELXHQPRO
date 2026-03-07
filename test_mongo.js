const mongoose = require('mongoose');
mongoose.connect('mongodb+srv://kemalwhyte:2s26Jp5t3HkP35K3@etg-crm.yl0ok.mongodb.net/test?retryWrites=true&w=majority&appName=etg-crm').then(() => {
    const Workspace = mongoose.model('Workspace', new mongoose.Schema({
        name: String,
        modules: Array
    }));
    Workspace.findOne({ name: 'QC' }).lean().then(ws => {
        if (!ws) {
            console.log('not found');
        } else {
            const wholesale = ws.modules.find(m => m.key === 'sales').subModules.find(s => s.key === 'wholesale-orders');
            console.log(JSON.stringify(wholesale.fields, null, 2));
        }
        process.exit(0);
    });
});
