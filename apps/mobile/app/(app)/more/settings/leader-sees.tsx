import { useEffect, useState } from "react";
import { Body, Card, Screen } from "@/components/ui";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Required at launch (product map, section 2). Keep it exactly true to the RLS policies.
export default function WhatYourLeaderSees() {
  const { state } = useAuth();
  const ministryId = state.status === "ready" ? state.membership.ministryId : null;
  const [overseers, setOverseers] = useState<string[] | null>(null);
  useEffect(() => {
    if (!ministryId) return;
    void supabase.rpc("ministry_overseers", { p_ministry: ministryId }).then(({ data }) => setOverseers((data ?? []).map((o) => o.full_name)));
  }, [ministryId]);

  return (
    <Screen>
      <Card title="Your group leader sees">
        <Body>Whether you came to your group's meetings.</Body>
        <Body>How active you have been, as a simple level. Never a number, and never what you wrote.</Body>
      </Card>
      <Card title="Stays inside your group">
        <Body>Your group chat is seen by the men in your group, including your leader, and by the ministry overseers (below).</Body>
        <Body>It never shows up on any dashboard or report.</Body>
      </Card>
      <Card title="Your weekly check-in: your group">
        <Body>Your 1 to 5 answer and note are seen by the men in your group, including your leader, and by the ministry overseers.</Body>
        <Body>Your leader also sees the average for the group, week by week. Your number never counts against you, and it never shows up outside your group.</Body>
      </Card>
      <Card title="Ministry chat: everyone">
        <Body>The ministry chat is seen by every man in the ministry, including leaders and admins.</Body>
        <Body>It never shows up on any dashboard or report.</Body>
      </Card>
      <Card title="Your prayer requests: you choose">
        <Body>Each time you share a request, you choose who sees it: just your group, or the whole ministry.</Body>
        <Body>A group request is also seen by the ministry overseers.</Body>
        <Body>Post anonymously and no one sees your name, whichever you choose. That includes the overseers.</Body>
        <Body>Prayer requests never show up on any dashboard or report.</Body>
      </Card>
      <Card title="Ministry overseers">
        <Body>
          {overseers === null ? "Loading..." : overseers.length
            ? `${overseers.join(" and ")} ${overseers.length === 1 ? "oversees" : "oversee"} the whole ministry.`
            : "This ministry has no overseers right now."}
        </Body>
        <Body>
          Overseers are the pastors over the whole ministry. They can read every group's chat, group prayer requests and
          responses, weekly check-ins with notes, and when your leader last contacted you (never what was said). They read
          only and never post in your group. They never see your lesson reflections or who wrote an anonymous request.
        </Body>
      </Card>
      <Card title="Only you see">
        <Body>Your lesson reflections.</Body>
        <Body>Your own attendance record and your own progress.</Body>
      </Card>
      <Card title="The one exception">
        <Body>
          Any other admin can see a group prayer post or group chat message only if someone reports it. They see that one item,
          never the rest of the conversation.
        </Body>
      </Card>
    </Screen>
  );
}
