fetch('http://localhost:3000/api/opening-balances?search=Wood')
  .then(r => r.json())
  .then(d => console.log(JSON.stringify(d, null, 2)))
  .catch(console.error);
