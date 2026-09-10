import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [alert, setAlert] = useState(null);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    if (newPassword !== confirm) {
      setAlert({ type: "error", text: "Passwords do not match" });
      return;
    }
    try {
      await api("/api/auth/reset-password", { method: "POST", body: { token, new_password: newPassword } });
      setAlert({ type: "success", text: "Password reset — redirecting to login…" });
      setTimeout(() => navigate("/login"), 1500);
    } catch (err) {
      setAlert({ type: "error", text: err.message });
    }
  }

  return (
    <Layout>
      <div className="form-card">
        <h1>Reset Password</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}
        {!token ? (
          <p className="meta">
            This link is missing its reset token. Use the link from the email you were sent, or{" "}
            <Link to="/forgot-password">request a new one</Link>.
          </p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="password"
              placeholder="New password (9+ chars, no spaces)"
              required
              minLength={9}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <input
              type="password"
              placeholder="Confirm new password"
              required
              minLength={9}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <button className="btn" type="submit" style={{ width: "100%" }}>
              Confirm New Password
            </button>
          </form>
        )}
        <p className="form-note">
          <Link to="/login">Back to Login</Link>
        </p>
      </div>
    </Layout>
  );
}
