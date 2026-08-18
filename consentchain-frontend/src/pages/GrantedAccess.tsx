import { useEffect, useState } from "react";
import axios from "axios";
import { getToken, removeToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";

interface GrantedItem {
  accessId: string;
  fileId: string;
  fileName: string;
  mimetype: string;
  sharedWith: string;
  sharedWithName: string;
  grantedAt: string;
  expiryTime: string | null;
  status: "active" | "expired" | "no expiry";
  remaining: string | null;
}

const AnimatedNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 40) || 1;

    const timer = setInterval(() => {
      start += step;
      if (start >= value) {
        setDisplay(value);
        clearInterval(timer);
      } else {
        setDisplay(start);
      }
    }, 30);

    return () => clearInterval(timer);
  }, [value]);

  return <span>{display}</span>;
};

function MobileNav({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  const navItems = [
    { label: "Home", icon: "⬛", path: "/dashboard" },
    { label: "Files", icon: "🗂️", path: "/myfiles" },
    { label: "Analytics", icon: "📊", path: "/analytics" },
    { label: "Granted", icon: "📤", path: "/granted" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-white/10 flex sm:hidden bg-[#0c0c0c]">
      {navItems.map((item) => (
        <button
          key={item.path}
          onClick={() => navigate(item.path)}
          className="flex-1 flex flex-col items-center justify-center py-3 gap-1 text-[10px] font-mono text-white/40 hover:text-white transition"
        >
          <span className="text-lg">{item.icon}</span>
          {item.label}
        </button>
      ))}
    </div>
  );
}

function StatusBadge({ status }: { status: GrantedItem["status"] }) {
  if (status === "active") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-green-400/10 border border-green-400/20 text-green-400 text-[10px] font-mono whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse shrink-0" />
        Active
      </span>
    );
  }

  if (status === "expired") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-400/10 border border-red-400/20 text-red-400 text-[10px] font-mono whitespace-nowrap">
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
        Expired
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-400/10 border border-purple-400/20 text-purple-400 text-[10px] font-mono whitespace-nowrap">
      <span className="w-1.5 h-1.5 rounded-full bg-purple-400 shrink-0" />
      Permanent
    </span>
  );
}

