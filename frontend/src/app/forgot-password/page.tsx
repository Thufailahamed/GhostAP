"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function ForgotPasswordPage() {
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-terminal-bg p-4">
      <div className="w-full max-w-md border-2 border-terminal-green bg-terminal-panel p-8">
        <h1 className="mb-2 text-3xl font-bold uppercase tracking-tight text-terminal-green">
          Reset Password
        </h1>

        {!submitted ? (
          <>
            <p className="mb-8 text-sm text-terminal-amber font-medium">
              Enter your email address to receive a secure reset link.
            </p>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-bold uppercase text-terminal-green">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="accountant@acme.com"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full text-lg uppercase font-bold tracking-wider mt-4"
              >
                Send Link
              </Button>
            </form>
          </>
        ) : (
          <div className="space-y-6 text-center py-4">
            <div className="inline-flex items-center justify-center w-16 h-16 border-2 border-terminal-green bg-terminal-green/10 text-terminal-green font-bold text-2xl mb-4">
              ✓
            </div>
            <p className="text-sm text-terminal-green font-bold uppercase">
              Check your inbox.
            </p>
            <p className="text-sm text-terminal-amber font-medium">
              We have sent a reset link to your email address.
            </p>
          </div>
        )}

        <div className="mt-8 pt-6 border-t-2 border-terminal-green text-center">
          <Link
            href="/"
            className="text-sm font-bold text-terminal-green uppercase hover:underline decoration-1 underline-offset-4"
          >
            ← Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}
