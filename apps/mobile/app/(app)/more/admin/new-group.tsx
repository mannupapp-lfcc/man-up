import { router } from "expo-router";
import { Body, Screen } from "@/components/ui";
import { GroupForm } from "@/components/GroupForm";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Ministry admins create a group, then add men and leaders on its page.
export default function NewGroup() {
  const { state } = useAuth();
  const ministryId = state.status === "ready" ? state.membership.ministryId : null;

  return (
    <Screen>
      <Body muted>After you create the group, add men and choose its leader and co-leader.</Body>
      <GroupForm
        submitLabel="Create group"
        onSubmit={async (values) => {
          if (!ministryId) return "Try again in a moment.";
          const { data, error } = await supabase.from("groups").insert({ ...values, ministry_id: ministryId }).select("id").single();
          if (error) return error.message;
          await supabase.rpc("generate_meetings", { p_ministry: ministryId });
          router.replace({ pathname: "/more/admin/[groupId]", params: { groupId: data.id } });
          return null;
        }}
      />
    </Screen>
  );
}
