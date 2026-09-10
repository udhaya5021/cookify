import { useState, useEffect, useRef } from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import { api, API_BASE, getMyUserId, getToken } from "../api";

const TYPING_PING_INTERVAL = 2000; // ping at most this often while composing

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export default function Chat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [partner, setPartner] = useState(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const lastPingRef = useRef(0);
  const threadEndRef = useRef(null);
  const myId = getMyUserId();

  async function loadMessages() {
    try {
      const data = await api(`/api/chat/with/${userId}`, { auth: true });
      setMessages(data.messages);
      setPartnerTyping(data.partner_typing);
    } catch {
      // Logged-out visits are redirected below; a transient network hiccup
      // during polling shouldn't crash the page either way.
    }
  }

  function handleTyping(value) {
    setText(value);
    // Throttled: one ping every couple of seconds, not one per keystroke.
    const now = Date.now();
    if (value && now - lastPingRef.current > TYPING_PING_INTERVAL) {
      lastPingRef.current = now;
      api("/api/chat/typing", {
        method: "POST", auth: true,
        body: { recipient_id: parseInt(userId, 10) },
      }).catch(() => {}); // a dropped ping just means no dot — never break composing
    }
  }

  useEffect(() => {
    // Same reuse issue as Profile: navigating from /chat/1 to /chat/2 doesn't
    // remount this component, so a half-typed draft would otherwise carry
    // over and could get sent to the wrong recipient.
    setText("");
    api(`/api/users/${userId}`).then(setPartner).catch(() => setPartner(null));
    loadMessages();
    const interval = setInterval(loadMessages, 4000); // simple polling — see backend chat.py for the tradeoff note
    return () => clearInterval(interval);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    threadEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, partnerTyping]);

  async function send(e) {
    e.preventDefault();
    await api("/api/chat/send", { method: "POST", auth: true, body: { recipient_id: parseInt(userId, 10), text } });
    setText("");
    loadMessages();
  }

  if (!getToken()) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="container">
        <p className="meta" style={{ margin: "20px 0 12px" }}>
          <Link to="/messages">← All messages</Link>
        </p>

        <div className="chat-card">
          <div className="chat-header">
            {partner?.profile_picture_url
              ? <img className="chat-header-avatar" src={`${API_BASE}${partner.profile_picture_url}`} alt="" />
              : <div className="chat-header-avatar chat-header-avatar-empty">{(partner?.username || "?").charAt(0).toUpperCase()}</div>}
            <div className="chat-header-info">
              <div className="chat-header-name">{partner ? partner.username : "Chat"}</div>
              {partner && (
                <div className="chat-header-links"><Link to={`/profile/${userId}`}>View profile</Link></div>
              )}
            </div>
          </div>

          <div className="chat-thread">
            {messages.length === 0 && !partnerTyping && (
              <div className="chat-empty">No messages yet — say hello 👋</div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`chat-row ${m.sender_id === myId ? "mine" : "theirs"}`}>
                <div className="chat-bubble">
                  {m.text}
                  <span className="chat-time">{formatTime(m.created_at)}</span>
                </div>
              </div>
            ))}

            {partnerTyping && (
              <div className="typing-row">
                <span className="typing-bubble" aria-label={`${partner?.username || "They"} is typing`}>
                  <i></i><i></i><i></i>
                </span>
                <span className="meta">{partner?.username || "They"} is typing…</span>
              </div>
            )}
            <div ref={threadEndRef} />
          </div>

          <form className="chat-composer" onSubmit={send}>
            <input type="text" placeholder="Type a message..." required
              value={text} onChange={(e) => handleTyping(e.target.value)} />
            <button className="btn small" type="submit">Send</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
