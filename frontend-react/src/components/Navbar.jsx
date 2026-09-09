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
      <Link to="/" className="logo">COOK<span>ify</span></Link>
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
