import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { api } from "../api";

const DIETARY_OPTIONS = [
  ["vegetarian", "Vegetarian"], ["eggetarian", "Eggetarian"], ["pescetarian", "Pescetarian"],
  ["jain", "Jain"], ["non_vegetarian", "Non-Vegetarian"],
];

export default function Upload() {
  const [params] = useSearchParams();
  const editId = params.get("id");
  const navigate = useNavigate();

  const [title, setTitle] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [utensils, setUtensils] = useState("");
  const [steps, setSteps] = useState("");
  const [cost, setCost] = useState("");
  const [time, setTime] = useState("");
  const [calories, setCalories] = useState("");
  const [protein, setProtein] = useState("");
  const [dietaryTag, setDietaryTag] = useState("vegetarian");
  const [foodType, setFoodType] = useState("");
  const [region, setRegion] = useState("");
  const [speed, setSpeed] = useState(3);
  const [difficulty, setDifficulty] = useState(3);
  const [media, setMedia] = useState(null);
  const [alert, setAlert] = useState("");

  useEffect(() => {
    if (!editId) return;
    api(`/api/recipes/${editId}`).then((r) => {
      setTitle(r.title); setIngredients(r.ingredients); setUtensils(r.utensils);
      setSteps(r.steps); setCost(r.cost); setTime(r.cooking_time_minutes);
      setCalories(r.calories); setProtein(r.protein); setDietaryTag(r.dietary_tag);
      setFoodType(r.food_type); setRegion(r.region); setSpeed(r.speed); setDifficulty(r.difficulty);
    });
  }, [editId]);

  async function submit(e) {
    e.preventDefault();
    setAlert("");
    const form = new FormData();
    form.append("title", title);
    form.append("ingredients", ingredients);
    form.append("utensils", utensils);
    form.append("steps", steps);
    form.append("cost", cost || 0);
    form.append("cooking_time_minutes", time || 0);
    form.append("calories", calories || 0);
    form.append("protein", protein || 0);
    form.append("dietary_tag", dietaryTag);
    form.append("food_type", foodType);
    form.append("region", region);
    form.append("speed", speed);
    form.append("difficulty", difficulty);
    if (media) form.append("media", media);

    try {
      const res = editId
        ? await api(`/api/recipes/${editId}`, { method: "PUT", auth: true, form })
        : await api("/api/recipes", { method: "POST", auth: true, form });
      navigate(`/recipe/${res.recipe.id}`);
    } catch (err) {
      setAlert(err.message);
    }
  }

  return (
    <>
      <Navbar />
      <div className="form-card" style={{ maxWidth: 520 }}>
        <h1>{editId ? "Edit Recipe" : "Upload Recipe"}</h1>
        {alert && <div className="alert error">{alert}</div>}
        <form onSubmit={submit}>
          <input type="text" placeholder="Recipe title" required value={title} onChange={(e) => setTitle(e.target.value)} />
          <textarea rows={3} placeholder="Ingredients (comma-separated)" required value={ingredients} onChange={(e) => setIngredients(e.target.value)}></textarea>
          <input type="text" placeholder="Required utensils/equipment" value={utensils} onChange={(e) => setUtensils(e.target.value)} />
          <textarea rows={6} placeholder="Steps — one per line" required value={steps} onChange={(e) => setSteps(e.target.value)}></textarea>

          <div style={{ display: "flex", gap: 10 }}>
            <input type="number" placeholder="Cost (₹)" value={cost} onChange={(e) => setCost(e.target.value)} />
            <input type="number" placeholder="Cook time (min)" value={time} onChange={(e) => setTime(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input type="number" placeholder="Calories" value={calories} onChange={(e) => setCalories(e.target.value)} />
            <input type="number" placeholder="Protein (g)" value={protein} onChange={(e) => setProtein(e.target.value)} />
          </div>

          <select value={dietaryTag} onChange={(e) => setDietaryTag(e.target.value)}>
            {DIETARY_OPTIONS.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
          </select>

          <div style={{ display: "flex", gap: 10 }}>
            <input type="text" placeholder="Food type (appetizer, bread, dessert...)" value={foodType} onChange={(e) => setFoodType(e.target.value)} />
            <input type="text" placeholder="Cuisine (pan-Asian, English...)" value={region} onChange={(e) => setRegion(e.target.value)} />
          </div>

          <label style={{ fontSize: 13, display: "block", margin: "6px 0 2px" }}>Speed: {speed} / 5</label>
          <input type="range" min="0.5" max="5" step="0.5" value={speed}
            style={{ borderRadius: 0, background: "transparent", padding: 0, marginBottom: 14 }}
            onChange={(e) => setSpeed(e.target.value)} />

          <label style={{ fontSize: 13, display: "block", margin: "6px 0 2px" }}>Difficulty: {difficulty} / 5</label>
          <input type="range" min="0.5" max="5" step="0.5" value={difficulty}
            style={{ borderRadius: 0, background: "transparent", padding: 0, marginBottom: 14 }}
            onChange={(e) => setDifficulty(e.target.value)} />

          <input type="file" accept="image/*,video/*"
            style={{ borderRadius: 8, background: "transparent", border: "1px dashed var(--border)" }}
            onChange={(e) => setMedia(e.target.files[0])} />

          <button className="btn" type="submit" style={{ width: "100%", marginTop: 14 }}>
            {editId ? "Save Changes" : "Submit Recipe"}
          </button>
        </form>
      </div>
      <Footer />
    </>
  );
}
