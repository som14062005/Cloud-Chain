import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import OAuthHandler from "./pages/OAuthHandler";
import Dashboard from "./pages/Dashboard";
import SharedFiles from "./pages/SharedFiles";
import MyFiles from "./pages/MyFiles";
import Login from "./pages/Login";
import GrantedAccess from "./pages/GrantedAccess";
import "./styles/background.css";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        <Route path="/auth" element={<OAuthHandler />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/myfiles" element={<MyFiles />} />
        <Route path="/sharedfiles" element={<SharedFiles />} />
        <Route path="/grantaccess" element={<GrantedAccess />} />
      </Routes>
    </Router>
  );
}

export default App;