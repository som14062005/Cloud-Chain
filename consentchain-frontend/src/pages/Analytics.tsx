import { useEffect, useState } from "react";
import axios from "axios";
import { getToken } from "../utils/auth";
import { useNavigate } from "react-router-dom";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  BarChart, Bar, CartesianGrid, PieChart, Pie, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, LineChart, Line,
} from "recharts";

type AccessData = { fileName: string; downloadCount: number };
type PatternData = { date: string; count: number };

const AnimatedNumber = ({ value }: { value: number }) => {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = Math.ceil(value / 40) || 1;
    const timer = setInterval(() => {
      start += step;
      if (start >= value) { setDisplay(value); clearInterval(timer); }
      else setDisplay(start);
    }, 30);
    return () => clearInterval(timer);
  }, [value]);
  return <span>{display}</span>;
};

const COLORS = ["#6366f1", "#a78bfa", "#34d399", "#f59e0b", "#f87171", "#38bdf8"];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono shadow-2xl">
      <div className="text-white/40 mb-1">{label}</div>
      <div className="text-indigo-400 font-bold text-sm">{payload[0].value}</div>
    </div>
  );
};

const PieTooltip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#111] border border-white/10 rounded-xl px-4 py-2.5 text-xs font-mono shadow-2xl">
      <div className="text-white/60">{payload[0].name}</div>
      <div className="text-indigo-400 font-bold">{payload[0].value} downloads</div>
      <div className="text-white/30">{payload[0].payload.percent}%</div>
    </div>
  );
};

