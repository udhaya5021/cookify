import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api, API_BASE, requireAuthOrAlert, getMyUserId } from "../authGuard";

export default function Recipe() {
  const { id } = useParams();
  const [recipe, setRecipe] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentAlert, setCommentAlert] = useState(null);
  const [ratingMsg, setRatingMsg] = useState(null);
  const [saveLabel, setSaveLabel] = useState("Save Recipe");
  const starsRef = useRef(null);

  async function loadRecipe() {
    const r = await api(`/api/recipes/${id}`);
    setRecipe(r);
  }
  async function loadComments() {
    const c = await api(`/api/recipes/${id}/comments`);
    setComments(c);
  }

  useEffect(() => { loadRecipe(); loadComments(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleSave() {
    if (!requireAuthOrAlert()) return;
    try {
      await api(`/api/recipes/${id}/save`, { method: "POST", auth: true });
      setSaveLabel("Saved ✓");
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleShare() {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard:\n" + url);
    } catch {
      prompt("Copy this link to share:", url);
    }
  }

  async function handleSubscribe() {
    if (!requireAuthOrAlert()) return;
    try {
      const res = await api(`/api/users/${recipe.creator_id}/subscribe`, { method: "POST", auth: true });
      alert(res.message);
    } catch (err) {
      alert(err.message);
    }
  }

  async function handleRate(e) {
    if (!requireAuthOrAlert()) return;
    const rect = starsRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    const score = Math.max(1, Math.min(5, Math.ceil(pct * 5)));
    try {
      const res = await api(`/api/recipes/${id}/ratings`, { method: "POST", auth: true, body: { score } });
      setRatingMsg({ type: "success", text: `Rated ${score}/5 — new average: ${res.average_rating}` });
      loadRecipe();
    } catch (err) {
      setRatingMsg({ type: "error", text: err.message });
    }
  }

  async function submitComment(e) {
    e.preventDefault();
    if (!requireAuthOrAlert()) return;
    setCommentAlert(null);
    try {
      await api(`/api/recipes/${id}/comments`, { method: "POST", auth: true, body: { text: commentText } });
      setCommentText("");
      loadComments();
    } catch (err) {
      setCommentAlert(err.message);
    }
  }

  if (!recipe) return (<><Navbar /><div className="container">Loading…</div><Footer /></>);

  const isOwner = recipe.creator_id === getMyUserId();

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="recipe-detail">
          <span className={`badge ${recipe.recipe_type === "veg" ? "veg" : "nonveg"}`}>{recipe.dietary_tag.replace("_", " ")}</span>
          <h1>{recipe.title}</h1>
          <div className="meta">
            By <Link to={`/profile/${recipe.creator_id}`}>{recipe.creator_username}</Link>
            {" · "}{recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ""}
            {" · "}{recipe.view_count} views · {recipe.rating_count} ratings | Avg {recipe.average_rating}
            {recipe.food_type ? " · " + recipe.food_type : ""}{recipe.region ? " · " + recipe.region : ""}
          </div>
          <div className="meta">Speed: {recipe.speed}/5 · Difficulty: {recipe.difficulty}/5</div>
          {recipe.media_url && <img className="thumb" style={{ height: 280, marginTop: 12 }} src={`${API_BASE}${recipe.media_url}`} alt="" />}
          <p style={{ marginTop: 14 }}><strong>Ingredients:</strong> {recipe.ingredients}</p>
          <p><strong>Utensils:</strong> {recipe.utensils || "—"}</p>
          <p><strong>Cost:</strong> ₹{recipe.cost} · <strong>Time:</strong> {recipe.cooking_time_minutes} min · <strong>Calories:</strong> {recipe.calories} · <strong>Protein:</strong> {recipe.protein}g</p>
          <h3 style={{ marginTop: 16 }}>Steps</h3>
          <div className="steps">{recipe.steps}</div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            {!isOwner && <button className="btn secondary small" onClick={handleSubscribe}>Subscribe to {recipe.creator_username}</button>}
            <button className="btn secondary small" onClick={handleSave}>{saveLabel}</button>
            <button className="btn secondary small" onClick={handleShare}>Share Recipe</button>
            {isOwner && <Link className="btn secondary small" to={`/upload?id=${recipe.id}`}>Edit recipe</Link>}
          </div>
        </div>

        <div className="recipe-detail">
          <h3>Rate this recipe</h3>
          <div className="stars" ref={starsRef} onClick={handleRate}>★★★★★</div>
          {ratingMsg && <div className={`alert ${ratingMsg.type}`}>{ratingMsg.text}</div>}
        </div>

        <div className="recipe-detail">
          <h3>Comments</h3>
          <form onSubmit={submitComment} style={{ margin: "16px 0" }}>
            <textarea rows={3} placeholder="Write a comment..." required value={commentText} onChange={(e) => setCommentText(e.target.value)}></textarea>
            <button className="btn small" type="submit">Post Comment</button>
          </form>
          {commentAlert && <div className="alert error">{commentAlert}</div>}
          {comments.length === 0
            ? <div className="empty-state">No comments yet — be the first.</div>
            : comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="user">{c.username}</div>
                <div>{c.text}</div>
              </div>
            ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
