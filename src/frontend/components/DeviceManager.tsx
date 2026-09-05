/**
 * Trusted Devices & Sessions Management — Nook Editorial Design
 * Manages 2 Security Pillars: Physical Devices (Max 3) and Live Sessions (Max 3).
 */

import React, { useEffect, useState } from 'react';
import { Laptop, Smartphone, Globe, Trash2, CheckCircle2, ShieldAlert, Calendar, Clock, LogOut, RefreshCw, Info, HardDrive } from 'lucide-react';
import { apiRequest } from '../api/client';

export interface SessionItem {
  id: string;
  device_id?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: number;
  last_seen_at: number;
  revoked_at?: number | null;
}

export interface PhysicalDeviceItem {
  id: string;
  name: string;
  device_fingerprint: string;
  user_agent?: string;
  ip_address?: string;
  created_at: number;
  last_seen_at: number;
  revoked_at?: number | null;
}

export function parseUserAgent(ua: string): { os: string; browser: string; label: string; isMobile: boolean } {
  if (!ua) return { os: 'Unknown OS', browser: 'Browser', label: 'Web Browser', isMobile: false };

  let os = 'Unknown OS';
  let isMobile = false;

  if (/android/i.test(ua)) {
    os = 'Android';
    isMobile = true;
  } else if (/iphone/i.test(ua)) {
    os = 'iPhone';
    isMobile = true;
  } else if (/ipad/i.test(ua)) {
    os = 'iPad';
    isMobile = true;
  } else if (/macintosh|mac os x/i.test(ua)) {
    os = 'macOS';
  } else if (/windows/i.test(ua)) {
    os = 'Windows';
  } else if (/linux/i.test(ua)) {
    os = 'Linux';
  }

  let browser = 'Browser';
  if (/edg/i.test(ua)) browser = 'Edge';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  return { os, browser, label: `${os} / ${browser}`, isMobile };
}

