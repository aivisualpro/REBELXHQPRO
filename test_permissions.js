const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/workspaces',
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const d = JSON.parse(data);
    const qc = d.data.find(w => w.name === 'QC');
    if (!qc) return console.log('not found');
    const ws = qc.modules.find(m => m.key === 'sales').subModules.find(s => s.key === 'wholesale-orders');
    console.log(ws.fields);
  });
});
req.end();
