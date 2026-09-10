import { useState, useEffect, useRef } from "react";
import { Link, useParams } from "react-router-dom";
import Layout from "../components/Layout";
import PageLoading from "../components/PageLoading";
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

  if (!recipe) return <PageLoading />;

  const isOwner = recipe.creator_id === getMyUserId();

  return (
    <Layout>
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

          {/* Wireframe: media on the left, steps on the right — also keeps the
              instructions at a readable line length instead of one very wide
              column of text. */}
          <div className="recipe-layout">
            <div className="recipe-aside">
              {recipe.media_url
                ? <img className="thumb" style={{ height: 240 }} src={`${API_BASE}${recipe.media_url}`} alt="" />
                : <div className="thumb thumb-placeholder" style={{ height: 240, borderRadius: 12 }}>{recipe.title.charAt(0).toUpperCase()}</div>}

              <dl className="recipe-facts">
                <div><dt>Cost</dt><dd>₹{recipe.cost}</dd></div>
                <div><dt>Time</dt><dd>{recipe.cooking_time_minutes} min</dd></div>
                <div><dt>Calories</dt><dd>{recipe.calories}</dd></div>
                <div><dt>Protein</dt><dd>{recipe.protein}g</dd></div>
                <div><dt>Speed</dt><dd>{recipe.speed}/5</dd></div>
                <div><dt>Difficulty</dt><dd>{recipe.difficulty}/5</dd></div>
              </dl>
            </div>

            <div className="recipe-main">
              <h3>Ingredients</h3>
              <p>{recipe.ingredients}</p>
              <h3>Utensils</h3>
              <p>{recipe.utensils || "—"}</p>
              <h3>Steps</h3>
              <div className="steps">{recipe.steps}</div>
            </div>
          </div>

          <div className="recipe-actions">
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
    </Layout>
  );
}
