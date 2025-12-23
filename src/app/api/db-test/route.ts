import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongoose';
import mongoose from 'mongoose';

export async function GET() {
    try {
        await dbConnect();

        // Basic connection check
        const isConnected = mongoose.connection.readyState === 1;

        return NextResponse.json({
            success: true,
            status: isConnected ? 'Connected' : 'Disconnected',
            database: mongoose.connection.name,
        });
    } catch (error: any) {
        console.error('Database connection error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
        }, { status: 500 });
    }
}
