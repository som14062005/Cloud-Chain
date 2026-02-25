import { useEffect, useState } from "react";
import { getToken, removeToken } from "../utils/auth";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/background.css";

interface MyFile {
  id: string;
  name: string;
}

function MyFiles() {
  const [myFiles, setMyFiles] = useState<MyFile[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const token = getToken();
    if (!token) {
      removeToken();
      navigate("/");
      return;
    }

    axios
      .get("http://localhost:3000/files/myfiles", {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((res) => setMyFiles(res.data.files))
      .catch((err) => {
        if (err.response?.status === 401) {
          alert("Session expired. Please login again.");
          removeToken();
          navigate("/");
        }
      });
  }, [navigate]);

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
          onClick={() => navigate("/sharedfiles")}
        >
          SHARED FILES
        </span>
        <span
          className="!font-mono text-[15px] text-gray-400 hover:text-white px-4 py-3 cursor-pointer transition"
          onClick={() => {
            navigate("/analytics");
          }}
        >
          ANALYTICS
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

      {/* Main content */}
      <div className="w-screen h-screen overflow-hidden text-white">
        <div className="flex flex-col items-center w-full h-full overflow-hidden py-[20px]">
          <h1 className="text-3xl font-medium text-center mt-12 mb-8 pt-2">
            My Files
          </h1>

          <div className="backdrop-blur-md bg-white/10 border border-white/10 rounded-2xl shadow-2xl w-screen max-w-7xl max-h-[600px] px-10 py-12 flex flex-col justify-start items-center">
            {/* Fixed height of this container unchanged */}
            <div className="flex-1 min-h-0 w-full max-w-[1200px] bg-gradient-to-t from-[#000000] to-[#181818] border border-[#1b1b1b] rounded-2xl p-10 shadow-2xl overflow-y-auto scrollbar-thin">
              <div className="flex flex-col gap-5 w-full px-[75px] mx-auto">
                {myFiles.length > 0 ? (
                  myFiles.map((file) => (
                    <div
                      key={file.id}
                      className="w-full bg-[#111] border border-gray-700 rounded-2xl p-6 shadow-lg hover:bg-[#1a1a1a] transition flex items-center justify-between"
                    >
                      <div className="font-mono text-lg">📄 {file.name}</div>
                      <button
                        onClick={() => navigate(`/logs/${file.id}`)}
                        className="text-sm font-mono px-4 py-2 rounded-lg !bg-white !text-black hover:bg-white hover:text-black transition"
                      >
                        View Logs
                      </button>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-400 text-center py-10">
                    No files uploaded yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export default MyFiles;

//<div style={{ marginTop: "20px" }}>
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
