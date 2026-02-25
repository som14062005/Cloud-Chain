import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";
import { useParams } from "react-router-dom";

type LogEntry = {
  type: string; // "download", "granted", "revoked", "expired"
  by: string;
  to?: string;
  at: string;
};

const FileLogs = () => {
  const { fileId } = useParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [revokedUsers, setRevokedUsers] = useState<Set<string>>(new Set());
  const [expiredUsers, setExpiredUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchLogs();
  }, [fileId]);

  const fetchLogs = async () => {
    try {
      const token = getToken();
      const response = await axios.get(
        `http://localhost:3000/files/logs/${fileId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        }
      );
      setLogs(response.data.logs);

      // update revoked and expired sets
      const revoked = new Set<string>();
      const expired = new Set<string>();
      for (const log of response.data.logs) {
        if (log.type === "revoked" && log.to) revoked.add(log.to);
        if (log.type === "expired" && log.to) expired.add(log.to);
      }
      setRevokedUsers(revoked);
      setExpiredUsers(expired);
    } catch (err) {
      setError("Failed to fetch logs or access denied");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRevoke = async (toEmail: string | undefined) => {
    if (!toEmail || !fileId) return;
    try {
      const token = getToken();
      await axios.post(
        "http://localhost:3000/files/revoke",
        { toEmail, fileId },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await fetchLogs(); // refresh logs after revoke
    } catch (err) {
      console.error("Failed to revoke access:", err);
      alert("Failed to revoke access.");
    }
  };

  if (loading) return <p className="text-center">Loading...</p>;
  if (error) return <p className="text-red-500 text-center">{error}</p>;

  return (
    <div className="w-screen h-screen flex flex-col items-center justify-start pt-20 bg-transparent">
      <div className="w-full max-w-4xl bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-10 py-12">
        <h1 className="text-3xl font-clash font-medium mb-8 tracking-wide text-center">
          Download Logs
        </h1>
        {logs.length === 0 ? (
          <p className="text-gray-400 text-center">No activity yet.</p>
        ) : (
          <ul className="space-y-4">
            {logs.map((log, index) => (
              <li
                key={index}
                className="p-5 rounded-2xl border border-gray-700 bg-gradient-to-br from-[#101010] to-[#1a1a1a] shadow-md"
              >
                <div className="font-mono text-sm flex justify-between items-center">
                  <span>
                    <span className="text-gray-400 mr-1">Action:</span>
                    {log.type === "download"
                      ? `File Downloaded by ${log.by}`
                      : log.type === "granted"
                      ? `Access Granted to ${log.to}`
                      : log.type === "revoked"
                      ? `Access Revoked from ${log.to}`
                      : log.type === "expired"
                      ? `Access Expired for ${log.to}`
                      : log.type}
                  </span>

                  {log.type === "granted" &&
                    log.to &&
                    !revokedUsers.has(log.to) &&
                    !expiredUsers.has(log.to) && (
                      <button
                        onClick={() => handleRevoke(log.to)}
                        className="ml-4 text-xs px-3 py-1 !bg-red-700 hover:bg-red-700 rounded-full text-white font-mono"
                      >
                        Revoke
                      </button>
                    )}
                </div>

                <div className="font-mono text-sm mt-1">
                  <span className="text-gray-400 mr-1">Time:</span>
                  {new Date(log.at).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FileLogs;
