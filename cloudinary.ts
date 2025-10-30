import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export interface CloudinaryUploadResult {
  public_id: string;
  secure_url: string;
  url: string;
  resource_type: string;
  format: string;
  bytes: number;
}

export class CloudinaryService {
  /**
   * Upload a file buffer to Cloudinary
   */
  async uploadFile(
    fileBuffer: Buffer,
    options: {
      folder?: string;
      resource_type?: 'image' | 'video' | 'raw' | 'auto';
      public_id?: string;
      transformation?: any;
    } = {}
  ): Promise<CloudinaryUploadResult> {
    return new Promise((resolve, reject) => {
      const uploadOptions = {
        folder: options.folder || 'vitecab-documents',
        resource_type: options.resource_type || 'auto',
        public_id: options.public_id,
        transformation: options.transformation,
      };

      cloudinary.uploader.upload_stream(
        uploadOptions,
        (error, result) => {
          if (error) {
            reject(error);
          } else {
            resolve(result as CloudinaryUploadResult);
          }
        }
      ).end(fileBuffer);
    });
  }

  /**
   * Upload driver documents with specific folder structure
   */
  async uploadDriverDocument(
    fileBuffer: Buffer,
    documentType: 'license' | 'registration' | 'insurance' | 'vehicle_photo' | 'driver_photo',
    driverId: string
  ): Promise<CloudinaryUploadResult> {
    const folder = `vitecab-documents/drivers/${driverId}`;
    const public_id = `${documentType}_${Date.now()}`;
    
    return this.uploadFile(fileBuffer, {
      folder,
      public_id,
      resource_type: documentType.includes('photo') ? 'image' : 'auto',
      transformation: documentType.includes('photo') ? [
        { width: 800, height: 600, crop: 'limit' },
        { quality: 'auto:good' }
      ] : undefined
    });
  }

  /**
   * Delete a file from Cloudinary
   */
  async deleteFile(publicId: string): Promise<any> {
    return cloudinary.uploader.destroy(publicId);
  }

  /**
   * Get optimized URL for an image
   */
  getOptimizedUrl(publicId: string, options: any = {}): string {
    return cloudinary.url(publicId, {
      quality: 'auto:good',
      fetch_format: 'auto',
      ...options
    });
  }
}

export const cloudinaryService = new CloudinaryService();