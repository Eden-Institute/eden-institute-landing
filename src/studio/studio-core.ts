// @ts-nocheck
/* eslint-disable */
import QRCode from "qrcode";
import type { StudioHandle, StudioStateBlob } from "./studio-types";
// Eden Ad Studio core. Ported from the standalone artifact build (2026-07-17).
// Vanilla DOM app mounted by StudioPage.tsx; all queries and listeners are
// rooted on the container so unmount fully tears it down.

export function initStudio(
  root: HTMLElement,
  aiInvoke?: (body: unknown) => Promise<any>,
  assets?: {
    list: () => Promise<Array<{ name: string }>>;
    upload: (file: File) => Promise<void>;
    url: (name: string) => Promise<string>;
    remove: (name: string) => Promise<void>;
    publish: (blob: Blob, name: string) => Promise<string>;
  },
  // Phase 1 seam. React owns the project record, persistence, and the archive;
  // this core stays the framework-free authority on the working session. The
  // host is notified when the wizard moves so the React chrome can follow the
  // core's own auto-advances (heroGo jumps to Drafts on its own).
  host?: { onStep?: (n: number) => void },
): StudioHandle {
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
  const AI_PACK = {"kit": {"angleAdditions": {"children": ["Raise children who know what God made.\n\nEden's Table is a 36-week biblical herbalism curriculum for K-5. One herb each week, real herbs in their hands, and Scripture woven through every week. No screens, just your kitchen table, a Teacher's Guide that scripts each 20-minute day, and children learning to see creation the way its Maker intended.\n\nPreorders open July 29. Kits are $249 at edeninstitute.health/homeschool.", "Legacy is taught one week at a time.\n\nEden's Table walks your K-5 students through 36 weeks of biblical herbalism. Real herbs in hand, one each week. Scripture woven through every week, screen-free by design. Two bands, Sprouts for K-2 and Seedlings for grades 3-5, so the whole table learns together. What they learn now, they will carry to their own children.\n\nPreorders open July 29 at edeninstitute.health/homeschool. 🌿"], "openandgo": ["Open the Teacher's Guide. Read what it says. That is the whole prep.\n\nEden's Table scripts every day of a 36-week biblical herbalism curriculum for K-5. Lessons run about 20 minutes. The kit carries the student notebook, recipe cards, field cards, discussion cards, and a storybook, so the plan holds even in your fullest weeks.\n\nPreorders open July 29. $249 at edeninstitute.health/homeschool.", "You do not need one more subject that requires a weekend of prep.\n\nEden's Table is open and go. The Teacher's Guide scripts each day, lessons run about 20 minutes, and one herb per week keeps the rhythm steady for 36 weeks. Sprouts for K-2, Seedlings for grades 3-5. Scripture is woven through every week, and everything arrives in one kit.\n\nPreorders open July 29. edeninstitute.health/homeschool."], "esa": ["Louisiana families, The Eden Institute is now an approved GATOR vendor.\n\nEden's Table is a 36-week, screen-free biblical herbalism curriculum for K-5: a Teacher's Guide with scripted days, student notebook, recipe cards, field cards, discussion cards, and a storybook in one $249 kit. More states are in review.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "Education savings accounts exist for curriculum like this.\n\nEden's Table brings 36 weeks of biblical herbalism to your K-5 students. One real herb each week, Scripture woven throughout, about 20 minutes a day of guided teaching. The Eden Institute is an approved vendor with Louisiana's GATOR program, and more states are in review. If you plan your school year around eligible spending, start here.\n\nPreorders open July 29. edeninstitute.health/homeschool."], "preorder": ["The families who order first will teach it first.\n\nPreorders for Eden's Table open July 29. It is a 36-week biblical herbalism curriculum for K-5: a Teacher's Guide with scripted 20-minute days, student notebook, recipe cards, field cards, discussion cards, and a storybook, all in one $249 kit. One herb per week, real herbs in hand, Scripture through every week.\n\nReserve yours at edeninstitute.health/homeschool. 🌿", "July 29. Mark it.\n\nThat is the day preorders open for Eden's Table, our 36-week biblical herbalism curriculum for K-5. The first kits go to the families who order first. Inside: a Teacher's Guide with scripted 20-minute days, a student notebook, recipe cards, field cards, discussion cards, and a storybook. $249 for the kit, extra student notebooks $19.\n\nedeninstitute.health/homeschool."], "grandmother": ["Your grandmother knew which leaf to steep. Your children can know it too.\n\nSomewhere between her kitchen and yours, the chain of plant knowledge broke. Eden's Table reconnects it, one herb per week for 36 weeks, real herbs in your children's hands, Scripture woven through all of it. K-5, screen-free, taught at your own table.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "She did not learn it from a screen. Neither will they.\n\nThe knowledge your grandmother carried was passed hand to hand, kitchen to kitchen. Eden's Table puts it back in the family: a 36-week biblical herbalism curriculum for K-5, one real herb each week, with a storybook, recipe cards, and field cards your children will hold, not scroll. Scripture runs through all 36 weeks, the way faith once ran through those kitchens.\n\nPreorders open July 29, $249. edeninstitute.health/homeschool."], "heritage": ["Herbalism was never witchcraft. It is heritage, with its Maker's name on it.\n\nEden's Table teaches K-5 children the plants God made, and it names their Maker plainly. One herb per week for 36 weeks, Scripture woven through all of them, real herbs in hand. No mysticism, no borrowed spirituality. Creation, studied under its Creator.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "Some say herbs are off-limits for Christians. The first garden says otherwise.\n\nGod planted it, and Eden's Table teaches it that way: a 36-week biblical herbalism curriculum for K-5 where Scripture is the foundation, not a footnote. Your children learn one real herb each week, and they learn Who made it, without fear and without compromise.\n\nPreorders open July 29. edeninstitute.health/homeschool. 🌿"], "twoam": ["Every mom knows the 2AM search bar. Few of us were handed a better way.\n\nEden's Table starts the better way early: a 36-week biblical herbalism curriculum that teaches K-5 children the basics of what God planted, one real herb each week. You learn alongside them, about 20 minutes a day, with Scripture woven through every week. Calm knowledge, built slowly, together.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "The opposite of the midnight scroll is a family that learned the basics in daylight.\n\nEden's Table is a 36-week, screen-free herbalism curriculum for K-5. One herb per week, real herbs in hand, a scripted Teacher's Guide that takes about 20 minutes a day. It does not replace your doctor, and it is not meant to. It builds something quieter: a household that knows what grows in God's garden, and why.\n\nPreorders open July 29. edeninstitute.health/homeschool."]}, "audiencePrimaries": {"homeschool": ["You are already planning next year. Plan one subject around the garden God planted first.\n\nEden's Table is a 36-week biblical herbalism curriculum for K-5, built for living-lesson homes: one real herb per week, field cards for observation, a storybook worth reading aloud, and Scripture woven through every week. Sprouts for K-2, Seedlings for grades 3-5, about 20 minutes a day.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "Real herbs in small hands teach more than a unit study about them.\n\nIf your homeschool leans toward nature study and narration, Eden's Table will feel like home. 36 weeks, one herb per week, field cards and recipe cards your children handle themselves, a Teacher's Guide that scripts each 20-minute day without flattening it, and no screens anywhere in the kit.\n\nPreorders open July 29. $249, extra student notebooks $19. edeninstitute.health/homeschool."], "esa": ["Approved vendor. Eligible spending. One kit.\n\nIf you manage a state ESA, you check the vendor list before you fall in love with a curriculum. So here it is: The Eden Institute is an approved vendor with Louisiana's GATOR program, and more states are in review. Eden's Table covers 36 weeks of K-5 biblical herbalism with a scripted Teacher's Guide, student notebook, recipe cards, field cards, discussion cards, and a storybook, $249.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "ESA budgets get planned down to the line item. Here is what one line covers.\n\nEden's Table gives your K-5 students a full 36-week biblical herbalism curriculum: a Teacher's Guide with scripted 20-minute days, student notebook, recipe cards, field cards, discussion cards, and a storybook, $249, with extra student notebooks at $19. The Eden Institute is an approved GATOR vendor in Louisiana, and more states are in review.\n\nPreorders open July 29. edeninstitute.health/homeschool."], "mom2am": ["You do not have to know everything about herbs before you begin. You need a place to start.\n\nEden's Table starts small on purpose: one herb per week, 36 weeks, taught to your K-5 children from a Teacher's Guide that scripts every day. You learn alongside them, about 20 minutes at a time, with Scripture as the foundation. Confidence grows the way plants do, slowly and then surely.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "Natural living can feel like a test you were never taught for.\n\nEden's Table removes the guesswork. Every day of this 36-week K-5 curriculum is scripted for you, about 20 minutes at the table. Real herbs in hand, one per week, recipe cards and field cards included, Scripture woven through all of it. No hype and no trends, just steady learning in your own home.\n\nPreorders open July 29, kits $249. edeninstitute.health/homeschool. 🌿"], "hesitant": ["Some Christian families hold herbalism at arm's length. That caution is worth honoring. So is the garden God planted.\n\nEden's Table teaches herbs with the Maker named from the first week to the last. Scripture is the foundation of all 36 weeks, not a decoration on top. Your K-5 children learn one real herb each week, and they learn it as creation, studied under the authority of its Creator.\n\nPreorders open July 29. edeninstitute.health/homeschool.", "You have discernment for a reason. Use it here.\n\nRead a week of Eden's Table and weigh it against Scripture. You will find no mysticism, no borrowed spirituality, no vague forces. Just a 36-week K-5 curriculum where children study the plants God made under the authority of the God who made them, one real herb per week, screen-free, at your own table.\n\nPreorders open July 29. edeninstitute.health/homeschool."]}, "headlines": ["Raise Children Who Know What God Made", "Open and Go Biblical Herbalism", "LA GATOR Approved. Preorders July 29.", "Heritage, Not Witchcraft"], "descs": ["Preorders open July 29.", "36 weeks. K-5. Screen-free.", "Kit $249. LA GATOR approved."]}, "course": {"angleAdditions": {"design": ["God did not make bodies at random, and He did not make plants at random either.\n\nEvery person carries a pattern: a constitution, a set of tissue states, a terrain. Every plant carries a pattern too. Herbalism is not guesswork. It is learning to read both patterns and match them, person to plant, the way a careful steward reads a field before planting.\n\nThe Eden Institute's Tier 1 course teaches that framework in 10 lessons, with the companion book Back to Eden: A Biblical Framework for Healing. Founding price $97 through January 1, 2027, at learn.edeninstitute.health 🌿", "Why does the same herb serve one person and do nothing for her sister? Because bodies are not interchangeable.\n\nThey are designed. Most programs teach symptoms: take this for that. We teach you to read the person first. Constitution. Tissue state. Terrain. When you can see the pattern God wrote into a body, choosing an herb stops being a guess and becomes a discipline.\n\nThe Eden Institute's Tier 1 course is 10 online lessons from Camila Johnson, built on a biblical worldview from the first lesson. Founding price $97 through January 1, 2027. Enroll at learn.edeninstitute.health"], "exhausted": ["You bought the tincture. You followed the label. Nothing changed, and you quietly filed herbs under things that do not work.\n\nHere is what nobody told you: you were taught to use plants like pills. Take this for that. But that was never herbalism. Herbalism reads the person first, constitution, tissue state, terrain, and matches the plant to the pattern. The framework was the missing piece, not the plant.\n\nThe Eden Institute's Tier 1 course teaches that framework in 10 lessons, with a companion book. Founding price $97 through January 1, 2027. learn.edeninstitute.health", "Before you decide herbs do not work, ask a harder question. Were you ever taught the framework they work within?\n\nTake this for that is not herbalism. It is a pill mindset with a leaf on the label. Real herbal study begins with the person: her constitution, her tissue states, her terrain. Learn to read those, and the plants on your shelf stop being lottery tickets and start being tools you understand.\n\nThe Eden Institute's Tier 1 course. 10 lessons plus the companion book, on a biblical foundation. Founding price $97 through January 1, 2027 at learn.edeninstitute.health"], "twoam": ["It is 2AM and the search bar is open again. Ten tabs, ten opinions, and no way to weigh them.\n\nThe midnight spiral is not a character flaw. It is what happens when a mother is handed information without a framework. When you understand how God designed the body, constitution, tissue states, terrain, you can meet those moments with discernment instead of dread.\n\nThe Eden Institute's Tier 1 course teaches that framework in 10 lessons, with the companion book Back to Eden: A Biblical Framework for Healing. Founding price $97 through January 1, 2027. learn.edeninstitute.health 🌿", "The search bar cannot give you discernment. It can only give you more to weigh.\n\nMidnight is the wrong classroom. The time to learn how God designed the body is in daylight, at the table, lesson by lesson, so that when a hard night comes you are drawing on study instead of panic. That is not a shortcut. It is stewardship.\n\nThe Eden Institute's Tier 1 course is 10 online lessons with a companion book, taught from a biblical worldview by Camila Johnson. Founding price $97 through January 1, 2027. Enroll at learn.edeninstitute.health"], "heritage": ["For centuries, Christians grew, prepared, and studied the plants God made.\n\nMonastery infirmaries. Physic gardens. Family stillrooms. Somewhere along the way the church set that inheritance down, and other worldviews picked it up. You do not have to borrow it back on someone else's terms. It was yours to begin with.\n\nThe Eden Institute's Tier 1 course returns that study to its biblical foundation: constitutions, tissue states, terrain, taught in 10 lessons with a companion book. Founding price $97 through January 1, 2027. learn.edeninstitute.health", "Herbal study is not something Christians borrow from other traditions. For most of church history, it was ours.\n\nFor centuries, believers kept the knowledge of God's plants and passed it down like an heirloom. The chain thinned, but it does not have to end with you. An inheritance is not lost while someone is still willing to learn it.\n\nThe Eden Institute's Tier 1 course, 10 lessons and a companion book from Camila Johnson, teaches that inheritance on its original foundation: Scripture. Founding price $97 through January 1, 2027 at learn.edeninstitute.health 🌿"], "steward": ["Stewardship is not a feeling. It is a practice.\n\nIt looks like study when study is unglamorous. Discipline when nobody is watching. Preparation of the body, the garden, and the mind, done as unto the Lord. Prayer matters, and so does learning what God actually made. The two were never in competition.\n\nThe Eden Institute's Tier 1 course gives that practice its structure: 10 lessons on constitutions, tissue states, and terrain, built on a biblical worldview, with a companion book. Founding price $97 through January 1, 2027. learn.edeninstitute.health", "You would not tend a garden without studying it. The body God entrusted to you deserves the same seriousness.\n\nStewardship as worship means preparation: understanding constitutions, learning what tissue states reveal, seeing health as terrain to be tended rather than fires to be fought. That kind of study honors the One who designed it all.\n\nThe Eden Institute's Tier 1 course is where the study begins. 10 lessons plus the companion book Back to Eden: A Biblical Framework for Healing. Founding price $97 through January 1, 2027. learn.edeninstitute.health"]}, "audiencePrimaries": {"mom2am": ["Your shelf does not need another bottle. Your mind needs a framework.\n\nYou already love the natural path. What nobody handed you is the structure underneath it: why constitutions differ, what tissue states are telling you, how terrain shapes everything else. With a framework, natural living stops being a pile of protocols and becomes a coherent way of seeing, grounded in the God who designed it all.\n\nThe Eden Institute's Tier 1 course teaches that framework in 10 lessons, with a companion book. Founding price $97 through January 1, 2027. learn.edeninstitute.health", "You dry the herbs. You steep the tea. You keep the garden. And underneath it all, a question: do I really understand this?\n\nThat question is not doubt. It is the beginning of real study. The Eden Institute's Tier 1 course gives your natural life its missing framework: constitutions, tissue states, terrain, all taught from a biblical worldview, so the practices you love finally connect to the design behind them.\n\n10 lessons plus the companion book. Founding price $97 through January 1, 2027. Enroll at learn.edeninstitute.health 🌿"], "hesitant": ["You have quietly wondered whether studying herbs sits well with your faith. That caution is not weakness. It is discernment.\n\nAnd it deserves a real answer. The Eden Institute's Tier 1 course begins where your concern begins: with Scripture. The biblical worldview foundation comes first, before constitutions, tissue states, or terrain, so you are never asked to absorb a framework you have not examined. God made the plants. Studying them under His authority is not a compromise.\n\n10 lessons plus a companion book, from Camila Johnson. Founding price $97 through January 1, 2027. learn.edeninstitute.health", "If herbalism has always felt spiritually murky to you, you are paying attention.\n\nSo much of it comes wrapped in language a Christian cannot sit under. That is exactly why The Eden Institute's Tier 1 course puts the worldview first. It opens with the biblical foundation, then builds constitutions, tissue states, and terrain on top of it. Scripture is the ground floor here, not the decoration.\n\nThe course is 10 lessons, with the companion book Back to Eden: A Biblical Framework for Healing. Founding price $97 through January 1, 2027, at learn.edeninstitute.health"], "exhausted": ["You are allowed to be skeptical. You spent real money on tinctures and protocols, and you kept the receipts.\n\nSo here is the reframe, plainly: plants were never meant to be used like pills. Matching an herb to a symptom skips the actual work, which is reading the person. Constitution. Tissue state. Terrain. Once you learn that framework, the bottles on your shelf stop being gambles and start making sense.\n\nThe Eden Institute's Tier 1 course teaches it in 10 lessons, with a companion book, on a biblical foundation. Founding price $97 through January 1, 2027. learn.edeninstitute.health", "A cabinet of half-used bottles is not proof that herbs fail. It is proof that nobody taught you the framework.\n\nYou were handed products when you needed principles. This course does the opposite: no shopping list, just the discipline of reading a person, constitution, tissue states, terrain, through a biblical lens, so your next decision is a studied one instead of a hopeful one.\n\nThe Eden Institute's Tier 1 course, 10 lessons plus the companion book, from Camila Johnson. Founding price $97 through January 1, 2027 at learn.edeninstitute.health"]}, "headlines": ["Match the Person to the Plant", "A Framework, Not Another Protocol", "Herbal Study, Faith Intact", "10 Lessons. One Biblical Framework."], "descs": ["Founding price $97. Enroll.", "10 lessons plus the book.", "Scripture first. Then herbs."]}, "quiz": {"angleAdditions": {"design": ["The herb that serves your friend so well does nothing for you. That is not a flaw in the herb. It is a difference in design.\n\nGod did not make every body the same. Some run hot, some run cold. Some tend dry, some tend damp. Herbalists call this pattern your constitution, and it shapes how you respond to everything from coffee to chamomile.\n\nThe Eden Institute built a free two-minute quiz to help you name yours. No cost, no guesswork. 🌿 Take the Constitutional Quiz at edeninstitute.health", "She swears by a remedy. You tried it and felt nothing. The herb did not fail you. The difference is in the design.\n\nEvery body carries a pattern. Hot or cold, dry or damp. You are “fearfully and wonderfully made” (Psalm 139:14, NASB), and that making was specific. Your constitution is the pattern God wove into you, and it changes which plants serve you well.\n\nFind out what yours is. The free Constitutional Quiz from The Eden Institute takes two minutes. edeninstitute.health"], "twoam": ["A shelf of tinctures is not the place to start. Knowing the body you are buying them for is.\n\nBefore you learn a single herb, learn your own design. Your constitution, the hot or cold, dry or damp pattern God wove into your body, is the starting point for everything else. Learn it first, and every herb you study afterward has a context to land in.\n\nThe Eden Institute's free Constitutional Quiz takes two minutes. Begin where the learning actually begins. 🌿 edeninstitute.health", "You would not plant a garden without knowing your soil. Do not study herbs without knowing your constitution.\n\nHerbalism is not a list of remedies to memorize. It is discernment to build, and it begins with the terrain closest to home, your own body. Hot or cold. Dry or damp. God was intentional when He made you, and that intention can be read.\n\nRead yours in two minutes. The Constitutional Quiz from The Eden Institute is free at edeninstitute.health"], "steward": ["You cannot steward what you have never taken stock of.\n\nGod entrusted you with one body, made to a particular pattern. Hot or cold, dry or damp, it has a design worth knowing. Stewardship begins there. Not with a cabinet full of remedies, but with an honest look at what you have been given.\n\nThe Eden Institute's free Constitutional Quiz helps you take that look. Two minutes, no cost. 🌿 edeninstitute.health", "A faithful steward knows the field before she plants it.\n\nYour body is a trust, not a mystery. It carries a constitution, a pattern of hot or cold, dry or damp, that God set with intention. Naming that pattern is the first act of stewardship. Everything you learn about herbs afterward builds on it.\n\nStart with the free Constitutional Quiz from The Eden Institute. Two minutes at edeninstitute.health"]}, "audiencePrimaries": {"mom2am": ["Curious about herbs, but never sure where a busy mom is supposed to start?\n\nHere is a small first step. A free quiz that takes about two minutes, roughly the length of one reheated cup of coffee, and shows you the constitution God designed you with. Hot or cold, dry or damp. Nothing to buy, nothing to commit to.\n\n🌿 Take the Constitutional Quiz at edeninstitute.health. Curiosity is a fine place to begin.", "Two minutes. That is all this asks, and we know how few of those a mother has to spare.\n\nThe Eden Institute made a free quiz that reveals your constitution, the hot or cold, dry or damp pattern God wove into your body. It is a gentle introduction to biblical herbalism, and it costs nothing but the time it takes to pour a cup of tea.\n\nTake it while the house is quiet. edeninstitute.health"], "homeschool": ["You already teach in frameworks. Phonics before novels. Skip counting before multiplication. Herbalism works the same way.\n\nBiblical herbalism begins with your constitution, the hot or cold, dry or damp pattern God designed into every body. Learn your own first, and the whole subject organizes itself the way a good curriculum does.\n\nThe Eden Institute's free Constitutional Quiz takes two minutes. 🌿 edeninstitute.health", "The best subjects come with a scope and sequence. So does biblical herbalism.\n\nLesson one is not a list of herbs. It is your constitution, the pattern of hot or cold, dry or damp that God wrote into your body. Once you can name your own design, everything you study after it has a place to land. You already know this works. You teach this way every day.\n\nStart with the free two-minute Constitutional Quiz from The Eden Institute. edeninstitute.health"], "hesitant": ["Maybe you have been curious about herbalism but cautious about where it leads. That caution is discernment. Keep it.\n\nThe Eden Institute teaches herbs under the authority of Scripture, not the language of the New Age. And the first step asks nothing of you. A free two-minute quiz that shows you the constitution God designed you with. No cost, no purchase, no pressure.\n\nSee what it says. edeninstitute.health", "You do not have to commit to anything to learn how God made you.\n\nThis is a quiz, not a program. Two minutes, free, from The Eden Institute. It reveals your constitution, the hot or cold, dry or damp pattern woven into your body by design. If it stirs your curiosity, there is more to learn. If not, you have still learned something true about yourself.\n\n🌿 Take the Constitutional Quiz at edeninstitute.health"]}, "headlines": ["What Is Your God-Given Constitution?", "Free Quiz: Learn Your Design", "Hot or Cold? Dry or Damp? Find Out", "Know the Body God Gave You"], "descs": ["Free two-minute quiz.", "Two minutes. No cost.", "Take the free quiz today."]}, "apothecary": {"angleAdditions": {"exhausted": ["Stop shopping for herbs like supplements. \"Take this for that\" is not herbalism, it is guesswork in a capsule.\n\nThe Eden Apothecary is a digital Materia Medica of 300 herbs, each studied through four lenses: traditional use, modern research, energetics, and biblical context. Cross-referenced by constitution and tissue state, so you understand the plant before it ever enters your cart.\n\nUnderstanding first. Shopping second. 🌿 edeninstitute.health/apothecary", "The herb aisle is not the problem. Shopping without understanding is.\n\nMost of us learned to buy plants like products, one bottle per symptom. The Eden Apothecary teaches a slower, sounder way: 300 herb monographs, each read through traditional use, modern research, energetics, and biblical context, then cross-referenced by constitution and tissue state.\n\nStudy the plant before you spend on it. Membership at edeninstitute.health/apothecary"], "design": ["Every plant carries a pattern. God wrote it there on purpose, and it can be read.\n\nThe Eden Apothecary is a digital Materia Medica built for that reading: 300 herbs, each through four lenses, traditional use, modern research, energetics, and biblical context, plus a pattern lens that ties them together. Every entry is cross-referenced by constitution and tissue state.\n\nLearn to read what the Designer wrote. edeninstitute.health/apothecary", "A plant is not a pile of compounds. It is a pattern, placed there by a deliberate Designer.\n\nBitter or demulcent, warming or cooling, each herb speaks a consistent language. The Eden Apothecary teaches you to hear it: 300 monographs, each studied through traditional use, modern research, energetics, and biblical context, with a pattern lens and cross-references by constitution and tissue state.\n\nCreation is legible. Learn to read it. 🌿 edeninstitute.health/apothecary"], "notworkshop": ["This is not a blog post about ten herbs for winter. It is a Materia Medica.\n\nThe Eden Apothecary holds 300 herb monographs, each written through four lenses: traditional use, modern research, energetics, and biblical context. A pattern lens draws the threads together, and every entry is cross-referenced by constitution and tissue state.\n\nReference-grade study for serious stewards. Membership at edeninstitute.health/apothecary", "A recipe board can hand you a recipe. It cannot hand you understanding.\n\nThe Eden Apothecary was built for study, not scrolling: a digital Materia Medica of 300 herbs, each examined through traditional use, modern research, energetics, and biblical context, then cross-referenced by constitution and tissue state so one entry leads sensibly to the next.\n\nClinically literate. Biblically grounded. edeninstitute.health/apothecary"]}, "audiencePrimaries": {"exhausted": ["You do not need another bottle. You need to understand the ones you have.\n\nThe shelf of half-used tinctures is not a failure. It is what happens when products arrive before understanding. The Eden Apothecary offers the missing piece: 300 herb monographs through traditional use, modern research, energetics, and biblical context, cross-referenced by constitution and tissue state.\n\nDepth, not another product. edeninstitute.health/apothecary", "There is a shelf in your kitchen that tells a story. Tinctures tried once. Teas bought with hope.\n\nWhat that shelf is asking for is not one more purchase. It is understanding. The Eden Apothecary is a digital Materia Medica: 300 herbs studied through four lenses, traditional use, modern research, energetics, and biblical context, cross-referenced by constitution and tissue state.\n\nStudy first. Steward well. 🌿 edeninstitute.health/apothecary"], "practitioner": ["A serious student needs a serious reference. Not scattered notes, a Materia Medica.\n\nThe Eden Apothecary gathers 300 herb monographs in one place, each through four lenses: traditional use, modern research, energetics, and biblical context. A pattern lens ties findings together, and cross-references by constitution and tissue state let you move from herb to herb the way a practitioner thinks.\n\nBuild your library on solid ground. edeninstitute.health/apothecary", "You already study with discernment. Your reference library should meet that standard.\n\nThe Eden Apothecary is a working Materia Medica for the committed student: 300 monographs, each examined through traditional use, modern research, energetics, and biblical context, plus a pattern lens. Every entry is cross-referenced by constitution and tissue state, so your study compounds instead of scattering.\n\nMembership at edeninstitute.health/apothecary"]}, "headlines": ["A Materia Medica, Not a Mood Board.", "300 Herbs. Four Lenses. One Design.", "Understand the Herb Before You Buy It", "Read the Pattern God Placed in Plants"], "descs": ["Study 300 herbs in depth.", "Membership. Study. Steward.", "Four lenses. One garden."]}, "practitioner": {"angleAdditions": {"notworkshop": ["This is not a weekend workshop. It is not a PDF and a promise. It is practitioner training you can stand on.\n\nConstitutions. Tissue states. Body systems. Assessment. Scope. Clinical literacy with Scripture as the spine, not the decoration.\n\nThe Eden Institute Practitioner Program. Founding rate: $49.99 a month or $499 a year.\n\nedeninstitute.health/practitioner", "Rigor is a form of reverence. If God built the body with precision, your training should match.\n\nThe Practitioner Program is terrain-based clinical education: constitutions, tissue states, body systems, real assessment, and the scope to know exactly where your practice ends. Cited, structured, and accountable to Scripture and to safety. Quiet depth, not weekend hype.\n\nFounding rate: $49.99 a month or $499 a year.\n\n🌿 edeninstitute.health/practitioner"], "design": ["Most programs teach you the herb. We train you to read the person.\n\nConstitution. Tissue state. Terrain. When you can assess the whole person, herbalism stops being guesswork and becomes design rightly applied. The Practitioner Program teaches energetics, body systems, and the discernment to match the person to the plant.\n\nThe Eden Institute. Founding rate: $49.99 a month or $499 a year.\n\nedeninstitute.health/practitioner", "The same herb, two different people, two different responses. That is not failure. That is design.\n\nGod did not make every body the same, and a practitioner should not work as if He did. The Eden Institute Practitioner Program trains you in whole-person assessment: constitutions, tissue states, energetics, terrain. You learn to read the pattern before you reach for the plant.\n\nFounding rate: $49.99 a month or $499 a year.\n\n🌿 edeninstitute.health/practitioner"], "steward": ["Every church and co-op should have someone who knows. Not the loudest voice in the group chat. The trained one.\n\nThe Eden Institute Practitioner Program builds that steward: constitutions, tissue states, body systems, assessment, and the clinical literacy to know exactly where scope ends. Scripture is the spine, not the decoration.\n\nIt could be you. Founding rate: $49.99 a month or $499 a year.\n\nedeninstitute.health/practitioner", "Every co-op has the mom people call first. Few of them were formally trained.\n\nYour community deserves more than screenshots and supplement stacks. It deserves someone with sound assessment, clinical literacy, and the discernment to say, \"This is beyond my scope.\" The Practitioner Program trains that steward on a biblical foundation.\n\nFounding rate: $49.99 a month or $499 a year.\n\n🌿 edeninstitute.health/practitioner"]}, "audiencePrimaries": {"practitioner": ["You have compared the herbal schools. You know which ones are thin.\n\nHere is what depth looks like: terrain-based training in constitutions, tissue states, body systems, and assessment. A clear scope of practice. Clinical literacy that holds up under citation. And a biblical worldview underneath it all, not bolted on top.\n\nThe Eden Institute Practitioner Program. Founding rate: $49.99 a month or $499 a year.\n\nedeninstitute.health/practitioner", "Another tab open. Another syllabus. You are not indecisive, you are discerning.\n\nYou want training that treats you like a capable adult: real assessment, energetics, terrain, body systems, and the scope to practice with integrity. Not another certificate for the wall. A framework you can stand on.\n\nThe Eden Institute Practitioner Program. Founding rate: $49.99 a month or $499 a year.\n\n🌿 edeninstitute.health/practitioner"], "hesitant": ["You found serious herbal training. Then you read the worldview it came wrapped in.\n\nYou should not have to choose between rigor and reverence. The Practitioner Program is clinical education with a biblical spine from day one: constitutions, tissue states, assessment, scope. Study creation under the authority of the Creator.\n\nThe Eden Institute. Founding rate: $49.99 a month or $499 a year.\n\nedeninstitute.health/practitioner", "Serious training should never ask anyone to check their faith at the door.\n\nWe refused to. So we built practitioner training that starts with Scripture and holds the clinical line: terrain, energetics, body systems, assessment, and clear scope. Depth without compromise.\n\nThe Eden Institute. Founding rate: $49.99 a month or $499 a year.\n\n🌿 edeninstitute.health/practitioner"]}, "headlines": ["Terrain-Based Practitioner Training", "Not a Weekend Workshop", "Match the Person to the Plant", "Rigor, Scripture, and Scope"], "descs": ["Founding rate $49.99 a month", "Train with depth and scope.", "Enroll at the founding rate."]}};
  /* Merge the AI-authored, critic-approved pack into PRODUCTS: extra primaries per
     angle, audience-tuned primaries (used for Variant I), extra headlines/descs. */
  for (const [pid, add] of Object.entries(AI_PACK)){
    const p = PRODUCTS[pid]; if (!p) continue;
    for (const [aid, arr] of Object.entries(add.angleAdditions || {})){
      if (p.primaries[aid]) p.primaries[aid].push(...arr);
    }
    p.audiencePrimaries = add.audiencePrimaries || {};
    p.headlines.push(...(add.headlines || []));
    p.descs.push(...(add.descs || []));
  }

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
    heroRender(); /* keep the guided-entry cards in sync (hoisted) */
  }

  /* ───────────────────────── GENERATION ───────────────────────── */
  function buildURL(p, n){
    return p.url + "?utm_source=facebook&utm_medium=paid_social&utm_campaign=" + p.campaign + "&utm_content=ad_v" + n;
  }
  function generate(){
    const p = PRODUCTS[state.product];
    const pool = p.primaries[state.angle] || [];
    const audPool = (p.audiencePrimaries || {})[state.audience] || [];
    variants = [0,1,2].map(i => {
      const primary = (i === 0 && audPool.length)
        ? audPool[state.gen % audPool.length]
        : pool[(state.gen + i) % pool.length];
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
      "<span style='display:flex;gap:6px;flex-wrap:wrap'>" +
      "<button class='copybtn vbtn"+(v.approved ? " ok" : "")+"' data-act='approve' data-i='"+i+"' type='button'>"+(v.approved ? "Approved ✓" : "Approve")+"</button>" +
      "<button class='copybtn vbtn' data-act='tobuilder' data-i='"+i+"' type='button'>Build Creative</button>" +
      "<button class='copybtn vbtn' data-act='tovideo' data-i='"+i+"' type='button'>Build Video</button>" +
      "<button class='copybtn vbtn' data-act='copyone' data-i='"+i+"' type='button'>Copy This Ad</button></span></div>" +
      "<div class='vbody'><div class='vfields'>" +
      (v.ai ? "<p class='subnote' style='margin:0 0 10px'>" +
        esc(v.ai.model ? "Written by " + v.ai.model : "AI draft") +
        (typeof v.ai.score === "number" ? " · judge score " + v.ai.score + "/10" : "") +
        (v.ai.notes ? " · " + esc(v.ai.notes) : "") + "</p>" : "") +

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

      "<div class='frow'><div class='flabel'><span>Improvements &amp; corrections</span>" +
        (aiInvoke ? "<button class='copybtn' data-act='remix' data-i='"+i+"' type='button'>Apply With AI</button>" : "") + "</div>" +
        "<textarea data-notes-input='"+i+"' rows='2' placeholder='Note fixes for this variant: wrong emphasis, swap the verse, lead with ESA, and so on.'>"+esc(v.notes||"")+"</textarea>" +
        "<div class='subnote' id='remixNote"+i+"'>"+(aiInvoke ? "Apply With AI rewrites this draft using your notes. Notes also ride along in every export." : "Notes ride along in every export.")+"</div></div>" +

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
    const ni = e.target.dataset && e.target.dataset.notesInput;
    if (ni !== undefined){ const nv = variants[+ni]; if (nv) nv.notes = e.target.value; return; }
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
      "\nURL: " + v.url +
      (v.notes && v.notes.trim() ? "\nFOUNDER NOTES: " + v.notes.trim() : "");
  }
  function copyText(str){
    const done = () => showToast("Copied"); /* hoisted from the guided-flow block */
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
    cta:"Preorder Now", domain:"edeninstitute.health/homeschool", photo:null,
    dest:"https://edeninstitute.health/homeschool?utm_source=facebook&utm_medium=paid_social&utm_campaign=edens_table_kit&utm_content=creative",
    qr:false};

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

  /* QR for print collateral: generated async and cached; drawAd repaints when
     the image is ready. */
  const qrCache = { url: "", img: null as any };
  function ensureQr(){
    if (!BUILDER.qr || !BUILDER.dest || qrCache.url === BUILDER.dest) return;
    const want = BUILDER.dest;
    QRCode.toDataURL(want, { margin: 0, width: 260, color: { dark: "#1E1E14", light: "#FFFFFF" } })
      .then(u => {
        const im = new Image();
        im.onload = () => { qrCache.url = want; qrCache.img = im; drawAd(); };
        im.src = u;
      })
      .catch(() => {});
  }
  function paintQr(ctx, w, h){
    ensureQr();
    if (!qrCache.img || qrCache.url !== BUILDER.dest) return;
    const size = Math.round(w * 0.13), pad = 14;
    const x = 72, y = h - 72 - size - pad * 2;
    ctx.fillStyle = "#FFFFFF";
    rr(ctx, x, y, size + pad * 2, size + pad * 2, 8); ctx.fill();
    ctx.drawImage(qrCache.img, x + pad, y + pad, size, size);
  }
  function drawAd(){
    const cv = $("#adCanvas"); const s = SIZES[BUILDER.size];
    cv.width = s.w; cv.height = s.h;
    const ctx = cv.getContext("2d");
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (BUILDER.tpl === "label") drawLabel(ctx, s.w, s.h);
    else if (BUILDER.tpl === "forest") drawForest(ctx, s.w, s.h);
    else drawPhoto(ctx, s.w, s.h);
    if (BUILDER.qr && BUILDER.dest) paintQr(ctx, s.w, s.h);
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
    const cc = $("#ccUrl"); if (cc && document.activeElement !== cc) cc.value = BUILDER.dest;
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
  $("#bCanvaOpen").addEventListener("click", () => {
    const s = SIZES[BUILDER.size];
    window.open("https://www.canva.com/design?create=true&width=" + s.w + "&height=" + s.h + "&units=px", "_blank", "noopener");
  });

  /* ── Make it clickable ── */
  function ccSet(msg){ const el = $("#ccStatus"); if (el) el.textContent = msg; }
  function collateralName(){ const s = SIZES[BUILDER.size]; return "eden-ad-" + BUILDER.tpl + "-" + s.w + "x" + s.h + ".png"; }
  $("#ccUrl").addEventListener("input", e => { BUILDER.dest = e.target.value.trim(); if (BUILDER.qr) drawAd(); });
  $("#ccQr").addEventListener("change", e => { BUILDER.qr = e.target.checked; drawAd(); });
  $("#ccPublish").addEventListener("click", () => {
    if (!assets || !assets.publish){ ccSet("Publishing runs on the live /studio page."); return; }
    ccSet("Publishing…");
    $("#adCanvas").toBlob(async b => {
      if (!b){ ccSet("Could not read the canvas."); return; }
      try{
        const hosted = await assets.publish(b, collateralName());
        const dest = BUILDER.dest || "https://edeninstitute.health";
        const snippet = '<a href="' + dest.replace(/"/g, "&quot;") + '" target="_blank" rel="noopener">' +
          '<img src="' + hosted + '" alt="' + BUILDER.hook.replace(/"/g, "&quot;") + '" width="540" ' +
          'style="display:block;width:100%;max-width:540px;height:auto;border:0"></a>';
        $("#ccResults").innerHTML =
          "<div class='frow' style='margin-top:10px'><div class='flabel'><span>Hosted image URL</span><button class='copybtn' data-cc='" + esc(hosted) + "' type='button'>Copy</button></div>" +
          "<input type='text' readonly value=\"" + esc(hosted) + "\"></div>" +
          "<div class='frow'><div class='flabel'><span>Click-wrapped HTML (email &amp; web)</span><button class='copybtn' data-cc='" + esc(snippet) + "' type='button'>Copy</button></div>" +
          "<textarea rows='3' readonly>" + esc(snippet) + "</textarea></div>";
        ccSet("Published. The image URL is permanent and public; the snippet drops straight into Resend emails or any page.");
      }catch(err){ ccSet("Publish failed: " + String((err && (err as any).message) || err).slice(0, 140)); }
    }, "image/png");
  });
  $("#ccHtml").addEventListener("click", () => {
    const dest = BUILDER.dest || "https://edeninstitute.health";
    const dataUri = $("#adCanvas").toDataURL("image/png");
    const htmlDoc = "<!doctype html>\n<html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>" + esc(BUILDER.hook) + "</title></head>" +
      "<body style=\"margin:0;background:#F5EDD6;display:flex;justify-content:center\">" +
      "<a href=\"" + dest.replace(/"/g, "&quot;") + "\" target=\"_blank\" rel=\"noopener\" style=\"display:block;max-width:1080px;width:100%\">" +
      "<img src=\"" + dataUri + "\" alt=\"" + esc(BUILDER.hook) + "\" style=\"display:block;width:100%;height:auto\"></a></body></html>";
    const blob = new Blob([htmlDoc], { type: "text/html" });
    const a = document.createElement("a");
    a.download = collateralName().replace(/\.png$/, "") + "-clickable.html";
    a.href = URL.createObjectURL(blob);
    a.click();
    ccSet("Clickable HTML saved. Open it anywhere; the whole image links to your URL.");
  });
  root.addEventListener("click", e => {
    const t = e.target as any;
    if (t && t.dataset && t.dataset.cc !== undefined) copyText(t.dataset.cc);
  });
  root.addEventListener("click", e => {
    const t = e.target;
    if (t.dataset && t.dataset.act === "tobuilder"){
      const v = variants[+t.dataset.i]; if (!v) return;
      BUILDER.hook = v.headline;
      BUILDER.sub = v.desc;
      BUILDER.cta = v.cta;
      BUILDER.dest = v.url;
      BUILDER.domain = v.url.replace(/^https?:\/\//,"").split("?")[0];
      BUILDER.size = state.format === "story" ? "story" : (state.format === "portrait" ? "portrait" : "feed");
      renderBuilder();
      showStep(2);
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
      showStep(3);
    }
  });

  /* ───────────────────────── AI ENGINE ───────────────────────── */
  const AI = { on: false, providers: [] as any[] };
  let aiSeq = 0; /* supersedes stale in-flight generations */
  function aiSet(msg){ const el = $("#aiStatus"); if (el) el.textContent = msg; }
  function aiErrText(e){
    const code = (e && e.code) || "";
    const status = e && e.status;
    if (code === "founder_only" || status === 403) return "Founder account required.";
    if (code === "no_providers" || status === 503) return "No model keys configured yet. Add the Supabase secrets, then redeploy studio-generate.";
    if (code === "all_models_failed") return "Every model call failed" + (e.detail ? ": " + String(JSON.stringify(e.detail)).slice(0, 140) : ".");
    const msg = (e && (e.message || e.error)) || String(e);
    return "AI engine error: " + String(msg).slice(0, 160);
  }
  function currentBrief(){
    const p = PRODUCTS[state.product];
    return {
      product: p.name,
      facts: p.facts,
      angle: ANGLES[state.angle] ? ANGLES[state.angle].name : state.angle,
      angleEssence: ANGLES[state.angle] ? ANGLES[state.angle].visual : "",
      audience: AUDIENCES[state.audience].name,
      audienceDesc: AUDIENCES[state.audience].note.replace(/<[^>]+>/g, ""),
      objective: OBJECTIVES[state.objective].name,
      format: FORMATS[state.format].name,
      cta: p.ctas[state.objective],
      url: buildURL(p, 1),
    };
  }
  async function aiInit(){
    const panel = $("#aiPanel"); if (!panel) return;
    if (!aiInvoke){ panel.style.display = "none"; return; }
    try{
      const s: any = await aiInvoke({ mode: "status" });
      /* The studio may have unmounted during the await. */
      if (!root.isConnected || !$("#aiModels") || !$("#aiGenBtn")) return;
      AI.providers = (s && s.providers) || [];
      const chips = $("#aiModels");
      if (!AI.providers.length){
        chips.textContent = "no model keys configured";
        aiSet("Add ANTHROPIC_API_KEY and MOONSHOT_API_KEY as Supabase secrets, then redeploy studio-generate.");
        $("#aiGenBtn").disabled = true;
        return;
      }
      AI.on = true;
      chips.textContent = AI.providers.map(p => p.label + " (" + p.model + ")").join(" · ");
      aiSet("Each run fans the brief out to every model, then a judge ranks all candidates.");
    }catch(e){
      const chips = $("#aiModels"), gbtn = $("#aiGenBtn");
      if (!chips || !gbtn) return;
      chips.textContent = "engine unreachable";
      aiSet(aiErrText(e));
      gbtn.disabled = true;
    }
  }
  $("#aiGenBtn").addEventListener("click", async () => {
    if (!AI.on || !aiInvoke) return;
    const btn = $("#aiGenBtn"); btn.disabled = true;
    aiSet("Generating with " + AI.providers.map(p => p.label).join(" + ") + ". Roughly 30 to 60 seconds…");
    /* Capture the campaign AT CLICK TIME: the founder can change product or
       objective during the 30-60s call, and drafts must keep the brief they
       were written for (URL, CTA, labels included). */
    const p = PRODUCTS[state.product];
    const obj = state.objective;
    const ang = state.angle;
    const mySeq = ++aiSeq;
    try{
      const r: any = await aiInvoke({ mode: "generate", brief: currentBrief() });
      if (mySeq !== aiSeq){ btn.disabled = false; return; /* superseded by a newer run */ }
      const drafts = (r && r.drafts) || [];
      if (!drafts.length){
        aiSet("No drafts came back" + (r && r.error ? " (" + r.error + ")." : "."));
        btn.disabled = false; return;
      }
      variants = drafts.slice(0, 3).map((d, i) => ({
        primary: d.primary, headline: d.headline, desc: d.description || "",
        cta: p.ctas[obj], url: buildURL(p, i + 1),
        platform: "fb", expanded: false,
        ai: { model: d.model, score: d.score, notes: d.notes },
      }));
      state.gen++;
      $("#emptyState").hidden = true;
      $("#copyAllBtn").hidden = false;
      $("#benchTitle").textContent = p.name + " · " + (ANGLES[ang] ? ANGLES[ang].name : "") + " · AI drafts";
      renderVariants();
      const failNote = (r.errors && r.errors.length)
        ? " Note: " + r.errors.length + " model call" + (r.errors.length > 1 ? "s" : "") + " failed (" + String(r.errors[0]).slice(0, 90) + ")."
        : "";
      aiSet((r.judge && r.judge !== "none (single pass)" ? "Judged by " + r.judge + ". " : "") +
        drafts.length + " candidates ranked, showing the top " + Math.min(3, drafts.length) + "." + failNote);
    }catch(e){
      aiSet(aiErrText(e));
    }
    btn.disabled = false;
  });
  root.addEventListener("click", e => {
    const t = e.target as any;
    if (!(t && t.dataset && t.dataset.act === "remix")) return;
    const i = +t.dataset.i; const v = variants[i];
    if (!v || !aiInvoke) return;
    const note = $("#remixNote" + i);
    if (!AI.on){ if (note) note.textContent = "No model keys configured yet. Add the Supabase secrets first."; return; }
    const direction = (v.notes || "").trim();
    if (!direction){ if (note) note.textContent = "Write your improvements above first."; return; }
    t.disabled = true;
    if (note) note.textContent = "Remixing…";
    const myVariants = variants; /* detect regeneration while in flight */
    aiInvoke({ mode: "remix", brief: currentBrief(), draft: { primary: v.primary, headline: v.headline, description: v.desc }, direction })
      .then((r: any) => {
        if (variants !== myVariants || variants[i] !== v){
          aiSet("Drafts changed while a remix was in flight; that result was discarded.");
          return;
        }
        if (r && r.draft){
          v.primary = r.draft.primary;
          v.headline = r.draft.headline || v.headline;
          v.desc = r.draft.description || v.desc;
          v.ai = { model: r.draft.model, notes: "remixed: " + direction.slice(0, 80) };
          renderVariants();
          const n2 = $("#remixNote" + i);
          if (n2) n2.textContent = "Applied. Your notes are kept for the next pass.";
        } else if (note) note.textContent = "Remix failed.";
      })
      .catch(e => { if (note) note.textContent = aiErrText(e); })
      .finally(() => { t.disabled = false; });
  });

  /* ───────────────────────── GUIDED FLOW ───────────────────────── */
  const APPROVED: any[] = [];
  const AUTOPICK = {
    kit: { audience: "homeschool", angle: "children" },
    course: { audience: "mom2am", angle: "design" },
    quiz: { audience: "mom2am", angle: "design" },
    apothecary: { audience: "exhausted", angle: "exhausted" },
    practitioner: { audience: "practitioner", angle: "notworkshop" },
  };
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  function showToast(msg){
    const el = $("#toast"); if (!el) return;
    el.textContent = msg;
    el.classList.add("show");
    setTimeout(() => el.classList.remove("show"), 1400);
  }
  function heroRender(){
    const wrapEl = $("#heroGoals"); if (!wrapEl) return;
    wrapEl.innerHTML = "";
    for (const [id, p] of Object.entries(PRODUCTS)){
      const b = document.createElement("button");
      b.type = "button";
      b.className = "goalcard" + (state.product === id ? " sel" : "");
      b.innerHTML = "<span class='gname'>" + esc(p.name) + "</span><span class='gtag'>" + esc(p.tag) + "</span>";
      b.addEventListener("click", () => {
        state.product = id;
        if (!PRODUCTS[id].angles.includes(state.angle)) state.angle = PRODUCTS[id].angles[0];
        renderCampaign();
      });
      wrapEl.appendChild(b);
    }
  }
  async function heroGo(){
    const hs = $("#heroStatus");
    const pick = AUTOPICK[state.product];
    if (pick){ state.audience = pick.audience; state.angle = pick.angle; renderCampaign(); }
    if (hs) hs.textContent = "Reading the brand: positioning, voice, guardrails…";
    const scanEl = root.querySelector(".scan"); if (scanEl) (scanEl as any).open = true;
    await sleep(900);
    if (hs) hs.textContent = "Casting " + PRODUCTS[state.product].name + " for " + AUDIENCES[state.audience].name + ", " + ANGLES[state.angle].name + " angle…";
    await sleep(800);
    if (AI.on){
      if (hs) hs.textContent = "Writing with " + AI.providers.map(p => p.label).join(" + ") + ", then judging every draft…";
      ($("#aiGenBtn") as any).click();
    } else {
      if (hs) hs.textContent = "Drafting from the critic-approved copy bank…";
      generate();
    }
    showStep(1);
    await sleep(1400);
    if (hs) hs.textContent = "Drafts are on the workbench. Approve the keepers; write corrections on the rest. Fine controls stay in The Campaign panel.";
  }
  $("#heroGo").addEventListener("click", heroGo);
  function trayExport(a){
    return "EDEN AD STUDIO · APPROVED · " + a.product +
      "\n\nPRIMARY TEXT:\n" + a.primary +
      "\n\nHEADLINE: " + a.headline +
      "\nDESCRIPTION: " + a.desc +
      "\nCTA: " + a.cta +
      "\nURL: " + a.url +
      (a.notes ? "\nFOUNDER NOTES: " + a.notes : "");
  }
  function trayRender(){
    const panel = $("#trayPanel"), list = $("#trayList"), count = $("#trayCount");
    if (!panel || !list) return;
    (panel as any).hidden = APPROVED.length === 0;
    if (count) count.textContent = APPROVED.length + (APPROVED.length === 1 ? " ad approved" : " ads approved");
    list.innerHTML = APPROVED.map((a, i) =>
      "<div class='tray-item'><div><div class='th'>" + esc(a.headline) + "</div>" +
      "<div class='tp'>" + esc(a.product) + " · " + esc(a.primary.slice(0, 90)) + "…</div></div>" +
      "<span style='display:flex;gap:6px;flex-wrap:wrap'>" +
      "<button class='copybtn' data-tray='copy' data-ti='" + i + "' type='button'>Copy</button>" +
      "<button class='copybtn' data-tray='remove' data-ti='" + i + "' type='button'>Remove</button>" +
      "</span></div>"
    ).join("");
  }
  root.addEventListener("click", e => {
    const t = e.target as any;
    if (t && t.dataset && t.dataset.act === "approve"){
      const i = +t.dataset.i; const v = variants[i];
      if (!v || v.approved) return;
      v.approved = true;
      APPROVED.push({
        product: PRODUCTS[state.product].name,
        primary: v.primary, headline: v.headline, desc: v.desc,
        cta: v.cta, url: v.url, notes: (v.notes || "").trim(),
      });
      renderVariants();
      trayRender();
      showToast("Approved ✓");
      return;
    }
    const ta = t && t.dataset && t.dataset.tray;
    if (!ta) return;
    const i = +t.dataset.ti;
    if (ta === "copy" && APPROVED[i]) copyText(trayExport(APPROVED[i]));
    if (ta === "remove"){ APPROVED.splice(i, 1); trayRender(); }
  });
  $("#trayCopyAll").addEventListener("click", () => {
    if (APPROVED.length) copyText(APPROVED.map(trayExport).join("\n\n" + "─".repeat(46) + "\n\n"));
  });

  /* ───────────────────────── WIZARD ───────────────────────── */
  const WIZ = [
    { ids: ["#heroPanel"], cls: [".scan"], hint: "Pick a product, then Build My Campaign." },
    { cls: [".studio"], hint: "Approve the keepers; write corrections and Apply With AI on the rest." },
    { ids: ["#galleryPanel", "#builder"], hint: "Render the image, publish clickable links, or hand off to Canva." },
    { ids: ["#videobuilder"], hint: "Optional: record a credits-style video ad, or continue past it." },
    { ids: ["#trayPanel", "#postPanel"], cls: [".refrow"], hint: "Copy your approved package and open Meta to publish." },
  ];
  let wstep = 0;
  function showStep(n){
    wstep = Math.max(0, Math.min(WIZ.length - 1, n));
    WIZ.forEach((s, i) => {
      const els: any[] = [];
      (s.ids || []).forEach(sel => { const el = $(sel); if (el) els.push(el); });
      (s.cls || []).forEach(sel => root.querySelectorAll(sel).forEach(el => els.push(el)));
      els.forEach(el => { el.style.display = (i === wstep) ? "" : "none"; });
    });
    root.querySelectorAll("#wizSteps .step").forEach((b: any, i) => {
      b.classList.toggle("active", i === wstep);
      b.classList.toggle("done", i < wstep);
    });
    const back = $("#wizBack"), next = $("#wizNext"), hint = $("#wizHint");
    if (back) back.style.visibility = wstep === 0 ? "hidden" : "visible";
    if (next) next.textContent = wstep === WIZ.length - 1 ? "Start a New Campaign" : "Continue →";
    if (hint) hint.textContent = WIZ[wstep].hint;
    window.scrollTo({ top: 0, behavior: "smooth" });
    /* Let the React chrome follow the core's own advances (heroGo jumps here). */
    try { host && host.onStep && host.onStep(wstep); } catch (e) {}
  }
  root.querySelectorAll("#wizSteps .step").forEach((b: any) => {
    b.addEventListener("click", () => showStep(+b.dataset.w));
  });
  $("#wizBack").addEventListener("click", () => showStep(wstep - 1));
  $("#wizNext").addEventListener("click", () => showStep(wstep === WIZ.length - 1 ? 0 : wstep + 1));

  /* ── Post: hand off to Meta's own surfaces with the package on the clipboard ── */
  const EDEN_FB = "https://www.facebook.com/TheEdenInstituteBiblicalHerbalism";
  const EDEN_IG = "https://www.instagram.com/the_eden_institute/";
  root.addEventListener("click", e => {
    const t = e.target as any;
    const act = t && t.dataset && t.dataset.post;
    if (!act) return;
    const ps = $("#postStatus");
    const pkg = APPROVED.length
      ? APPROVED.map(trayExport).join("\n\n" + "─".repeat(46) + "\n\n")
      : "";
    if ((act === "ads" || act === "suite") && !pkg){
      if (ps) ps.textContent = "Approve at least one draft first (the Drafts screen).";
      return;
    }
    if (pkg && (act === "ads" || act === "suite")) copyText(pkg);
    const urls = {
      ads: "https://www.facebook.com/adsmanager/creation",
      suite: "https://business.facebook.com/latest/composer",
      fb: EDEN_FB,
      ig: EDEN_IG,
      share: "https://www.facebook.com/sharer/sharer.php?u=" +
        encodeURIComponent((APPROVED[0] && APPROVED[0].url) || "https://edeninstitute.health/homeschool"),
    };
    window.open(urls[act], "_blank", "noopener");
    if (ps) ps.textContent =
      act === "ads" ? "Package copied. In Ads Manager, paste the primary text, headline, and description into the ad setup and attach your creative." :
      act === "suite" ? "Package copied. Business Suite composes to Facebook and Instagram together." : "";
  });

  /* ───────────────────────── ASSET GALLERY ───────────────────────── */
  function galSet(msg){ const el = $("#galStatus"); if (el) el.textContent = msg; }
  const GAL_VIDEO_RE = /\.(mp4|webm|mov|m4v)$/i;
  async function galRender(){
    if (!assets) return;
    const grid = $("#galGrid");
    try{
      const items = await assets.list();
      if (!items.length){
        grid.innerHTML = "";
        galSet("Nothing here yet. Upload product photos, mockups, or clips and they stay available every session.");
        return;
      }
      const tiles = await Promise.all(items.map(async it => {
        let u = "";
        try { u = await assets.url(it.name); } catch(e) {}
        const isVid = GAL_VIDEO_RE.test(it.name);
        return "<div class='galitem'>" +
          (isVid ? "<video muted playsinline preload='metadata' src='"+esc(u)+"'></video>"
                 : "<img loading='lazy' alt='' src='"+esc(u)+"'>") +
          "<span class='galname'>"+esc(it.name.replace(/^\d+-/, ""))+"</span>" +
          "<span class='galbtns'>" +
            (isVid ? "<button class='copybtn' data-gal='clip' data-name='"+esc(it.name)+"' type='button'>Use as Clip</button>"
                   : "<button class='copybtn' data-gal='photo' data-name='"+esc(it.name)+"' type='button'>Use as Photo</button>") +
            "<button class='copybtn' data-gal='del' data-name='"+esc(it.name)+"' type='button'>Delete</button>" +
          "</span></div>";
      }));
      grid.innerHTML = tiles.join("");
      galSet(items.length + " assets. Photos feed the Photo Harvest template and video backgrounds; clips feed the Video Builder.");
    }catch(e){
      galSet("Gallery unavailable: " + String((e && (e as any).message) || e).slice(0, 140));
    }
  }
  function galInit(){
    const panel = $("#galleryPanel"); if (!panel) return;
    if (!assets){ panel.style.display = "none"; return; }
    $("#galUpload").addEventListener("change", async e => {
      const files = Array.from((e.target as any).files || []) as File[];
      if (!files.length) return;
      for (let i = 0; i < files.length; i++){
        galSet("Uploading " + (i+1) + " of " + files.length + ": " + files[i].name + "…");
        try { await assets.upload(files[i]); }
        catch(err){ galSet("Upload failed for " + files[i].name + ": " + String((err && (err as any).message) || err).slice(0, 120)); }
      }
      (e.target as any).value = "";
      galRender();
    });
    $("#galRefresh").addEventListener("click", galRender);
    root.addEventListener("click", async e => {
      const t = e.target as any;
      const act = t && t.dataset && t.dataset.gal;
      if (!act) return;
      const name = t.dataset.name;
      if (act === "del"){
        if (!t.dataset.confirm){
          t.dataset.confirm = "1"; t.textContent = "Really delete?";
          setTimeout(() => { t.dataset.confirm = ""; t.textContent = "Delete"; }, 2500);
          return;
        }
        try { await assets.remove(name); galRender(); } catch(err){ galSet("Delete failed."); }
        return;
      }
      try{
        const u = await assets.url(name);
        if (act === "photo"){
          const img = new Image();
          img.crossOrigin = "anonymous"; /* keeps the export canvas untainted */
          img.onload = () => {
            BUILDER.photo = img; BUILDER.tpl = "photo";
            VB.photo = img;
            renderBuilder(); drawVideoStill();
            galSet("Photo loaded into both builders.");
          };
          img.onerror = () => galSet("Could not load that image.");
          img.src = u;
        } else if (act === "clip"){
          vClipEl.crossOrigin = "anonymous";
          vClipEl.src = u;
          vClipEl.onloadeddata = () => { VB.bg = "clip"; renderVB(); galSet("Clip loaded into the Video Builder."); };
        }
      }catch(err){ galSet("Could not open that asset."); }
    });
    galRender();
  }

  /* ───────────────────────── INIT ───────────────────────── */
  renderCampaign();
  renderBuilder();
  renderVB();
  aiInit();
  galInit();
  showStep(0);

  /* ───────────────────────── PHASE 1 SEAM ─────────────────────────
     The React shell owns the project row, saving, and the archive. It reaches
     the working session only through these four calls. Everything here is
     plain data: decoded Images, MediaStreams, and the AudioContext never cross
     the boundary, so a snapshot is always JSON-safe. */

  function getState(): StudioStateBlob {
    return {
      campaign: {
        product: state.product, objective: state.objective,
        audience: state.audience, angle: state.angle,
        format: state.format, gen: state.gen,
      },
      /* variants and APPROVED are already plain objects; the round-trip is a
         cheap guarantee that nothing non-serializable has crept in. */
      variants: JSON.parse(JSON.stringify(variants)),
      approved: JSON.parse(JSON.stringify(APPROVED)),
      builder: {
        tpl: BUILDER.tpl, size: BUILDER.size, hook: BUILDER.hook,
        sub: BUILDER.sub, cta: BUILDER.cta, domain: BUILDER.domain,
        dest: BUILDER.dest, qr: !!BUILDER.qr,
      },
      step: wstep,
    };
  }

  function applyState(blob: StudioStateBlob | null | undefined){
    if (!blob) return;
    const c = blob.campaign || {};
    /* Guard every restored key against the live vocabularies: a project saved
       before a product or angle was renamed must not wedge the studio. */
    if (c.product && PRODUCTS[c.product]) state.product = c.product;
    if (c.objective && OBJECTIVES[c.objective]) state.objective = c.objective;
    if (c.audience && AUDIENCES[c.audience]) state.audience = c.audience;
    if (c.angle && ANGLES[c.angle] && PRODUCTS[state.product].angles.includes(c.angle)) state.angle = c.angle;
    else state.angle = PRODUCTS[state.product].angles[0];
    if (c.format && FORMATS[c.format]) state.format = c.format;
    state.gen = typeof c.gen === "number" ? c.gen : 0;

    variants = Array.isArray(blob.variants) ? blob.variants : [];
    APPROVED.length = 0;
    if (Array.isArray(blob.approved)) APPROVED.push.apply(APPROVED, blob.approved);

    const b = blob.builder || {};
    ["tpl","size","hook","sub","cta","domain","dest"].forEach(k => {
      if (typeof b[k] === "string") BUILDER[k] = b[k];
    });
    BUILDER.qr = !!b.qr;

    renderCampaign();
    if (variants.length){
      $("#emptyState").hidden = true;
      $("#copyAllBtn").hidden = false;
      $("#benchTitle").textContent = PRODUCTS[state.product].name + " · " + ANGLES[state.angle].name;
      renderVariants();
    }
    trayRender();
    /* renderBuilder() pushes BUILDER back into #bHook/#bSub/#bCta/#bDomain and
       repaints; the clickable-collateral controls live outside it. */
    renderBuilder();
    const cc = $("#ccUrl"); if (cc) (cc as any).value = BUILDER.dest;
    const cq = $("#ccQr"); if (cq) (cq as any).checked = !!BUILDER.qr;
  }

  return {
    destroy(){
      try { stopRun(); } catch (e) {}
      try { musicEl.pause(); narrEl.pause(); vClipEl.pause(); } catch (e) {}
      try { if (audioCtx) audioCtx.close(); } catch (e) {}
    },
    getState,
    applyState,
    getStep(){ return wstep; },
    showStep(n){ showStep(n); },
  };
}
