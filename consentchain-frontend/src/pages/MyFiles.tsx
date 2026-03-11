import { useEffect, useState } from "react";
import { getToken, removeToken } from "../utils/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface MyFile {
  _id: string;
  name: string;
  mimetype?: string;
}

interface PreviewFile {
  fileId: string;
  fileName: string;
  mimeType: string;
}

// ── TEXT PREVIEW ──
function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState("");
  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setContent).catch(() => setContent("Failed to load."));
  }, [url]);
  return (
    <pre className="w-full max-h-[60vh] overflow-auto font-mono text-xs text-white/60 bg-black/30 rounded-xl p-4 whitespace-pre-wrap">
      {content || "Loading..."}
    </pre>
  );
}

// ── PREVIEW MODAL ──
function PreviewModal({ fileId, fileName, mimeType, onClose }: PreviewFile & { onClose: () => void }) {
  const token = getToken();
  const previewUrl = `http://3.7.199.245:3000/files/preview/${fileId}?token=${token}`;
  const downloadUrl = `http://3.7.199.245:3000/files/download/${fileId}?token=${token}`;

  const renderPreview = () => {
    if (mimeType.startsWith("image/"))
      return <img src={previewUrl} alt={fileName} className="max-w-full max-h-[65vh] rounded-xl object-contain mx-auto" />;
    if (mimeType === "application/pdf")
      return <iframe src={previewUrl} title={fileName} className="w-full h-[65vh] rounded-xl border-0" />;
    if (mimeType.startsWith("video/"))
      return <video controls className="w-full max-h-[65vh] rounded-xl"><source src={previewUrl} type={mimeType} /></video>;
    if (mimeType.startsWith("audio/"))
      return <div className="flex items-center justify-center py-12"><audio controls><source src={previewUrl} type={mimeType} /></audio></div>;
    if (mimeType === "text/plain" || mimeType === "text/csv")
      return <TextPreview url={previewUrl} />;
    return (
      <div className="flex flex-col items-center justify-center py-20 text-white/20">
        <div className="text-6xl mb-4">📄</div>
        <p className="font-mono text-sm">Preview not available for this file type</p>
        <p className="font-mono text-xs mt-1 opacity-60">{mimeType}</p>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
      onClick={onClose}>
      <div className="bg-[#0e0e0e] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>

        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <p className="text-[10px] font-mono text-indigo-400 uppercase tracking-widest mb-0.5">Preview</p>
            <p className="font-clash font-medium text-white truncate max-w-sm">{fileName}</p>
          </div>
          <div className="flex items-center gap-2">
            <a href={downloadUrl} target="_blank" rel="noreferrer"
              className="text-xs font-mono px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 rounded-xl hover:bg-indigo-500/20 transition">
              ⬇️ Download
            </a>
            <button onClick={onClose}
              className="text-xs font-mono px-4 py-2 bg-white/5 border border-white/10 text-white/40 rounded-xl hover:text-white hover:bg-white/10 transition">
              ✕ Close
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 bg-black/20">{renderPreview()}</div>
      </div>
    </div>
  );
}

// ── MAIN PAGE ──
export default function MyFiles() {
  const [myFiles, setMyFiles] = useState<MyFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) { removeToken(); navigate("/"); return; }
    axios.get("http://3.7.199.245:3000/files/myfiles", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setMyFiles(res.data.files);
      setTimeout(() => setMounted(true), 80);
    }).catch((err) => {
      if (err.response?.status === 401) { removeToken(); navigate("/"); }
    }).finally(() => setLoading(false));
  }, [navigate]);

  const filtered = myFiles.filter((f) =>
    f.name.toLowerCase().includes(search.toLowerCase())
  );

  const getExt = (name: string) => {
    const parts = name.split(".");
    return parts.length > 1 ? parts.pop()!.toUpperCase() : "FILE";
  };

  const getExtColor = (ext: string) => {
    const map: Record<string, string> = {
      PDF: "bg-red-400/10 text-red-400 border-red-400/20",
      PNG: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      JPG: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      JPEG: "bg-blue-400/10 text-blue-400 border-blue-400/20",
      DOCX: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20",
      DOC: "bg-indigo-400/10 text-indigo-400 border-indigo-400/20",
      XLSX: "bg-green-400/10 text-green-400 border-green-400/20",
      CSV: "bg-green-400/10 text-green-400 border-green-400/20",
      TXT: "bg-white/10 text-white/40 border-white/10",
      MP4: "bg-purple-400/10 text-purple-400 border-purple-400/20",
      ZIP: "bg-amber-400/10 text-amber-400 border-amber-400/20",
    };
    return map[ext] ?? "bg-white/5 text-white/30 border-white/5";
  };

  // Derive mimeType from extension as fallback
  const getMimeFromExt = (ext: string): string => {
    const map: Record<string, string> = {
      PDF: "application/pdf",
      PNG: "image/png",
      JPG: "image/jpeg",
      JPEG: "image/jpeg",
      WEBP: "image/webp",
      GIF: "image/gif",
      MP4: "video/mp4",
      MOV: "video/quicktime",
      MP3: "audio/mpeg",
      WAV: "audio/wav",
      TXT: "text/plain",
      CSV: "text/csv",
      DOCX: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      XLSX: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
    return map[ext] ?? "application/octet-stream";
  };

  const openPreview = (file: MyFile) => {
    const ext = getExt(file.name);
    const mimeType = file.mimetype || getMimeFromExt(ext);
    setPreviewFile({ fileId: file._id, fileName: file.name, mimeType });
  };

  if (loading) return (
    <div className="w-screen h-screen bg-[#080808] flex items-center justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-3 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:0.6s]" />
      </div>
    </div>
  );

  return (
    <div className="w-screen h-screen flex bg-[#080808] text-white overflow-hidden">

      {/* PREVIEW MODAL */}
      {previewFile && (
        <PreviewModal {...previewFile} onClose={() => setPreviewFile(null)} />
      )}

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
              { label: "My Files", icon: "🗂️", path: "/myfiles", active: true },
              { label: "Shared Files", icon: "📂", path: "/sharedfiles" },
              { label: "Analytics", icon: "📊", path: "/analytics" },
              { label: "Logs", icon: "📝", path: "/logs" },
              { label: "Granted Access", icon: "📝", path: "/grantaccess" },
            ].map((item) => (
              <span key={item.path} onClick={() => navigate(item.path)}
                className={`font-mono text-[13px] px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center gap-2
                  ${"active" in item && item.active
                    ? "bg-white/10 text-white"
                    : "text-gray-500 hover:text-white hover:bg-white/5"}`}>
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

      {/* ── MAIN ── */}
      <div className="flex-1 overflow-y-auto px-10 py-10 space-y-8">

        {/* HEADER */}
        <div className={`transition-all duration-700 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-1">Storage</p>
              <h1 className="text-4xl font-clash font-semibold tracking-tight">My Files</h1>
              <p className="text-white/20 text-sm font-mono mt-1">Manage and track your uploaded files</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-white/20 border border-white/5 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse inline-block" />
              {myFiles.length} file{myFiles.length !== 1 ? "s" : ""}
            </div>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className={`grid grid-cols-3 gap-4 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          {[
            { label: "Total Files", value: myFiles.length, icon: "🗂️", color: "text-indigo-400", border: "border-indigo-400/10", bg: "bg-indigo-400/5" },
            { label: "File Types", value: new Set(myFiles.map((f) => getExt(f.name))).size, icon: "🏷️", color: "text-purple-400", border: "border-purple-400/10", bg: "bg-purple-400/5" },
            { label: "Showing", value: filtered.length, icon: "🔍", color: "text-blue-400", border: "border-blue-400/10", bg: "bg-blue-400/5" },
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

        {/* SEARCH */}
        <div className={`transition-all duration-700 delay-200 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20">🔍</span>
            <input type="text" placeholder="Search files by name…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0e0e0e] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-indigo-500/40 transition" />
            {search && (
              <button onClick={() => setSearch("")}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-white/20 hover:text-white/50 text-xs font-mono transition">
                ✕ Clear
              </button>
            )}
          </div>
        </div>

        {/* FILE LIST */}
        <div className={`transition-all duration-700 delay-300 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-white/20">
              <div className="text-6xl mb-4">🗂️</div>
              <p className="font-mono text-sm">
                {search ? "No files match your search" : "No files uploaded yet"}
              </p>
              {!search && (
                <button onClick={() => navigate("/dashboard")}
                  className="mt-4 text-xs font-mono px-4 py-2 border border-white/10 rounded-full hover:border-white/20 hover:text-white/50 transition">
                  Go to Dashboard to upload
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((file, i) => {
                const ext = getExt(file.name);
                const extColor = getExtColor(ext);
                const isHovered = hoveredId === file._id;

                return (
                  <div key={file._id}
                    onMouseEnter={() => setHoveredId(file._id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ transitionDelay: `${i * 35}ms` }}
                    className={`group flex items-center gap-5 bg-[#0e0e0e] border rounded-2xl px-6 py-4 transition-all duration-300 cursor-default
                      ${isHovered ? "border-indigo-500/25 bg-indigo-500/5 shadow-lg shadow-indigo-500/5" : "border-white/5"}
                      ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>

                    {/* File icon */}
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 transition-all duration-300 ${extColor}`}>
                      <span className="text-[9px] font-mono font-bold">{ext.slice(0, 4)}</span>
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-white truncate">{file.name}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${extColor}`}>{ext}</span>
                        <span className="text-[10px] font-mono text-white/20">ID: {file._id.slice(-8)}</span>
                        {/* mimetype missing warning */}
                        {!file.mimetype && (
                          <span className="text-[10px] font-mono px-2 py-0.5 rounded-full border border-amber-400/20 bg-amber-400/5 text-amber-400/60">
                            legacy upload
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Actions — appear on hover */}
                    <div className={`flex items-center gap-2 transition-all duration-300 ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}`}>

                      {/* PREVIEW */}
                      <button
                        onClick={() => openPreview(file)}
                        className="flex items-center gap-1.5 text-xs font-mono px-4 py-2 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-400 hover:bg-purple-500/20 transition">
                        👁️ Preview
                      </button>

                      {/* VIEW LOGS */}
                      <button
                        onClick={() => navigate(`/logs/${file._id}`)}
                        className="flex items-center gap-1.5 text-xs font-mono px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/50 hover:text-white hover:border-white/20 hover:bg-white/10 transition">
                        🪵 Logs
                      </button>

                      {/* MANAGE */}
                      <button
                        onClick={() => navigate(`/logs/${file._id}`)}
                        className="flex items-center gap-1.5 text-xs font-mono px-4 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400 hover:bg-indigo-500/20 transition">
                        ⚙️ Manage
                      </button>
                    </div>

                    {/* Arrow */}
                    <span className={`text-white/10 text-sm transition-all duration-300 shrink-0 ${isHovered ? "opacity-100 translate-x-0 text-white/30" : "opacity-0 -translate-x-2"}`}>→</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div className="h-4" />
      </div>
    </div>
  );
}
