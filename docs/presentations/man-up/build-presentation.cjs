// Run: NODE_PATH=/tmp/manup-presentation-tools/node_modules node docs/presentations/man-up/build-presentation.cjs
const pptxgen = require('pptxgenjs');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const OUT = __dirname;
const ROOT = path.resolve(OUT, '../../..');
const pptx = new pptxgen();
pptx.layout = 'LAYOUT_WIDE';
pptx.author = 'Man Up · Love First Christian Center';
pptx.subject = 'Leader briefing and member feature walkthrough';
pptx.title = 'Man Up — Connected Between Saturdays';
pptx.company = 'Love First Christian Center';
pptx.lang = 'en-US';
pptx.theme = { headFontFace: 'Arial', bodyFontFace: 'Arial', lang: 'en-US' };
const C = { bg:'050B18', navy:'0A2A62', card:'0B1A3A', border:'1F3668', gold:'D4A034', white:'FFFFFF', muted:'A9B3C6', green:'6BCB8B', blue:'7FB2FF', red:'FF8A80' };
const W=13.333333, H=7.5;
let slides=[], s, svg=[], note=[], bounds=[];
const SCREENSHOTS = {
  8: [['1-home.png','Home'],['5-gatherings.png','Gatherings']],
  9: [['2-my-group.png','My Group']],
  11: [['3-pray.png','Prayer wall'],['4-share-request.png','Share a request']],
  13: [['6-serve.png','Serve & Events']],
};
function addScreenshots() {
  const images=SCREENSHOTS[slides.length+1];
  if(!images) return;
  const height=4.5, width=height*1290/2796;
  images.forEach(([file,label],i)=>{
    const x=images.length===1?9.25:8.24+i*2.34, y=2.28;
    const filePath=path.join(ROOT,'apps/mobile/store/ios-6.9',file);
    box(x-.035,y-.035,width+.07,height+.07,C.border);
    s.addImage({path:filePath,x,y,w:width,h:height});
    svg.push(`<image href="data:image/png;base64,${fs.readFileSync(filePath).toString('base64')}" x="${x*96}" y="${y*96}" width="${width*96}" height="${height*96}"/>`);
    text(label,x,6.82,width,.16,8,C.muted);
  });
}
const esc = t => String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function wrap(t, w, size) {
  const max = Math.floor(w*72/(size*.52));
  return String(t).split('\n').flatMap(p => {
    let result=[], line='';
    for(const word of p.split(' ')) { if(line && (line+' '+word).length>max) {result.push(line);line=word;} else line += (line?' ':'')+word; }
    result.push(line);return result;
  });
}
function box(x,y,w,h,fill=C.card,line=fill) {
  s.addShape(pptx.ShapeType.rect,{x,y,w,h,fill:{color:fill},line:{color:line,width:.7}});
  svg.push(`<rect x="${x*96}" y="${y*96}" width="${w*96}" height="${h*96}" fill="#${fill}" stroke="#${line}"/>`);
  bounds.push({x,y,w,h});
}
function text(t,x,y,w,h,size=20,color=C.white,bold=false) {
  const lines=wrap(t,w,size), value=lines.join('\n');
  s.addText(value,{x,y,w,h,fontFace:'Arial',fontSize:size,color,bold,margin:0,breakLine:false,vertAnchor:'top',paraSpaceAfter:0,lineSpacingMultiple:1.12,fit:'resize'});
  const lh=size/72*1.12;
  if(lines.length*lh>h+.12) throw new Error(`Text too tall: ${t} (${lines.length*lh} > ${h})`);
  svg.push(`<text fill="#${color}" font-family="Arial, sans-serif" font-size="${size*96/72}" font-weight="${bold?700:400}">${lines.map((l,i)=>`<tspan x="${x*96}" y="${(y+size/72*.92+i*lh)*96}">${esc(l)}</tspan>`).join('')}</text>`);
  bounds.push({x,y,w,h});
}
function start(section,title,sub) {
  s=pptx.addSlide();s.background={color:C.bg};svg=[`<rect width="1280" height="720" fill="#${C.bg}"/>`];bounds=[];
  box(.55,.5,.48,.045,C.gold);
  text(section.toUpperCase(),1.17,.38,10,.3,11,C.gold,true);
  text(title,.6,.96,12.05,.72,32,C.white,true);
  if(sub) text(sub,.62,1.86,SCREENSHOTS[slides.length+1]?7.3:11.9,.64,17,C.muted);
  box(.6,6.99,12.13,.012,C.border);
  text('MAN UP  /  LOVE FIRST CHRISTIAN CENTER',.62,7.12,10,.2,9,C.muted);
  text(String(slides.length+1).padStart(2,'0'),12.05,7.1,.65,.25,10,C.gold,true);
}
function end(notes,sources) {
  if(SCREENSHOTS[slides.length+1]) {
    addScreenshots();
    sources=[...sources,...SCREENSHOTS[slides.length+1].map(([file])=>'apps/mobile/store/ios-6.9/'+file)];
    notes+=' Screenshots are existing iPhone captures from the repository. Their dates, sample content, and displayed state reflect the captures, not a live demonstration or the current event schedule.';
  }
  const n=notes+'\n\nSource review: '+sources.join('; ')+'.\nBased on repository implementation reviewed November 2, 2026. Feature presence in source does not establish production availability.';
  s.addNotes(n);
  for(const b of bounds) if(b.x<0||b.y<0||b.x+b.w>W+.01||b.y+b.h>H+.01) throw Error('Out of slide bounds');
  slides.push({svg:`<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">${svg.join('')}</svg>`,title:s._slideNum,notes:n});
}
function cards(items,cols=3,y=2.85,h=3.5) {
  if(SCREENSHOTS[slides.length+1]) {
    items.forEach((a,i)=>{
      const top=2.83+i*1.16;
      box(.6,top,7.25,1.05);
      text(a[0],.8,top+.12,2.05,.25,9,C.gold,true);
      text(a[1],2.92,top+.1,4.7,.33,19,C.white,true);
      text(a[2],.8,top+.48,6.85,.51,14,C.muted);
    });
    return;
  }
  const gap=.22, width=(12.13-gap*(cols-1))/cols;
  items.forEach((a,i)=>{
    const x=.6+i*(width+gap);box(x,y,width,h);
    text(a[0],x+.23,y+.22,width-.46,.3,11,C.gold,true);
    text(a[1],x+.23,y+.78,width-.46,.77,23,C.white,true);
    text(a[2],x+.23,y+1.64,width-.46,h-1.84,17,C.muted);
  });
}
function banner(t) {
  const withScreens=!!SCREENSHOTS[slides.length+1];
  box(.6,6.42,withScreens?7.25:12.13,withScreens?.49:.37,C.navy);
  text(t,.77,withScreens?6.48:6.49,withScreens?6.9:11.8,withScreens?.37:.24,withScreens?10:11,C.white);
}
const mobile='apps/mobile/app/(app)/';