export function DeviceManager() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [physicalDevices, setPhysicalDevices] = useState<PhysicalDeviceItem[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchDevices = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/devices');
      setSessions(res.sessions || []);
      setPhysicalDevices(res.physicalDevices || []);
      if (res.currentSessionId) setCurrentSessionId(res.currentSessionId);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch devices' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDevices(); }, []);

  const handleRevokeItem = async (id: string, type: 'session' | 'physical') => {
    const labels = { session: 'active session', physical: 'registered physical device' };
    if (!confirm(`Are you sure you want to revoke this ${labels[type]}? Access from this device will be terminated.`)) return;
    try {
      await apiRequest(`/api/devices/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: `${labels[type].toUpperCase()} revoked successfully.` });
      await fetchDevices();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to revoke' });
    }
  };

  const activeSessions = sessions.filter(s => !s.revoked_at);
  const activePhysical = physicalDevices.filter(p => !p.revoked_at);

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-6 border-b border-[#4b4640] flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <h2 className="font-garamond text-[30px] sm:text-[40px] md:text-[52px] leading-[1.1] text-[#e6e2e0] mb-3">
            Trusted Security Devices &amp; Sessions
          </h2>
          <p className="font-sans text-[14px] sm:text-[15px] text-[#cdc5bd] max-w-2xl">
            Manage your registered physical devices and active browser sessions with strict 3-device ceilings.
          </p>
        </div>
        <button
          onClick={fetchDevices}
          disabled={loading}
          title="Refresh Trusted Devices & Sessions"
          className="p-2.5 border border-[#4b4640] text-[#e6e2e0] hover:bg-[#363433] hover:border-[#cac6c3] transition-colors flex items-center justify-center rounded-full cursor-pointer disabled:opacity-50 shrink-0 self-start mt-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Mini Security Architecture Context Card */}
      <div className="p-5 border border-[#4b4640] bg-[#141312] rounded-none space-y-3">
        <div className="flex items-center gap-2 text-[#EAB308] font-space-mono text-[12px] font-bold tracking-widest uppercase">
          <Info className="w-4 h-4" />
          <span>Security Controls Breakdown (Max 3 Limit Each)</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1 font-sans text-[13px] text-[#cdc5bd]">
          <div className="p-3 border border-[#4b4640]/60 bg-[#0f0e0d]">
            <span className="font-space-mono text-[11px] font-bold text-[#a5d6a7] block mb-1">1. Registered Devices (Max 3)</span>
            Persistent physical hardware (PCs, phones) registered to your vault. Stays registered even when logged out.
          </div>
          <div className="p-3 border border-[#4b4640]/60 bg-[#0f0e0d]">
            <span className="font-space-mono text-[11px] font-bold text-[#8c9eff] block mb-1">2. Active Sessions (Max 3)</span>
            Live HTTP browser logins active right now. Revoking a session immediately logs out that browser.
          </div>
        </div>
      </div>

      {/* Feedback Alert */}
      {message && (
        <div className={`p-4 border font-space-mono text-[12px] flex items-center gap-2.5 ${
          message.type === 'success'
            ? 'border-[#a5d6a7]/40 bg-[#a5d6a7]/5 text-[#a5d6a7]'
            : 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]'
        }`}>
          {message.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <ShieldAlert className="w-4 h-4 shrink-0" />
          }
          <span>{message.text}</span>
        </div>
      )}

      {/* 1. Persistent Registered Physical Devices List */}
      <div className="border border-[#4b4640]">
        <div className="px-6 py-4 border-b border-[#4b4640] flex justify-between items-center bg-[#181716] flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-[#a5d6a7]" />
            <span className="font-space-mono text-[11px] font-bold tracking-widest text-[#e6e2e0] uppercase">
              Registered Physical Devices ({activePhysical.length} / 3 Registered)
            </span>
          </div>
          <span className="font-space-mono text-[10px] text-[#a5d6a7] font-bold">PERSISTENT HARDWARE REGISTRY</span>
        </div>

        {loading ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">Loading physical devices...</div>
        ) : activePhysical.length === 0 ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">No physical devices registered yet.</div>
        ) : (
          <div className="divide-y divide-[#4b4640]">
            {activePhysical.map((device) => {
              const uaMeta = parseUserAgent(device.user_agent || '');
              const isSessionActive = activeSessions.some(s => s.user_agent === device.user_agent);
              return (
                <div key={device.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0 mt-0.5">
                      {uaMeta.isMobile ? (
                        <Smartphone className="w-5 h-5 text-[#a5d6a7]" />
                      ) : (
                        <Laptop className="w-5 h-5 text-[#a5d6a7]" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-sans text-[16px] font-bold text-[#e6e2e0]">{device.name || uaMeta.label}</h4>
                        {isSessionActive ? (
                          <span className="px-2 py-0.5 border border-[#a5d6a7]/40 bg-[#a5d6a7]/10 text-[#a5d6a7] font-space-mono text-[10px] font-bold tracking-widest uppercase">
                            LOGGED IN (ACTIVE)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-[#4b4640] bg-[#201f1e] text-[#969088] font-space-mono text-[10px] font-bold tracking-widest uppercase">
                            LOGGED OUT (REGISTERED)
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 font-space-mono text-[11px] text-[#969088]">
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3" />
                          IP: {device.ip_address || '127.0.0.1'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          First Connected: {new Date(device.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Last Seen: {new Date(device.last_seen_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => handleRevokeItem(device.id, 'physical')}
                    className="font-space-mono text-[11px] text-[#ffb4ab] hover:text-[#e6e2e0] transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Revoke Device</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. Active Logged-In Device Sessions */}
      <div className="border border-[#4b4640]">
        <div className="px-6 py-4 border-b border-[#4b4640] flex justify-between items-center bg-[#181716] flex-wrap gap-2">
          <span className="font-space-mono text-[11px] font-bold tracking-widest text-[#8c9eff] uppercase">
            Active Logged-In Sessions ({activeSessions.length} / 3 Active)
          </span>
          <span className="font-space-mono text-[10px] text-[#8c9eff] font-bold">LIVE HTTP TOKENS</span>
        </div>

        {loading ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">Loading active sessions...</div>
        ) : activeSessions.length === 0 ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">No active sessions found.</div>
        ) : (
          <div className="divide-y divide-[#4b4640]">
            {activeSessions.map((session) => {
              const uaMeta = parseUserAgent(session.user_agent || '');
              const isCurrent = session.id === currentSessionId;
              return (
                <div key={session.id} className="px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0 mt-0.5">
                      {uaMeta.isMobile ? (
                        <Smartphone className="w-5 h-5 text-[#8c9eff]" />
                      ) : (
                        <Laptop className="w-5 h-5 text-[#8c9eff]" />
                      )}
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h4 className="font-sans text-[16px] font-bold text-[#e6e2e0]">{uaMeta.label}</h4>
                        {isCurrent ? (
                          <span className="px-2 py-0.5 border border-[#a5d6a7]/40 bg-[#a5d6a7]/10 text-[#a5d6a7] font-space-mono text-[10px] font-bold tracking-widest uppercase">
                            CURRENT DEVICE
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 border border-[#4b4640] bg-[#201f1e] text-[#cdc5bd] font-space-mono text-[10px] font-bold tracking-widest uppercase">
                            ACTIVE SESSION
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-4 font-space-mono text-[11px] text-[#969088]">
                        <span className="flex items-center gap-1.5">
                          <Globe className="w-3 h-3" />
                          IP: {session.ip_address || '127.0.0.1'}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Calendar className="w-3 h-3" />
                          Logged In: {new Date(session.created_at).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="w-3 h-3" />
                          Last Active: {new Date(session.last_seen_at).toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => handleRevokeItem(session.id, 'session')}
                      className="font-space-mono text-[11px] text-[#ffb4ab] hover:text-[#e6e2e0] transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      <span>Revoke Session</span>
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
