import { Link } from "react-router-dom";
import Layout from "../components/Layout";
import { getToken } from "../api";

export default function Home() {
  const loggedIn = !!getToken();

  return (
    <Layout minimal={!loggedIn}>
      <div className="form-card" style={{ textAlign: "center" }}>
        <h1>Welcome to Cookify</h1>
        <p style={{ color: "var(--text-muted)", marginBottom: 24 }}>
          Discover, share, and rate recipes from home cooks.
        </p>
        {loggedIn ? (
          <Link className="btn" to="/browse" style={{ display: "block" }}>
            Browse Recipes
          </Link>
        ) : (
          <>
            <Link className="btn" to="/login" style={{ display: "block", marginBottom: 14 }}>
              Login
            </Link>
            <Link className="btn secondary" to="/signup" style={{ display: "block" }}>
              Sign Up
            </Link>
          </>
        )}
      </div>
    </Layout>
  );
}