async function main(){
start('Leader briefing + member walkthrough','Connected between Saturdays.','The Man Up app · Love First Christian Center');
text('Build men of faith.\nDevelop leaders of purpose.',.65,2.9,7.1,1.55,34,C.white,true);
text('A practical home for brotherhood, prayer,\nlearning, serving, and the next step.',.65,4.88,7,1,22,C.muted);
text('LEADERS: 3–6    •    MEN: 7–16    •    ~12 MINUTES',.65,6.35,8,.3,11,C.gold,true);
const logo=path.join(ROOT,'apps/mobile/assets/logo.png');
s.addImage({path:logo,x:8.45,y:2.54,w:3.9,h:3.9});
const logoData=fs.readFileSync(logo).toString('base64');svg.push(`<image href="data:image/png;base64,${logoData}" x="811.2" y="243.84" width="374.4" height="374.4"/>`);
end('Opening, 30 seconds. The app helps men keep showing up and grow together between gatherings. Present the full deck to leaders. For the men, use slides 1–2 and 7–16. Slide 17 is an optional leadership appendix. This is a feature overview, not a statement that the app is already publicly released.','docs/product-map.md'.split('|'));

start('The purpose','Every man has a next step.','Building Godly Men. Strengthening Families. Transforming Communities.');
const steps=[['01','GATHER','Show up'],['02','CONNECT','Join a group'],['03','SERVE','Act together'],['04','GROW','Take a course'],['05','LEAD','Disciple others']];
steps.forEach((a,i)=>{const x=.6+i*2.46;box(x,3.05,2.29,2.47,i===4?C.navy:C.card);text(a[0],x+.2,3.28,1,.4,20,C.gold,true);text(a[1],x+.2,4.03,1.9,.4,19,C.white,true);text(a[2],x+.2,4.78,1.92,.45,16,C.muted);});
banner('Church Center handles registration and church operations. Man Up supports discipleship between gatherings.');
end('40 seconds. This is the ministry journey the app supports, rather than a set of requirements a man must complete in a fixed order. Leaders make placement and promotion decisions through relationships. Church Center remains the place for registration, payments, giving, and official church records.','docs/product-map.md'.split('|'));

start('For leaders · awareness','Know who needs a conversation.','My Group → Leader dashboard · visibility into the group you lead');
cards([['NOTICE','Engagement & trends','Thriving, Steady, Drifting, or Disconnected; a new-member period and downward-trend alerts.'],['REACH OUT','Needs a call','See who may need contact, tap to call, and track who has not been contacted in 30 days.'],['UNDERSTAND','Attendance & pulse','Review the last 8 marked meetings and the group’s weekly check-in average.']]);
banner('Activity signals guide a personal conversation. They do not measure a man’s faith.');
end('55 seconds. The leader dashboard is scoped to his group. It shows engagement tiers and trends, an attendance grid, Needs a Call, 30-day contact coverage, and group check-in averages. The Needs a Call list includes men flagged Disconnected or trending down for three weeks, with new-member and season-of-life protections. Dashboard labels are prompts for care, never a diagnosis. The leader is also a group member and can read group chat and check-ins there.',[mobile+'group/(leaders)/dashboard.tsx','apps/mobile/lib/scores.ts']);

start('For leaders · weekly rhythm','A few habits keep men connected.','Leader and co-leader tools help the group keep a steady rhythm.');
cards([['BEFORE THE MEETING','Prepare together','Review the meeting schedule, discussion questions, and check-ins. Scheduled reminders support the rhythm.'],['AFTER THE MEETING','Record attendance','Everyone starts as present. Adjust absent or excused men and save within 72 hours for the meeting to count as held.'],['BETWEEN MEETINGS','Follow through','Call, text, or meet a brother. Log the contact method. Use a season-of-life pause when he needs space.']]);
banner('Leaders can also claim a serve project for the group and confirm who participated.');
end('60 seconds. Meetings follow the configured group cadence. Attendance can still be recorded after 72 hours, but the meeting no longer counts as held for scoring. From Roster, leaders can call, text, or log an in-person visit; returning from a call or text prompts logging. No conversation notes are stored. Season pauses are 14, 30, or 60 days. Discussion questions are viewed here and authored through the content workflow; do not promise an in-app question editor. Scheduled leader digests and attendance prompts require push configuration. Co-leader permissions follow group assignment and backend policy.',[mobile+'group/(leaders)/attendance/[meetingId].tsx',mobile+'group/roster.tsx',mobile+'group/(leaders)/dashboard.tsx','apps/admin/src/lib/push/schedule.ts']);

start('For ministry admins','Care for the whole ministry.','Web administration, with group management and a health overview on mobile.');
cards([['PEOPLE & GROUPS','Connect every man','Place unassigned men, manage groups and meeting cadence, assign roles, and create invitation codes.'],['HEALTH & CARE','Support leaders','Review group health, risk triggers, leader consistency, season flags, and reported content.'],['CONTENT & CONNECTIONS','Keep it current','Publish teaching content, manage Planning Center connections, and tune engagement settings.']]);
banner('Health bands: Healthy / Watch / At Risk. Admins review reported items; group conversations stay in the group.');
end('55 seconds. The admin web includes Ministry health, Groups, People, Invitations, Reports, Content, Planning Center, and Scoring settings. Health shows group scores, risk triggers, weakest components, leader consistency, and season flags. The embedded content studio authors courses, lessons, gathering material, and weekly questions. Planning Center tools select source groups and relevant check-in events and serve signups, review syncs, and confirm people matches. Mobile admin supports placement, group management, and a glanceable health board. The automated leadership pipeline and progression funnel described in the product map are not presented as built here.',['apps/admin/src/components/AdminNav.tsx','apps/admin/src/app/(admin)/health/page.tsx',mobile+'more/admin/index.tsx','apps/admin/src/app/(admin)/pco/page.tsx']);

start('Trust · say this plainly','Who can see what?','A shared understanding helps men participate with confidence.');
const rows=[['Group chat & check-ins','Your group, including its leader.'],['Ministry chat','Every man in the ministry, including admins.'],['Prayer requests','Your chosen audience: group or ministry; optional anonymous posting.'],['Lesson reflections','Private to the man who wrote them.'],['Leader dashboard','Attendance and activity levels; group check-in averages.'],['Admin moderation','Reported group items become available for review.']];
rows.forEach((r,i)=>{const y=2.64+i*.57;box(.6,y,12.13,.5,i%2?C.bg:C.card);text(r[0],.82,y+.1,3.3,.3,15,C.gold,true);text(r[1],4.25,y+.1,8.1,.3,15,C.white);});
banner('Prayer and chat content do not appear in engagement dashboards. Check-in answers do not lower engagement.');
end('60 seconds. A leader sees group chat and individual check-ins because he belongs to that group. Admins do not gain general access to private group conversations; reported items are available for moderation. Ministry-wide prayer posts and ministry chat are visible ministry-wide by design. Anonymous prayer hides the displayed author name; avoid describing it as technically untraceable. Lesson reflections stay private. A prayer comment can identify its own author even on an anonymous request. The transparency screen is available under Settings → What your leader sees.',[mobile+'more/settings/leader-sees.tsx',mobile+'more/courses/[courseId]/[lessonId].tsx','packages/shared/src/score/index.ts']);

start('For the men · getting started','Create your account. Find your brothers.','Sign up, join the ministry, and let a leader help you connect to a group.');
cards([['01','Create an account','Enter your name, email, optional phone, and password. Review the community guidelines and privacy policy.'],['02','Join the ministry','Choose an available ministry or use the invitation code you receive.'],['03','Get connected','A ministry leader places you in a group. While you wait, you can use ministry chat and ministry-wide prayer.']]);
end('45 seconds. Do not promise an App Store download or share a QR code until the distribution link is confirmed. Sign-up captures the ministry choice or invite, and there is a recovery join screen if membership was not completed. Group placement is handled by ministry leadership. New men are not blocked from ministry chat or ministry-wide prayer while awaiting placement.', ['apps/mobile/app/(auth)/sign-up.tsx','apps/mobile/components/JoinChoicePicker.tsx','apps/mobile/app/join.tsx',mobile+'group/index.tsx']);

start('For the men · home + gatherings','Know what’s coming. Come prepared.','Home brings your next gathering, group connection, and growth actions together.');
cards([['HOME','Start here','See the next gathering and your next group meeting. Jump into ministry chat, prayer, courses, or serving.'],['GATHERINGS','Before you come','Find the date, time, location, topic, teacher, and preparation questions when published.'],['GATHERINGS','Take it with you','Read the recap and take-home questions when published. Open Church Center for event details and registration.']]);
end('45 seconds. Gathering scheduling comes from the connected source. Topic, teacher, preparation, recap, and take-home material appear only when published. There is no implemented “I’m coming” button on the reviewed gathering screen; do not present attendance intent as a current feature. Home links to courses, but does not currently display a personalized next-lesson card.',[mobile+'index.tsx',mobile+'gatherings/[gatheringId].tsx']);

start('For the men · my group','A place to belong all week.','My Group brings your meeting, brothers, and weekly conversation into one place.');
cards([['STAY CONNECTED','Meetings & roster','See your group’s meeting schedule, find the men in your group, and call a brother when a phone number is available.'],['COME READY','Weekly questions','Read the discussion questions for the week so the conversation can continue beyond the gathering.'],['BE HONEST','Weekly check-in','Choose how you’re doing on a 1–5 scale and add an optional note. Your group sees it and can respond with care.']]);
banner('You can also see your own recent attendance and meeting streak.');
end('45 seconds. Group size is intended to be about 4–8 men. Cadence is configurable, so avoid promising that every group meets weekly. Weekly check-ins are group-visible, not private messages to a leader. Members see their own attendance summary; the leader marks the group’s attendance.',[mobile+'group/index.tsx',mobile+'group/meetings.tsx',mobile+'group/roster.tsx',mobile+'group/checkin.tsx']);

start('For the men · conversations','Two conversations. One brotherhood.','Use the right space for the people you want to reach.');
cards([['MY GROUP → CHAT','Your group','Keep the conversation going with the men in your group. Share encouragement and stay connected between meetings.'],['HOME → MINISTRY CHAT','The whole ministry','Connect with every man, including brothers who have not yet joined a group. Use @ to mention someone.'],['ANNOUNCEMENTS','Hear what matters','Leaders can use @everyone for ministry announcements. Choose your message and announcement alerts in Settings.']]);
banner('Long-press another person’s message for safety actions, including report and block.');
end('45 seconds. Both chats support reporting and blocking through the safety menu. Ministry chat supports individual mentions. Ordinary leader posts do not automatically alert the whole ministry: @everyone is the explicit announcement action. All-message ministry chat pushes are optional and default off, whereas ministry announcements default on. Personal mentions are not muted by the in-app category settings, but phone notification permissions still apply.',[mobile+'group/chat.tsx',mobile+'group/ministry-chat.tsx',mobile+'more/settings/notifications.tsx','supabase/migrations/0013_chat_everyone_fix.sql']);

start('For the men · pray','Share a need. Stand with a brother.','Pray → share a request, pray for someone, or celebrate an answer.');
cards([['SHARE','Choose your audience','Post to your group or the whole ministry. Hide your displayed name with anonymous posting when you prefer.'],['SUPPORT','“I prayed” & comments','Tap “I prayed” and add encouragement in the comments. See how many brothers have prayed.'],['REMEMBER','Mark it answered','Add an optional testimony when God answers. You can change your request’s audience or delete your request.']]);
banner('Prayer stays within your ministry. Choose the audience before you post.');
end('45 seconds. Group visibility is the default for men who have a group; men without one can post ministry-wide. Request authors can change visibility, mark answered, and delete requests. Anonymous posting hides the request author’s name from the display; comments show their own authors. Requests and comments support reporting and blocking.',[mobile+'pray/new.tsx',mobile+'pray/[requestId].tsx','apps/mobile/components/PrayerCard.tsx']);

start('For the men · courses','Grow one lesson at a time.','More → Courses → choose a course → open a lesson');
cards([['LEARN','Watch & read','Follow the published lesson list. Open the video link, read the scripture, and work through the teaching.'],['REFLECT','Make it personal','Use the reflection questions and save your own written reflection. Your leader and admins cannot read it.'],['CONTINUE','Mark complete','Mark the lesson complete and return for the next one. Your completed lessons feed your progress view.']]);
banner('Course names and lesson availability depend on what ministry leadership publishes.');
end('40 seconds. The app currently opens the video URL rather than using an embedded player. Completion is manually marked; do not promise automatic video completion. Courses can be published through the content system. Stepping Up is a planned content example, not a guarantee that a specific course is populated or available in production.',[mobile+'more/courses/index.tsx',mobile+'more/courses/[courseId]/index.tsx',mobile+'more/courses/[courseId]/[lessonId].tsx']);

start('For the men · serve & events','Put your faith into action. Together.','More → Serve & Events → choose an opportunity');
cards([['DISCOVER','Find a way to serve','See relevant opportunities and events, with descriptions, timing, and signup links when available.'],['COMMIT','Join your group','A leader can claim a project for your group. Tap “I’m in” to join your brothers.'],['FOLLOW THROUGH','Register & serve','Complete the Church Center signup when required. Your leader confirms who served after the group project.']]);
banner('“I’m in” joins the group’s plan. Complete the separate Church Center registration when required.');
end('45 seconds. Group claims and opt-ins coordinate participation; they do not replace official registration. Leaders can confirm exactly which men served. The connected Planning Center setup can also supply qualifying serve activity. The content and setup determine which opportunities appear.',[mobile+'more/serve/[opportunityId].tsx','apps/mobile/lib/serve.ts','apps/admin/src/app/(admin)/pco/page.tsx']);

start('For the men · my progress','See your journey through LEAD.','More → My Progress · encouragement and a next step for your own journey');
const lead=[['L','Learn God’s Word','Lessons completed and recent gathering attendance.'],['E','Encourage one another','Your group meetings attended in the last 90 days.'],['A','Act with integrity','Your confirmed times serving.'],['D','Disciple future leaders','A conversation with your leader about co-leading.']];
lead.forEach((a,i)=>{const x=.6+(i%2)*6.18,y=2.73+Math.floor(i/2)*1.72;box(x,y,5.95,1.5);text(a[0],x+.2,y+.28,.65,.7,36,C.gold,true);text(a[1],x+1,y+.2,4.7,.4,20,C.white,true);text(a[2],x+1,y+.77,4.65,.6,16,C.muted);});
end('45 seconds. The current screen shows completed lessons, gatherings attended over 90 days, group meetings over 90 days, and times served, plus a next-step message. The D section points to a conversation about co-leading. It does not currently contain a full automated apprenticeship milestone tracker. No peer leaderboard is displayed. Leaders separately see attendance and engagement tiers for their own men.',[mobile+'more/progress.tsx']);

start('For the men · settings + control','Make the app work for you.','More → Settings');
cards([['YOUR ACCOUNT','Keep it current','Edit your name and phone, sign out, or delete your account from inside the app.'],['YOUR ALERTS','Choose your rhythm','Choose chat and announcement alerts, meeting reminders, weekly questions, and check-in prompts.'],['YOUR TRUST','Know your options','Read “What your leader sees,” the privacy policy, and community guidelines. Review and unblock blocked men.']]);
banner('Mentions have their own alert behavior. Phone settings still control whether notifications can arrive.');
end('40 seconds. Profile editing currently covers name and phone, not changing the sign-in email. The blocked list supports unblocking. In-app account deletion is implemented, but the production function and credentials must be configured and verified. Settings contains six notification categories. Mentions and required leader prompts do not follow all optional category toggles; device permissions still apply.',[mobile+'more/settings/index.tsx',mobile+'more/settings/profile.tsx',mobile+'more/settings/notifications.tsx',mobile+'more/settings/blocked.tsx',mobile+'more/settings/delete-account.tsx']);

start('The invitation','Keep showing up. Grow together.','Use one small action to take your next step this week.');
cards([['MEN','Connect & participate','Check your next meeting. Say hello in chat. Share a check-in, pray for a brother, and choose a lesson or serve opportunity.'],['GROUP LEADERS','Notice & follow through','Keep attendance current. Reach out personally. Log the contact and help a brother take his next step.'],['MINISTRY LEADERS','Make room for growth','Place new men, support group leaders, publish useful content, and confirm launch readiness before inviting everyone.']]);
banner('“As iron sharpens iron, so one person sharpens another.”  Proverbs 27:17');
end('40 seconds. Close by inviting one practical action, then take questions. Before delivering this presentation, replace verbal download instructions with the actual approved distribution process. No release date, download URL, live metrics, or actual member names have been invented in this deck. If leaders ask about release readiness, use the optional appendix.', ['docs/product-map.md','docs/backlog.md']);

start('Appendix · leaders only','What’s built, what needs confirming.','Feature overview based on repository review · November 2, 2026');
cards([['IMPLEMENTED IN SOURCE','Core experience','Groups, chat, check-ins, prayer, gatherings, courses, serving, progress, leader tools, admin tools, and account controls.'],['BEFORE A PUBLIC LAUNCH','Confirm readiness','Verify database changes, push credentials, content and church connections, privacy review, pilot testing, and distribution.'],['PLANNED / NOT PRESENTED AS LIVE','Future additions','Roster-change approval requests, embedded lesson video, full D-step milestones, leader pipeline, and progression funnel.']]);
banner('A feature in the code is not proof that its production configuration or launch approval is complete.');
end('Optional, 60 seconds. Repository documentation includes outstanding setup tasks; this deck does not audit a live deployment. Confirm migration state against current code because the backlog’s applied-version notes may lag later migrations. Push delivery requires production credentials and schedules; course and gathering content must be populated; Planning Center sources and matching must be configured. Review privacy copy, validate account deletion and moderation in a pilot, and confirm distribution. The product map includes future conveniences such as offline attendance and QR self-check-in; they are not demonstrated or promised here. Roster-change request approvals and embedded video are explicit backlog items.',['docs/backlog.md','docs/product-map.md']);

await pptx.writeFile({fileName:path.join(OUT,'Man-Up-App-Overview.pptx'),compression:true});
let md='# Man Up app presentation\n\nUse the full main deck (slides 1–16) for a roughly 12-minute overview. For members, use slides 1–2 and 7–16. Slides 3–6 explain the leadership tools. Slide 17 is an optional launch-readiness appendix. Presenter notes are also embedded in the PowerPoint.\n\nSlides 8, 9, 11, and 13 include six existing iPhone screenshots: Home, Gatherings, My Group, Prayer, Share a Request, and Serve & Events. Dates and sample content reflect the original captures, not the current schedule.\n\nAll slides use editable PowerPoint text and shapes, plus the existing ministry logo and app screenshots. No credentials are included. The preview is a layout proof generated from the same content and positions; PowerPoint may render fonts slightly differently.\n\n';
for(let i=0;i<slides.length;i++) md+=`## Slide ${i+1}\n\n${slides[i].notes}\n\n`;
fs.writeFileSync(path.join(OUT,'Presenter-Notes.md'),md);
const thumbs=[];
for(let i=0;i<slides.length;i++) {
  const png=await sharp(Buffer.from(slides[i].svg)).resize(640,360).png().toBuffer();
  thumbs.push({input:png,left:(i%3)*640,top:Math.floor(i/3)*360});
}
await sharp({create:{width:1920,height:Math.ceil(slides.length/3)*360,channels:3,background:'#050B18'}}).composite(thumbs).png().toFile(path.join(OUT,'Slide-Preview.png'));
console.log(`Created ${slides.length} slides, embedded notes, presenter guide, and slide preview.`);
}
main().catch(e=>{console.error(e);process.exit(1)});
