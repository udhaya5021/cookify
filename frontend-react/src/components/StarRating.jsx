// Renders a filled/empty star row for a recipe's average rating, matching
// the wireframe's "★★★☆☆ 13" card style (stars + a count) rather than plain text.
export default function StarRating({ average, count }) {
  const rounded = Math.round(average || 0);
  const stars = "★".repeat(rounded) + "☆".repeat(5 - rounded);
  return (
    <div className="rating">
      <span className="stars" style={{ fontSize: 15, cursor: "default" }}>
        {stars}
      </span>{" "}
      {count}
    </div>
  );
}
