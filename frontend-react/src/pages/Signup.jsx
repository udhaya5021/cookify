import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import { api, setToken, getToken } from "../api";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState(""); // set once a code has been emailed
  const [alert, setAlertMsg] = useState(null);
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setAlertMsg(null);

    // Wireframe: the "username/email already in use" state shows a 2FA OTP
    // field alongside the signup fields — same one-screen, double-duty
    // button pattern as Login. First click validates the fields and emails
    // a code; the account isn't created until the second click verifies it.
    if (pendingEmail) {
      try {
        const res = await api("/api/auth/verify-signup-otp", {
          method: "POST",
          body: { email: pendingEmail, otp },
        });
        setToken(res.access_token);
        navigate("/browse");
      } catch (err) {
        setAlertMsg({ type: "error", text: err.message });
      }
      return;
    }

    if (password !== confirm) {
      setAlertMsg({ type: "error", text: "Passwords do not match" });
      return;
    }
    try {
      const res = await api("/api/auth/signup", {
        method: "POST",
        body: { username, email, phone_number: phone, password },
      });
      setPendingEmail(res.email);
      setAlertMsg({
        type: "success",
        text: `We've emailed a 6-digit code to ${res.email} — enter it above and confirm again.`,
      });
    } catch (err) {
      setAlertMsg({ type: "error", text: err.message });
    }
  }

  if (getToken()) return <Navigate to="/browse" replace />;

  return (
    <Layout minimal>
      <div className="form-card">
        <h1>Sign Up</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="Username"
            required
            minLength={3}
            maxLength={30}
            readOnly={!!pendingEmail}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
          <input
            type="email"
            placeholder="Email"
            required
            readOnly={!!pendingEmail}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            type="tel"
            placeholder="Phone Number"
            readOnly={!!pendingEmail}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <input
            type="password"
            placeholder="Password (9+ chars, no spaces)"
            required
            minLength={9}
            readOnly={!!pendingEmail}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            placeholder="Confirm Password"
            required
            minLength={9}
            readOnly={!!pendingEmail}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {/* Only shown once the fields above have checked out and a code
              is actually on its way. */}
          {pendingEmail && (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="2FA OTP (emailed at signup)"
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          )}
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Confirm Sign Up
          </button>
        </form>
        <p className="form-note">
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </Layout>
  );
}
