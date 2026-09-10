import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [alert, setAlert] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { identifier, new_password: newPassword } });
      setAlert({ type: "success", text: "Password reset — you can log in now." });
    } catch (err) {
      setAlert({ type: "error", text: err.message });
    }
  }

  return (
    <Layout>
      <div className="form-card">
        <h1>Forgot Password?</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}
        <form onSubmit={submit}>
          <input type="text" placeholder="Username / Email / Phone Number" required value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
          <input type="password" placeholder="New Password (9+ chars, no spaces)" required value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
          <button className="btn" type="submit" style={{ width: "100%" }}>Confirm New Password</button>
        </form>
        <p className="form-note"><Link to="/login">Back to Login</Link></p>
      </div>
    </Layout>
  );
}
