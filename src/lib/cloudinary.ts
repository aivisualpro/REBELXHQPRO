import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
});

export default cloudinary;

/**
 * Uploads an image to Cloudinary
 * @param file Path or buffer or base64 string
 * @param folder Optional folder name
 * @returns Upload result
 */
export const uploadImage = async (file: string, folder?: string) => {
    try {
        const result = await cloudinary.uploader.upload(file, {
            folder: folder || 'rebelx-headquarters',
            resource_type: 'auto',
        });
        return result;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        throw error;
    }
};

/**
 * Generates an optimized URL for a Cloudinary image
 * @param publicId The public ID of the image
 * @returns Optimized URL string
 */
export const getOptimizedUrl = (publicId: string) => {
    return cloudinary.url(publicId, {
        fetch_format: 'auto',
        quality: 'auto'
    });
};

/**
 * Generates a cropped thumbnail URL for a Cloudinary image
 * @param publicId The public ID of the image
 * @param width Width of the thumbnail
 * @param height Height of the thumbnail
 * @returns Cropped URL string
 */
export const getThumbnailUrl = (publicId: string, width = 500, height = 500) => {
    return cloudinary.url(publicId, {
        crop: 'auto',
        gravity: 'auto',
        width,
        height,
    });
};
