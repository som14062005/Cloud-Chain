import { useEffect, useState } from "react";
import { getToken, removeToken } from "../utils/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface SharedFile {
  _id: string;
  filename: string;
  owner: string;
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
      return (
        <img
          src={previewUrl}
          alt={fileName}
          className="w-full h-full object-contain"
        />
      );

    if (mimeType === "application/pdf")
      return (
        <iframe
          src={previewUrl}
          title={fileName}
          className="w-full h-full border-0"
        />
      );

    if (mimeType.startsWith("video/"))
      return (
        <video controls className="w-full h-full rounded-none">
          <source src={previewUrl} type={mimeType} />
        </video>
      );

    if (mimeType.startsWith("audio/"))
      return (
        <div className="flex items-center justify-center h-full">
          <audio controls>
            <source src={previewUrl} type={mimeType} />
          </audio>
        </div>
      );

    if (mimeType === "text/plain" || mimeType === "text/csv")
      return <TextPreview url={previewUrl} />;

    if (
      mimeType.includes("spreadsheetml") ||
      mimeType.includes("wordprocessingml") ||
      mimeType.includes("presentationml") ||
      mimeType === "application/msword" ||
      mimeType === "application/vnd.ms-excel"
    ) {
      const googleUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(previewUrl)}&embedded=true`;
      return (
        <div className="flex flex-col h-full gap-2">
          <div className="flex items-center gap-2 text-[11px] font-mono text-amber-400/60 bg-amber-400/5 border border-amber-400/10 rounded-xl px-3 py-2 shrink-0">
            ⚠️ Previewed via Google Docs Viewer — may take a few seconds
          </div>
          <iframe src={googleUrl} title={fileName} className="flex-1 border-0" />
        </div>
      );
    }

    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <div className="text-7xl">📄</div>
        <p className="font-mono text-sm text-white/60">{fileName}</p>
        <p className="font-mono text-xs text-white/20">{mimeType}</p>
        <p className="text-xs font-mono text-white/20 border border-white/5 px-4 py-2 rounded-full">
          Preview not available for this file type
        </p>
        <a href={downloadUrl} target="_blank" rel="noreferrer"
          className="text-xs font-mono px-5 py-2.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/20 transition">
          ⬇️ Download to view
        </a>
      </div>
    );
  };

  // ── Close on Escape key ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex flex-col"
      onClick={onClose}
    >
      {/* ── Top Bar ── */}
      <div
        className="flex items-center justify-between px-6 py-3 bg-[#0c0c0c] border-b border-white/5 shrink-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[10px] font-mono text-purple-400 uppercase tracking-widest shrink-0">
            Preview
          </span>
          <span className="text-white/10">·</span>
          <p className="font-clash font-medium text-white/80 truncate text-sm">
            {fileName}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <a
            href={downloadUrl}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-mono px-4 py-1.5 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/20 transition"
          >
            ⬇️ Download
          </a>
          <button
            onClick={onClose}
            className="text-xs font-mono px-4 py-1.5 bg-white/5 border border-white/10 text-white/40 rounded-xl hover:text-white hover:bg-white/10 transition"
          >
            ✕ Close
          </button>
          <span className="text-[10px] font-mono text-white/10 hidden md:block">
            ESC to close
          </span>
        </div>
      </div>

      {/* ── Preview Body — fills remaining screen ── */}
      <div
        className="flex-1 overflow-hidden bg-black/40"
        onClick={(e) => e.stopPropagation()}
      >
        {renderPreview()}
      </div>
    </div>
  );
}


// ── MAIN PAGE ──
export default function SharedFiles() {
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [justDownloaded, setJustDownloaded] = useState<string | null>(null);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) { removeToken(); navigate("/"); return; }
    axios.get("http://3.7.199.245:3000/files/shared", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setSharedFiles(res.data.sharedFiles);
      setTimeout(() => setMounted(true), 80);
    }).catch((err) => {
      if (err.response?.status === 401) { removeToken(); navigate("/"); }
    }).finally(() => setLoading(false));
  }, [navigate]);

    const handleDownload = async (fileId: string) => {
  const token = getToken();
  if (!token) { removeToken(); navigate("/"); return; }
  try {
    const { data } = await axios.get(
      `http://3.7.199.245:3000/files/download/${fileId}`,
      { headers: { Authorization: `Bearer ${token}` }}
    );
    window.open(data.downloadUrl, "_blank"); // ✅ Direct S3 presigned URL
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 401) {
      removeToken(); navigate("/");
    } else alert("Download failed");
  }
};

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

  const openPreview = (file: SharedFile) => {
    const ext = getExt(file.filename);
    const mimeType = file.mimetype || getMimeFromExt(ext);
    setPreviewFile({ fileId: file._id, fileName: file.filename, mimeType });
  };

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

  const getOwnerInitial = (name: string) => name.charAt(0).toUpperCase();

  const getOwnerColor = (name: string) => {
    const colors = [
      "bg-indigo-500/20 text-indigo-400 border-indigo-500/20",
      "bg-purple-500/20 text-purple-400 border-purple-500/20",
      "bg-green-500/20 text-green-400 border-green-500/20",
      "bg-amber-500/20 text-amber-400 border-amber-500/20",
      "bg-pink-500/20 text-pink-400 border-pink-500/20",
      "bg-blue-500/20 text-blue-400 border-blue-500/20",
    ];
    return colors[name.charCodeAt(0) % colors.length];
  };

  const uniqueOwners = new Set(sharedFiles.map((f) => f.owner)).size;
  const filtered = sharedFiles.filter(
    (f) =>
      f.filename.toLowerCase().includes(search.toLowerCase()) ||
      f.owner.toLowerCase().includes(search.toLowerCase())
  );

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
              { label: "My Files", icon: "🗂️", path: "/myfiles" },
              { label: "Shared Files", icon: "📂", path: "/sharedfiles", active: true },
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
              <p className="text-[10px] font-mono text-purple-400 tracking-[0.3em] uppercase mb-1">Inbox</p>
              <h1 className="text-4xl font-clash font-semibold tracking-tight">Shared Files</h1>
              <p className="text-white/20 text-sm font-mono mt-1">Files others have granted you access to</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-white/20 border border-white/5 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse inline-block" />
              {sharedFiles.length} shared
            </div>
          </div>
        </div>

        {/* STAT CARDS */}
        <div className={`grid grid-cols-3 gap-4 transition-all duration-700 delay-100 ${mounted ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`}>
          {[
            { label: "Shared With Me", value: sharedFiles.length, icon: "📂", color: "text-purple-400", border: "border-purple-400/10", bg: "bg-purple-400/5" },
            { label: "Unique Owners", value: uniqueOwners, icon: "👥", color: "text-indigo-400", border: "border-indigo-400/10", bg: "bg-indigo-400/5" },
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
            <input type="text" placeholder="Search by file name or owner…" value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-[#0e0e0e] border border-white/5 rounded-xl pl-10 pr-4 py-3 text-sm font-mono text-white/70 placeholder-white/20 focus:outline-none focus:border-purple-500/40 transition" />
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
              <div className="text-6xl mb-4">📭</div>
              <p className="font-mono text-sm">
                {search ? "No files match your search" : "No files shared with you yet"}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {filtered.map((file, i) => {
                const ext = getExt(file.filename);
                const extColor = getExtColor(ext);
                const ownerColor = getOwnerColor(file.owner);
                const isHovered = hoveredId === file._id;
                const isDownloading = downloadingId === file._id;
                const isDone = justDownloaded === file._id;

                return (
                  <div key={file._id}
                    onMouseEnter={() => setHoveredId(file._id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{ transitionDelay: `${i * 35}ms` }}
                    className={`group flex items-center gap-5 bg-[#0e0e0e] border rounded-2xl px-6 py-4 transition-all duration-300
                      ${isHovered ? "border-purple-500/25 bg-purple-500/5 shadow-lg shadow-purple-500/5" : "border-white/5"}
                      ${mounted ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-4"}`}>

                    {/* File type box */}
                    <div className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 ${extColor}`}>
                      <span className="text-[9px] font-mono font-bold">{ext.slice(0, 4)}</span>
                    </div>

                    {/* File info */}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-sm text-white truncate">{file.filename}</p>
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${extColor}`}>{ext}</span>
                        <span className="text-white/10 text-[10px]">•</span>
                        <span className="text-[10px] font-mono text-white/20">ID: {file._id.slice(-8)}</span>
                      </div>
                    </div>

                    {/* Owner */}
                    <div className="flex items-center gap-2 shrink-0 w-48">
                      <div className={`w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-mono font-bold shrink-0 ${ownerColor}`}>
                        {getOwnerInitial(file.owner)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-mono text-white/20">Shared by</p>
                        <p className="text-xs font-mono text-white/50 truncate">{file.owner}</p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className={`flex items-center gap-2 shrink-0 transition-all duration-300 ${isHovered ? "opacity-100 translate-x-0" : "opacity-0 translate-x-2"}`}>

                      {/* PREVIEW button */}
                      <button
                        onClick={() => openPreview(file)}
                        className="flex items-center gap-1.5 text-xs font-mono px-4 py-2 bg-purple-500/10 border border-purple-500/20 text-purple-400 rounded-xl hover:bg-purple-500/20 transition">
                        👁️ Preview
                      </button>

                      {/* DOWNLOAD button */}
                      <button
                        onClick={() => handleDownload(file._id)}
                        disabled={isDownloading}
                        className={`flex items-center gap-2 text-xs font-mono px-4 py-2 rounded-xl border transition-all
                          ${isDone
                            ? "bg-green-400/10 border-green-400/20 text-green-400"
                            : isDownloading
                            ? "bg-white/5 border-white/10 text-white/30"
                            : "bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10"}`}>
                        {isDone ? (
                          <>✓ Downloaded</>
                        ) : isDownloading ? (
                          <><span className="w-3 h-3 border border-white/20 border-t-white/50 rounded-full animate-spin inline-block" /> Downloading…</>
                        ) : (
                          <>⬇️ Download</>
                        )}
                      </button>
                    </div>

                    {/* Arrow */}
                    <span className={`text-white/10 text-sm shrink-0 transition-all duration-300 ${isHovered ? "opacity-100 text-white/30" : "opacity-0"}`}>→</span>
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
