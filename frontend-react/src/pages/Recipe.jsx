import { useState, useEffect, useRef } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import PageLoading from "../components/PageLoading";
import ShareModal from "../components/ShareModal";
import Avatar from "../components/Avatar";
import { useConfirm } from "../hooks/useConfirm";
import { useToast } from "../hooks/useToast";
import { api, requireAuthOrAlert, getMyUserId } from "../authGuard";

export default function Recipe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState(null);
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [commentAlert, setCommentAlert] = useState(null);
  const [ratingMsg, setRatingMsg] = useState(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [hoverScore, setHoverScore] = useState(0);
  const starsRef = useRef(null);

  function scoreFromEvent(e) {
    const rect = starsRef.current.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    return Math.max(1, Math.min(5, Math.ceil(pct * 5)));
  }
  const [confirmModal, confirm] = useConfirm();
  const [toast, showToast] = useToast();

  async function loadRecipe() {
    // auth:true is safe even when logged out — api() only attaches the
    // header if a token actually exists — and it's required here so the
    // backend knows *who's* viewing, to report this viewer's is_saved state.
    const r = await api(`/api/recipes/${id}`, { auth: true });
    setRecipe(r);
  }
  async function loadComments() {
    const c = await api(`/api/recipes/${id}/comments`);
    setComments(c);
  }

  useEffect(() => {
    loadRecipe();
    loadComments();
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleToggleSave() {
    if (!requireAuthOrAlert()) return;
    const wasSaved = recipe.is_saved;
    try {
      await api(`/api/recipes/${id}/save`, { method: wasSaved ? "DELETE" : "POST", auth: true });
      setRecipe((prev) => ({ ...prev, is_saved: !wasSaved }));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleToggleSubscribe() {
    if (!requireAuthOrAlert()) return;
    const wasSubscribed = recipe.is_subscribed_to_creator;
    try {
      const res = await api(`/api/users/${recipe.creator_id}/subscribe`, {
        method: wasSubscribed ? "DELETE" : "POST",
        auth: true,
      });
      showToast(res.message, "success");
      setRecipe((prev) => ({ ...prev, is_subscribed_to_creator: !wasSubscribed }));
    } catch (err) {
      showToast(err.message, "error");
    }
  }

  async function handleRate(e) {
    if (!requireAuthOrAlert()) return;
    const score = scoreFromEvent(e);
    try {
      const res = await api(`/api/recipes/${id}/ratings`, { method: "POST", auth: true, body: { score } });
      setRatingMsg({
        type: "success",
        text: recipe.my_rating
          ? `Updated your rating to ${score}/5 — new average: ${res.average_rating}`
          : `Rated ${score}/5 — new average: ${res.average_rating}`,
      });
      loadRecipe(); // refetches my_rating too, so the widget reflects the saved value, not just the hover preview
    } catch (err) {
      setRatingMsg({ type: "error", text: err.message });
    }
  }

  async function handleDelete() {
    const ok = await confirm(`Delete "${recipe.title}"? This can't be undone.`, { danger: true });
    if (!ok) return;
    try {
      await api(`/api/recipes/${id}`, { method: "DELETE", auth: true });
      navigate(`/profile/${recipe.creator_id}`);
    } catch (err) {
      showToast(err.message, "error");
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
          <span className={`badge ${recipe.recipe_type === "veg" ? "veg" : "nonveg"}`}>
            {recipe.dietary_tag.replace("_", " ")}
          </span>
          <div className="recipe-header">
            <div style={{ flex: 1 }}>
              <h1>{recipe.title}</h1>
              <div className="meta-row">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar
                    src={recipe.creator_profile_picture_url}
                    label={recipe.creator_username}
                    className="inline-avatar"
                    emptyClassName="inline-avatar-empty"
                  />
                  <div>
                    By <Link to={`/profile/${recipe.creator_id}`}>{recipe.creator_username}</Link>
                  </div>
                </div>
                <div style={{ marginLeft: 8 }}>
                  {recipe.created_at ? new Date(recipe.created_at).toLocaleDateString() : ""}
                  {" · "}
                  {recipe.view_count} views · {recipe.rating_count} ratings | Avg {recipe.average_rating}
                  {recipe.food_type ? " · " + recipe.food_type : ""}
                  {recipe.region ? " · " + recipe.region : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Wireframe: media on the left, steps on the right — also keeps the
              instructions at a readable line length instead of one very wide
              column of text. */}
          <div className="recipe-layout">
            <div className="recipe-aside">
              <Avatar
                src={recipe.media_url}
                label={recipe.title}
                className="thumb"
                emptyClassName="thumb-placeholder"
                style={{ height: 240, borderRadius: 12 }}
                isVideo={recipe.media_content_type?.startsWith("video/")}
                controls
              />

              <dl className="recipe-facts">
                <div>
                  <dt>Cost</dt>
                  <dd>₹{recipe.cost}</dd>
                </div>
                <div>
                  <dt>Time</dt>
                  <dd>{recipe.cooking_time_minutes} min</dd>
                </div>
                <div>
                  <dt>Calories</dt>
                  <dd>{recipe.calories}</dd>
                </div>
                <div>
                  <dt>Protein</dt>
                  <dd>{recipe.protein}g</dd>
                </div>
                <div>
                  <dt>Speed</dt>
                  <dd>{recipe.speed}/5</dd>
                </div>
                <div>
                  <dt>Difficulty</dt>
                  <dd>{recipe.difficulty}/5</dd>
                </div>
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
            {!isOwner && (
              <button className="btn secondary small" onClick={handleToggleSubscribe}>
                {recipe.is_subscribed_to_creator
                  ? `Subscribed ✓ ${recipe.creator_username}`
                  : `Subscribe to ${recipe.creator_username}`}
              </button>
            )}
            <button className="btn secondary small" onClick={handleToggleSave}>
              {recipe.is_saved ? "Saved ✓" : "Save Recipe"}
            </button>
            <button className="btn secondary small" onClick={() => setShareOpen(true)}>
              Share Recipe
            </button>
            {isOwner && (
              <Link className="btn secondary small" to={`/upload?id=${recipe.id}`}>
                Edit recipe
              </Link>
            )}
            {isOwner && (
              <button className="btn danger small" onClick={handleDelete}>
                Delete recipe
              </button>
            )}
          </div>
        </div>

        <div className="recipe-detail">
          <h3>Rate this recipe</h3>
          <p className="meta" style={{ marginBottom: 10 }}>
            {recipe.my_rating
              ? `You rated this ${recipe.my_rating}/5 — click to change it.`
              : "You haven't rated this yet — click a star to rate it."}{" "}
            Average: {recipe.average_rating || 0}/5 ({recipe.rating_count}{" "}
            {recipe.rating_count === 1 ? "rating" : "ratings"}).
          </p>
          {/* Hovering previews the score a click would submit; off-hover it
              falls back to your own existing rating (so re-opening the page
              shows what you gave it, not a stranger's average), and only
              the recipe's overall average if you've never rated it. One
              score per user either way — the backend updates your existing
              row rather than adding another, this just makes that visible
              instead of implying repeated clicks pile up separate ratings. */}
          <div
            className="stars"
            ref={starsRef}
            onClick={handleRate}
            onMouseMove={(e) => setHoverScore(scoreFromEvent(e))}
            onMouseLeave={() => setHoverScore(0)}
          >
            {"★".repeat(hoverScore || recipe.my_rating || Math.round(recipe.average_rating || 0))}
            {"☆".repeat(5 - (hoverScore || recipe.my_rating || Math.round(recipe.average_rating || 0)))}
          </div>
          {ratingMsg && <div className={`alert ${ratingMsg.type}`}>{ratingMsg.text}</div>}
        </div>

        <div className="recipe-detail">
          <h3>Comments</h3>
          <form onSubmit={submitComment} style={{ margin: "16px 0" }}>
            <textarea
              rows={3}
              placeholder="Write a comment..."
              required
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
            ></textarea>
            <button className="btn small" type="submit">
              Post Comment
            </button>
          </form>
          {commentAlert && <div className="alert error">{commentAlert}</div>}
          {comments.length === 0 ? (
            <div className="empty-state">No comments yet — be the first.</div>
          ) : (
            comments.map((c) => (
              <div key={c.id} className="comment">
                <div className="user">{c.username}</div>
                <div>{c.text}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {shareOpen && (
        <ShareModal recipe={recipe} url={window.location.href} onClose={() => setShareOpen(false)} />
      )}
      {confirmModal}
      {toast}
    </Layout>
  );
}
