import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { saveToken } from "../utils/auth";

function OAuthHandler() {
  const navigate = useNavigate();
  const effectRan = useRef(false);

  useEffect(() => {
    if (effectRan.current) return; // Prevent double run in Strict Mode

    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get("token");
    console.log("OAuthHandler token:", token);

    if (token) {
      saveToken(token);
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/", { replace: true });
    }

    effectRan.current = true;
  }, [navigate]);

  return <p>Logging you in...</p>;
}

export default OAuthHandler;
