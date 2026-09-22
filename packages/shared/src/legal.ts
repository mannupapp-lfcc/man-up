// Community guidelines and privacy policy, shown in the app (Settings) and on the
// public admin site (/guidelines, /privacy; the store listings link there).
// One copy of the text so the two never drift. Plain ASCII, no em dashes.
//
// DRAFT: the privacy policy must be reviewed by Love First Christian Center before
// store submission, and CONTACT_EMAIL filled in (docs/backlog.md).

export type LegalDoc = { title: string; updated: string; intro: string; sections: { heading: string; paragraphs: string[] }[] };

export const CONTACT_EMAIL = "[contact email to be added]";

export const COMMUNITY_GUIDELINES: LegalDoc = {
  title: "Community Guidelines",
  updated: "September 22, 2026",
  intro:
    "Man Up is a place for men to grow in faith, pray for each other, and hold each other up. These guidelines keep it safe. By using the app you agree to them.",
  sections: [
    {
      heading: "Treat every man like a brother",
      paragraphs: [
        "Be honest and respectful. Disagree without tearing anyone down.",
        "No harassment, bullying, threats, or hate of any kind, including about race, ethnicity, religion, age, disability, or background.",
      ],
    },
    {
      heading: "Keep it clean",
      paragraphs: [
        "No sexual or explicit content, no graphic violence, and no content that promotes illegal activity.",
        "No spam, selling, or recruiting for outside causes.",
      ],
    },
    {
      heading: "What is shared in the group stays in the group",
      paragraphs: [
        "Do not screenshot, forward, or repeat another man's prayer requests, check-ins, or messages outside the group they were shared in.",
        "Do not post anyone's phone number, address, or other private information.",
      ],
    },
    {
      heading: "Report and block",
      paragraphs: [
        "Press and hold any message or prayer post to report it. Ministry admins review reports and remove anything that breaks these guidelines.",
        "You can block any man. You will stop seeing what he posts.",
        "There is no tolerance for objectionable content or abusive behavior. Admins remove content that breaks these guidelines and remove men who break them.",
      ],
    },
    {
      heading: "If someone is in danger",
      paragraphs: [
        "The app is not an emergency service. If you or someone else is in danger, call 911.",
        "If you are thinking about suicide or are in crisis, call or text 988 (Suicide and Crisis Lifeline, United States). Then tell your group leader.",
      ],
    },
  ],
};

export const PRIVACY_POLICY: LegalDoc = {
  title: "Privacy Policy",
  updated: "September 22, 2026",
  intro:
    "Man Up is the discipleship app of the Man Up Men's Ministry at Love First Christian Center. This policy explains what the app collects, who can see it, and how to delete it.",
  sections: [
    {
      heading: "What we collect",
      paragraphs: [
        "Your account: your name, email address, password (stored encrypted by our sign-in provider), and phone number if you choose to add one.",
        "What you post: group and ministry chat messages, prayer requests and responses, weekly check-ins, and lesson reflections.",
        "Your activity: group meeting attendance marked by your leader, lessons completed, serving, and contact logs your group leader records (the date and whether it was a call, text, or visit; never what was said).",
        "From Planning Center, the church's membership system: the Man Up roster and Saturday gathering check-ins. The app only reads this. It never writes to Planning Center, and your records are linked only after a ministry admin confirms the match.",
        "Your phone: a notification token so we can send you notifications, and crash reports that help us fix bugs. Crash reports do not include your messages or prayer requests.",
      ],
    },
    {
      heading: "How we use it",
      paragraphs: [
        "To run the app for you and your group: chat, prayer, meetings, courses, and notifications.",
        "To help leaders care for their men. Leaders see attendance and a simple activity level for the men in their group. You never see a score, and your check-in number, messages, prayer requests, and reflections are never used in any score, dashboard, or report.",
        "We do not sell your information, show you ads, or share your information with advertisers.",
      ],
    },
    {
      heading: "Who can see what",
      paragraphs: [
        "Group chat, group prayer requests, and weekly check-ins: only the men currently in your group, including your leader.",
        "Ministry chat and prayer requests you share with the whole ministry: every man in the ministry.",
        "Lesson reflections: only you.",
        "Ministry admins can see a group message or prayer post only when someone reports it, and then only that one item.",
        "The app shows the full details under Settings, What your leader sees.",
      ],
    },
    {
      heading: "Services we use",
      paragraphs: [
        "Supabase stores the app's data and handles sign-in. Expo delivers notifications through Apple and Google, so notification text passes through them. Sentry receives crash reports. Vercel hosts the admin website. Sanity stores course and gathering content written by the ministry (not your personal information).",
        "Your information is not sent to any other church system or third party.",
      ],
    },
    {
      heading: "Keeping and deleting your information",
      paragraphs: [
        "We keep your information while you have an account.",
        "You can delete your account at any time in the app: More, Settings, Delete account. This immediately deletes your account and everything you posted or that is about you, including your messages, prayer requests, check-ins, reflections, attendance, and scores. Attendance you marked for other men as a leader stays in their records without your name.",
      ],
    },
    {
      heading: "Who this app is for",
      paragraphs: ["Man Up is for adult men, 18 and older."],
    },
    {
      heading: "Changes and contact",
      paragraphs: [
        "If this policy changes, we will update it here and in the app, with a new date at the top.",
        `Questions or requests: ${CONTACT_EMAIL}.`,
      ],
    },
  ],
};