export default function Analytics() {
  const [totalDownloads, setTotalDownloads] = useState(0);
  const [mostAccessed, setMostAccessed] = useState<AccessData[]>([]);
  const [accessPattern, setAccessPattern] = useState<PatternData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const token = getToken();
        const res = await axios.get("http://13.235.114.188:3000/files/analytics/summary", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setTotalDownloads(res.data.totalDownloads);
        setMostAccessed(res.data.mostAccessed);
        setAccessPattern(res.data.accessPattern);
        setTimeout(() => setVisible(true), 100);
      } catch { setError("Failed to fetch analytics"); }
      finally { setLoading(false); }
    })();
  }, []);

  const topFile = mostAccessed[0];
  const last7Days = accessPattern.slice(-7);
  const recentCount = last7Days.reduce((a, d) => a + d.count, 0);
  const trend = accessPattern.length >= 2
    ? accessPattern.at(-1)!.count - accessPattern.at(-2)!.count : 0;
  const peakDay = [...accessPattern].sort((a, b) => b.count - a.count)[0];
  const maxDownloads = Math.max(...mostAccessed.map((f) => f.downloadCount), 1);

  // Pie data with percent
  const pieData = mostAccessed.slice(0, 6).map((f) => ({
    name: f.fileName.length > 16 ? f.fileName.slice(0, 16) + "…" : f.fileName,
    value: f.downloadCount,
    percent: Math.round((f.downloadCount / (totalDownloads || 1)) * 100),
  }));

  // Radar data — map files to radar shape
  const radarData = mostAccessed.slice(0, 6).map((f) => ({
    file: f.fileName.length > 12 ? f.fileName.slice(0, 12) + "…" : f.fileName,
    value: f.downloadCount,
  }));

  // Day-of-week aggregation
  const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dowMap: Record<string, number> = { Sun: 0, Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0 };
  accessPattern.forEach((d) => {
    const dow = daysOfWeek[new Date(d.date).getDay()];
    if (dow) dowMap[dow] += d.count;
  });
  const dowData = daysOfWeek.map((d) => ({ day: d, count: dowMap[d] }));

  if (loading) return (
    <div className="w-screen h-screen bg-[#080808] flex items-center justify-center">
      <div className="relative w-16 h-16">
        <div className="absolute inset-0 rounded-full border-2 border-indigo-500/20 border-t-indigo-500 animate-spin" />
        <div className="absolute inset-3 rounded-full border-2 border-purple-500/20 border-t-purple-500 animate-spin [animation-duration:0.6s]" />
      </div>
    </div>
  );

  if (error) return (
    <div className="w-screen h-screen bg-[#080808] flex items-center justify-center">
      <p className="text-red-400 font-mono">{error}</p>
    </div>
  );

  const anim = (delay = 0) =>
    `transition-all duration-700 ${visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5"}`
    + ` delay-[${delay}ms]`;

  return (
    <div className="w-screen h-screen flex bg-[#080808] text-white overflow-hidden">

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
              { label: "Shared Files", icon: "📂", path: "/sharedfiles" },
              { label: "Analytics", icon: "📊", path: "/analytics", active: true },
              { label: "Logs", icon: "📝", path: "/logs" },
              { label: "Granted Access", icon: "📝", path: "/grantaccess" },
            ].map((item) => (
              <span key={item.path} onClick={() => navigate(item.path)}
                className={`font-mono text-[13px] px-3 py-2.5 rounded-xl cursor-pointer transition flex items-center gap-2
                  ${item.active ? "bg-white/10 text-white" : "text-gray-500 hover:text-white hover:bg-white/5"}`}>
                {item.icon} {item.label}
              </span>
            ))}
          </div>
        </div>
        <span onClick={() => navigate("/")}
          className="font-mono text-[13px] text-red-500/80 hover:text-red-400 px-3 py-2.5 rounded-xl hover:bg-red-500/10 cursor-pointer transition flex items-center gap-2">
          🚪 Logout
        </span>
      </div>

      {/* ── MAIN ── */}
      <div className="flex-1 overflow-y-auto px-10 py-10 space-y-8">

        {/* ── HEADER ── */}
        <div className={anim(0)}>
          <div className="flex items-end justify-between">
            <div>
              <p className="text-[10px] font-mono text-indigo-400 tracking-[0.3em] uppercase mb-1">Overview</p>
              <h1 className="text-4xl font-clash font-semibold tracking-tight">Analytics</h1>
              <p className="text-white/30 text-sm font-mono mt-1">Track file access and download patterns</p>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono text-white/20 border border-white/5 px-3 py-1.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
              Live data
            </div>
          </div>
        </div>

        {/* ── STAT CARDS ── */}
        <div className={`grid grid-cols-4 gap-4 ${anim(100)}`}>
          {[
            { label: "Total Downloads", value: totalDownloads, icon: "📥", color: "text-green-400", border: "border-green-400/10", bg: "bg-green-400/5" },
            { label: "Last 7 Days", value: recentCount, icon: "📅", color: "text-blue-400", border: "border-blue-400/10", bg: "bg-blue-400/5" },
            { label: "Files Tracked", value: mostAccessed.length, icon: "📁", color: "text-purple-400", border: "border-purple-400/10", bg: "bg-purple-400/5" },
            {
              label: "Trend", value: trend > 0 ? `+${trend}` : `${trend}`,
              icon: trend > 0 ? "📈" : trend < 0 ? "📉" : "➡️",
              color: trend > 0 ? "text-green-400" : trend < 0 ? "text-red-400" : "text-white/30",
              border: "border-white/5", bg: "bg-white/5"
            },
          ].map((s, i) => (
            <div key={s.label}
              style={{ transitionDelay: `${120 + i * 60}ms` }}
              className={`border ${s.border} ${s.bg} rounded-2xl p-5 transition-all duration-700 ${visible ? "opacity-100 scale-100" : "opacity-0 scale-95"}`}>
              <div className="text-2xl mb-3">{s.icon}</div>
              <div className={`text-3xl font-clash font-bold ${s.color}`}>
                {typeof s.value === "number" ? <AnimatedNumber value={s.value} /> : s.value}
              </div>
              <div className="text-white/30 text-xs font-mono mt-1">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── HIGHLIGHTS: TOP FILE + PEAK DAY ── */}
        <div className={`grid grid-cols-2 gap-4 ${anim(200)}`}>
          {topFile && (
            <div className="bg-gradient-to-r from-green-400/10 to-transparent border border-green-400/20 rounded-2xl px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">🏆</span>
                <div>
                  <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Most Accessed</div>
                  <div className="font-clash font-medium text-white mt-0.5">{topFile.fileName}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-clash font-bold text-green-400"><AnimatedNumber value={topFile.downloadCount} /></div>
                <div className="text-[10px] font-mono text-white/30">downloads</div>
              </div>
            </div>
          )}
          {peakDay && (
            <div className="bg-gradient-to-r from-purple-400/10 to-transparent border border-purple-400/20 rounded-2xl px-6 py-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-3xl">⚡</span>
                <div>
                  <div className="text-[10px] font-mono text-white/30 uppercase tracking-widest">Peak Day</div>
                  <div className="font-clash font-medium text-white mt-0.5">{peakDay.date}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-clash font-bold text-purple-400"><AnimatedNumber value={peakDay.count} /></div>
                <div className="text-[10px] font-mono text-white/30">downloads</div>
              </div>
            </div>
          )}
        </div>

        {/* ── SECTION 1: AREA CHART — Downloads Over Time ── */}
        <div className={`bg-[#0e0e0e] border border-white/5 rounded-2xl p-8 ${anim(300)}`}>
          <div className="mb-6">
            <p className="text-[10px] font-mono text-indigo-400 tracking-widest uppercase mb-1">Timeline</p>
            <h2 className="text-xl font-clash font-semibold">Downloads Over Time</h2>
            <p className="text-white/20 text-xs font-mono mt-1">Daily download activity across all files</p>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <AreaChart data={accessPattern}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#111" vertical={false} />
              <XAxis dataKey="date" stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#444" }} />
              <YAxis allowDecimals={false} stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#444" }} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="count" stroke="#6366f1" strokeWidth={2.5} fill="url(#areaGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── SECTION 2: PIE + BAR side by side ── */}
        <div className={`grid grid-cols-2 gap-6 ${anim(400)}`}>

          {/* Pie Chart — share of downloads per file */}
          <div className="bg-[#0e0e0e] border border-white/5 rounded-2xl p-8">
            <div className="mb-6">
              <p className="text-[10px] font-mono text-purple-400 tracking-widest uppercase mb-1">Distribution</p>
              <h2 className="text-xl font-clash font-semibold">Download Share by File</h2>
              <p className="text-white/20 text-xs font-mono mt-1">Which files dominate your downloads</p>
            </div>
            <div className="flex items-center gap-6">
              <ResponsiveContainer width="55%" height={220}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={90}
                    dataKey="value" paddingAngle={3}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]}
                        style={{ filter: `drop-shadow(0 0 6px ${COLORS[i % COLORS.length]}55)` }} />
                    ))}
                  </Pie>
                  <Tooltip content={<PieTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              {/* Legend */}
              <div className="flex flex-col gap-2 flex-1">
                {pieData.map((d, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    <span className="text-[11px] font-mono text-white/50 truncate flex-1">{d.name}</span>
                    <span className="text-[11px] font-mono text-white/30">{d.percent}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Horizontal Bar — file ranking */}
          <div className="bg-[#0e0e0e] border border-white/5 rounded-2xl p-8">
            <div className="mb-6">
              <p className="text-[10px] font-mono text-green-400 tracking-widest uppercase mb-1">Ranking</p>
              <h2 className="text-xl font-clash font-semibold">Most Accessed Files</h2>
              <p className="text-white/20 text-xs font-mono mt-1">Ranked by total download count</p>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={mostAccessed.slice(0, 6)} layout="vertical">
                <XAxis type="number" stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#444" }} />
                <YAxis dataKey="fileName" type="category" width={110}
                  stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#555" }} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="downloadCount" radius={[0, 6, 6, 0]}>
                  {mostAccessed.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── SECTION 3: DAY OF WEEK BAR ── */}
        <div className={`bg-[#0e0e0e] border border-white/5 rounded-2xl p-8 ${anim(500)}`}>
          <div className="mb-6">
            <p className="text-[10px] font-mono text-amber-400 tracking-widest uppercase mb-1">Patterns</p>
            <h2 className="text-xl font-clash font-semibold">Activity by Day of Week</h2>
            <p className="text-white/20 text-xs font-mono mt-1">Which days of the week see the most downloads</p>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={dowData}>
              <CartesianGrid stroke="#111" vertical={false} />
              <XAxis dataKey="day" stroke="#1e1e1e" tick={{ fontSize: 11, fill: "#555" }} />
              <YAxis allowDecimals={false} stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#444" }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                {dowData.map((d, i) => (
                  <Cell key={i} fill={d.count === Math.max(...dowData.map((x) => x.count)) ? "#f59e0b" : "#2a2a3a"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <p className="text-[10px] font-mono text-amber-400/60 mt-3 text-center">
            ★ Peak day highlighted in amber
          </p>
        </div>

        {/* ── SECTION 4: RADAR CHART ── */}
        {radarData.length >= 3 && (
          <div className={`bg-[#0e0e0e] border border-white/5 rounded-2xl p-8 ${anim(600)}`}>
            <div className="mb-6">
              <p className="text-[10px] font-mono text-sky-400 tracking-widest uppercase mb-1">Coverage</p>
              <h2 className="text-xl font-clash font-semibold">File Access Radar</h2>
              <p className="text-white/20 text-xs font-mono mt-1">Relative popularity of each file at a glance</p>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="#1e1e1e" />
                <PolarAngleAxis dataKey="file" tick={{ fontSize: 11, fill: "#555" }} />
                <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.15} strokeWidth={2} />
                <Tooltip content={<CustomTooltip />} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ── SECTION 5: LAST 7 DAYS LINE ── */}
        <div className={`bg-[#0e0e0e] border border-white/5 rounded-2xl p-8 ${anim(700)}`}>
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-mono text-emerald-400 tracking-widest uppercase mb-1">Recent</p>
              <h2 className="text-xl font-clash font-semibold">Last 7 Days</h2>
              <p className="text-white/20 text-xs font-mono mt-1">{recentCount} downloads this week</p>
            </div>
            <span className={`text-xs font-mono px-4 py-1.5 rounded-full border
              ${trend > 0 ? "text-green-400 border-green-400/20 bg-green-400/5"
              : trend < 0 ? "text-red-400 border-red-400/20 bg-red-400/5"
              : "text-white/20 border-white/5"}`}>
              {trend > 0 ? `↑ +${trend} vs yesterday` : trend < 0 ? `↓ ${trend} vs yesterday` : "→ Steady"}
            </span>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={last7Days}>
              <CartesianGrid stroke="#111" vertical={false} />
              <XAxis dataKey="date" stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#444" }} />
              <YAxis allowDecimals={false} stroke="#1e1e1e" tick={{ fontSize: 10, fill: "#444" }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="count" stroke="#34d399" strokeWidth={2.5}
                dot={{ fill: "#34d399", r: 5, strokeWidth: 0 }}
                activeDot={{ r: 7, fill: "#34d399", strokeWidth: 0 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* bottom padding */}
        <div className="h-4" />
      </div>
    </div>
  );
}
