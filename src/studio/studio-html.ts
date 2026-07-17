// Eden Ad Studio markup. Ported from the standalone artifact build (2026-07-17).
// Injected into the mount node by StudioPage; all ids are queried by studio-core.ts.

export const STUDIO_HTML = `
<header class="masthead">
  <div class="masthead-inner">
    <p class="eyebrow">The Eden Institute · Ad Workroom</p>
    <h1>Eden Ad Studio</h1>
    <div class="rule-orn">❦</div>
    <p class="sub">A Materia Medica for Meta. Purpose-built for Facebook and Instagram ads for The Eden Institute, and for Eden's Table.</p>
    <span class="tagchip">Back to Eden. Back to Truth.</span>
  </div>
</header>

<div class="wrap">

  <!-- ── Guided entry ── -->
  <section class="hero" id="heroPanel">
    <h2 class="hero-h">So, what are we promoting today?</h2>
    <p class="hero-sub">Pick a product. The studio reads the brand, writes with every model you've connected, judges every draft against the Eden voice and Meta policy, and hands you ads ready for Ads Manager.</p>
    <div class="hero-goals" id="heroGoals"></div>
    <button class="genbtn hero-cta" id="heroGo" type="button">❦ &nbsp;Build My Campaign</button>
    <p class="subnote" id="heroStatus" style="min-height:18px;text-align:center;margin-top:10px"></p>
    <div class="hero-stats">
      <div class="stat"><b>5</b><span>products wired in</span></div>
      <div class="stat"><b>100+</b><span>approved copy blocks</span></div>
      <div class="stat"><b>12</b><span>proven angles</span></div>
      <div class="stat"><b>2</b><span>compliance rulebooks</span></div>
    </div>
  </section>

  <details class="scan" open>
    <summary>Brand scan · positioning, voice, and vocabulary baked into every draft</summary>
    <div class="scan-grid">
      <div class="scan-card">
        <h3>Positioning</h3>
        <p class="big">The only tiered herbal education grounding clinical herbalism in a biblical worldview.</p>
      </div>
      <div class="scan-card">
        <h3>Voice in three words</h3>
        <p class="big">Warm. Grounded. Precise.</p>
        <p>Speaks to a capable steward, never a passive consumer. Conviction over hype.</p>
      </div>
      <div class="scan-card">
        <h3>Always say</h3>
        <div class="wordchips">
          <span class="wordchip">stewardship</span><span class="wordchip">terrain</span><span class="wordchip">constitution</span><span class="wordchip">energetics</span><span class="wordchip">original medicine</span><span class="wordchip">discernment</span>
        </div>
      </div>
      <div class="scan-card">
        <h3>Never say</h3>
        <div class="wordchips">
          <span class="wordchip bad">detox</span><span class="wordchip bad">vibes</span><span class="wordchip bad">manifest</span><span class="wordchip bad">self-care</span><span class="wordchip bad">heal yourself</span><span class="wordchip bad">universe</span>
        </div>
      </div>
    </div>
  </details>

  <div class="steps" aria-label="Workflow">
    <div class="step"><b>I</b> Choose the product</div>
    <div class="step"><b>II</b> The studio writes &amp; judges</div>
    <div class="step"><b>III</b> Approve or correct</div>
    <div class="step"><b>IV</b> Creative &amp; export</div>
  </div>

  <div class="studio">

    <!-- ── Campaign panel ── -->
    <aside class="panel" id="campaignPanel">
      <div class="panel-h"><h2>The Campaign</h2><span class="note">Step I</span></div>
      <div class="panel-b">
        <div class="field">
          <div class="flabel">Product</div>
          <div class="prodlist" id="prodList"></div>
        </div>
        <div class="field">
          <div class="flabel">Objective</div>
          <div class="chips" id="objChips"></div>
        </div>
        <div class="field">
          <div class="flabel">Audience</div>
          <div class="chips" id="audChips"></div>
          <div class="aud-note" id="audNote"></div>
        </div>
        <div class="field">
          <div class="flabel">Angle <span class="hint">filtered to this product</span></div>
          <div class="chips" id="angleChips"></div>
        </div>
        <div class="field">
          <div class="flabel">Placement format</div>
          <div class="chips" id="fmtChips"></div>
        </div>
        <button class="genbtn" id="genBtn" type="button">❦ &nbsp;Generate Three Variants</button>
      </div>
    </aside>

    <!-- ── Workbench ── -->
    <section id="workbench">
      <div class="panel" id="aiPanel" style="margin-bottom:14px">
        <div class="panel-h"><h2>AI Engine</h2><span class="note" id="aiModels">checking models…</span></div>
        <div class="panel-b">
          <button class="genbtn" id="aiGenBtn" type="button">❦ &nbsp;Generate Fresh Drafts With Every Model</button>
          <p class="subnote" id="aiStatus" style="min-height:16px;margin:8px 0 0"></p>
        </div>
      </div>
      <div class="bench-top">
        <span class="bench-title" id="benchTitle">The Workbench</span>
        <button class="copyall" id="copyAllBtn" type="button" hidden>Copy All Three Variants</button>
      </div>
      <div class="empty" id="emptyState">
        <span class="orn">❦</span>
        <p>Choose a product, an audience, and an angle, then press Generate. Three ad drafts will appear here, written in the Eden voice and checked against Meta policy before you ever open Ads Manager.</p>
      </div>
      <div id="variants"></div>
    </section>
  </div>

  <!-- ── Approved tray ── -->
  <section class="panel" id="trayPanel" style="margin-top:22px" hidden>
    <div class="panel-h"><h2>Approved · Ready for Ads Manager</h2><span class="note" id="trayCount"></span></div>
    <div class="panel-b">
      <button class="copyall" id="trayCopyAll" type="button">Copy All Approved</button>
      <div id="trayList"></div>
    </div>
  </section>

  <!-- ── Asset gallery ── -->
  <section class="panel" id="galleryPanel" style="margin-top:22px">
    <div class="panel-h"><h2>Asset Gallery</h2><span class="note">your photos and clips, stored privately, ready for any builder</span></div>
    <div class="panel-b">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="file" id="galUpload" accept="image/*,video/*" multiple style="flex:1;min-width:200px">
        <button class="copyall" id="galRefresh" type="button">Refresh</button>
      </div>
      <p class="subnote" id="galStatus" style="min-height:16px"></p>
      <div id="galGrid" class="galgrid"></div>
    </div>
  </section>

  <!-- ── Creative builder ── -->
  <section class="panel" id="builder" style="margin-top:22px">
    <div class="panel-h"><h2>Creative Builder</h2><span class="note">Step IV · renders the finished ad image at true Meta dimensions, downloads as PNG</span></div>
    <div class="builder-grid">
      <div class="bctl">
        <div class="field">
          <div class="flabel">Layout template</div>
          <div class="chips" id="tplChips"></div>
        </div>
        <div class="field">
          <div class="flabel">Size</div>
          <div class="chips" id="sizeChips"></div>
        </div>
        <div class="frow"><div class="flabel"><span>Headline on image</span></div>
          <textarea id="bHook" rows="2"></textarea></div>
        <div class="frow"><div class="flabel"><span>Supporting line</span></div>
          <input type="text" id="bSub"></div>
        <div class="frow"><div class="flabel"><span>Button text on image</span></div>
          <input type="text" id="bCta"></div>
        <div class="frow"><div class="flabel"><span>Domain line</span></div>
          <input type="text" id="bDomain"></div>
        <div class="frow"><div class="flabel"><span>Photo <span class="hint">optional · Photo Harvest template · stays on your machine</span></span></div>
          <input type="file" id="bPhoto" accept="image/*">
          <button class="copybtn" id="bPhotoClear" type="button" style="margin-top:6px">Remove Photo</button></div>
        <p class="subnote">Drop in one of the Eden's Table product mockups for the Photo Harvest template. The Label and Forest templates are pure typography, engraved and on-palette, no photo needed.</p>
      </div>
      <div class="bprev">
        <canvas id="adCanvas" width="1080" height="1350" aria-label="Ad creative preview"></canvas>
        <button class="genbtn" id="dlBtn" type="button" style="max-width:420px;margin:12px auto 0;display:block">❦ &nbsp;Download PNG</button>
        <button class="copyall" id="bCanvaOpen" type="button" style="max-width:420px;margin:8px auto 0;display:block;width:100%">Open in Canva to Tweak</button>
        <p class="subnote" style="text-align:center;max-width:420px;margin:6px auto 0">Opens a blank Canva design at this exact ad size. Download the PNG first, then drag it in to adjust opacity, layers, and type.</p>
        <p class="subnote" id="dlMeta" style="text-align:center"></p>
      </div>
    </div>
  </section>

  <!-- ── Video builder ── -->
  <section class="panel" id="videobuilder" style="margin-top:22px">
    <div class="panel-h"><h2>Video Builder</h2><span class="note">Step IV · scrolling-credits video with music and narration, recorded right here</span></div>
    <div class="builder-grid">
      <div class="bctl">
        <div class="field"><div class="flabel">Size</div><div class="chips" id="vbSizeChips"></div></div>
        <div class="field"><div class="flabel">Background</div><div class="chips" id="vbBgChips"></div>
          <div style="display:flex;gap:10px;margin-top:8px;flex-wrap:wrap">
            <label class="subnote" style="flex:1;min-width:130px">Photo<br><input type="file" id="vbPhoto" accept="image/*"></label>
            <label class="subnote" style="flex:1;min-width:130px">Video clip<br><input type="file" id="vbClip" accept="video/*"></label>
          </div></div>
        <div class="field"><div class="flabel">Length</div><div class="chips" id="vbDurChips"></div></div>
        <div class="frow"><div class="flabel"><span>Credits script <span class="hint"># big line · ## small caps · * italic · --- ornament</span></span></div>
          <textarea id="vbScript" rows="10" style="font-size:13px"></textarea></div>
        <div class="frow" style="display:flex;gap:8px">
          <span style="flex:1"><div class="flabel"><span>End-card button</span></div><input type="text" id="vbCta"></span>
          <span style="flex:1.4"><div class="flabel"><span>End-card domain</span></div><input type="text" id="vbDomain"></span>
        </div>
        <div class="field"><div class="flabel">Music</div><div class="chips" id="vbMusicChips"></div>
          <label class="subnote" style="display:block;margin-top:8px">Upload a track (use ad-cleared music; see Free Assets below)<br><input type="file" id="vbMusicFile" accept="audio/*"></label>
          <div class="flabel" style="margin-top:8px"><span>Music volume</span></div><input type="range" id="vbMusicVol" min="0" max="100" value="25" style="width:100%">
        </div>
        <div class="field"><div class="flabel">Narration</div><div class="chips" id="vbNarrChips"></div>
          <div style="display:flex;gap:8px;margin-top:8px;align-items:center;flex-wrap:wrap">
            <button class="copybtn" id="vbMicBtn" type="button">● Record Narration</button>
            <label class="subnote" style="flex:1;min-width:150px">or upload<br><input type="file" id="vbNarrFile" accept="audio/*"></label>
          </div>
          <div class="flabel" style="margin-top:8px"><span>Narration volume</span></div><input type="range" id="vbNarrVol" min="0" max="100" value="100" style="width:100%">
        </div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <button class="copyall" id="vbPreviewBtn" type="button">Preview Take</button>
          <button class="copyall" id="vbStopBtn" type="button">Stop</button>
        </div>
        <button class="genbtn" id="vbRecordBtn" type="button" style="margin-top:10px">❦ &nbsp;Record &amp; Export Video</button>
        <p class="subnote" id="vbStatus" style="min-height:18px"></p>
      </div>
      <div class="bprev">
        <canvas id="vCanvas" width="1080" height="1350" aria-label="Video preview"></canvas>
        <p class="subnote" style="text-align:center" id="vbMeta"></p>
        <div id="vbResult"></div>
      </div>
    </div>
  </section>

  <!-- ── Reference row ── -->
  <div class="refrow">
    <div class="ref">
      <div class="panel-h"><h2>Meta Spec Sheet</h2></div>
      <div class="panel-b">
        <div class="spec"><b>Primary text</b><span>~125 ch visible, then "See more"</span></div>
        <div class="spec"><b>Headline</b><span>≤ 40 ch before truncation</span></div>
        <div class="spec"><b>Description</b><span>≤ 30 ch, FB feed only</span></div>
        <div class="spec"><b>Feed image</b><span>1080×1080 (1:1) · 1080×1350 (4:5)</span></div>
        <div class="spec"><b>Stories / Reels</b><span>1080×1920 (9:16), safe zone center</span></div>
        <div class="spec"><b>Carousel</b><span>2 to 10 cards, 1:1, headline per card</span></div>
        <div class="spec"><b>Text on image</b><span>Keep overlays light and legible</span></div>
        <div class="spec"><b>Links</b><span>Always UTM-tagged (paid_social)</span></div>
      </div>
    </div>
    <div class="ref hookbank">
      <div class="panel-h"><h2>Proven Hook Bank</h2><span class="note">from the ad copy library</span></div>
      <div class="panel-b">
        <ul>
          <li>Designed Bodies. Designed Plants. <i>· precision</i></li>
          <li>The Herb Wasn't the Problem. <i>· reframe</i></li>
          <li>It Was Never Witchcraft. <i>· heritage</i></li>
          <li>You Were Made for More Than WebMD at 2AM. <i>· mom</i></li>
          <li>Your Grandmother Knew. <i>· generational</i></li>
          <li>What's Your Constitution? <i>· quiz</i></li>
          <li>This Is Not a Weekend Workshop. <i>· rigor</i></li>
          <li>Fear Keeps You Sick. Faith Sets You Free. <i>· 2 Tim 1:7</i></li>
          <li>The First Pharmacy Was a Garden. <i>· Gen 1:29</i></li>
          <li>Raise Children Who Know What God Made. <i>· Eden's Table</i></li>
          <li>Stewardship Is Not Passive. <i>· worship</i></li>
        </ul>
      </div>
    </div>
    <div class="ref">
      <div class="panel-h"><h2>Hashtag Sets</h2><span class="note">3 to 5 max, IG captions</span></div>
      <div class="panel-b">
        <p style="margin:0 0 6px"><b>Institute</b></p>
        <p class="hashline">#biblicalherbalism #christianherbalist #terraintheory #edeninstitute #backtoeden</p>
        <p style="margin:10px 0 6px"><b>Eden's Table</b></p>
        <p class="hashline">#christianhomeschool #homeschoolcurriculum #charlottemason #biblicalherbalism #edenstable</p>
        <p style="margin:10px 0 6px"><b>Quiz / lead gen</b></p>
        <p class="hashline">#constitutionalhealth #faithandhealth #biblicalherbalism #godsgarden</p>
      </div>
    </div>
    <div class="ref">
      <div class="panel-h"><h2>Scope Reminders</h2></div>
      <div class="panel-b">
        <ul>
          <li>We educate. We never diagnose, prescribe, or treat, in ads least of all.</li>
          <li>Never imply the reader has a condition. Speak to learning, not to their symptoms.</li>
          <li>Herb specifics need context; keep ads at the framework level.</li>
          <li>Meta restricts personal-health attribute language; the checker below each draft flags it.</li>
          <li>Every claim of price, date, or approval should be re-verified on the day the ad goes live.</li>
        </ul>
      </div>
    </div>
    <div class="ref">
      <div class="panel-h"><h2>Free Assets &amp; Licensing</h2></div>
      <div class="panel-b">
        <ul>
          <li><b>Music for ads, the safe source:</b> Meta Sound Collection (facebook.com/sound/collection). Free and cleared for FB/IG ads. Download the track, then load it into the Video Builder.</li>
          <li><b>Also free:</b> YouTube Audio Library and Pixabay Music. Check each track's license line before use.</li>
          <li><b>Never</b> use trending Reels audio in a paid ad; it is not licensed for commercial use.</li>
          <li><b>Photos and clips:</b> Pixabay, Pexels, and Unsplash allow free commercial use. Choose botanical, natural light, on palette.</li>
          <li>The built-in Eden Ambient bed is generated in your browser, so it carries no license at all.</li>
          <li>Everything you load here stays on your machine. Nothing is uploaded anywhere.</li>
        </ul>
      </div>
    </div>
  </div>

  <footer>
    <span class="orn">❦</span><br>
    Every draft here is exactly that, a draft. Founder review comes before anything ships.<br>
    The Eden Institute educates; it does not diagnose, prescribe, or treat.<br>
    In Canva, set headlines in Cinzel Decorative and body in EB Garamond; this workroom approximates them with system serifs.
  </footer>
</div>

<div class="toast" id="toast">Copied</div>

`;
