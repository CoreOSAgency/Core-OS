"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { signIn, signUp, type AuthFormState } from "./actions";

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-core-purple px-4 py-2.5 font-medium text-[#111214] transition hover:bg-core-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {pending ? "Please wait…" : label}
    </button>
  );
}

export default function LoginForm() {
  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const action = mode === "sign-in" ? signIn : signUp;
  const [state, formAction] = useFormState<AuthFormState, FormData>(
    action,
    undefined
  );

  return (
    <div className="w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-core-card/80 shadow-xl">
      <div className="sunbird-band h-1 w-full" />
      <div className="p-8">
      <h1 className="text-xl font-semibold text-neutral-100">
        {mode === "sign-in" ? "Sign in to CoreOS" : "Create your CoreOS account"}
      </h1>
      <p className="mt-1 text-sm text-neutral-400">
        {mode === "sign-in"
          ? "Welcome back. Enter your details to continue."
          : "Set up access for your agency."}
      </p>

      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label htmlFor="email" className="mb-1 block text-sm text-neutral-300">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="w-full rounded-lg border border-neutral-700 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple"
            placeholder="you@agency.com"
          />
        </div>
        <div>
          <label htmlFor="password" className="mb-1 block text-sm text-neutral-300">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
            className="w-full rounded-lg border border-neutral-700 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple"
            placeholder="••••••••"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-core-scarlet">{state.error}</p>
        )}
        {state?.message && (
          <p className="text-sm text-core-green">{state.message}</p>
        )}

        <SubmitButton label={mode === "sign-in" ? "Sign in" : "Sign up"} />
      </form>

      <button
        type="button"
        onClick={() => setMode(mode === "sign-in" ? "sign-up" : "sign-in")}
        className="mt-4 w-full text-center text-sm text-neutral-400 hover:text-neutral-200"
      >
        {mode === "sign-in"
          ? "Don't have an account? Sign up"
          : "Already have an account? Sign in"}
      </button>
      </div>
    </div>
  );
}
