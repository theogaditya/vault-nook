import React from 'react';
import { InfoModalType } from './InfoModal';

interface SiteFooterProps {
  onSelectInfo: (type: InfoModalType) => void;
}

export function SiteFooter({ onSelectInfo }: SiteFooterProps) {
  return (
    <footer className="bg-[#141312] w-full border-t border-[#4b4640]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-8 px-6 md:px-10 py-12 w-full max-w-screen-2xl mx-auto">
        <div className="font-garamond text-[32px] text-[#e6e2e0] leading-none">
          Nook
        </div>
        <nav className="flex flex-wrap items-center gap-6 font-space-mono text-[11px] font-bold text-[#cdc5bd] uppercase tracking-widest">
          <button onClick={() => onSelectInfo('faq')} className="hover:text-[#EAB308] transition-colors cursor-pointer text-[#EAB308]">FAQ</button>
          <button onClick={() => onSelectInfo('about')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">About</button>
          <button onClick={() => onSelectInfo('contact')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">Contact</button>
          <button onClick={() => onSelectInfo('privacy')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">Privacy</button>
          <button onClick={() => onSelectInfo('terms')} className="hover:text-[#e6e2e0] transition-colors cursor-pointer">Terms</button>
        </nav>
      </div>
      <div className="px-6 md:px-10 pb-8 max-w-screen-2xl mx-auto border-t border-[#4b4640]/40 pt-6">
        <p className="font-space-mono text-[12px] text-[#969088]">
          © 2026 Nook. Your device is the key. Zero-Knowledge Architecture.
        </p>
      </div>
    </footer>
  );
}
