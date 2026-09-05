/**
 * Create Folder Modal — Nook Editorial Aesthetic
 */

import React, { useState } from 'react';
import { FolderPlus, X } from 'lucide-react';

interface CreateFolderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (folderName: string) => Promise<void>;
}

export function CreateFolderModal({ isOpen, onClose, onCreate }: CreateFolderModalProps) {
  const [folderName, setFolderName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderName.trim()) return;
    setIsSubmitting(true);
    try {
      await onCreate(folderName.trim());
      setFolderName('');
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0e0d]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141312] w-full max-w-md border border-[#4b4640] p-6 shadow-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#4b4640]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0">
              <FolderPlus className="w-4 h-4 text-[#cac6c3]" />
            </div>
            <h3 className="font-garamond text-[24px] font-bold text-[#e6e2e0] leading-none">
              Create Encrypted Folder
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-[#636363] hover:text-[#e6e2e0] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-space-mono text-[11px] font-bold text-[#636363] uppercase tracking-widest mb-2">
              Folder Name
            </label>
            <input
              type="text"
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="e.g. Financial Documents"
              autoFocus
              className="w-full bg-[#0f0e0d] border border-[#4b4640] px-4 py-3 font-space-mono text-[13px] text-[#e6e2e0] placeholder-[#636363] focus:outline-none focus:border-[#cac6c3] transition-colors"
            />
            <p className="font-space-mono text-[11px] text-[#636363] mt-2">
              Folder names are zero-knowledge encrypted client-side before upload.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 font-space-mono text-[11px] text-[#cdc5bd] hover:text-[#e6e2e0] uppercase tracking-widest transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !folderName.trim()}
              className="px-6 py-2.5 bg-[#e6e1df] text-[#1d1b1a] hover:bg-[#cac6c3] font-space-mono text-[11px] font-bold uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Folder'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
