import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageLoading from "../components/PageLoading";
import StarRating from "../components/StarRating";
import Avatar from "../components/Avatar";
import { useToast } from "../hooks/useToast";
import { api, API_BASE, requireAuthOrAlert, getMyUserId } from "../authGuard";

// Wireframe: "Slider Wheel Arrows" scroll the Uploaded/Saved rows by roughly
// one card-and-gap at a time rather than jumping the full row width.
function scrollByCards(ref, direction) {
  ref.current?.scrollBy({ left: direction * 250, behavior: "smooth" });
}

// Shared by both the Uploaded and Saved rows — same card, just the "Saved"
// (inverted colour scheme) styling and the veg/non-veg badge only apply to
// recipes you actually own, not ones you've merely saved from someone else.
function renderRecipeCard(r, { saved }) {
  return (
    <div
      key={r.id}
      className={`recipe-card ${!saved && r.recipe_type === "veg" ? "veg" : ""} ${saved ? "saved" : ""}`}
    >
      <div className="media-wrap">
        <Avatar
          src={r.media_url}
          label={r.title}
          className="thumb"
          emptyClassName="thumb-placeholder"
          isVideo={r.media_content_type?.startsWith("video/")}
        />
        {!saved && (
          <span className={`badge ${r.recipe_type === "veg" ? "veg" : "nonveg"}`}>
            {r.recipe_type === "veg" ? "Veg" : "Non-Veg"}
          </span>
        )}
      </div>
      <div className="card-body">
        <div className="title">{r.title}</div>
        <div className="card-comment-badge">💬 {r.comment_count}</div>
        <StarRating average={r.average_rating} count={r.rating_count} />
        <Link className={`btn small ${saved ? "secondary" : ""}`} to={`/recipe/${r.id}`}>
          Open recipe
        </Link>
      </div>
    </div>
  );
}

export default function Profile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [toast, showToast] = useToast();
  const [profile, setProfile] = useState(null);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [age, setAge] = useState("");
  const [pfp, setPfp] = useState(null);
  const [pfpPreview, setPfpPreview] = useState(null);
  const [editing, setEditing] = useState(false);
  const uploadedScrollRef = useRef(null);
  const savedScrollRef = useRef(null);
  const [connections, setConnections] = useState(null); // { kind, users } | null
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
    setAge(p.age || "");
  }
  useEffect(() => {
    // React Router reuses this same component instance when only the :id
    // param changes (e.g. clicking a name in the followers/following list) —
    // it does not unmount/remount. Without this, clicking through to another
    // profile keeps whatever panel was open (followers list, edit mode)
    // stuck on screen, now showing stale data over the new profile.
    setConnections(null);
    setEditing(false);
    if (uploadedScrollRef.current) uploadedScrollRef.current.scrollLeft = 0;
    if (savedScrollRef.current) savedScrollRef.current.scrollLeft = 0;
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

  const fullName = [profile.first_name, profile.last_name].filter(Boolean).join(" ");

  return (
    <Layout>
      <div className="container">
        {/* Wireframe: avatar + user info sit in a narrow left sidebar beside
            the recipe rows, not in a full-width banner above them. */}
        <div className="profile-layout">
          <aside className="profile-sidebar">
            <div className="profile-cover" />
            <div className="profile-sidebar-body">
              <Avatar
                src={profile.profile_picture_url}
                label={profile.username}
                className="profile-avatar"
                emptyClassName="profile-avatar-empty"
              />
              {/* Wireframe order: Full Name, then Username — a display name
                  reads as the person's identity, with the handle secondary. */}
              {fullName ? (
                <>
                  <h1>{fullName}</h1>
                  <div className="profile-realname">@{profile.username}</div>
                </>
              ) : (
                <h1>{profile.username}</h1>
              )}

              <div className="profile-stats-list">
                <div className="profile-stat-row">
                  <strong>{profile.uploaded_recipes.length}</strong> recipes
                </div>
                <button
                  type="button"
                  className="stat-btn profile-stat-row"
                  onClick={() => toggleConnections("followers")}
                >
                  <strong>{profile.followers}</strong> followers
                </button>
                <button
                  type="button"
                  className="stat-btn profile-stat-row"
                  onClick={() => toggleConnections("following")}
                >
                  <strong>{profile.following}</strong> following
                </button>
                {/* Wireframe lists Age as the last row of the info block. */}
                {profile.age != null && (
                  <div className="profile-stat-row">
                    <strong>{profile.age}</strong> years old
                  </div>
                )}
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
          </aside>

          <div className="profile-content">
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
                  <input
                    type="number"
                    min="0"
                    max="120"
                    placeholder="Age"
                    style={{ maxWidth: 140 }}
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                  />

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
                      <input
                        type="file"
                        accept="image/*"
                        hidden
                        onChange={(e) => pickPfp(e.target.files[0])}
                      />
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

            <h2 style={{ margin: "0 0 10px" }}>Uploaded Recipes</h2>
            {profile.uploaded_recipes.length === 0 ? (
              <div className="empty-state">No recipes uploaded yet.</div>
            ) : (
              <div className="recipe-scroll-section">
                <button
                  type="button"
                  className="scroll-arrow"
                  aria-label="Scroll uploaded recipes left"
                  onClick={() => scrollByCards(uploadedScrollRef, -1)}
                >
                  ‹
                </button>
                <div className="recipe-scroll-row" ref={uploadedScrollRef}>
                  {profile.uploaded_recipes.map((r) => renderRecipeCard(r, { saved: false }))}
                </div>
                <button
                  type="button"
                  className="scroll-arrow"
                  aria-label="Scroll uploaded recipes right"
                  onClick={() => scrollByCards(uploadedScrollRef, 1)}
                >
                  ›
                </button>
              </div>
            )}

            {/* Wireframe callout: "Inverted Yellow Brown Colour Scheme" for Saved Recipes */}
            <h2 style={{ margin: "24px 0 10px" }}>Saved Recipes</h2>
            {profile.saved_recipes.length === 0 ? (
              <div className="empty-state">No saved recipes yet.</div>
            ) : (
              <div className="recipe-scroll-section">
                <button
                  type="button"
                  className="scroll-arrow"
                  aria-label="Scroll saved recipes left"
                  onClick={() => scrollByCards(savedScrollRef, -1)}
                >
                  ‹
                </button>
                <div className="recipe-scroll-row" ref={savedScrollRef}>
                  {profile.saved_recipes.map((r) => renderRecipeCard(r, { saved: true }))}
                </div>
                <button
                  type="button"
                  className="scroll-arrow"
                  aria-label="Scroll saved recipes right"
                  onClick={() => scrollByCards(savedScrollRef, 1)}
                >
                  ›
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {toast}
    </Layout>
  );
}
