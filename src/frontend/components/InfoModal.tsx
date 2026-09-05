/**
 * Info Modal — Nook Editorial Aesthetic for About, Contact, Privacy, Terms, FAQ
 */

import React, { useState } from 'react';
import { X, ShieldCheck, Mail, Info, FileText, HelpCircle, ChevronDown, ChevronUp } from 'lucide-react';

export type InfoModalType = 'about' | 'contact' | 'privacy' | 'terms' | 'faq' | null;

interface InfoModalProps {
  type: InfoModalType;
  onClose: () => void;
}

interface FAQItem {
  q: string;
  a: React.ReactNode;
}

interface FAQSection {
  category: string;
  items: FAQItem[];
}

const FAQ_DATA: FAQSection[] = [
  {
    category: 'Using Nook',
    items: [
      {
        q: 'What files can I store?',
        a: (
          <div className="space-y-2">
            <p>Nook supports arbitrary file types, including:</p>
            <div className="grid grid-cols-3 gap-1.5 font-space-mono text-[11px] text-[#EAB308] bg-[#0f0e0d] p-3 border border-[#4b4640]">
              <span>• PDF</span>
              <span>• DOCX</span>
              <span>• XLSX</span>
              <span>• Images</span>
              <span>• Video</span>
              <span>• Audio</span>
              <span>• ZIP</span>
              <span>• EXE</span>
              <span>• Plain text</span>
              <span>• Markdown</span>
              <span className="col-span-2">• Binary files</span>
            </div>
            <p className="text-[13px] text-[#969088] pt-1">
              Unsupported formats can still be stored and downloaded; they simply may not have an in-browser preview.
            </p>
          </div>
        ),
      },
      {
        q: 'Can I upload an entire folder?',
        a: <p>Yes. You can drag and drop files or entire folder trees into Nook, with the directory hierarchy preserved.</p>,
      },
      {
        q: 'How large can my files be?',
        a: (
          <div className="space-y-1.5">
            <p>The current limits are:</p>
            <ul className="font-space-mono text-[12px] text-[#e6e2e0] space-y-1 pl-3 border-l border-[#EAB308]">
              <li><strong className="text-[#cdc5bd]">Maximum file size:</strong> 500 MB</li>
              <li><strong className="text-[#cdc5bd]">Storage per account:</strong> 500 MB</li>
              <li><strong className="text-[#cdc5bd]">Connected devices:</strong> Up to 3 devices</li>
            </ul>
          </div>
        ),
      },
      {
        q: 'Can I preview files without downloading them?',
        a: <p>Yes. Nook supports in-browser previews for PDFs, documents, spreadsheets, images, text/code, video, and audio where supported by the application. Unsupported formats can be downloaded instead.</p>,
      },
      {
        q: 'Can I search my files?',
        a: <p>Yes. Nook can search file names across your vault. Search is performed locally in your browser against the decrypted name cache, so your search query is not sent to the server.</p>,
      },
      {
        q: 'Can I use Nook on multiple devices?',
        a: <p>Yes. You can register up to 3 trusted devices per account, with each device having its own passkey credential. Devices can also be individually revoked at any time.</p>,
      },
      {
        q: 'What happens if I lose one of my devices?',
        a: (
          <div className="space-y-2">
            <p>You can revoke its trusted-device credential and associated sessions from your account.</p>
            <p className="text-[13px] text-[#cdc5bd]">
              If you have lost access to all trusted devices, your recovery phrase can be used to recover the vault on a new browser/device.
            </p>
          </div>
        ),
      },
      {
        q: 'Can I create notes in Nook?',
        a: <p>Yes. Nook includes a built-in Markdown editor. Notes are encrypted and stored as regular files inside your vault.</p>,
      },
    ],
  },
  {
    category: 'Privacy & Account',
    items: [
      {
        q: "Why doesn't Nook require an email address?",
        a: (
          <div className="space-y-2">
            <p>Because Nook is designed so your identity does not depend on an email account.</p>
            <p className="text-[13px] text-[#969088]">
              There is no email-based password reset or account recovery system. Your account uses a randomly generated identifier and WebAuthn credentials.
            </p>
          </div>
        ),
      },
      {
        q: 'Do I need to provide my real name or phone number?',
        a: <p>No. Nook does not require an email address, phone number, or real name to create a vault.</p>,
      },
      {
        q: 'Can Nook employees read my files?',
        a: (
          <div className="space-y-2">
            <p>Nook's zero-knowledge design means the service does not possess the vault master key required to decrypt your files.</p>
            <p className="text-[13px] text-[#969088]">
              Therefore, simply having access to the backend does not provide the ability to read your encrypted files.
            </p>
          </div>
        ),
      },
      {
        q: 'Can I delete my data?',
        a: <p>Yes. Deleting files removes their associated stored objects and metadata from Nook's storage system.</p>,
      },
    ],
  },
  {
    category: 'Trust & Transparency',
    items: [
      {
        q: 'What happens if my encrypted files are modified or corrupted?',
        a: <p>Nook uses AES-256-GCM authentication for encrypted chunks. If ciphertext is modified, integrity verification can fail during decryption instead of silently returning corrupted plaintext.</p>,
      },
      {
        q: 'Does Nook store my encryption keys?',
        a: <p>Nook stores encrypted key envelopes needed by the application, but the vault master key itself never leaves the browser. Without the master key, those encrypted envelopes cannot be used to decrypt the vault.</p>,
      },
      {
        q: 'What does Nook protect me from?',
        a: (
          <div className="space-y-2">
            <p>Nook's architecture is designed to protect your plaintext files from exposure through compromise of the storage/backend layer.</p>
            <div className="p-3 border border-[#ffb4ab]/30 bg-[#93000a]/20 font-space-mono text-[11px] text-[#ffb4ab]">
              LIMITATIONS: Nook is not designed to protect you from malware, keyloggers, malicious browser extensions, or a fully compromised endpoint. Your device is ultimately part of your security boundary.
            </div>
          </div>
        ),
      },
      {
        q: 'Is Nook a replacement for Google Drive, Dropbox, or iCloud?',
        a: (
          <div className="space-y-3">
            <p className="font-semibold text-[#e6e2e0]">Nook is designed for a different priority: <span className="text-[#EAB308]">Privacy first.</span></p>
            <p className="text-[13px] text-[#cdc5bd]">
              If you primarily need collaboration, large-scale sharing, office integrations, or team workflows, traditional cloud platforms may be a better fit.
            </p>
            <p className="text-[13px] text-[#cdc5bd] border-l-2 border-[#EAB308] pl-3 italic">
              If your priority is keeping your personal files encrypted and out of the provider's hands, that's what Nook is built for.
            </p>
          </div>
        ),
      },
    ],
  },
];

