import { router } from "expo-router";
import { useEffect, useState } from "react";
import { Body, Button, ErrorText, Field, Loading, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// He edits his own name and phone. Column grants (0002) allow only name, phone, email,
// and photo; pco_person_id is never his to set. Email is also his sign-in, so it is
// shown here but not changed.
export default function EditProfile() {
  const { state, retry } = useAuth();
  const me = state.status === "ready" ? state.session.user.id : null;
  const email = state.status === "ready" ? state.session.user.email : null;
  const [fullName, setFullName] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me) return;
    void (async () => {
      const { data, error: err } = await supabase.from("profiles").select("full_name, phone").eq("id", me).maybeSingle();
      if (err || !data) return setError("Could not load your profile. Check your connection and try again.");
      setFullName(data.full_name);
      setPhone(data.phone ?? "");
    })();
  }, [me]);

  if (!me) return null;
  if (fullName === null) return error ? <Screen><ErrorText>{error}</ErrorText></Screen> : <Loading />;

  async function save() {
    const name = fullName?.trim() ?? "";
    if (!name) return setError("Enter your name.");
    if (name.length > 100) return setError("Keep your name under 100 characters.");
    setBusy(true);
    setError(null);
    const { error: err } = await supabase.from("profiles")
      .update({ full_name: name, phone: phone.trim() || null })
      .eq("id", me!);
    if (err) {
      setBusy(false);
      return setError(err.message);
    }
    await retry();
    router.back();
  }

  return (
    <Screen>
      <Field label="Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" autoComplete="name" textContentType="name" />
      <Field label="Phone (optional)" hint="Your group can reach you here." value={phone}
        onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" textContentType="telephoneNumber" />
      {email ? <Body muted>Signed in as {email}</Body> : null}
      <ErrorText>{error}</ErrorText>
      <Button title="Save" onPress={save} busy={busy} />
    </Screen>
  );
}
