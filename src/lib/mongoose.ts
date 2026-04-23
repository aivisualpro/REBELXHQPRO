import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error(
        'Please define the MONGODB_URI environment variable'
    );
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections from growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    if (cached.conn) {
        console.log('⚡ Using cached MongoDB connection');
        return cached.conn;
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            dbName: 'RebelXHQSystems',
            minPoolSize: 5,
            maxPoolSize: 20
        };

        console.log('🔌 Establishing new MongoDB connection...');
        console.time('mongoose-connect');
        cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
            console.timeEnd('mongoose-connect');
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        console.error("❌ MONGODB CONNECTION ERROR:", e);
        throw new Error(`Failed to connect to MongoDB: ${e instanceof Error ? e.message : String(e)}`);
    }

    return cached.conn;
}

export default dbConnect;
