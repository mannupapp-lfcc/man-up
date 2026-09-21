import { Body, Card, Screen } from "@/components/ui";

// Required at launch (product map, section 2). Keep it exactly true to the RLS policies.
export default function WhatYourLeaderSees() {
  return (
    <Screen>
      <Card title="Your group leader sees">
        <Body>Whether you came to your group's meetings.</Body>
        <Body>How active you have been, as a simple level. Never a number, and never what you wrote.</Body>
      </Card>
      <Card title="Stays inside your group">
        <Body>Your group chat is seen only by the men in your group, including your leader.</Body>
        <Body>It never shows up on any dashboard or report.</Body>
      </Card>
      <Card title="Ministry chat: everyone">
        <Body>The ministry chat is seen by every man in the ministry, including leaders and admins.</Body>
        <Body>It never shows up on any dashboard or report.</Body>
      </Card>
      <Card title="Your prayer requests: you choose">
        <Body>Each time you share a request, you choose who sees it: just your group, or the whole ministry.</Body>
        <Body>Post anonymously and no one sees your name, whichever you choose.</Body>
        <Body>Prayer requests never show up on any dashboard or report.</Body>
      </Card>
      <Card title="Only you see">
        <Body>Your lesson reflections.</Body>
        <Body>Your own attendance record and your own progress.</Body>
      </Card>
      <Card title="The one exception">
        <Body>
          An admin can see a group prayer post or group chat message only if someone reports it. They see that one item,
          never the rest of the conversation.
        </Body>
      </Card>
    </Screen>
  );
}
