import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageLoading from "../components/PageLoading";
import StarRating from "../components/StarRating";
import { api, API_BASE, requireAuthOrAlert, getMyUserId } from "../authGuard";

export default function Profile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [pfp, setPfp] = useState(null);
  const [pfpPreview, setPfpPreview] = useState(null);
  const [editing, setEditing] = useState(false);
  const [connections, setConnections] = useState(null); // { kind, users } | null
  const [twoFa, setTwoFa] = useState(true);
  const [twoFaMethod, setTwoFaMethod] = useState("email");
  const [totpSetup, setTotpSetup] = useState(null);   // { qr_svg, secret }
  const [totpCode, setTotpCode] = useState("");
  const [totpMsg, setTotpMsg] = useState(null);

  async function startTotpSetup() {
    setTotpMsg(null);
    setTotpSetup(await api("/api/users/me/2fa/totp/setup", { method: "POST", auth: true }));
  }

  async function confirmTotp(e) {
    e.preventDefault();
    try {
      await api("/api/users/me/2fa/totp/confirm", { method: "POST", auth: true, body: { code: totpCode } });
      setTwoFaMethod("totp"); setTwoFa(true); setTotpSetup(null); setTotpCode("");
      setTotpMsg({ type: "success", text: "Authenticator app enabled." });
    } catch (err) {
      setTotpMsg({ type: "error", text: err.message });
    }
  }

  async function disableTotp() {
    await api("/api/users/me/2fa/totp/disable", { method: "POST", auth: true });
    setTwoFaMethod("email"); setTotpSetup(null);
    setTotpMsg({ type: "success", text: "Back to emailed codes." });
  }
  const isMe = parseInt(id, 10) === getMyUserId();

  async function toggleConnections(kind) {
    if (connections?.kind === kind) return setConnections(null);
    setConnections({ kind, users: null });
    const users = await api(`/api/users/${id}/${kind}`);
    setConnections({ kind, users });
  }

  function pickPfp(file) {
    if (!file) return;
    setPfp(file);
    setPfpPreview(URL.createObjectURL(file));
  }

  async function load() {
    const p = await api(`/api/users/${id}`);
    setProfile(p);
    setFirstName(p.first_name || "");
    setLastName(p.last_name || "");
    setBio(p.bio || "");
    setAge(p.age || "");
    if (parseInt(id, 10) === getMyUserId()) {
      // 2FA state is owner-only, so it comes from a separate settings call
      // rather than the public profile payload.
      api("/api/users/me/settings", { auth: true })
        .then((s) => { setTwoFa(s.two_fa_enabled); setTwoFaMethod(s.two_fa_method || "email"); })
        .catch(() => {});
    }
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSubscribe() {
    if (!requireAuthOrAlert()) return;
    try {
      const res = await api(`/api/users/${id}/subscribe`, { method: "POST", auth: true });
      alert(res.message);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    const form = new FormData();
    form.append("first_name", firstName);
    form.append("last_name", lastName);
    form.append("bio", bio);
    form.append("age", age || "");
    form.append("two_fa_enabled", twoFa);
    if (pfp) form.append("profile_picture", pfp);
    try {
      await api("/api/users/me", { method: "PUT", auth: true, form });
      setPfp(null);
      setPfpPreview(null);
      setEditing(false);
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (!profile) return <PageLoading />;

  return (
    <Layout>
      <div className="container">
        <div className="recipe-detail">
          <div className="profile-header">
            {profile.profile_picture_url
              ? <img className="profile-avatar" src={`${API_BASE}${profile.profile_picture_url}`} alt="" />
              : <div className="profile-avatar profile-avatar-empty">{profile.username.charAt(0).toUpperCase()}</div>}
            <div className="profile-info">
              <h1>{profile.username}</h1>
              {(profile.first_name || profile.last_name || profile.age) && (
                <div className="profile-realname">
                  {[profile.first_name, profile.last_name].filter(Boolean).join(" ")}
                  {profile.age ? `${profile.first_name || profile.last_name ? " · " : ""}Age ${profile.age}` : ""}
                </div>
              )}
              <div className="profile-stats">
                <span><strong>{profile.uploaded_recipes.length}</strong> recipes</span>
                <button type="button" className="stat-btn" onClick={() => toggleConnections("followers")}>
                  <strong>{profile.followers}</strong> followers
                </button>
                <button type="button" className="stat-btn" onClick={() => toggleConnections("following")}>
                  <strong>{profile.following}</strong> following
                </button>
              </div>

              {connections && (
                <div className="connection-list">
                  {connections.users === null ? (
                    <span className="meta">Loading…</span>
                  ) : connections.users.length === 0 ? (
                    <span className="meta">No {connections.kind} yet.</span>
                  ) : connections.users.map((u) => (
                    <Link key={u.id} className="connection" to={`/profile/${u.id}`}>
                      {u.profile_picture_url
                        ? <img className="connection-avatar" src={`${API_BASE}${u.profile_picture_url}`} alt="" />
                        : <div className="connection-avatar connection-avatar-empty">{u.username.charAt(0).toUpperCase()}</div>}
                      {u.username}
                    </Link>
                  ))}
                </div>
              )}
              <p className="profile-bio">{profile.bio || <span className="meta">No bio yet.</span>}</p>
              <div className="profile-actions">
                {isMe ? (
                  <button className="btn small secondary" onClick={() => setEditing((v) => !v)}>
                    {editing ? "Cancel" : "Edit profile"}
                  </button>
                ) : (
                  <>
                    <button className="btn small secondary" onClick={handleSubscribe}>🔔 Subscribe</button>
                    <Link className="btn small secondary" to={`/chat/${id}`}>Message</Link>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        {isMe && editing && (
          <div className="recipe-detail">
            <h3 style={{ marginBottom: 16 }}>Edit Profile</h3>
            <form className="edit-form" onSubmit={submitEdit}>
              <div className="field-row">
                <input type="text" placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                <input type="text" placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              </div>
              <textarea rows={3} placeholder="Short bio" value={bio} onChange={(e) => setBio(e.target.value)}></textarea>
              <input type="number" placeholder="Age" style={{ maxWidth: 140 }} value={age} onChange={(e) => setAge(e.target.value)} />

              <label className={`chip-toggle ${twoFa ? "active" : ""}`} style={{ marginBottom: 16 }}>
                <input type="checkbox" checked={twoFa} onChange={(e) => setTwoFa(e.target.checked)} />
                🔒 Two-factor authentication {twoFa ? "on" : "off"}
              </label>
              <p className="meta" style={{ margin: "-8px 0 12px" }}>
                {!twoFa
                  ? "You'll log in with just your password."
                  : twoFaMethod === "totp"
                    ? "You'll enter a code from your authenticator app each time you log in."
                    : "You'll get a 6-digit code by email each time you log in."}
              </p>

              {twoFa && (
                <div className="totp-box">
                  {totpMsg && <div className={`alert ${totpMsg.type}`}>{totpMsg.text}</div>}

                  {twoFaMethod === "totp" ? (
                    <button type="button" className="btn small secondary" onClick={disableTotp}>
                      Switch back to emailed codes
                    </button>
                  ) : !totpSetup ? (
                    <button type="button" className="btn small secondary" onClick={startTotpSetup}>
                      Use an authenticator app instead
                    </button>
                  ) : (
                    <>
                      <p className="meta" style={{ marginBottom: 10 }}>
                        Scan this with Google Authenticator, Authy, or 1Password —
                        then enter the code it shows to finish.
                      </p>
                      <div className="totp-qr" dangerouslySetInnerHTML={{ __html: totpSetup.qr_svg }} />
                      <p className="meta">Can't scan? Enter this key manually:</p>
                      <code className="totp-secret">{totpSetup.secret}</code>
                      <div className="field-row" style={{ marginTop: 10 }}>
                        <input type="text" inputMode="numeric" placeholder="6-digit code"
                          value={totpCode} onChange={(e) => setTotpCode(e.target.value)} />
                        <button type="button" className="btn small" onClick={confirmTotp}>Verify &amp; enable</button>
                      </div>
                    </>
                  )}
                </div>
              )}

              <div className="pfp-row">
                {(pfpPreview || profile.profile_picture_url) && (
                  <img
                    className="pfp-preview"
                    src={pfpPreview || `${API_BASE}${profile.profile_picture_url}`}
                    alt="Profile picture preview"
                  />
                )}
                <label className="btn small secondary" style={{ cursor: "pointer" }}>
                  {pfp ? "Change picture" : "Choose picture"}
                  <input type="file" accept="image/*" hidden onChange={(e) => pickPfp(e.target.files[0])} />
                </label>
                {pfp && <span className="meta">{pfp.name}</span>}
              </div>

              <div style={{ display: "flex", gap: 10 }}>
                <button className="btn small" type="submit">Save changes</button>
                <button className="btn small secondary" type="button" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </form>
          </div>
        )}

        <h2 style={{ margin: "20px 0 10px" }}>Uploaded Recipes</h2>
        <div className="recipe-grid">
          {profile.uploaded_recipes.length === 0
            ? <div className="empty-state">No recipes uploaded yet.</div>
            : profile.uploaded_recipes.map((r) => (
              <div key={r.id} className={`recipe-card ${r.recipe_type === "veg" ? "veg" : ""}`}>
                <div className="media-wrap">
                  {r.media_url
                    ? <img className="thumb" src={`${API_BASE}${r.media_url}`} alt="" />
                    : <div className="thumb thumb-placeholder">{r.title.charAt(0).toUpperCase()}</div>}
                  <span className={`badge ${r.recipe_type === "veg" ? "veg" : "nonveg"}`}>{r.recipe_type === "veg" ? "Veg" : "Non-Veg"}</span>
                </div>
                <div className="card-body">
                  <div className="title">{r.title}</div>
                  <StarRating average={r.average_rating} count={r.rating_count} />
                  <Link className="btn small" to={`/recipe/${r.id}`}>Open recipe</Link>
                </div>
              </div>
            ))}
        </div>

        {/* Wireframe callout: "Inverted Yellow Brown Colour Scheme" for Saved Recipes */}
        <h2 style={{ margin: "20px 0 10px" }}>Saved Recipes</h2>
        <div className="recipe-grid">
          {profile.saved_recipes.length === 0
            ? <div className="empty-state">No saved recipes yet.</div>
            : profile.saved_recipes.map((r) => (
              <div key={r.id} className="recipe-card saved">
                <div className="media-wrap">
                  {r.media_url
                    ? <img className="thumb" src={`${API_BASE}${r.media_url}`} alt="" />
                    : <div className="thumb thumb-placeholder">{r.title.charAt(0).toUpperCase()}</div>}
                </div>
                <div className="card-body">
                  <div className="title">{r.title}</div>
                  <StarRating average={r.average_rating} count={r.rating_count} />
                  <Link className="btn small secondary" to={`/recipe/${r.id}`}>Open recipe</Link>
                </div>
              </div>
            ))}
        </div>
      </div>
    </Layout>
  );
}
