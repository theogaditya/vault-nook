/**
 * Rename Item Modal — Nook Editorial Aesthetic
 */

import React, { useState, useEffect } from 'react';
import { Edit3, X } from 'lucide-react';

interface RenameModalProps {
  isOpen: boolean;
  initialName: string;
  onClose: () => void;
  onRename: (newName: string) => Promise<void>;
}

export function RenameModal({ isOpen, initialName, onClose, onRename }: RenameModalProps) {
  const [name, setName] = useState(initialName);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setName(initialName);
  }, [initialName]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setIsSubmitting(true);
    try {
      await onRename(name.trim());
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
              <Edit3 className="w-4 h-4 text-[#cac6c3]" />
            </div>
            <h3 className="font-garamond text-[24px] font-bold text-[#e6e2e0] leading-none">
              Rename Item
            </h3>
          </div>
          <button onClick={onClose} className="p-1 text-[#636363] hover:text-[#e6e2e0] transition cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block font-space-mono text-[11px] font-bold text-[#636363] uppercase tracking-widest mb-2">
              New Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              className="w-full bg-[#0f0e0d] border border-[#4b4640] px-4 py-3 font-space-mono text-[13px] text-[#e6e2e0] focus:outline-none focus:border-[#cac6c3] transition-colors"
            />
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
              disabled={isSubmitting || !name.trim()}
              className="px-6 py-2.5 bg-[#e6e1df] text-[#1d1b1a] hover:bg-[#cac6c3] font-space-mono text-[11px] font-bold uppercase tracking-widest transition cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : 'Rename'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
