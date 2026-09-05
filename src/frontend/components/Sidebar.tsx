/**
 * Nook Editorial Sidebar Navigation with Storage Quota Status Indicator
 */

import React from 'react';
import { Folder, Shield, Smartphone, Fingerprint, Activity, Key, HardDrive } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { formatBytes } from './FileGrid';

export type SidebarTab = 'files' | 'devices' | 'passkeys' | 'audit' | 'recovery';

interface SidebarProps {
  activeTab: SidebarTab;
  onTabChange: (tab: SidebarTab) => void;
  filesCount: number;
  foldersCount: number;
}

export function Sidebar({ activeTab, onTabChange, filesCount, foldersCount }: SidebarProps) {
  const { user } = useAuth();

  const usedBytes = user?.storageUsedBytes || 0;
  const defaultQuota = user?.id === 'user_ae71159c13ca4ba78b0b24ccd827a5b3' ? 2147483648 : 524288000;
  const quotaBytes = user?.storageQuotaBytes || defaultQuota;
  const percentUsed = quotaBytes > 0 ? Math.min(100, Math.round((usedBytes / quotaBytes) * 100)) : 0;

  return (
    <>
      {/* Mobile Top Navigation Bar (Phone Screens) */}
      <div className="relative md:hidden w-full bg-[#0f0e0d] border-b border-[#4b4640]">
        <div className="w-full px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 font-space-mono text-[12px] no-scrollbar">
          <button
            onClick={() => onTabChange('files')}
            className={`flex items-center gap-2 px-3 py-2 shrink-0 border border-[#4b4640] transition cursor-pointer ${activeTab === 'files'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold border-[#e6e1df]'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
              }`}
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Files ({filesCount + foldersCount})</span>
          </button>

          <button
            onClick={() => onTabChange('devices')}
            className={`flex items-center gap-2 px-3 py-2 shrink-0 border border-[#4b4640] transition cursor-pointer ${activeTab === 'devices'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold border-[#e6e1df]'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
              }`}
          >
            <Smartphone className="w-3.5 h-3.5" />
            <span>Devices</span>
          </button>

          <button
            onClick={() => onTabChange('passkeys')}
            className={`flex items-center gap-2 px-3 py-2 shrink-0 border border-[#4b4640] transition cursor-pointer ${activeTab === 'passkeys'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold border-[#e6e1df]'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
              }`}
          >
            <Fingerprint className="w-3.5 h-3.5" />
            <span>Passkeys</span>
          </button>

          <button
            onClick={() => onTabChange('audit')}
            className={`flex items-center gap-2 px-3 py-2 shrink-0 border border-[#4b4640] transition cursor-pointer ${activeTab === 'audit'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold border-[#e6e1df]'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
              }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Audit</span>
          </button>

          <button
            onClick={() => onTabChange('recovery')}
            className={`flex items-center gap-2 px-3 py-2 shrink-0 border border-[#4b4640] transition cursor-pointer ${activeTab === 'recovery'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold border-[#e6e1df]'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] bg-[#141312]'
              }`}
          >
            <Key className="w-3.5 h-3.5 text-[#EAB308]" />
            <span>Recovery</span>
          </button>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-[#0f0e0d] to-transparent pointer-events-none" />
      </div>

      {/* Desktop Sidebar (Laptop / Tablet Screens) */}
      <aside className="w-64 bg-[#0f0e0d] border-r border-[#4b4640] flex flex-col h-full p-6 space-y-2 hidden md:flex shrink-0 overflow-y-auto">
        {/* Brand Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 border border-[#4b4640] flex items-center justify-center bg-[#201f1e]">
              <Shield className="w-5 h-5 text-[#cac6c3]" />
            </div>
            <div>
              <h2 className="font-garamond text-[22px] text-[#cac6c3] leading-none">Nook</h2>
              <p className="font-space-mono text-[10px] text-[#cdc5bd] tracking-widest mt-1 uppercase">ZERO-KNOWLEDGE</p>
            </div>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 space-y-1.5 font-space-mono text-[13px]">
          <button
            onClick={() => onTabChange('files')}
            className={`w-full flex justify-between items-center px-4 py-2.5 transition cursor-pointer ${activeTab === 'files'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e]'
              }`}
          >
            <div className="flex items-center gap-3">
              <Folder className="w-4.5 h-4.5" />
              <span>Vault Files</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.5 ${activeTab === 'files' ? 'bg-[#141312] text-[#e6e2e0]' : 'bg-[#201f1e] text-[#cdc5bd]'}`}>
              {filesCount + foldersCount}
            </span>
          </button>

          <button
            onClick={() => onTabChange('devices')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition cursor-pointer ${activeTab === 'devices'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e]'
              }`}
          >
            <Smartphone className="w-4.5 h-4.5" />
            <span>Trusted Devices</span>
          </button>

          <button
            onClick={() => onTabChange('passkeys')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition cursor-pointer ${activeTab === 'passkeys'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e]'
              }`}
          >
            <Fingerprint className="w-4.5 h-4.5" />
            <span className="whitespace-nowrap">Passkeys</span>
          </button>

          <button
            onClick={() => onTabChange('audit')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition cursor-pointer ${activeTab === 'audit'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e]'
              }`}
          >
            <Activity className="w-4.5 h-4.5" />
            <span>Audit Trail</span>
          </button>

          <button
            onClick={() => onTabChange('recovery')}
            className={`w-full flex items-center gap-3 px-4 py-2.5 transition cursor-pointer ${activeTab === 'recovery'
              ? 'bg-[#e6e1df] text-[#1d1b1a] font-bold'
              : 'text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e]'
              }`}
          >
            <Key className="w-4.5 h-4.5 text-[#EAB308]" />
            <span>Recovery Kit</span>
          </button>
        </nav>

        {/* Storage Quota Footer Card */}
        <div className="pt-6 space-y-3 mt-auto">
          <div className="p-4 border border-[#4b4640] bg-[#0f0e0d]">
            <div className="flex justify-between items-center mb-2">
              <span className="font-space-mono text-[11px] text-[#e6e2e0] flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-[#cac6c3]" />
                Vault Quota
              </span>
              <span className="font-space-mono text-[11px] text-[#cdc5bd]">{percentUsed}%</span>
            </div>
            <div className="w-full bg-[#201f1e] h-1 mb-2">
              <div className="bg-[#cac6c3] h-1 transition-all" style={{ width: `${percentUsed}%` }} />
            </div>
            <div className="flex justify-between items-center font-space-mono text-[10px] text-[#cdc5bd]">
              <span>{formatBytes(usedBytes)} used</span>
              <span>{formatBytes(quotaBytes)} total</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
