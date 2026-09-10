import { useState, useEffect } from "react";
import { Link, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import Avatar from "../components/Avatar";
import { api, getToken } from "../api";

export default function Messages() {
  const [conversations, setConversations] = useState(null);

  useEffect(() => {
    api("/api/chat/conversations", { auth: true })
      .then(setConversations)
      .catch(() => setConversations([]));
  }, []);

  if (!getToken()) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="container">
        <h1 style={{ margin: "28px 0 18px" }}>Messages</h1>

        {conversations === null ? (
          <div className="loading-state">
            <span className="spinner"></span> Loading…
          </div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            No conversations yet. Open a recipe, visit the cook's profile, and hit Message.
          </div>
        ) : (
          <div className="conversation-list">
            {conversations.map((c) => (
              <Link
                key={c.user_id}
                className={`conversation ${c.unread_count > 0 ? "unread" : ""}`}
                to={`/chat/${c.user_id}`}
              >
                <Avatar
                  src={c.profile_picture_url}
                  label={c.username}
                  className="conversation-avatar"
                  emptyClassName="conversation-avatar-empty"
                />
                <div className="conversation-text">
                  <div className="conversation-name">{c.username}</div>
                  <div className="conversation-preview">
                    {c.from_me && <span className="meta">You: </span>}
                    {c.last_message}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  <time className="meta">{new Date(c.last_at).toLocaleDateString()}</time>
                  {c.unread_count > 0 && (
                    <span className="unread-badge">{c.unread_count > 9 ? "9+" : c.unread_count}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
