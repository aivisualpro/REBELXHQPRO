import { NextResponse } from 'next/server';
import { uploadImage } from '@/lib/cloudinary';

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file');

        if (!file || !(file instanceof File)) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const fileBase64 = `data:${file.type};base64,${buffer.toString('base64')}`;

        const result = await uploadImage(fileBase64);

        return NextResponse.json({
            success: true,
            publicId: result.public_id,
            url: result.secure_url,
        });
    } catch (error) {
        console.error('Upload API error:', error);
        return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
    }
}
