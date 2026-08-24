"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkle, Loader2 } from "lucide-react";
import { useAuth } from "../../lib/auth-context";

export default function SignupPage() {
  const { signup } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signup(name, email, password);
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
        <h2 className="lg-auth-title">Create your vault</h2>
        <p className="lg-auth-sub">Every file, note, and memory — organized automatically.</p>

        {error && <div className="lg-auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="lg-field">
            <label className="lg-label">Name</label>
            <input className="lg-input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Jordan Rao" />
          </div>
          <div className="lg-field">
            <label className="lg-label">Email</label>
            <input className="lg-input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="lg-field">
            <label className="lg-label">Password</label>
            <input className="lg-input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
          </div>
          <button className="lg-btn lg-btn-accent" type="submit" disabled={loading} style={{ width: "100%", justifyContent: "center" }}>
            {loading && <Loader2 size={15} className="lg-spin" />}
            Create account
          </button>
        </form>

        <div className="lg-auth-footer">
          Already have an account? <Link href="/login">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
