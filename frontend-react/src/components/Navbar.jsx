import { Link, NavLink, useNavigate } from "react-router-dom";
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

// On switching language, Google's own script (not just its initial markup)
// injects a full-width banner iframe and pushes the page down by setting an
// inline style on <body> or <html> — and it does this after the page has
// already loaded, sometimes more than once, which is why a CSS `!important`
// override alone doesn't stick: a later inline-style write from JS wins
// over any external stylesheet rule regardless.
//
// This app has no iframes of its own, so it's safe to be blunt: force out
// *any* iframe that looks like Google's (exact class names have shifted
// across widget versions, hence the src-based fallback too), and force the
// page's vertical offset back to 0 — both a MutationObserver (reacts
// immediately to the actual DOM change) and a standing interval (catches
// anything the observer's specific watch list misses, since Google's script
// isn't necessarily triggering the exact mutation types we're listening for).
function suppressGoogleTranslateBanner() {
  function enforce() {
    document
      .querySelectorAll('iframe.goog-te-banner-frame, iframe[src*="translate.google"]')
      .forEach((el) => {
        el.style.setProperty("display", "none", "important");
        el.style.setProperty("visibility", "hidden", "important");
        el.style.setProperty("height", "0", "important");
      });
    for (const el of [document.body, document.documentElement]) {
      el.style.setProperty("top", "0px", "important");
    }
  }
  enforce();
  const observer = new MutationObserver(enforce);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["style"] });
  observer.observe(document.body, { attributes: true, attributeFilter: ["style"], childList: true });
  observer.observe(document.documentElement, { childList: true });
  setInterval(enforce, 500);
}

export default function Navbar() {
  const loggedIn = !!getToken();
  const navigate = useNavigate();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    loadGoogleTranslate();
    suppressGoogleTranslateBanner();
  }, []);

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
    <div className="navbar">
      {/* notranslate + translate="no": Google Translate rewrites text nodes
          in place, which mangled the brand name into gibberish when it tried
          to translate "COOKify" split across this element and the nested
          <span> — a brand name shouldn't be translated at all anyway. */}
      <Link to="/" className="logo notranslate" translate="no">
        COOK<span>ify</span>
        <svg
          width="28"
          height="28"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--accent)"
          strokeWidth="1.6"
          style={{ marginLeft: 6, verticalAlign: "middle" }}
          aria-hidden="true"
        >
          <path d="M6 10c-2 0-3.5-1.6-3.5-3.5S4 3 6 3c.4 0 .8.06 1.1.18C7.6 1.9 8.7 1 10 1c1 0 1.9.5 2.4 1.3.5-.2 1-.3 1.6-.3 2.2 0 4 1.8 4 4 0 .5-.1 1-.3 1.4C19 8 20 9.5 20 11c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4 0-.4.06-.7.16-1" />
          <path d="M6 15v6h12v-6" strokeLinejoin="round" />
        </svg>
      </Link>
      <nav>
        <NavLink to="/browse" className={({ isActive }) => (isActive ? "active" : "")}>
          Explore
        </NavLink>
        {loggedIn && (
          <NavLink to="/upload" className={({ isActive }) => `upload-cta ${isActive ? "active" : ""}`}>
            Upload Recipe
          </NavLink>
        )}
        {loggedIn && (
          <NavLink to="/messages" className={({ isActive }) => `messages-link ${isActive ? "active" : ""}`}>
            Messages
            {unreadCount > 0 && <span className="unread-badge">{unreadCount > 9 ? "9+" : unreadCount}</span>}
          </NavLink>
        )}
        {loggedIn && (
          <NavLink to={`/profile/${getMyUserId()}`} className={({ isActive }) => (isActive ? "active" : "")}>
            Profile
          </NavLink>
        )}
        <div id="google_translate_element" className="lang-select"></div>
        {loggedIn ? (
          <button type="button" className="logout" onClick={logout}>
            Logout
          </button>
        ) : (
          <Link to="/login">Login</Link>
        )}
      </nav>
    </div>
  );
}
