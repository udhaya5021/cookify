import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { api, getToken, clearToken, getMyUserId } from "../api";

const UNREAD_POLL_INTERVAL = 8000; // independent of the Chat page's own 4s poll — this runs everywhere

function loadGoogleTranslate() {
  if (document.getElementById("google-translate-script")) return;
  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      {
        pageLanguage: "en",
        includedLanguages: "hi,zh-CN,ru,es,fr",
        layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE,
      },
      "google_translate_element",
    );
  };
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  script.async = true;
  document.body.appendChild(script);
}

export default function Navbar({ minimal = false }) {
  const loggedIn = !!getToken();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!minimal) loadGoogleTranslate();
  }, [minimal]);

  useEffect(() => {
    if (!loggedIn) return;
    function poll() {
      api("/api/chat/unread-count", { auth: true })
        .then((d) => setUnreadCount(d.count))
        .catch(() => {});
    }
    poll();
    const interval = setInterval(poll, UNREAD_POLL_INTERVAL);
    return () => clearInterval(interval);
  }, [loggedIn]);

  function logout() {
    clearToken();
    navigate("/");
  }

  return (
    <div className={`navbar ${minimal ? "navbar-minimal" : ""}`}>
      <Link to="/" className="logo">
        COOK<span>ify</span>
        <svg
          width="44"
          height="44"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.4"
          style={{ marginLeft: 4, verticalAlign: "middle" }}
          aria-hidden="true"
        >
          <path d="M6 10c-2 0-3.5-1.6-3.5-3.5S4 3 6 3c.4 0 .8.06 1.1.18C7.6 1.9 8.7 1 10 1c1 0 1.9.5 2.4 1.3.5-.2 1-.3 1.6-.3 2.2 0 4 1.8 4 4 0 .5-.1 1-.3 1.4C19 8 20 9.5 20 11c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4 0-.4.06-.7.16-1" />
          <path d="M6 15v6h12v-6" strokeLinejoin="round" />
        </svg>
      </Link>
      {/* Wireframe: Login, Signup, Forgot/Reset Password, and the landing
          page show just the logo — no nav links — with navigation handled
          by in-page buttons instead (e.g. Home's own Login/Sign Up links). */}
      {!minimal && (
        <nav>
          <Link to="/browse">Explore</Link>
          {loggedIn && <Link to="/upload">Upload Recipe</Link>}
          {loggedIn && (
            <Link to="/messages" className="messages-link">
              Messages
              {unreadCount > 0 && (
                <span className="unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>
              )}
            </Link>
          )}
          {loggedIn && <Link to={`/profile/${getMyUserId()}`}>Profile</Link>}
          <div id="google_translate_element"></div>
          {loggedIn ? (
            <button type="button" className="logout" onClick={logout}>
              Logout
            </button>
          ) : (
            <Link to="/login">Login</Link>
          )}
        </nav>
      )}
    </div>
  );
}
