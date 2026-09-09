import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import StarRating from "../components/StarRating";
import { api, API_BASE } from "../api";

export default function Browse() {
  const [q, setQ] = useState("");
  const [ingredient, setIngredient] = useState("");
  const [utensil, setUtensil] = useState("");
  const [cost, setCost] = useState("");
  const [time, setTime] = useState("");
  const [calories, setCalories] = useState("");
  const [vegOnly, setVegOnly] = useState(false);
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
      q, ingredient, utensil, veg_only: vegOnly, dietary_tag: dietary,
      food_type: foodType, region, sort,
    });
    if (cost) params.set("max_cost", cost);
    if (time) params.set("max_time", time);
    if (calories) params.set("max_calories", calories);
    if (minSpeed && minSpeed !== "0") params.set("min_speed", minSpeed);
    if (minDifficulty && minDifficulty !== "0") params.set("min_difficulty", minDifficulty);
    if (minRating && minRating !== "0") params.set("min_rating", minRating);

    const data = await api(`/api/recipes?${params.toString()}`);
    setRecipes(data.recipes);
  }, [q, ingredient, utensil, cost, time, calories, vegOnly, dietary, foodType, region, minSpeed, minDifficulty, minRating, sort]);

  useEffect(() => { loadRecipes(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <Navbar />
      <div className="container">
        <div className="search-panel">
          <h1 style={{ textAlign: "center", marginBottom: 16 }}>Explore Recipes</h1>
          <div className="search-row">
            <input type="text" placeholder="Search recipe title..." value={q} onChange={(e) => setQ(e.target.value)} />
            <button className="btn" onClick={loadRecipes}>Search</button>
          </div>
          <div className="filters">
            <label>Ingredient <input type="text" placeholder="e.g. chicken" style={{ width: 120 }} value={ingredient} onChange={(e) => setIngredient(e.target.value)} /></label>
            <label>Utensil <input type="text" placeholder="e.g. oven" style={{ width: 120 }} value={utensil} onChange={(e) => setUtensil(e.target.value)} /></label>
            <label>Max cost (₹) <input type="number" value={cost} onChange={(e) => setCost(e.target.value)} /></label>
            <label>Max time (min) <input type="number" value={time} onChange={(e) => setTime(e.target.value)} /></label>
            <label>Max calories <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)} /></label>
            <label><input type="checkbox" style={{ width: "auto" }} checked={vegOnly} onChange={(e) => setVegOnly(e.target.checked)} /> Veg only</label>
            <label>Dietary
              <select style={{ width: 130, margin: 0 }} value={dietary} onChange={(e) => setDietary(e.target.value)}>
                <option value="">Any</option>
                <option value="vegetarian">Vegetarian</option>
                <option value="eggetarian">Eggetarian</option>
                <option value="pescetarian">Pescetarian</option>
                <option value="jain">Jain</option>
                <option value="non_vegetarian">Non-Vegetarian</option>
              </select>
            </label>
            <label>Food type <input type="text" placeholder="e.g. dessert" style={{ width: 110 }} value={foodType} onChange={(e) => setFoodType(e.target.value)} /></label>
            <label>Cuisine <input type="text" placeholder="e.g. pan-Asian" style={{ width: 110 }} value={region} onChange={(e) => setRegion(e.target.value)} /></label>
            <label>Min speed ({minSpeed})
              <input type="range" min="0" max="5" step="0.5" style={{ width: 90 }} value={minSpeed} onChange={(e) => setMinSpeed(e.target.value)} />
            </label>
            <label>Min difficulty ({minDifficulty})
              <input type="range" min="0" max="5" step="0.5" style={{ width: 90 }} value={minDifficulty} onChange={(e) => setMinDifficulty(e.target.value)} />
            </label>
            <label>Min rating ({minRating})
              <input type="range" min="0" max="5" step="0.5" style={{ width: 90 }} value={minRating} onChange={(e) => setMinRating(e.target.value)} />
            </label>
            <label>Sort by
              <select style={{ width: 130, margin: 0 }} value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="popularity">Popularity</option>
                <option value="rating">Top rated</option>
                <option value="newest">Newest</option>
              </select>
            </label>
          </div>
        </div>

        <div className="recipe-grid">
          {recipes === null ? null : recipes.length === 0 ? (
            <div className="empty-state">No recipes match your search.</div>
          ) : recipes.map((r) => (
            <div key={r.id} className={`recipe-card ${r.recipe_type === "veg" ? "veg" : ""}`}>
              {r.media_url && <img className="thumb" src={`${API_BASE}${r.media_url}`} alt="" />}
              <span className={`badge ${r.recipe_type === "veg" ? "veg" : "nonveg"}`}>{r.recipe_type === "veg" ? "Veg" : "Non-Veg"}</span>
              <div className="title">{r.title}</div>
              <div className="meta">By {r.creator_username || "Unknown"}{r.food_type ? " · " + r.food_type : ""}{r.region ? " · " + r.region : ""}</div>
              <div className="meta">Speed {r.speed}/5 · Difficulty {r.difficulty}/5</div>
              <StarRating average={r.average_rating} count={r.rating_count} />
              <Link className="btn small" to={`/recipe/${r.id}`}>Open recipe</Link>
            </div>
          ))}
        </div>
      </div>
      <Footer />
    </>
  );
}
