import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, setToken } from "../api";

export default function Signup() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [alert, setAlertMsg] = useState("");
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
      navigate("/browse");
    } catch (err) {
      setAlertMsg(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <div className="form-card">
        <h1>Sign Up</h1>
        {alert && <div className="alert error">{alert}</div>}
        <form onSubmit={submit}>
          <input type="text" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
          <input type="email" placeholder="Email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          <input type="tel" placeholder="Phone Number" value={phone} onChange={(e) => setPhone(e.target.value)} />
          <input type="password" placeholder="Password (9+ chars, no spaces)" required value={password} onChange={(e) => setPassword(e.target.value)} />
          <input type="password" placeholder="Confirm Password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          <button className="btn" type="submit" style={{ width: "100%" }}>Confirm Sign Up</button>
        </form>
        <p className="form-note">Already have an account? <Link to="/login">Login</Link></p>
      </div>
      <Footer />
    </>
  );
}
