/**
 * Nook Editorial Auth Screen — "Your device is the key"
 * Designed with editorial typography (EB Garamond, Space Mono, Inter),
 * passkey flows, strength meter, and recovery option.
 */

import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from './Toast';
import { measurePassphraseStrength } from '../../crypto/keys';
import { InfoModal, InfoModalType } from './InfoModal';
import { SiteFooter } from './SiteFooter';
import { TurnstileWidget } from './TurnstileWidget';
import { ArrowRight, AlertTriangle, CheckCircle2, ShieldCheck } from 'lucide-react';

type AuthTab = 'welcome' | 'create-passphrase' | 'unlock' | 'recovery';

interface AuthScreenProps {
  onBack?: () => void;
}

export default function AuthScreen({ onBack }: AuthScreenProps = {}) {
  const {
    isAuthenticated, isUnlocked, isLoading, user,
    createVaultWithPasskey, loginWithPasskey,
    unlockWithPassphrase, loginWithRecoveryPhrase,
  } = useAuth();

  const { showToast } = useToast();
  const [tab, setTab] = useState<AuthTab>('welcome');
  const [passphrase, setPassphrase] = useState('');
  const [confirmPassphrase, setConfirmPassphrase] = useState('');
  const [vaultId, setVaultId] = useState('');
  const [recoveryPhrase, setRecoveryPhrase] = useState('');
  const [newVaultId, setNewVaultId] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [error, setError] = useState('');
  const [copiedVaultId, setCopiedVaultId] = useState(false);
  const [infoModalType, setInfoModalType] = useState<InfoModalType>(null);

  const [showLogoutNotice, setShowLogoutNotice] = useState(() => {
    try {
      return sessionStorage.getItem('nook_logout_popup') === '1';
    } catch {
      return false;
    }
  });

  const handleCloseLogoutNotice = () => {
    try {
      sessionStorage.removeItem('nook_logout_popup');
    } catch {}
    setShowLogoutNotice(false);
  };

  let screen: React.ReactNode;

  // If authenticated but not unlocked → show passphrase unlock screen
  if (isAuthenticated && !isUnlocked) {
    screen = renderUnlockScreen();
  } else if (isLoading) {
    screen = (
      <div className="bg-[#0e0d0c] text-[#e6e2e0] font-sans min-h-screen flex flex-col items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#EAB308] border-t-transparent rounded-full animate-spin mb-4" />
        <p className="font-space-mono text-[13px] text-[#cdc5bd]">Checking vault session...</p>
      </div>
    );
  } else if (tab === 'create-passphrase') {
    screen = renderSetPassphrase();
  } else if (tab === 'recovery') {
    screen = renderRecovery();
  } else {
    screen = renderWelcome();
  }

  return (
    <>
      {screen}
      <InfoModal type={infoModalType} onClose={() => setInfoModalType(null)} />

      {/* Logout Notice Modal Popup */}
      {showLogoutNotice && (
        <div className="fixed inset-0 z-[9999] bg-[#0f0e0d]/90 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#141312] border border-[#4b4640] p-6 sm:p-8 max-w-md w-full shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 border border-[#a5d6a7] bg-[#0f0e0d] flex items-center justify-center mx-auto text-[#a5d6a7]">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <h3 className="font-garamond text-[24px] sm:text-[28px] text-[#e6e2e0] leading-tight font-bold">
              Vault Locked & Cleared
            </h3>
            <p className="font-sans text-[13px] sm:text-[14px] text-[#cdc5bd] leading-relaxed">
              Your session cookies, local encryption key cache, and browser storage have been completely wiped.
            </p>
            <div className="flex gap-3 pt-2">
              {onBack && (
                <button
                  onClick={() => {
                    handleCloseLogoutNotice();
                    onBack();
                  }}
                  className="flex-1 py-3 border border-[#4b4640] text-[#cdc5bd] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:border-[#e6e2e0] hover:text-[#e6e2e0] cursor-pointer transition-colors"
                >
                  ← Back
                </button>
              )}
              <button
                onClick={handleCloseLogoutNotice}
                className="flex-1 py-3 bg-[#e6e1df] text-[#1d1b1a] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#cac6c3] cursor-pointer transition-colors"
              >
                Got It
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Welcome Screen ──
  function renderWelcome() {
    return (
      <div className="bg-[#0e0d0c] text-[#e6e2e0] font-sans min-h-screen flex flex-col selection:bg-[#cac6c3] selection:text-[#32302f]">
        {/* Header */}
        <header className="bg-[#0e0d0c] w-full top-0 sticky border-b border-[#4b4640] z-50">
          <div className="flex items-center w-full px-4 sm:px-6 md:px-10 py-3.5 sm:py-5 max-w-screen-2xl mx-auto gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="font-space-mono text-[10px] sm:text-[11px] font-bold text-[#cdc5bd] hover:text-[#e6e2e0] uppercase cursor-pointer mr-1 sm:mr-2 transition-colors shrink-0"
              >
                ← Home
              </button>
            )}
            <div className="font-garamond text-[26px] sm:text-[32px] text-[#e6e2e0] tracking-tight leading-none shrink-0">
              Nook
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-grow w-full max-w-md mx-auto px-4 sm:px-6 relative z-10 flex flex-col items-center justify-center py-8 sm:py-16">
          <div className="text-center mb-10">
            <h1 className="font-garamond text-[40px] md:text-[64px] leading-[1.1] mb-4 text-[#e6e2e0]">
              Welcome back.
            </h1>
            <p className="font-sans text-[16px] text-[#cdc5bd] max-w-[300px] mx-auto">
              Your keys never leave your hardware.
            </p>
          </div>

          {error && (
            <div className="w-full mb-6 p-4 border border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab] font-space-mono text-[13px] rounded">
              {error}
            </div>
          )}

          {/* Turnstile Bot Protection Widget */}
          <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />

          {/* Action Buttons */}
          <div className="w-full flex flex-col gap-4 mb-10">
            <button
              onClick={handleCreateVault}
              disabled={isLoading}
              className="w-full py-4 border border-[#F2EFE9] bg-transparent text-[#F2EFE9] font-space-mono text-[11px] font-bold tracking-widest uppercase hover:bg-[#F2EFE9] hover:text-[#0E0D0C] transition-colors duration-300 flex items-center justify-center gap-2 group cursor-pointer disabled:opacity-50"
            >
              Create New Vault
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>

            <button
              onClick={handleOpenVault}
              disabled={isLoading}
              className="w-full py-4 border border-[#4b4640] text-[#cdc5bd] font-space-mono text-[11px] font-bold tracking-widest uppercase hover:border-[#F2EFE9] hover:text-[#F2EFE9] transition-colors duration-300 cursor-pointer disabled:opacity-50"
            >
              Open Existing Vault
            </button>
          </div>

          {/* Security Note / Recovery */}
          <div className="pt-8 border-t border-[#4b4640] w-full text-center flex items-center justify-center gap-2">
            <AlertTriangle className="w-4 h-4 text-[#ffb4ab]" />
            <span className="font-space-mono text-[13px] text-[#cdc5bd]">
              Lost your device?{' '}
              <button
                onClick={() => { setTab('recovery'); setError(''); }}
                className="text-[#e6e2e0] hover:text-[#F2EFE9] underline underline-offset-4 transition-colors cursor-pointer"
              >
                Use Recovery Kit
              </button>
            </span>
          </div>
        </main>

        <SiteFooter onSelectInfo={setInfoModalType} />
      </div>
    );
  }

  const handleCopyVaultId = async () => {
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(newVaultId);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = newVaultId;
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
    setCopiedVaultId(true);
    setTimeout(() => setCopiedVaultId(false), 2000);
  };

  // ── Set Passphrase Screen ──
  function renderSetPassphrase() {
    const strength = measurePassphraseStrength(passphrase);
    const canSubmit = passphrase.length >= 8 && passphrase === confirmPassphrase && strength.score >= 2;

    return (
      <div className="bg-[#0e0d0c] text-[#e6e2e0] font-sans min-h-screen flex flex-col selection:bg-[#cac6c3] selection:text-[#32302f]">
        {/* Header */}
        <header className="bg-[#0e0d0c] w-full top-0 sticky border-b border-[#4b4640] z-50">
          <div className="flex items-center w-full px-4 sm:px-6 md:px-10 py-3.5 sm:py-5 max-w-screen-2xl mx-auto gap-3">
            <button
              onClick={() => setTab('welcome')}
              className="font-space-mono text-[10px] sm:text-[11px] font-bold text-[#cdc5bd] hover:text-[#e6e2e0] uppercase cursor-pointer mr-1 sm:mr-2 transition-colors shrink-0"
            >
              ← Back
            </button>
            <div className="font-garamond text-[26px] sm:text-[32px] text-[#e6e2e0] tracking-tight leading-none shrink-0">
              Nook
            </div>
          </div>
        </header>

        <main className="flex-grow w-full max-w-md mx-auto px-4 sm:px-6 relative z-10 flex flex-col items-center justify-center py-8 sm:py-16">
          <div className="text-center mb-8">
            <h1 className="font-garamond text-[32px] sm:text-[36px] md:text-[48px] leading-[1.1] mb-3 text-[#e6e2e0]">
              Set Your Passphrase
            </h1>
            <p className="font-sans text-[14px] sm:text-[15px] text-[#cdc5bd]">
              This passphrase encrypts your files locally. Nook never sees it.
            </p>
          </div>

          {/* Vault ID Banner */}
          <div className="w-full bg-[#141312] border border-[#4b4640] p-4 rounded mb-6 text-left">
            <span className="font-space-mono text-[11px] font-bold text-[#EAB308] uppercase tracking-wider block mb-1">
              Your Vault ID
            </span>
            <div className="flex items-center justify-between gap-2">
              <code className="font-space-mono text-[12px] sm:text-[13px] text-[#e6e2e0] break-all">
                {newVaultId}
              </code>
              <button
                type="button"
                onClick={handleCopyVaultId}
                className="px-2.5 py-1.5 border border-[#4b4640] hover:border-[#F2EFE9] text-[#cdc5bd] hover:text-[#e6e2e0] font-space-mono text-[11px] uppercase transition-colors shrink-0 cursor-pointer touch-manipulation"
              >
                {copiedVaultId ? 'Copied' : 'Copy'}
              </button>
            </div>
            <span className="font-space-mono text-[10px] sm:text-[11px] text-[#969088] mt-2 block">
              Save this ID for account recovery across devices.
            </span>
          </div>

          {error && (
            <div className="w-full mb-6 p-4 border border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab] font-space-mono text-[13px] rounded">
              {error}
            </div>
          )}

          <div className="w-full flex flex-col gap-4 mb-8">
            <div>
              <input
                type="password"
                placeholder="Vault Passphrase"
                value={passphrase}
                onChange={e => setPassphrase(e.target.value)}
                className="w-full bg-[#141312] border border-[#4b4640] text-[#e6e2e0] px-4 py-3 rounded text-[14px] sm:text-[15px] focus:outline-none focus:border-[#F2EFE9] font-sans transition-colors placeholder-[#64748b]"
              />
              {passphrase.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="w-full bg-[#201f1e] h-1.5 rounded overflow-hidden">
                    <div
                      className="h-full transition-all duration-300"
                      style={{ width: `${Math.min(100, strength.score * 25)}%`, backgroundColor: strength.color }}
                    />
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 font-space-mono text-[11px]">
                    <span style={{ color: strength.color }}>
                      Strength: {strength.label}
                    </span>
                    <span className="text-[#969088] text-[10px]">
                      {strength.score >= 3 ? '✓ Strong Passphrase' : 'Min 8 chars'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div>
              <input
                type="password"
                placeholder="Confirm Passphrase"
                value={confirmPassphrase}
                onChange={e => setConfirmPassphrase(e.target.value)}
                className="w-full bg-[#141312] border border-[#4b4640] text-[#e6e2e0] px-4 py-3 rounded text-[15px] focus:outline-none focus:border-[#F2EFE9] font-sans transition-colors placeholder-[#64748b]"
              />
              {confirmPassphrase.length > 0 && passphrase !== confirmPassphrase && (
                <span className="font-space-mono text-[11px] text-[#ffb4ab] mt-1 block">
                  Passphrases do not match
                </span>
              )}
            </div>
          </div>

          <button
            onClick={handleSetPassphrase}
            disabled={!canSubmit || isLoading}
            className="w-full py-4 border border-[#F2EFE9] bg-transparent text-[#F2EFE9] font-space-mono text-[11px] font-bold tracking-widest uppercase hover:bg-[#F2EFE9] hover:text-[#0E0D0C] transition-colors duration-300 disabled:opacity-50 cursor-pointer mb-4"
          >
            Unlock Vault
          </button>

          <button
            onClick={() => setTab('welcome')}
            className="font-space-mono text-[11px] text-[#cdc5bd] hover:text-[#e6e2e0] uppercase cursor-pointer"
          >
            ← Back
          </button>
        </main>
        <SiteFooter onSelectInfo={setInfoModalType} />
      </div>
    );
  }

  // ── Unlock Screen ──
  function renderUnlockScreen() {
    return (
      <div className="bg-[#0e0d0c] text-[#e6e2e0] font-sans min-h-screen flex flex-col selection:bg-[#cac6c3] selection:text-[#32302f]">
        {/* Header */}
        <header className="bg-[#0e0d0c] w-full top-0 sticky border-b border-[#4b4640] z-50">
          <div className="flex items-center w-full px-4 sm:px-6 md:px-10 py-3.5 sm:py-5 max-w-screen-2xl mx-auto">
            <div className="font-garamond text-[26px] sm:text-[32px] text-[#e6e2e0] tracking-tight leading-none">
              Nook
            </div>
          </div>
        </header>

        <main className="flex-grow w-full max-w-md mx-auto px-6 relative z-10 flex flex-col items-center justify-center py-16">
          <div className="text-center mb-8">
            <h1 className="font-garamond text-[40px] md:text-[56px] leading-[1.1] mb-3 text-[#e6e2e0]">
              Unlock Your Vault
            </h1>
            <p className="font-sans text-[15px] text-[#cdc5bd]">
              Enter your passphrase to derive decryption keys.
            </p>
          </div>

          {user?.id && (
            <div className="w-full bg-[#141312] border border-[#4b4640] p-3 rounded mb-6 text-center">
              <span className="font-space-mono text-[11px] text-[#969088] uppercase block mb-0.5">
                Vault ID
              </span>
              <code className="font-space-mono text-[12px] text-[#EAB308] break-all">
                {user.id}
              </code>
            </div>
          )}

          {error && (
            <div className="w-full mb-6 p-4 border border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab] font-space-mono text-[13px] rounded">
              {error}
            </div>
          )}

          <div className="w-full mb-6">
            <input
              type="password"
              placeholder="Vault Passphrase"
              value={passphrase}
              onChange={e => setPassphrase(e.target.value)}
              className="w-full bg-[#141312] border border-[#4b4640] text-[#e6e2e0] px-4 py-3.5 rounded text-[15px] focus:outline-none focus:border-[#F2EFE9] font-sans transition-colors placeholder-[#64748b]"
              autoFocus
              onKeyDown={e => { if (e.key === 'Enter') handleUnlock(); }}
            />
          </div>

          <button
            onClick={handleUnlock}
            disabled={!passphrase || isLoading}
            className="w-full py-4 border border-[#F2EFE9] bg-transparent text-[#F2EFE9] font-space-mono text-[11px] font-bold tracking-widest uppercase hover:bg-[#F2EFE9] hover:text-[#0E0D0C] transition-colors duration-300 disabled:opacity-50 cursor-pointer"
          >
            Unlock Vault
          </button>

          {/* Zero-knowledge trust note */}
          <div className="w-full mt-5 flex items-start gap-2.5 p-3 border border-[#4b4640]/60 bg-[#0f0e0d]">
            <svg className="w-3.5 h-3.5 text-[#a5d6a7] mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            </svg>
            <p className="font-space-mono text-[11px] text-[#969088] leading-relaxed">
              Your passphrase <span className="text-[#cdc5bd]">never leaves your device</span>. It is used only in your browser to derive encryption keys locally. Nook has zero access to your files or passphrase.
            </p>
          </div>
        </main>
        <SiteFooter onSelectInfo={setInfoModalType} />
      </div>
    );
  }

  // ── Recovery Screen ──
  function renderRecovery() {
    return (
      <div className="bg-[#0e0d0c] text-[#e6e2e0] font-sans min-h-screen flex flex-col selection:bg-[#cac6c3] selection:text-[#32302f]">
        <header className="bg-[#0e0d0c] w-full top-0 sticky border-b border-[#4b4640] z-50">
          <div className="flex justify-between items-center w-full px-6 md:px-10 py-6 max-w-screen-2xl mx-auto">
            <div className="font-garamond text-[32px] text-[#e6e2e0] tracking-tight leading-none">
              Nook
            </div>
          </div>
        </header>

        <main className="flex-grow w-full max-w-md mx-auto px-6 relative z-10 flex flex-col items-center justify-center py-16">
          <div className="text-center mb-8">
            <h1 className="font-garamond text-[36px] md:text-[48px] leading-[1.1] mb-3 text-[#e6e2e0]">
              Emergency Recovery
            </h1>
            <p className="font-sans text-[15px] text-[#cdc5bd]">
              Enter your Vault ID and emergency recovery key.
            </p>
          </div>

          {error && (
            <div className="w-full mb-6 p-4 border border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab] font-space-mono text-[13px] rounded">
              {error}
            </div>
          )}

          <div className="w-full flex flex-col gap-4 mb-8">
            <input
              type="text"
              placeholder="Vault ID (e.g. user_a1b2c3...)"
              value={vaultId}
              onChange={e => setVaultId(e.target.value)}
              className="w-full bg-[#141312] border border-[#4b4640] text-[#e6e2e0] px-4 py-3 rounded text-[15px] focus:outline-none focus:border-[#F2EFE9] font-sans transition-colors placeholder-[#64748b]"
              autoFocus
            />

            <textarea
              placeholder="Recovery key (e.g. XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX-XXXX)"
              value={recoveryPhrase}
              onChange={e => setRecoveryPhrase(e.target.value)}
              className="w-full bg-[#141312] border border-[#4b4640] text-[#e6e2e0] px-4 py-3 rounded text-[14px] focus:outline-none focus:border-[#F2EFE9] font-space-mono transition-colors placeholder-[#64748b] min-h-[100px] resize-y"
            />
          </div>

          <button
            onClick={handleRecovery}
            disabled={!vaultId || !recoveryPhrase || isLoading}
            className="w-full py-4 border border-[#F2EFE9] bg-transparent text-[#F2EFE9] font-space-mono text-[11px] font-bold tracking-widest uppercase hover:bg-[#F2EFE9] hover:text-[#0E0D0C] transition-colors duration-300 disabled:opacity-50 cursor-pointer mb-4"
          >
            Recover Vault
          </button>

          <button
            onClick={() => { setTab('welcome'); setError(''); }}
            className="font-space-mono text-[11px] text-[#cdc5bd] hover:text-[#e6e2e0] uppercase cursor-pointer"
          >
            ← Back
          </button>
        </main>
        <SiteFooter onSelectInfo={setInfoModalType} />
      </div>
    );
  }

  // ── Handlers ──

  async function handleCreateVault() {
    setError('');
    try {
      const result = await createVaultWithPasskey(undefined, turnstileToken);
      setNewVaultId(result.userId);
      setTab('create-passphrase');
      showToast('Vault created! Set your passphrase.', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to create vault.');
    }
  }

  async function handleOpenVault() {
    setError('');
    try {
      await loginWithPasskey();
      showToast('Passkey verified!', 'success');
    } catch (err: any) {
      setError(err.message || 'Passkey authentication failed.');
    }
  }

  async function handleSetPassphrase() {
    if (passphrase !== confirmPassphrase) { setError('Passphrases do not match.'); return; }
    setError('');
    try {
      await unlockWithPassphrase(passphrase);
      showToast('Vault unlocked!', 'success');
    } catch (err: any) {
      setError(err.message || 'Failed to derive encryption keys.');
    }
  }

  async function handleUnlock() {
    setError('');
    try {
      await unlockWithPassphrase(passphrase);
      showToast('Vault unlocked!', 'success');
    } catch (err: any) {
      setError(err.message || 'Incorrect passphrase or key derivation error.');
    }
  }

  async function handleRecovery() {
    setError('');
    try {
      await loginWithRecoveryPhrase(vaultId.trim(), recoveryPhrase.trim());
      showToast('Vault recovered successfully!', 'success');
    } catch (err: any) {
      setError(err.message || 'Recovery failed. Check your Vault ID and phrase.');
    }
  }
}
