import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import StarRating from "../components/StarRating";
import { api, API_BASE, getToken } from "../api";

export default function Browse() {
  const [q, setQ] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [utensil, setUtensil] = useState("");
  const [cost, setCost] = useState("");
  const [time, setTime] = useState("");
  const [calories, setCalories] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
  const [followingOnly, setFollowingOnly] = useState(false);
  const [dietary, setDietary] = useState("");
  const [foodType, setFoodType] = useState("");
  const [region, setRegion] = useState("");
  const [minSpeed, setMinSpeed] = useState(0);
  const [minDifficulty, setMinDifficulty] = useState(0);
  const [minRating, setMinRating] = useState(0);
  const [sort, setSort] = useState("popularity");
  const [recipes, setRecipes] = useState(null);

  const loadRecipes = useCallback(async () => {
    const params = new URLSearchParams({
      q, ingredient, utensil, veg_only: vegOnly, following_only: followingOnly,
      dietary_tag: dietary, food_type: foodType, region, sort,
    });
    if (cost) params.set("max_cost", cost);
    if (time) params.set("max_time", time);
    if (calories) params.set("max_calories", calories);
    if (minSpeed && minSpeed !== "0") params.set("min_speed", minSpeed);
    if (minDifficulty && minDifficulty !== "0") params.set("min_difficulty", minDifficulty);
    if (minRating && minRating !== "0") params.set("min_rating", minRating);

    // auth:true so following_only can resolve against *this* viewer's
    // subscriptions — harmless when logged out, api() just skips the header.
    const data = await api(`/api/recipes?${params.toString()}`, { auth: true });
    setRecipes(data.recipes);
  }, [q, ingredient, utensil, cost, time, calories, vegOnly, followingOnly, dietary, foodType, region, minSpeed, minDifficulty, minRating, sort]);

  // Runs on mount, and again whenever the Following toggle changes — a
  // toggle (unlike the text/number filters, which need an explicit Search
  // click) reads as an instant switch, so this one re-queries immediately.
  useEffect(() => { loadRecipes(); }, [followingOnly]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Layout>
      <div className="container">
        <div className="search-panel">
          <h1 style={{ textAlign: "center", marginBottom: 18 }}>Explore Recipe</h1>
          <div className="search-row">
            <input type="text" placeholder="Search recipe title..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" onClick={loadRecipes}>Search</button>
          </div>

          <div className="filter-section">
            <span className="filter-label">Ingredients &amp; equipment</span>
            <div className="filter-grid">
              <label className="filter-field"><span className="f-label">Ingredient</span>
                <input type="text" placeholder="e.g. chicken" value={ingredient} onChange={(e) => setIngredient(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Utensil</span>
                <input type="text" placeholder="e.g. oven" value={utensil} onChange={(e) => setUtensil(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Food type</span>
                <input type="text" placeholder="e.g. dessert" value={foodType} onChange={(e) => setFoodType(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Cuisine</span>
                <input type="text" placeholder="e.g. pan-Asian" value={region} onChange={(e) => setRegion(e.target.value)} />
              </label>
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-label">Budget &amp; nutrition</span>
            <div className="filter-grid">
              <label className="filter-field"><span className="f-label">Max cost (₹)</span>
                <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Max time (min)</span>
                <input type="number" value={time} onChange={(e) => setTime(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Max calories</span>
                <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Dietary preference</span>
                <select value={dietary} onChange={(e) => setDietary(e.target.value)}>
                  <option value="">Any</option>
                  <option value="vegetarian">Vegetarian</option>
                  <option value="eggetarian">Eggetarian</option>
                  <option value="pescetarian">Pescetarian</option>
                  <option value="jain">Jain</option>
                  <option value="non_vegetarian">Non-Vegetarian</option>
                </select>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
              <label className={`chip-toggle ${vegOnly ? "active" : ""}`}>
                <input type="checkbox" checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} />
                🌱 Veg only
              </label>
              {getToken() && (
                <label className={`chip-toggle ${followingOnly ? "active" : ""}`}>
                  <input type="checkbox" checked={followingOnly} onChange={(e) => setFollowingOnly(e.target.checked)} />
                  🔔 Following only
                </label>
              )}
            </div>
          </div>

          <div className="filter-section">
            <span className="filter-label">Skill &amp; sorting</span>
            <div className="filter-grid">
              <label className="filter-field"><span className="f-label">Min speed ({minSpeed})</span>
                <input type="range" min="0" max="5" step="0.5" value={minSpeed} onChange={(e) => setMinSpeed(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Min difficulty ({minDifficulty})</span>
                <input type="range" min="0" max="5" step="0.5" value={minDifficulty} onChange={(e) => setMinDifficulty(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Min rating ({minRating})</span>
                <input type="range" min="0" max="5" step="0.5" value={minRating} onChange={(e) => setMinRating(e.target.value)} />
              </label>
              <label className="filter-field"><span className="f-label">Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="popularity">Popularity</option>
                  <option value="rating">Top rated</option>
                  <option value="newest">Newest</option>
                </select>
              </label>
            </div>
          </div>
        </div>

        <div className="recipe-grid">
          {recipes === null ? (
            <div className="loading-state" style={{ gridColumn: "1 / -1" }}><span className="spinner"></span> Loading recipes…</div>
          ) : recipes.length === 0 ? (
            <div className="empty-state">No recipes match your search.</div>
          ) : recipes.map((r) => (
            <div key={r.id} className={`recipe-card ${r.recipe_type === "veg" ? "veg" : ""}`}>
              <div className="media-wrap">
                {r.media_url
                  ? <img className="thumb" src={r.media_url.startsWith("http") ? r.media_url : `${API_BASE}${r.media_url}`} alt="" />
                  : <div className="thumb thumb-placeholder">{r.title.charAt(0).toUpperCase()}</div>}
                <span className={`badge ${r.recipe_type === "veg" ? "veg" : "nonveg"}`}>{r.recipe_type === "veg" ? "Veg" : "Non-Veg"}</span>
              </div>
              <div className="card-body">
                <div className="author-row">
                  {r.creator_profile_picture_url
                    ? <img className="author-avatar" src={r.creator_profile_picture_url.startsWith("http") ? r.creator_profile_picture_url : `${API_BASE}${r.creator_profile_picture_url}`} alt="" />
                    : <div className="author-avatar author-avatar-empty">{(r.creator_username || "?").charAt(0).toUpperCase()}</div>}
                  <div className="author-info">
                    <div className="author-name">{r.creator_username || "Unknown"}</div>
                    {r.creator_bio && <div className="author-bio">{r.creator_bio}</div>}
                  </div>
                </div>
                <div className="title">{r.title}</div>
                <div className="meta">By {r.creator_username || "Unknown"}{r.food_type ? " · " + r.food_type : ""}{r.region ? " · " + r.region : ""}</div>
                <div className="meta">
                  <span className="fact-chip">⏱ {r.cooking_time_minutes || "—"} min</span>
                  {r.servings && <span className="fact-chip">🍽 {r.servings}</span>}
                  <span style={{ marginLeft: 8 }}>Speed {r.speed}/5 · Difficulty {r.difficulty}/5</span>
                </div>
                <StarRating average={r.average_rating} count={r.rating_count} />
                <Link className="btn small" to={`/recipe/${r.id}`}>Open recipe</Link>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Layout>
  );
}
