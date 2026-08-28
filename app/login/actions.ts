"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

function extractCredentials(formData: FormData) {
  return {
    email: String(formData.get("email") ?? ""),
    password: String(formData.get("password") ?? ""),
  };
}

export type AuthFormState = { error?: string; message?: string } | undefined;

export async function signIn(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = extractCredentials(formData);
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect("/dashboard");
}

export async function signUp(
  _prevState: AuthFormState,
  formData: FormData
): Promise<AuthFormState> {
  const { email, password } = extractCredentials(formData);
  const supabase = createClient();

  const { error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: error.message };

  return { message: "Check your email to confirm your account." };
}
