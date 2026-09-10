import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api, getMyUserId } from "../api";

const TYPING_PING_INTERVAL = 2000; // ping at most this often while composing

export default function Chat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [partner, setPartner] = useState(null);
  const [partnerTyping, setPartnerTyping] = useState(false);
  const lastPingRef = useRef(0);
  const myId = getMyUserId();

  async function loadMessages() {
    const data = await api(`/api/chat/with/${userId}`, { auth: true });
    setMessages(data.messages);
    setPartnerTyping(data.partner_typing);
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
    api(`/api/users/${userId}`).then(setPartner).catch(() => setPartner(null));
    loadMessages();
    const interval = setInterval(loadMessages, 4000); // simple polling — see backend chat.py for the tradeoff note
    return () => clearInterval(interval);
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function send(e) {
    e.preventDefault();
    await api("/api/chat/send", { method: "POST", auth: true, body: { recipient_id: parseInt(userId, 10), text } });
    setText("");
    loadMessages();
  }

  return (
    <Layout>
      <div className="container">
        <div className="recipe-detail">
          <h1>{partner ? partner.username : "Chat"}</h1>
          <p className="meta" style={{ marginBottom: 14 }}>
            <Link to="/messages">← All messages</Link>
            {partner && <> · <Link to={`/profile/${userId}`}>View profile</Link></>}
          </p>
          <div style={{ maxHeight: 400, overflowY: "auto", marginBottom: 16 }}>
            {messages.map((m) => (
              <div key={m.id} style={{ textAlign: m.sender_id === myId ? "right" : "left", margin: "6px 0" }}>
                <span style={{
                  background: m.sender_id === myId ? "var(--accent)" : "#eee",
                  color: m.sender_id === myId ? "#fff" : "#000",
                  padding: "8px 14px", borderRadius: 14, display: "inline-block",
                }}>{m.text}</span>
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
          </div>
          <form onSubmit={send} style={{ display: "flex", gap: 10 }}>
            <input type="text" placeholder="Type a message..." style={{ margin: 0 }} required
              value={text} onChange={(e) => handleTyping(e.target.value)} />
            <button className="btn small" type="submit">Send</button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
