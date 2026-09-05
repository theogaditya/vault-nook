/**
 * File & Folder Grid Component — Nook Editorial Styling
 */

import React, { useState } from 'react';
import { Folder, FileText, Image, Video, FileCode, Archive, File, Download, Edit3, Move, Trash2, MoreVertical, Eye } from 'lucide-react';
import { DecryptedFolder, DecryptedFile } from '../hooks/useVault';

interface FileGridProps {
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

export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <Image className="w-5 h-5 text-[#a5d6a7]" />;
  if (mimeType.startsWith('video/')) return <Video className="w-5 h-5 text-[#ff80ab]" />;
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('text')) {
    return <FileText className="w-5 h-5 text-[#90caf9]" />;
  }
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('compressed')) {
    return <Archive className="w-5 h-5 text-[#ffcc80]" />;
  }
  if (mimeType.includes('javascript') || mimeType.includes('json') || mimeType.includes('code')) {
    return <FileCode className="w-5 h-5 text-[#80cbc4]" />;
  }
  return <File className="w-5 h-5 text-[#cdc5bd]" />;
}

export function FileGrid({
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
}: FileGridProps) {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4 auto-rows-max w-full">
      {/* Folders */}
      {folders.map((folder) => (
        <div
          key={folder.id}
          className="border border-[#4b4640] bg-[#0f0e0d] p-3 sm:p-4 group hover:border-[#cac6c3] transition-colors cursor-pointer relative flex flex-col aspect-auto min-h-[110px] sm:aspect-[4/3] rounded-lg justify-between touch-manipulation select-none"
          onClick={() => onOpenFolder(folder.id, folder.name)}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center group-hover:bg-[#e6e1df] group-hover:text-[#1d1b1a] transition-colors rounded">
              <Folder className="w-4 h-4 sm:w-5 sm:h-5 text-[#cac6c3] group-hover:text-[#1d1b1a]" />
            </div>
            <div className="relative z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === folder.id ? null : folder.id);
                }}
                className="text-[#cdc5bd] hover:text-[#e6e2e0] p-1.5 sm:p-2 -mr-1 -mt-1 cursor-pointer touch-manipulation"
                title="Folder Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {activeMenuId === folder.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1 w-36 max-w-[calc(100vw-2rem)] bg-[#141312] border border-[#4b4640] rounded p-1 shadow-xl z-30 font-space-mono text-[11px]"
                >
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onRenameFolder(folder);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onDeleteFolder(folder.id);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#93000a]/20 text-[#ffb4ab] flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <h3 className="font-sans text-[13px] sm:text-[15px] font-bold text-[#e6e2e0] mb-0.5 sm:mb-1 truncate">
              {folder.name}
            </h3>
            <div className="flex justify-between items-center">
              <span className="font-space-mono text-[10px] sm:text-[11px] text-[#cdc5bd]">Folder</span>
              <span className="font-space-mono text-[10px] sm:text-[11px] text-[#90caf9] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                Open →
              </span>
            </div>
          </div>
        </div>
      ))}

      {/* Files */}
      {files.map((file) => (
        <div
          key={file.id}
          className="border border-[#4b4640] bg-[#0f0e0d] p-3 sm:p-4 group hover:border-[#cac6c3] transition-colors cursor-pointer relative flex flex-col aspect-auto min-h-[110px] sm:aspect-[4/3] rounded-lg justify-between touch-manipulation select-none"
          onClick={() => onPreviewFile(file)}
        >
          <div className="flex justify-between items-start mb-2 sm:mb-4">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center group-hover:bg-[#e6e1df] group-hover:text-[#1d1b1a] transition-colors rounded">
              {getFileIcon(file.mimeType)}
            </div>
            <div className="relative z-10">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setActiveMenuId(activeMenuId === file.id ? null : file.id);
                }}
                className="text-[#cdc5bd] hover:text-[#e6e2e0] p-1.5 sm:p-2 -mr-1 -mt-1 cursor-pointer touch-manipulation"
                title="File Options"
              >
                <MoreVertical className="w-4 h-4" />
              </button>

              {activeMenuId === file.id && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  className="absolute right-0 mt-1 w-36 max-w-[calc(100vw-2rem)] bg-[#141312] border border-[#4b4640] rounded p-1 shadow-xl z-30 font-space-mono text-[11px]"
                >
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onPreviewFile(file);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-2 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onDownloadFile(file);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onRenameFile(file);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-2 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Rename</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onMoveFile(file);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#201f1e] text-[#cdc5bd] hover:text-[#e6e2e0] flex items-center gap-2 cursor-pointer"
                  >
                    <Move className="w-3.5 h-3.5" />
                    <span>Move</span>
                  </button>
                  <button
                    onClick={() => {
                      setActiveMenuId(null);
                      onDeleteFile(file.id);
                    }}
                    className="w-full text-left px-2.5 py-1.5 hover:bg-[#93000a]/20 text-[#ffb4ab] flex items-center gap-2 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="mt-auto">
            <h3 className="font-sans text-[13px] sm:text-[15px] font-bold text-[#e6e2e0] mb-0.5 sm:mb-1 truncate">
              {file.name}
            </h3>
            <div className="flex justify-between items-center">
              <span className="font-space-mono text-[10px] sm:text-[11px] text-[#cdc5bd]">
                {formatBytes(file.size)}
              </span>
              <span className="font-space-mono text-[10px] sm:text-[11px] text-[#90caf9] sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                View →
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
