import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
      <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-brand-700 text-lg">
          <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center">WS</span>
          WhySo
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-600 hidden sm:block">Hi, {user?.name}</span>
          <button
            className="btn btn-secondary text-sm"
            onClick={() => {
              logout();
              navigate("/login");
            }}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}