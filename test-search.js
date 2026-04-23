require('dotenv').config({ path: '.env.local' });
const mongoose = require('mongoose');

async function test() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB");
  
  const search = "Matte Black Mylar";
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  
  // mock buildFuzzyRegex
  function buildFuzzyRegex(token) {
    const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const allPatterns = [escapeRegex(token)];
    if (token.length >= 4) allPatterns.push(escapeRegex(token.slice(0, -1)));
    if (token.length >= 6) allPatterns.push(escapeRegex(token.slice(0, -2)));
    return [...new Set(allPatterns)].join('|');
  }

  let query = {};
  const andConditions = await Promise.all(tokens.map(async (token) => {
    const fuzzyPattern = buildFuzzyRegex(token);
    const db = mongoose.connection.db;
    let tokenSkuIds = [];
    const tokenSkus = await db.collection('skus').find(
        { name: { $regex: fuzzyPattern, $options: 'i' } },
        { projection: { _id: 1 } }
    ).limit(150).toArray();
    
    tokenSkus.forEach((s) => {
        tokenSkuIds.push(s._id);
        tokenSkuIds.push(s._id.toString());
    });
    
    const fieldMatches = ['lotNumber'].map(field => ({
        [field]: { $regex: fuzzyPattern, $options: 'i' }
    }));
    return {
        $or: [
            ...fieldMatches,
            ...(tokenSkuIds.length > 0 ? [{ sku: { $in: tokenSkuIds } }] : [])
        ]
    };
  }));
  query.$and = andConditions;

  console.log(JSON.stringify(query, null, 2));
  
  const OpeningBalance = mongoose.connection.db.collection('openingbalances');
  const count = await OpeningBalance.countDocuments(query);
  console.log("Count for 'Matte Black Mylar':", count);
  
  process.exit(0);
}
test().catch(console.error);
