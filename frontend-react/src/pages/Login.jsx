import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import { api, setToken, setDeviceToken, getDeviceToken, getToken } from "../api";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState(""); // set once a code has been emailed
  const [alert, setAlertMsg] = useState(null);
  const navigate = useNavigate();

  async function submitLogin(e) {
    e.preventDefault();
    setAlertMsg(null);
    try {
      // Wireframe: identifier, password, and the 2FA OTP all live on one
      // screen behind a single Confirm Login button. The code doesn't exist
      // until the server emails it, though, so the same button does double
      // duty: the first click validates credentials and triggers the email,
      // the second (once the code is typed in) verifies it — the page and
      // its fields never change, just what one more click means.
      if (pendingEmail) {
        const verified = await api("/api/auth/verify-otp", {
          method: "POST",
          body: { email: pendingEmail, otp, remember_device: remember },
        });
        setToken(verified.access_token);
        if (verified.device_token) setDeviceToken(verified.device_token);
        navigate("/browse");
        return;
      }

      const res = await api("/api/auth/login", {
        method: "POST",
        body: { identifier, password, device_token: getDeviceToken() },
      });
      if (res.requires_otp) {
        setPendingEmail(res.email);
        setAlertMsg({
          type: "success",
          text: `We've emailed a 6-digit code to ${res.email} — enter it above and confirm again.`,
        });
        return;
      }
      setToken(res.access_token);
      navigate("/browse");
    } catch (err) {
      // Login Method pseudocode: ASK "Forgot Password?" as part of the
      // failed-login response itself, not just a static link on the page.
      setAlertMsg({
        type: "error",
        text: (
          <>
            {err.message} — <Link to="/forgot-password">Forgot password?</Link>
          </>
        ),
      });
    }
  }

  // Already signed in bounces straight to Browse.
  if (getToken()) return <Navigate to="/browse" replace />;

  return (
    <Layout minimal>
      <div className="form-card">
        <h1>Login</h1>
        {alert && <div className={`alert ${alert.type}`}>{alert.text}</div>}

        <form onSubmit={submitLogin}>
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
            placeholder="Password"
            required
            readOnly={!!pendingEmail}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {/* Only shown once the password has checked out and a code is
              actually on its way — showing it upfront would let someone
              type a code before one even exists. */}
          {pendingEmail && (
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="2FA OTP (emailed at login)"
              required
              autoFocus
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
          )}
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14 }}>
            <input
              type="checkbox"
              style={{ width: "auto", margin: 0 }}
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            Remember this device
          </label>
          <button className="btn" type="submit" style={{ width: "100%" }}>
            Confirm Login
          </button>
        </form>

        <p className="form-note">
          <Link to="/forgot-password">Forgot password?</Link>
        </p>
        <p className="form-note">
          Don't have an account? <Link to="/signup">Sign up</Link>
        </p>
      </div>
    </Layout>
  );
}
