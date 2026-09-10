import { useState, useEffect } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageLoading from "../components/PageLoading";
import StarRating from "../components/StarRating";
import Avatar from "../components/Avatar";
import { useConfirm } from "../hooks/useConfirm";
import { useToast } from "../hooks/useToast";
import { api, API_BASE, requireAuthOrAlert, getMyUserId } from "../authGuard";

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [confirmModal, confirm] = useConfirm();
  const [toast, showToast] = useToast();
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [pfp, setPfp] = useState(null);
  const [pfpPreview, setPfpPreview] = useState(null);
  const [editing, setEditing] = useState(false);
  const [recipeTab, setRecipeTab] = useState("uploaded"); // "uploaded" | "saved"
  const [connections, setConnections] = useState(null); // { kind, users } | null
  const [totpConfirmed, setTotpConfirmed] = useState(false);
  const [totpSetup, setTotpSetup] = useState(null); // { qr_svg, secret }
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
      setTotpConfirmed(true);
      setTotpSetup(null);
      setTotpCode("");
      setTotpMsg({ type: "success", text: "Authenticator app enabled." });
    } catch (err) {
      setTotpMsg({ type: "error", text: err.message });
    }
  }

  async function resetTotp() {
    const ok = await confirm("Reset your authenticator? You'll set it up again at your next login.");
    if (!ok) return;
    await api("/api/users/me/2fa/totp/reset", { method: "POST", auth: true });
    setTotpConfirmed(false);
    setTotpSetup(null);
    setTotpMsg({ type: "success", text: "Reset — you'll scan a new QR next time you log in." });
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
    // auth:true is required (not just harmless) here — the backend uses it
    // to know *who's* viewing, so it can report whether this viewer is
    // already subscribed. Without it every load looks like an anonymous
    // visit and is_subscribed always comes back false.
    const p = await api(`/api/users/${id}`, { auth: true });
    setProfile(p);
    setFirstName(p.first_name || "");
    setLastName(p.last_name || "");
    setBio(p.bio || "");
    setAge(p.age || "");
    if (parseInt(id, 10) === getMyUserId()) {
      // 2FA state is owner-only, so it comes from a separate settings call
      // rather than the public profile payload.
      api("/api/users/me/settings", { auth: true })
        .then((s) => setTotpConfirmed(s.totp_confirmed))
        .catch(() => {});
    }
  }
  useEffect(() => {
    // React Router reuses this same component instance when only the :id
    // param changes (e.g. clicking a name in the followers/following list) —
    // it does not unmount/remount. Without this, clicking through to another
    // profile keeps whatever panel was open (followers list, edit mode, TOTP
    // setup) stuck on screen, now showing stale data over the new profile.
    setConnections(null);
    setEditing(false);
    setRecipeTab("uploaded");
    setTotpSetup(null);
    setTotpCode("");
    setTotpMsg(null);
    setPfp(null);
    setPfpPreview(null);
    load();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleSubscribe() {
    if (!requireAuthOrAlert()) return;
    const wasSubscribed = profile.is_subscribed;
    try {
      const res = await api(`/api/users/${id}/subscribe`, {
        method: wasSubscribed ? "DELETE" : "POST",
        auth: true,
      });
      showToast(res.message, "success");
      setProfile((prev) => ({
        ...prev,
        is_subscribed: !wasSubscribed,
        followers: prev.followers + (wasSubscribed ? -1 : 1),
      }));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function submitEdit(e) {
    e.preventDefault();
    const form = new FormData();
    form.append("first_name", firstName);
    form.append("last_name", lastName);
    form.append("bio", bio);
    // Omit entirely when blank — the backend's age field is a real
    // Optional[int] with ge/le bounds; sending "" fails int parsing and
    // used to 422 the *whole* edit, not just silently skip age.
    if (age !== "") form.append("age", age);
    if (pfp) form.append("profile_picture", pfp);
    try {
      await api("/api/users/me", { method: "PUT", auth: true, form });
      setPfp(null);
      setPfpPreview(null);
      setEditing(false);
      load();
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  if (!profile) return <PageLoading />;

  return (
    <Layout>
      <div className="container">
        <div className="profile-card">
          <div className="profile-cover" />
          <div className="profile-header">
            <Avatar
              src={profile.profile_picture_url}
              label={profile.username}
              className="profile-avatar"
              emptyClassName="profile-avatar-empty"
            />
            <div className="profile-info">
              <h1>{profile.username}</h1>
              {(profile.first_name || profile.last_name || profile.age) && (
                <div className="profile-realname">
                  {[profile.first_name, profile.last_name].filter(Boolean).join(" ")}
                  {profile.age
                    ? `${profile.first_name || profile.last_name ? " · " : ""}Age ${profile.age}`
                    : ""}
                </div>
              )}
              <div className="profile-stats">
                <span>
                  <strong>{profile.uploaded_recipes.length}</strong> recipes
                </span>
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
                  ) : (
                    connections.users.map((u) => (
                      <Link key={u.id} className="connection" to={`/profile/${u.id}`}>
                        <Avatar
                          src={u.profile_picture_url}
                          label={u.username}
                          className="connection-avatar"
                          emptyClassName="connection-avatar-empty"
                        />
                        {u.username}
                      </Link>
                    ))
                  )}
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
                    <button className="btn small secondary" onClick={handleToggleSubscribe}>
                      {profile.is_subscribed ? "🔔 Subscribed ✓" : "🔔 Subscribe"}
                    </button>
                    <button
                      className="btn small secondary"
                      onClick={() => requireAuthOrAlert() && navigate(`/chat/${id}`)}
                    >
                      Message
                    </button>
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
                <input
                  type="text"
                  placeholder="First name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
                <input
                  type="text"
                  placeholder="Last name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </div>
              <textarea
                rows={3}
                placeholder="Short bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
              ></textarea>
              <input
                type="number"
                min="0"
                max="120"
                placeholder="Age"
                style={{ maxWidth: 140 }}
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />

              <div className="totp-box">
                <strong style={{ fontSize: 14 }}>🔒 Two-factor authentication</strong>
                <p className="meta" style={{ margin: "4px 0 10px" }}>
                  {totpConfirmed
                    ? "Your authenticator app is set up. You'll enter a code from it each time you log in."
                    : "Not set up yet — you'll be asked to scan a QR at your next login."}
                </p>
                {totpMsg && <div className={`alert ${totpMsg.type}`}>{totpMsg.text}</div>}

                {totpConfirmed ? (
                  <button type="button" className="btn small secondary" onClick={resetTotp}>
                    Set up on a new phone
                  </button>
                ) : !totpSetup ? (
                  <button type="button" className="btn small secondary" onClick={startTotpSetup}>
                    Set up now
                  </button>
                ) : (
                  <>
                    <p className="meta" style={{ marginBottom: 10 }}>
                      Scan this with Google Authenticator, Authy, or 1Password — then enter the code it shows
                      to finish.
                    </p>
                    <div className="totp-qr" dangerouslySetInnerHTML={{ __html: totpSetup.qr_svg }} />
                    <p className="meta">Can't scan? Enter this key manually:</p>
                    <code className="totp-secret">{totpSetup.secret}</code>
                    <div className="field-row" style={{ marginTop: 10 }}>
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder="6-digit code"
                        value={totpCode}
                        onChange={(e) => setTotpCode(e.target.value)}
                      />
                      <button type="button" className="btn small" onClick={confirmTotp}>
                        Verify &amp; enable
                      </button>
                    </div>
                  </>
                )}
              </div>

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
                <button className="btn small" type="submit">
                  Save changes
                </button>
                <button className="btn small secondary" type="button" onClick={() => setEditing(false)}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="profile-tabs">
          <button
            type="button"
            className={`profile-tab ${recipeTab === "uploaded" ? "active" : ""}`}
            onClick={() => setRecipeTab("uploaded")}
          >
            Uploaded <span className="count">({profile.uploaded_recipes.length})</span>
          </button>
          <button
            type="button"
            className={`profile-tab ${recipeTab === "saved" ? "active" : ""}`}
            onClick={() => setRecipeTab("saved")}
          >
            Saved <span className="count">({profile.saved_recipes.length})</span>
          </button>
        </div>

        <div className="recipe-grid">
          {(recipeTab === "uploaded" ? profile.uploaded_recipes : profile.saved_recipes).length === 0 ? (
            <div className="empty-state">
              {recipeTab === "uploaded" ? "No recipes uploaded yet." : "No saved recipes yet."}
            </div>
          ) : (
            (recipeTab === "uploaded" ? profile.uploaded_recipes : profile.saved_recipes).map((r) => (
              <div
                key={r.id}
                className={`recipe-card ${recipeTab === "uploaded" && r.recipe_type === "veg" ? "veg" : ""} ${recipeTab === "saved" ? "saved" : ""}`}
              >
                <div className="media-wrap">
                  <Avatar
                    src={r.media_url}
                    label={r.title}
                    className="thumb"
                    emptyClassName="thumb-placeholder"
                    isVideo={r.media_content_type?.startsWith("video/")}
                  />
                  {recipeTab === "uploaded" && (
                    <span className={`badge ${r.recipe_type === "veg" ? "veg" : "nonveg"}`}>
                      {r.recipe_type === "veg" ? "Veg" : "Non-Veg"}
                    </span>
                  )}
                </div>
                <div className="card-body">
                  <div className="title">{r.title}</div>
                  <StarRating average={r.average_rating} count={r.rating_count} />
                  <Link
                    className={`btn small ${recipeTab === "saved" ? "secondary" : ""}`}
                    to={`/recipe/${r.id}`}
                  >
                    Open recipe
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {confirmModal}
      {toast}
    </Layout>
  );
}
