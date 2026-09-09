import { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, API_BASE, getMyUserId } from "../api";

export default function Profile() {
  const { id } = useParams();
  const [profile, setProfile] = useState(null);
  const [bio, setBio] = useState("");
  const [age, setAge] = useState("");
  const [pfp, setPfp] = useState(null);
  const isMe = parseInt(id, 10) === getMyUserId();

  async function load() {
    const p = await api(`/api/users/${id}`);
    setProfile(p);
    setBio(p.bio || "");
    setAge(p.age || "");
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function submitEdit(e) {
    e.preventDefault();
    const form = new FormData();
    form.append("bio", bio);
    form.append("age", age || "");
    if (pfp) form.append("profile_picture", pfp);
    try {
      await api("/api/users/me", { method: "PUT", auth: true, form });
      load();
    } catch (err) {
      alert(err.message);
    }
  }

  if (!profile) return (<><Navbar /><div className="container">Loading…</div><Footer /></>);

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="recipe-detail">
          <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
            {profile.profile_picture_url
              ? <img src={`${API_BASE}${profile.profile_picture_url}`} style={{ width: 80, height: 80, borderRadius: "50%", objectFit: "cover" }} alt="" />
              : <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#eee" }}></div>}
            <div>
              <h1>{profile.username}</h1>
              <div className="meta">{profile.first_name || ""} {profile.last_name || ""}{profile.age ? ` · Age ${profile.age}` : ""}</div>
              <div className="meta">{profile.followers} followers · {profile.following} following</div>
            </div>
          </div>
          <p style={{ marginTop: 14 }}>{profile.bio || "No bio yet."}</p>
          {!isMe && <Link className="btn small secondary" to={`/chat/${id}`}>Message</Link>}
        </div>

        {isMe && (
          <div className="recipe-detail">
            <h3>Edit Profile</h3>
            <form onSubmit={submitEdit}>
              <textarea rows={2} placeholder="Bio" value={bio} onChange={(e) => setBio(e.target.value)}></textarea>
              <input type="number" placeholder="Age" style={{ maxWidth: 120 }} value={age} onChange={(e) => setAge(e.target.value)} />
              <input type="file" accept="image/*"
                style={{ borderRadius: 8, background: "transparent", border: "1px dashed var(--border)" }}
                onChange={(e) => setPfp(e.target.files[0])} />
              <button className="btn small" type="submit">Save</button>
            </form>
          </div>
        )}

        <h2 style={{ margin: "20px 0 10px" }}>Uploaded Recipes</h2>
        <div className="recipe-grid">
          {profile.uploaded_recipes.length === 0
            ? <div className="empty-state">No recipes uploaded yet.</div>
            : profile.uploaded_recipes.map((r) => (
              <div key={r.id} className={`recipe-card ${r.recipe_type === "veg" ? "veg" : ""}`}>
                <div className="title">{r.title}</div>
                <div className="rating">{r.rating_count} ratings | Avg {r.average_rating}</div>
                <Link className="btn small" to={`/recipe/${r.id}`}>Open recipe</Link>
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
                <div className="title">{r.title}</div>
                <div className="rating">{r.rating_count} ratings | Avg {r.average_rating}</div>
                <Link className="btn small secondary" to={`/recipe/${r.id}`}>Open recipe</Link>
              </div>
            ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
