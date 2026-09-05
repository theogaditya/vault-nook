/**
 * Top Navbar with Nook Editorial Aesthetic
 * Logo, Search Bar, View Mode Toggle, Action Buttons & Profile Dropdown
 */

import React, { useState } from 'react';
import { Search, Shield, Lock, LogOut, ChevronRight, Home, Key, Trash2, User, Copy, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

interface NavbarProps {
  breadcrumbs: BreadcrumbItem[];
  onNavigateBreadcrumb: (id: string | null) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onOpenRecoveryModal: () => void;
}

export function Navbar({
  breadcrumbs,
  onNavigateBreadcrumb,
  searchQuery,
  onSearchChange,
  onOpenRecoveryModal,
}: NavbarProps) {
  const { logout, deleteAccount, user } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassphrase, setDeletePassphrase] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const handleCopyVaultId = async () => {
    if (!user?.id) return;
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(user.id);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = user.id;
        textarea.style.position = 'fixed';
        textarea.style.left = '-9999px';
        textarea.style.top = '-9999px';
        document.body.appendChild(textarea);
        textarea.focus();
        textarea.select();
        success = document.execCommand('copy');
        document.body.removeChild(textarea);
      } catch (e) {
        console.error('Fallback copy failed', e);
      }
    }
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const handleConfirmDeleteAccount = async () => {
    if (!deletePassphrase) return;
    setIsDeleting(true);
    setDeleteError('');
    try {
      await deleteAccount(deletePassphrase);
      setShowDeleteConfirm(false);
      setDeletePassphrase('');
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete account.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <header className="w-full bg-[#141312] border-b border-[#4b4640] z-50 shrink-0">
      <div className="flex justify-between items-center w-full px-3 sm:px-6 md:px-10 py-3 sm:py-4 max-w-screen-2xl mx-auto gap-2 sm:gap-4">
        {/* Brand & Breadcrumbs */}
        <div className="flex items-center gap-2 sm:gap-6 shrink-0 min-w-0">
          <span
            onClick={() => onNavigateBreadcrumb(null)}
            className="font-garamond text-[22px] sm:text-[28px] tracking-tighter text-[#e6e2e0] cursor-pointer flex items-center gap-2 leading-none shrink-0"
          >
            NOOK
          </span>

          {breadcrumbs.length > 0 && (
            <nav className="flex items-center gap-1 overflow-x-auto text-[11px] sm:text-[12px] font-space-mono text-[#cdc5bd] no-scrollbar">
              <span className="text-[#4b4640]">/</span>
              {breadcrumbs.map((b, idx) => (
                <React.Fragment key={b.id || idx}>
                  <button
                    onClick={() => onNavigateBreadcrumb(b.id)}
                    className={`hover:text-[#e6e2e0] transition-colors cursor-pointer truncate max-w-[50px] sm:max-w-[140px] ${
                      idx === breadcrumbs.length - 1 ? 'text-[#e6e2e0] font-bold' : 'text-[#cdc5bd]'
                    }`}
                  >
                    {b.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && <span className="text-[#4b4640]">/</span>}
                </React.Fragment>
              ))}
            </nav>
          )}
        </div>

        {/* Search Bar */}
        <div className="flex-1 min-w-[100px] sm:min-w-[160px] max-w-xs sm:max-w-md mx-1 sm:mx-2 relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-[#cdc5bd]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search..."
            className="w-full bg-[#0f0e0d] border border-[#4b4640] text-[#e6e2e0] font-space-mono text-[11px] sm:text-[13px] py-1.5 sm:py-2 pl-7 sm:pl-10 pr-2 sm:pr-3 focus:outline-none focus:border-[#cac6c3] transition-colors placeholder-[#64748b] rounded-sm"
          />
        </div>

        {/* Right Actions & Profile Dropdown */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          <div className="relative">
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="p-1.5 sm:p-2 border border-[#4b4640] hover:border-[#cac6c3] text-[#e6e2e0] transition-colors cursor-pointer flex items-center justify-center rounded-full touch-manipulation"
              title="Account Menu"
            >
              <User className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
            </button>

            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-1.5rem)] bg-[#141312] border border-[#4b4640] p-2 shadow-2xl z-50 rounded">
                <div className="px-3 py-2 border-b border-[#4b4640] mb-1 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-garamond text-[16px] font-bold text-[#e6e2e0]">Nook Vault</p>
                    <p className="font-space-mono text-[11px] text-[#cdc5bd] truncate" title={user?.id}>ID: {user?.id}</p>
                  </div>
                  <button
                    onClick={handleCopyVaultId}
                    className="p-1.5 text-[#cdc5bd] hover:text-[#EAB308] transition cursor-pointer border border-[#4b4640] hover:border-[#EAB308]/40 shrink-0 flex items-center gap-1 font-space-mono text-[10px]"
                    title="Copy Vault ID"
                  >
                    {copiedId ? <CheckCircle2 className="w-3.5 h-3.5 text-[#a5d6a7]" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedId ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>

                <button
                  onClick={() => {
                    setShowProfileMenu(false);
                    onOpenRecoveryModal();
                  }}
                  className="w-full text-left px-3 py-2 font-space-mono text-[12px] text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e] flex items-center gap-2 transition cursor-pointer"
                >
                  <Key className="w-4 h-4 text-[#EAB308]" />
                  <span>Recovery Kit Setup</span>
                </button>

                <div className="pt-1 mt-1 border-t border-[#4b4640] space-y-1">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setShowLogoutConfirm(true);
                    }}
                    className="w-full text-left px-3 py-2 font-space-mono text-[12px] text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e] flex items-center gap-2 transition cursor-pointer"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>Lock & Logout</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      setDeletePassphrase('');
                      setDeleteError('');
                      setShowDeleteConfirm(true);
                    }}
                    className="w-full text-left px-3 py-2 font-space-mono text-[12px] text-[#ffb4ab] hover:bg-[#93000a]/20 flex items-center gap-2 transition cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>Delete Account</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Logout Confirmation Modal Popup */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[9999] bg-[#0f0e0d]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141312] border border-[#4b4640] p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 rounded">
            <div className="w-12 h-12 border border-[#4b4640] bg-[#0f0e0d] flex items-center justify-center mx-auto text-[#cdc5bd]">
              <LogOut className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-garamond text-[24px] sm:text-[28px] text-[#e6e2e0] leading-tight font-bold">
                Lock Vault & Logout?
              </h3>
              <p className="font-sans text-[13px] sm:text-[14px] text-[#cdc5bd] leading-relaxed">
                Your active session, local encryption key cache, and browser storage will be safely wiped.
              </p>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="flex-1 py-3 border border-[#4b4640] text-[#cdc5bd] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:border-[#e6e2e0] hover:text-[#e6e2e0] cursor-pointer transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={async () => {
                  setIsLoggingOut(true);
                  try {
                    await logout();
                  } finally {
                    setIsLoggingOut(false);
                    setShowLogoutConfirm(false);
                  }
                }}
                disabled={isLoggingOut}
                className="flex-1 py-3 bg-[#e6e1df] text-[#1d1b1a] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#cac6c3] cursor-pointer transition-colors disabled:opacity-50"
              >
                {isLoggingOut ? 'Locking...' : 'Lock & Logout'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal Popup with Passphrase Entry */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[9999] bg-[#0f0e0d]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141312] border border-[#ffb4ab]/40 p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5 rounded">
            <div className="w-12 h-12 border border-[#ffb4ab]/40 bg-[#93000a]/20 flex items-center justify-center mx-auto text-[#ffb4ab]">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="font-garamond text-[24px] sm:text-[28px] text-[#ffb4ab] leading-tight font-bold">
                Delete Nook Account?
              </h3>
              <p className="font-sans text-[13px] sm:text-[14px] text-[#cdc5bd] leading-relaxed">
                ALL your encrypted files, folders, and cryptographic keys will be permanently destroyed. This action <strong className="text-[#ffb4ab]">CANNOT</strong> be undone.
              </p>
            </div>

            {deleteError && (
              <div className="p-3 bg-[#93000a]/20 border border-[#ffb4ab]/30 text-[#ffb4ab] font-space-mono text-[12px] rounded text-center">
                {deleteError}
              </div>
            )}

            <div className="space-y-1.5 text-left">
              <label className="font-space-mono text-[11px] font-bold text-[#cdc5bd] uppercase tracking-wider block">
                Enter Passphrase to Confirm:
              </label>
              <input
                type="password"
                placeholder="Vault Passphrase"
                value={deletePassphrase}
                onChange={(e) => {
                  setDeletePassphrase(e.target.value);
                  setDeleteError('');
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && deletePassphrase && !isDeleting) {
                    void handleConfirmDeleteAccount();
                  }
                }}
                className="w-full bg-[#0f0e0d] border border-[#4b4640] text-[#e6e2e0] px-3.5 py-2.5 rounded font-sans text-[14px] focus:outline-none focus:border-[#ffb4ab] transition-colors placeholder-[#64748b]"
                autoFocus
              />
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeletePassphrase('');
                  setDeleteError('');
                }}
                disabled={isDeleting}
                className="flex-1 py-3 border border-[#4b4640] text-[#cdc5bd] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:border-[#e6e2e0] hover:text-[#e6e2e0] cursor-pointer transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleConfirmDeleteAccount}
                disabled={!deletePassphrase || isDeleting}
                className="flex-1 py-3 bg-[#93000a] text-[#ffb4ab] border border-[#ffb4ab]/40 font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#b3261e] hover:text-white cursor-pointer transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
