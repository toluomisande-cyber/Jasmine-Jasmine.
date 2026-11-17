import { Attachment } from '../types/chat';

export const MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024; // 25 MB
export const INLINE_IMAGE_MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export const ALLOWED_MIME_PATTERNS = [
  /^image\/(png|jpeg|jpg|webp|gif)$/i,
  /^application\/pdf$/i,
  /^audio\/(mp3|mpeg|wav|ogg|webm|aac|m4a|mp4)$/i,
  /^video\/mp4$/i,
];

export function isAllowedFileType(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  // If mime type matches
  if (ALLOWED_MIME_PATTERNS.some((pattern) => pattern.test(type))) {
    return true;
  }

  // Fallback extension check
  const allowedExts = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.pdf', '.mp3', '.wav', '.ogg', '.webm', '.m4a', '.mp4'];
  return allowedExts.some((ext) => name.endsWith(ext));
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Extract base64 portion after comma
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      resolve(base64);
    };
    reader.onerror = (err) => reject(err);
    reader.readAsDataURL(file);
  });
}

export async function processFileForAttachment(
  file: File,
  onProgress?: (progress: number) => void
): Promise<Attachment> {
  if (!isAllowedFileType(file)) {
    throw new Error(`File type "${file.type || file.name}" is not supported. Use PNG, JPG, WEBP, GIF, PDF, or audio files.`);
  }

  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error(`File "${file.name}" exceeds the 25 MB maximum upload limit.`);
  }

  const id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `att_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  const previewUrl = URL.createObjectURL(file);
  const isImage = file.type.startsWith('image/');
  const isInline = isImage && file.size <= INLINE_IMAGE_MAX_BYTES;

  if (isInline) {
    onProgress?.(50);
    const base64Data = await fileToBase64(file);
    onProgress?.(100);

    return {
      id,
      name: file.name,
      mimeType: file.type || 'image/png',
      source: 'inline',
      url: previewUrl,
      base64Data,
    };
  }

  // Files API upload via server endpoint
  onProgress?.(20);
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  onProgress?.(80);

  if (!res.ok) {
    let errMessage = 'File upload failed';
    try {
      const errData = await res.json();
      errMessage = errData.error || errMessage;
    } catch {
      errMessage = `Server returned status ${res.status}`;
    }
    throw new Error(errMessage);
  }

  const uploadResult = await res.json();
  onProgress?.(100);

  return {
    id,
    name: file.name,
    mimeType: file.type || uploadResult.mimeType || 'application/octet-stream',
    source: 'files_api',
    url: previewUrl,
    fileUri: uploadResult.fileUri,
    fileName: uploadResult.fileName,
    expiresAt: uploadResult.expiresAt,
  };
}

