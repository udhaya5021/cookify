// Injects the shared navbar + footer into every page, so markup isn't
// duplicated across 9 HTML files. Include this after api.js.

function renderNavbar() {
  const loggedIn = !!getToken();
  document.getElementById("navbar").outerHTML = `
    <div class="navbar">
      <a href="index.html" class="logo">COOK<span>ify</span></a>
      <nav>
        <a href="browse.html">Explore</a>
        ${loggedIn ? '<a href="upload.html">Upload Recipe</a>' : ""}
        ${loggedIn ? `<a href="profile.html?id=${getMyUserId()}">Profile</a>` : ""}
        <div id="google_translate_element"></div>
        ${loggedIn
          ? '<a href="#" class="logout" onclick="logout(); return false;">Logout</a>'
          : '<a href="login.html">Login</a>'}
      </nav>
    </div>`;
}

function renderFooter() {
  const el = document.getElementById("footer");
  if (!el) return;
  el.outerHTML = `
    <footer>
      <div>
        <h3>Contact Us</h3>
        <div>Contact Info: +91 1234567890</div>
        <div>+91 0987654321</div>
      </div>
      <a href="#">Learn More About Us</a>
    </footer>`;
}

// Multi-language support (test case 12): rather than hand-translating every
// string into 5 languages, we plug into Google's translation widget, which
// is exactly what the assignment's test case asks for ("compatible with
// Google's translation feature").
function loadGoogleTranslate() {
  if (document.getElementById("google-translate-script")) return;
  window.googleTranslateElementInit = () => {
    new google.translate.TranslateElement(
      { pageLanguage: "en", includedLanguages: "hi,zh-CN,ru,es,fr", layout: google.translate.TranslateElement.InlineLayout.SIMPLE },
      "google_translate_element"
    );
  };
  const script = document.createElement("script");
  script.id = "google-translate-script";
  script.src = "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(script);
}

document.addEventListener("DOMContentLoaded", () => {
  renderNavbar();
  renderFooter();
  loadGoogleTranslate();
});
