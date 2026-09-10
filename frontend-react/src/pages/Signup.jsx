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
  const [alert, setAlertMsg] = useState("");
  const [enrol, setEnrol] = useState(null);   // { secret, qr_svg } after signup
  const [code, setCode] = useState("");
  const navigate = useNavigate();

  async function submit(e) {
    e.preventDefault();
    setAlertMsg("");
    if (password !== confirm) {
      setAlertMsg("Passwords do not match");
      return;
    }
    try {
      const res = await api("/api/auth/signup", {
        method: "POST",
        body: { username, email, phone_number: phone, password },
      });
      setToken(res.access_token);
      if (res.totp) { setEnrol(res.totp); return; }   // enrol before continuing
      navigate("/browse");
    } catch (err) {
      setAlertMsg(err.message);
    }
  }

  async function confirmEnrol(e) {
    e.preventDefault();
    setAlertMsg("");
    try {
      await api("/api/users/me/2fa/totp/confirm", { method: "POST", auth: true, body: { code } });
      navigate("/browse");
    } catch (err) {
      setAlertMsg(err.message);
    }
  }

  // An in-progress enrolment still needs to finish (it's how signup
  // completes) — everything else, already-signed-in visitors bounce to Browse.
  if (getToken() && !enrol) return <Navigate to="/browse" replace />;

  return (
    <Layout>
      <div className="form-card">
        <h1>{enrol ? "Set up your authenticator" : "Sign Up"}</h1>
        {alert && <div className="alert error">{alert}</div>}
        {enrol ? (
          <div className="totp-box">
            <p className="meta" style={{ marginBottom: 12 }}>
              Scan this with Google Authenticator, Authy, or 1Password. You'll use
              it to sign in from now on.
            </p>
            <div className="totp-qr" dangerouslySetInnerHTML={{ __html: enrol.qr_svg }} />
            <p className="meta">Can't scan? Enter this key manually:</p>
            <code className="totp-secret">{enrol.secret}</code>
            <form onSubmit={confirmEnrol}>
              <input type="text" inputMode="numeric" autoComplete="one-time-code"
                placeholder="6-digit code from the app" required
                value={code} onChange={(e) => setCode(e.target.value)} />
              <button className="btn" type="submit" style={{ width: "100%" }}>Finish setup</button>
            </form>
            <p className="form-note">
              You'll need this app to sign in, so finish setup before continuing.
            </p>
          </div>
        ) : (
        <form onSubmit={submit}>
          <input type="text" placeholder="Username" required minLength={3} maxLength={30} value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input type="password" placeholder="Password (9+ chars, no spaces)" required minLength={9} value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" placeholder="Confirm Password" required minLength={9} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn" type="submit" style={{ width: "100%" }}>Confirm Sign Up</button>
        </form>
        )}
        <p className="form-note">Already have an account? <Link to="/login">Login</Link></p>
      </div>
    </Layout>
  );
}
