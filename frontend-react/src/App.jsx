import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import ForgotPassword from "./pages/ForgotPassword";
import Browse from "./pages/Browse";
import Recipe from "./pages/Recipe";
import Upload from "./pages/Upload";
import Profile from "./pages/Profile";
import Chat from "./pages/Chat";
import Messages from "./pages/Messages";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/browse" element={<Browse />} />
        <Route path="/recipe/:id" element={<Recipe />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/profile/:id" element={<Profile />} />
        <Route path="/messages" element={<Messages />} />
        <Route path="/chat/:userId" element={<Chat />} />
      </Routes>
    </BrowserRouter>
  );
}
