import { useEffect, useState } from "react";
import axios from "axios";
import { getToken, removeToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";

interface LogEntry {
  fileName: string;
  downloadedBy: string;
  downloadedAt: string;
}

// ── MOBILE BOTTOM NAV ──
function MobileNav({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const navItems = [
    { label: "Home",     icon: "⬛", path: "/dashboard" },
    { label: "Files",    icon: "🗂️", path: "/myfiles" },
    { label: "Analytics",icon: "📊", path: "/analytics" },
    { label: "Logs",     icon: "📝", path: "/logs" },
  ];
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 flex sm:hidden bg-[#0c0c0c]">
      {navItems.map((item) => (
        <button key={item.path} onClick={() => navigate(item.path)}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-mono text-white/40 hover:text-white transition">
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        const res = await axios.get(`${import.meta.env.VITE_API_URL}/files/logs`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setLogs(res.data.logs);
        setTimeout(() => setMounted(true), 80);
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const uniqueFiles = new Set(logs.map((l) => l.fileName)).size;
  const uniqueUsers = new Set(logs.map((l) => l.downloadedBy)).size;
  const today = new Date().toDateString();
  const todayCount = logs.filter(
    (l) => new Date(l.downloadedAt).toDateString() === today
  ).length;

  const filtered = logs
    .filter(
      (l) =>
        l.fileName.toLowerCase().includes(search.toLowerCase()) ||
        l.downloadedBy.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const diff = new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime();
      return sortOrder === "newest" ? diff : -diff;
    });

  const grouped: Record<string, LogEntry[]> = {};
  filtered.forEach((log) => {
    const dateKey = new Date(log.downloadedAt).toDateString();
    if (!grouped[dateKey]) grouped[dateKey] = [];
    grouped[dateKey].push(log);
  });
  const groupedDates = Object.keys(grouped);

  const navItems = [
    { label: "Dashboard",      icon: "⬛", path: "/dashboard" },
    { label: "My Files",       icon: "🗂️", path: "/myfiles" },
    { label: "Shared Files",   icon: "📂", path: "/sharedfiles" },
    { label: "Analytics",      icon: "📊", path: "/analytics" },
    { label: "Logs",           icon: "📝", path: "/logs", active: true },
    { label: "Granted Access", icon: "🔑", path: "/grantaccess" },
  ];

  if (loading) return (
    <div className="fixed inset-0 bg-[#080808] flex items-center justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-3 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:0.6s]" />
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 flex bg-[#080808] text-white overflow-hidden">

      {/* MOBILE SIDEBAR OVERLAY */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-30 bg-black/60 sm:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* SIDEBAR */}
      <div className={`
        fixed z-40 w-60 h-full bg-[#0c0c0c] border-r border-white/5
        flex flex-col justify-between py-8 px-5 shrink-0
        transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
      `}>
        <div>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">CC</div>
            <span className="font-clash text-lg font-medium">Consent<span className="text-white/40">Chain</span></span>
          </div>
          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-white/20 font-mono uppercase tracking-widest mb-2 px-3">Navigation</div>
            {navItems.map((item) => (
              <span key={item.path} onClick={() => { navigate(item.path); setSidebarOpen(false); }}
                className={`font-mono text-[13px] px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center gap-2
                  ${item.active ? "bg-white/10 text-white" : "text-gray-500 hover:text-white hover:bg-white/5"}`}>
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>
        <span onClick={() => { removeToken(); navigate("/"); }}
          className="font-mono text-[13px] text-red-500/80 hover:text-red-400 px-3 py-2.5 rounded-xl hover:bg-red-500/10 cursor-pointer transition flex items-center gap-2">
          🚪 Logout
        </span>
      </div>

      {/* MAIN */}
      <div className="flex-1 overflow-y-auto w-full sm:ml-60 pb-20 sm:pb-0">
        <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-5 sm:space-y-8 max-w-5xl mx-auto">

          {/* HEADER */}
          <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
            <div className="flex items-start sm:items-end justify-between gap-3">
              <div className="flex items-start gap-3">
                {/* Mobile hamburger */}
                <button
                  className="sm:hidden mt-1 p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white transition shrink-0"
                  onClick={() => setSidebarOpen(true)}>
                  <span className="text-base">☰</span>
                </button>
                <div>
                  <p className="text-[10px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-1">Audit Trail</p>
                  <h1 className="text-2xl sm:text-4xl font-clash font-semibold tracking-tight">Download Logs</h1>
                  <p className="text-white/20 text-xs sm:text-sm font-mono mt-1">Every file download across your account</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs font-mono text-white/20 border border-white/5 px-3 py-1.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse inline-block" />
                <span className="hidden xs:inline">{logs.length} records</span>
                <span className="xs:hidden">{logs.length}</span>
              </div>
            </div>
          </div>

          {/* STAT CARDS — 2x2 on mobile, 4-col on lg */}
          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
            {[
              { label: "Total Downloads", value: logs.length,   icon: "⬇️", color: "text-blue-400",   border: "border-blue-400/10",   bg: "bg-blue-400/5"   },
              { label: "Unique Files",    value: uniqueFiles,   icon: "📁", color: "text-indigo-400", border: "border-indigo-400/10", bg: "bg-indigo-400/5" },
              { label: "Unique Users",    value: uniqueUsers,   icon: "👤", color: "text-purple-400", border: "border-purple-400/10", bg: "bg-purple-400/5" },
              { label: "Today",           value: todayCount,    icon: "📅", color: "text-green-400",  border: "border-green-400/10",  bg: "bg-green-400/5"  },
            ].map((s, i) => (
              <div key={s.label}
                style={{ transitionDelay: `${120 + i * 60}ms` }}
                className={`border ${s.border} ${s.bg} rounded-2xl p-4 sm:p-5 transition-all duration-700 ${mounted ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
                <div className="text-xl sm:text-2xl mb-2 sm:mb-3">{s.icon}</div>
                <div className={`text-2xl sm:text-3xl font-clash font-bold ${s.color}`}>{s.value}</div>
                <div className="text-white/30 text-[10px] sm:text-xs font-mono mt-1">{s.label}</div>
              </div>
            ))}
          </div>

          {/* SEARCH + SORT */}
          <div className={`transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
            {/* Stack on mobile, row on sm+ */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
              {/* Search */}
              <div className="flex-1 relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/20 text-sm">🔍</span>
                <input
                  type="text"
                  placeholder="Search by file or user…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-[#0e0e0e] border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-indigo-500/40 transition"
                />
              </div>
              {/* Sort + count row */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setSortOrder((p) => (p === "newest" ? "oldest" : "newest"))}
                  className="flex-1 sm:flex-none flex items-center justify-center gap-2 text-xs font-mono px-4 py-2.5 bg-[#0e0e0e] border border-white/5 rounded-xl text-white/40 hover:text-white hover:border-white/10 transition whitespace-nowrap"
                >
                  {sortOrder === "newest" ? "↓ Newest" : "↑ Oldest"}
                </button>
                <span className="text-[11px] font-mono text-white/20 shrink-0">
                  {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>
          </div>

          {/* LOG GROUPS */}
          <div className={`space-y-6 sm:space-y-8 transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24 text-white/20">
                <div className="text-5xl mb-4">🪵</div>
                <p className="font-mono text-sm">No logs found</p>
              </div>
            ) : (
              groupedDates.map((dateKey) => (
                <div key={dateKey}>
                  {/* Date group header */}
                  <div className="flex items-center gap-3 mb-3 sm:mb-4">
                    <span className="text-[10px] font-mono text-white/20 uppercase tracking-widest whitespace-nowrap">
                      {dateKey === today
                        ? "Today"
                        : dateKey === new Date(Date.now() - 86400000).toDateString()
                        ? "Yesterday"
                        : dateKey}
                    </span>
                    <div className="flex-1 h-px bg-white/5" />
                    <span className="text-[10px] font-mono text-white/10 whitespace-nowrap">
                      {grouped[dateKey].length} download{grouped[dateKey].length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  {/* Log rows */}
                  <div className="space-y-2">
                    {grouped[dateKey].map((log, i) => (
                      <div key={i}
                        style={{ transitionDelay: `${i * 30}ms` }}
                        className={`group bg-[#0e0e0e] border border-white/5 rounded-2xl hover:border-blue-400/20 hover:bg-blue-400/5 transition-all duration-300 ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>

                        {/* ── DESKTOP ROW (sm+) ── */}
                        <div className="hidden sm:flex items-center gap-4 px-6 py-4">
                          {/* Icon */}
                          <div className="w-9 h-9 rounded-xl bg-blue-400/10 border border-blue-400/15 flex items-center justify-center text-sm shrink-0">
                            ⬇️
                          </div>
                          {/* File name */}
                          <div className="flex-1 min-w-0">
                            <p className="font-mono text-sm text-white truncate">{log.fileName}</p>
                            <p className="text-[11px] font-mono text-white/20 mt-0.5">File</p>
                          </div>
                          {/* Divider */}
                          <div className="w-px h-8 bg-white/5 shrink-0" />
                          {/* User */}
                          <div className="w-48 min-w-0">
                            <div className="flex items-center gap-2">
                              <div className="w-6 h-6 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-[10px] font-mono text-indigo-400 shrink-0">
                                {log.downloadedBy.charAt(0).toUpperCase()}
                              </div>
                              <p className="font-mono text-sm text-white/70 truncate">{log.downloadedBy}</p>
                            </div>
                            <p className="text-[11px] font-mono text-white/20 mt-0.5 pl-8">Downloaded by</p>
                          </div>
                          {/* Divider */}
                          <div className="w-px h-8 bg-white/5 shrink-0" />
                          {/* Time */}
                          <div className="text-right shrink-0">
                            <p className="font-mono text-sm text-white/50">
                              {new Date(log.downloadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            <p className="text-[11px] font-mono text-white/20 mt-0.5">
                              {new Date(log.downloadedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </div>

                        {/* ── MOBILE CARD (below sm) ── */}
                        <div className="sm:hidden px-4 py-3 space-y-2.5">
                          {/* File row */}
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-xl bg-blue-400/10 border border-blue-400/15 flex items-center justify-center text-xs shrink-0">
                              ⬇️
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-mono text-xs text-white truncate">{log.fileName}</p>
                              <p className="text-[10px] font-mono text-white/20">File</p>
                            </div>
                            {/* Time — top right on mobile */}
                            <div className="text-right shrink-0">
                              <p className="font-mono text-xs text-white/50">
                                {new Date(log.downloadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                          </div>
                          {/* User row */}
                          <div className="flex items-center gap-2 pl-11">
                            <div className="w-5 h-5 rounded-full bg-indigo-500/20 border border-indigo-500/20 flex items-center justify-center text-[9px] font-mono text-indigo-400 shrink-0">
                              {log.downloadedBy.charAt(0).toUpperCase()}
                            </div>
                            <p className="font-mono text-xs text-white/50 truncate">{log.downloadedBy}</p>
                            <span className="text-[10px] font-mono text-white/20 ml-auto shrink-0">
                              {new Date(log.downloadedAt).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="h-4" />
        </div>
      </div>

      {/* MOBILE BOTTOM NAV */}
      <MobileNav navigate={navigate} />
    </div>
  );
}