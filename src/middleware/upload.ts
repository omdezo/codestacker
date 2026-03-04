import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

const UPLOAD_DIR = process.env.UPLOAD_DIR || './uploads';
const MAX_FILE_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10);

// Ensure upload directories exist
const idImageDir = path.join(UPLOAD_DIR, 'id-images');
const attachmentDir = path.join(UPLOAD_DIR, 'attachments');
[idImageDir, attachmentDir].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

function storage(subDir: string) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => {
      cb(null, path.join(UPLOAD_DIR, subDir));
    },
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });
}

function imageFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowed = /jpeg|jpg|png|gif|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed (jpeg, jpg, png, gif, webp).'));
  }
}

function attachmentFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
  const allowedExt = /jpeg|jpg|png|gif|webp|pdf/;
  const allowedMime = /image\/(jpeg|jpg|png|gif|webp)|application\/pdf/;
  const ext = allowedExt.test(path.extname(file.originalname).toLowerCase());
  const mime = allowedMime.test(file.mimetype);
  if (ext && mime) {
    cb(null, true);
  } else {
    cb(new Error('Only images and PDF files are allowed.'));
  }
}

export const uploadIdImage = multer({
  storage: storage('id-images'),
  fileFilter: imageFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
}).single('idImage');

export const uploadAttachment = multer({
  storage: storage('attachments'),
  fileFilter: attachmentFilter,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
}).single('attachment');
