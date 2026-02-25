import { useEffect, useState } from "react";
import { getToken, removeToken } from "../utils/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/background.css";

interface SharedFile {
  id: string;
  filename: string;
  owner: string;
}

function SharedFiles() {
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      removeToken();
      navigate("/");
      return;
    }

    axios
      .get("http://localhost:3000/files/shared", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setSharedFiles(res.data.sharedFiles))
      .catch((err) => {
        if (err.response?.status === 401) {
          alert("Session expired. Please login again.");
          removeToken();
          navigate("/");
        }
      });
  }, [navigate]);

  const handleDownload = (fileId: string) => {
    const token = getToken();
    if (!token) {
      alert("Please login again.");
      removeToken();
      navigate("/");
      return;
    }

    axios
      .get(`http://localhost:3000/files/download/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => window.open(res.data.url, "_blank"))
      .catch((err) => {
        if (err.response?.status === 403) {
          alert("You do not have access to this file.");
        } else {
          alert("Failed to download file.");
        }
      });
  };

  return (
    <>
      <div className="w-full flex justify-end px-10 pt-6 space-x-4 absolute top-0 right-0">
        <span
          className="!font-mono text-[15px] text-gray-400 hover:text-white px-4 py-3 cursor-pointer transition"
          onClick={() => navigate("/dashboard")}
        >
          DASHBOARD
        </span>
        <span
          className="!font-mono text-[15px] text-gray-400 hover:text-white px-4 py-3 cursor-pointer transition"
          onClick={() => navigate("/myfiles")}
        >
          MY FILES
        </span>
        <span
          className="!font-mono text-[15px] text-gray-400 hover:text-white px-4 py-3 cursor-pointer transition"
          onClick={() => {
            removeToken();
            navigate("/");
          }}
        >
          LOGOUT
        </span>
      </div>

      <div className="absolute top-8 left-8 flex items-center gap-2 z-50">
        <div className="w-8 h-8 rounded-full bg-white text-black flex items-center justify-center font-bold text-sm shadow-md">
          CC
        </div>
        <span className="text-white tracking wide font-clash text-xl font-medium tracking-wide">
          Consent<span className="text-white/60 px-0.5">Chain</span>
        </span>
      </div>

      <div className="w-screen h-screen flex flex-col items-center justify-center bg-transparent">
        <h1 className="text-3xl font-clash font-medium text-center mb-7">
          Shared Files
        </h1>

        <div className="w-screen max-w-7xl bg-gradient-to-t from-[#171717] to-[#303030] border border-gray-500 rounded-2xl p-10 shadow-2xl min-h-[500px] flex flex-col justify-start items-center">
          <div className="w-full max-w-[1200px] bg-gradient-to-t from-[#000000] to-[#181818] border border-[#1b1b1b] rounded-2xl p-10 shadow-2xl min-h-[400px] max-h-[500px] overflow-y-auto scrollbar-thin">
            <div className="flex flex-col gap-5 w-full px-[75px] mx-auto">
              {sharedFiles.length > 0 ? (
                sharedFiles.map((file) => (
                  <div
                    key={file.id}
                    className="w-full bg-[#111] border border-gray-700 rounded-2xl p-6 shadow-lg flex items-center justify-between hover:bg-[#1a1a1a] transition"
                  >
                    <div>
                      <div className="font-mono text-lg">
                        📄 {file.filename}
                      </div>
                      <div className="text-sm text-gray-400 mt-1">
                        Shared by: {file.owner}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file.id)}
                      className="!bg-white text-black text-sm font-medium rounded-full px-4 py-2 shadow hover:bg-gray-200 transition"
                    >
                      Download
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-gray-400 text-center py-10">
                  No files shared with you.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default SharedFiles;
