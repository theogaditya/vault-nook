/**
 * File & Folder List View — Nook Editorial Design
 */

import React from 'react';
import { Folder, Download, Edit3, Move, Trash2 } from 'lucide-react';
import { DecryptedFolder, DecryptedFile } from '../hooks/useVault';
import { formatBytes, getFileIcon } from './FileGrid';

interface FileListProps {
  folders: DecryptedFolder[];
  files: DecryptedFile[];
  onOpenFolder: (folderId: string, folderName: string) => void;
  onPreviewFile: (file: DecryptedFile) => void;
  onDownloadFile: (file: DecryptedFile) => void;
  onRenameFolder: (folder: DecryptedFolder) => void;
  onDeleteFolder: (folderId: string) => void;
  onRenameFile: (file: DecryptedFile) => void;
  onMoveFile: (file: DecryptedFile) => void;
  onDeleteFile: (fileId: string) => void;
}

export function FileList({
  folders,
  files,
  onOpenFolder,
  onPreviewFile,
  onDownloadFile,
  onRenameFolder,
  onDeleteFolder,
  onRenameFile,
  onMoveFile,
  onDeleteFile,
}: FileListProps) {
  return (
    <div className="border border-[#4b4640] overflow-hidden">
      {/* Table Header */}
      <div className="grid grid-cols-12 border-b border-[#4b4640] bg-[#0f0e0d] px-3 sm:px-5 py-3">
        <div className="col-span-7 sm:col-span-5 font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase">Name</div>
        <div className="col-span-2 font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase hidden sm:block">Type</div>
        <div className="col-span-2 font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase hidden md:block">Size</div>
        <div className="col-span-1 font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase hidden lg:block">Date</div>
        <div className="col-span-5 sm:col-span-2 font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase text-right">Actions</div>
      </div>

      <div className="divide-y divide-[#4b4640]">
        {/* Folders */}
        {folders.map((folder) => (
          <div
            key={folder.id}
            onClick={() => onOpenFolder(folder.id, folder.name)}
            className="grid grid-cols-12 items-center px-3 sm:px-5 py-4 hover:bg-[#201f1e] transition-colors cursor-pointer group"
          >
            <div className="col-span-7 sm:col-span-5 flex items-center gap-2 sm:gap-3 min-w-0">
              <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0 group-hover:bg-[#e6e1df] group-hover:border-[#e6e1df] transition-colors">
                <Folder className="w-4 h-4 text-[#cac6c3] group-hover:text-[#1d1b1a]" />
              </div>
              <span className="font-sans text-[13px] sm:text-[14px] font-bold text-[#e6e2e0] truncate group-hover:text-[#cac6c3] transition-colors">
                {folder.name}
              </span>
            </div>
            <div className="col-span-2 font-space-mono text-[12px] text-[#636363] hidden sm:block">Folder</div>
            <div className="col-span-2 font-space-mono text-[12px] text-[#636363] hidden md:block">—</div>
            <div className="col-span-1 font-space-mono text-[12px] text-[#636363] hidden lg:block">
              {new Date(folder.createdAt).toLocaleDateString()}
            </div>
            <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onRenameFolder(folder)}
                className="p-1.5 text-[#636363] hover:text-[#e6e2e0] transition-colors cursor-pointer"
                title="Rename"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteFolder(folder.id)}
                className="p-1.5 text-[#636363] hover:text-[#ffb4ab] transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {/* Files */}
        {files.map((file) => (
          <div
            key={file.id}
            className="grid grid-cols-12 items-center px-3 sm:px-5 py-4 hover:bg-[#201f1e] transition-colors cursor-pointer group"
          >
            <div
              className="col-span-7 sm:col-span-5 flex items-center gap-2 sm:gap-3 min-w-0"
              onClick={() => onPreviewFile(file)}
            >
              <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0 group-hover:bg-[#e6e1df] group-hover:border-[#e6e1df] transition-colors">
                {getFileIcon(file.mimeType)}
              </div>
              <span className="font-sans text-[13px] sm:text-[14px] font-bold text-[#e6e2e0] truncate group-hover:text-[#90caf9] transition-colors">
                {file.name}
              </span>
            </div>
            <div className="col-span-2 font-space-mono text-[12px] text-[#636363] truncate hidden sm:block">
              {file.mimeType.split('/')[1]?.toUpperCase() || '—'}
            </div>
            <div className="col-span-2 font-space-mono text-[12px] text-[#636363] hidden md:block">
              {formatBytes(file.size)}
            </div>
            <div className="col-span-1 font-space-mono text-[12px] text-[#636363] hidden lg:block">
              {new Date(file.createdAt).toLocaleDateString()}
            </div>
            <div className="col-span-5 sm:col-span-2 flex items-center justify-end gap-0.5 sm:gap-1" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onDownloadFile(file)}
                className="p-1.5 text-[#636363] hover:text-[#e6e2e0] transition-colors cursor-pointer"
                title="Download"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onRenameFile(file)}
                className="p-1.5 text-[#636363] hover:text-[#e6e2e0] transition-colors cursor-pointer"
                title="Rename"
              >
                <Edit3 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onMoveFile(file)}
                className="p-1.5 text-[#636363] hover:text-[#e6e2e0] transition-colors cursor-pointer hidden sm:block"
                title="Move"
              >
                <Move className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => onDeleteFile(file.id)}
                className="p-1.5 text-[#636363] hover:text-[#ffb4ab] transition-colors cursor-pointer"
                title="Delete"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
