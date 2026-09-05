/**
 * Active Sessions Management — Nook Editorial Design
 */

import React, { useEffect, useState } from 'react';
import { ShieldAlert, LogOut, CheckCircle2, Globe, Smartphone, Laptop } from 'lucide-react';
import { apiRequest } from '../api/client';
import { parseUserAgent } from './DeviceManager';

export interface SessionItem {
  id: string;
  deviceName: string;
  ip_address?: string;
  user_agent?: string;
  created_at: number;
  last_seen_at: number;
  isCurrent: boolean;
}

export function SessionManager() {
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/sessions');
      setSessions(res.sessions || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch active sessions' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessions(); }, []);

  const handleRevokeSingle = async (sessionId: string) => {
    try {
      await apiRequest(`/api/sessions/${sessionId}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'Session terminated successfully.' });
      await fetchSessions();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to terminate session' });
    }
  };

  const handleRevokeAllOthers = async () => {
    if (!confirm('Are you sure you want to terminate all other active sessions?')) return;
    try {
      const res = await apiRequest('/api/sessions/revoke-others', { method: 'DELETE' });
      setMessage({ type: 'success', text: `Terminated ${res.revokedCount} active sessions.` });
      await fetchSessions();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to revoke other sessions' });
    }
  };

  return (
    <div className="space-y-8 max-w-4xl">
      {/* Header */}
      <div className="pb-6 border-b border-[#4b4640]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 flex-wrap mb-2">
              <h2 className="font-garamond text-[34px] sm:text-[40px] md:text-[52px] leading-[1.1] text-[#e6e2e0]">
                Active Vault Sessions
              </h2>
              <span className="font-space-mono text-[11px] font-bold tracking-widest text-[#EAB308] border border-[#EAB308]/40 px-2.5 py-1 bg-[#EAB308]/10">
                {sessions.length} / 3 Active Sessions
              </span>
            </div>
            <p className="font-sans text-[14px] sm:text-[15px] text-[#cdc5bd] max-w-2xl">
              Monitor and revoke active device sessions holding valid HTTP session tokens across your devices.
            </p>
          </div>
          {sessions.filter(s => !s.isCurrent).length > 0 && (
            <button
              onClick={handleRevokeAllOthers}
              className="font-space-mono text-[11px] font-bold tracking-widest uppercase text-[#ffb4ab] border border-[#ffb4ab]/30 px-4 py-2.5 hover:bg-[#93000a]/20 transition-colors cursor-pointer flex items-center gap-2 shrink-0 self-start mt-2"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Revoke All Other Sessions</span>
            </button>
          )}
        </div>
      </div>

      {/* Feedback */}
      {message && (
        <div className={`p-4 border font-space-mono text-[12px] flex items-center gap-2.5 ${
          message.type === 'success'
            ? 'border-[#a5d6a7]/40 bg-[#a5d6a7]/5 text-[#a5d6a7]'
            : 'border-[#ffb4ab]/30 bg-[#93000a]/20 text-[#ffb4ab]'
        }`}>
          {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <ShieldAlert className="w-4 h-4 shrink-0" />}
          <span>{message.text}</span>
        </div>
      )}

      {/* Column Headers */}
      {!loading && sessions.length > 0 && (
        <div className="hidden sm:grid grid-cols-3 border-b border-[#4b4640] pb-3">
          <span className="font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase">Device Signature</span>
          <span className="font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase">Network Data</span>
          <span className="font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase text-right">Chronology</span>
        </div>
      )}

      {/* Sessions List */}
      <div className="border border-[#4b4640] divide-y divide-[#4b4640]">
        {loading ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">Loading active sessions...</div>
        ) : sessions.length === 0 ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">No active sessions found.</div>
        ) : (
          sessions.map((session) => {
            const uaMeta = parseUserAgent(session.user_agent || '');
            const displayName = session.deviceName !== 'Passkey Authorized Device' && session.deviceName !== 'Unknown Device'
              ? session.deviceName
              : uaMeta.label;

            return (
              <div key={session.id} className="p-4 sm:px-6 sm:py-5 grid grid-cols-1 sm:grid-cols-3 items-start sm:items-center gap-4">
                {/* Device Signature Column */}
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0">
                    {uaMeta.isMobile ? (
                      <Smartphone className="w-4 h-4 text-[#EAB308]" />
                    ) : (
                      <Laptop className="w-4 h-4 text-[#cac6c3]" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="font-sans text-[14px] font-bold text-[#e6e2e0] truncate">{displayName}</span>
                    </div>
                    {session.isCurrent ? (
                      <span className="inline-block px-2 py-0.5 border border-[#a5d6a7]/40 bg-[#a5d6a7]/10 text-[#a5d6a7] font-space-mono text-[9px] font-bold tracking-widest uppercase mb-1">
                        Current Device
                      </span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 border border-[#4b4640] bg-[#201f1e] text-[#cdc5bd] font-space-mono text-[9px] font-bold tracking-widest uppercase mb-1">
                        Active Session
                      </span>
                    )}
                    <p className="font-space-mono text-[10px] text-[#636363] uppercase tracking-widest">
                      Auth_Method: Web_Authn
                    </p>
                  </div>
                </div>

                {/* Network Data Column */}
                <div>
                  <p className="font-space-mono text-[11px] text-[#cdc5bd] break-all">
                    <span className="text-[#636363] text-[10px] block uppercase tracking-widest mb-1">Origin IP</span>
                    {session.ip_address || '127.0.0.1'}
                  </p>
                </div>

                {/* Chronology Column */}
                <div className="text-left sm:text-right">
                  <span className="font-space-mono text-[10px] text-[#636363] uppercase tracking-widest block mb-1">Last Active</span>
                  <span className="font-space-mono text-[12px] text-[#cdc5bd]">
                    {new Date(session.last_seen_at).toLocaleString()}
                  </span>
                  {!session.isCurrent && (
                    <button
                      onClick={() => handleRevokeSingle(session.id)}
                      className="mt-2 font-space-mono text-[10px] text-[#ffb4ab] hover:text-[#e6e2e0] transition-colors cursor-pointer flex items-center gap-1 sm:ml-auto"
                    >
                      <LogOut className="w-3 h-3" />
                      <span>Terminate</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* End of Record */}
      {!loading && sessions.length > 0 && (
        <div className="text-center py-4">
          <span className="font-space-mono text-[10px] text-[#4b4640] uppercase tracking-widest">End_Of_Record</span>
        </div>
      )}
    </div>
  );
}
