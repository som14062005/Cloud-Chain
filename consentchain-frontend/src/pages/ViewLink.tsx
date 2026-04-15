import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { getToken } from "../utils/auth";

interface FileInfo {
  filename: string;
  mimetype: string;
  downloadUrl: string;
  fileId: string;
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

// ── FILE PREVIEW ──
function FilePreview({ fileInfo }: { fileInfo: FileInfo }) {
  const { downloadUrl, mimetype, filename } = fileInfo;

  if (mimetype.startsWith("image/"))
    return <img src={downloadUrl} alt={filename} className="max-w-full max-h-[65vh] rounded-xl object-contain mx-auto" />;

  if (mimetype === "application/pdf")
    return <iframe src={downloadUrl} title={filename} className="w-full h-[65vh] rounded-xl border-0" />;

  if (mimetype.startsWith("video/"))
    return (
      <video controls className="w-full max-h-[65vh] rounded-xl">
        <source src={downloadUrl} type={mimetype} />
      </video>
    );

  if (mimetype.startsWith("audio/"))
    return (
      <div className="flex items-center justify-center py-12">
        <audio controls><source src={downloadUrl} type={mimetype} /></audio>
      </div>
    );

  if (mimetype === "text/plain" || mimetype === "text/csv")
    return <TextPreview url={downloadUrl} />;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-white/20">
      <div className="text-6xl mb-4">📄</div>
      <p className="font-mono text-sm">Preview not available for this file type</p>
      <p className="font-mono text-xs mt-1 opacity-60">{mimetype}</p>
    </div>
  );
}

