const http = require('http');

http.get('http://127.0.0.1:3000/api/reports/missing-cost?skuId=all', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      const items = json.data?.items || json.items || [];
      console.log('Total items:', items.length);
      if (items.length > 0) {
        console.log('Sample item:', items[0]);
      }
    } catch (e) {
      console.log('Parse error:', e.message);
    }
  });
}).on('error', err => {
  console.log('Error:', err.message);
});
