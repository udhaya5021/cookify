import { useState } from "react";
import { Link, useNavigate, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import { api, setToken, setDeviceToken, getDeviceToken, getToken } from "../api";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [otpMethod, setOtpMethod] = useState("totp");
  const [enrol, setEnrol] = useState(null);   // shown when 2FA was never set up
  const [enrolCode, setEnrolCode] = useState("");
  const [alert, setAlertMsg] = useState(null);
  const navigate = useNavigate();

  async function submitLogin(e) {
    e.preventDefault();
    setAlertMsg(null);
    try {
      const res = await api("/api/auth/login", {
        method: "POST",
        body: { identifier, password, device_token: getDeviceToken() },
      });
      if (res.requires_enrolment) {
        // Signup was abandoned at the QR step — finish it now rather than
        // leaving the account with no way in.
        setToken(res.access_token);
        setEnrol(res.totp);
      } else if (res.requires_otp) {
        setPendingEmail(res.email);
        setOtpMethod(res.method || "totp");
      } else {
        setToken(res.access_token);
        navigate("/browse");
      }
    } catch (err) {
      // Login Method pseudocode: ASK "Forgot Password?" as part of the
      // failed-login response itself, not just a static link on the page.
      setAlertMsg(
        <>{err.message} — <Link to="/forgot-password">Forgot password?</Link></>
      );
    }
  }

  async function submitOtp(e) {
    e.preventDefault();
    setAlertMsg(null);
    try {
      const res = await api("/api/auth/verify-otp", {
        method: "POST",
        body: { email: pendingEmail, otp, remember_device: remember },
      });
      setToken(res.access_token);
      if (res.device_token) setDeviceToken(res.device_token);
      navigate("/browse");
    } catch (err) {
      setAlertMsg(err.message);
    }
  }

  async function confirmEnrol(e) {
    e.preventDefault();
    setAlertMsg(null);
    try {
      await api("/api/users/me/2fa/totp/confirm", { method: "POST", auth: true, body: { code: enrolCode } });
      navigate("/browse");
    } catch (err) {
      setAlertMsg(err.message);
    }
  }

  // Already signed in — an in-progress enrolment/OTP step still has to
  // finish (it's how you get a full session), everything else bounces to Browse.
  if (getToken() && !enrol && !pendingEmail) return <Navigate to="/browse" replace />;

  return (
    <Layout>
      <div className="form-card">
        <h1>{enrol ? "Set up your authenticator" : "Login"}</h1>
        {alert && <div className="alert error">{alert}</div>}

        {enrol ? (
          <div className="totp-box">
            <p className="meta" style={{ marginBottom: 12 }}>
              Your account still needs an authenticator app. Scan this, then enter
              the code it shows.
            </p>
            <div className="totp-qr" dangerouslySetInnerHTML={{ __html: enrol.qr_svg }} />
            <p className="meta">Can't scan? Enter this key manually:</p>
            <code className="totp-secret">{enrol.secret}</code>
            <form onSubmit={confirmEnrol}>
              <input type="text" inputMode="numeric" autoComplete="one-time-code"
                placeholder="6-digit code from the app" required
                value={enrolCode} onChange={(e) => setEnrolCode(e.target.value)} />
              <button className="btn" type="submit" style={{ width: "100%" }}>Finish setup</button>
            </form>
          </div>
        ) : !pendingEmail ? (
          <form onSubmit={submitLogin}>
            <input type="text" placeholder="Username / Email / Phone Number" required
              value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
            <input type="password" placeholder="Password" required
              value={password} onChange={(e) => setPassword(e.target.value)} />
            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 14 }}>
              <input type="checkbox" style={{ width: "auto", margin: 0 }}
                checked={remember} onChange={(e) => setRemember(e.target.checked)} />
              Remember this device
            </label>
            <button className="btn" type="submit" style={{ width: "100%" }}>Confirm Login</button>
          </form>
        ) : (
          <div className="totp-box">
            <p className="meta" style={{ marginBottom: 12 }}>
              Open your authenticator app and enter the current 6-digit code.
            </p>
            <form onSubmit={submitOtp}>
              <input type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="6-digit code" required value={otp} onChange={(e) => setOtp(e.target.value)} />
              <button className="btn" type="submit" style={{ width: "100%" }}>Verify Code</button>
            </form>
          </div>
        )}

        <p className="form-note"><Link to="/forgot-password">Forgot password?</Link></p>
        <p className="form-note">Don't have an account? <Link to="/signup">Sign up</Link></p>
      </div>
    </Layout>
  );
}
