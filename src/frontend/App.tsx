/**
 * Nook Main React Application Component
 */

import React, { useState, useRef, useEffect } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import AuthScreen from './components/AuthScreen';
import { LandingPage } from './components/LandingPage';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ToastProvider } from './components/Toast';
import { Navbar, BreadcrumbItem } from './components/Navbar';
import { Sidebar, SidebarTab } from './components/Sidebar';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import { UploadModal } from './components/UploadModal';
import { CreateFolderModal } from './components/CreateFolderModal';
import { RenameModal } from './components/RenameModal';
import { MoveModal } from './components/MoveModal';
import { DeviceManager } from './components/DeviceManager';
import { PasskeyManager } from './components/PasskeyManager';
import { SessionManager } from './components/SessionManager';
import { AuditLogViewer } from './components/AuditLogViewer';
import { RecoveryModal } from './components/RecoveryModal';
import { DocumentViewerModal } from './components/DocumentViewerModal';
import { InfoModal, InfoModalType } from './components/InfoModal';
import { OnboardingTour, hasCompletedTour, markTourCompleted } from './components/OnboardingTour';
import { useVault, DecryptedFolder, DecryptedFile } from './hooks/useVault';
import { useUploader } from './hooks/useUploader';
import { useDownloader } from './hooks/useDownloader';
import { Upload, FolderPlus, Folder, AlertCircle, FileText, RefreshCw, Grid, List } from 'lucide-react';