export default function ViewLink() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const [status, setStatus] = useState<"loading" | "login" | "ready" | "error" | "expired">("loading");
  const [fileInfo, setFileInfo] = useState<FileInfo | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    if (!token) { setStatus("error"); setError("No token in URL"); return; }
    checkLink();
  }, [token]);

  const checkLink = async () => {
    const userToken = getToken();

    try {
      // Step 1: Validate link
      const linkRes = await axios.get(`${import.meta.env.VITE_API_URL}/files/link/${token}`);
      const { downloadUrl, filename, mimetype, fileId, expiresAt } = linkRes.data;
      setExpiresAt(expiresAt);

      // Step 2: Not logged in → login wall
      if (!userToken) {
        setFileInfo({ filename, mimetype, downloadUrl: "", fileId });
        setStatus("login");
        return;
      }

      // Step 3: Check owner OR shared access in parallel
      const [myFilesRes, sharedRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/files/myfiles`, {
          headers: { Authorization: `Bearer ${userToken}` },
        }),
        axios.get(`${import.meta.env.VITE_API_URL}/files/shared`, {
          headers: { Authorization: `Bearer ${userToken}` },
        }),
      ]);

      const isOwner = myFilesRes.data.files.some(
        (f: any) => String(f._id) === String(fileId)
      );
      const hasAccess = sharedRes.data.sharedFiles.some(
        (f: any) => String(f._id) === String(fileId)
      );

      // Step 4: Block if neither
      if (!isOwner && !hasAccess) {
        setStatus("error");
        setError("You don't have access to this file. Ask the owner to grant you access first.");
        return;
      }

      // Step 5: Allow
      setFileInfo({ filename, mimetype, downloadUrl, fileId });
      setStatus("ready");

    } catch (err: any) {
      const code = err.response?.status;
      const msg = err.response?.data?.error || "";
      if (code === 410) { setStatus("expired"); return; }
      if (code === 404) { setStatus("error"); setError("Link not found."); return; }
      setStatus("error");
      setError(msg || "Something went wrong");
    }
  };

  const getExt = (name: string) => name.split(".").pop()?.toUpperCase() || "FILE";
  const formatExpiry = (iso: string) =>
    new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });

  // ── LOADING ──
  if (status === "loading") return (
    <div className="min-h-screen flex items-center justify-center bg-[#080808]">
      <div className="relative w-14 h-14">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-3 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:0.6s]" />
      </div>
    </div>
  );

  // ── NOT LOGGED IN ──
  if (status === "login") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080808] text-white p-6">
      <div className="w-full max-w-md bg-[#0e0e0e] border border-white/10 rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-5xl mb-5">🔒</div>
        <p className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase mb-2">Authentication Required</p>
        <h1 className="font-clash text-2xl font-semibold mb-3">Login to View File</h1>
        <p className="font-mono text-white/40 text-sm mb-2">
          Someone shared <span className="text-white/70">"{fileInfo?.filename}"</span> with you.
        </p>
        <p className="font-mono text-white/30 text-xs mb-8">
          You need to be logged in with an account that has been granted access.
        </p>
        <button onClick={() => navigate("/")}
          className="w-full font-mono py-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl hover:bg-indigo-500/20 transition text-sm mb-3">
          🔑 Login to ConsentChain
        </button>
        <button onClick={() => navigate("/register")}
          className="w-full font-mono py-3 bg-white/5 border border-white/10 text-white/40 rounded-xl hover:text-white hover:bg-white/10 transition text-sm">
          Create Account
        </button>
      </div>
    </div>
  );

  // ── EXPIRED ──
  if (status === "expired") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080808] text-white p-6">
      <div className="w-full max-w-md bg-[#0e0e0e] border border-red-500/10 rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-5xl mb-5">⏰</div>
        <p className="text-[10px] font-mono text-red-400 tracking-widest uppercase mb-2">Link Expired</p>
        <h1 className="font-clash text-2xl font-semibold mb-3">This Link Has Expired</h1>
        <p className="font-mono text-white/40 text-sm mb-8">
          This share link is no longer valid. Contact the file owner to generate a new link.
        </p>
        <button onClick={() => navigate("/dashboard")}
          className="w-full font-mono py-3 bg-white/5 border border-white/10 text-white/40 rounded-xl hover:text-white hover:bg-white/10 transition text-sm">
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  // ── ERROR ──
  if (status === "error") return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#080808] text-white p-6">
      <div className="w-full max-w-md bg-[#0e0e0e] border border-red-500/10 rounded-2xl p-8 text-center shadow-2xl">
        <div className="text-5xl mb-5">❌</div>
        <p className="text-[10px] font-mono text-red-400 tracking-widest uppercase mb-2">Access Denied</p>
        <h1 className="font-clash text-2xl font-semibold mb-3">Cannot Access File</h1>
        <p className="font-mono text-white/40 text-sm mb-8">{error}</p>
        <button onClick={() => navigate("/dashboard")}
          className="w-full font-mono py-3 bg-white/5 border border-white/10 text-white/40 rounded-xl hover:text-white hover:bg-white/10 transition text-sm">
          Go to Dashboard
        </button>
      </div>
    </div>
  );

  // ── READY ──
  const ext = getExt(fileInfo?.filename || "");

  return (
    <div className="min-h-screen bg-[#080808] text-white flex flex-col items-center justify-start p-4 sm:p-6 pt-10">

      {/* Card */}
      <div className="w-full max-w-2xl bg-[#0e0e0e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">

        {/* Top bar */}
        <div className="px-5 sm:px-6 py-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-[10px] font-mono text-green-400 tracking-widest uppercase">Access Verified</span>
          </div>
          <span className="text-[10px] font-mono text-white/20 hidden sm:block">ConsentChain</span>
        </div>

        {/* File info */}
        <div className="p-5 sm:p-6">
          <div className="flex items-center gap-4 mb-5">
            <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center shrink-0">
              <span className="text-[11px] font-mono font-bold text-indigo-400">{ext.slice(0, 4)}</span>
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-mono text-white/30 uppercase tracking-widest mb-1">Shared File</p>
              <p className="font-clash font-semibold text-white truncate text-base sm:text-lg">{fileInfo?.filename}</p>
            </div>
          </div>

          {/* Expiry badge */}
          {expiresAt && (
            <div className="mb-5 px-4 py-3 bg-amber-500/5 border border-amber-500/10 rounded-xl flex items-center gap-3">
              <span className="text-amber-400 shrink-0">⏰</span>
              <div>
                <p className="text-[10px] font-mono text-amber-400/60 uppercase tracking-widest">Link Expires</p>
                <p className="font-mono text-xs text-amber-300">{formatExpiry(expiresAt)}</p>
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Preview toggle */}
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`flex-1 flex items-center justify-center gap-2 font-mono py-3 rounded-xl border transition text-sm
                ${showPreview
                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300"
                  : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20"}`}
            >
              {showPreview ? "🙈 Hide Preview" : "👁️ Preview File"}
            </button>

            {/* Download */}
            <a
              href={fileInfo?.downloadUrl}
              target="_blank"
              rel="noreferrer"
              className="flex-1 flex items-center justify-center gap-2 font-mono py-3 bg-indigo-500/10 border border-indigo-500/30 text-indigo-300 rounded-xl hover:bg-indigo-500/20 transition text-sm"
            >
              ⬇️ Download File
            </a>
          </div>

          {/* Dashboard link */}
          <button onClick={() => navigate("/dashboard")}
            className="w-full mt-3 font-mono py-2.5 bg-white/5 border border-white/10 text-white/30 rounded-xl hover:text-white hover:bg-white/10 transition text-xs">
            Go to Dashboard
          </button>
        </div>

        {/* Preview panel */}
        {showPreview && fileInfo && (
          <div className="border-t border-white/5 p-5 sm:p-6 bg-black/20">
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-4">Preview</p>
            <FilePreview fileInfo={fileInfo} />
          </div>
        )}
      </div>

      {/* Branding */}
      <p className="mt-6 font-mono text-[10px] text-white/10 tracking-widest">
        SECURED BY CONSENTCHAIN
      </p>
    </div>
  );
}
