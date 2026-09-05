/**
 * Streaming Cryptographic Progress Overlay — Nook Editorial Aesthetic
 */

import React from 'react';
import { Lock, CheckCircle2, AlertCircle, X, Download } from 'lucide-react';

export interface GenericProgressState {
  fileName: string;
  currentChunk: number;
  totalChunks: number;
  progressPercent: number;
  status: 'encrypting' | 'uploading' | 'downloading' | 'decrypting' | 'completed' | 'error';
  errorMessage?: string;
}

interface UploadModalProps {
  progress: GenericProgressState | null;
  onClose: () => void;
  label?: string; // e.g. 'Upload' | 'Download' — shown as a badge to distinguish simultaneous modals
}

export function UploadModal({ progress, onClose, label }: UploadModalProps) {
  if (!progress) return null;

  const isDownload = progress.status === 'downloading' || progress.status === 'decrypting';

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0e0d]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141312] w-full max-w-md border border-[#4b4640] p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#4b4640]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0">
              {isDownload ? <Download className="w-4 h-4 text-[#cac6c3]" /> : <Lock className="w-4 h-4 text-[#cac6c3]" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-garamond text-[20px] font-bold text-[#e6e2e0] leading-none">
                  {isDownload ? 'Decrypting & Downloading' : 'Encrypting & Uploading'}
                </h3>
                {label && (
                  <span className="font-space-mono text-[9px] font-bold tracking-widest uppercase border border-[#4b4640] text-[#636363] px-1.5 py-0.5">
                    {label}
                  </span>
                )}
              </div>
              <p className="font-space-mono text-[10px] text-[#cdc5bd] truncate max-w-[200px] mt-1">{progress.fileName}</p>
            </div>
          </div>
          {progress.status === 'completed' || progress.status === 'error' ? (
            <button
              onClick={onClose}
              className="p-1 text-[#636363] hover:text-[#e6e2e0] transition cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Progress Bar & Percentage Completed Indicator */}
        {(() => {
          const displayPercent = progress.status === 'completed' ? 100 : Math.min(99, progress.progressPercent);
          return (
            <div className="space-y-3 font-space-mono text-[11px]">
              <div className="flex items-center justify-between text-[#cdc5bd] gap-2">
                <span className="truncate">
                  {progress.status === 'encrypting' && 'Encrypting AES-256-GCM chunks...'}
                  {progress.status === 'uploading' && `Uploading chunk ${progress.currentChunk} of ${progress.totalChunks}`}
                  {progress.status === 'downloading' && `Downloading chunk ${progress.currentChunk} of ${progress.totalChunks}`}
                  {progress.status === 'decrypting' && 'Decrypting chunk payload...'}
                  {progress.status === 'completed' && (isDownload ? 'Decryption Complete!' : 'Upload Complete!')}
                  {progress.status === 'error' && 'Operation Failed'}
                </span>
                <span className="font-bold text-[#EAB308] bg-[#1c1b19] border border-[#4b4640] px-2 py-0.5 shrink-0 text-[11px]">
                  {displayPercent}% Completed
                </span>
              </div>

              <div className="relative w-full h-2.5 bg-[#0f0e0d] border border-[#4b4640] overflow-hidden rounded-sm">
                <div
                  className={`h-full transition-all duration-300 ${
                    progress.status === 'error'
                      ? 'bg-[#ffb4ab]'
                      : progress.status === 'completed'
                      ? 'bg-[#a5d6a7]'
                      : 'bg-[#EAB308]'
                  }`}
                  style={{ width: `${displayPercent}%` }}
                />
              </div>
            </div>
          );
        })()}

        {/* Error State */}
        {progress.status === 'error' && (
          <div className="p-3 border border-[#ffb4ab]/30 bg-[#93000a]/20 font-space-mono text-[11px] text-[#ffb4ab] flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{progress.errorMessage || 'An error occurred during operation'}</span>
          </div>
        )}

        {/* Success State */}
        {progress.status === 'completed' && (
          <div className="p-3 border border-[#a5d6a7]/40 bg-[#a5d6a7]/10 font-space-mono text-[11px] text-[#a5d6a7] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              {isDownload
                ? 'File decrypted in browser memory and saved to your device.'
                : 'File encrypted client-side and stored securely in zero-knowledge vault.'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
