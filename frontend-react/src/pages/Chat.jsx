import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, getMyUserId } from "../api";

export default function Chat() {
  const { userId } = useParams();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const myId = getMyUserId();

  async function loadMessages() {
    const msgs = await api(`/api/chat/with/${userId}`, { auth: true });
    setMessages(msgs);
  }

  useEffect(() => {
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
    <>
      <Navbar />
      <div className="container">
        <div className="recipe-detail">
          <h1>Chat</h1>
          <p className="meta" style={{ marginBottom: 14 }}>Chatting with user #{userId}</p>
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
          </div>
          <form onSubmit={send} style={{ display: "flex", gap: 10 }}>
            <input type="text" placeholder="Type a message..." style={{ margin: 0 }} required
              value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn small" type="submit">Send</button>
          </form>
        </div>
      </div>
      <Footer />
    </>
  );
}
