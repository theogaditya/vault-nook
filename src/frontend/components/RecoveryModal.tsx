/**
 * Emergency Recovery Kit Modal — Nook Editorial Design
 */

import React, { useState } from 'react';
import { Copy, CheckCircle2, X, ArrowRight } from 'lucide-react';
import { RecoveryManager } from '../../crypto/recovery';
import { useAuth } from '../hooks/useAuth';
import { apiRequest } from '../api/client';

interface RecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function RecoveryModal({ isOpen, onClose }: RecoveryModalProps) {
  const { keys, user } = useAuth();
  const [phrase, setPhrase] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleGenerateRecoveryKit = async () => {
    if (!keys) return;
    setIsSettingUp(true);
    setMessage(null);
    try {
      const generated = RecoveryManager.generateRecoveryPhrase();
      setPhrase(generated.phrase);
      const envelope = await RecoveryManager.createRecoveryEnvelope(keys.vmk, generated.phrase);
      await apiRequest('/api/recovery/setup', {
        method: 'POST',
        body: JSON.stringify(envelope),
      });
      setMessage('Emergency recovery key configured successfully!');
    } catch (err: any) {
      setMessage(err.message || 'Failed to setup recovery phrase.');
    } finally {
      setIsSettingUp(false);
    }
  };

  const safeCopyText = async (text: string): Promise<boolean> => {
    let success = false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        success = true;
      } catch {
        success = false;
      }
    }
    if (!success) {
      try {
        const textarea = document.createElement('textarea');
        textarea.value = text;
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
    return success;
  };

  const handleCopyKey = async () => {
    if (phrase) {
      await safeCopyText(phrase);
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }
  };

  const handleCopyId = async () => {
    if (user?.id) {
      await safeCopyText(user.id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  };

  const handleCopyAll = async () => {
    if (phrase && user?.id) {
      const fullText = `Nook Vault ID: ${user.id}\nEmergency Recovery Key: ${phrase}`;
      await safeCopyText(fullText);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  const blocks = phrase ? phrase.split('-') : [];

  return (
    <div className="fixed inset-0 z-50 bg-[#0e0d0c]/90 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-[#141312] border border-[#4b4640] p-8 shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase">0x</span>
            </div>
            <h2 className="font-garamond text-[40px] md:text-[52px] leading-[1.1] text-[#e6e2e0] mb-3">
              Emergency Recovery Kit
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#636363] hover:text-[#e6e2e0] transition-colors cursor-pointer border border-[#4b4640] hover:border-[#cac6c3]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {!phrase ? (
          <div className="border border-[#4b4640] p-6 space-y-6">
            {/* Code label */}
            <div className="inline-block border border-[#4b4640] px-3 py-1">
              <span className="font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase">
                Ref_Kit_Init
              </span>
            </div>

            <p className="font-sans text-[16px] text-[#cdc5bd] leading-relaxed">
              Generate an offline high-entropy 32-character alphanumeric master key to recover your encrypted vault if you lose every registered device.
            </p>

            <button
              onClick={handleGenerateRecoveryKit}
              disabled={isSettingUp}
              className="border border-[#e6e2e0] text-[#e6e2e0] hover:bg-[#e6e2e0] hover:text-[#0e0d0c] font-space-mono text-[11px] font-bold tracking-widest uppercase px-6 py-3 transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-3"
            >
              <span>{isSettingUp ? 'Generating...' : 'Open Recovery Kit Setup'}</span>
              {!isSettingUp && <ArrowRight className="w-4 h-4" />}
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Vault ID Display Box */}
            <div className="border border-[#4b4640] p-3.5 bg-[#0f0e0d] flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="font-space-mono text-[9px] font-bold text-[#636363] uppercase tracking-widest block mb-0.5">
                  VAULT ID
                </span>
                <span className="font-space-mono text-[12px] text-[#EAB308] font-bold truncate block select-all" title={user?.id}>
                  {user?.id || '—'}
                </span>
              </div>
              <button
                onClick={handleCopyId}
                className="font-space-mono text-[10px] text-[#cdc5bd] border border-[#4b4640] hover:border-[#cac6c3] hover:text-[#e6e2e0] px-2.5 py-1.5 transition cursor-pointer shrink-0 flex items-center gap-1.5"
              >
                {copiedId ? <CheckCircle2 className="w-3.5 h-3.5 text-[#a5d6a7]" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedId ? 'Copied' : 'Copy ID'}</span>
              </button>
            </div>

            {/* Recovery Key Grid */}
            <div className="border border-[#4b4640] p-4 bg-[#0f0e0d]">
              <span className="font-space-mono text-[9px] font-bold text-[#636363] uppercase tracking-widest block mb-2">
                RECOVERY KEY
              </span>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {blocks.map((block, idx) => (
                  <div key={idx} className="bg-[#141312] border border-[#4b4640] p-2.5 text-center">
                    <span className="font-space-mono text-[9px] text-[#636363] block mb-1">PART 0{idx + 1}</span>
                    <span className="font-space-mono text-[14px] text-[#e6e2e0] font-bold tracking-widest">{block}</span>
                  </div>
                ))}
              </div>
            </div>

            <p className="font-space-mono text-[11px] text-[#969088] leading-relaxed">
              Store your <strong className="text-[#e6e2e0]">Vault ID</strong> and <strong className="text-[#e6e2e0]">32-character recovery key</strong> together in a safe offline location. You will need both to recover your vault if access is lost. Nook does not hold a copy of your recovery key.
            </p>

            <div className="flex flex-wrap justify-between items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyKey}
                  className="font-space-mono text-[11px] font-bold tracking-widest uppercase border border-[#4b4640] px-3.5 py-2.5 text-[#cdc5bd] hover:border-[#cac6c3] hover:text-[#e6e2e0] transition-colors cursor-pointer flex items-center gap-2"
                >
                  {copiedKey ? <CheckCircle2 className="w-4 h-4 text-[#a5d6a7]" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedKey ? 'Copied!' : 'Copy Key'}</span>
                </button>
                <button
                  onClick={handleCopyAll}
                  className="font-space-mono text-[11px] font-bold tracking-widest uppercase border border-[#EAB308]/40 px-3.5 py-2.5 text-[#EAB308] hover:bg-[#EAB308]/10 transition-colors cursor-pointer flex items-center gap-2"
                >
                  {copiedAll ? <CheckCircle2 className="w-4 h-4 text-[#a5d6a7]" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedAll ? 'Copied All!' : 'Copy ID & Key'}</span>
                </button>
              </div>
              <button
                onClick={onClose}
                className="font-space-mono text-[11px] font-bold tracking-widest uppercase bg-[#e6e2e0] text-[#0e0d0c] hover:bg-[#cac6c3] px-6 py-2.5 transition-colors cursor-pointer"
              >
                Done
              </button>
            </div>
          </div>
        )}

        {message && (
          <p className="mt-4 font-space-mono text-[12px] text-[#a5d6a7] text-center">{message}</p>
        )}
      </div>
    </div>
  );
}
