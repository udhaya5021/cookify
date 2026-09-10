import { API_BASE } from "../api";

// Shows an image if one exists, otherwise a fallback box with the first
// letter of `label` — the same "picture or initial" pattern was duplicated
// across profile avatars, conversation rows, recipe cards, chat headers,
// and follower/following chips; this is the one place it lives now.
export default function Avatar({ src, label, className, emptyClassName, style }) {
  const url = src ? (src.startsWith("http") ? src : `${API_BASE}${src}`) : null;

  if (url) {
    return <img className={className} src={url} alt="" style={style} />;
  }
  return (
    <div className={`${className} ${emptyClassName}`} style={style}>
      {(label || "?").charAt(0).toUpperCase()}
    </div>
  );
}
