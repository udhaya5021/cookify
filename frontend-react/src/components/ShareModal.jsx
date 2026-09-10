import { useState } from "react";
import Modal from "./Modal";

// Hand-drawn (not fetched) brand-mark SVGs — no icon-font/library dependency,
// crisp at any size, and consistent across every OS instead of relying on
// the system emoji font for the share glyphs.
const ICONS = {
  whatsapp: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M12.004 2C6.49 2 2.007 6.483 2.007 11.997c0 1.762.462 3.478 1.34 4.988L2 22l5.145-1.35a9.96 9.96 0 0 0 4.858 1.238h.004c5.514 0 9.997-4.483 9.997-9.997C21.997 6.483 17.514 2 12.004 2zm0 18.14a8.3 8.3 0 0 1-4.229-1.156l-.303-.18-3.055.802.815-2.978-.198-.306a8.264 8.264 0 0 1-1.267-4.404c0-4.577 3.726-8.303 8.307-8.303 2.219 0 4.304.865 5.874 2.436a8.246 8.246 0 0 1 2.432 5.873c0 4.581-3.726 8.216-8.376 8.216z" />
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.472-.148-.67.15-.198.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.148.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  facebook: (
    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20">
      <path d="M22 12.06C22 6.505 17.523 2 12 2S2 6.505 2 12.06c0 5.022 3.657 9.184 8.438 9.94v-7.03H7.898v-2.91h2.54V9.845c0-2.507 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562v1.875h2.773l-.443 2.91h-2.33V22c4.78-.756 8.437-4.918 8.437-9.94z" />
    </svg>
  ),
  email: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="20"
      height="20"
    >
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m3.5 6.5 8.5 6 8.5-6" />
    </svg>
  ),
  copy: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
    >
      <rect x="9" y="9" width="12" height="12" rx="2.5" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  ),
  check: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      width="16"
      height="16"
    >
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
};

// URL-intent share links — no SDK, no API keys, just each platform's own
// share-compose URL prefilled with the recipe link and a caption.
function buildShareTargets(recipe, url) {
  const encodedUrl = encodeURIComponent(url);
  const encodedText = encodeURIComponent(`Check out "${recipe.title}" on Cookify`);
  return [
    {
      name: "WhatsApp",
      icon: ICONS.whatsapp,
      color: "#25D366",
      href: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    },
    {
      name: "X",
      icon: ICONS.x,
      color: "#000000",
      href: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    },
    {
      name: "Facebook",
      icon: ICONS.facebook,
      color: "#1877F2",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
    },
    {
      name: "Email",
      icon: ICONS.email,
      color: "#6b6157",
      href: `mailto:?subject=${encodedText}&body=${encodedUrl}`,
    },
  ];
}

export default function ShareModal({ recipe, url, onClose }) {
  const [copied, setCopied] = useState(false);

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API unavailable (e.g. non-HTTPS) — the field itself is
      // readonly + selectable, so manual copy still works as a fallback.
    }
  }

  return (
    <Modal title="Share Recipe" onClose={onClose}>
      <div className="share-link-row">
        <input type="text" readOnly value={url} onFocus={(e) => e.target.select()} />
        <button type="button" className={`share-copy-btn ${copied ? "copied" : ""}`} onClick={copyLink}>
          {copied ? ICONS.check : ICONS.copy}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <div className="share-icons">
        {buildShareTargets(recipe, url).map((s) => (
          <a key={s.name} href={s.href} target="_blank" rel="noopener noreferrer" className="share-icon-btn">
            <span className="share-icon-circle" style={{ background: s.color }}>
              {s.icon}
            </span>
            {s.name}
          </a>
        ))}
      </div>
    </Modal>
  );
}
