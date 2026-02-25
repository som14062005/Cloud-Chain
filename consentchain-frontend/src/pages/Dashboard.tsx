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

interface MyFile {
  id: string;
  name: string;
}

function Dashboard() {
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [myFiles, setMyFiles] = useState<MyFile[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [toEmail, setToEmail] = useState("");
  const [selectedFileId, setSelectedFileId] = useState<string>("");
  const [expiryOption, setExpiryOption] = useState("");
  const [customExpiry, setCustomExpiry] = useState("");

  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      removeToken();
      navigate("/");
      return;
    }

    // Fetch shared files
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

    // Fetch user's own files
    axios
      .get("http://localhost:3000/files/myfiles", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => {
        setMyFiles(res.data.files);
        if (res.data.files.length > 0) {
          setSelectedFileId(res.data.files[0].id);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch user's files", err);
      });
  }, [navigate]);

  const handleUpload = () => {
    const token = getToken();
    if (!token) {
      alert("No token found, please login again.");
      removeToken();
      navigate("/");
      return;
    }
    if (!file) {
      alert("Please select a file.");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    axios
      .post("http://localhost:3000/files/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          Authorization: `Bearer ${token}`,
        },
      })
      .then(() => {
        alert("File uploaded!");
        setFile(null);
        // Optionally refresh user's files list after upload
        axios
          .get("http://localhost:3000/files/myfiles", {
            headers: { Authorization: `Bearer ${token}` },
          })
          .then((res) => {
            setMyFiles(res.data.files);
            if (res.data.files.length > 0) {
              setSelectedFileId(res.data.files[0].id);
            }
          });
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          alert("Session expired. Please login again.");
          removeToken();
          navigate("/");
        } else {
          alert("Failed to upload file.");
        }
      });
  };

  const handleGrantAccess = () => {
    const token = getToken();
    if (!token) {
      alert("No token found, please login again.");
      removeToken();
      navigate("/");
      return;
    }

    if (!toEmail.trim()) {
      alert("Please enter an email address.");
      return;
    }

    if (!selectedFileId) {
      alert("Please select a file to share.");
      return;
    }

    let expiryTime: string | null = null;

    if (expiryOption === "24h") {
      expiryTime = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    } else if (expiryOption === "7d") {
      expiryTime = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (expiryOption === "custom") {
      if (!customExpiry) {
        alert("Please select a custom expiry date.");
        return;
      }
      expiryTime = new Date(customExpiry).toISOString();
    }

    axios
      .post(
        "http://localhost:3000/files/grant",
        { fileId: selectedFileId, toEmail, expiryTime },
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      )
      .then(() => {
        alert("Access granted!");
        setToEmail("");
        setExpiryOption("");
        setCustomExpiry("");
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          alert("Session expired. Please login again.");
          removeToken();
          navigate("/");
        } else if (err.response?.data?.error) {
          alert(`Failed to grant access: ${err.response.data.error}`);
        } else {
          alert("Failed to grant access.");
        }
      });
  };

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
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      .then((res) => {
        const url = res.data.url;
        window.open(url, "_blank"); // Opens in new tab
      })
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
      return (
      <>
        <div className="w-full flex justify-end px-10 pt-6 space-x-4 absolute top-0 right-0">
          <span
            className="!font-mono text-[15px] text-gray-400 hover:text-white px-4 py-3 cursor-pointer transition"
            onClick={() => navigate("/sharedfiles")}
          >
            SHARED FILES
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
          <h1 className="text-3xl font-clash font-medium text-center mb-7 items-center justify-center">
            Dashboard
          </h1>
          <div className="w-screen max-w-7xl bg-gradient-to-t from-[#171717] to-[#303030] border border-gray-500 rounded-2xl p-10 shadow-2xl min-h-[400px] flex flex-col justify-center items-center">
            <div className="w-screen max-w-[1200px] bg-gradient-to-t from-[#000000] to-[#181818] border border-[#1b1b1b] rounded-2xl p-10 shadow-2xl min-h-[400px] flex flex-col justify-center">
              {/* Upload Section */}
              <div className="flex items-center justify-between gap-4 py-4">
                <label className="text-lg font-clash font-medium w-1/3">
                  Upload File
                </label>
                <input
                  type="file"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setFile(e.target.files[0]);
                    }
                  }}
                  className="text-sm file:mr-4 file:px-4 file:py-1 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-gray-800 file:text-white hover:file:bg-gray-700"
                />
                <button
                  onClick={handleUpload}
                  className="!bg-white !text-black px-5 py-2 rounded-full font-medium shadow-md border border-gray-300 hover:!bg-gray-200 transition"
                >
                  Upload
                </button>
              </div>

              {/* Grant Access Section */}
              <div className="flex items-center justify-between gap-4 py-11">
                <label className="text-lg font-clash font-medium w-1/6">
                  Grant Access
                </label>

                {/* File selection */}
                <select
                  value={selectedFileId}
                  onChange={(e) => setSelectedFileId(e.target.value)}
                  className="bg-[#1b1b1b] text-white border border-gray-600 rounded-md px-4 py-2 text-sm w-1/4"
                >
                  <option value="">Select File</option>
                  {myFiles.map((file) => (
                    <option key={file.id} value={file.id}>
                      {file.name}
                    </option>
                  ))}
                </select>

                {/* Email input */}
                <input
                  type="email"
                  placeholder="Email to share with"
                  value={toEmail}
                  onChange={(e) => setToEmail(e.target.value)}
                  className="bg-[#1b1b1b] border border-gray-600 rounded-md px-4 py-2 text-sm text-white w-1/4 placeholder-gray-400"
                />

                {/* Expiry selector */}
                <select
                  value={expiryOption}
                  onChange={(e) => setExpiryOption(e.target.value)}
                  className="bg-[#1b1b1b] text-white border border-gray-600 rounded-md px-4 py-2 text-sm w-1/6"
                >
                  <option value="">No Expiry</option>
                  <option value="24h">24 hours</option>
                  <option value="7d">7 days</option>
                  <option value="custom">Custom</option>
                </select>

                {/* Custom expiry datetime input */}
                {expiryOption === "custom" && (
                  <input
                    type="datetime-local"
                    value={customExpiry}
                    onChange={(e) => setCustomExpiry(e.target.value)}
                    className="bg-[#1b1b1b] border border-gray-600 rounded-md px-3 py-2 text-sm text-white w-1/4"
                  />
                )}

                {/* Grant button */}
                <button
                  onClick={handleGrantAccess}
                  className="!bg-white !text-black px-10 py-2 rounded-full font-medium shadow-md border border-gray-300 hover:!bg-gray-200 transition"
                >
                  Grant
                </button>
              </div>
            </div>
          </div>
        </div>
      </>
      );
    </>
  );
}

