import Navbar from "./Navbar";
import Footer from "./Footer";

// Every page was independently wrapping itself in <><Navbar/>...<Footer/></> —
// same three lines copy-pasted nine times. This is the one place that
// pairing lives now.
export default function Layout({ children }) {
  return (
    <>
      <Navbar />
      {/* Grows to fill the viewport so the footer sits at the bottom on
          short pages instead of floating mid-screen. */}
      <div className="page-content">{children}</div>
      <Footer />
    </>
  );
}
