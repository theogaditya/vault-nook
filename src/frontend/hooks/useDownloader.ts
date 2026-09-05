/**
 * Chunked Client-Side Decryption & Download / In-App Preview Hook
 */

import { useState } from 'react';
import { useAuth } from './useAuth';
import { DecryptedFile } from './useVault';
import { unwrapFileKey } from '../../crypto/keys';
import { decryptChunk } from '../../crypto/cipher';

export interface DownloadProgress {
  fileName: string;
  currentChunk: number;
  totalChunks: number;
  progressPercent: number;
  status: 'downloading' | 'decrypting' | 'completed' | 'error';
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
      if (res.ok || res.status === 401 || res.status === 400 || res.status === 404) {
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

export function useDownloader() {
  const { keys } = useAuth();
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);

  const getDecryptedBytes = async (file: DecryptedFile): Promise<Uint8Array[]> => {
    if (!keys) {
      throw new Error('Vault is locked. Cannot decrypt file.');
    }

    const totalChunks = file.totalChunks || 1;
    const fileKey = await unwrapFileKey(file.encryptedFileKey, keys.fileWrappingKey);

    const decryptedChunkBuffers: Uint8Array[] = [];

    for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
      setDownloadProgress({
        fileName: file.name,
        currentChunk: chunkIdx + 1,
        totalChunks,
        progressPercent: Math.round(((chunkIdx + 0.5) / totalChunks) * 100),
        status: 'downloading',
      });

      const response = await fetchWithRetry(`/api/files/${file.id}/chunk/${chunkIdx}`, { credentials: 'same-origin' });
      if (response.status === 401) {
        if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('nook:unauthorized'));
        throw new Error('Unauthorized');
      }
      if (!response.ok) {
        throw new Error(`Failed to fetch chunk ${chunkIdx} (Status ${response.status})`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const encryptedChunkPayload = new Uint8Array(arrayBuffer);

      setDownloadProgress({
        fileName: file.name,
        currentChunk: chunkIdx + 1,
        totalChunks,
        progressPercent: Math.round(((chunkIdx + 1) / totalChunks) * 100),
        status: 'decrypting',
      });

      const plaintextChunk = await decryptChunk(fileKey, chunkIdx, encryptedChunkPayload);
      decryptedChunkBuffers.push(plaintextChunk);
    }

    setDownloadProgress({
      fileName: file.name,
      currentChunk: totalChunks,
      totalChunks,
      progressPercent: 100,
      status: 'completed',
    });

    return decryptedChunkBuffers;
  };

  const downloadFile = async (file: DecryptedFile) => {
    setIsDownloading(true);
    try {
      const decryptedChunkBuffers = await getDecryptedBytes(file);
      const blob = new Blob(decryptedChunkBuffers as BlobPart[], { type: file.mimeType });
      const blobUrl = URL.createObjectURL(blob);

      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();

      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
    } catch (err: any) {
      setDownloadProgress({
        fileName: file.name,
        currentChunk: 0,
        totalChunks: 1,
        progressPercent: 0,
        status: 'error',
        errorMessage: err.message || 'Decryption & download failed',
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const fetchDecryptedBlob = async (file: DecryptedFile): Promise<{ blob: Blob; textContent?: string; arrayBuffer: ArrayBuffer }> => {
    setIsDownloading(true);
    try {
      const decryptedChunkBuffers = await getDecryptedBytes(file);
      const blob = new Blob(decryptedChunkBuffers as BlobPart[], { type: file.mimeType || 'application/octet-stream' });
      const arrayBuffer = await blob.arrayBuffer();
      
      let textContent: string | undefined = undefined;
      const ext = file.name.split('.').pop()?.toLowerCase() || '';
      const textualExtensions = [
        'md', 'txt', 'json', 'xml', 'yaml', 'yml', 'html', 'htm', 'csv', 'rtf',
        'log', 'js', 'ts', 'jsx', 'tsx', 'css', 'scss', 'py', 'sql', 'sh', 'env', 'ini', 'conf'
      ];
      const isTextual = textualExtensions.includes(ext) || 
                        file.mimeType.startsWith('text/') || 
                        file.mimeType.includes('json') || 
                        file.mimeType.includes('xml') || 
                        file.mimeType.includes('yaml') ||
                        file.mimeType.includes('csv');

      if (isTextual) {
        textContent = await blob.text();
      }

      return { blob, textContent, arrayBuffer };
    } finally {
      setIsDownloading(false);
    }
  };

  const resetDownloadProgress = () => setDownloadProgress(null);

  return {
    downloadFile,
    fetchDecryptedBlob,
    isDownloading,
    downloadProgress,
    resetDownloadProgress,
  };
}