export default function GrantedAccess() {
  const [granted, setGranted] = useState<GrantedItem[]>([]);
  const [filtered, setFiltered] = useState<GrantedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fileFilter, setFileFilter] = useState("all");
  const [visible, setVisible] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [editingAccess, setEditingAccess] = useState<GrantedItem | null>(null);
  const [newExpiry, setNewExpiry] = useState("");
  const [noExpiry, setNoExpiry] = useState(false);
  const [updating, setUpdating] = useState(false);

  const [revokingAccess, setRevokingAccess] = useState<GrantedItem | null>(null);
  const [revoking, setRevoking] = useState(false);

  const navigate = useNavigate();
  const apiUrl = import.meta.env.VITE_API_URL;

  const getAuthHeaders = () => {
    const token = getToken();
    if (!token) {
      removeToken();
      navigate("/");
      throw new Error("Unauthorized");
    }
    return { Authorization: `Bearer ${token}` };
  };

  const handleUnauthorized = () => {
    removeToken();
    navigate("/");
  };

  const fetchGranted = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/files/granted`, {
        headers: getAuthHeaders(),
      });

      const grantedList = res.data.granted || [];
      setGranted(grantedList);
      setFiltered(grantedList);
      setTimeout(() => setVisible(true), 100);
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
      } else {
        console.error("Failed to fetch granted access", err);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGranted();
  }, []);

  useEffect(() => {
    setFiltered(
      fileFilter === "all"
        ? granted
        : granted.filter((g) => g.fileId === fileFilter)
    );
  }, [fileFilter, granted]);

  const uniqueFiles = Array.from(
    new Map(granted.map((g) => [g.fileId, g.fileName])).entries()
  );

  const activeCount = granted.filter((g) => g.status === "active").length;
  const expiredCount = granted.filter((g) => g.status === "expired").length;
  const permanentCount = granted.filter((g) => g.status === "no expiry").length;

  const handleRevoke = async () => {
    if (!revokingAccess) return;

    setRevoking(true);
    try {
      await axios.post(
        `${apiUrl}/files/revoke`,
        {
          fileId: revokingAccess.fileId,
          toEmail: revokingAccess.sharedWith,
        },
        {
          headers: getAuthHeaders(),
        }
      );

      setRevokingAccess(null);
      await fetchGranted();
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
      } else {
        alert(err.response?.data?.error || "Revoke failed");
      }
    } finally {
      setRevoking(false);
    }
  };

  const openEditModal = (item: GrantedItem) => {
    setEditingAccess(item);
    setNoExpiry(false);
    setNewExpiry(
      item.expiryTime
        ? new Date(item.expiryTime).toISOString().slice(0, 16)
        : ""
    );
  };

  const closeEditModal = () => {
    setEditingAccess(null);
    setNewExpiry("");
    setNoExpiry(false);
  };

  const handleUpdateExpiry = async () => {
    if (!editingAccess) return;

    if (noExpiry && !editingAccess.expiryTime) {
      alert("No expiry exists to remove.");
      return;
    }

    if (!noExpiry && !newExpiry) {
      alert("Please select a new expiry date.");
      return;
    }

    setUpdating(true);
    try {
      const res = await axios.post(
        `${apiUrl}/files/update-expiry`,
        {
          accessId: editingAccess.accessId,
          expiryTime: noExpiry ? null : new Date(newExpiry).toISOString(),
        },
        {
          headers: getAuthHeaders(),
        }
      );

      alert(res.data.message);
      closeEditModal();
      await fetchGranted();
    } catch (err: any) {
      if (axios.isAxiosError(err) && err.response?.status === 401) {
        handleUnauthorized();
      } else {
        alert(err.response?.data?.error || "Update failed");
      }
    } finally {
      setUpdating(false);
    }
  };

  const fileIcon = (mime: string) => {
    if (mime === "application/pdf") return "📄";
    if (mime.startsWith("image/")) return "🖼️";
    if (mime.startsWith("video/")) return "🎥";
    if (mime.startsWith("audio/")) return "🎵";
    return "📁";
  };

  const anim = (delay = 0) =>
    `transition-all duration-700 ${
      visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"
    } delay-[${delay}ms]`;

  const navItems = [
    { label: "Dashboard", icon: "⬛", path: "/dashboard" },
    { label: "My Files", icon: "🗂️", path: "/myfiles" },
    { label: "Shared Files", icon: "📂", path: "/sharedfiles" },
    { label: "Analytics", icon: "📊", path: "/analytics" },
    { label: "Logs", icon: "📝", path: "/logs" },
    { label: "Granted Access", icon: "📤", path: "/granted", active: true },
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 bg-[#080808] flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
          <div className="absolute inset-3 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:0.6s]" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 flex bg-[#080808] text-white overflow-hidden">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/60 sm:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <div
        className={`
          fixed z-40 w-60 h-full bg-[#0c0c0c] border-r border-white/5
          flex flex-col justify-between py-8 px-5 shrink-0
          transition-transform duration-300 ease-in-out
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full sm:translate-x-0"}
        `}
      >
        <div>
          <div className="flex items-center gap-2 mb-10">
            <div className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm">
              CC
            </div>
            <span className="font-clash text-lg font-medium">
              Consent<span className="text-white/40">Chain</span>
            </span>
          </div>

          <div className="flex flex-col gap-1">
            <div className="text-[10px] text-white/20 font-mono uppercase tracking-widest mb-2 px-3">
              Navigation
            </div>

            {navItems.map((item) => (
              <span
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setSidebarOpen(false);
                }}
                className={`font-mono text-[13px] px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center gap-2 ${
                  item.active
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-white hover:bg-white/5"
                }`}
              >
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>

        <span
          onClick={() => {
            removeToken();
            navigate("/");
          }}
          className="font-mono text-[13px] text-red-500/80 hover:text-red-400 px-3 py-2.5 rounded-xl hover:bg-red-500/10 cursor-pointer transition flex items-center gap-2"
        >
          🚪 Logout
        </span>
      </div>

      <div className="flex-1 overflow-y-auto w-full sm:ml-60 pb-20 sm:pb-0">
        <div className="px-4 sm:px-6 lg:px-10 py-6 sm:py-10 space-y-5 sm:space-y-8 max-w-7xl mx-auto">
          <div className={anim(0)}>
            <div className="flex items-start sm:items-end justify-between gap-3">
              <div className="flex items-start gap-3">
                <button
                  className="sm:hidden mt-1 p-2 rounded-lg border border-white/10 bg-white/5 text-white/60 hover:text-white transition shrink-0"
                  onClick={() => setSidebarOpen(true)}
                >
                  <span className="text-base">☰</span>
                </button>

                <div>
                  <p className="text-[10px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-1">
                    Access Control
                  </p>
                  <h1 className="text-2xl sm:text-4xl font-clash font-semibold tracking-tight">
                    Granted Access
                  </h1>
                  <p className="text-white/30 text-xs sm:text-sm font-mono mt-1">
                    Manage who has access to your files
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-mono text-white/20 border border-white/5 px-3 py-1.5 rounded-full shrink-0">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
                <span className="hidden xs:inline">Live data</span>
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 ${anim(100)}`}>
            {[
              {
                label: "Total Grants",
                value: granted.length,
                icon: "📤",
                color: "text-indigo-400",
                border: "border-indigo-400/10",
                bg: "bg-indigo-400/5",
              },
              {
                label: "Active",
                value: activeCount,
                icon: "✅",
                color: "text-green-400",
                border: "border-green-400/10",
                bg: "bg-green-400/5",
              },
              {
                label: "Expired",
                value: expiredCount,
                icon: "⌛",
                color: "text-red-400",
                border: "border-red-400/10",
                bg: "bg-red-400/5",
              },
              {
                label: "Permanent",
                value: permanentCount,
                icon: "♾️",
                color: "text-purple-400",
                border: "border-purple-400/10",
                bg: "bg-purple-400/5",
              },
            ].map((s, i) => (
              <div
                key={s.label}
                style={{ transitionDelay: `${120 + i * 60}ms` }}
                className={`border ${s.border} ${s.bg} rounded-2xl p-4 sm:p-5 transition-all duration-700 ${
                  visible ? "opacity-100 scale-100" : "opacity-0 scale-95"
                }`}
              >
                <div className="text-xl sm:text-2xl mb-2 sm:mb-3">{s.icon}</div>
                <div className={`text-2xl sm:text-3xl font-clash font-bold ${s.color}`}>
                  <AnimatedNumber value={s.value} />
                </div>
                <div className="text-white/30 text-[10px] sm:text-xs font-mono mt-1">
                  {s.label}
                </div>
              </div>
            ))}
          </div>

          <div className={`bg-[#0e0e0e] border border-white/5 rounded-2xl overflow-hidden ${anim(300)}`}>
            <div className="flex items-center justify-between px-4 sm:px-6 py-4 sm:py-5 border-b border-white/5 gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase mb-0.5">
                  Records
                </p>
                <h2 className="text-base sm:text-lg font-clash font-semibold truncate">
                  {fileFilter === "all"
                    ? "All Grants"
                    : uniqueFiles.find(([id]) => id === fileFilter)?.[1]}
                </h2>
              </div>

              {uniqueFiles.length > 1 && (
                <select
                  value={fileFilter}
                  onChange={(e) => setFileFilter(e.target.value)}
                  className="bg-[#1a1a1a] border border-white/10 text-white/70 text-xs font-mono rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-500/50 cursor-pointer shrink-0 max-w-[160px]"
                >
                  <option value="all">All Files</option>
                  {uniqueFiles.map(([id, name]) => (
                    <option key={id} value={id}>
                      {name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-white/20">
                <div className="text-5xl mb-4">📭</div>
                <p className="font-mono text-sm">No grants found</p>
                <p className="font-mono text-xs mt-1 text-white/10">
                  {fileFilter !== "all"
                    ? "No access granted for this file"
                    : "You haven't shared any files yet"}
                </p>
              </div>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-[10px] font-mono text-white/20 uppercase tracking-widest border-b border-white/5">
                        <th className="px-6 py-3 text-left">File</th>
                        <th className="px-6 py-3 text-left">Shared With</th>
                        <th className="px-6 py-3 text-left">Granted At</th>
                        <th className="px-6 py-3 text-left">Expiry</th>
                        <th className="px-6 py-3 text-left">Status</th>
                        <th className="px-6 py-3 text-left">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((item) => (
                        <tr
                          key={item.accessId}
                          className="border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors group"
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className="text-lg shrink-0">{fileIcon(item.mimetype)}</span>
                              <span className="font-mono text-xs text-white/70 group-hover:text-white transition-colors truncate max-w-[140px]">
                                {item.fileName}
                              </span>
                            </div>
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-mono text-xs text-white/70">
                              {item.sharedWithName}
                            </div>
                            <div className="font-mono text-[11px] text-white/25 mt-0.5">
                              {item.sharedWith}
                            </div>
                          </td>

                          <td className="px-6 py-4 font-mono text-[11px] text-white/30">
                            {new Date(item.grantedAt).toLocaleString()}
                          </td>

                          <td className="px-6 py-4">
                            {item.expiryTime ? (
                              <>
                                <div className="font-mono text-[11px] text-white/40">
                                  {new Date(item.expiryTime).toLocaleString()}
                                </div>
                                {item.remaining && (
                                  <div className="font-mono text-[11px] text-blue-400 mt-0.5">
                                    ⏱ {item.remaining}
                                  </div>
                                )}
                              </>
                            ) : (
                              <span className="font-mono text-[11px] text-purple-400/60 italic">
                                Permanent
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            <StatusBadge status={item.status} />
                          </td>

                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => openEditModal(item)}
                                className="px-3 py-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-[11px] font-mono transition-all hover:scale-105"
                              >
                                ✏️ Edit
                              </button>
                              <button
                                onClick={() => setRevokingAccess(item)}
                                className="px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-[11px] font-mono transition-all hover:scale-105"
                              >
                                🗑️ Revoke
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden flex flex-col divide-y divide-white/[0.04]">
                  {filtered.map((item) => (
                    <div key={item.accessId} className="px-4 py-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xl shrink-0">{fileIcon(item.mimetype)}</span>
                          <span className="font-mono text-xs text-white/80 truncate">
                            {item.fileName}
                          </span>
                        </div>
                        <StatusBadge status={item.status} />
                      </div>

                      <div className="flex items-start justify-between gap-2 text-[11px] font-mono">
                        <span className="text-white/30 shrink-0">Shared with</span>
                        <div className="text-right min-w-0">
                          <div className="text-white/70 truncate">{item.sharedWithName}</div>
                          <div className="text-white/25 truncate">{item.sharedWith}</div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-white/30">Granted</span>
                        <span className="text-white/40">
                          {new Date(item.grantedAt).toLocaleString()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono">
                        <span className="text-white/30">Expiry</span>
                        {item.expiryTime ? (
                          <div className="text-right">
                            <div className="text-white/40">
                              {new Date(item.expiryTime).toLocaleString()}
                            </div>
                            {item.remaining && (
                              <div className="text-blue-400">⏱ {item.remaining}</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-purple-400/60 italic">Permanent</span>
                        )}
                      </div>

                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => openEditModal(item)}
                          className="flex-1 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 hover:bg-indigo-500/20 text-xs font-mono transition"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setRevokingAccess(item)}
                          className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-mono transition"
                        >
                          🗑️ Revoke
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="h-4" />
        </div>
      </div>

      <MobileNav navigate={navigate} />

      {editingAccess && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:px-4">
          <div className="bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 sm:p-7 w-full sm:max-w-md">
            <p className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase mb-1">
              Access Control
            </p>
            <h2 className="text-lg sm:text-xl font-clash font-semibold mb-4">
              Edit Access Duration
            </h2>

            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 mb-5 space-y-1">
              <div className="flex justify-between text-xs font-mono gap-3">
                <span className="text-white/30 shrink-0">File</span>
                <span className="text-white/60 truncate text-right">
                  {editingAccess.fileName}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono gap-3">
                <span className="text-white/30 shrink-0">Shared with</span>
                <span className="text-white/60 truncate text-right">
                  {editingAccess.sharedWith}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono gap-3">
                <span className="text-white/30 shrink-0">Current expiry</span>
                <span
                  className={`text-right ${
                    editingAccess.expiryTime ? "text-blue-400" : "text-purple-400"
                  }`}
                >
                  {editingAccess.expiryTime
                    ? new Date(editingAccess.expiryTime).toLocaleString()
                    : "Permanent"}
                </span>
              </div>
            </div>

            {editingAccess.expiryTime && (
              <label className="flex items-center gap-3 mb-5 cursor-pointer group">
                <div
                  className={`w-10 h-5 rounded-full border transition-all relative shrink-0 ${
                    noExpiry
                      ? "bg-indigo-500 border-indigo-500"
                      : "bg-white/5 border-white/10"
                  }`}
                  onClick={() => {
                    setNoExpiry(!noExpiry);
                    if (!noExpiry) setNewExpiry("");
                  }}
                >
                  <div
                    className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all ${
                      noExpiry ? "left-5" : "left-0.5"
                    }`}
                  />
                </div>
                <span className="text-xs font-mono text-white/50 group-hover:text-white/80 transition-colors">
                  Remove expiry (make permanent)
                </span>
              </label>
            )}

            {!noExpiry && (
              <div className="mb-5">
                <label className="block text-[10px] font-mono text-white/30 uppercase tracking-widest mb-2">
                  New Expiry Date & Time
                </label>
                <input
                  type="datetime-local"
                  value={newExpiry}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setNewExpiry(e.target.value)}
                  className="w-full bg-[#1a1a1a] border border-white/10 text-white/70 text-xs font-mono rounded-xl px-4 py-3 focus:outline-none focus:border-indigo-500/50 [color-scheme:dark]"
                />
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={closeEditModal}
                className="px-4 py-2 text-xs font-mono rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpdateExpiry}
                disabled={updating}
                className="px-5 py-2 text-xs font-mono rounded-xl bg-indigo-500 hover:bg-indigo-400 text-white disabled:opacity-40 transition font-semibold"
              >
                {updating ? "Saving..." : "Save Changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      {revokingAccess && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:px-4">
          <div className="bg-[#111] border border-white/10 rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 sm:p-7 w-full sm:max-w-sm">
            <p className="text-[10px] font-mono text-red-400 tracking-widest uppercase mb-1">
              Danger Zone
            </p>
            <h2 className="text-lg sm:text-xl font-clash font-semibold mb-4">
              Revoke Access
            </h2>

            <div className="bg-white/[0.03] border border-white/5 rounded-xl px-4 py-3 mb-4 space-y-1">
              <div className="flex justify-between text-xs font-mono gap-3">
                <span className="text-white/30 shrink-0">File</span>
                <span className="text-white/60 truncate text-right">
                  {revokingAccess.fileName}
                </span>
              </div>
              <div className="flex justify-between text-xs font-mono gap-3">
                <span className="text-white/30 shrink-0">Revoking from</span>
                <span className="text-white/60 truncate text-right">
                  {revokingAccess.sharedWith}
                </span>
              </div>
            </div>

            <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3 text-xs font-mono text-red-400/80 mb-6">
              ⚠️ This immediately removes their access. This action cannot be undone.
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRevokingAccess(null)}
                className="px-4 py-2 text-xs font-mono rounded-xl border border-white/10 text-white/40 hover:text-white hover:bg-white/5 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleRevoke}
                disabled={revoking}
                className="px-5 py-2 text-xs font-mono rounded-xl bg-red-500 hover:bg-red-400 text-white disabled:opacity-40 transition font-semibold"
              >
                {revoking ? "Revoking..." : "Yes, Revoke"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}