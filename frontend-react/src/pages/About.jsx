import Layout from "../components/Layout";

const FEATURES = [
  ["Discover recipes", "Search and filter by ingredient, utensils, cost, cooking time, calories, dietary tag, cuisine, and rating."],
  ["Upload your own", "Share a recipe with photos or video, ingredients, steps, and nutrition info — veg, non-veg, eggetarian, pescetarian, or Jain."],
  ["Rate, comment, subscribe", "Rate recipes out of five stars, leave comments, and subscribe to a cook to hear about their next upload by email."],
  ["Message other cooks", "A built-in chat lets you talk directly with the person behind a recipe."],
  ["Secure by default", "Every account is protected by authenticator-app two-factor authentication — no password-only logins."],
];

export default function About() {
  return (
    <Layout>
      <div className="container">
        <div className="form-card" style={{ maxWidth: 640, margin: "28px auto" }}>
          <h1>About Cookify</h1>
          <p style={{ color: "var(--text-muted)", marginBottom: 20 }}>
            Cookify is a recipe-sharing platform built for home cooks — a place to find your
            next meal, share the ones you've perfected, and connect with the people who cook them.
          </p>
          <div style={{ display: "grid", gap: 16 }}>
            {FEATURES.map(([title, text]) => (
              <div key={title}>
                <strong style={{ display: "block", marginBottom: 2 }}>{title}</strong>
                <span style={{ color: "var(--text-muted)", fontSize: 14 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
