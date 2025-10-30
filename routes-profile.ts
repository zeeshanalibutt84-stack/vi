import { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { storage } from './storage';

// Configure multer for file uploads
const uploadDir = path.join(__dirname, '../uploads/profiles');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  },
});

export async function uploadProfilePicture(req: Request, res: Response) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Generate unique filename
    const fileExtension = path.extname(req.file.originalname);
    const filename = `profile_${userId}_${Date.now()}${fileExtension}`;
    const filePath = path.join(uploadDir, filename);
    
    // Move file to permanent location
    fs.renameSync(req.file.path, filePath);
    
    // Generate URL for the uploaded file
    const profileImageUrl = `/uploads/profiles/${filename}`;
    
    // Update user's profile picture in database
    await storage.updateUser(userId, { profileImage: profileImageUrl });
    
    res.json({ 
      message: 'Profile picture uploaded successfully',
      profileImageUrl 
    });
  } catch (error) {
    console.error('Profile picture upload error:', error);
    res.status(500).json({ error: 'Failed to upload profile picture' });
  }
}

export const profilePictureUpload = upload.single('profilePicture');