export default Dashboard;

// <div style={{ padding: "20px" }}>
//   <h2>ConsentChain Dashboard</h2>

//   <div>
//     <h3>Upload File</h3>
//     <input
//       type="file"
//       onChange={(e) => {
//         if (e.target.files && e.target.files.length > 0) {
//           setFile(e.target.files[0]);
//         }
//       }}
//     />
//     <button onClick={handleUpload}>Upload</button>
//   </div>

//   <div style={{ marginTop: "20px" }}>
//     <h3>Grant Access</h3>
//     <select
//       value={selectedFileId}
//       onChange={(e) => setSelectedFileId(e.target.value)}
//       style={{ marginRight: "10px" }}
//     >
//       {myFiles.map((file) => (
//         <option key={file.id} value={file.id}>
//           {file.name}
//         </option>
//       ))}
//     </select>
//     <input
//       type="email"
//       placeholder="Email to share with"
//       value={toEmail}
//       onChange={(e) => setToEmail(e.target.value)}
//     />
//     <button onClick={handleGrantAccess}>Grant Access</button>
//   </div>

//   <div style={{ marginTop: "20px" }}>
//     <h3>My Files</h3>
//     <ul>
//       {myFiles.length > 0 ? (
//         myFiles.map((file) => (
//           <li key={file.id}>
//             {file.name}
//             <button
//               onClick={() => handleDownload(file.id)}
//               style={{ marginLeft: 10 }}
//             >
//               Download
//             </button>
//             <button
//               onClick={() => navigate(`/logs/${file.id}`)}
//               style={{ marginLeft: 10 }}
//             >
//               View Logs
//             </button>
//           </li>
//         ))
//       ) : (
//         <li>No files uploaded yet.</li>
//       )}
//     </ul>
//   </div>

//   <div style={{ marginTop: "20px" }}>
//     <h3>Shared With You</h3>
//     <ul>
//       {sharedFiles.length > 0 ? (
//         sharedFiles.map((file, index) => (
//           <li key={index}>
//             {file.filename} (shared by {file.owner}){" "}
//             <button
//               onClick={() => {
//                 const token = getToken();
//                 window.open(
//                   `http://localhost:3000/files/download/${file.id}?token=${token}`,
//                   "_blank"
//                 );
//               }}
//             >
//               Download
//             </button>
//           </li>
//         ))
//       ) : (
//         <li>No files shared with you yet.</li>
//       )}
//     </ul>
//   </div>
// </div>
