import { API_BASE } from "../api";

// Shows an image or video if one exists, otherwise a fallback box with the
// first letter of `label` — the same "media or initial" pattern was
// duplicated across profile avatars, conversation rows, recipe cards, chat
// headers, and follower/following chips; this is the one place it lives now.
//
// `isVideo` decides <video> vs <img> — media_url alone (an opaque
// /api/recipes/{id}/media path) carries no file-type hint the way a real
// file extension would, so the caller passes it based on media_content_type.
export default function Avatar({ src, label, className, emptyClassName, style, isVideo, controls }) {
  const url = src ? (src.startsWith("http") ? src : `${API_BASE}${src}`) : null;

  if (url && isVideo) {
    return (
      <video
        className={className}
        src={url}
        style={style}
        controls={controls}
        muted={!controls}
        playsInline
        preload="metadata"
      />
    );
  }
  if (url) {
    return <img className={className} src={url} alt="" style={style} />;
  }
  return (
    <div className={`${className} ${emptyClassName}`} style={style}>
      {(label || "?").charAt(0).toUpperCase()}
    </div>
  );
}
