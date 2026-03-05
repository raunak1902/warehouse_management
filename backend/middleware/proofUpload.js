/**
 * middleware/proofUpload.js
 * ─────────────────────────
 * Multer configuration + Sharp compression for proof file uploads.
 *
 * Strategy:
 *   • Files are stored on local disk under /uploads/proofs/
 *   • Images are compressed with Sharp before saving (saves 60–90% space)
 *   • Videos and PDFs are stored as-is (with server-side size cap)
 *   • Thumbnails (300×300) are generated for images only
 *   • To migrate to S3/R2 later: replace saveFileToDisk() with an S3 putObject call
 *
 * Accepted types: images, videos, PDFs — max 50 MB per file, max 3 files
 */

import multer   from 'multer'
import sharp    from 'sharp'
import path     from 'path'
import fs       from 'fs'
import { v4 as uuid } from 'uuid'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// ── Storage root ──────────────────────────────────────────────────────────────
export const UPLOADS_ROOT  = path.join(__dirname, '..', 'uploads', 'proofs')
export const THUMBS_ROOT   = path.join(__dirname, '..', 'uploads', 'proofs', 'thumbs')

// Ensure directories exist
fs.mkdirSync(UPLOADS_ROOT, { recursive: true })
fs.mkdirSync(THUMBS_ROOT,  { recursive: true })

// ── Constants ─────────────────────────────────────────────────────────────────
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024   // 50 MB
const MAX_FILES           = 3
const ALLOWED_MIMES       = new Set([
  'image/jpeg', 'image/jpg', 'image/png', 'image/webp',
  'image/gif',  'image/avif', 'image/heic', 'image/heif',
  'video/mp4',  'video/quicktime', 'video/webm',
  'video/x-msvideo', 'video/x-matroska', 'video/mp2t',
  'application/pdf',
])

// ── Multer: keep files in memory for processing ───────────────────────────────
export const multerUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files:    MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIMES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(new Error(`File type '${file.mimetype}' is not allowed. Upload images, videos, or PDFs.`))
    }
  },
})

// ── File type classifier ──────────────────────────────────────────────────────
export function classifyMime(mime) {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime === 'application/pdf') return 'pdf'
  return 'other'
}

// ── Determine output extension for images ─────────────────────────────────────
function imageExt(mime) {
  if (mime === 'image/png')  return '.png'
  if (mime === 'image/webp') return '.webp'
  if (mime === 'image/gif')  return '.gif'
  return '.jpg'   // default: compress everything else to JPEG
}

// ── Process and save a single file ───────────────────────────────────────────
/**
 * Processes one multer memory-buffer file:
 *  - Images: compresses with Sharp, saves full + thumbnail
 *  - Videos/PDFs: saves buffer directly
 *
 * Returns: { storedName, url, thumbUrl, sizeKb, fileType }
 */
export async function processAndSaveFile(file) {
  const fileType  = classifyMime(file.mimetype)
  const id        = uuid()

  if (fileType === 'image') {
    // ── Image: compress + thumbnail ─────────────────────────────────────────
    const ext         = imageExt(file.mimetype)
    const storedName  = `${id}${ext}`
    const thumbName   = `thumb_${id}${ext}`
    const fullPath    = path.join(UPLOADS_ROOT, storedName)
    const thumbPath   = path.join(THUMBS_ROOT,  thumbName)

    // Full image — resize to max 1920px wide, quality 82
    const isGif = file.mimetype === 'image/gif'
    const image = sharp(file.buffer, { animated: isGif })

    if (file.mimetype === 'image/png') {
      await image
        .resize({ width: 1920, withoutEnlargement: true })
        .png({ compressionLevel: 8, quality: 85 })
        .toFile(fullPath)
    } else if (file.mimetype === 'image/webp') {
      await image
        .resize({ width: 1920, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toFile(fullPath)
    } else {
      // JPEG / HEIC / AVIF / others → convert to JPEG
      await image
        .resize({ width: 1920, withoutEnlargement: true })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(fullPath)
    }

    // Thumbnail — 300×300 cover crop
    await sharp(file.buffer)
      .resize(300, 300, { fit: 'cover' })
      .jpeg({ quality: 70, mozjpeg: true })
      .toFile(thumbPath)

    const savedSize = fs.statSync(fullPath).size

    return {
      storedName,
      url:      `/uploads/proofs/${storedName}`,
      thumbUrl: `/uploads/proofs/thumbs/thumb_${id}.jpg`,
      sizeKb:   Math.round(savedSize / 1024),
      fileType: 'image',
    }
  }

  // ── Video / PDF: save buffer directly (no processing) ─────────────────────
  const ext        = path.extname(file.originalname).toLowerCase() || (fileType === 'pdf' ? '.pdf' : '.mp4')
  const storedName = `${id}${ext}`
  const fullPath   = path.join(UPLOADS_ROOT, storedName)

  fs.writeFileSync(fullPath, file.buffer)

  return {
    storedName,
    url:      `/uploads/proofs/${storedName}`,
    thumbUrl: null,
    sizeKb:   Math.round(file.buffer.length / 1024),
    fileType,
  }
}