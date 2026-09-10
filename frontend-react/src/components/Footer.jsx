import { Link } from "react-router-dom";

export default function Footer() {
  return (
    <footer>
      <div>
        <h3>Contact Us</h3>
        <div>Contact Info: +91 1234567890</div>
        <div>+91 0987654321</div>
      </div>
      <Link to="/about">Learn More About Us</Link>
    </footer>
  );
}
