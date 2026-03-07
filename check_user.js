const http = require('http');

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/api/users',
  method: 'GET',
};

const req = http.request(options, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const users = JSON.parse(data).users;
    for (const u of users) {
      if (u.workspaceId === '69aa26f0e47fea716fa8a590') {
         console.log(u);
      }
    }
  });
});
req.end();
