import { useState } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { api } from "../api";

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState(""); // set once a code has been emailed
  const [done, setDone] = useState(false);
  const [alert, setAlert] = useState(null);

  async function submit(e) {
    e.preventDefault();
    setAlert(null);

    // Wireframe: identifier + new password on one page. The password isn't
    // applied until the emailed code is confirmed — same one-screen,
    // double-duty button pattern as Login/Signup.
    if (pendingEmail) {
      try {
        await api("/api/auth/verify-reset-otp", { method: "POST", body: { email: pendingEmail, otp } });
        setDone(true);
      } catch (err) {
        setAlert({ type: "error", text: err.message });
      }
      return;
    }

    try {
      const res = await api("/api/auth/forgot-password", {
        method: "POST",
        body: { identifier, new_password: newPassword },
      });
      setPendingEmail(res.email);
      setAlert({
        type: "success",
        text: `We've emailed a 6-digit code to ${res.email} — enter it above and confirm again.`,
      });
    } catch (err) {
      setAlert({ type: "error", text: err.message });
    }
  }

  return (
    <Layout minimal>
      <div className="form-card">
        <h1>Forgot Password?</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}
        {done ? (
          <p className="meta">Password reset successfully — you can log in with your new password now.</p>
        ) : (
          <form onSubmit={submit}>
            <input
              type="text"
              placeholder="Username / Email / Phone Number"
              required
              readOnly={!!pendingEmail}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <input
              type="password"
              placeholder="New Password"
              required
              minLength={9}
              readOnly={!!pendingEmail}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            {/* Only shown once the identifier/password above have checked
                out and a code is actually on its way. */}
            {pendingEmail && (
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="2FA OTP (emailed just now)"
                required
                autoFocus
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
              />
            )}
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
