/**
 * Security Audit Log Viewer — Nook Editorial Design with Pagination (Max 50 Logs)
 */

import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ShieldCheck, RefreshCw } from 'lucide-react';
import { apiRequest } from '../api/client';

export interface AuditItem {
  id: string;
  event_type: string;
  ip_address?: string;
  timestamp: number;
  details?: string;
}

const EVENT_CONFIG: Record<string, { label: string; color: string; borderColor: string; bgColor: string }> = {
  LOGIN_SUCCESS: { label: 'LOGIN', color: 'text-[#a5d6a7]', borderColor: 'border-[#a5d6a7]/40', bgColor: 'bg-transparent' },
  DEVICE_REGISTERED: { label: 'DEVICE', color: 'text-[#90caf9]', borderColor: 'border-[#90caf9]/40', bgColor: 'bg-transparent' },
  DEVICE_REVOKED: { label: 'REVOKED', color: 'text-[#ffb4ab]', borderColor: 'border-[#ffb4ab]/40', bgColor: 'bg-[#93000a]/20' },
  SESSION_REVOKED: { label: 'REVOKED', color: 'text-[#ffb4ab]', borderColor: 'border-[#ffb4ab]/40', bgColor: 'bg-[#93000a]/20' },
  FILE_UPLOADED: { label: 'UPLOAD', color: 'text-[#cdc5bd]', borderColor: 'border-[#4b4640]', bgColor: 'bg-transparent' },
  FILE_DOWNLOADED: { label: 'DOWNLOAD', color: 'text-[#cdc5bd]', borderColor: 'border-[#4b4640]', bgColor: 'bg-transparent' },
  FILE_DELETED: { label: 'DELETED', color: 'text-[#ffcc80]', borderColor: 'border-[#ffcc80]/40', bgColor: 'bg-transparent' },
};

function getEventBadge(eventType: string) {
  const cfg = EVENT_CONFIG[eventType];
  if (cfg) {
    return (
      <span className={`inline-block px-2 py-0.5 border font-space-mono text-[10px] font-bold tracking-widest ${cfg.color} ${cfg.borderColor} ${cfg.bgColor}`}>
        {cfg.label}
      </span>
    );
  }
  return (
    <span className="inline-block px-2 py-0.5 border border-[#4b4640] font-space-mono text-[10px] font-bold tracking-widest text-[#969088]">
      {eventType}
    </span>
  );
}

const PAGE_SIZE = 5;
const MAX_TOTAL_LOGS = 50;

export function AuditLogViewer() {
  const [logs, setLogs] = useState<AuditItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await apiRequest('/api/audit');
      const recentLogs = (res.logs || []).slice(0, MAX_TOTAL_LOGS);
      setLogs(recentLogs);
    } catch { }
    setLoading(false);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const totalLogs = Math.min(logs.length, MAX_TOTAL_LOGS);
  const totalPages = Math.max(1, Math.ceil(totalLogs / PAGE_SIZE));
  const startIndex = (currentPage - 1) * PAGE_SIZE;
  const currentLogs = logs.slice(startIndex, startIndex + PAGE_SIZE);

  return (
    <div className="w-full max-w-4xl space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#4b4640]">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="font-garamond text-[40px] md:text-[52px] leading-[1.1] text-[#e6e2e0] mb-3">
              Security Audit Log
            </h2>
            <p className="font-sans text-[15px] text-[#cdc5bd] max-w-2xl">
              Timestamped security audit trail. Older events beyond 50 records are automatically purged.
            </p>
          </div>
          <div className="flex items-center gap-3 shrink-0 self-start mt-2">
            <div className="font-space-mono text-[11px] text-[#cdc5bd] border border-[#4b4640] px-3 py-2 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#a5d6a7]" />
              <span>RETAINING 50 RECENT LOGS</span>
            </div>
            <button
              onClick={fetchLogs}
              disabled={loading}
              title="Refresh Security Audit Log"
              className="p-2 border border-[#4b4640] text-[#e6e2e0] hover:bg-[#363433] hover:border-[#cac6c3] transition-colors flex items-center justify-center rounded-full cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Log Entries */}
      <div className="border border-[#4b4640] divide-y divide-[#4b4640]">
        {loading ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">Loading security logs...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center font-space-mono text-[13px] text-[#636363]">No security audit events recorded yet.</div>
        ) : (
          currentLogs.map((log) => (
            <div key={log.id} className="p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:bg-[#201f1e] transition-colors">
              {/* Badge */}
              <div className="shrink-0 w-28">
                {getEventBadge(log.event_type)}
              </div>

              {/* Details */}
              <div className="flex-1 min-w-0">
                <p className="font-sans text-[15px] text-[#e6e2e0] mb-0.5">
                  {log.details || log.event_type}
                </p>
              </div>

              {/* Timestamp */}
              <span className="font-space-mono text-[12px] text-[#969088] shrink-0">
                {new Date(log.timestamp).toLocaleString()}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Pagination Bar */}
      {!loading && logs.length > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 font-space-mono text-[12px] text-[#cdc5bd]">
          <div>
            Showing <span className="text-[#e6e2e0] font-bold">{startIndex + 1}</span> -{' '}
            <span className="text-[#e6e2e0] font-bold">{Math.min(startIndex + PAGE_SIZE, totalLogs)}</span> of{' '}
            <span className="text-[#e6e2e0] font-bold">{totalLogs}</span> events
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-[#4b4640] hover:border-[#cac6c3] text-[#e6e2e0] disabled:opacity-30 disabled:hover:border-[#4b4640] transition cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="px-3 py-1.5 border border-[#4b4640] bg-[#0f0e0d] text-[11px]">
              PAGE {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-2 border border-[#4b4640] hover:border-[#cac6c3] text-[#e6e2e0] disabled:opacity-30 disabled:hover:border-[#4b4640] transition cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
