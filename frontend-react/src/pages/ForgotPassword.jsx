import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [alert, setAlert] = useState(null);
  const [sent, setSent] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setAlert(null);
    try {
      await api("/api/auth/forgot-password", { method: "POST", body: { identifier } });
      setSent(true);
    } catch (err) {
      setAlert({ type: "error", text: err.message });
    }
  }

  return (
    <Layout>
      <div className="form-card">
        <h1>Forgot Password?</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}
        {sent ? (
          <p className="meta">
            We've emailed a password reset link to the address on file for that account. It works once and
            expires in 30 minutes.
          </p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="text"
              placeholder="Username / Email / Phone Number"
              required
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <button className="btn" type="submit" style={{ width: "100%" }}>
              Send reset link
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
