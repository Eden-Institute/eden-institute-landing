// @ts-nocheck
/* eslint-disable */
// Eden Ad Studio core. Ported from the standalone artifact build (2026-07-17).
// Vanilla DOM app mounted by StudioPage.tsx; all queries and listeners are
// rooted on the container so unmount fully tears it down.

export function initStudio(root: HTMLElement): () => void {
  "use strict";
  /* ───────────────────────── DATA ───────────────────────── */

  const ANGLES = {
    children:   {name:"Teach Your Children", visual:"A child's hands and a parent's hands over a mortar and pestle at a wooden table. Natural light, linen, one green herb bundle. Overlay the hook in Cinzel over Warm Linen."},
    openandgo:  {name:"Open and Go",         visual:"The Teacher's Guide open on a breakfast table beside a coffee cup, soft morning light. Calm, uncluttered, real kitchen."},
    esa:        {name:"ESA Funded",          visual:"Kit flat-lay: guide, notebook, and cards fanned on linen. Small amber caption chip: Approved Louisiana GATOR vendor."},
    grandmother:{name:"Grandmother Knew",    visual:"Weathered hands passing a dried herb bundle to young hands. Warm, low, golden light. No faces needed."},
    preorder:   {name:"Founding Families",   visual:"Hero shot of the boxed kit on parchment with fresh sprigs. Golden Amber banner strip with the date."},
    heritage:   {name:"Heritage, Not Witchcraft", visual:"A vintage botanical plate beside an open Bible with pressed herbs. Deep Forest ground, engraved feel."},
    twoam:      {name:"The 2AM Mom",         visual:"A dim kitchen with one warm lamp, chamomile tea steeping, phone face-down. Quiet and reassuring."},
    design:     {name:"Design, Not Guesswork", visual:"Split botanical illustration: plant anatomy beside a human silhouette pattern. Engraved lines on Warm Linen."},
    steward:    {name:"Stewardship as Worship", visual:"Open Bible with herb bundles and a garden trowel in morning window light."},
    origin:     {name:"The Founder's Story", visual:"Camila at a workbench with jars and open books, natural light, handwritten-letter feel. No studio gloss."},
    exhausted:  {name:"The Herbs Didn't Work", visual:"A shelf of half-used tincture bottles with one fresh sprig in sharp focus in front. Clutter behind, clarity in front."},
    notworkshop:{name:"Not a Weekend Workshop", visual:"Stacked curriculum volumes, citation pages, and brass instruments. Library mood, deep greens."}
  };

  const AUDIENCES = {
    homeschool: {name:"Homeschool Mom", note:"<b>Women 27 to 45.</b> Interests: homeschooling, Charlotte Mason, Wild + Free, The Good and the Beautiful. Pairs best with the Teach Your Children and Open and Go angles."},
    esa:        {name:"ESA Parent", note:"<b>Geo-target by program.</b> Louisiana (GATOR, approved) first; FL, AZ, TX, NH, AR as programs open. Interests: school choice, education savings accounts, co-ops. Pair with the ESA Funded angle."},
    mom2am:     {name:"The 2AM Mom", note:"<b>Women 25 to 44.</b> Interests: Christian parenting, natural living, motherhood. Keep copy about learning and confidence, never about her child's symptoms."},
    hesitant:   {name:"The Hesitant Christian", note:"<b>Faith interests plus natural health.</b> Great fit for the Heritage angle. Lookalike audiences built on quiz completions work well here."},
    exhausted:  {name:"Exhausted Herbal Consumer", note:"<b>Interests: herbalism, tinctures, holistic health.</b> Retarget site visitors and quiz takers. Pair with The Herbs Didn't Work and Design angles."},
    practitioner:{name:"Aspiring Practitioner", note:"<b>Interests: clinical herbalism, materia medica, herbal certification.</b> Retarget Foundations students. Pair with Not a Weekend Workshop."}
  };

  const OBJECTIVES = {
    awareness:{name:"Awareness"}, traffic:{name:"Traffic"}, leads:{name:"Leads"}, sales:{name:"Sales"}
  };

  const FORMATS = {
    portrait:{name:"Feed 4:5", ratio:"r45", spec:"1080 × 1350 px · the best mobile-feed default", label:"4:5 · 1080×1350"},
    feed:    {name:"Feed 1:1", ratio:"r11", spec:"1080 × 1080 px · square, works everywhere", label:"1:1 · 1080×1080"},
    story:   {name:"Story / Reel 9:16", ratio:"r916", spec:"1080 × 1920 px · keep text in the center safe zone; the image carries the hook, primary text stays short", label:"9:16 · 1080×1920"},
    carousel:{name:"Carousel", ratio:"r11", spec:"2 to 10 cards at 1080 × 1080 px, one headline per card. Use the 12-line slide copy rhythm from the library, one declarative line per card", label:"Carousel · 1:1 cards"}
  };

  const PRODUCTS = {
    kit:{
      name:"Eden's Table · Curriculum Kit",
      tag:"$249 founders",
      facts:"36-week K-5 herbalism curriculum · Sprouts (K-2) + Seedlings (Gr 3-5) · first 500 kits $249 Founders price, then $349 retail automatically · notebooks $19 · preorder opens July 29",
      url:"https://edeninstitute.health/homeschool",
      campaign:"edens_table_kit",
      angles:["children","openandgo","esa","preorder","grandmother","heritage","twoam"],
      ctas:{awareness:"Learn More",traffic:"Learn More",leads:"Sign Up",sales:"Shop Now"},
      headlines:["Eden's Table: Herbalism for Kids","36 Weeks. One Herb at a Time.","Biblical Herbalism for K-5","The Garden Joins Homeschool","Preorder Opens July 29","First 500 Kits: $249","A Year at Eden's Table"],
      descs:["First 500 kits at $249.","Sprouts K-2. Seedlings 3-5.","Screen-free. Faith-first.","Everything boxed and ready."],
      primaries:{
        children:[
  "They won't learn this in school. That was never the plan anyway.\n\nEden's Table is a 36-week herbalism curriculum for homeschool families. Your children learn the herbs God planted, one week at a time. Real plants on the table, Scripture at the center, and a notebook that fills up in their own handwriting.\n\nSprouts for K-2. Seedlings for grades 3-5. One table for the whole family. 🌿",
  "Raise children who reach for the garden before the cabinet.\n\nEvery week at Eden's Table, your kids meet one herb. They smell it, taste it, draw it, and learn what it does and Who made it. By spring they know 36 plants by name. Most adults can't name five.\n\nA full year of biblical herbalism for K-5, taught at your own kitchen table.",
  "Your children can grow up knowing what God planted.\n\nEden's Table pairs science and Scripture in a 36-week homeschool curriculum: hands-on herb studies, copywork, recipes, field cards, and read-aloud stories. No screens required. No prior herb knowledge required either.\n\nSprouts for K-2 and Seedlings for grades 3-5."
        ],
        openandgo:[
  "Open the guide. Read the day. You just taught herbalism.\n\nEden's Table was built for real homeschool mornings. Every day is scripted in the Teacher's Guide, most lessons run about 20 minutes, and the whole week centers on one herb. You don't need to know herbalism to teach it. The guide carries you.\n\n36 weeks. K-5. One table. 🌿",
  "You don't need another curriculum that needs you to hold it together.\n\nEden's Table arrives with a day-by-day Teacher's Guide, student notebooks, recipe cards, field cards, and discussion cards. Pick it up Monday morning and go. Science, Scripture, and handwriting practice are already woven in.\n\nMade by a homeschool family, for homeschool tables."
        ],
        esa:[
  "Your education savings account can cover this.\n\nEden's Table is a complete 36-week herbalism curriculum for K-5, and The Eden Institute is an approved vendor with Louisiana's GATOR program, with more states in review.\n\nScience, Scripture, and a year of hands-on learning, funded the way curriculum should be. 🌿",
  "Homeschooling on an ESA? Put those funds toward a curriculum your kids will ask to do.\n\nEden's Table teaches one herb a week for 36 weeks: botany, copywork, recipes, and read-alouds, all grounded in Scripture. Approved with Louisiana GATOR. Ask us about your state."
        ],
        preorder:[
  "Preorders open July 29.\n\nEden's Table is a 36-week biblical herbalism curriculum for K-5: Teacher's Guide, student notebook, recipe cards, field cards, discussion cards, and a storybook, boxed and ready for your fall term.\n\nThe first 500 kits sell at the Founders price of $249; after the 500th kit, the price moves to $349 retail, automatically. Extra student notebooks are $19 for siblings. 🌿",
  "This fall, herbalism joins the homeschool schedule.\n\nThe Eden's Table curriculum kit arrives with everything a K-5 family needs for 36 weeks: a daily Teacher's Guide, hands-on activities, recipes, stories, and Scripture woven through every week.\n\nPreorder opens July 29. The first 500 kits are $249, then the price moves to $349 retail."
        ],
        grandmother:[
  "Your grandmother learned herbs at her mother's table. Somewhere along the way, the chain broke.\n\nEden's Table helps your family pick it back up. One herb a week, 36 weeks a year, taught right where you eat breakfast. Your children will know which leaf to steep, and Who made it grow.\n\nThat knowledge was never lost. It was waiting for a table.",
  "Some inheritances are money. This one is knowledge.\n\nEden's Table is a 36-week homeschool curriculum that hands your children the plant wisdom their great-grandmothers carried, rebuilt on Scripture and taught with real herbs in hand.\n\nSprouts for K-2, Seedlings for grades 3-5. 🌿"
        ],
        heritage:[
  "Someone told you herbs were witchcraft, and it kept your family away from something God planted.\n\nEden's Table teaches herbalism the way it began: in a garden, with its Maker named. Your children learn real botany and real Scripture side by side, one herb a week for 36 weeks.\n\nThis is heritage, not superstition. Come learn it without fear."
        ],
        twoam:[
  "You know the 2AM feeling. A warm little forehead, and a phone full of contradicting answers.\n\nWhat if your whole family understood the basics instead? Eden's Table teaches children, and their parents, how God designed plants and bodies to work. One herb a week, all year long.\n\nConfidence starts at the table, not the search bar."
        ]
      }
    },

    course:{
      name:"Back to Eden: Foundations",
      tag:"$97 founding",
      facts:"Tier 1 online course + companion book · founding price $97 through Jan 1, 2027 · checkout at learn.edeninstitute.health",
      url:"https://edeninstitute.health",
      campaign:"foundations_course",
      angles:["design","exhausted","twoam","heritage","steward","origin"],
      ctas:{awareness:"Learn More",traffic:"Learn More",leads:"Sign Up",sales:"Get Offer"},
      headlines:["Back to Eden: Foundations","Herbalism With Roots","A Biblical Health Framework","Founding Price: $97","Original Medicine, Not Fringe"],
      descs:["10 lessons. Founding $97.","Scripture is the lens.","$97 through Jan 1, 2027.","Learn the framework."],
      primaries:{
        design:[
  "Herbalism isn't guesswork. It's design, applied correctly.\n\nGod made every body with a pattern, and every plant with a purpose. Most programs teach symptoms. Back to Eden teaches constitutions, tissue states, and terrain, so the plant finally matches the person.\n\nThe Foundations course is open at the founding price of $97. 🌿",
  "Why did that herb work for your friend and do nothing for you?\n\nBecause God didn't make every body the same, and nobody taught you the framework. Back to Eden: Foundations starts where other programs skip: constitution, terrain, and the biblical worldview underneath it all.\n\nFounding price $97 through January 1."
        ],
        exhausted:[
  "You tried the herb. It didn't work. So you decided herbs don't work.\n\nBut you were using plants like pills, and that was never herbalism. When you learn to match the person to the plant, constitution, tissue state, and terrain, everything changes.\n\nBack to Eden: Foundations teaches you how. Founding price $97."
        ],
        twoam:[
  "It's 2AM. Your child has a fever, and every link says something different.\n\nYou were never taught how to think about the body, only how to worry about it. Back to Eden: Foundations gives you a biblical framework for health, so you can respond with discernment instead of fear.\n\n10 lessons. Founding price $97. 🌿"
        ],
        heritage:[
  "Christians practiced herbal medicine for 2,000 years. We just forgot.\n\nMonks, physicians, missionaries, reformers. This tradition was never borrowed from anyone; it is your own inheritance. Back to Eden: Foundations returns it, grounded in Scripture and taught with clinical clarity.\n\nCome learn it without fear. Founding price $97."
        ],
        steward:[
  "Stewardship isn't passive. It's study, discipline, and preparation.\n\nGod gave you a body, a garden, and a mind to learn with. Back to Eden: Foundations teaches you to steward all three: ten lessons of biblical herbalism, from worldview to practice.\n\nFaithful stewardship is educated stewardship. Founding price $97."
        ],
        origin:[
  "I didn't start studying herbs because I wanted to. I started because nothing else made sense.\n\nEvery course I found asked me to check my faith at the door to learn about what God made. So I stopped looking for the right course, and started building it.\n\nBack to Eden: Foundations is that course. Founding price $97.\n\nCamila · The Eden Institute 🌿"
        ]
      }
    },

    quiz:{
      name:"Constitutional Quiz",
      tag:"free · lead gen",
      facts:"Free two-minute quiz · the primary lead magnet · feeds the nurture sequence",
      url:"https://edeninstitute.health/quiz",
      campaign:"quiz",
      angles:["design","twoam","steward"],
      ctas:{awareness:"Learn More",traffic:"Learn More",leads:"Sign Up",sales:"Sign Up"},
      headlines:["What's Your Constitution?","Free 2-Minute Quiz","How Did God Design Your Body?"],
      descs:["Free. Two minutes.","Find your pattern.","No cost, no catch."],
      primaries:{
        design:[
  "You run hot. She runs cold. Coffee wrecks you and fuels your husband.\n\nIt's not random. It's design. God didn't make every body the same, so why would every remedy be the same?\n\nTake the free Constitutional Quiz and find out how yours was made. Two minutes, no cost. 🌿",
  "You have a constitution. You just don't know what it is yet.\n\nIt's why the same herb works for your neighbor and does nothing for you. The free Constitutional Quiz shows you the pattern God built into your body, in about two minutes."
        ],
        twoam:[
  "Before you learn a single herb, learn your own design.\n\nThe free Constitutional Quiz from The Eden Institute takes about two minutes and shows you how your body runs, hot or cold, dry or damp, and what that means for how you steward it. 🌿"
        ],
        steward:[
  "Stewardship begins with knowing what you've been given.\n\nGod designed your body with a particular constitution. The free two-minute quiz from The Eden Institute helps you name it, so you can steward it with discernment instead of guesswork."
        ]
      }
    },

    apothecary:{
      name:"The Eden Apothecary",
      tag:"membership",
      facts:"Digital Materia Medica · 300 herb monographs, four lenses plus pattern lens · edeninstitute.health/apothecary",
      url:"https://edeninstitute.health/apothecary",
      campaign:"apothecary",
      angles:["exhausted","design","notworkshop"],
      ctas:{awareness:"Learn More",traffic:"Learn More",leads:"Sign Up",sales:"Subscribe"},
      headlines:["The Eden Apothecary","300 Herbs, Four Lenses","A Living Materia Medica"],
      descs:["300 monographs and growing.","Study before you shop.","Membership at Eden."],
      primaries:{
        exhausted:[
  "Stop buying herbs the way you buy supplements.\n\nThe Eden Apothecary is a living Materia Medica: 300 herbs, each studied through history, science, energetics, and Scripture, so you understand the plant before it ever reaches your shelf.\n\nMembership is open at edeninstitute.health/apothecary. 🌿"
        ],
        design:[
  "Every plant carries a pattern. The Eden Apothecary teaches you to read it.\n\n300 herb monographs, each written through four lenses: traditional use, modern research, energetics, and biblical context, cross-referenced by constitution and tissue state.\n\nA reference built for stewards, not shoppers."
        ],
        notworkshop:[
  "Not a blog. Not a Pinterest board. A Materia Medica.\n\nThe Eden Apothecary holds 300 clinically literate herb monographs, cross-referenced by constitution, tissue state, and pattern, and grounded in a biblical worldview.\n\nDepth on your shelf, every day. Membership is open now."
        ]
      }
    },

    practitioner:{
      name:"Practitioner Program",
      tag:"$49.99/mo founding",
      facts:"Founding rate $49.99/mo or $499/yr · launched July 2026 · verify landing path before publishing",
      url:"https://edeninstitute.health/practitioner",
      campaign:"practitioner_founding",
      angles:["notworkshop","design","steward"],
      ctas:{awareness:"Learn More",traffic:"Learn More",leads:"Sign Up",sales:"Subscribe"},
      headlines:["Train as a Practitioner","Founding Rate: $499 a Year","Terrain-Based Training","Depth, Not Decoration"],
      descs:["Founding $49.99 a month.","Built for real rigor.","Serious training, biblical spine."],
      primaries:{
        notworkshop:[
  "This isn't a weekend workshop. It's not a PDF and a prayer.\n\nThe Eden Institute practitioner track trains you in terrain-based herbalism with clinical rigor and a biblical spine: constitutions, tissue states, body systems, and a scope you can stand on.\n\nFounding members join at $49.99 a month or $499 a year."
        ],
        design:[
  "Train to match the person to the plant.\n\nMost herbal education stops at take this for that. Practitioner training at The Eden Institute goes further: assessment, energetics, terrain, and the discernment to use them well.\n\nFounding rate: $49.99 a month or $499 a year. 🌿"
        ],
        steward:[
  "Your church, your co-op, your neighborhood. Somebody should be the one who knows.\n\nThe Eden Institute trains practitioners who serve their communities with clinical literacy and biblical discernment, from constitution to materia medica.\n\nFounding membership is open now: $49.99 a month or $499 a year."
        ]
      }
    }
  };

  /* Compliance rules: policy (Meta risk) / caution / voice (Eden brand) */
  const RULES = [
    {lvl:"policy", re:/\bcure[sd]?\b/i, msg:"“Cure” is a medical claim. Meta rejects it and it violates Eden scope. Rephrase toward education."},
    {lvl:"policy", re:/\b(heals?|fix(es)?|eliminates?|reverses?)\s+(your\s+)?(anxiety|depression|adhd|eczema|acne|insomnia|diabetes|illness|disease|pain|infection)/i, msg:"Promises an outcome for a named condition. Meta health policy and Eden scope both forbid this."},
    {lvl:"policy", re:/\b(do you (have|suffer|struggle)|are you (sick|ill|depressed|anxious)|your (anxiety|depression|adhd|eczema|acne|insomnia|diabetes|chronic|illness|condition|diagnosis|symptoms))\b/i, msg:"Implies a personal health attribute. Meta disapproves ads that suggest you know the reader's condition. Speak to learning, not to their symptoms."},
    {lvl:"policy", re:/\bguarantee[ds]?\b/i, msg:"“Guarantee” invites disapproval and refund disputes. Use conviction, not warranty."},
    {lvl:"policy", re:/clinically proven|fda[- ]?(approved|cleared)|doctor[- ]recommended/i, msg:"Unsubstantiated authority claim. Remove it."},
    {lvl:"policy", re:/\b(covid|vaccine|cancer|tumor)\b/i, msg:"High-scrutiny health topic. Meta reviews these aggressively; keep it out of ads."},
    {lvl:"policy", re:/before and after|lose \d+ (lbs|pounds)/i, msg:"Before/after and weight-loss claims are restricted on Meta."},
    {lvl:"caution", re:/\btreat(s|ed|ments?)?\b/i, msg:"“Treat” reads as medical. If it isn't about a snack, rephrase (teach, study, steward)."},
    {lvl:"caution", re:/\bremedy for\b/i, msg:"“Remedy for X” edges into prescription language. Keep ads at the framework level."},
    {lvl:"caution", re:/\bheal(s|ing|ed)?\b/i, msg:"Heal language is fine theologically, but keep it general and God-directed, never a promise to the reader."},
    {lvl:"caution", re:/!{2,}/, msg:"Multiple exclamation marks read as hype. Eden speaks with quiet confidence."},
    {lvl:"voice", re:/\bdetox/i, msg:"“Detox” is on the never-say list (clinically imprecise)."},
    {lvl:"voice", re:/\bvibes?\b/i, msg:"“Vibes” is on the never-say list."},
    {lvl:"voice", re:/\bmanifest/i, msg:"“Manifest” is on the never-say list (New Age framing)."},
    {lvl:"voice", re:/\bself[- ]care\b/i, msg:"Use “stewardship,” not “self-care.”"},
    {lvl:"voice", re:/heal yourself/i, msg:"“Heal yourself” implies self-sovereignty. The body belongs to God."},
    {lvl:"voice", re:/\buniverse\b/i, msg:"Never “the universe” as agent. Always attribute to God."},
    {lvl:"voice", re:/\b(chakra|chi|prana|dosha|energy healing)\b/i, msg:"Eastern-framework term. Name the tradition comparatively or use Eden vocabulary (energetics, constitution)."},
    {lvl:"voice", re:/boost (your )?immune/i, msg:"“Boost your immune system” is on the avoid list (oversimplification)."},
    {lvl:"voice", re:/\balternative medicine\b/i, msg:"Say “original medicine,” not “alternative medicine.”"},
    {lvl:"voice", re:/\broot cause\b/i, msg:"Prefer “terrain” over “root cause.”"},
    {lvl:"voice", re:/\bancient wisdom\b/i, msg:"“Ancient wisdom” without attribution is vague. Name the tradition."},
    {lvl:"voice", re:/—/, msg:"Em dash. Eden copy uses commas and periods instead (house rule)."}
  ];

  /* ───────────────────────── STATE ───────────────────────── */
  const state = {product:"kit", objective:"sales", audience:"homeschool", angle:"children", format:"portrait", gen:0};
  let variants = [];
  const $ = s => root.querySelector(s);
  const esc = s => s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

  /* ───────────────────────── CAMPAIGN UI ───────────────────────── */
  function chip(label, sel, on){
    const b = document.createElement("button");
    b.type = "button"; b.className = "chip" + (sel ? " sel" : ""); b.textContent = label;
    b.addEventListener("click", on); return b;
  }
  function renderCampaign(){
    const pl = $("#prodList"); pl.innerHTML = "";
    for (const [id,p] of Object.entries(PRODUCTS)){
      const b = document.createElement("button");
      b.type = "button"; b.className = "prod" + (state.product===id ? " sel" : "");
      b.innerHTML = "<span class='ptag'>"+esc(p.tag)+"</span><div class='pn'>"+esc(p.name)+"</div><div class='pf'>"+esc(p.facts)+"</div>";
      b.addEventListener("click", () => {
        state.product = id;
        if (!PRODUCTS[id].angles.includes(state.angle)) state.angle = PRODUCTS[id].angles[0];
        renderCampaign();
      });
      pl.appendChild(b);
    }
    const oc = $("#objChips"); oc.innerHTML = "";
    for (const [id,o] of Object.entries(OBJECTIVES))
      oc.appendChild(chip(o.name, state.objective===id, () => {state.objective=id; renderCampaign();}));
    const ac = $("#audChips"); ac.innerHTML = "";
    for (const [id,a] of Object.entries(AUDIENCES))
      ac.appendChild(chip(a.name, state.audience===id, () => {state.audience=id; renderCampaign();}));
    $("#audNote").innerHTML = AUDIENCES[state.audience].note;
    const gc = $("#angleChips"); gc.innerHTML = "";
    for (const id of PRODUCTS[state.product].angles)
      gc.appendChild(chip(ANGLES[id].name, state.angle===id, () => {state.angle=id; renderCampaign();}));
    const fc = $("#fmtChips"); fc.innerHTML = "";
    for (const [id,f] of Object.entries(FORMATS))
      fc.appendChild(chip(f.name, state.format===id, () => {state.format=id; renderCampaign(); if (variants.length) renderVariants();}));
  }

  /* ───────────────────────── GENERATION ───────────────────────── */
  function buildURL(p, n){
    return p.url + "?utm_source=facebook&utm_medium=paid_social&utm_campaign=" + p.campaign + "&utm_content=ad_v" + n;
  }
  function generate(){
    const p = PRODUCTS[state.product];
    const pool = p.primaries[state.angle] || [];
    variants = [0,1,2].map(i => {
      const primary = pool[(state.gen + i) % pool.length];
      const headline = p.headlines[(state.gen + i) % p.headlines.length];
      const desc = p.descs[(state.gen + i) % p.descs.length];
      return {primary, headline, desc, cta:p.ctas[state.objective], url:buildURL(p, i+1), platform:"fb", expanded:false};
    });
    state.gen++;
    $("#emptyState").hidden = true;
    $("#copyAllBtn").hidden = false;
    $("#benchTitle").textContent = p.name + " · " + ANGLES[state.angle].name;
    renderVariants();
    if (state.gen === 1) $("#workbench").scrollIntoView({behavior:"smooth", block:"start"});
  }

  /* ───────────────────────── COMPLIANCE ───────────────────────── */
  function checkText(all){
    const hits = [];
    for (const r of RULES) if (r.re.test(all)) hits.push(r);
    return hits;
  }
  function complianceHTML(v){
    const all = v.primary + "\n" + v.headline + "\n" + v.desc;
    const hits = checkText(all);
    let items = "";
    if (!hits.length) items = "<li class='clean'>Clean. No Meta policy flags, no Eden voice violations.</li>";
    else items = hits.map(h => "<li class='"+h.lvl+"'>"+esc(h.msg)+"</li>").join("");
    const labels = {policy:"policy risk", caution:"caution", voice:"voice"};
    return "<div class='comp'><h4>Compliance · Meta policy &amp; Eden voice</h4><ul>"+items+"</ul></div>";
  }

  /* ───────────────────────── PREVIEWS ───────────────────────── */
  function hookLine(text){
    const first = text.split("\n")[0].split(/(?<=[.?!])\s/)[0] || text.slice(0,60);
    return first.length > 80 ? first.slice(0,77)+"…" : first;
  }
  function truncHTML(text, i, limit){
    if (variants[i].expanded || text.length <= limit) return esc(text);
    return esc(text.slice(0, limit)).replace(/\s+$/,"") + "… <span class='seemore' data-i='"+i+"'>See more</span>";
  }
  function mediaHTML(v, ratioClass){
    const f = FORMATS[state.format];
    return "<div class='media "+ratioClass+"'><span class='morn'>❦</span><span class='mhook'>"+esc(hookLine(v.primary))+"</span><span class='mfmt'>"+esc(f.label)+"</span></div>";
  }
  function previewHTML(v, i){
    const f = FORMATS[state.format];
    const ratio = f.ratio === "r916" ? "r45" : f.ratio; /* feed mocks show 1:1 or 4:5 */
    const domain = v.url.replace(/^https?:\/\//,"").split("/")[0].toUpperCase();
    if (v.platform === "story"){
      return "<div class='mock story'><div class='smedia'>" +
        "<div class='shead'><span class='av'>E</span> edeninstitute &nbsp;·&nbsp; Sponsored</div>" +
        "<div class='shook'>"+esc(hookLine(v.primary))+"</div>" +
        "<div><div class='sverse'>Back to Eden. Back to Truth.</div>" +
        "<div class='sswipe' style='margin-top:10px'><span>"+esc(v.cta)+"</span></div></div>" +
        "</div></div><p class='subnote' style='text-align:center'>9:16 story frame. The image carries the hook; keep primary text short.</p>";
    }
    if (v.platform === "ig"){
      return "<div class='mock ig'>" +
        "<div class='mh'><span class='av'>E</span><div><div class='mname'>edeninstitute</div><div class='msub'>Sponsored</div></div></div>" +
        mediaHTML(v, ratio) +
        "<div class='igcta'><span>"+esc(v.cta)+"</span><span>›</span></div>" +
        "<div class='igcap'><b>edeninstitute</b> "+truncHTML(v.primary, i, 125)+"</div>" +
        "</div>";
    }
    return "<div class='mock'>" +
      "<div class='mh'><span class='av'>E</span><div><div class='mname'>The Eden Institute</div><div class='msub'>Sponsored · 🌐</div></div></div>" +
      "<div class='mtext'>"+truncHTML(v.primary, i, 125)+"</div>" +
      mediaHTML(v, ratio) +
      "<div class='linkbar'><div><div class='dom'>"+esc(domain)+"</div><div class='hl'>"+esc(v.headline)+"</div><div class='dsc'>"+esc(v.desc)+"</div></div><div class='ctabtn'>"+esc(v.cta)+"</div></div>" +
      "<div class='mfoot'><span>👍 Like</span><span>💬 Comment</span><span>↗ Share</span></div>" +
      "</div>";
  }

  /* ───────────────────────── VARIANT CARDS ───────────────────────── */
  function counterHTML(len, limit, label){
    const cls = len > limit ? "over" : (len > limit*0.85 ? "warn" : "");
    return "<span class='counter "+cls+"'>"+len+" / "+limit+" "+label+"</span>";
  }
  function briefHTML(v){
    const f = FORMATS[state.format];
    return "<details class='brief'><summary>Creative brief for Canva ▾</summary><div class='brief-b'>" +
      "<div><b>Format.</b> "+esc(f.name)+" · "+esc(f.spec)+"</div>" +
      "<div><b>Visual direction.</b> "+esc(ANGLES[state.angle].visual)+"</div>" +
      "<div><b>Overlay text.</b> “"+esc(hookLine(v.primary))+"” set in Cinzel Decorative; body notes in EB Garamond.</div>" +
      "<div><b>Imagery rules.</b> Botanical, natural light, warm wood and linen. No neon, no stock supplement photos, no New Age visuals, nothing that looks synthetic.</div>" +
      "<div class='swatches'><b>Palette.</b>" +
        "<span class='sw' style='background:#2B3A1E'></span><span class='swl'>2B3A1E</span>" +
        "<span class='sw' style='background:#C5A44E'></span><span class='swl'>C5A44E</span>" +
        "<span class='sw' style='background:#F5EDD6'></span><span class='swl'>F5EDD6</span>" +
        "<span class='sw' style='background:#5C4A28'></span><span class='swl'>5C4A28</span>" +
        "<span class='sw' style='background:#8A9A5B'></span><span class='swl'>8A9A5B</span>" +
      "</div></div></details>";
  }
  function variantCard(v, i){
    const roman = ["I","II","III"][i];
    const wrap = document.createElement("article");
    wrap.className = "vcard";
    wrap.innerHTML =
      "<div class='vhead'><span class='vt'>Variant "+roman+"</span><span class='vm'>"+esc(ANGLES[state.angle].name)+" · "+esc(AUDIENCES[state.audience].name)+"</span>" +
      "<span style='display:flex;gap:6px;flex-wrap:wrap'><button class='copybtn' data-act='tobuilder' data-i='"+i+"' type='button' style='color:#F5EDD6;border-color:#C5A44E'>Build Creative</button>" +
      "<button class='copybtn' data-act='tovideo' data-i='"+i+"' type='button' style='color:#F5EDD6;border-color:#C5A44E'>Build Video</button>" +
      "<button class='copybtn' data-act='copyone' data-i='"+i+"' type='button' style='color:#F5EDD6;border-color:#C5A44E'>Copy This Ad</button></span></div>" +
      "<div class='vbody'><div class='vfields'>" +

      "<div class='frow'><div class='flabel'><span>Primary text</span><span>"+counterHTML(v.primary.length,125,"visible")+"</span></div>" +
      "<textarea data-f='primary' data-i='"+i+"' rows='7'>"+esc(v.primary)+"</textarea>" +
      "<div class='subnote'>First 125 characters show in feed before “See more.” Longer is allowed; front-load the hook.</div></div>" +

      "<div class='frow'><div class='flabel'><span>Headline</span><span>"+counterHTML(v.headline.length,40,"")+"</span></div>" +
      "<input type='text' data-f='headline' data-i='"+i+"' value=\""+esc(v.headline)+"\"></div>" +

      "<div class='frow'><div class='flabel'><span>Description <span class='hint'>FB feed only</span></span><span>"+counterHTML(v.desc.length,30,"")+"</span></div>" +
      "<input type='text' data-f='desc' data-i='"+i+"' value=\""+esc(v.desc)+"\"></div>" +

      "<div class='frow'><div class='flabel'><span>Call to action</span></div>" +
      "<select data-f='cta' data-i='"+i+"'>" + ["Learn More","Shop Now","Sign Up","Subscribe","Get Offer","Download"].map(c => "<option"+(c===v.cta?" selected":"")+">"+c+"</option>").join("") + "</select></div>" +

      "<div class='frow'><div class='flabel'><span>Destination URL</span></div>" +
      "<div class='urlrow'><input type='text' data-f='url' data-i='"+i+"' value=\""+esc(v.url)+"\"></div>" +
      "<div class='subnote'>Tagged per the Eden UTM kit. Swap utm_source=instagram for IG-only placements, or set URL parameters in Ads Manager.</div></div>" +

      "<div id='comp"+i+"'>"+complianceHTML(v)+"</div>" +
      briefHTML(v) +
      "</div><div class='vpreview'>" +
      "<div class='ptabs'>" +
        "<button class='ptab"+(v.platform==="fb"?" sel":"")+"' data-p='fb' data-i='"+i+"' type='button'>Facebook</button>" +
        "<button class='ptab"+(v.platform==="ig"?" sel":"")+"' data-p='ig' data-i='"+i+"' type='button'>Instagram</button>" +
        "<button class='ptab"+(v.platform==="story"?" sel":"")+"' data-p='story' data-i='"+i+"' type='button'>Story</button>" +
      "</div>" +
      "<div id='prev"+i+"'>"+previewHTML(v,i)+"</div>" +
      "</div></div>";
    return wrap;
  }
  function renderVariants(){
    const host = $("#variants"); host.innerHTML = "";
    variants.forEach((v,i) => host.appendChild(variantCard(v,i)));
  }
  function rerenderPreviews(){
    variants.forEach((v,i) => { const el = $("#prev"+i); if (el) el.innerHTML = previewHTML(v,i); });
  }

  /* ───────────────────────── EVENTS ───────────────────────── */
  root.addEventListener("input", e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (!f) return;
    const i = +e.target.dataset.i;
    variants[i][f] = e.target.value;
    const card = e.target.closest(".vcard");
    if (f === "primary" || f === "headline" || f === "desc"){
      const limits = {primary:[125,"visible"], headline:[40,""], desc:[30,""]};
      const span = e.target.closest(".frow").querySelector(".counter");
      const [lim,label] = limits[f];
      span.outerHTML = counterHTML(e.target.value.length, lim, label);
      $("#comp"+i).innerHTML = complianceHTML(variants[i]);
    }
    const el = $("#prev"+i); if (el) el.innerHTML = previewHTML(variants[i], i);
  });
  root.addEventListener("change", e => {
    const f = e.target.dataset && e.target.dataset.f;
    if (f === "cta"){ const i = +e.target.dataset.i; variants[i].cta = e.target.value; $("#prev"+i).innerHTML = previewHTML(variants[i], i); }
  });
  root.addEventListener("click", e => {
    const t = e.target;
    if (t.classList.contains("seemore")){ const i = +t.dataset.i; variants[i].expanded = !variants[i].expanded; $("#prev"+i).innerHTML = previewHTML(variants[i], i); return; }
    if (t.classList.contains("ptab")){ const i = +t.dataset.i; variants[i].platform = t.dataset.p; const card = t.closest(".vpreview");
      card.querySelectorAll(".ptab").forEach(b => b.classList.toggle("sel", b === t));
      $("#prev"+i).innerHTML = previewHTML(variants[i], i); return; }
    if (t.dataset.act === "copyone"){ copyText(exportVariant(+t.dataset.i)); return; }
    if (t.id === "copyAllBtn"){ copyText(variants.map((_,i) => exportVariant(i)).join("\n\n" + "─".repeat(46) + "\n\n")); return; }
  });
  $("#genBtn").addEventListener("click", generate);

  /* ───────────────────────── EXPORT ───────────────────────── */
  function exportVariant(i){
    const v = variants[i]; const p = PRODUCTS[state.product];
    return "EDEN AD STUDIO · " + p.name + " · " + ANGLES[state.angle].name + " · Variant " + (i+1) +
      "\nAudience: " + AUDIENCES[state.audience].name + " · Objective: " + OBJECTIVES[state.objective].name + " · Format: " + FORMATS[state.format].name +
      "\n\nPRIMARY TEXT:\n" + v.primary +
      "\n\nHEADLINE: " + v.headline +
      "\nDESCRIPTION: " + v.desc +
      "\nCTA: " + v.cta +
      "\nURL: " + v.url;
  }
  function copyText(str){
    const done = () => { const t = $("#toast"); t.classList.add("show"); setTimeout(() => t.classList.remove("show"), 1400); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(str).then(done, () => fallbackCopy(str, done));
    else fallbackCopy(str, done);
  }
  function fallbackCopy(str, done){
    const ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta); done();
  }

  /* ───────────────────────── CREATIVE BUILDER ───────────────────────── */
  const SERIF = '"Palatino Linotype","Book Antiqua",Palatino,Georgia,serif';
  const SIZES = {feed:{w:1080,h:1080,name:"1:1 Feed"}, portrait:{w:1080,h:1350,name:"4:5 Feed"}, story:{w:1080,h:1920,name:"9:16 Story"}};
  const TEMPLATES = {label:"Apothecary Label", forest:"Deep Forest", photo:"Photo Harvest"};
  const BUILDER = {tpl:"label", size:"portrait", hook:"Eden's Table: Herbalism for Kids",
    sub:"36 weeks. One herb at a time. Preorders open July 29.",
    cta:"Preorder Now", domain:"edeninstitute.health/homeschool", photo:null};

  function setSpacing(ctx, v){ try{ ctx.letterSpacing = v; }catch(e){} }
  function wrapLines(ctx, text, maxW){
    const words = text.split(/\s+/).filter(Boolean); const lines = []; let cur = "";
    for (const w of words){ const t = cur ? cur+" "+w : w;
      if (ctx.measureText(t).width > maxW && cur){ lines.push(cur); cur = w; } else cur = t; }
    if (cur) lines.push(cur); return lines;
  }
  function fitBlock(ctx, text, maxW, startPx, weight, maxLines, spacingPct){
    let px = startPx;
    while (px > 26){
      ctx.font = weight+" "+px+"px "+SERIF; setSpacing(ctx, (px*spacingPct/100)+"px");
      const lines = wrapLines(ctx, text, maxW);
      if (lines.length <= maxLines && lines.every(l => ctx.measureText(l).width <= maxW)) return {px, lines};
      px -= 4;
    }
    ctx.font = weight+" 26px "+SERIF;
    return {px:26, lines:wrapLines(ctx, text, maxW)};
  }
  function ornament(ctx, cx, y, color, half){
    ctx.strokeStyle = color; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.moveTo(cx-half, y); ctx.lineTo(cx-34, y); ctx.moveTo(cx+34, y); ctx.lineTo(cx+half, y); ctx.stroke();
    ctx.fillStyle = color; ctx.beginPath();
    ctx.moveTo(cx, y-11); ctx.lineTo(cx+11, y); ctx.lineTo(cx, y+11); ctx.lineTo(cx-11, y); ctx.closePath(); ctx.fill();
  }
  function rr(ctx,x,y,w2,h2,r){ ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x,y,w2,h2,r); else ctx.rect(x,y,w2,h2); }

  function drawLabel(ctx,w,h){
    ctx.fillStyle = "#F5EDD6"; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = "#2B3A1E"; ctx.lineWidth = 8; ctx.strokeRect(44,44,w-88,h-88);
    ctx.lineWidth = 2; ctx.strokeRect(68,68,w-136,h-136);
    const story = h > 1500;
    ctx.fillStyle = "#5C4A28"; ctx.font = "600 30px "+SERIF; setSpacing(ctx,"12px");
    ctx.fillText("THE EDEN INSTITUTE", w/2, story?230:190);
    const hk = fitBlock(ctx, BUILDER.hook.toUpperCase(), w-280, story?100:86, "700", 4, 6);
    ctx.fillStyle = "#2B3A1E";
    const lh = hk.px*1.22;
    let y = (story ? h*0.34 : h*0.36) - (hk.lines.length-1)*lh/2;
    ctx.font = "700 "+hk.px+"px "+SERIF; setSpacing(ctx,(hk.px*0.06)+"px");
    for (const line of hk.lines){ ctx.fillText(line, w/2, y); y += lh; }
    const oy = y - lh + (story?95:70);
    ornament(ctx, w/2, oy, "#C5A44E", 150);
    setSpacing(ctx,"0px");
    const sb = fitBlock(ctx, BUILDER.sub, w-320, story?44:38, "italic 400", 3, 0);
    ctx.fillStyle = "#5C4A28"; ctx.font = "italic 400 "+sb.px+"px "+SERIF;
    let sy = oy + (story?115:92);
    for (const line of sb.lines){ ctx.fillText(line, w/2, sy); sy += sb.px*1.4; }
    const bh = story?130:110;
    ctx.fillStyle = "#C5A44E"; ctx.fillRect(68, h-68-bh, w-136, bh);
    ctx.fillStyle = "#1E1E14";
    const band = (BUILDER.cta + "  ·  " + BUILDER.domain).toUpperCase();
    const bf = fitBlock(ctx, band, w-220, 34, "700", 1, 4);
    ctx.font = "700 "+bf.px+"px "+SERIF; setSpacing(ctx,(bf.px*0.04)+"px");
    ctx.fillText(band, w/2, h-68-bh/2+bf.px*0.35);
    setSpacing(ctx,"0px");
  }

  function drawForest(ctx,w,h){
    ctx.fillStyle = "#2B3A1E"; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle = "#C5A44E"; ctx.lineWidth = 5; ctx.strokeRect(44,44,w-88,h-88);
    ctx.lineWidth = 1.5; ctx.strokeRect(64,64,w-128,h-128);
    const story = h > 1500;
    ctx.fillStyle = "#C5A44E"; ctx.font = "600 30px "+SERIF; setSpacing(ctx,"12px");
    ctx.fillText("THE EDEN INSTITUTE", w/2, story?230:190);
    const hk = fitBlock(ctx, BUILDER.hook.toUpperCase(), w-260, story?104:90, "700", 4, 6);
    ctx.fillStyle = "#F5EDD6";
    const lh = hk.px*1.22;
    let y = (story? h*0.35 : h*0.38) - (hk.lines.length-1)*lh/2;
    ctx.font = "700 "+hk.px+"px "+SERIF; setSpacing(ctx,(hk.px*0.06)+"px");
    for (const line of hk.lines){ ctx.fillText(line, w/2, y); y += lh; }
    const oy = y - lh + (story?95:72);
    ornament(ctx, w/2, oy, "#C5A44E", 150);
    setSpacing(ctx,"0px");
    const sb = fitBlock(ctx, BUILDER.sub, w-320, story?44:38, "italic 400", 3, 0);
    ctx.fillStyle = "#E8D5A3"; ctx.font = "italic 400 "+sb.px+"px "+SERIF;
    let sy = oy + (story?115:92);
    for (const line of sb.lines){ ctx.fillText(line, w/2, sy); sy += sb.px*1.4; }
    const cta = BUILDER.cta.toUpperCase();
    ctx.font = "700 34px "+SERIF; setSpacing(ctx,"3px");
    const cw = ctx.measureText(cta).width + 96;
    const cy = h - (story?300:230);
    ctx.fillStyle = "#C5A44E"; rr(ctx, w/2-cw/2, cy-44, cw, 88, 10); ctx.fill();
    ctx.fillStyle = "#1E1E14"; ctx.fillText(cta, w/2, cy+12);
    ctx.fillStyle = "#F5EDD6"; ctx.font = "400 27px "+SERIF; setSpacing(ctx,"2px");
    ctx.fillText(BUILDER.domain, w/2, cy + (story?112:98));
    setSpacing(ctx,"0px");
  }

  function drawPhoto(ctx,w,h){
    if (BUILDER.photo){
      const img = BUILDER.photo, s = Math.max(w/img.width, h/img.height);
      const dw = img.width*s, dh = img.height*s;
      ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
    } else {
      const g = ctx.createLinearGradient(0,0,0,h);
      g.addColorStop(0,"#8A9A5B"); g.addColorStop(1,"#F5EDD6");
      ctx.fillStyle = g; ctx.fillRect(0,0,w,h);
      ctx.fillStyle = "rgba(43,58,30,.6)"; ctx.font = "italic 400 30px "+SERIF; ctx.textAlign = "center";
      ctx.fillText("Add a product photo for this template", w/2, h*0.28);
    }
    const g2 = ctx.createLinearGradient(0,h*0.38,0,h);
    g2.addColorStop(0,"rgba(20,26,12,0)"); g2.addColorStop(1,"rgba(20,26,12,0.92)");
    ctx.fillStyle = g2; ctx.fillRect(0,h*0.38,w,h*0.62);
    ctx.fillStyle = "rgba(43,58,30,.82)"; rr(ctx, 44, 44, 430, 66, 8); ctx.fill();
    ctx.fillStyle = "#F5EDD6"; ctx.font = "600 24px "+SERIF; setSpacing(ctx,"8px"); ctx.textAlign = "left";
    ctx.fillText("THE EDEN INSTITUTE", 76, 88);
    ctx.textAlign = "center";
    const story = h > 1500;
    const hk = fitBlock(ctx, BUILDER.hook, w-160, story?86:74, "700", 3, 1);
    ctx.fillStyle = "#F5EDD6";
    const lh = hk.px*1.2;
    let y = h - (story?520:400) - (hk.lines.length-1)*lh;
    ctx.font = "700 "+hk.px+"px "+SERIF; setSpacing(ctx,(hk.px*0.02)+"px");
    for (const line of hk.lines){ ctx.fillText(line, w/2, y); y += lh; }
    setSpacing(ctx,"0px");
    const sb = fitBlock(ctx, BUILDER.sub, w-220, 34, "italic 400", 2, 0);
    ctx.fillStyle = "#E8D5A3"; ctx.font = "italic 400 "+sb.px+"px "+SERIF;
    let sy = y + 6;
    for (const line of sb.lines){ ctx.fillText(line, w/2, sy); sy += sb.px*1.4; }
    const cta = BUILDER.cta.toUpperCase();
    ctx.font = "700 32px "+SERIF; setSpacing(ctx,"3px");
    const cw = ctx.measureText(cta).width + 90;
    const cy = h - (story?230:150);
    ctx.fillStyle = "#C5A44E"; rr(ctx, w/2-cw/2, cy-42, cw, 84, 10); ctx.fill();
    ctx.fillStyle = "#1E1E14"; ctx.fillText(cta, w/2, cy+11);
    ctx.fillStyle = "#F5EDD6"; ctx.font = "400 25px "+SERIF; setSpacing(ctx,"1px");
    ctx.fillText(BUILDER.domain, w/2, cy + (story?106:96));
    setSpacing(ctx,"0px");
  }

  function drawAd(){
    const cv = $("#adCanvas"); const s = SIZES[BUILDER.size];
    cv.width = s.w; cv.height = s.h;
    const ctx = cv.getContext("2d");
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (BUILDER.tpl === "label") drawLabel(ctx, s.w, s.h);
    else if (BUILDER.tpl === "forest") drawForest(ctx, s.w, s.h);
    else drawPhoto(ctx, s.w, s.h);
    $("#dlMeta").textContent = s.w+" × "+s.h+" px · "+TEMPLATES[BUILDER.tpl]+" · downloads as PNG";
  }
  function renderBuilder(){
    const tc = $("#tplChips"); tc.innerHTML = "";
    for (const [id,name] of Object.entries(TEMPLATES))
      tc.appendChild(chip(name, BUILDER.tpl===id, () => {BUILDER.tpl=id; renderBuilder();}));
    const sc = $("#sizeChips"); sc.innerHTML = "";
    for (const [id,s] of Object.entries(SIZES))
      sc.appendChild(chip(s.name, BUILDER.size===id, () => {BUILDER.size=id; renderBuilder();}));
    $("#bHook").value = BUILDER.hook; $("#bSub").value = BUILDER.sub;
    $("#bCta").value = BUILDER.cta; $("#bDomain").value = BUILDER.domain;
    drawAd();
  }
  const BKEYS = {bHook:"hook", bSub:"sub", bCta:"cta", bDomain:"domain"};
  for (const id of Object.keys(BKEYS))
    $("#"+id).addEventListener("input", e => { BUILDER[BKEYS[id]] = e.target.value; drawAd(); });
  $("#bPhoto").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { BUILDER.photo = img; BUILDER.tpl = "photo"; renderBuilder(); };
    img.src = URL.createObjectURL(f);
  });
  $("#bPhotoClear").addEventListener("click", () => { BUILDER.photo = null; $("#bPhoto").value = ""; drawAd(); });
  $("#dlBtn").addEventListener("click", () => {
    const s = SIZES[BUILDER.size];
    const a = document.createElement("a");
    a.download = "eden-ad-" + BUILDER.tpl + "-" + s.w + "x" + s.h + ".png";
    a.href = $("#adCanvas").toDataURL("image/png");
    a.click();
  });
  root.addEventListener("click", e => {
    const t = e.target;
    if (t.dataset && t.dataset.act === "tobuilder"){
      const v = variants[+t.dataset.i]; if (!v) return;
      BUILDER.hook = v.headline;
      BUILDER.sub = v.desc;
      BUILDER.cta = v.cta;
      BUILDER.domain = v.url.replace(/^https?:\/\//,"").split("?")[0];
      BUILDER.size = state.format === "story" ? "story" : (state.format === "portrait" ? "portrait" : "feed");
      renderBuilder();
      $("#builder").scrollIntoView({behavior:"smooth", block:"start"});
    }
  });

  /* ───────────────────────── VIDEO BUILDER ───────────────────────── */
  const VB = {
    size:"portrait", bg:"forest", duration:30, music:"synth", narr:"none",
    musicVol:0.25, narrVol:1.0, photo:null,
    cta:"Preorder Now", domain:"edeninstitute.health/homeschool",
    script:[
      "## THE EDEN INSTITUTE PRESENTS",
      "# EDEN'S TABLE",
      "* A year of biblical herbalism, taught at your kitchen table.",
      "",
      "36 weeks. One herb at a time.",
      "",
      "Your children will smell it, taste it, draw it,",
      "and learn Who made it grow.",
      "",
      "---",
      "",
      "Sprouts for K-2. Seedlings for grades 3-5.",
      "",
      "Everything arrives boxed and ready:",
      "Teacher's Guide, notebooks, recipe cards,",
      "field cards, and read-aloud stories.",
      "",
      "---",
      "",
      "* \"The leaves are for healing.\" Ezekiel 47:12",
      "",
      "# PREORDERS OPEN JULY 29",
      "The first 500 kits are $249. Then $349 retail."
    ].join("\n")
  };
  const VB_BGS = {forest:"Deep Forest", label:"Parchment", photo:"Photo", clip:"Video Clip"};
  const VB_MUSIC = {none:"None", synth:"Eden Ambient (built-in)", file:"Uploaded Track"};
  const VB_NARR = {none:"None", file:"Recorded / Uploaded"};
  const VB_DURS = [15,30,45,60];
  const vClipEl = document.createElement("video");
  vClipEl.muted = true; vClipEl.playsInline = true; vClipEl.loop = true;

  function parseScript(txt){
    const blocks = [];
    for (const raw of txt.split("\n")){
      const line = raw.trim();
      if (line === "") blocks.push({t:"gap"});
      else if (line === "---") blocks.push({t:"orn"});
      else if (line.startsWith("## ")) blocks.push({t:"eyebrow", s:line.slice(3)});
      else if (line.startsWith("# ")) blocks.push({t:"head", s:line.slice(2)});
      else if (line.startsWith("* ")) blocks.push({t:"ital", s:line.slice(2)});
      else blocks.push({t:"body", s:line});
    }
    return blocks;
  }
  function layoutCredits(ctx, w, dark){
    const ink = dark ? "#F5EDD6" : "#2B3A1E";
    const sub = dark ? "#E8D5A3" : "#5C4A28";
    const maxW = w - 220;
    const rows = [];
    const push = (s, font, px, color, gapAfter, spacing) => {
      ctx.font = font; setSpacing(ctx, spacing + "px");
      const lines = wrapLines(ctx, s, maxW);
      for (const ln of lines) rows.push({s:ln, font, px, color, gap:px*0.5, spacing});
      if (lines.length) rows[rows.length-1].gap = px*0.5 + gapAfter;
    };
    for (const b of parseScript(VB.script)){
      if (b.t === "gap"){ if (rows.length) rows[rows.length-1].gap += 30; continue; }
      if (b.t === "orn"){ rows.push({orn:true, px:24, gap:56}); continue; }
      if (b.t === "eyebrow") push(b.s.toUpperCase(), "600 30px "+SERIF, 30, "#C5A44E", 22, 10);
      else if (b.t === "head") push(b.s.toUpperCase(), "700 74px "+SERIF, 74, ink, 26, 4);
      else if (b.t === "ital") push(b.s, "italic 400 42px "+SERIF, 42, sub, 18, 0);
      else push(b.s, "400 40px "+SERIF, 40, ink, 10, 0);
    }
    setSpacing(ctx, "0px");
    let total = 0; for (const r of rows) total += r.px + r.gap;
    return {rows, total};
  }
  function drawVideoFrame(ctx, w, h, tSec){
    const dark = VB.bg !== "label";
    if (VB.bg === "photo" && VB.photo){
      const img = VB.photo, z = 1 + 0.08*(tSec/VB.duration);
      const s = Math.max(w/img.width, h/img.height)*z;
      const dw = img.width*s, dh = img.height*s;
      ctx.drawImage(img, (w-dw)/2, (h-dh)/2, dw, dh);
      ctx.fillStyle = "rgba(20,26,12,.66)"; ctx.fillRect(0,0,w,h);
    } else if (VB.bg === "clip" && vClipEl.readyState >= 2){
      const vw = vClipEl.videoWidth || 16, vh = vClipEl.videoHeight || 9;
      const s = Math.max(w/vw, h/vh), dw = vw*s, dh = vh*s;
      ctx.drawImage(vClipEl, (w-dw)/2, (h-dh)/2, dw, dh);
      ctx.fillStyle = "rgba(20,26,12,.66)"; ctx.fillRect(0,0,w,h);
    } else if (VB.bg === "label"){
      ctx.fillStyle = "#F5EDD6"; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = "#2B3A1E"; ctx.lineWidth = 8; ctx.strokeRect(34,34,w-68,h-68);
    } else {
      ctx.fillStyle = "#2B3A1E"; ctx.fillRect(0,0,w,h);
      ctx.strokeStyle = "#C5A44E"; ctx.lineWidth = 4; ctx.strokeRect(34,34,w-68,h-68);
    }
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    const {rows, total} = layoutCredits(ctx, w, dark);
    const hold = Math.min(3, VB.duration*0.15);
    const scrollDur = Math.max(1, VB.duration - hold);
    const p = Math.min(tSec/scrollDur, 1);
    let y = h + 40 - p*(total + h + 80);
    for (const r of rows){
      y += r.px;
      if (y > -80 && y < h + 90){
        if (r.orn) ornament(ctx, w/2, y-8, "#C5A44E", 130);
        else { ctx.font = r.font; setSpacing(ctx, r.spacing + "px"); ctx.fillStyle = r.color; ctx.fillText(r.s, w/2, y); }
      }
      y += r.gap;
    }
    setSpacing(ctx, "0px");
    if (tSec > scrollDur){
      const a = Math.min(1, (tSec - scrollDur)/0.8);
      ctx.globalAlpha = a;
      ornament(ctx, w/2, h/2 - 100, "#C5A44E", 150);
      ctx.fillStyle = dark ? "#F5EDD6" : "#2B3A1E";
      ctx.font = "700 58px "+SERIF; setSpacing(ctx, "3px");
      ctx.fillText(VB.cta.toUpperCase(), w/2, h/2);
      ctx.fillStyle = dark ? "#E8D5A3" : "#5C4A28";
      ctx.font = "400 34px "+SERIF; setSpacing(ctx, "1px");
      ctx.fillText(VB.domain, w/2, h/2 + 70);
      setSpacing(ctx, "0px");
      ctx.globalAlpha = 1;
    }
  }

  /* audio graph */
  let audioCtx = null, adest = null, musicGain = null, narrGain = null, synthStop = null;
  const musicEl = new Audio(); musicEl.loop = true;
  const narrEl = new Audio();
  function ensureAudio(){
    if (audioCtx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AC();
    adest = audioCtx.createMediaStreamDestination();
    musicGain = audioCtx.createGain(); narrGain = audioCtx.createGain();
    musicGain.connect(adest); musicGain.connect(audioCtx.destination);
    narrGain.connect(adest); narrGain.connect(audioCtx.destination);
    audioCtx.createMediaElementSource(musicEl).connect(musicGain);
    audioCtx.createMediaElementSource(narrEl).connect(narrGain);
  }
  function startSynth(){
    const roots = [130.81, 174.61, 110.00, 98.00]; /* C, F, A, G bass drift */
    const g = audioCtx.createGain(); g.gain.value = 0.0001;
    const filt = audioCtx.createBiquadFilter(); filt.type = "lowpass"; filt.frequency.value = 850;
    filt.connect(g); g.connect(musicGain);
    const oscs = [1, 1.5, 2.52].map(m => {
      const o = audioCtx.createOscillator(); o.type = "triangle";
      o.frequency.value = roots[0]*m; o.connect(filt); o.start(); return {o, m};
    });
    const t0 = audioCtx.currentTime;
    g.gain.setTargetAtTime(0.5, t0, 1.5);
    const iv = setInterval(() => {
      const idx = Math.floor((audioCtx.currentTime - t0)/5) % roots.length;
      for (const {o, m} of oscs) o.frequency.setTargetAtTime(roots[idx]*m, audioCtx.currentTime, 0.9);
    }, 5000);
    return () => {
      clearInterval(iv);
      g.gain.setTargetAtTime(0.0001, audioCtx.currentTime, 0.3);
      setTimeout(() => oscs.forEach(x => { try{ x.o.stop(); }catch(e){} }), 1200);
    };
  }
  function startAV(){
    ensureAudio(); audioCtx.resume();
    musicGain.gain.value = VB.musicVol; narrGain.gain.value = VB.narrVol;
    if (VB.music === "file" && musicEl.src){ musicEl.currentTime = 0; musicEl.play().catch(()=>{}); }
    else if (VB.music === "synth") synthStop = startSynth();
    if (VB.narr === "file" && narrEl.src){ narrEl.currentTime = 0; narrEl.play().catch(()=>{}); }
    if (VB.bg === "clip" && vClipEl.src){ vClipEl.currentTime = 0; vClipEl.play().catch(()=>{}); }
  }
  function stopAV(){
    musicEl.pause(); narrEl.pause(); vClipEl.pause();
    if (synthStop){ synthStop(); synthStop = null; }
  }

  /* run + record */
  let vAnim = null, vRecorder = null, vChunks = [];
  function setVStatus(s){ $("#vbStatus").textContent = s; }
  function pickMime(){
    if (!window.MediaRecorder) return null;
    const list = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2","video/mp4","video/webm;codecs=h264,opus","video/webm;codecs=vp9,opus","video/webm"];
    for (const m of list) if (MediaRecorder.isTypeSupported(m)) return m;
    return "";
  }
  function stopRun(){
    if (vAnim){ cancelAnimationFrame(vAnim); vAnim = null; }
    if (vRecorder && vRecorder.state !== "inactive"){ try{ vRecorder.stop(); }catch(e){} }
    stopAV();
  }
  function runVideo(record){
    stopRun();
    const s = SIZES[VB.size]; const cv = $("#vCanvas");
    cv.width = s.w; cv.height = s.h;
    const ctx = cv.getContext("2d");
    if (record && !window.MediaRecorder){ setVStatus("This browser can't record video. Preview works; try Chrome or Edge to export."); record = false; }
    startAV();
    if (record){
      const stream = cv.captureStream(30);
      if (adest && (VB.music !== "none" || VB.narr === "file"))
        for (const tr of adest.stream.getAudioTracks()) stream.addTrack(tr);
      const mime = pickMime();
      vChunks = [];
      vRecorder = new MediaRecorder(stream, mime ? {mimeType:mime, videoBitsPerSecond:8000000} : undefined);
      vRecorder.ondataavailable = e => { if (e.data && e.data.size) vChunks.push(e.data); };
      vRecorder.onstop = finishRecording;
      vRecorder.start();
      setVStatus("Recording. The take runs in real time, "+VB.duration+" seconds.");
    } else setVStatus("Previewing.");
    const t0 = performance.now();
    const loop = now => {
      const t = (now - t0)/1000;
      drawVideoFrame(ctx, s.w, s.h, Math.min(t, VB.duration));
      if (t >= VB.duration + 0.2){
        vAnim = null;
        if (vRecorder && vRecorder.state !== "inactive") vRecorder.stop();
        stopAV();
        if (!record) setVStatus("Preview finished.");
        return;
      }
      vAnim = requestAnimationFrame(loop);
    };
    vAnim = requestAnimationFrame(loop);
  }
  function finishRecording(){
    const mime = (vRecorder && vRecorder.mimeType) || "video/webm";
    const blob = new Blob(vChunks, {type:mime});
    const ext = mime.indexOf("mp4") >= 0 ? "mp4" : "webm";
    const url = URL.createObjectURL(blob);
    const s = SIZES[VB.size];
    $("#vbResult").innerHTML =
      "<video controls playsinline src='"+url+"' style='width:100%;max-width:380px;display:block;margin:12px auto 0;border:1px solid var(--line);background:#000'></video>" +
      "<a class='genbtn' style='display:block;max-width:420px;margin:10px auto 0;text-align:center;text-decoration:none' download='eden-video-"+s.w+"x"+s.h+"-"+VB.duration+"s."+ext+"' href='"+url+"'>❦ &nbsp;Download Video ("+ext.toUpperCase()+")</a>" +
      (ext === "webm" ? "<p class='subnote' style='text-align:center'>Meta accepts WebM uploads. If Ads Manager complains, convert to MP4 (Clipchamp is free on Windows).</p>" : "");
    setVStatus("Take complete. " + (Math.round(blob.size/104857.6)/10) + " MB.");
  }

  /* video builder UI */
  function drawVideoStill(){
    const s = SIZES[VB.size]; const cv = $("#vCanvas");
    cv.width = s.w; cv.height = s.h;
    drawVideoFrame(cv.getContext("2d"), s.w, s.h, 1.6);
    $("#vbMeta").textContent = s.w+" × "+s.h+" px · "+VB.duration+"s · "+VB_BGS[VB.bg];
  }
  function renderVB(){
    const sc = $("#vbSizeChips"); sc.innerHTML = "";
    for (const [id,s] of Object.entries(SIZES))
      sc.appendChild(chip(s.name, VB.size===id, () => {VB.size=id; renderVB();}));
    const bc = $("#vbBgChips"); bc.innerHTML = "";
    for (const [id,name] of Object.entries(VB_BGS))
      bc.appendChild(chip(name, VB.bg===id, () => {VB.bg=id; renderVB();}));
    const dc = $("#vbDurChips"); dc.innerHTML = "";
    for (const d of VB_DURS)
      dc.appendChild(chip(d+"s", VB.duration===d, () => {VB.duration=d; renderVB();}));
    const mc = $("#vbMusicChips"); mc.innerHTML = "";
    for (const [id,name] of Object.entries(VB_MUSIC))
      mc.appendChild(chip(name, VB.music===id, () => {VB.music=id; renderVB();}));
    const nc = $("#vbNarrChips"); nc.innerHTML = "";
    for (const [id,name] of Object.entries(VB_NARR))
      nc.appendChild(chip(name, VB.narr===id, () => {VB.narr=id; renderVB();}));
    if (document.activeElement !== $("#vbScript")) $("#vbScript").value = VB.script;
    if (document.activeElement !== $("#vbCta")) $("#vbCta").value = VB.cta;
    if (document.activeElement !== $("#vbDomain")) $("#vbDomain").value = VB.domain;
    drawVideoStill();
  }
  $("#vbScript").addEventListener("input", e => { VB.script = e.target.value; drawVideoStill(); });
  $("#vbCta").addEventListener("input", e => { VB.cta = e.target.value; });
  $("#vbDomain").addEventListener("input", e => { VB.domain = e.target.value; });
  $("#vbMusicVol").addEventListener("input", e => { VB.musicVol = e.target.value/100*0.6; if (musicGain) musicGain.gain.value = VB.musicVol; });
  $("#vbNarrVol").addEventListener("input", e => { VB.narrVol = e.target.value/100*1.4; if (narrGain) narrGain.gain.value = VB.narrVol; });
  $("#vbPhoto").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    const img = new Image();
    img.onload = () => { VB.photo = img; VB.bg = "photo"; renderVB(); };
    img.src = URL.createObjectURL(f);
  });
  $("#vbClip").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    vClipEl.src = URL.createObjectURL(f);
    vClipEl.onloadeddata = () => { VB.bg = "clip"; renderVB(); };
  });
  $("#vbMusicFile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    musicEl.src = URL.createObjectURL(f); VB.music = "file"; renderVB();
    setVStatus("Track loaded: " + f.name);
  });
  $("#vbNarrFile").addEventListener("change", e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    narrEl.src = URL.createObjectURL(f); VB.narr = "file"; renderVB();
    setVStatus("Narration loaded: " + f.name);
  });
  let micRec = null, micStream = null;
  $("#vbMicBtn").addEventListener("click", async () => {
    if (micRec && micRec.state === "recording"){ micRec.stop(); return; }
    try{
      micStream = await navigator.mediaDevices.getUserMedia({audio:true});
      const chunks = [];
      micRec = new MediaRecorder(micStream);
      micRec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); };
      micRec.onstop = () => {
        narrEl.src = URL.createObjectURL(new Blob(chunks, {type: micRec.mimeType || "audio/webm"}));
        VB.narr = "file";
        micStream.getTracks().forEach(t => t.stop());
        $("#vbMicBtn").textContent = "● Record Narration";
        setVStatus("Narration captured. It plays under the next take.");
        renderVB();
      };
      micRec.start();
      $("#vbMicBtn").textContent = "■ Stop Recording";
      setVStatus("Recording narration. Read your script, then press stop.");
    }catch(err){
      setVStatus("Microphone unavailable here. Record a voice memo (phone or Windows Sound Recorder) and upload it instead.");
    }
  });
  $("#vbPreviewBtn").addEventListener("click", () => runVideo(false));
  $("#vbRecordBtn").addEventListener("click", () => runVideo(true));
  $("#vbStopBtn").addEventListener("click", () => { stopRun(); setVStatus("Stopped."); });
  root.addEventListener("click", e => {
    const t = e.target;
    if (t.dataset && t.dataset.act === "tovideo"){
      const v = variants[+t.dataset.i]; if (!v) return;
      const paras = v.primary.split(/\n\n+/);
      VB.script = "## THE EDEN INSTITUTE PRESENTS\n# " + v.headline + "\n\n" +
        paras.join("\n\n---\n\n") + "\n\n# " + v.cta;
      VB.cta = v.cta;
      VB.domain = v.url.replace(/^https?:\/\//,"").split("?")[0];
      VB.size = state.format === "story" ? "story" : (state.format === "portrait" ? "portrait" : "feed");
      renderVB();
      $("#videobuilder").scrollIntoView({behavior:"smooth", block:"start"});
    }
  });

  /* ───────────────────────── INIT ───────────────────────── */
  renderCampaign();
  renderBuilder();
  renderVB();

  return function cleanup() {
    try { stopRun(); } catch (e) {}
    try { musicEl.pause(); narrEl.pause(); vClipEl.pause(); } catch (e) {}
    try { if (audioCtx) audioCtx.close(); } catch (e) {}
  };
}
