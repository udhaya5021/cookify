import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, setToken, setDeviceToken, getDeviceToken } from "../api";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [otp, setOtp] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
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
      if (res.requires_otp) {
        setPendingEmail(res.email);
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

  return (
    <>
      <Navbar />
      <div className="form-card">
        <h1>Login</h1>
        {alert && <div className="alert error">{alert}</div>}

        {!pendingEmail ? (
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
          <form onSubmit={submitOtp}>
            <p style={{ marginBottom: 12, fontSize: 14 }}>A 6-digit code was emailed to you.</p>
            <input type="text" placeholder="2FA OTP" required value={otp} onChange={(e) => setOtp(e.target.value)} />
            <button className="btn" type="submit" style={{ width: "100%" }}>Verify Code</button>
          </form>
        )}

        <p className="form-note"><Link to="/forgot-password">Forgot password?</Link></p>
        <p className="form-note">Don't have an account? <Link to="/signup">Sign up</Link></p>
      </div>
      <Footer />
    </>
  );
}
