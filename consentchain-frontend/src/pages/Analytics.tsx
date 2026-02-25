import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  CartesianGrid,
} from "recharts";

type AccessData = {
  fileName: string;
  downloadCount: number;
};

type PatternData = {
  date: string;
  count: number;
};

const Analytics = () => {
  const [totalDownloads, setTotalDownloads] = useState<number>(0);
  const [mostAccessed, setMostAccessed] = useState<AccessData[]>([]);
  const [accessPattern, setAccessPattern] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const token = getToken();
        const res = await axios.get(
          "http://localhost:3000/files/analytics/summary",
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        );
        setTotalDownloads(res.data.totalDownloads);
        setMostAccessed(res.data.mostAccessed);
        setAccessPattern(res.data.accessPattern);
      } catch (err) {
        setError("Failed to fetch analytics");
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, []);

  const topFile = mostAccessed[0];
  const last7Days = accessPattern.slice(-7);
  const recentCount = last7Days.reduce((acc, d) => acc + d.count, 0);
  const trend =
    accessPattern.length >= 2
      ? accessPattern.at(-1)!.count - accessPattern.at(-2)!.count
      : 0;

  if (loading)
    return <p className="text-center mt-20 text-white">Loading...</p>;
  if (error) return <p className="text-red-500 text-center mt-20">{error}</p>;

  return (
    <div className="w-screen h-screen overflow-y-auto scrollbar-thin scrollbar-thumb-white/30 scrollbar-track-white/10 bg-transparent">
      <div className="max-w-6xl mx-auto pt-20 px-4 pb-20">
        <div className="w-full bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl shadow-2xl px-10 py-12 space-y-12">
          <h1 className="text-3xl font-clash font-medium tracking-wide text-center text-white">
            Analytics Dashboard
          </h1>

          {/* Total Downloads */}
          <div className="text-white text-center text-xl font-clash font-medium text-[25px]">
            📥 Total Downloads:{" "}
            <span className="font-medium text-green-400">{totalDownloads}</span>
          </div>

          {/* Mini Sparkline */}
          <div className="bg-black/30 p-2 rounded-xl">
            <ResponsiveContainer width="100%" height={80}>
              <LineChart data={accessPattern.slice(-10)}>
                <Line
                  type="monotone"
                  dataKey="count"
                  stroke="#00C49F"
                  strokeWidth={2}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Trend Info */}
          <div className="text-sm text-gray-400 text-center italic">
            {trend > 0
              ? "⬆️ Download activity increasing"
              : trend < 0
              ? "⬇️ Download activity decreasing"
              : "➡️ Activity steady"}
          </div>

          {/* Top File Highlight */}
          {topFile && (
            <div className="text-center text-white font-mono text-lg bg-black/20 p-4 rounded-xl border border-green-600 shadow-lg">
              🏆 <strong>{topFile.fileName}</strong> is your most accessed file
              with{" "}
              <span className="text-green-400 font-bold">
                {topFile.downloadCount}
              </span>{" "}
              downloads.
            </div>
          )}

          {/* Last 7 Days Summary */}
          <div className="text-white text-center font-clash text-base">
            📊 Downloads in last 7 days:{" "}
            <span className="text-blue-400">{recentCount}</span>
          </div>

          {/* Most Accessed Files */}
          <div>
            <h2 className="text-lg font-clash overflow-x-auto font-medium text-white mb-4">
              Most Accessed Files
            </h2>
            <div className="bg-[#111111] overflow-x-auto rounded-2xl p-4 border border-gray-700 font-mono text-[13px]">
              <div className="min-w-[600px]">
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={mostAccessed} layout="vertical">
                    <XAxis type="number" stroke="#ccc" />
                    <YAxis
                      dataKey="fileName"
                      type="category"
                      width={150}
                      stroke="#ccc"
                    />
                    <Tooltip />
                    <Bar
                      dataKey="downloadCount"
                      fill="#00C49F"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Access Pattern Over Time */}
          <div>
            <h2 className="text-lg font-clash font-medium text-white mb-4">
              Access Pattern Over Time
            </h2>
            <div className="bg-[#111111] rounded-2xl p-4 font-mono text-[13px] border border-gray-700">
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={accessPattern}>
                  <XAxis dataKey="date" stroke="#ccc" />
                  <YAxis allowDecimals={false} stroke="#ccc" />
                  <CartesianGrid stroke="#333" />
                  <Tooltip />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#8884d8"
                    strokeWidth={2}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Analytics;
