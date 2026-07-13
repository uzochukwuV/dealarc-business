import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { loginAccount } from "@/lib/backend-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LogIn, Loader2 } from "lucide-react";
import AuthShell from "@/components/auth/AuthShell";

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await loginAccount({ email, password });
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message || "Invalid email or password");
      setLoading(false);
    }
  };

  return (
    <AuthShell
      eyebrow="SECURE ACCESS"
      title="Welcome back"
      subtitle="Sign in to resume your verified deal activity."
      footer={
        <>
          No organization yet?{" "}
          <Link to="/register" className="font-medium text-primary hover:underline">
            Request access
          </Link>
        </>
      }
    >
      {error && (
        <div className="mb-5 border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email" className="font-mono-tech text-foreground">
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-none border-foreground/20"
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password" className="font-mono-tech text-foreground">
            Password
          </Label>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-none border-foreground/20"
            required
          />
        </div>
        <Button
          type="submit"
          className="h-12 w-full rounded-none bg-primary font-medium hover:bg-primary/90"
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" />
              Sign in
            </>
          )}
        </Button>
      </form>
    </AuthShell>
  );
}
