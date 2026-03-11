import { useEffect, useState } from "react";
import { getToken, removeToken } from "../utils/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";

interface SharedFile {
  _id: string;
  filename: string;
  owner: string;
}

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

// ── TEXT PREVIEW SUB-COMPONENT ──
function TextPreview({ url }: { url: string }) {
  const [content, setContent] = useState("");
  useEffect(() => {
    fetch(url).then((r) => r.text()).then(setContent).catch(() => setContent("Failed to load."));
  }, [url]);
  return (
    <pre className="w-full max-h-[60vh] overflow-auto font-mono text-xs text-white/60 dark:text-white/60 light:text-black/60 bg-black/20 rounded-xl p-4 whitespace-pre-wrap">
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
      <div
        className="bg-[#0e0e0e] dark:bg-[#0e0e0e] border border-white/10 rounded-2xl w-full max-w-4xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
          <div>
            <p className="text-[10px] font-mono text-white/20 uppercase tracking-widest mb-0.5">Preview</p>
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
        {/* Body */}
        <div className="p-6 bg-black/20">{renderPreview()}</div>
      </div>
    </div>
  );
}


// ── MAIN DASHBOARD ──
function Dashboard() {
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [myFiles, setMyFiles] = useState<MyFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [expiryOption, setExpiryOption] = useState("");
  const [customExpiry, setCustomExpiry] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [previewFile, setPreviewFile] = useState<PreviewFile | null>(null);
  const [dark, setDark] = useState(true);
  const navigate = useNavigate();

  // Apply theme to <html>
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  useEffect(() => {
    const token = getToken();
    if (!token) { removeToken(); navigate("/"); return; }
    axios.get("http://3.7.199.245:3000/files/shared", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => setSharedFiles(res.data.sharedFiles))
      .catch((err) => { if (err.response?.status === 401) { removeToken(); navigate("/"); } });
    axios.get("http://3.7.199.245:3000/files/myfiles", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setMyFiles(res.data.files);
      if (res.data.files.length > 0) setSelectedFileId(res.data.files[0]._id);
    }).catch(console.error);
  }, [navigate]);

  const refreshFiles = () => {
    const token = getToken();
    axios.get("http://3.7.199.245:3000/files/myfiles", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      setMyFiles(res.data.files);
      if (res.data.files.length > 0) setSelectedFileId(res.data.files[0]._id);
    });
  };

  

