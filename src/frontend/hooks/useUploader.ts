/**
 * Chunked Client-Side Encryption & Multi-File / Folder Tree Upload Hook
 */

import { useState } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '../api/client';
import { generateFileKey, wrapFileKey } from '../../crypto/keys';
import { encryptChunk, encryptMetadata, encryptString, CHUNK_SIZE } from '../../crypto/cipher';

export interface UploadProgress {
  fileName: string;
  currentChunk: number;
  totalChunks: number;
  progressPercent: number;
  status: 'encrypting' | 'uploading' | 'completed' | 'error';
  errorMessage?: string;
}

/**
 * Exponential Backoff Fetch Helper (retries up to 3 times on network or 5xx server errors)
 * Delay sequence: 500ms -> 1000ms -> 2000ms
 */
async function fetchWithRetry(url: string, options: RequestInit = {}, maxRetries = 3): Promise<Response> {
  let delay = 500;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(url, options);
      if (res.ok || res.status === 401 || res.status === 400 || res.status === 413) {
        return res;
      }
      if (attempt === maxRetries) return res;
    } catch (err) {
      if (attempt === maxRetries) throw err;
    }
    await new Promise((resolve) => setTimeout(resolve, delay));
    delay *= 2;
  }
  return fetch(url, options);
}

export function useUploader(currentFolderId: string | null = null, onUploadSuccess?: () => void) {
  const { keys } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState<UploadProgress | null>(null);

  const uploadSingleFile = async (file: File, folderId: string | null = currentFolderId) => {
    if (!keys) {
      throw new Error('Vault is locked. Cannot encrypt file.');
    }

    const fileName = file.name;
    const fileSize = file.size;
    const totalChunks = Math.max(1, Math.ceil(fileSize / CHUNK_SIZE));

    setProgress({
      fileName,
      currentChunk: 0,
      totalChunks,
      progressPercent: 0,
      status: 'encrypting',
    });

    // 1. Generate fresh 256-bit random File Key (FK)
    const fileKey = await generateFileKey();

    // 2. Encrypt File Key using File Wrapping Key (FWK)
    const encryptedFileKeyStr = await wrapFileKey(fileKey, keys.fileWrappingKey);

    // 3. Encrypt file name & metadata using Metadata Key (MK)
    const encryptedNameStr = await encryptMetadata(keys.metadataKey, { name: fileName });
    const encryptedMetadataStr = await encryptMetadata(keys.metadataKey, {
      originalName: fileName,
      mimeType: file.type || 'application/octet-stream',
      size: fileSize,
      totalChunks,
      chunkSize: CHUNK_SIZE,
      created: Date.now(),
    });

    // 4. Initialize upload session on Worker backend
    const initRes = await apiRequest<{ uploadId: string; fileId: string; objectId: string }>(
      '/api/uploads/init',
      {
        method: 'POST',
        body: JSON.stringify({
          folder_id: folderId,
          total_chunks: totalChunks,
          encrypted_name: encryptedNameStr,
          encrypted_metadata: encryptedMetadataStr,
          encrypted_file_key: encryptedFileKeyStr,
          size: fileSize,
          mime_type: file.type || 'application/octet-stream',
        }),
      }
    );

    const { uploadId } = initRes;

    // Resumable Session Tracking via sessionStorage
    const resumeStorageKey = `nook_upload_chunks_${uploadId}`;
    let completedChunksSet = new Set<number>();
    try {
      const saved = sessionStorage.getItem(resumeStorageKey);
      if (saved) {
        completedChunksSet = new Set(JSON.parse(saved));
      }
    } catch {}

    // 5. Read, Encrypt, and Upload chunks sequentially
    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      // Skip chunk if already uploaded successfully in this session
      if (completedChunksSet.has(chunkIdx)) {
        setProgress({
          fileName,
          currentChunk: chunkIdx + 1,
          totalChunks,
          progressPercent: Math.min(99, Math.round(((chunkIdx + 1) / totalChunks) * 99)),
          status: 'uploading',
        });
        continue;
      }

      const start = chunkIdx * CHUNK_SIZE;
      const end = Math.min(fileSize, start + CHUNK_SIZE);
      const slice = file.slice(start, end);

      const arrayBuffer = await slice.arrayBuffer();
      const chunkData = new Uint8Array(arrayBuffer);

      setProgress({
        fileName,
        currentChunk: chunkIdx + 1,
        totalChunks,
        progressPercent: Math.min(99, Math.round(((chunkIdx + 0.5) / totalChunks) * 99)),
        status: 'encrypting',
      });

      // Client-side AES-256-GCM chunk encryption
      const encryptedChunk = await encryptChunk(fileKey, chunkIdx, chunkData);

      setProgress({
        fileName,
        currentChunk: chunkIdx + 1,
        totalChunks,
        progressPercent: Math.min(99, Math.round(((chunkIdx + 1) / totalChunks) * 99)),
        status: 'uploading',
      });

      // PUT ciphertext directly to R2 upload endpoint with Exponential Backoff Retry
      const chunkRes = await fetchWithRetry(`/api/uploads/${uploadId}/chunk/${chunkIdx}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/octet-stream',
        },
        credentials: 'same-origin',
        body: encryptedChunk as unknown as BodyInit,
      });

      if (chunkRes.status === 401) {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nook:unauthorized'));
        throw new Error('Unauthorized');
      }
      if (!chunkRes.ok) {
        throw new Error(`Failed to upload chunk ${chunkIdx} (Status ${chunkRes.status})`);
      }

      // Record successful chunk upload in sessionStorage for resume safety
      completedChunksSet.add(chunkIdx);
      try {
        sessionStorage.setItem(resumeStorageKey, JSON.stringify(Array.from(completedChunksSet)));
      } catch {}
    }

    // 6. Complete upload session
    await apiRequest(`/api/uploads/${uploadId}/complete`, { method: 'POST' });

    // Clean up resumable session state on completion
    try {
      sessionStorage.removeItem(resumeStorageKey);
    } catch {}

    setProgress({
      fileName,
      currentChunk: totalChunks,
      totalChunks,
      progressPercent: 100,
      status: 'completed',
    });
  };

  const uploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      await uploadSingleFile(file, currentFolderId);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setProgress({
        fileName: file.name,
        currentChunk: 0,
        totalChunks: 1,
        progressPercent: 0,
        status: 'error',
        errorMessage: err.message || 'Upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const uploadMultipleFiles = async (files: File[] | FileList) => {
    if (!keys) return;
    setIsUploading(true);
    const fileList: File[] = files instanceof FileList ? Array.from(files) : files;
    const totalFiles = fileList.length;

    try {
      let completedCount = 0;
      const processItem = async (file: File) => {
        await uploadSingleFile(file, currentFolderId);
        completedCount++;
        const isFinished = completedCount === totalFiles;
        setProgress({
          fileName: totalFiles === 1 ? file.name : `Encrypting & Uploading (${completedCount}/${totalFiles})`,
          currentChunk: completedCount,
          totalChunks: totalFiles,
          progressPercent: isFinished ? 100 : Math.min(99, Math.round((completedCount / totalFiles) * 99)),
          status: isFinished ? 'completed' : 'uploading',
        });
      };

      // Controlled Concurrency Queue (up to 3 files uploading concurrently)
      const CONCURRENCY_LIMIT = 3;
      const queue = [...fileList];
      const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, queue.length) }, async () => {
        while (queue.length > 0) {
          const file = queue.shift();
          if (file) await processItem(file);
        }
      });

      await Promise.all(workers);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setProgress({
        fileName: 'Multiple Uploads',
        currentChunk: 0,
        totalChunks: 1,
        progressPercent: 0,
        status: 'error',
        errorMessage: err.message || 'Multi-file upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  // Traverses DataTransferItems to recursively process dropped folders and files fast
  const uploadDroppedItems = async (items: DataTransferItemList | FileList | File[]) => {
    if (!keys) return;
    setIsUploading(true);

    try {
      // 1. CRITICAL: Snapshot all entries/files synchronously BEFORE any await calls!
      const entriesToProcess: FileSystemEntry[] = [];
      const directFilesToProcess: File[] = [];

      if (Array.isArray(items)) {
        directFilesToProcess.push(...items);
      } else if (items instanceof FileList) {
        for (let i = 0; i < items.length; i++) {
          directFilesToProcess.push(items[i]);
        }
      } else {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const entry = item.webkitGetAsEntry ? item.webkitGetAsEntry() : null;
          if (entry) {
            entriesToProcess.push(entry);
          } else {
            const file = item.getAsFile();
            if (file) directFilesToProcess.push(file);
          }
        }
      }

      interface DiscoveredFile {
        file: File;
        folderPath: string[];
      }

      const discoveredFiles: DiscoveredFile[] = [];
      const discoveredFolderPaths = new Set<string>();

      const traverseEntry = async (entry: FileSystemEntry, currentPath: string[]) => {
        if (entry.isFile) {
          const fileEntry = entry as FileSystemFileEntry;
          const file = await new Promise<File>((resolve, reject) => {
            fileEntry.file(resolve, reject);
          });
          discoveredFiles.push({ file, folderPath: currentPath });
        } else if (entry.isDirectory) {
          const dirEntry = entry as FileSystemDirectoryEntry;
          const newPath = [...currentPath, dirEntry.name];
          discoveredFolderPaths.add(newPath.join('/'));

          const dirReader = dirEntry.createReader();
          const readBatch = (): Promise<FileSystemEntry[]> =>
            new Promise((resolve, reject) => dirReader.readEntries(resolve, reject));

          let entriesBatch: FileSystemEntry[];
          do {
            entriesBatch = await readBatch();
            for (const child of entriesBatch) {
              await traverseEntry(child, newPath);
            }
          } while (entriesBatch.length > 0);
        }
      };

      // 2. Discover all nested files and folder structure
      for (const entry of entriesToProcess) {
        await traverseEntry(entry, []);
      }

      for (const file of directFilesToProcess) {
        discoveredFiles.push({ file, folderPath: [] });
      }

      // 3. Create folder hierarchy on backend (sorted by depth)
      const createdFolderIdMap = new Map<string, string>();
      const sortedPaths = Array.from(discoveredFolderPaths).sort(
        (a, b) => a.split('/').length - b.split('/').length
      );

      for (const pathStr of sortedPaths) {
        const parts = pathStr.split('/');
        const folderName = parts[parts.length - 1];
        const parentPathStr = parts.slice(0, -1).join('/');
        const parentFolderId = parentPathStr
          ? createdFolderIdMap.get(parentPathStr) || currentFolderId
          : currentFolderId;

        const encryptedFolderName = await encryptString(keys.metadataKey, folderName);
        const res = await apiRequest<{ folder: { id: string } }>('/api/folders', {
          method: 'POST',
          body: JSON.stringify({
            parent_id: parentFolderId,
            encrypted_name: encryptedFolderName,
          }),
        });

        createdFolderIdMap.set(pathStr, res.folder.id);
      }

      // 4. Parallel File Uploads (Controlled Concurrency = 3)
      const totalFiles = discoveredFiles.length;
      let completedCount = 0;

      const processUploadItem = async (item: DiscoveredFile) => {
        const targetFolderId =
          item.folderPath.length > 0
            ? createdFolderIdMap.get(item.folderPath.join('/')) || currentFolderId
            : currentFolderId;

        await uploadSingleFile(item.file, targetFolderId);
        completedCount++;
        const isFinished = completedCount === totalFiles;

        setProgress({
          fileName: totalFiles === 1 ? item.file.name : `Encrypting & Uploading (${completedCount}/${totalFiles})`,
          currentChunk: completedCount,
          totalChunks: totalFiles,
          progressPercent: isFinished ? 100 : Math.min(99, Math.round((completedCount / totalFiles) * 99)),
          status: isFinished ? 'completed' : 'uploading',
        });
      };

      const CONCURRENCY_LIMIT = 3;
      const queue = [...discoveredFiles];
      const workers = Array.from({ length: Math.min(CONCURRENCY_LIMIT, queue.length) }, async () => {
        while (queue.length > 0) {
          const item = queue.shift();
          if (item) await processUploadItem(item);
        }
      });

      await Promise.all(workers);
      if (onUploadSuccess) onUploadSuccess();
    } catch (err: any) {
      setProgress({
        fileName: 'Folder Upload',
        currentChunk: 0,
        totalChunks: 1,
        progressPercent: 0,
        status: 'error',
        errorMessage: err.message || 'Folder upload failed',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const resetProgress = () => setProgress(null);

  return {
    uploadFile,
    uploadMultipleFiles,
    uploadDroppedItems,
    isUploading,
    progress,
    resetProgress,
  };
}
