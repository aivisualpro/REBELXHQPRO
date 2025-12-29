import dbConnect from './src/lib/mongoose';
import Manufacturing from './src/models/Manufacturing';

async function test() {
    await dbConnect();
    const statuses = await Manufacturing.distinct('status');
    console.log("Statuses in Manufacturing:", statuses);
    process.exit(0);
}

test();
