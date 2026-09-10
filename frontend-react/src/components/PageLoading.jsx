import Layout from "./Layout";

// Shared "waiting on the initial API fetch" screen — used by any page that
// needs data by ID (Recipe, Profile, ...) before it has anything to render.
export default function PageLoading() {
  return (
    <Layout>
      <div className="container loading-state">
        <span className="spinner"></span> Loading…
      </div>
    </Layout>
  );
}
