/**
 * Move Item Modal — Nook Editorial Aesthetic
 */

import React, { useState } from 'react';
import { Move, Folder, X } from 'lucide-react';
import { DecryptedFolder } from '../hooks/useVault';

interface MoveModalProps {
  isOpen: boolean;
  folders: DecryptedFolder[];
  onClose: () => void;
  onMove: (targetFolderId: string | null) => Promise<void>;
}

export function MoveModal({ isOpen, folders, onClose, onMove }: MoveModalProps) {
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onMove(selectedFolderId);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0e0d]/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-[#141312] w-full max-w-md border border-[#4b4640] p-6 shadow-2xl space-y-6">
        <div className="flex items-center justify-between pb-4 border-b border-[#4b4640]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0">
              <Move className="w-4 h-4 text-[#cac6c3]" />
            </div>
            <h3 className="font-garamond text-[24px] font-bold text-[#e6e2e0] leading-none">
              Move Item
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#636363] hover:text-[#e6e2e0] transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-space-mono text-[11px] font-bold text-[#636363] uppercase tracking-widest mb-2">
              Select Destination Directory
            </label>
            <div className="space-y-1 max-h-48 overflow-y-auto bg-[#0f0e0d] border border-[#4b4640] p-2 font-space-mono text-[12px]">
              <button
                type="button"
                onClick={() => setSelectedFolderId(null)}
                className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                  selectedFolderId === null ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold' : 'text-[#cdc5bd] hover:bg-[#201f1e]'
                }`}
              >
                <Folder className="w-4 h-4 shrink-0" />
                <span className="truncate">Root Vault Directory</span>
              </button>

              {folders.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setSelectedFolderId(f.id)}
                  className={`w-full text-left px-3 py-2 flex items-center gap-2.5 transition cursor-pointer ${
                    selectedFolderId === f.id ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold' : 'text-[#cdc5bd] hover:bg-[#201f1e]'
                  }`}
                >
                  <Folder className="w-4 h-4 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </button>
              ))}
            </div>
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
              disabled={isSubmitting}
              className="px-6 py-2.5 bg-[#e6e1df] text-[#1d1b1a] hover:bg-[#cac6c3] font-space-mono text-[11px] font-bold uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Moving...' : 'Move Here'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
