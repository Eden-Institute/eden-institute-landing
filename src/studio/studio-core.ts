// @ts-nocheck
/* eslint-disable */
import QRCode from "qrcode";
import type { StudioHandle, StudioStateBlob } from "./studio-types";
import { safeZipName, zipStore } from "./studio-zip";
import {
  ANGLES, AUDIENCES, OBJECTIVES, FORMATS, PRODUCTS, SERIF, SIZES, TEMPLATES,
} from "./studio-banks";
// Eden Ad Studio core. Ported from the standalone artifact build (2026-07-17).
// Vanilla DOM app mounted by StudioWorkroom.tsx; all queries and listeners are
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
  host?: {
    onStep?: (n: number) => void;
    /** The wizard's last-step button. The shell decides what "done" means. */
    onFinish?: () => void;
  },
  /** Phase 3 Canva bridge, pre-bound to the active project by the shell. */
  canva?: {
    projectId: string;
    designId: string | null;
    editUrl: string | null;
    status: () => Promise<{ connected: boolean }>;
    beginConnect: () => Promise<void>;
    exportToCanva: (i: {
      pngBase64: string; title: string; width: number; height: number;
      assetId?: string | null;
    }) => Promise<{ designId: string; editUrl: string | null }>;
    reimportFromCanva: () => Promise<{ assetId: string; url: string | null }>;
  },
  /** Phase 7: records finished exports so the archive knows what shipped. */
  exports?: {
    record: (files: Array<{
      format: string; aspect_ratio: string; width: number; height: number;
      bytes: Uint8Array; name: string;
    }>) => Promise<void>;
  },
): StudioHandle {
  "use strict";
  /* ───────────────────────── DATA ───────────────────────── */


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
    {lvl:"caution", re:/!{2,}/, msg:"Multiple exclamation marks read as hype. Eden speaks with quiet confidence.",
     fix: (s) => s.replace(/!{2,}/g, "!")},
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
    /* `fix` marks a rule as mechanically correctable, which is what powers the
       one-click Fix button. Rules without one need a human rewrite and must
       never be "fixed" automatically. Nothing is ever changed silently. */
    {lvl:"voice", re:/—/, msg:"Em dash. Eden copy uses commas and periods instead (house rule).",
     fix: (s) => s.replace(/\s*—\s*/g, ", ")},
    {lvl:"voice", re:/–/, msg:"En dash used as punctuation. Use a comma or a period.",
     fix: (s) => s.replace(/\s*–\s*(?=[A-Za-z])/g, ", ")},
    {lvl:"voice", re:/ {2,}/, msg:"Double spaces.", fix: (s) => s.replace(/[ \t]{2,}/g, " ")}
  ];

  /* ───────────────────────── STATE ───────────────────────── */
  /* direction = the founder's own words for where this campaign should go. It
     outranks the preset angle in the AI brief. touched = she has picked an
     audience or angle herself, so the guided flow must stop overriding them. */
  const state = {product:"kit", objective:"sales", audience:"homeschool", angle:"children", format:"portrait", gen:0,
    direction:"", touched:false};
  let variants = [];
  const $ = s => root.querySelector(s);
  // Escapes for HTML text AND attribute contexts. The single-quote escape is
  // load-bearing: gallery tiles interpolate database-backed values (asset
  // filenames, which originate from uploaded/reimported files) into
  // single-quoted attributes, so a filename containing an apostrophe must not be
  // able to close the attribute and inject markup.
  const esc = s => String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
  // A destination URL only becomes a clickable anchor if it is http(s). A
  // javascript: or data: URL pasted into an exported email or HTML file would
  // execute on click, so anything else falls back to the site root.
  const safeHref = u => {
    try { const p = new URL(u); return p.protocol === "https:" || p.protocol === "http:" ? u : "https://edeninstitute.health"; }
    catch { return "https://edeninstitute.health"; }
  };

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
      ac.appendChild(chip(a.name, state.audience===id, () => {state.audience=id; state.touched=true; renderCampaign();}));
    $("#audNote").innerHTML = AUDIENCES[state.audience].note;
    const gc = $("#angleChips"); gc.innerHTML = "";
    for (const id of PRODUCTS[state.product].angles)
      gc.appendChild(chip(ANGLES[id].name, state.angle===id, () => {state.angle=id; state.touched=true; renderCampaign();}));
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
    variants.forEach((v,i) => {
      const card = variantCard(v,i);
      /* Edited-from-her-draft variants carry an explanation. Showing what moved
         and why is the difference between an editor and a slot machine. */
      if (v.changes && v.changes.length){
        const box = document.createElement("div");
        box.className = "changes";
        box.innerHTML = "<h4>What changed" + (v.approach ? " · " + esc(String(v.approach)) : "") + "</h4><ul>" +
          v.changes.map(c => "<li>" + esc(String(c)) + "</li>").join("") + "</ul>";
        card.appendChild(box);
      }
      host.appendChild(card);
    });
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
  /** Copy to the clipboard and report whether it actually landed. Callers that
   *  open a new tab must AWAIT this first: once the new tab takes focus, the
   *  browser refuses clipboard writes from this page and the copy silently
   *  does nothing. */
  async function copyText(str){
    if (navigator.clipboard && navigator.clipboard.writeText){
      try { await navigator.clipboard.writeText(str); showToast("Copied"); return true; }
      catch(e){ /* focus lost or permission refused; try the legacy path */ }
    }
    return fallbackCopy(str);
  }
  function fallbackCopy(str){
    const ta = document.createElement("textarea"); ta.value = str; ta.style.position = "fixed"; ta.style.opacity = "0";
    document.body.appendChild(ta); ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch(e){}
    document.body.removeChild(ta);
    if (ok) showToast("Copied");
    return ok;
  }

  /* ───────────────────────── CREATIVE BUILDER ───────────────────────── */
  const BUILDER = {tpl:"label", size:"portrait", hook:"Eden's Table: Herbalism for Kids",
    sub:"36 weeks. One herb at a time. Preorders open July 29.",
    cta:"Preorder Now", domain:"edeninstitute.health/homeschool", photo:null,
    dest:"https://edeninstitute.health/homeschool?utm_source=facebook&utm_medium=paid_social&utm_campaign=edens_table_kit&utm_content=creative",
    qr:false,
    /* Phase 2: which library asset the photo came from, and this project's
       non-destructive adjustments for it. Both null for a local file pick. */
    photoAssetId:null, transform:null};

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
      const img = BUILDER.photo;
      const t = BUILDER.transform;
      const c = (t && t.color_adjust) || {};
      const crop = (t && t.crop) || {};
      /* Phase 2: adjustments are applied here, at paint time, and never baked
         into the stored file. Save/restore so the overlays below are unaffected. */
      ctx.save();
      const filter = [
        c.brightness !== undefined && c.brightness !== 1 ? "brightness("+c.brightness+")" : "",
        c.contrast   !== undefined && c.contrast   !== 1 ? "contrast("+c.contrast+")"     : "",
        c.saturation !== undefined && c.saturation !== 1 ? "saturate("+c.saturation+")"   : "",
      ].filter(Boolean).join(" ");
      if (filter) { try { (ctx as any).filter = filter; } catch(e) {} }
      if (t && typeof t.opacity === "number" && t.opacity < 1) ctx.globalAlpha = t.opacity;
      const zoom = typeof crop.scale === "number" && crop.scale > 0 ? crop.scale : 1;
      const s = Math.max(w/img.width, h/img.height) * zoom;
      const dw = img.width*s, dh = img.height*s;
      const ox = (typeof crop.x === "number" ? crop.x : 0) * w;
      const oy = (typeof crop.y === "number" ? crop.y : 0) * h;
      ctx.drawImage(img, (w-dw)/2 + ox, (h-dh)/2 + oy, dw, dh);
      ctx.restore();
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
  /* Extracted so the same pipeline can paint an off-screen canvas at any size.
     Multi-size export re-renders rather than rescaling a bitmap, which is why
     text stays crisp at 9:16 after being placed at 4:5. Layer positions are
     stored 0..1 precisely so this works. */
  function paintAd(ctx, w, h){
    ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
    if (BUILDER.tpl === "label") drawLabel(ctx, w, h);
    else if (BUILDER.tpl === "forest") drawForest(ctx, w, h);
    else drawPhoto(ctx, w, h);
    if (BUILDER.qr && BUILDER.dest) paintQr(ctx, w, h);
    drawLayers(ctx, w, h);
  }
  function drawAd(){
    const cv = $("#adCanvas"); const s = SIZES[BUILDER.size];
    cv.width = s.w; cv.height = s.h;
    paintAd(cv.getContext("2d"), s.w, s.h);
    $("#dlMeta").textContent = s.w+" × "+s.h+" px · "+TEMPLATES[BUILDER.tpl]+" · downloads as PNG";
  }
  /** Render one size to an off-screen canvas and return its PNG bytes. */
  function renderSizeToPng(sizeId): Promise<Uint8Array> {
    const s = SIZES[sizeId];
    const cv = document.createElement("canvas");
    cv.width = s.w; cv.height = s.h;
    paintAd(cv.getContext("2d"), s.w, s.h);
    return new Promise((resolve, reject) => {
      cv.toBlob(async (blob) => {
        if (!blob) { reject(new Error("canvas produced no image")); return; }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      }, "image/png");
    });
  }

  /* ── Free-placed text layers (Phase 6) ───────────────────────────────────
     The templates give fixed zones, which is fast but rigid. Layers sit on top
     and can be dragged anywhere. Positions are stored 0..1 relative to the
     canvas so a layer keeps its place when the ad size changes. */
  const LAYER_FONTS = {
    display: {name:"Cinzel (display)", css:'"Cinzel Decorative","Cinzel",'+SERIF},
    serif:   {name:"EB Garamond (body)", css:'"EB Garamond",'+SERIF},
    mono:    {name:"Mono", css:'ui-monospace,"Cascadia Mono",Consolas,monospace'},
  };
  /* Palette is restricted to the locked brand kit on purpose: free placement
     should not become free colour. */
  const LAYER_COLORS = [
    {id:"linen",  name:"Warm Linen",  hex:"#F5EDD6"},
    {id:"forest", name:"Deep Forest", hex:"#2B3A1E"},
    {id:"amber",  name:"Golden Amber",hex:"#C5A44E"},
    {id:"ink",    name:"Near Black",  hex:"#1E1E14"},
    {id:"cream",  name:"Deep Cream",  hex:"#FAF6EE"},
  ];
  /* Fixed template zones, for when placement should be fast rather than free. */
  const LAYER_ZONES = {
    top:    {name:"Top third",    y:0.16},
    center: {name:"Centre",       y:0.50},
    lower:  {name:"Lower third",  y:0.72},
    bottom: {name:"Bottom strip", y:0.90},
  };
  let LAYERS = [];
  let layerSel = null;   /* selected layer id */
  let layerDrag = null;  /* { id, dx, dy } while dragging */

  function layerFont(l){
    return (l.weight || 700) + " " + Math.round(l.size) + "px " + (LAYER_FONTS[l.font] || LAYER_FONTS.display).css;
  }
  /** Bounding box in canvas pixels. Used for both hit-testing and the
   *  selection outline, so they can never disagree. */
  function layerBox(ctx, l, w, h){
    ctx.save();
    ctx.font = layerFont(l);
    const lines = String(l.text || "").split("\n");
    let maxW = 0;
    for (const ln of lines) maxW = Math.max(maxW, ctx.measureText(ln).width);
    ctx.restore();
    const lineH = l.size * 1.18;
    const boxH = lineH * lines.length;
    const cx = l.x * w, cy = l.y * h;
    const left = l.align === "left" ? cx : l.align === "right" ? cx - maxW : cx - maxW / 2;
    return { left, top: cy - boxH / 2, width: maxW, height: boxH, lines, lineH };
  }
  function drawLayers(ctx, w, h){
    for (const l of LAYERS){
      if (!String(l.text || "").trim()) continue;
      const box = layerBox(ctx, l, w, h);
      ctx.save();
      ctx.font = layerFont(l);
      ctx.textAlign = l.align || "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = (LAYER_COLORS.find(c => c.id === l.color) || LAYER_COLORS[0]).hex;
      if (l.shadow){
        ctx.shadowColor = "rgba(0,0,0,.55)";
        ctx.shadowBlur = Math.max(8, l.size * 0.25);
        ctx.shadowOffsetY = Math.max(2, l.size * 0.06);
      }
      const cx = l.x * w;
      box.lines.forEach((ln, i) => {
        const y = box.top + box.lineH * (i + 0.5);
        ctx.fillText(ln, cx, y);
      });
      ctx.restore();
    }
  }
  /* Canvas is displayed scaled; map pointer position into canvas pixels or the
     hit test drifts the moment the preview is not 1:1. */
  function canvasPoint(e){
    const cv = $("#adCanvas") as any;
    const r = cv.getBoundingClientRect();
    const p = (e.touches && e.touches[0]) || e;
    return {
      x: (p.clientX - r.left) * (cv.width / r.width),
      y: (p.clientY - r.top) * (cv.height / r.height),
    };
  }
  function layerAt(px, py){
    const cv = $("#adCanvas") as any;
    const ctx = cv.getContext("2d");
    /* Topmost first: later layers paint over earlier ones. */
    for (let i = LAYERS.length - 1; i >= 0; i--){
      const l = LAYERS[i];
      if (!String(l.text || "").trim()) continue;
      const b = layerBox(ctx, l, cv.width, cv.height);
      const pad = l.size * 0.35;
      if (px >= b.left - pad && px <= b.left + b.width + pad &&
          py >= b.top - pad && py <= b.top + b.height + pad) return l;
    }
    return null;
  }
  function layerPointerDown(e){
    if (!LAYERS.length) return;
    const p = canvasPoint(e);
    const hit = layerAt(p.x, p.y);
    if (!hit) return;
    e.preventDefault();
    const cv = $("#adCanvas") as any;
    layerSel = hit.id;
    layerDrag = { id: hit.id, dx: hit.x * cv.width - p.x, dy: hit.y * cv.height - p.y };
    layerList();
  }
  function layerPointerMove(e){
    if (!layerDrag) return;
    e.preventDefault();
    const cv = $("#adCanvas") as any;
    const p = canvasPoint(e);
    const l = LAYERS.find(x => x.id === layerDrag.id);
    if (!l) return;
    /* Clamp so a layer can never be dragged entirely off the canvas. */
    l.x = Math.min(Math.max((p.x + layerDrag.dx) / cv.width, 0.02), 0.98);
    l.y = Math.min(Math.max((p.y + layerDrag.dy) / cv.height, 0.02), 0.98);
    drawAd();
  }
  function layerPointerUp(){ if (layerDrag){ layerDrag = null; layerList(); } }

  /* The label template paints a Warm Linen ground; the forest and photo
     templates are dark. Defaulting every layer to linen made new text
     invisible on the label template, so the default follows the ground. */
  function defaultLayerColor(){
    return BUILDER.tpl === "label" ? "forest" : "linen";
  }
  function layerAdd(text){
    const id = "L" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
    const onLight = BUILDER.tpl === "label";
    LAYERS.push({
      id, text: text || "New text", x: 0.5, y: 0.5, size: 64,
      font: "display", color: defaultLayerColor(), align: "center", weight: 700,
      /* A drop shadow helps over photography and muddies flat backgrounds. */
      shadow: !onLight,
    });
    layerSel = id;
    layerList(); drawAd();
  }
  function layerSelected(){ return LAYERS.find(l => l.id === layerSel) || null; }
  function layerPatch(patch){
    const l = layerSelected(); if (!l) return;
    Object.assign(l, patch);
    layerList(); drawAd();
  }
  function layerList(){
    const host = $("#layerList"); if (!host) return;
    if (!LAYERS.length){
      host.innerHTML = "<p class='subnote' style='margin:0'>No text layers yet. The template's own headline and subhead still render underneath.</p>";
      const ed = $("#layerEditor"); if (ed) (ed as any).hidden = true;
      return;
    }
    host.innerHTML = LAYERS.map(l =>
      "<button class='layerrow" + (l.id === layerSel ? " sel" : "") + "' data-layer='" + esc(l.id) + "' type='button'>" +
      "<span class='lr-t'>" + esc(String(l.text || "").split("\n")[0].slice(0, 34) || "(empty)") + "</span>" +
      "<span class='lr-m'>" + Math.round(l.size) + "px · " + esc((LAYER_FONTS[l.font] || {}).name || l.font) + "</span>" +
      "</button>").join("");
    const l = layerSelected();
    const ed = $("#layerEditor");
    if (ed) (ed as any).hidden = !l;
    if (!l) return;
    ($("#lText") as any).value = l.text;
    ($("#lSize") as any).value = l.size;
    const sv = $("#lSizeV"); if (sv) sv.textContent = Math.round(l.size) + "px";
    ($("#lShadow") as any).checked = !!l.shadow;
    const fc = $("#lFontChips"); fc.innerHTML = "";
    for (const [id, f] of Object.entries(LAYER_FONTS))
      fc.appendChild(chip(f.name, l.font === id, () => layerPatch({font: id})));
    const cc = $("#lColorChips"); cc.innerHTML = "";
    for (const c of LAYER_COLORS)
      cc.appendChild(chip(c.name, l.color === c.id, () => layerPatch({color: c.id})));
    const ac = $("#lAlignChips"); ac.innerHTML = "";
    for (const a of ["left", "center", "right"])
      ac.appendChild(chip(a, l.align === a, () => layerPatch({align: a})));
    const zc = $("#lZoneChips"); zc.innerHTML = "";
    for (const [id, z] of Object.entries(LAYER_ZONES))
      zc.appendChild(chip(z.name, Math.abs(l.y - z.y) < 0.01, () => layerPatch({y: z.y, x: 0.5, align: "center"})));
  }

  /* ── Caption (Phase 6) ───────────────────────────────────────────────────
     Separate from anything painted on the canvas: this is the text she pastes
     into Instagram or Facebook after downloading the image. The AI button
     never fills it without a click, per the spec. */
  const CAPTION = { text: "" };
  function capSet(msg){ const el = $("#capStatus"); if (el) el.textContent = msg; }
  function capFlags(){
    const host = $("#capFlags"); if (!host) return;
    const text = CAPTION.text || "";
    if (!text.trim()){ host.innerHTML = ""; return; }
    const hits = checkText(text);
    if (!hits.length){
      host.innerHTML = "<p class='capclean'>Clean. No Meta policy flags, no Eden voice violations.</p>";
      return;
    }
    host.innerHTML = hits.map((h, i) =>
      "<div class='capflag " + h.lvl + "'>" +
        "<span>" + esc(h.msg) + "</span>" +
        /* Only offer Fix where a mechanical correction exists. Everything else
           is the founder's judgement, not a button. */
        (h.fix ? "<button class='copybtn' data-capfix='" + i + "' type='button'>Fix</button>" : "") +
      "</div>").join("");
  }
  function capRender(){
    const ta = $("#capText");
    if (ta && document.activeElement !== ta) (ta as any).value = CAPTION.text;
    const n = (CAPTION.text || "").length;
    const c = $("#capCount");
    if (c) c.textContent = n + " characters" + (n > 2200 ? " · over Instagram's 2,200 limit" : "");
    if (c) c.classList.toggle("over", n > 2200);
    capFlags();
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
    /* A local file pick is not a library asset, so it carries no saved
       adjustments and must not inherit the previous photo's. */
    img.onload = () => {
      BUILDER.photo = img; BUILDER.tpl = "photo";
      BUILDER.photoAssetId = null; BUILDER.transform = null;
      renderBuilder();
    };
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
  /* ── Multi-size export (Phase 7) ─────────────────────────────────────────
     One click renders all three Meta placements and packages them. Each size
     is a real re-render at native pixels, not an upscale of the preview. */
  const EXPORT_SIZES = [
    {id:"feed",     ratio:"1:1"},
    {id:"portrait", ratio:"4:5"},
    {id:"story",    ratio:"9:16"},
  ];
  function expSet(msg){ const el = $("#expStatus"); if (el) el.textContent = msg; }
  async function exportAllSizes(){
    const btn = $("#expAll") as any;
    if (btn) btn.disabled = true;
    const restore = BUILDER.size;
    try{
      expSet("Rendering three sizes…");
      const files = [];
      const meta = [];
      const stamp = new Date().toISOString().slice(0, 10);
      const base = safeZipName((BUILDER.hook || "eden-ad").slice(0, 40));
      for (const s of EXPORT_SIZES){
        const dims = SIZES[s.id];
        const bytes = await renderSizeToPng(s.id);
        const name = base + "-" + dims.w + "x" + dims.h + ".png";
        files.push({ name, data: bytes });
        meta.push({ format:"png", aspect_ratio:s.ratio, width:dims.w, height:dims.h, bytes, name });
      }
      const zipBytes = zipStore(files);
      const blob = new Blob([zipBytes], { type: "application/zip" });
      const a = document.createElement("a");
      a.download = base + "-" + stamp + "-all-sizes.zip";
      a.href = URL.createObjectURL(blob);
      a.click();
      /* Revoke on the next tick: revoking immediately can cancel the download
         in some browsers. */
      setTimeout(() => URL.revokeObjectURL(a.href), 30000);
      expSet("Downloaded all three sizes. Recording the export…");

      /* The download is the deliverable; the archive record is best-effort so
         a storage hiccup never costs her the files she already has. */
      if (exports && exports.record){
        try {
          await exports.record(meta);
          expSet("Downloaded all three sizes, and saved to your archive.");
        } catch(err){
          expSet("Downloaded all three sizes. Archive record failed: " +
            String((err as any)?.message || err).slice(0, 120));
        }
      } else {
        expSet("Downloaded all three sizes.");
      }
    }catch(err){
      expSet("Export failed: " + String((err as any)?.message || err).slice(0, 160));
    }finally{
      BUILDER.size = restore;
      renderBuilder();
      if (btn) btn.disabled = false;
    }
  }

  /* ── Text layer + caption wiring (Phase 6) ─────────────────────────────── */
  (function wireLayers(){
    const cv = $("#adCanvas");
    if (cv){
      cv.addEventListener("mousedown", layerPointerDown);
      cv.addEventListener("touchstart", layerPointerDown, {passive:false});
    }
    /* Move/up on the document so a fast drag that leaves the canvas still
       tracks, and always releases. */
    document.addEventListener("mousemove", layerPointerMove);
    document.addEventListener("touchmove", layerPointerMove, {passive:false});
    document.addEventListener("mouseup", layerPointerUp);
    document.addEventListener("touchend", layerPointerUp);

    const exp = $("#expAll"); if (exp) exp.addEventListener("click", exportAllSizes);
    const add = $("#lAdd"); if (add) add.addEventListener("click", () => layerAdd(BUILDER.hook || "New text"));
    const del = $("#lDel"); if (del) del.addEventListener("click", () => {
      LAYERS = LAYERS.filter(l => l.id !== layerSel); layerSel = LAYERS.length ? LAYERS[LAYERS.length-1].id : null;
      layerList(); drawAd();
    });
    const dup = $("#lDup"); if (dup) dup.addEventListener("click", () => {
      const l = layerSelected(); if (!l) return;
      const copy = Object.assign({}, l, {
        id: "L" + Date.now().toString(36), y: Math.min(l.y + 0.08, 0.96),
      });
      LAYERS.push(copy); layerSel = copy.id; layerList(); drawAd();
    });
    const txt = $("#lText"); if (txt) txt.addEventListener("input", e => {
      const l = layerSelected(); if (!l) return;
      l.text = (e.target as any).value; drawAd();
      /* Do not re-render the list on every keystroke: it would steal focus. */
    });
    const size = $("#lSize"); if (size) size.addEventListener("input", e => {
      const l = layerSelected(); if (!l) return;
      l.size = +(e.target as any).value;
      const sv = $("#lSizeV"); if (sv) sv.textContent = Math.round(l.size) + "px";
      drawAd();
    });
    const sh = $("#lShadow"); if (sh) sh.addEventListener("change", e => layerPatch({shadow: (e.target as any).checked}));

    root.addEventListener("click", e => {
      const id = (e.target as any)?.closest?.(".layerrow")?.dataset?.layer;
      if (id){ layerSel = id; layerList(); return; }
      const fi = (e.target as any)?.dataset?.capfix;
      if (fi !== undefined){
        /* Apply only the clicked rule's fix, and show the result rather than
           applying it silently. */
        const hits = checkText(CAPTION.text || "");
        const rule = hits[+fi];
        if (rule && rule.fix){
          CAPTION.text = rule.fix(CAPTION.text || "");
          capRender();
          capSet("Fixed. Nothing else was changed.");
        }
      }
    });

    const cap = $("#capText"); if (cap) cap.addEventListener("input", e => {
      CAPTION.text = (e.target as any).value; capRender();
    });
    const capCopy = $("#capCopy"); if (capCopy) capCopy.addEventListener("click", () => {
      if (!(CAPTION.text || "").trim()){ capSet("Nothing to copy yet."); return; }
      copyText(CAPTION.text); capSet("Caption copied.");
    });
    const capDraft = $("#capDraft"); if (capDraft) capDraft.addEventListener("click", () => {
      /* Draft from what she has already approved, not from a fresh model call:
         the tray is her own vetted copy. Never overwrites without asking. */
      const src = APPROVED.length ? APPROVED[APPROVED.length - 1]
        : (variants.find(v => v.approved) || variants[0]);
      if (!src){ capSet("Approve a draft first, or write the caption yourself."); return; }
      const draft = [src.primary, "", src.url].filter(Boolean).join("\n");
      if ((CAPTION.text || "").trim() &&
          !window.confirm("Replace the caption you have written?")) return;
      CAPTION.text = draft; capRender();
      capSet("Drafted from your approved ad copy. Edit freely.");
    });
  })();

  /* ── Canva round-trip (Phase 3) ──────────────────────────────────────────
     Replaces the old deep link, which only opened a BLANK design at the right
     size and left the founder to download a PNG and drag it in by hand. The
     creative is now uploaded to Canva as a real design, and the finished
     version comes back over the working image. */
  function canvaSet(msg){ const el = $("#canvaStatus"); if (el) el.textContent = msg; }
  function canvaShow(ids){
    ["#bCanvaSend", "#bCanvaOpenDesign", "#bCanvaReimport", "#bCanvaConnect"].forEach(sel => {
      const el = $(sel); if (el) (el as any).hidden = ids.indexOf(sel) < 0;
    });
  }
  function canvaRender(){
    const st = $("#canvaState");
    if (!canva || !canva.projectId){
      if (st) st.textContent = "unavailable";
      canvaShow([]);
      return;
    }
    if (!CANVA.connected){
      if (st) st.textContent = "not connected";
      canvaShow(["#bCanvaConnect"]);
      canvaSet("Connect once and the studio can hand designs to Canva and pull them back.");
      return;
    }
    if (st) st.textContent = "connected";
    canvaShow(CANVA.designId
      ? ["#bCanvaSend", "#bCanvaOpenDesign", "#bCanvaReimport"]
      : ["#bCanvaSend"]);
  }
  const CANVA = { connected: false, designId: null as string | null, editUrl: null as string | null };
  async function canvaInit(){
    if (!canva || !canva.projectId){ canvaRender(); return; }
    CANVA.designId = canva.designId || null;
    CANVA.editUrl = canva.editUrl || null;
    try {
      const s = await canva.status();
      CANVA.connected = !!(s && s.connected);
    } catch(e) { CANVA.connected = false; }
    canvaRender();
  }
  const canvaBtn = (sel, fn) => { const el = $(sel); if (el) el.addEventListener("click", fn); };

  canvaBtn("#bCanvaConnect", async () => {
    canvaSet("Sending you to Canva to authorize…");
    try { await canva.beginConnect(); }
    catch(err){ canvaSet("Could not start the Canva connection: " + String((err as any)?.message || err).slice(0, 140)); }
  });

  canvaBtn("#bCanvaSend", async () => {
    const btn = $("#bCanvaSend") as any;
    btn.disabled = true;
    canvaSet("Rendering and uploading to Canva…");
    try{
      const s = SIZES[BUILDER.size];
      /* Strip the data-URI prefix: the EF wants raw base64. */
      const png = ($("#adCanvas") as any).toDataURL("image/png").split(",")[1];
      const r = await canva.exportToCanva({
        pngBase64: png,
        title: (BUILDER.hook || "Eden ad").slice(0, 50),
        width: s.w, height: s.h,
        assetId: BUILDER.photoAssetId || null,
      });
      CANVA.designId = r.designId; CANVA.editUrl = r.editUrl;
      canvaRender();
      if (r.editUrl) window.open(r.editUrl, "_blank", "noopener");
      canvaSet("Sent. Edit it in Canva, then come back and bring the finished version over.");
    }catch(err){
      const code = (err as any)?.code;
      canvaSet(code === "not_connected"
        ? "Canva is not connected yet."
        : "Send failed: " + String((err as any)?.message || err).slice(0, 160));
      if (code === "not_connected"){ CANVA.connected = false; canvaRender(); }
    }finally{ btn.disabled = false; }
  });

  canvaBtn("#bCanvaOpenDesign", () => {
    if (CANVA.editUrl) window.open(CANVA.editUrl, "_blank", "noopener");
    else canvaSet("No design link yet. Send a creative to Canva first.");
  });

  canvaBtn("#bCanvaReimport", async () => {
    const btn = $("#bCanvaReimport") as any;
    btn.disabled = true;
    canvaSet("Exporting from Canva and bringing it back…");
    try{
      const r = await canva.reimportFromCanva();
      if (!r.url){ canvaSet("Came back without a usable link."); return; }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        BUILDER.photo = img; BUILDER.tpl = "photo";
        BUILDER.photoAssetId = r.assetId || null;
        /* The Canva version supersedes any local adjustment record. */
        BUILDER.transform = null;
        VB.photo = img;
        renderBuilder(); drawVideoStill();
        canvaSet("Brought back from Canva. The version it replaced is kept for recovery.");
        if (typeof galRender === "function") galRender();
      };
      img.onerror = () => canvaSet("Could not load the returned image.");
      img.src = r.url;
    }catch(err){
      const code = (err as any)?.code;
      canvaSet(code === "no_design"
        ? "Send a creative to Canva first."
        : "Reimport failed: " + String((err as any)?.message || err).slice(0, 160));
    }finally{ btn.disabled = false; }
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
        const dest = safeHref(BUILDER.dest || "https://edeninstitute.health");
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
    const dest = safeHref(BUILDER.dest || "https://edeninstitute.health");
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
  /* ── Write It Yourself: her draft, edited for conversion ──────────────────
     The generate path makes the model the author. This one makes her the
     author and the model the editor, which is how she actually wants to work
     and which keeps claims under her control. */
  function ownDraft(){
    return {
      primary: (($("#ownPrimary") as any) || {}).value || "",
      headline: (($("#ownHeadline") as any) || {}).value || "",
      description: (($("#ownDesc") as any) || {}).value || "",
    };
  }
  function ownSet(msg){ const el = $("#ownStatus"); if (el) el.textContent = msg; }
  function ownCap(inputSel, capSel, limit){
    const inp = $(inputSel), cap = $(capSel);
    if (!inp || !cap) return;
    const n = (inp as any).value.length;
    cap.textContent = n + "/" + limit;
    cap.classList.toggle("over", n > limit);
  }
  root.addEventListener("input", e => {
    const id = (e.target as any).id;
    if (id === "ownHeadline") ownCap("#ownHeadline", "#ownHeadCap", 40);
    if (id === "ownDesc") ownCap("#ownDesc", "#ownDescCap", 30);
  });
  function renderDiag(r){
    const box = $("#ownReport"); if (!box) return;
    const issues = (r && r.issues) || [];
    const strengths = (r && r.strengths) || [];
    box.innerHTML =
      "<div class='diag'>" +
      (typeof r.score === "number"
        ? "<div class='diag-score'>" + r.score + "<small>out of 10</small></div>" : "") +
      (strengths.length
        ? "<div class='changes' style='margin-top:10px'><h4>Working</h4><ul>" +
          strengths.map(s => "<li>" + esc(String(s)) + "</li>").join("") + "</ul></div>"
        : "") +
      issues.map(it => {
        const sev = String((it && it.severity) || "low").toLowerCase();
        return "<div class='diag-item " + esc(sev) + "'>" +
          "<div class='diag-area'>" + esc(String((it && it.area) || "note")) + " · " + esc(sev) + "</div>" +
          "<p class='diag-note'>" + esc(String((it && it.note) || "")) + "</p></div>";
      }).join("") +
      "</div>";
    (box as any).hidden = false;
  }
  root.addEventListener("click", async e => {
    const t = e.target as any;
    const action = t && t.dataset && t.dataset.own;
    if (!action) return;
    if (!aiInvoke || !AI.on){ ownSet("Connect a model first, see the AI Engine panel above."); return; }
    const d = ownDraft();
    if (!d.primary.trim()){ ownSet("Write your primary text first. The editor works on your words, so it needs some."); return; }
    const btns = root.querySelectorAll("[data-own]");
    btns.forEach((b: any) => { b.disabled = true; });
    ownSet(action === "diagnose" ? "Reading your draft…" : "Working on your words…");
    try{
      const r: any = await aiInvoke({
        mode: "edit", action, draft: d, brief: currentBrief(),
        note: (($("#ownNote") as any) || {}).value || "",
      });
      if (action === "diagnose"){
        renderDiag(r);
        ownSet("Diagnosis only. Nothing was rewritten.");
      } else {
        const p = PRODUCTS[state.product];
        const list = (r && r.drafts) || [];
        if (!list.length){ ownSet("Nothing came back. Try again."); return; }
        variants = list.map((x, i) => ({
          primary: x.primary, headline: x.headline, desc: x.description || "",
          cta: p.ctas[state.objective], url: buildURL(p, i + 1),
          platform: "fb", expanded: false,
          changes: x.changes || [], approach: x.approach,
          ai: { model: x.model },
        }));
        state.gen++;
        $("#emptyState").hidden = true;
        $("#copyAllBtn").hidden = variants.length < 2;
        $("#benchTitle").textContent = p.name + " · edited from your draft";
        const rep = $("#ownReport"); if (rep) (rep as any).hidden = true;
        renderVariants();
        ownSet(action === "variations"
          ? "Three takes on your copy, below. Your claims, your substance."
          : "Sharpened, below. Every change is listed on the card.");
        $("#workbench").scrollIntoView({behavior:"smooth", block:"start"});
      }
    }catch(err){ ownSet(aiErrText(err)); }
    finally{ btns.forEach((b: any) => { b.disabled = false; }); }
  });

  const AI = { on: false, providers: [] as any[] };
  let aiSeq = 0; /* supersedes stale in-flight generations */
  function aiSet(msg){ const el = $("#aiStatus"); if (el) el.textContent = msg; }
  function aiErrText(e){
    const code = (e && e.code) || "";
    const status = e && e.status;
    if (code === "founder_only" || status === 403) return "Founder account required.";
    if (code === "rate_limited" || status === 429) return e && e.detail ? String(e.detail).slice(0, 160) : "Daily limit reached. It resets at UTC midnight.";
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
      /* Empty string when unset, so the EF can treat it as absent. */
      direction: (state.direction || "").trim(),
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
    /* AUTOPICK is a starting suggestion, not a verdict. Once the founder has
       chosen an audience or angle herself, or written her own direction, the
       guided flow must not quietly overwrite her. */
    const pick = AUTOPICK[state.product];
    if (pick && !state.touched && !(state.direction || "").trim()){
      state.audience = pick.audience; state.angle = pick.angle; renderCampaign();
    }
    if (hs) hs.textContent = "Reading the brand: positioning, voice, guardrails…";
    const scanEl = root.querySelector(".scan"); if (scanEl) (scanEl as any).open = true;
    await sleep(900);
    const dir = (state.direction || "").trim();
    if (hs) hs.textContent = dir
      ? "Following your direction: “" + (dir.length > 90 ? dir.slice(0, 90) + "…" : dir) + "”"
      : "Casting " + PRODUCTS[state.product].name + " for " + AUDIENCES[state.audience].name + ", " + ANGLES[state.angle].name + " angle…";
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
  const dirEl = $("#heroDirection");
  if (dirEl) dirEl.addEventListener("input", e => { state.direction = (e.target as any).value; });
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
    { ids: ["#galleryPanel", "#brandPanel", "#builder"], hint: "Pick or upload an asset, adjust it, then render the image." },
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
  $("#wizNext").addEventListener("click", () => {
    /* Last step used to wrap back to step 0, silently resetting the campaign in
       place. Now that a campaign is a saved row, finishing means leaving for a
       NEW project, which only the React shell can do. */
    if (wstep === WIZ.length - 1){
      if (host && host.onFinish){ host.onFinish(); return; }
      showStep(0);
      return;
    }
    showStep(wstep + 1);
  });

  /* ── Post: hand off to Meta's own surfaces with the package on the clipboard ── */
  const EDEN_FB = "https://www.facebook.com/TheEdenInstituteBiblicalHerbalism";
  const EDEN_IG = "https://www.instagram.com/the_eden_institute/";
  root.addEventListener("click", async e => {
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
    /* Save the current creative from right here, so the file she has to attach
       in Meta is never somewhere else in the app. */
    if (act === "png"){
      try{
        const s = SIZES[BUILDER.size];
        const bytes = await renderSizeToPng(BUILDER.size);
        const a = document.createElement("a");
        a.download = "eden-ad-" + BUILDER.tpl + "-" + s.w + "x" + s.h + ".png";
        a.href = URL.createObjectURL(new Blob([bytes], { type: "image/png" }));
        a.click();
        setTimeout(() => URL.revokeObjectURL(a.href), 30000);
        if (ps) ps.textContent = "Creative saved to your Downloads as " + a.download + ". Attach that file in Meta; the buttons here carry only the text.";
      }catch(err){
        if (ps) ps.textContent = "Could not render the creative: " + String((err as any)?.message || err).slice(0, 120);
      }
      return;
    }
    /* Copy BEFORE opening the tab. The new tab takes focus, and a clipboard
       write after focus is lost is silently refused, which was exactly the
       "Business Suite opens but the package is nowhere" failure. */
    let copied = true;
    if (pkg && (act === "ads" || act === "suite")) copied = await copyText(pkg);
    const urls = {
      ads: "https://www.facebook.com/adsmanager/creation",
      suite: "https://business.facebook.com/latest/composer",
      fb: EDEN_FB,
      ig: EDEN_IG,
      share: "https://www.facebook.com/sharer/sharer.php?u=" +
        encodeURIComponent((APPROVED[0] && APPROVED[0].url) || "https://edeninstitute.health/homeschool"),
    };
    const w = window.open(urls[act], "_blank", "noopener");
    if (!w){
      /* Pop-up blocked (can happen when the open follows an await). The URLs
         here are constants, safe to place in an anchor. */
      if (ps) ps.innerHTML = "The browser blocked the pop-up. <a href='" + urls[act] + "' target='_blank' rel='noopener'>Open it here</a>" +
        (copied && pkg && (act === "ads" || act === "suite") ? " — your package is on the clipboard." : ".");
      return;
    }
    if (ps) ps.textContent =
      !copied && (act === "ads" || act === "suite")
        ? "The tab is open, but the clipboard copy was refused. Come back here, press Copy All Approved on the tray, then paste."
        : act === "ads" ? "Package copied. In Ads Manager, paste the primary text, headline, and description into the ad setup, then attach your creative PNG (Download Creative here, or the Creative step's exports)."
        : act === "suite" ? "Package copied. Business Suite composes to Facebook and Instagram together; paste the text and attach your creative PNG from Downloads."
        : "";
  });

  /* ───────────────────────── ASSET GALLERY ───────────────────────── */
  function galSet(msg){ const el = $("#galStatus"); if (el) el.textContent = msg; }
  /* Phase 2 gallery state: which campaign is being shown, and which asset the
     adjustment sliders are currently pointed at. */
  const GAL_TAGS = [
    {id:"all", name:"All"}, {id:"sprouts", name:"Sprouts"}, {id:"seedlings", name:"Seedlings"},
    {id:"cultivators", name:"Cultivators"}, {id:"unratified", name:"Unratified"}, {id:"general", name:"General"},
  ];
  let galTag = "all";
  let adjAsset = null;   /* { id, name, filename } */
  let adjT = null;       /* AssetTransform */
  const GAL_VIDEO_RE = /\.(mp4|webm|mov|m4v)$/i;
  async function galRender(){
    if (!assets) return;
    const grid = $("#galGrid");
    try{
      const items = await assets.list(galTag);
      if (!items.length){
        grid.innerHTML = "";
        galSet(galTag === "all"
          ? "Nothing here yet. Upload product photos, mockups, or clips and they stay available every session."
          : "Nothing tagged " + galTag + " yet. Uploads are tagged with this campaign automatically.");
        return;
      }
      const tiles = await Promise.all(items.map(async it => {
        let u = "";
        try { u = await assets.url(it.name); } catch(e) {}
        const isVid = it.kind ? it.kind === "video" : GAL_VIDEO_RE.test(it.name);
        const label = it.filename || it.name.replace(/^\d+-/, "");
        const aid = it.id ? " data-aid='"+esc(it.id)+"'" : "";
        return "<div class='galitem'>" +
          (isVid ? "<video muted playsinline preload='metadata' src='"+esc(u)+"'></video>"
                 : "<img loading='lazy' alt='' src='"+esc(u)+"'>") +
          "<span class='galname'>"+esc(label) +
            (it.campaign_tag ? "<span class='galtag'>"+esc(it.campaign_tag)+"</span>" : "") +
            /* Say plainly which images a model invented. */
            (it.source === "ai_generated" ? "<span class='galsrc'>AI</span>" : "") +
            (it.source === "canva" ? "<span class='galsrc'>Canva</span>" : "") +
          "</span>" +
          "<span class='galbtns'>" +
            (isVid ? "<button class='copybtn' data-gal='clip' data-name='"+esc(it.name)+"'"+aid+" type='button'>Use as Clip</button>"
                   : "<button class='copybtn' data-gal='photo' data-name='"+esc(it.name)+"'"+aid+" type='button'>Use as Photo</button>") +
            (!isVid && it.id ? "<button class='copybtn' data-gal='adjust' data-name='"+esc(it.name)+"'"+aid+" data-label='"+esc(label)+"' type='button'>Adjust</button>" : "") +
            "<button class='copybtn' data-gal='del' data-name='"+esc(it.name)+"'"+aid+" type='button'>Delete</button>" +
          "</span></div>";
      }));
      grid.innerHTML = tiles.join("");
      galSet(items.length + " assets. Photos feed the Photo Harvest template and video backgrounds; clips feed the Video Builder.");
    }catch(e){
      galSet("Gallery unavailable: " + String((e && (e as any).message) || e).slice(0, 140));
    }
  }
  /* ── AI image generation (Phase 4) ────────────────────────────────────────
     Third way to get an image, beside Upload and Library. The brand lock and
     the creative-range rules live in the edge function, so nothing here can
     loosen them. */
  const AI_RANGES = [
    {id:"strict", name:"Strict"}, {id:"moderate", name:"Moderate"}, {id:"loose", name:"Loose"},
  ];
  const AIIMG = { range: "moderate", on: false, selected: null as any };
  function aiImgSet(msg){ const el = $("#aiImgStatus"); if (el) el.textContent = msg; }
  function aiImgRangeChips(){
    const box = $("#aiImgRange"); if (!box) return;
    box.innerHTML = "";
    for (const r of AI_RANGES)
      box.appendChild(chip(r.name, AIIMG.range === r.id, () => { AIIMG.range = r.id; aiImgRangeChips(); }));
  }
  function aiImgSyncEditBtn(){
    const b = $("#aiImgEdit") as any;
    if (!b) return;
    b.disabled = !(AIIMG.on && AIIMG.selected);
  }
  async function aiImgInit(){
    const panel = $("#aiImgPanel"); if (!panel) return;
    if (!assets || !assets.aiGenerate){ (panel as any).style.display = "none"; return; }
    aiImgRangeChips();
    const st = $("#aiImgState");
    try{
      const s: any = await assets.aiStatus();
      AIIMG.on = !!(s && s.configured);
      if (st) st.textContent = AIIMG.on ? (s.modelAvailable === false ? "check model" : "ready") : "no image model";
      if (!AIIMG.on){
        aiImgSet("No image model configured. Set GEMINI_API_KEY to enable this.");
      } else if (s.modelAvailable === false){
        /* Names move; say exactly what to set rather than failing later. */
        aiImgSet("The configured model (" + s.model + ") is not available on this key." +
          (s.imageModels && s.imageModels.length
            ? " Available: " + s.imageModels.join(", ") + ". Set GEMINI_IMAGE_MODEL to one of these."
            : ""));
      }
    }catch(e){
      AIIMG.on = false;
      if (st) st.textContent = "unavailable";
    }
    ($("#aiImgGen") as any).disabled = !AIIMG.on;
    aiImgSyncEditBtn();
  }
  /* Both actions land the image in the library, so the gallery is the single
     place generated and uploaded images live together. */
  async function aiImgRun(kind){
    const prompt = (($("#aiImgPrompt") as any) || {}).value || "";
    if (!prompt.trim()){ aiImgSet("Describe the image first."); return; }
    if (kind === "edit" && !AIIMG.selected){ aiImgSet("Pick an image in the gallery to edit."); return; }
    const gen = $("#aiImgGen") as any, ed = $("#aiImgEdit") as any;
    gen.disabled = true; ed.disabled = true;
    aiImgSet(kind === "edit" ? "Editing your image…" : "Generating. This takes a few seconds…");
    try{
      const r = kind === "edit"
        ? await assets.aiEdit(prompt, AIIMG.range, AIIMG.selected.name)
        : await assets.aiGenerate(prompt, AIIMG.range);
      aiImgSet("Saved to your library" + (r.note ? ". " + String(r.note).slice(0, 120) : "."));
      await galRender();
      if (r.url){
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
          BUILDER.photo = img; BUILDER.tpl = "photo";
          BUILDER.photoAssetId = r.assetId || null; BUILDER.transform = null;
          VB.photo = img;
          renderBuilder(); drawVideoStill();
        };
        img.src = r.url;
      }
    }catch(err){
      const code = (err as any)?.code;
      /* The EF returns a `detail` alongside the code. Showing only the code
         turned a Google quota error into a bare "server_error", which tells
         the founder nothing about what to do. Read the detail and name the
         common causes plainly. */
      const detail = String((err as any)?.detail ?? "");
      if (code === "no_image"){
        aiImgSet("The model returned no image. Try rephrasing, or loosen the creative range.");
      } else if (/\b429\b|quota|rate.?limit/i.test(detail)){
        aiImgSet("Google's image API refused the request: quota exceeded on this key. " +
          "Image generation needs billing enabled on the Gemini API key, or you have hit today's limit.");
      } else if (/\b(401|403)\b|API key not valid|permission/i.test(detail)){
        aiImgSet("Google rejected the API key. Check GEMINI_API_KEY is current and has image access.");
      } else if (code === "no_provider"){
        aiImgSet("No image model configured. Set GEMINI_API_KEY to enable this.");
      } else {
        aiImgSet("Failed: " + (detail || String((err as any)?.message || err)).slice(0, 200));
      }
    }finally{
      gen.disabled = !AIIMG.on; aiImgSyncEditBtn();
    }
  }

  function galTagChips(){
    const box = $("#galTagChips"); if (!box) return;
    box.innerHTML = "";
    for (const t of GAL_TAGS)
      box.appendChild(chip(t.name, galTag === t.id, () => { galTag = t.id; galTagChips(); galRender(); }));
  }

  /* ── Non-destructive adjustments ──────────────────────────────────────────
     Values are a record, applied by the builder at render time. The uploaded
     file is never rewritten, so an adjustment is always reversible and the same
     photo can be tuned differently per project. */
  const ADJ = [
    {slider:"#adjOpacity", out:"#adjOpacityV", key:"opacity",    group:null,           def:100},
    {slider:"#adjBright",  out:"#adjBrightV",  key:"brightness", group:"color_adjust", def:100},
    {slider:"#adjContrast",out:"#adjContrastV",key:"contrast",   group:"color_adjust", def:100},
    {slider:"#adjSat",     out:"#adjSatV",     key:"saturation", group:"color_adjust", def:100},
  ];
  function adjRead(){
    const t = {opacity:1, crop:(adjT && adjT.crop) || {}, color_adjust:{}};
    for (const a of ADJ){
      const el = $(a.slider); if (!el) continue;
      const v = (+(el as any).value) / 100;
      if (a.group) t.color_adjust[a.key] = v; else t[a.key] = v;
      const o = $(a.out); if (o) o.textContent = Math.round(v * 100) + "%";
    }
    return t;
  }
  function adjWrite(t){
    for (const a of ADJ){
      const el = $(a.slider); if (!el) continue;
      const v = a.group ? ((t[a.group] || {})[a.key]) : t[a.key];
      (el as any).value = Math.round((typeof v === "number" ? v : 1) * 100);
      const o = $(a.out); if (o) o.textContent = (el as any).value + "%";
    }
  }
  function adjSet(msg){ const el = $("#adjStatus"); if (el) el.textContent = msg; }
  async function adjOpen(assetId, name, label){
    if (!assets || !assets.getTransform) return;
    adjAsset = {id: assetId, name: name, label: label};
    const nEl = $("#adjName"); if (nEl) nEl.textContent = label;
    ($("#galAdjust") as any).hidden = false;
    adjSet("Loading…");
    try{
      adjT = await assets.getTransform(assetId);
      adjWrite(adjT);
      adjSet("Adjustments apply when this photo is used in the builder. The stored file is never changed.");
    }catch(err){ adjSet("Could not load adjustments."); }
  }
  let adjTimer = null;
  function adjTouched(){
    /* Read first, unconditionally: the percentage labels must track the slider
       even when there is nothing to persist to, or the controls look dead. */
    adjT = adjRead();
    if (!adjAsset || !assets || !assets.saveTransform) return;
    /* Repaint immediately; persist on a short debounce so dragging a slider is
       not one write per pixel. */
    if (BUILDER.photo && BUILDER.photoAssetId === adjAsset.id){ BUILDER.transform = adjT; drawAd(); }
    if (adjTimer) clearTimeout(adjTimer);
    adjTimer = setTimeout(async () => {
      try { await assets.saveTransform(adjAsset.id, adjT); adjSet("Saved."); }
      catch(err){ adjSet("Could not save adjustments."); }
    }, 500);
  }
  function brandRender(){
    if (!assets || !assets.brandKit) return;
    assets.brandKit().then(tokens => {
      const cols = $("#brandColors"), fonts = $("#brandFonts");
      if (cols) cols.innerHTML = tokens.filter(t => t.kind === "color").map(t =>
        "<div class='swatch'><span class='chip-c' style='background:"+esc(t.value)+"'></span>" +
        "<span class='sw-b'><b class='sw-n'>"+esc(t.label)+"</b>" +
        "<span class='sw-h'>"+esc(t.value)+"</span>" +
        (t.usage ? "<span class='sw-u'>"+esc(t.usage)+"</span>" : "") +
        "</span></div>").join("");
      if (fonts) fonts.innerHTML = tokens.filter(t => t.kind === "font").map(t =>
        "<div class='bfont'><div class='bf-r'>"+esc(t.label)+"</div>" +
        "<div class='bf-f'>"+esc(t.value)+"</div>" +
        (t.usage ? "<div class='bf-u'>"+esc(t.usage)+"</div>" : "") +
        "</div>").join("");
    }).catch(() => {
      const cols = $("#brandColors");
      if (cols) cols.innerHTML = "<p class='subnote'>Could not load the brand kit.</p>";
    });
  }

  function galInit(){
    const panel = $("#galleryPanel"); if (!panel) return;
    if (!assets){ panel.style.display = "none"; return; }
    galTagChips();
    brandRender();
    aiImgInit();
    const agBtn = $("#aiImgGen"); if (agBtn) agBtn.addEventListener("click", () => aiImgRun("generate"));
    const aeBtn = $("#aiImgEdit"); if (aeBtn) aeBtn.addEventListener("click", () => aiImgRun("edit"));
    ADJ.forEach(a => { const el = $(a.slider); if (el) el.addEventListener("input", adjTouched); });
    const rst = $("#adjReset");
    if (rst) rst.addEventListener("click", () => {
      adjWrite({opacity:1, crop:{}, color_adjust:{brightness:1, contrast:1, saturation:1}});
      adjTouched();
    });
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
      if (act === "adjust"){ adjOpen(t.dataset.aid, name, t.dataset.label || name); return; }
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
          img.onload = async () => {
            BUILDER.photo = img; BUILDER.tpl = "photo";
            BUILDER.photoAssetId = t.dataset.aid || null;
            VB.photo = img;
            /* Carry this project's saved adjustments over with the photo. */
            BUILDER.transform = null;
            if (BUILDER.photoAssetId && assets.getTransform){
              try { BUILDER.transform = await assets.getTransform(BUILDER.photoAssetId); } catch(e) {}
            }
            renderBuilder(); drawVideoStill();
            /* The photo you are working with is the one an AI edit should act
               on, so loading it also selects it. */
            AIIMG.selected = { name: name, id: t.dataset.aid || null };
            aiImgSyncEditBtn();
            root.querySelectorAll(".galitem").forEach(el => el.classList.remove("sel"));
            const tile = t.closest(".galitem"); if (tile) tile.classList.add("sel");
            galSet(BUILDER.transform
              ? "Photo loaded with its saved adjustments."
              : "Photo loaded. AI edits will act on this image.");
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
  canvaInit();
  layerList();
  capRender();
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
        direction: state.direction, touched: state.touched,
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
      /* Phase 6: placed text and the caption are real work, not derived state. */
      layers: JSON.parse(JSON.stringify(LAYERS)),
      caption: CAPTION.text || "",
      /* Her own draft is the most expensive thing on the screen to retype. */
      own: {
        ...ownDraft(),
        note: (($("#ownNote") as any) || {}).value || "",
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
    state.direction = typeof c.direction === "string" ? c.direction : "";
    state.touched = !!c.touched;
    const dirIn = $("#heroDirection"); if (dirIn) (dirIn as any).value = state.direction;

    variants = Array.isArray(blob.variants) ? blob.variants : [];
    APPROVED.length = 0;
    if (Array.isArray(blob.approved)) APPROVED.push.apply(APPROVED, blob.approved);

    const b = blob.builder || {};
    ["tpl","size","hook","sub","cta","domain","dest"].forEach(k => {
      if (typeof b[k] === "string") BUILDER[k] = b[k];
    });
    BUILDER.qr = !!b.qr;

    LAYERS = Array.isArray((blob as any).layers) ? (blob as any).layers : [];
    layerSel = LAYERS.length ? LAYERS[0].id : null;
    CAPTION.text = typeof (blob as any).caption === "string" ? (blob as any).caption : "";
    layerList(); capRender();

    const own = (blob as any).own || {};
    const setVal = (sel, v) => { const el = $(sel); if (el) (el as any).value = typeof v === "string" ? v : ""; };
    setVal("#ownPrimary", own.primary);
    setVal("#ownHeadline", own.headline);
    setVal("#ownDesc", own.description);
    setVal("#ownNote", own.note);
    ownCap("#ownHeadline", "#ownHeadCap", 40);
    ownCap("#ownDesc", "#ownDescCap", 30);

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
