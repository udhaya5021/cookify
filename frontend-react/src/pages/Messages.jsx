import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api, API_BASE } from "../api";

export default function Messages() {
  const [conversations, setConversations] = useState(null);

  useEffect(() => {
    api("/api/chat/conversations", { auth: true })
      .then(setConversations)
      .catch(() => setConversations([]));
  }, []);

  return (
    <Layout>
      <div className="container">
        <h1 style={{ margin: "28px 0 18px" }}>Messages</h1>

        {conversations === null ? (
          <div className="loading-state"><span className="spinner"></span> Loading…</div>
        ) : conversations.length === 0 ? (
          <div className="empty-state">
            No conversations yet. Open a recipe, visit the cook's profile, and hit Message.
          </div>
        ) : (
          <div className="conversation-list">
            {conversations.map((c) => (
              <Link key={c.user_id} className="conversation" to={`/chat/${c.user_id}`}>
                {c.profile_picture_url
                  ? <img className="conversation-avatar" src={`${API_BASE}${c.profile_picture_url}`} alt="" />
                  : <div className="conversation-avatar conversation-avatar-empty">{c.username.charAt(0).toUpperCase()}</div>}
                <div className="conversation-text">
                  <div className="conversation-name">{c.username}</div>
                  <div className="conversation-preview">
                    {c.from_me && <span className="meta">You: </span>}{c.last_message}
                  </div>
                </div>
                <time className="meta">{new Date(c.last_at).toLocaleDateString()}</time>
              </Link>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
