const { MongoClient } = require('mongodb');
require('dotenv').config({ path: '.env.local' });

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI not set");
    return;
  }
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db(); 
    const workspaces = await db.collection("workspaces").find({}).toArray();
    console.log(JSON.stringify(workspaces, null, 2));
  } finally {
    await client.close();
  }
}
run();