function VaultMain() {
  const { isAuthenticated, isUnlocked, refreshUser, user } = useAuth();
  const [activeTab, setActiveTab] = useState<SidebarTab>('files');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([]);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals & Preview State
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState<{ item: DecryptedFolder | DecryptedFile; type: 'folder' | 'file' } | null>(null);
  const [moveTarget, setMoveTarget] = useState<DecryptedFile | null>(null);
  const [isRecoveryOpen, setIsRecoveryOpen] = useState(false);
  const [previewFile, setPreviewFile] = useState<DecryptedFile | null>(null);
  const [isCreatingNote, setIsCreatingNote] = useState(false);
  const [showAuthScreen, setShowAuthScreen] = useState(false);
  const [infoModalType, setInfoModalType] = useState<InfoModalType>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Vault Content Hook
  const {
    folders,
    files,
    searchFiles,
    loading,
    error,
    refresh,
    createFolder,
    renameFolder,
    renameFile,
    moveItem,
    deleteFolder,
    deleteFile,
  } = useVault(currentFolderId, searchQuery);

  // Onboarding tour: show once to brand-new accounts
  // Check hasCompletedTour FIRST to avoid re-showing on users whose files are in subfolders
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    if (!isUnlocked || !user?.id || loading) return;

    const tourDone = hasCompletedTour(user.id);
    if (tourDone) {
      setShowTour(false);
      return;
    }

    // Only show for users with no files at all in the vault (root + any nested)
    const isExistingUser = folders.length > 0 || files.length > 0;
    if (isExistingUser) {
      markTourCompleted(user.id);
      setShowTour(false);
      return;
    }

    setShowTour(true);
  }, [isUnlocked, user?.id, loading, folders.length, files.length]);

  // Upload & Download Hooks
  const refreshVaultAndUser = async () => {
    await refresh();
    await refreshUser();
  };

  const { uploadFile, uploadMultipleFiles, uploadDroppedItems, isUploading, progress, resetProgress } = useUploader(
    currentFolderId,
    () => { void refreshVaultAndUser(); }
  );
  const { downloadFile, isDownloading, downloadProgress, resetDownloadProgress } = useDownloader();

  if (!isAuthenticated) {
    const hasLogoutNotice = (() => {
      try {
        return sessionStorage.getItem('nook_logout_popup') === '1';
      } catch {
        return false;
      }
    })();
    if (showAuthScreen || hasLogoutNotice) {
      return <AuthScreen onBack={() => setShowAuthScreen(false)} />;
    }
    return <LandingPage onOpenAuth={() => setShowAuthScreen(true)} />;
  }

  if (!isUnlocked) {
    return <AuthScreen />;
  }

  // Handle Breadcrumb Navigation
  const handleNavigateBreadcrumb = (targetId: string | null) => {
    if (targetId === null) {
      setCurrentFolderId(null);
      setBreadcrumbs([]);
    } else {
      const idx = breadcrumbs.findIndex((b) => b.id === targetId);
      if (idx !== -1) {
        setBreadcrumbs(breadcrumbs.slice(0, idx + 1));
        setCurrentFolderId(targetId);
      }
    }
  };

  const handleOpenFolder = (folderId: string, folderName: string) => {
    setCurrentFolderId(folderId);
    setBreadcrumbs((prev) => [...prev, { id: folderId, name: folderName }]);
  };

  // Handle Multi-File Input Change
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadMultipleFiles(Array.from(e.target.files));
      e.target.value = '';
    }
  };

  // Drag and Drop Upload Handlers for Files and Recursive Folder Trees
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types && (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('public.file-url'))) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      uploadDroppedItems(e.dataTransfer.items);
    } else if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      uploadMultipleFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Filter Files and Folders by Search Query
  const normalizedSearchQuery = searchQuery.trim().toLowerCase();
  const isVaultWideRootSearch = currentFolderId === null && normalizedSearchQuery.length > 0;
  const visibleFiles = isVaultWideRootSearch ? searchFiles : files;

  const filteredFolders = folders.filter((f) =>
    f.name.toLowerCase().includes(normalizedSearchQuery)
  );
  const filteredFiles = visibleFiles.filter((f) =>
    f.name.toLowerCase().includes(normalizedSearchQuery)
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="h-screen w-screen overflow-hidden bg-[#141312] text-[#e6e2e0] flex flex-col font-sans relative"
    >
      <input
        type="file"
        multiple
        ref={fileInputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      <Navbar
        breadcrumbs={breadcrumbs}
        onNavigateBreadcrumb={handleNavigateBreadcrumb}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onOpenRecoveryModal={() => setIsRecoveryOpen(true)}
      />

      <div className="flex flex-col md:flex-row flex-1 overflow-hidden min-h-0">
        <Sidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          filesCount={files.length}
          foldersCount={folders.length}
        />

        <main className="flex-1 flex flex-col bg-[#0e0d0c] overflow-y-auto min-h-0">
          {/* Secondary Header Actions */}
          <div className="w-full border-b border-[#4b4640] px-4 md:px-8 py-3 sm:py-4 flex flex-wrap justify-between items-center bg-[#0f0e0d] gap-3">
            <div className="flex items-center gap-4">
              <span className="font-garamond text-[24px] text-[#e6e2e0]">
                {activeTab === 'files'
                  ? (breadcrumbs.length > 0 ? breadcrumbs[breadcrumbs.length - 1].name : 'Vault Files')
                  : activeTab === 'devices'
                  ? 'Trusted Devices & Sessions'
                  : activeTab === 'passkeys'
                  ? 'Registered Passkeys'
                  : activeTab === 'audit'
                  ? 'Audit Trail'
                  : 'Recovery Kit'}
              </span>
            </div>

            {activeTab === 'files' && (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={refresh}
                  title="Refresh Vault"
                  className="p-2 border border-[#4b4640] text-[#e6e2e0] hover:bg-[#363433] transition-colors flex items-center justify-center rounded-full cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>

                <div className="flex border border-[#4b4640] rounded-full overflow-hidden mr-2">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 flex items-center justify-center border-r border-[#4b4640] cursor-pointer ${
                      viewMode === 'grid' ? 'bg-[#e6e1df] text-[#1d1b1a]' : 'bg-[#0f0e0d] text-[#e6e2e0] hover:bg-[#363433]'
                    }`}
                    title="Grid View"
                  >
                    <Grid className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 flex items-center justify-center cursor-pointer ${
                      viewMode === 'list' ? 'bg-[#e6e1df] text-[#1d1b1a]' : 'bg-[#0f0e0d] text-[#e6e2e0] hover:bg-[#363433]'
                    }`}
                    title="List View"
                  >
                    <List className="w-4 h-4" />
                  </button>
                </div>

                <button
                  onClick={() => setIsCreateFolderOpen(true)}
                  className="px-4 py-2 border border-[#4b4640] text-[#e6e2e0] hover:bg-[#363433] transition-colors font-space-mono text-[11px] font-bold flex items-center gap-2 rounded-full cursor-pointer"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>New Folder</span>
                </button>

                <button
                  onClick={() => setIsCreatingNote(true)}
                  className="px-4 py-2 border border-[#a5d6a7] text-[#a5d6a7] hover:bg-[#a5d6a7] hover:text-[#0e0d0c] transition-colors font-space-mono text-[11px] font-bold flex items-center gap-2 rounded-full cursor-pointer"
                >
                  <FileText className="w-4 h-4" />
                  <span>New Note</span>
                </button>

                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 bg-[#8c9eff] text-[#0e0d0c] hover:bg-[#536dfe] transition-colors font-space-mono text-[11px] font-bold flex items-center gap-2 rounded-full cursor-pointer"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload</span>
                </button>
              </div>
            )}
          </div>

          {/* Canvas Area */}
          <div className="flex-1 p-6 md:p-8 items-start">
            {/* Storage quota warning banner */}
            {user?.storageUsedBytes !== undefined && user?.storageQuotaBytes && (() => {
              const pct = Math.round((user.storageUsedBytes! / user.storageQuotaBytes!) * 100);
              if (pct < 85) return null;
              const isNearFull = pct >= 95;
              return (
                <div className={`mb-4 p-3 border flex items-center gap-3 font-space-mono text-[11px] ${
                  isNearFull
                    ? 'border-[#ffb4ab]/40 bg-[#93000a]/20 text-[#ffb4ab]'
                    : 'border-[#EAB308]/30 bg-[#EAB308]/10 text-[#EAB308]'
                }`}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>
                    {(() => {
                      const quotaMb = Math.round((user.storageQuotaBytes! || 524288000) / (1024 * 1024));
                      const quotaLabel = quotaMb >= 1024 ? `${(quotaMb / 1024).toFixed(0)} GB` : `${quotaMb} MB`;
                      return isNearFull
                        ? `Storage almost full — ${pct}% used. Delete files to free up space.`
                        : `Storage at ${pct}% — approaching your ${quotaLabel} limit.`;
                    })()}
                  </span>
                </div>
              );
            })()}

            {activeTab === 'files' && (
              <div className="space-y-6">
                {error && (
                  <div className="p-4 bg-[#93000a]/20 border border-[#ffb4ab]/30 rounded text-[#ffb4ab] font-space-mono text-[12px] flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                {loading ? (
                  <div className="flex items-center justify-center py-20 font-space-mono text-[13px] text-[#cdc5bd] gap-3">
                    <div className="w-4 h-4 border-2 border-[#EAB308] border-t-transparent rounded-full animate-spin" />
                    <span>Decrypting vault contents...</span>
                  </div>
                ) : filteredFolders.length === 0 && filteredFiles.length === 0 ? (
                  <div className="text-center py-20 border border-dashed border-[#4b4640] rounded-xl p-8 space-y-4">
                    <div className="w-16 h-16 rounded-xl bg-[#0f0e0d] border border-[#4b4640] flex items-center justify-center text-[#cdc5bd] mx-auto">
                      <Folder className="w-8 h-8" />
                    </div>
                    <div>
                      <h3 className="font-garamond text-[22px] text-[#e6e2e0]">
                        {normalizedSearchQuery ? 'No matching files or folders' : 'This folder is empty'}
                      </h3>
                      <p className="font-sans text-[14px] text-[#cdc5bd] mt-1 max-w-sm mx-auto">
                        {normalizedSearchQuery
                          ? 'Root search now scans the whole vault. Try a different filename or open a folder to narrow the scope.'
                          : 'Drag and drop multiple files or folders here to encrypt and upload, or create a markdown note.'}
                      </p>
                    </div>
                    {!normalizedSearchQuery && (
                      <div className="flex items-center justify-center gap-3 pt-2">
                      <button
                        onClick={() => setIsCreateFolderOpen(true)}
                        className="px-4 py-2 border border-[#4b4640] text-[#e6e2e0] hover:bg-[#363433] text-[11px] font-space-mono font-bold rounded-full transition cursor-pointer flex items-center gap-1.5"
                      >
                        <FolderPlus className="w-4 h-4" />
                        <span>New Folder</span>
                      </button>
                      <button
                        onClick={() => setIsCreatingNote(true)}
                        className="px-4 py-2 border border-[#a5d6a7] text-[#a5d6a7] hover:bg-[#a5d6a7] hover:text-[#0e0d0c] text-[11px] font-space-mono font-bold rounded-full transition cursor-pointer flex items-center gap-1.5"
                      >
                        <FileText className="w-4 h-4" />
                        <span>New Note</span>
                      </button>
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="px-4 py-2 bg-[#8c9eff] text-[#0e0d0c] hover:bg-[#536dfe] text-[11px] font-space-mono font-bold rounded-full transition cursor-pointer flex items-center gap-1.5"
                      >
                        <Upload className="w-4 h-4" />
                        <span>Upload Files</span>
                      </button>
                      </div>
                    )}
                  </div>
                ) : viewMode === 'grid' ? (
                  <FileGrid
                    folders={filteredFolders}
                    files={filteredFiles}
                    onOpenFolder={handleOpenFolder}
                    onPreviewFile={(file) => setPreviewFile(file)}
                    onDownloadFile={downloadFile}
                    onRenameFolder={(folder) => setRenameTarget({ item: folder, type: 'folder' })}
                    onDeleteFolder={async (folderId) => {
                      await deleteFolder(folderId);
                      await refreshUser();
                    }}
                    onRenameFile={(file) => setRenameTarget({ item: file, type: 'file' })}
                    onMoveFile={(file) => setMoveTarget(file)}
                    onDeleteFile={async (fileId) => {
                      await deleteFile(fileId);
                      await refreshUser();
                    }}
                  />
                ) : (
                  <FileList
                    folders={filteredFolders}
                    files={filteredFiles}
                    onOpenFolder={handleOpenFolder}
                    onPreviewFile={(file) => setPreviewFile(file)}
                    onDownloadFile={downloadFile}
                    onRenameFolder={(folder) => setRenameTarget({ item: folder, type: 'folder' })}
                    onDeleteFolder={async (folderId) => {
                      await deleteFolder(folderId);
                      await refreshUser();
                    }}
                    onRenameFile={(file) => setRenameTarget({ item: file, type: 'file' })}
                    onMoveFile={(file) => setMoveTarget(file)}
                    onDeleteFile={async (fileId) => {
                      await deleteFile(fileId);
                      await refreshUser();
                    }}
                  />
                )}
              </div>
            )}

            {activeTab === 'devices' && <DeviceManager />}
            {activeTab === 'passkeys' && <PasskeyManager />}
            {activeTab === 'audit' && <AuditLogViewer />}
            {activeTab === 'recovery' && (
              <div className="max-w-xl py-6 space-y-4">
                <h2 className="font-garamond text-[24px] text-[#e6e2e0]">Emergency Recovery Kit</h2>
                <p className="font-sans text-[14px] text-[#cdc5bd]">
                  Generate an offline emergency recovery key to recover your encrypted vault if you lose every registered device.
                </p>
                <button
                  onClick={() => setIsRecoveryOpen(true)}
                  className="px-6 py-3 border border-[#EAB308] text-[#EAB308] hover:bg-[#EAB308] hover:text-[#0e0d0c] font-space-mono text-[11px] font-bold uppercase transition cursor-pointer"
                >
                  Open Recovery Kit Setup
                </button>
              </div>
            )}
          </div>

          {/* Footer */}
          <footer className="w-full bg-[#141312] border-t border-[#4b4640] mt-auto">
            <div className="w-full px-6 md:px-10 py-6 flex flex-col md:flex-row justify-between items-center max-w-screen-2xl mx-auto gap-4">
              <span className="font-space-mono text-[12px] text-[#cdc5bd]">
                © 2026 Nook. Your device is the key.
              </span>
              <nav className="flex flex-wrap items-center gap-6 font-space-mono text-[11px] font-bold text-[#cdc5bd] uppercase tracking-widest">
                <button onClick={() => setInfoModalType('about')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">About</button>
                <button onClick={() => setInfoModalType('contact')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">Contact</button>
                <button onClick={() => setInfoModalType('privacy')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">Privacy</button>
                <button onClick={() => setInfoModalType('terms')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">Terms</button>
              </nav>
            </div>
          </footer>
        </main>
      </div>

      {/* Modals & Overlay Components */}
      <UploadModal label="Upload" progress={progress} onClose={resetProgress} />
      <UploadModal label="Download" progress={downloadProgress} onClose={resetDownloadProgress} />
      <InfoModal type={infoModalType} onClose={() => setInfoModalType(null)} />

      {/* Document Viewer & Live Markdown Note Editor Modal */}
      {(previewFile || isCreatingNote) && (
        <DocumentViewerModal
          file={previewFile}
          isNewNote={isCreatingNote}
          currentFolderId={currentFolderId}
          onClose={() => {
            setPreviewFile(null);
            setIsCreatingNote(false);
          }}
          onSaveSuccess={() => {
            setPreviewFile(null);
            setIsCreatingNote(false);
            void refreshVaultAndUser();
          }}
        />
      )}

      <CreateFolderModal
        isOpen={isCreateFolderOpen}
        onClose={() => setIsCreateFolderOpen(false)}
        onCreate={createFolder}
      />

      <RenameModal
        isOpen={!!renameTarget}
        initialName={renameTarget ? renameTarget.item.name : ''}
        onClose={() => setRenameTarget(null)}
        onRename={async (newName) => {
          if (!renameTarget) return;
          if (renameTarget.type === 'folder') {
            await renameFolder(renameTarget.item.id, newName);
          } else {
            await renameFile(renameTarget.item.id, newName, renameTarget.item as DecryptedFile);
          }
        }}
      />

      <MoveModal
        isOpen={!!moveTarget}
        folders={folders}
        onClose={() => setMoveTarget(null)}
        onMove={async (targetFolderId) => {
          if (moveTarget) {
            await moveItem(moveTarget.id, targetFolderId, 'file');
          }
        }}
      />

      <RecoveryModal
        isOpen={isRecoveryOpen}
        onClose={() => setIsRecoveryOpen(false)}
      />

      {/* Onboarding Tour — shown once to new users, non-skippable */}
      {showTour && (
        <OnboardingTour onComplete={() => setShowTour(false)} />
      )}

      {/* Drag & Drop Visual Dropzone Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[9999] bg-[#0f0e0d]/90 backdrop-blur-md flex flex-col items-center justify-center border-4 border-dashed border-[#8c9eff] pointer-events-none p-6 text-center">
          <div className="w-20 h-20 rounded-2xl bg-[#201f1e] border border-[#8c9eff] flex items-center justify-center text-[#8c9eff] mb-4 animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="font-garamond text-[36px] text-[#e6e2e0] font-bold">
            Drop Files or Folders Here
          </h2>
          <p className="font-space-mono text-[13px] text-[#cdc5bd] mt-2 max-w-md">
            Nook will automatically encrypt your files and folder structure client-side before uploading.
          </p>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <AuthProvider>
          <VaultMain />
        </AuthProvider>
      </ToastProvider>
    </ErrorBoundary>
  );
}
