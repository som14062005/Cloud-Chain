import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";
import { useParams, useNavigate } from "react-router-dom";

type LogEntry = {
  type: string;
  by: string;
  to?: string;
  at: string;
};

const LOG_META: Record<string, { label: string; color: string; bg: string; border: string; icon: string; dot: string }> = {
  download: {
    label: "Downloaded",
    color: "text-blue-400",
    bg: "bg-blue-400/5",
    border: "border-blue-400/15",
    icon: "⬇️",
    dot: "bg-blue-400",
  },
  granted: {
    label: "Access Granted",
    color: "text-green-400",
    bg: "bg-green-400/5",
    border: "border-green-400/15",
    icon: "🔓",
    dot: "bg-green-400",
  },
  revoked: {
    label: "Access Revoked",
    color: "text-red-400",
    bg: "bg-red-400/5",
    border: "border-red-400/15",
    icon: "🚫",
    dot: "bg-red-400",
  },
  expired: {
    label: "Access Expired",
    color: "text-amber-400",
    bg: "bg-amber-400/5",
    border: "border-amber-400/15",
    icon: "⏰",
    dot: "bg-amber-400",
  },
};

const FileLogs = () => {
  const { fileId } = useParams();
  const navigate = useNavigate();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revokedUsers, setRevokedUsers] = useState<Set<string>>(new Set());
  const [expiredUsers, setExpiredUsers] = useState<Set<string>>(new Set());
  const [revoking, setRevoking] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const [confirmRevoke, setConfirmRevoke] = useState<string | null>(null);

  useEffect(() => { fetchLogs(); }, [fileId]);

  const fetchLogs = async () => {
    try {
      const token = getToken();
      const res = await axios.get(`http://localhost:3000/files/logs/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setLogs(res.data.logs);
      const revoked = new Set<string>();
      const expired = new Set<string>();
      for (const log of res.data.logs) {
        if (log.type === "revoked" && log.to) revoked.add(log.to);
        if (log.type === "expired" && log.to) expired.add(log.to);
      }
      setRevokedUsers(revoked);
      setExpiredUsers(expired);
      setTimeout(() => setMounted(true), 80);
    } catch {
      setError("Failed to fetch logs or access denied");
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (toEmail: string) => {
    if (!fileId) return;
    setRevoking(toEmail);
    try {
      const token = getToken();
      await axios.post("http://localhost:3000/files/revoke",
        { toEmail, fileId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchLogs();
    } catch {
      alert("Failed to revoke access.");
    } finally {
      setRevoking(null);
      setConfirmRevoke(null);
    }
  };

  // Stats
  const stats = {
    total: logs.length,
    downloads: logs.filter((l) => l.type === "download").length,
    granted: logs.filter((l) => l.type === "granted").length,
    revoked: logs.filter((l) => l.type === "revoked").length,
  };

  const filteredLogs = filter === "all" ? logs : logs.filter((l) => l.type === filter);

  if (loading) return (
    <div className="w-screen h-screen bg-[#080808] flex items-center justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-3 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:0.6s]" />
      </div>
    </div>
  );

  if (error) return (
    <div className="w-screen h-screen bg-[#080808] flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4">⚠️</div>
        <p className="text-red-400 font-mono text-sm">{error}</p>
      </div>
    </div>
  );

  return (
    <div className="w-screen h-screen flex bg-[#080808] text-white overflow-hidden">

      {/* ── SIDEBAR ── */}
      <div className="w-60 h-full bg-[#0c0c0c] border-r border-white/5 flex flex-col justify-between py-8 px-5 shrink-0">
        <div>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">CC</div>
            <span className="font-clash text-lg font-medium">Consent<span className="text-white/40">Chain</span></span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-white/20 font-mono uppercase tracking-widest mb-2 px-3">Navigation</div>
            {[
              { label: "Dashboard", icon: "⬛", path: "/dashboard" },
              { label: "My Files", icon: "🗂️", path: "/myfiles" },
              { label: "Shared Files", icon: "📂", path: "/sharedfiles" },
              { label: "Analytics", icon: "📊", path: "/analytics" },
              { label: "Logs", icon: "📝", path: "/logs" },
              { label: "Granted Access", icon: "📝", path: "/grantaccess" },
            ].map((item) => (
              <span key={item.path} onClick={() => navigate(item.path)}
                className="font-mono text-[13px] px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center gap-2 text-gray-500 hover:text-white hover:bg-white/5">
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>
        <span onClick={() => navigate("/")}
          className="font-mono text-[13px] text-red-500/80 hover:text-red-400 px-3 py-2.5 rounded-xl hover:bg-red-500/10 cursor-pointer transition flex items-center gap-2">
          🚪 Logout
        </span>
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 overflow-y-auto px-10 py-10 space-y-8">

        {/* Header */}
        <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          <div className="flex items-center justify-between">
            <div>
              <button onClick={() => navigate(-1)}
                className="flex items-center gap-1.5 text-white/20 hover:text-white text-xs font-mono mb-3 transition group">
                <span className="group-hover:-translate-x-1 transition-transform">←</span> Back
              </button>
              <p className="text-[10px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-1">File Activity</p>
              <h1 className="text-4xl font-clash font-semibold tracking-tight">Access Logs</h1>
              <p className="text-white/20 text-sm font-mono mt-1">
                Full audit trail for file <span className="text-indigo-400/60">{fileId}</span>
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-white/20 border border-white/5 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              {logs.length} events
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className={`grid grid-cols-4 gap-4 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          {[
            { label: "Total Events", value: stats.total, icon: "📋", color: "text-white", border: "border-white/5", bg: "bg-white/5" },
            { label: "Downloads", value: stats.downloads, icon: "⬇️", color: "text-blue-400", border: "border-blue-400/10", bg: "bg-blue-400/5" },
            { label: "Granted", value: stats.granted, icon: "🔓", color: "text-green-400", border: "border-green-400/10", bg: "bg-green-400/5" },
            { label: "Revoked", value: stats.revoked, icon: "🚫", color: "text-red-400", border: "border-red-400/10", bg: "bg-red-400/5" },
          ].map((s, i) => (
            <div key={s.label}
              style={{ transitionDelay: `${120 + i * 60}ms` }}
              className={`border ${s.border} ${s.bg} rounded-2xl p-5 transition-all duration-700 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
              <div className="text-2xl mb-3">{s.icon}</div>
              <div className={`text-3xl font-clash font-bold ${s.color}`}>{s.value}</div>
              <div className="text-white/30 text-xs font-mono mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── FILTER TABS ── */}
        <div className={`flex items-center gap-2 transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          {["all", "download", "granted", "revoked", "expired"].map((f) => (
            <button key={f} onClick={() => setFilter(f)}
              className={`text-xs font-mono px-4 py-1.5 rounded-full border transition-all
                ${filter === f
                  ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-400"
                  : "border-white/5 text-white/20 hover:text-white/50 hover:border-white/10"}`}>
              {f === "all" ? "All Events" : LOG_META[f]?.label ?? f}
            </button>
          ))}
          <span className="ml-auto text-[11px] font-mono text-white/20">
            {filteredLogs.length} result{filteredLogs.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* ── TIMELINE ── */}
        <div className={`transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          {filteredLogs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-white/20">
              <div className="text-5xl mb-4">🪵</div>
              <p className="font-mono text-sm">No activity found</p>
            </div>
          ) : (
            <div className="relative">
              {/* vertical line */}
              <div className="absolute left-[19px] top-0 bottom-0 w-px bg-white/5" />

              <div className="flex flex-col gap-4">
                {filteredLogs.map((log, i) => {
                  const meta = LOG_META[log.type] ?? {
                    label: log.type, color: "text-white/50",
                    bg: "bg-white/5", border: "border-white/5",
                    icon: "📌", dot: "bg-white/30",
                  };
                  const canRevoke =
                    log.type === "granted" &&
                    log.to &&
                    !revokedUsers.has(log.to) &&
                    !expiredUsers.has(log.to);

                  return (
                    <div key={i}
                      style={{ transitionDelay: `${i * 40}ms` }}
                      className={`flex items-start gap-4 transition-all duration-500 ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>

                      {/* Timeline dot */}
                      <div className="relative z-10 mt-4 shrink-0">
                        <div className={`w-10 h-10 rounded-full ${meta.bg} border ${meta.border} flex items-center justify-center text-base`}>
                          {meta.icon}
                        </div>
                      </div>

                      {/* Card */}
                      <div className={`flex-1 ${meta.bg} border ${meta.border} rounded-2xl px-6 py-4 transition-all hover:brightness-110`}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            {/* Type badge */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className={`text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border ${meta.color} ${meta.border} ${meta.bg}`}>
                                {meta.label}
                              </span>
                              <span className="text-[10px] font-mono text-white/20">
                                #{String(logs.length - i).padStart(3, "0")}
                              </span>
                            </div>

                            {/* Main text */}
                            <p className="font-mono text-sm text-white/70">
                              {log.type === "download" && (
                                <><span className="text-white/30">by </span><span className="text-white">{log.by}</span></>
                              )}
                              {log.type === "granted" && (
                                <><span className="text-white/30">to </span><span className="text-white">{log.to}</span><span className="text-white/30"> by </span><span className="text-white/50">{log.by}</span></>
                              )}
                              {log.type === "revoked" && (
                                <><span className="text-white/30">from </span><span className="text-white">{log.to}</span></>
                              )}
                              {log.type === "expired" && (
                                <><span className="text-white/30">for </span><span className="text-white">{log.to}</span></>
                              )}
                            </p>

                            {/* Timestamp */}
                            <p className="text-[11px] font-mono text-white/20 mt-1.5">
                              🕐 {new Date(log.at).toLocaleString()}
                            </p>
                          </div>

                          {/* Revoke button / status badge */}
                          <div className="shrink-0 mt-1">
                            {canRevoke ? (
                              confirmRevoke === log.to ? (
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] font-mono text-white/30">Sure?</span>
                                  <button onClick={() => handleRevoke(log.to!)}
                                    disabled={revoking === log.to}
                                    className="text-[11px] font-mono px-3 py-1 bg-red-500/20 border border-red-500/30 text-red-400 rounded-full hover:bg-red-500/30 transition disabled:opacity-50">
                                    {revoking === log.to ? "Revoking…" : "Yes, Revoke"}
                                  </button>
                                  <button onClick={() => setConfirmRevoke(null)}
                                    className="text-[11px] font-mono px-3 py-1 border border-white/5 text-white/20 rounded-full hover:text-white/50 transition">
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <button onClick={() => setConfirmRevoke(log.to!)}
                                  className="text-[11px] font-mono px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400/70 rounded-full hover:bg-red-500/20 hover:text-red-400 transition">
                                  Revoke
                                </button>
                              )
                            ) : log.type === "granted" && log.to && revokedUsers.has(log.to) ? (
                              <span className="text-[11px] font-mono px-3 py-1 bg-white/5 border border-white/5 text-white/20 rounded-full">
                                Revoked
                              </span>
                            ) : log.type === "granted" && log.to && expiredUsers.has(log.to) ? (
                              <span className="text-[11px] font-mono px-3 py-1 bg-amber-400/5 border border-amber-400/10 text-amber-400/50 rounded-full">
                                Expired
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div className="h-4" />
      </div>
    </div>
  );
};

export default FileLogs;
