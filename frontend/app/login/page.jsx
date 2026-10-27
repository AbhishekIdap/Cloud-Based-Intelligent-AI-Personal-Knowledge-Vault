"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkle, Loader2, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="lg-auth-screen">
      <div className="lg-card lg-auth-card lg-fade-in">
        <div className="lg-brand" style={{ padding: "0 0 22px 0" }}>
          <div className="lg-brand-mark">
            <Sparkle size={17} color="#fff" />
          </div>
          <span className="lg-brand-name">LifeGraph</span>
        </div>
        <h2 className="lg-auth-title">Welcome back</h2>
        <p className="lg-auth-sub">Sign in to your vault.</p>

        {error && <div className="lg-auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="lg-field">
            <label className="lg-label">Email</label>
            <input
              className="lg-input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div className="lg-field">
            <label className="lg-label">Password</label>
            <input
              className="lg-input"
              type={showPassword ? "text" : "password"}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                marginTop: 8,
                padding: 0,
                background: "none",
                border: "none",
                cursor: "pointer",
                fontSize: 13,
                color: "inherit",
                opacity: 0.75,
              }}
            >
              {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              {showPassword ? "Hide password" : "Show password"}
            </button>
          </div>

          <button
            className="lg-btn lg-btn-accent"
            type="submit"
            disabled={loading}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {loading && <Loader2 size={15} className="lg-spin" />}
            Sign in
          </button>
        </form>

        <div className="lg-auth-footer">
          Don't have an account? <Link href="/signup">Create one</Link>
        </div>
      </div>
    </div>
  );
}