function FAQAccordion() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({
    'What files can I store?': true,
    'Is Nook a replacement for Google Drive, Dropbox, or iCloud?': true,
  });

  const toggle = (q: string) => {
    setOpenItems(prev => ({ ...prev, [q]: !prev[q] }));
  };

  return (
    <div className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
      {FAQ_DATA.map(sec => (
        <div key={sec.category} className="space-y-3">
          <h4 className="font-space-mono text-[11px] font-bold text-[#EAB308] uppercase tracking-widest border-b border-[#4b4640] pb-1.5">
            {sec.category}
          </h4>
          <div className="space-y-2">
            {sec.items.map(item => {
              const isOpen = !!openItems[item.q];
              return (
                <div key={item.q} className="border border-[#4b4640] bg-[#100f0e] transition-colors">
                  <button
                    onClick={() => toggle(item.q)}
                    className="w-full p-4 flex items-center justify-between text-left font-garamond text-[18px] md:text-[20px] text-[#e6e2e0] hover:text-[#EAB308] transition-colors cursor-pointer"
                  >
                    <span>{item.q}</span>
                    {isOpen ? (
                      <ChevronUp className="w-4 h-4 text-[#EAB308] shrink-0 ml-3" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#636363] shrink-0 ml-3" />
                    )}
                  </button>
                  {isOpen && (
                    <div className="px-4 pb-4 font-sans text-[14px] text-[#cdc5bd] leading-relaxed border-t border-[#4b4640]/50 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export function InfoModal({ type, onClose }: InfoModalProps) {
  if (!type) return null;

  const contentMap: Record<NonNullable<InfoModalType>, { title: string; subtitle: string; icon: React.ReactNode; body: React.ReactNode }> = {
    about: {
      title: 'About Nook',
      subtitle: 'ZERO-KNOWLEDGE PERSONAL VAULT',
      icon: <Info className="w-4 h-4 text-[#cac6c3]" />,
      body: (
        <div className="space-y-4 font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
          <p className="font-garamond text-[20px] text-[#e6e2e0] italic">
            Your private corner of the Internet.
          </p>
          <p>
            Nook is a distraction-free, zero-knowledge personal vault built for keeping your files private.
          </p>
          <p>
            Files are encrypted in your browser using AES-256-GCM before they leave your device. Your vault encryption keys are never transmitted to Nook, so our storage systems hold encrypted data rather than readable files.
          </p>
          <div className="p-3 border border-[#4b4640] bg-[#0f0e0d] font-space-mono text-[12px] text-[#EAB308]">
            Nook is designed around a simple principle:
            <br />
            <span className="font-bold text-[#e6e2e0]">The cloud should store your data without needing to read it.</span>
          </div>
          <p>
            No email address. No phone number. No real name required. Your vault is accessed through cryptographic authentication and protected by encryption keys under your control.
          </p>
          <p className="font-space-mono text-[11px] text-[#636363] pt-2 border-t border-[#4b4640] uppercase tracking-widest font-bold">
            Your files. Your keys. Your Nook.
          </p>
        </div>
      ),
    },
    faq: {
      title: 'Frequently Asked Questions',
      subtitle: 'PRODUCT ARCHITECTURE & PRIVACY GUIDANCE',
      icon: <HelpCircle className="w-4 h-4 text-[#EAB308]" />,
      body: <FAQAccordion />,
    },
    contact: {
      title: 'Contact & Security',
      subtitle: 'PGP & SECURITY DISCLOSURE CHANNEL',
      icon: <Mail className="w-4 h-4 text-[#cac6c3]" />,
      body: (
        <div className="space-y-4 font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
          <p>
            Nook does not require an email address, phone number, or real name to create or use a vault.
          </p>
          <p>
            For security researchers, cryptographic auditors, and vulnerability disclosures, you can contact the Nook security team directly:
          </p>
          <div className="p-3 border border-[#4b4640] bg-[#0f0e0d] font-space-mono text-[12px] text-[#e6e2e0]">
            <p className="text-[#636363] uppercase tracking-widest text-[10px] mb-1">Security Disclosures</p>
            <p className="select-all font-bold text-[#EAB308]">security@nook.vault</p>
          </div>
          <p className="text-[13px] text-[#969088]">
            For sensitive security reports, please encrypt your message using the Nook security team's public PGP key.
          </p>
          <div className="pt-2 border-t border-[#4b4640] space-y-2">
            <p className="font-space-mono text-[11px] font-bold text-[#e6e2e0] uppercase tracking-wider">Please include:</p>
            <ul className="font-space-mono text-[11px] text-[#969088] space-y-1 pl-3 border-l border-[#4b4640]">
              <li>• A clear description of the vulnerability</li>
              <li>• Steps required to reproduce it</li>
              <li>• Potential security impact</li>
              <li>• Relevant screenshots, logs, or proof-of-concept material</li>
            </ul>
          </div>
          <p className="font-space-mono text-[11px] text-[#636363]">
            We encourage responsible disclosure of vulnerabilities affecting Nook's authentication, encryption, storage, or privacy boundaries.
          </p>
        </div>
      ),
    },
    privacy: {
      title: 'Privacy Policy',
      subtitle: 'PRIVACY BY ARCHITECTURE',
      icon: <ShieldCheck className="w-4 h-4 text-[#a5d6a7]" />,
      body: (
        <div className="space-y-4 font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
          <p className="font-semibold text-[#e6e2e0]">
            Nook is designed to minimize the information required to operate your vault.
          </p>

          <div className="space-y-2">
            <p className="font-space-mono text-[11px] font-bold text-[#EAB308] uppercase tracking-wider">What we don't require:</p>
            <ul className="font-space-mono text-[11px] text-[#969088] space-y-1 pl-3 border-l border-[#4b4640]">
              <li>— No email address</li>
              <li>— No phone number</li>
              <li>— No real name</li>
              <li>— No password-based account</li>
              <li>— No plaintext file names or folder names stored by the service</li>
            </ul>
          </div>

          <div className="space-y-2">
            <p className="font-space-mono text-[11px] font-bold text-[#e6e2e0] uppercase tracking-wider">What Nook cannot access:</p>
            <p className="text-[13px]">
              Your files are encrypted client-side before upload. Your vault master key is not transmitted to Nook, and encrypted file data is stored as ciphertext. Nook therefore does not have the cryptographic information required to simply decrypt your stored files.
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-[#4b4640]">
            <p className="font-space-mono text-[11px] font-bold text-[#e6e2e0] uppercase tracking-wider">What Nook may still process:</p>
            <p className="text-[13px] text-[#969088]">
              Zero-knowledge does not mean that the service has zero operational metadata. To provide authentication, storage, sessions, quotas, abuse prevention, and security monitoring, Nook may process limited service-level information such as account identifiers, storage usage, session information, timestamps, and network information where required by the service.
            </p>
          </div>

          <p className="font-space-mono text-[11px] text-[#EAB308] italic">
            We do not claim that the cloud sees nothing. We claim that it does not receive your readable files or the vault key required to decrypt them.
          </p>
        </div>
      ),
    },
    terms: {
      title: 'Terms of Service',
      subtitle: 'CRYPTOGRAPHIC SOVEREIGNTY',
      icon: <FileText className="w-4 h-4 text-[#cac6c3]" />,
      body: (
        <div className="space-y-4 font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
          <p>
            Nook is designed so that you retain control over the encryption keys protecting your vault. You are responsible for maintaining access to your trusted devices, vault passphrase, and recovery materials.
          </p>
          <div className="p-3 border border-[#ffb4ab]/30 bg-[#93000a]/20 font-space-mono text-[11px] text-[#ffb4ab] space-y-1.5">
            <p className="font-bold uppercase tracking-wider">IMPORTANT — YOUR RECOVERY RESPONSIBILITY</p>
            <p>
              Because Nook cannot access your vault's encryption keys, Nook support cannot reset your vault passphrase or decrypt your files on your behalf.
            </p>
            <p>
              If you lose access to all trusted devices and lose your recovery phrase, your encrypted vault may be permanently unrecoverable. Keep your recovery phrase somewhere secure.
            </p>
          </div>
          <p className="text-[13px] text-[#969088]">
            Nook provides storage infrastructure and security mechanisms, but cannot guarantee recovery of data when the cryptographic credentials required to access that data have been permanently lost.
          </p>
          <p className="font-space-mono text-[11px] text-[#636363] pt-2 border-t border-[#4b4640]">
            The service is provided as-is, subject to these Terms and Nook's zero-knowledge architecture.
          </p>
        </div>
      ),
    },
  };

  const current = contentMap[type];

  return (
    <div className="fixed inset-0 z-50 bg-[#0f0e0d]/85 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className={`bg-[#141312] w-full ${type === 'faq' ? 'max-w-2xl' : 'max-w-lg'} border border-[#4b4640] shadow-2xl flex flex-col max-h-[92dvh] sm:max-h-[90vh] rounded-t-xl sm:rounded-none overflow-hidden`}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-[#4b4640] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0">
              {current.icon}
            </div>
            <div>
              <h3 className="font-garamond text-[20px] sm:text-[24px] font-bold text-[#e6e2e0] leading-none">
                {current.title}
              </h3>
              <p className="font-space-mono text-[10px] text-[#636363] tracking-widest uppercase mt-1">
                {current.subtitle}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#636363] hover:text-[#e6e2e0] transition cursor-pointer touch-manipulation"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content — scrollable */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6">
          {current.body}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-3 sm:p-4 border-t border-[#4b4640] shrink-0">
          <button
            onClick={onClose}
            className="px-5 py-2.5 bg-[#e6e1df] text-[#1d1b1a] hover:bg-[#cac6c3] font-space-mono text-[11px] font-bold uppercase tracking-widest transition cursor-pointer touch-manipulation"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
