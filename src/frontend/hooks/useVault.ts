/**
 * Vault File Explorer & Navigation Hook
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from './useAuth';
import { apiRequest } from '../api/client';
import { decryptString, encryptString, decryptMetadata, encryptMetadata } from '../../crypto/cipher';

export interface DecryptedFolder {
  id: string;
  parentId?: string | null;
  name: string;
  createdAt: number;
}

export interface DecryptedFile {
  id: string;
  folderId?: string | null;
  objectId: string;
  name: string;
  mimeType: string;
  size: number;
  encryptedFileKey: string;
  totalChunks?: number;
  createdAt: number;
}

async function decryptFolders(rawFolders: any[], metadataKey: CryptoKey): Promise<DecryptedFolder[]> {
  return Promise.all(
    rawFolders.map(async (f: any) => {
      let name = 'Encrypted Folder';
      try {
        name = await decryptString(metadataKey, f.encrypted_name);
      } catch {
        name = '[Decryption Error]';
      }
      return {
        id: f.id,
        parentId: f.parent_id,
        name,
        createdAt: f.created_at,
      };
    })
  );
}

async function decryptFiles(rawFiles: any[], metadataKey: CryptoKey): Promise<DecryptedFile[]> {
  return Promise.all(
    rawFiles.map(async (file: any) => {
      let name = 'Encrypted File';
      let mimeType = file.mime_type || 'application/octet-stream';
      let totalChunks = 1;
      let size = file.size;

      try {
        const meta = await decryptMetadata(metadataKey, file.encrypted_metadata);
        name = meta.originalName || name;
        mimeType = meta.mimeType || mimeType;
        totalChunks = meta.totalChunks || 1;
        size = typeof meta.size === 'number' ? meta.size : size;
      } catch {
        try {
          name = await decryptString(metadataKey, file.encrypted_name);
        } catch {}
      }

      return {
        id: file.id,
        folderId: file.folder_id,
        objectId: file.object_id,
        name,
        mimeType,
        size,
        encryptedFileKey: file.encrypted_file_key,
        totalChunks,
        createdAt: file.created_at,
      };
    })
  );
}

export function useVault(currentFolderId: string | null = null, rootSearchQuery = '') {
  const { keys, isUnlocked, refreshUser } = useAuth();
  const [folders, setFolders] = useState<DecryptedFolder[]>([]);
  const [files, setFiles] = useState<DecryptedFile[]>([]);
  const [searchFiles, setSearchFiles] = useState<DecryptedFile[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Debounced search query — 400ms delay to avoid fetching on every keystroke
  const [debouncedSearch, setDebouncedSearch] = useState(rootSearchQuery);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
    searchDebounceRef.current = setTimeout(() => setDebouncedSearch(rootSearchQuery), 400);
    return () => { if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current); };
  }, [rootSearchQuery]);

  const fetchVaultContent = useCallback(async () => {
    if (!isUnlocked || !keys) return;
    setLoading(true);
    setError(null);

    try {
      // 1. Fetch raw folders from Worker
      const folderRes = await apiRequest(`/api/folders?parentId=${currentFolderId || ''}`);
      const rawFolders = folderRes.folders || [];

      // 2. Decrypt folder names client-side with Metadata Key
      const decryptedFolders = await decryptFolders(rawFolders, keys.metadataKey);

      // 3. Fetch raw files from Worker
      const fileRes = await apiRequest(`/api/files?folderId=${currentFolderId || ''}`);
      const rawFiles = fileRes.files || [];

      // 4. Decrypt file names & metadata envelope client-side with Metadata Key
      const decryptedFiles = await decryptFiles(rawFiles, keys.metadataKey);

      // 5. Vault-wide search — only when at root AND search query is present (debounced)
      let decryptedSearchFiles: DecryptedFile[] = [];
      if (currentFolderId === null && debouncedSearch.trim()) {
        const searchFileRes = await apiRequest('/api/files');
        decryptedSearchFiles = await decryptFiles(searchFileRes.files || [], keys.metadataKey);
      }

      setFolders(decryptedFolders);
      setFiles(decryptedFiles);
      setSearchFiles(decryptedSearchFiles);

      // Refresh storage quota in real-time
      void refreshUser();
    } catch (err: any) {
      setError(err.message || 'Failed to load vault content');
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, isUnlocked, keys, debouncedSearch]);

  useEffect(() => {
    fetchVaultContent();
  }, [fetchVaultContent]);

  // Create new folder with client-side name encryption
  const createFolder = async (folderName: string) => {
    if (!keys) return;
    const encryptedName = await encryptString(keys.metadataKey, folderName);
    await apiRequest('/api/folders', {
      method: 'POST',
      body: JSON.stringify({
        parent_id: currentFolderId,
        encrypted_name: encryptedName,
      }),
    });
    await fetchVaultContent();
  };

  // Rename folder
  const renameFolder = async (folderId: string, newName: string) => {
    if (!keys) return;
    const encryptedName = await encryptString(keys.metadataKey, newName);
    await apiRequest(`/api/folders/${folderId}`, {
      method: 'PATCH',
      body: JSON.stringify({ encrypted_name: encryptedName }),
    });
    await fetchVaultContent();
  };

  // Delete folder
  const deleteFolder = async (folderId: string) => {
    await apiRequest(`/api/folders/${folderId}`, { method: 'DELETE' });
    await fetchVaultContent();
  };

  // Rename file — updates BOTH encrypted_name and encrypted_metadata.originalName
  const renameFile = async (fileId: string, newName: string, file: DecryptedFile) => {
    if (!keys) return;
    const encryptedName = await encryptString(keys.metadataKey, newName);
    const updatedEncryptedMetadata = await encryptMetadata(keys.metadataKey, {
      originalName: newName,
      mimeType: file.mimeType,
      size: file.size,
      totalChunks: file.totalChunks ?? 1,
      chunkSize: 5 * 1024 * 1024,
      created: file.createdAt,
    });
    await apiRequest(`/api/files/${fileId}`, {
      method: 'PATCH',
      body: JSON.stringify({
        encrypted_name: encryptedName,
        encrypted_metadata: updatedEncryptedMetadata,
      }),
    });
    await fetchVaultContent();
  };

  // Move item (file or folder)
  const moveItem = async (itemId: string, targetFolderId: string | null, type: 'file' | 'folder') => {
    const endpoint = type === 'file' ? `/api/files/${itemId}` : `/api/folders/${itemId}`;
    const payload = type === 'file' ? { folder_id: targetFolderId } : { parent_id: targetFolderId };
    await apiRequest(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
    await fetchVaultContent();
  };

  // Delete file
  const deleteFile = async (fileId: string) => {
    await apiRequest(`/api/files/${fileId}`, { method: 'DELETE' });
    await fetchVaultContent();
  };

  return {
    folders,
    files,
    searchFiles,
    loading,
    error,
    refresh: fetchVaultContent,
    createFolder,
    renameFolder,
    deleteFolder,
    renameFile,
    moveItem,
    deleteFile,
  };
}
