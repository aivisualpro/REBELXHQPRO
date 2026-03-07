const http = require('http');

let data = '';
const req = http.request({
  hostname: 'localhost',
  port: 3000,
  path: '/api/auth/session',
  method: 'GET'
}, res => {
  res.on('data', d => data += d);
  res.on('end', () => console.log(data));
});
req.end();
