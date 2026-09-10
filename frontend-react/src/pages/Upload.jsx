import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams, Navigate } from "react-router-dom";
import Layout from "../components/Layout";
import StarPicker from "../components/StarPicker";
import { api, API_BASE, getToken } from "../api";

const DIETARY_OPTIONS = [
  ["vegetarian", "Vegetarian"],
  ["eggetarian", "Eggetarian"],
  ["pescetarian", "Pescetarian"],
  ["jain", "Jain"],
  ["non_vegetarian", "Non-Vegetarian"],
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
  const [mediaPreview, setMediaPreview] = useState(null);
  const [existingMediaUrl, setExistingMediaUrl] = useState(null);
  const [existingMediaContentType, setExistingMediaContentType] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const [alert, setAlert] = useState("");
  const fileInputRef = useRef(null);

  function pickMedia(file) {
    if (!file) return;
    setMedia(file);
    // A freshly picked file replaces whatever was there before.
    setExistingMediaUrl(null);
    setExistingMediaContentType("");
    if (file.type.startsWith("image/")) {
      setMediaPreview(URL.createObjectURL(file));
    } else {
      setMediaPreview(null); // video — show filename only, no thumbnail
    }
  }

  useEffect(() => {
    if (!editId) return;
    api(`/api/recipes/${editId}`).then((r) => {
      setTitle(r.title);
      setIngredients(r.ingredients);
      setUtensils(r.utensils);
      setSteps(r.steps);
      setCost(r.cost);
      setTime(r.cooking_time_minutes);
      setCalories(r.calories);
      setProtein(r.protein);
      setDietaryTag(r.dietary_tag);
      setFoodType(r.food_type);
      setRegion(r.region);
      setSpeed(r.speed);
      setDifficulty(r.difficulty);
      if (r.media_url) {
        setExistingMediaUrl(r.media_url);
        setExistingMediaContentType(r.media_content_type || "");
      }
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

  // Recipe Upload Method pseudocode: "CALL checkUserLoginStatus() ... IF NOT
  // LoggedIn THEN REDIRECT to Login Page" — enforced here, not just by
  // hiding the nav link, so a direct /upload visit while logged out redirects
  // instead of silently failing on submit.
  if (!getToken()) return <Navigate to="/login" replace />;

  return (
    <Layout>
      <div className="form-card" style={{ maxWidth: 520 }}>
        <h1>{editId ? "Edit Recipe" : "Upload Recipe"}</h1>
        {alert && <div className="alert error">{alert}</div>}
        <form onSubmit={submit}>
          <input
            type="text"
            placeholder="Recipe title"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <textarea
            rows={3}
            placeholder="Ingredients (comma-separated)"
            required
            value={ingredients}
            onChange={(e) => setIngredients(e.target.value)}
          ></textarea>
          <input
            type="text"
            placeholder="Required utensils/equipment"
            value={utensils}
            onChange={(e) => setUtensils(e.target.value)}
          />
          <textarea
            rows={6}
            placeholder="Steps — one per line"
            required
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
          ></textarea>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="number"
              min="0"
              placeholder="Cost (₹)"
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            <input
              type="number"
              min="0"
              placeholder="Cook time (min)"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="number"
              min="0"
              placeholder="Calories"
              value={calories}
              onChange={(e) => setCalories(e.target.value)}
            />
            <input
              type="number"
              min="0"
              placeholder="Protein (g)"
              value={protein}
              onChange={(e) => setProtein(e.target.value)}
            />
          </div>

          <select value={dietaryTag} onChange={(e) => setDietaryTag(e.target.value)}>
            {DIETARY_OPTIONS.map(([v, label]) => (
              <option key={v} value={v}>
                {label}
              </option>
            ))}
          </select>

          <div style={{ display: "flex", gap: 10 }}>
            <input
              type="text"
              placeholder="Food type (appetizer, bread, dessert...)"
              value={foodType}
              onChange={(e) => setFoodType(e.target.value)}
            />
            <input
              type="text"
              placeholder="Cuisine (pan-Asian, English...)"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            />
          </div>

          <StarPicker label="Speed" value={Number(speed)} onChange={setSpeed} />
          <StarPicker label="Difficulty" value={Number(difficulty)} onChange={setDifficulty} />

          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              pickMedia(e.dataTransfer.files?.[0]);
            }}
            style={{
              border: `2px dashed ${dragActive ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 14,
              background: dragActive ? "#fdf1e2" : "#f6efe1",
              padding: mediaPreview || existingMediaUrl ? 0 : 28,
              textAlign: "center",
              cursor: "pointer",
              marginBottom: 14,
              overflow: "hidden",
            }}
          >
            {mediaPreview ? (
              <img
                src={mediaPreview}
                alt="Preview"
                style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
              />
            ) : media ? (
              <div style={{ color: "var(--text-muted)" }}>{media.name} selected</div>
            ) : existingMediaUrl && existingMediaContentType.startsWith("video/") ? (
              <video
                src={`${API_BASE}${existingMediaUrl}`}
                controls
                style={{ width: "100%", maxHeight: 220, display: "block" }}
              />
            ) : existingMediaUrl ? (
              <img
                src={`${API_BASE}${existingMediaUrl}`}
                alt="Current"
                style={{ width: "100%", maxHeight: 220, objectFit: "cover", display: "block" }}
              />
            ) : (
              <div style={{ color: "var(--text-muted)" }}>
                Drag and drop an image or video, or click to choose a file
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              hidden
              onChange={(e) => pickMedia(e.target.files[0])}
            />
          </div>

          <button className="btn" type="submit" style={{ width: "100%", marginTop: 14 }}>
            {editId ? "Save Changes" : "Submit Recipe"}
          </button>
        </form>
      </div>
    </Layout>
  );
}
