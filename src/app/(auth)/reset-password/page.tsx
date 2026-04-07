"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [sessionValid, setSessionValid] = useState<boolean | null>(null);

  useEffect(() => {
    async function checkSession() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      setSessionValid(!!session);
    }
    checkSession();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });

    if (updateError) {
      setError(updateError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setTimeout(() => router.push("/login"), 3000);
  }

  // Loading state while checking session
  if (sessionValid === null) {
    return (
      <div className="text-center">
        <p className="text-sm text-text/60">Verifying reset link...</p>
      </div>
    );
  }

  // Invalid or expired reset link
  if (!sessionValid) {
    return (
      <>
        <h1 className="text-2xl font-bold text-text">Reset Password</h1>
        <div className="mt-4 rounded-lg bg-red-50 border border-red-200 px-3 py-3">
          <p className="text-sm text-red-700 font-medium">
            This reset link has expired or is invalid. Request a new one.
          </p>
        </div>
        <div className="mt-4 text-center">
          <Link
            href="/login"
            className="text-sm font-medium text-primary hover:text-primary-dark hover:underline"
          >
            Back to sign in
          </Link>
        </div>
      </>
    );
  }

  // Success state
  if (success) {
    return (
      <>
        <h1 className="text-2xl font-bold text-text">Reset Password</h1>
        <div className="mt-4 rounded-lg bg-green-50 border border-green-200 px-3 py-3">
          <p className="text-sm text-green-700 font-medium">
            Password updated. You can now sign in.
          </p>
          <p className="mt-1 text-xs text-green-600">
            Redirecting to sign in...
          </p>
        </div>
      </>
    );
  }

  // Password reset form
  return (
    <>
      <h1 className="text-2xl font-bold text-text">Reset Password</h1>
      <p className="mt-1 text-sm text-text/60">Enter your new password below.</p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="new-password" className="block text-sm font-medium text-text">
            New password
          </label>
          <input
            id="new-password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-text">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 block w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-text placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Confirm your password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Updating..." : "Update Password"}
        </button>
      </form>

      <div className="mt-4 text-center">
        <Link
          href="/login"
          className="text-sm font-medium text-primary hover:text-primary-dark hover:underline"
        >
          Back to sign in
        </Link>
      </div>
    </>
  );
}
