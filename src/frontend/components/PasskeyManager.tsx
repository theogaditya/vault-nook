/**
 * Registered Passkeys Management — Nook Editorial Design
 * Manages WebAuthn Hardware Passkeys (Touch ID, Face ID, YubiKey - Max 3 Limit).
 */

import React, { useEffect, useState } from 'react';
import { Key, Fingerprint, Plus, Trash2, CheckCircle2, ShieldAlert, RefreshCw, Calendar, Clock, Info } from 'lucide-react';
import { apiRequest } from '../api/client';
import { useAuth } from '../hooks/useAuth';

export interface DeviceItem {
  id: string;
  name: string;
  credential_id: string;
  counter: number;
  created_at: number;
  last_seen_at: number;
  revoked_at?: number | null;
}

export function PasskeyManager() {
  const { registerAdditionalPasskey } = useAuth();
  const [devices, setDevices] = useState<DeviceItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDeviceName, setNewDeviceName] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchPasskeys = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/devices');
      setDevices(res.devices || []);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to fetch passkeys' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchPasskeys(); }, []);

  const handleRegisterPasskey = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsRegistering(true);
    setMessage(null);
    try {
      await registerAdditionalPasskey(newDeviceName.trim() || 'Trusted Passkey Device');
      setMessage({ type: 'success', text: 'Successfully registered new WebAuthn Passkey device!' });
      setNewDeviceName('');
      await fetchPasskeys();
    } catch (err: any) {
      const msg = (err?.message || '').toLowerCase();
      if (msg.includes('already registered') || msg.includes('invalidstateerror')) {
        setMessage({
          type: 'success',
          text: 'This device is already authorized and bound to your vault passkey credential. Your active session is connected.'
        });
      } else {
        setMessage({ type: 'error', text: err?.message || 'Failed to register Passkey device' });
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleRevokePasskey = async (id: string) => {
    if (!confirm('Are you sure you want to revoke this hardware passkey? Access using this passkey credential will be terminated.')) return;
    try {
      await apiRequest(`/api/devices/${id}`, { method: 'DELETE' });
      setMessage({ type: 'success', text: 'HARDWARE PASSKEY revoked successfully.' });
      await fetchPasskeys();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || 'Failed to revoke passkey' });
    }
  };

  const truncateId = (id: string) => {
    if (id.length <= 16) return id;
    return `${id.slice(0, 8)}...${id.slice(-6)}`;
  };

  const activePasskeys = devices.filter(d => !d.revoked_at);
  const isPasskeyLimitReached = activePasskeys.length >= 3;

  return (
    <div className="space-y-6 max-w-4xl w-full px-2 sm:px-0">
      {/* Header */}
      <div className="pb-4 sm:pb-6 border-b border-[#4b4640] flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
        <div>
          <h2 className="font-garamond text-[24px] sm:text-[30px] md:text-[40px] leading-[1.1] text-[#e6e2e0] mb-2 sm:mb-3">
            Registered Passkeys
          </h2>
          <p className="font-sans text-[13px] sm:text-[14px] text-[#cdc5bd]">
            Manage WebAuthn hardware passkeys (Touch ID, Face ID, YubiKey) with strict 3-passkey limit.
          </p>
        </div>
        <button
          onClick={fetchPasskeys}
          disabled={loading}
          title="Refresh Registered Passkeys"
          className="p-2 border border-[#4b4640] text-[#e6e2e0] hover:bg-[#363433] hover:border-[#cac6c3] transition-colors flex items-center justify-center rounded-full cursor-pointer disabled:opacity-50 shrink-0 self-start"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Mini Security Architecture Context Card */}
      <div className="p-3 sm:p-5 border border-[#4b4640] bg-[#141312] rounded-none space-y-2 sm:space-y-3">
        <div className="flex items-center gap-2 text-[#ffcc80] font-space-mono text-[10px] sm:text-[12px] font-bold tracking-widest uppercase">
          <Info className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span>WebAuthn Hardware Passkeys (Max 3)</span>
        </div>
        <div className="pt-1 font-sans text-[12px] sm:text-[13px] text-[#cdc5bd]">
          <div className="p-2 sm:p-3 border border-[#4b4640]/60 bg-[#0f0e0d]">
            <span className="font-space-mono text-[10px] sm:text-[11px] font-bold text-[#ffcc80] block mb-1">Hardware Passkeys &amp; Biometrics</span>
            <span className="text-[11px] sm:text-[12px]">WebAuthn credentials bound to device hardware security (Touch ID, Face ID, Windows Hello, YubiKey). Zero-knowledge cryptographic proof without transmitting master secrets.</span>
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

      {/* Registered WebAuthn Passkeys List */}
      <div className="border border-[#4b4640]">
        <div className="px-3 sm:px-6 py-3 sm:py-4 border-b border-[#4b4640] flex justify-between items-center bg-[#181716] flex-wrap gap-2">
          <span className="font-space-mono text-[9px] sm:text-[11px] font-bold tracking-widest text-[#ffcc80] uppercase">
            Passkeys ({activePasskeys.length} / 3)
          </span>
          <span className="font-space-mono text-[8px] sm:text-[10px] text-[#ffcc80] font-bold">WEBAUTHN KEYS</span>
        </div>

        {loading ? (
          <div className="p-6 sm:p-10 text-center font-space-mono text-[12px] sm:text-[13px] text-[#636363]">Loading passkeys...</div>
        ) : devices.length === 0 ? (
          <div className="p-6 sm:p-10 text-center font-space-mono text-[12px] sm:text-[13px] text-[#636363]">No hardware passkeys registered yet.</div>
        ) : (
          <div className="divide-y divide-[#4b4640]">
            {devices.map((device) => (
              <div key={device.id} className="px-3 sm:px-6 py-4 sm:py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 border border-[#4b4640] bg-[#201f1e] flex items-center justify-center shrink-0 mt-0.5">
                    <Fingerprint className="w-4 h-4 sm:w-5 sm:h-5 text-[#ffcc80]" />
                  </div>
                  <div className="space-y-1.5 min-w-0 flex-1">
                    <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                      <h4 className="font-sans text-[14px] sm:text-[16px] font-bold text-[#e6e2e0] truncate">{device.name}</h4>
                      {device.revoked_at ? (
                        <span className="px-1.5 sm:px-2 py-0.5 border border-[#ffb4ab]/40 text-[#ffb4ab] font-space-mono text-[8px] sm:text-[10px] font-bold tracking-widest uppercase whitespace-nowrap">
                          REVOKED
                        </span>
                      ) : (
                        <span className="px-1.5 sm:px-2 py-0.5 border border-[#ffcc80]/40 text-[#ffcc80] font-space-mono text-[8px] sm:text-[10px] font-bold tracking-widest uppercase whitespace-nowrap">
                          PASSKEY
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 sm:gap-4 font-space-mono text-[10px] sm:text-[11px] text-[#969088]">
                      <span className="flex items-center gap-1.5">
                        <Fingerprint className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="truncate">Cred: {truncateId(device.credential_id)}</span>
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Calendar className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        <span className="hidden sm:inline">Registered: </span>{new Date(device.created_at).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1.5 w-full sm:w-auto">
                        <Clock className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                        Last Active: {new Date(device.last_seen_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {!device.revoked_at && (
                  <button
                    onClick={() => handleRevokePasskey(device.id)}
                    className="font-space-mono text-[10px] sm:text-[11px] text-[#ffb4ab] hover:text-[#e6e2e0] transition-colors cursor-pointer flex items-center gap-1.5 self-start sm:self-auto shrink-0"
                  >
                    <Trash2 className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                    <span>Revoke</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Register Passkey Form */}
      <div className="border border-[#4b4640] p-4 sm:p-6">
        <div className="flex items-center justify-between gap-2 mb-5 flex-wrap">
          <div className="flex items-center gap-2">
            <Key className="w-3.5 h-3.5 text-[#cac6c3]" />
            <span className="font-space-mono text-[11px] font-bold tracking-widest text-[#cdc5bd] uppercase">
              Add New WebAuthn Passkey
            </span>
          </div>
          <span className="font-space-mono text-[11px] font-bold tracking-widest text-[#EAB308]">
            {activePasskeys.length} / 3 Connected Passkeys
          </span>
        </div>

        {isPasskeyLimitReached ? (
          <div className="p-4 border border-[#EAB308]/30 bg-[#EAB308]/10 text-[#EAB308] font-space-mono text-[12px] flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>Passkey limit reached (3 / 3). Revoke an existing passkey above to register a new hardware key.</span>
          </div>
        ) : (
          <div className="mb-4">
            <label className="block font-space-mono text-[11px] text-[#969088] uppercase tracking-widest mb-2">
              Device Name / OS
            </label>
            <form onSubmit={handleRegisterPasskey} className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={newDeviceName}
                onChange={(e) => setNewDeviceName(e.target.value)}
                placeholder="e.g. Android Chrome / Pixel 8"
                autoComplete="off"
                inputMode="text"
                spellCheck={false}
                className="flex-1 bg-[#0f0e0d] border border-[#4b4640] px-4 py-3 font-space-mono text-[13px] text-[#e6e2e0] placeholder-[#636363] focus:outline-none focus:border-[#cac6c3] transition-colors"
              />
              <button
                type="submit"
                disabled={isRegistering || isPasskeyLimitReached}
                className="px-6 py-3 border border-[#e6e2e0] text-[#e6e2e0] hover:bg-[#e6e2e0] hover:text-[#0e0d0c] font-space-mono text-[11px] font-bold tracking-widest uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2 shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>{isRegistering ? 'Registering...' : '+ Register Passkey'}</span>
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}
