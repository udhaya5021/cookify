import { useState } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [alert, setAlert] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { email, new_password: newPassword } });
      setAlert({ type: "success", text: "Password reset — you can log in now." });
    } catch (err) {
      setAlert({ type: "error", text: err.message });
    }
  }

  return (
    <>
      <Navbar />
      <div className="form-card">
        <h1>Forgot Password?</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}
        <form onSubmit={submit}>
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="password" placeholder="New Password (9+ chars, no spaces)" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button className="btn" type="submit" style={{ width: "100%" }}>Confirm New Password</button>
        </form>
        <p className="form-note"><Link to="/login">Back to Login</Link></p>
      </div>
      <Footer />
    </>
  );
}
