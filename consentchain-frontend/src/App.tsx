import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OAuthHandler from "./pages/OAuthHandler";
import Dashboard from "./pages/Dashboard";
import Logs from "./pages/Logs";
import FileLogs from "./pages/FileLogs";
import SharedFiles from "./pages/SharedFiles";
import MyFiles from "./pages/MyFiles";
import Login from "./pages/Login";
import "./styles/background.css";
import Analytics from "./pages/Analytics";
import GrantedAccess from "./pages/GrantedAccess";
import ViewLink from "./pages/ViewLink";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/auth" element={<OAuthHandler />} />
        <Route path="/logs" element={<Logs />} />
        <Route path="/logs/:fileId" element={<FileLogs />} />
        <Route path="/sharedfiles" element={<SharedFiles />} />
        <Route path="/myfiles" element={<MyFiles />} />
        <Route path="/" element={<Login />} />
        <Route path="/analytics" element={<Analytics />} />
        <Route path="/grantaccess" element={<GrantedAccess />} />
        <Route path="/view/:token" element={<ViewLink />} />
      </Routes>
    </Router>
  );
}

export default App;
