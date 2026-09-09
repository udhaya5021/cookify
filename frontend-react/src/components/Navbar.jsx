import { Link, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { getToken, clearToken, getMyUserId } from "../api";

function loadGoogleTranslate() {
  if (document.getElementById("google-translate-script")) return;
  window.googleTranslateElementInit = () => {
    new window.google.translate.TranslateElement(
      { pageLanguage: "en", includedLanguages: "hi,zh-CN,ru,es,fr", layout: window.google.translate.TranslateElement.InlineLayout.SIMPLE },
      "google_translate_element"
    );
  };
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(script);
}

export default function Navbar() {
  const loggedIn = !!getToken();
  const navigate = useNavigate();

  useEffect(() => {
    loadGoogleTranslate();
  }, []);

  function logout() {
    clearToken();
    navigate("/");
  }

  return (
    <div className="navbar">
      <Link to="/" className="logo">
        COOK<span>ify</span>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.6"
          style={{ marginLeft: 6, verticalAlign: "middle" }} aria-hidden="true">
          <path d="M6 10c-2 0-3.5-1.6-3.5-3.5S4 3 6 3c.4 0 .8.06 1.1.18C7.6 1.9 8.7 1 10 1c1 0 1.9.5 2.4 1.3.5-.2 1-.3 1.6-.3 2.2 0 4 1.8 4 4 0 .5-.1 1-.3 1.4C19 8 20 9.5 20 11c0 2.2-1.8 4-4 4H8c-2.2 0-4-1.8-4-4 0-.4.06-.7.16-1" />
          <path d="M6 15v6h12v-6" strokeLinejoin="round" />
        </svg>
      </Link>
      <nav>
        <Link to="/browse">Explore</Link>
        {loggedIn && <Link to="/upload">Upload Recipe</Link>}
        {loggedIn && <Link to={`/profile/${getMyUserId()}`}>Profile</Link>}
        <div id="google_translate_element"></div>
        {loggedIn
          ? <a href="#" className="logout" onClick={(e) => { e.preventDefault(); logout(); }}>Logout</a>
          : <Link to="/login">Login</Link>}
      </nav>
    </div>
  );
}
