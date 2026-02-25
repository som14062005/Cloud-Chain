import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";

interface LogEntry {
  fileName: string;
  downloadedBy: string;
  downloadedAt: string;
}

export default function Logs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const token = getToken();
        const res = await axios.get("http://localhost:3000/files/logs", {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        setLogs(res.data.logs);
      } catch (err) {
        console.error("Failed to fetch logs:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchLogs();
  }, []);

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4">Download Logs</h2>
      {loading ? (
        <p>Loading logs...</p>
      ) : logs.length === 0 ? (
        <p>No downloads yet.</p>
      ) : (
        <table className="w-full table-auto border">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">File Name</th>
              <th className="border px-4 py-2">Downloaded By</th>
              <th className="border px-4 py-2">Time</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr key={idx} className="text-center">
                <td className="border px-4 py-2">{log.fileName}</td>
                <td className="border px-4 py-2">{log.downloadedBy}</td>
                <td className="border px-4 py-2">
                  {new Date(log.downloadedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