const handleUpload = async () => {
  const token = getToken();
  if (!token) { removeToken(); navigate("/"); return; }
  if (!file) { alert("Please select a file."); return; }

  setUploading(true);
  try {
    // Step 1: Get presigned URL from backend
    const { data: { url, key } } = await axios.post(
      "http://3.7.199.245:3000/files/upload-request",
      { filename: file.name, contentType: file.type },
      { headers: { Authorization: `Bearer ${token}` }}
    );

    // Step 2: PUT file directly to S3
    await axios.put(url, file, {
      headers: { "Content-Type": file.type }
    });

    // Step 3: Register file in DB
    await axios.post(
      "http://3.7.199.245:3000/files/upload",
      { key, filename: file.name, mimetype: file.type },
      { headers: { 
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"  // ✅ JSON not multipart
      }}
    );

    alert("Uploaded!");
    setFile(null);
    refreshFiles();
  }   catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.response?.status === 401) { removeToken(); navigate("/"); }
      else alert("Upload failed: " + err.message);
    } else {
      alert("Upload failed: Unknown error");
    }
  }

};


  const handleGrantAccess = () => {
    const token = getToken();
    if (!token) { removeToken(); navigate("/"); return; }
    if (!toEmail.trim()) { alert("Enter an email."); return; }
    if (!selectedFileId) { alert("Select a file."); return; }
    let expiryTime: string | null = null;
    if (expiryOption === "24h") expiryTime = new Date(Date.now() + 86400000).toISOString();
    else if (expiryOption === "7d") expiryTime = new Date(Date.now() + 604800000).toISOString();
    else if (expiryOption === "custom") {
      if (!customExpiry) { alert("Select custom date."); return; }
      expiryTime = new Date(customExpiry).toISOString();
    }
    setGranting(true);
    axios.post("http://3.7.199.245:3000/files/grant",
      { fileId: selectedFileId, toEmail, expiryTime },
      { headers: { Authorization: `Bearer ${token}` } }
    ).then(() => { alert("Access granted!"); setToEmail(""); setExpiryOption(""); setCustomExpiry(""); })
      .catch((err) => alert(err.response?.data?.error || "Failed."))
      .finally(() => setGranting(false));
  };

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

  // Theme-aware class helpers
  const bg = dark ? "bg-[#080808]" : "bg-[#f4f4f5]";
  const sidebar = dark ? "bg-[#0c0c0c] border-white/5" : "bg-white border-black/5";
  const card = dark ? "bg-[#111] border-white/5" : "bg-white border-black/5 shadow-sm";
  const cardInner = dark ? "bg-[#0e0e0e] border-white/5" : "bg-[#f9f9f9] border-black/5";
  const text = dark ? "text-white" : "text-black";
  const subtext = dark ? "text-white/30" : "text-black/40";
  const inputCls = dark
    ? "bg-[#1a1a1a] border-white/10 text-white placeholder-white/20 focus:border-white/30"
    : "bg-[#f0f0f0] border-black/10 text-black placeholder-black/20 focus:border-black/30";
  const navActive = dark ? "bg-white/10 text-white" : "bg-black/10 text-black";
  const navInactive = dark ? "text-gray-500 hover:text-white hover:bg-white/5" : "text-gray-400 hover:text-black hover:bg-black/5";
  const btnSecondary = dark
    ? "bg-white/5 hover:bg-white/10 border-white/10 text-white/60 hover:text-white"
    : "bg-black/5 hover:bg-black/10 border-black/10 text-black/60 hover:text-black";

  return (
    <div className={`w-screen h-screen flex ${bg} ${text} overflow-hidden transition-colors duration-300`}>

      {/* PREVIEW MODAL */}
      {previewFile && (
        <PreviewModal {...previewFile} onClose={() => setPreviewFile(null)} />
      )}

      {/* SIDEBAR */}
      <div className={`w-60 h-full ${sidebar} border-r flex flex-col justify-between py-8 px-5 shrink-0`}>
        <div>
          <div className="flex items-center gap-2 mb-10">
            <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm shadow-md
              ${dark ? "bg-white text-black" : "bg-black text-white"}`}>CC</div>
            <span className="font-clash text-lg font-medium">
              Consent<span className={dark ? "text-white/40" : "text-black/30"}>Chain</span>
            </span>
          </div>
          <div className="flex flex-col gap-1">
            <div className={`text-[10px] font-mono uppercase tracking-widest mb-2 px-3 ${subtext}`}>Navigation</div>
            {[
              { label: "Dashboard", icon: "⬛", path: "/dashboard", active: true },
              { label: "My Files", icon: "🗂️", path: "/myfiles" },
              { label: "Shared Files", icon: "📂", path: "/sharedfiles" },
              { label: "Analytics", icon: "📊", path: "/analytics" },
              { label: "Logs", icon: "📝", path: "/logs" },
              { label: "Granted Access", icon: "📝", path: "/grantaccess" },
            ].map((item) => (
              <span key={item.path} onClick={() => navigate(item.path)}
                className={`font-mono text-[13px] px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center gap-2
                  ${item.active ? navActive : navInactive}`}>
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
      <div className="flex-1 overflow-y-auto px-10 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-clash font-semibold">Dashboard</h1>
            <p className={`text-sm font-mono mt-1 ${subtext}`}>Manage your files and access controls</p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Files", value: myFiles.length, icon: "📁" },
            { label: "Shared With You", value: sharedFiles.length, icon: "🤝" },
            { label: "Active Shares", value: myFiles.length, icon: "🔗" },
          ].map((stat) => (
            <div key={stat.label} className={`${card} border rounded-2xl p-5 flex items-center gap-4`}>
              <div className="text-3xl">{stat.icon}</div>
              <div>
                <div className="text-2xl font-clash font-semibold">{stat.value}</div>
                <div className={`text-xs font-mono ${subtext}`}>{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">

          {/* UPLOAD */}
          <div className={`${card} border rounded-2xl p-7 flex flex-col gap-5`}>
            <div>
              <h2 className="text-lg font-clash font-medium">Upload File</h2>
              <p className={`text-xs font-mono mt-0.5 ${subtext}`}>Drag & drop or browse to upload</p>
            </div>
            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => { e.preventDefault(); setDragOver(false); if (e.dataTransfer.files[0]) setFile(e.dataTransfer.files[0]); }}
              className={`border-2 border-dashed rounded-xl p-8 text-center transition cursor-pointer
                ${dragOver
                  ? dark ? "border-white/40 bg-white/5" : "border-black/30 bg-black/5"
                  : dark ? "border-white/10 hover:border-white/20" : "border-black/10 hover:border-black/20"}`}
              onClick={() => document.getElementById("fileInput")?.click()}>
              <input id="fileInput" type="file" className="hidden"
                onChange={(e) => { if (e.target.files?.[0]) setFile(e.target.files[0]); }} />
              {file ? (
                <div>
                  <div className="text-2xl mb-2">📄</div>
                  <div className={`text-sm font-mono ${dark ? "text-white/80" : "text-black/80"}`}>{file.name}</div>
                  <div className={`text-xs mt-1 ${subtext}`}>{(file.size / 1024).toFixed(1)} KB</div>
                </div>
              ) : (
                <div>
                  <div className="text-3xl mb-2">☁️</div>
                  <div className={`text-sm font-mono ${subtext}`}>Drop file here or click to browse</div>
                </div>
              )}
            </div>
            <button onClick={handleUpload} disabled={uploading || !file}
              className={`w-full py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed
                ${dark ? "!bg-white !text-black hover:!bg-gray-200" : "!bg-black !text-white hover:!bg-gray-800"}`}>
              {uploading ? "Uploading..." : "Upload File"}
            </button>
          </div>

          {/* GRANT ACCESS */}
          <div className={`${card} border rounded-2xl p-7 flex flex-col gap-5`}>
            <div>
              <h2 className="text-lg font-clash font-medium">Grant Access</h2>
              <p className={`text-xs font-mono mt-0.5 ${subtext}`}>Share files securely with expiry control</p>
            </div>
            <div className="flex flex-col gap-3">
              <div>
                <label className={`text-xs font-mono mb-1 block ${subtext}`}>Select File</label>
                <select value={selectedFileId} onChange={(e) => setSelectedFileId(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${inputCls}`}>
                  <option value="">Choose a file...</option>
                  {myFiles.map((f) => <option key={f._id} value={f._id}>{f.name}</option>)}
                </select>
              </div>
              <div>
                <label className={`text-xs font-mono mb-1 block ${subtext}`}>Recipient Email</label>
                <input type="email" placeholder="user@example.com" value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className={`w-full border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${inputCls}`} />
              </div>
              <div>
                <label className={`text-xs font-mono mb-1 block ${subtext}`}>Access Expiry</label>
                <div className="grid grid-cols-4 gap-2">
                  {["No Expiry", "24h", "7d", "Custom"].map((opt) => (
                    <button key={opt}
                      onClick={() => setExpiryOption(opt === "No Expiry" ? "" : opt.toLowerCase())}
                      className={`py-2 rounded-xl text-xs font-mono border transition
                        ${(opt === "No Expiry" ? expiryOption === "" : expiryOption === opt.toLowerCase())
                          ? dark ? "bg-white text-black border-white" : "bg-black text-white border-black"
                          : dark ? "bg-[#1a1a1a] text-white/40 border-white/10 hover:border-white/30 hover:text-white"
                                 : "bg-[#ebebeb] text-black/40 border-black/10 hover:border-black/30 hover:text-black"}`}>
                      {opt}
                    </button>
                  ))}
                </div>
                {expiryOption === "custom" && (
                  <input type="datetime-local" value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className={`w-full mt-2 border rounded-xl px-4 py-2.5 text-sm focus:outline-none ${inputCls}`} />
                )}
              </div>
            </div>
            <button onClick={handleGrantAccess} disabled={granting}
              className={`w-full py-2.5 rounded-xl font-medium text-sm transition disabled:opacity-40 disabled:cursor-not-allowed mt-auto
                ${dark ? "!bg-white !text-black hover:!bg-gray-200" : "!bg-black !text-white hover:!bg-gray-800"}`}>
              {granting ? "Granting..." : "Grant Access →"}
            </button>
          </div>
        </div>

        {/* MY FILES TABLE */}
        <div className={`mt-6 ${card} border rounded-2xl p-7`}>
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="text-lg font-clash font-medium">My Files</h2>
              <p className={`text-xs font-mono mt-0.5 ${subtext}`}>{myFiles.length} files uploaded</p>
            </div>
            <button onClick={() => navigate("/myfiles")}
              className={`text-xs font-mono px-3 py-1.5 border rounded-lg transition ${btnSecondary}`}>
              View All →
            </button>
          </div>

          {myFiles.length === 0 ? (
            <div className={`text-center py-8 font-mono text-sm ${subtext}`}>No files uploaded yet</div>
          ) : (
            <div className="flex flex-col gap-2">
              {myFiles.slice(0, 5).map((f) => (
                <div key={f._id}
                  className={`flex items-center justify-between ${cardInner} border rounded-xl px-5 py-3 transition`}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📄</span>
                    <span className={`font-mono text-sm ${dark ? "text-white/80" : "text-black/80"}`}>{f.name}</span>
                  </div>
                  <div className="flex gap-2">
                    {/* PREVIEW BUTTON */}
                    <button
                      onClick={() => setPreviewFile({
                        fileId: f._id,
                        fileName: f.name,
                        mimeType: f.mimetype ?? "application/octet-stream",
                      })}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition ${btnSecondary}`}>
                      👁️ Preview
                    </button>
                    <button onClick={() => handleDownload(f._id)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition ${btnSecondary}`}>
                      Download
                    </button>
                    <button onClick={() => navigate(`/logs/${f._id}`)}
                      className={`text-xs font-mono px-3 py-1.5 rounded-lg border transition ${btnSecondary}`}>
                      View Logs
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Dashboard;
