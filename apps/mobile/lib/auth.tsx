import type { Session } from "@supabase/supabase-js";
import type { DbEnum } from "@manup/shared";
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { unregisterPush } from "./notifications";
import { supabase } from "./supabase";

export type Membership = {
  ministryId: string;
  ministryName: string;
  role: DbEnum<"ministry_role">;
};

export type AuthState =
  | { status: "loading" }
  | { status: "signedOut" }
  | { status: "offline" }
  // Signed in, but not (yet) a member of any ministry: pick one or enter a code.
  | { status: "needsMinistry"; session: Session; error?: string }
  | { status: "ready"; session: Session; fullName: string; membership: Membership };

// How a man joins: an open ministry as a member, or an invite code (which decides
// the ministry and role on the server).
export type JoinChoice = { ministryId: string } | { code: string };

type SignUpInput = { fullName: string; email: string; password: string; phone?: string; join: JoinChoice };

type AuthContextValue = {
  state: AuthState;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (input: SignUpInput) => Promise<string | null>;
  join: (fullName: string, join: JoinChoice, phone?: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  // Deletes his account and everything that is his (delete_my_account, 0015).
  deleteAccount: () => Promise<string | null>;
  retry: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

async function joinMinistry(fullName: string, join: JoinChoice, phone?: string) {
  const { error } =
    "code" in join
      ? await supabase.rpc("redeem_invite", { p_code: join.code, p_full_name: fullName, p_phone: phone })
      : await supabase.rpc("join_ministry", { p_ministry: join.ministryId, p_full_name: fullName, p_phone: phone });
  return error?.message ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: "loading" });
  // While signUp creates the account and joins, ignore auth events so the screen
  // does not switch to "needsMinistry" halfway through.
  const holdRef = useRef(false);

  const load = useCallback(async (session: Session | null, error?: string) => {
    if (!session) {
      setState({ status: "signedOut" });
      return;
    }
    const [membership, profile] = await Promise.all([
      supabase
        .from("ministry_members")
        .select("role, ministry_id, ministries(name)")
        .eq("profile_id", session.user.id)
        .is("left_at", null)
        .order("joined_at")
        .limit(1)
        .maybeSingle(),
      supabase.from("profiles").select("full_name").eq("id", session.user.id).maybeSingle(),
    ]);
    if (membership.error || profile.error) {
      setState({ status: "offline" });
      return;
    }
    if (!membership.data || !profile.data || !membership.data.ministries) {
      setState({ status: "needsMinistry", session, error });
      return;
    }
    setState({
      status: "ready",
      session,
      fullName: profile.data.full_name,
      membership: {
        ministryId: membership.data.ministry_id,
        ministryName: membership.data.ministries.name,
        role: membership.data.role,
      },
    });
  }, []);

  const reload = useCallback(
    async (error?: string) => {
      const { data } = await supabase.auth.getSession();
      await load(data.session, error);
    },
    [load],
  );

  useEffect(() => {
    void reload();
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (holdRef.current || event === "TOKEN_REFRESHED") return;
      // Do not await Supabase calls inside the callback (Supabase auth guidance).
      setTimeout(() => void load(session), 0);
    });
    return () => data.subscription.unsubscribe();
  }, [load, reload]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error?.message ?? null;
  }, []);

  const signUp = useCallback(
    async ({ fullName, email, password, phone, join }: SignUpInput) => {
      holdRef.current = true;
      let joinError: string | undefined;
      try {
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: { data: { full_name: fullName.trim() } },
        });
        if (error) return error.message;
        if (!data.session) return "Check your email to confirm your account, then sign in.";
        joinError = (await joinMinistry(fullName, join, phone)) ?? undefined;
        return null;
      } finally {
        holdRef.current = false;
        await reload(joinError);
      }
    },
    [reload],
  );

  const join = useCallback(
    async (fullName: string, choice: JoinChoice, phone?: string) => {
      const error = await joinMinistry(fullName, choice, phone);
      if (!error) await reload();
      return error;
    },
    [reload],
  );

  const signOut = useCallback(async () => {
    await unregisterPush().catch(() => undefined);
    await supabase.auth.signOut();
  }, []);

  const deleteAccount = useCallback(async () => {
    await unregisterPush().catch(() => undefined);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) return error.message;
    // The server session is gone with the account; clear this phone's copy.
    await supabase.auth.signOut({ scope: "local" });
    return null;
  }, []);

  return (
    <AuthContext.Provider value={{ state, signIn, signUp, join, signOut, deleteAccount, retry: () => reload() }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
