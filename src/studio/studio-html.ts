// Eden Ad Studio markup. Ported from the standalone artifact build (2026-07-17).
// Injected into the mount node by StudioWorkroom; all ids are queried by studio-core.ts.

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
    <div class="hero-direction">
      <label class="dir-label" for="heroDirection">Where should this campaign go?</label>
      <textarea id="heroDirection" class="dir-input" rows="3"
        placeholder="Say it in your own words. Anything here outranks the preset angles below."></textarea>
      <p class="dir-note">Optional. Leave it blank and the studio picks an angle for you.</p>
    </div>
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

  <div class="steps" id="wizSteps" aria-label="Wizard steps">
    <button class="step" data-w="0" type="button"><b>I</b> Choose</button>
    <button class="step" data-w="1" type="button"><b>II</b> Drafts</button>
    <button class="step" data-w="2" type="button"><b>III</b> Creative</button>
    <button class="step" data-w="3" type="button"><b>IV</b> Video</button>
    <button class="step" data-w="4" type="button"><b>V</b> Post</button>
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
      <!-- Your words first. The founder writes; the model edits her copy for
           conversion without being allowed to introduce new claims. -->
      <div class="panel" id="ownPanel" style="margin-bottom:14px">
        <div class="panel-h">
          <h2>Write It Yourself</h2>
          <span class="note">your words, sharpened</span>
        </div>
        <div class="panel-b">
          <p class="subnote" style="margin:0 0 10px">
            Write the ad however you want, rough is fine. The editor keeps your substance and claims, and works on hook, specificity, and close.
          </p>
          <label class="own-label" for="ownPrimary">Primary text</label>
          <textarea id="ownPrimary" class="own-input" rows="7"
            placeholder="Say it the way you would say it to a friend."></textarea>
          <div class="own-row">
            <div>
              <label class="own-label" for="ownHeadline">Headline <span class="own-cap" id="ownHeadCap">0/40</span></label>
              <input id="ownHeadline" class="own-input" type="text" maxlength="80" />
            </div>
            <div>
              <label class="own-label" for="ownDesc">Description <span class="own-cap" id="ownDescCap">0/30</span></label>
              <input id="ownDesc" class="own-input" type="text" maxlength="80" />
            </div>
          </div>
          <label class="own-label" for="ownNote">Anything else the editor should know (optional)</label>
          <input id="ownNote" class="own-input" type="text"
            placeholder="e.g. keep the second paragraph exactly as written" />
          <div class="own-actions">
            <button class="genbtn own-btn" id="ownSharpen" type="button" data-own="sharpen">Sharpen This</button>
            <button class="genbtn own-btn" id="ownVary" type="button" data-own="variations">Three Ways</button>
            <button class="genbtn own-btn ghost" id="ownDiag" type="button" data-own="diagnose">Diagnose Only</button>
          </div>
          <p class="subnote" id="ownStatus" style="min-height:16px;margin:8px 0 0"></p>
          <div id="ownReport" hidden></div>
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

  <!-- ── Post ── -->
  <section class="panel" id="postPanel" style="margin-top:22px">
    <div class="panel-h"><h2>Post It</h2><span class="note">straight into Meta's own composers</span></div>
    <div class="panel-b">
      <p class="subnote" style="margin:0 0 10px">True hands-free publishing needs a Meta developer app (a future integration). Today's flow is one step short: each button below copies your approved ad package to the clipboard, then opens the right Meta surface in a new tab. Paste, attach the creative, publish.</p>
      <div class="postgrid">
        <button class="copyall" data-post="ads" type="button">Copy Approved + Open Ads Manager</button>
        <button class="copyall" data-post="suite" type="button">Copy Approved + Open Business Suite (FB &amp; IG)</button>
        <button class="copyall" data-post="fb" type="button">Open Eden on Facebook</button>
        <button class="copyall" data-post="ig" type="button">Open Eden on Instagram</button>
        <button class="copyall" data-post="share" type="button">Quick Share Link to Facebook</button>
      </div>
      <p class="subnote" id="postStatus" style="min-height:16px;margin-top:8px"></p>
    </div>
  </section>

  <!-- ── Asset gallery ── -->
  <section class="panel" id="galleryPanel" style="margin-top:22px">
    <div class="panel-h"><h2>Asset Gallery</h2><span class="note">your photos and clips, stored privately, ready for any builder</span></div>
    <div class="panel-b">
      <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
        <input type="file" id="galUpload" accept="image/*,video/*" multiple aria-label="Upload images or video clips to your asset library" style="flex:1;min-width:200px">
        <button class="copyall" id="galRefresh" type="button">Refresh</button>
      </div>
      <div class="gal-filter">
        <span class="gal-filter-l">Campaign</span>
        <span class="chips" id="galTagChips"></span>
      </div>

      <!-- Generate with AI. Sits alongside Upload and Library as the third way
           to get an image, per the spec. The brand lock lives server-side. -->
      <div id="aiImgPanel" class="aiimg">
        <div class="aiimg-h">
          <span>Generate with AI</span>
          <span class="aiimg-state" id="aiImgState">checking…</span>
        </div>
        <textarea id="aiImgPrompt" class="own-input" rows="3"
          placeholder="Describe the image. A child's hands and a parent's hands over a mortar and pestle on a linen tablecloth, morning light."></textarea>
        <div class="aiimg-row">
          <div class="aiimg-range">
            <span class="own-label" style="margin:0 0 4px">Creative range</span>
            <span class="chips" id="aiImgRange"></span>
          </div>
          <div class="aiimg-btns">
            <button class="genbtn own-btn" id="aiImgGen" type="button">Generate</button>
            <button class="genbtn own-btn ghost" id="aiImgEdit" type="button" disabled>Edit Selected</button>
          </div>
        </div>
        <p class="subnote" id="aiImgStatus" style="min-height:16px;margin:8px 0 0"></p>
        <p class="subnote" style="margin:2px 0 0">Generated images are saved to this library and tagged as AI, so you can always tell them from photographs.</p>
      </div>
      <p class="subnote" id="galStatus" style="min-height:16px"></p>
      <div id="galGrid" class="galgrid"></div>

      <!-- Non-destructive adjustments. Nothing here rewrites the stored file;
           the values are a record the builder applies at render time. -->
      <div id="galAdjust" hidden>
        <div class="adj-h">
          <span>Adjust <b id="adjName"></b></span>
          <button class="copybtn" id="adjReset" type="button">Reset</button>
        </div>
        <div class="adj-grid">
          <label>Opacity <span class="adj-v" id="adjOpacityV">100%</span>
            <input type="range" id="adjOpacity" min="0" max="100" value="100"></label>
          <label>Brightness <span class="adj-v" id="adjBrightV">100%</span>
            <input type="range" id="adjBright" min="50" max="150" value="100"></label>
          <label>Contrast <span class="adj-v" id="adjContrastV">100%</span>
            <input type="range" id="adjContrast" min="50" max="150" value="100"></label>
          <label>Saturation <span class="adj-v" id="adjSatV">100%</span>
            <input type="range" id="adjSat" min="0" max="200" value="100"></label>
        </div>
        <p class="subnote" id="adjStatus" style="min-height:16px;margin:6px 0 0"></p>
      </div>
    </div>
  </section>

  <!-- ── Brand kit (locked) ── -->
  <section class="panel" id="brandPanel" style="margin-top:22px">
    <div class="panel-h">
      <h2>Brand Kit</h2>
      <span class="note">locked · from the Eden Brand Voice Guide</span>
    </div>
    <div class="panel-b">
      <p class="subnote" style="margin:0 0 12px">
        Read-only by design. These values live in the database with no write path from this app, so a stray click cannot drift the brand. Changing them is a deliberate migration.
      </p>
      <div id="brandColors" class="swatches"></div>
      <div id="brandFonts" class="brandfonts"></div>
    </div>
  </section>

  <!-- ── Creative builder ── -->
  <section class="panel" id="builder" style="margin-top:22px">
    <div class="panel-h"><h2>Creative Builder</h2><span class="note">Step III · renders the finished ad image at true Meta dimensions, downloads as PNG</span></div>
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
          <textarea id="bHook" rows="2" aria-label="Headline on image"></textarea></div>
        <div class="frow"><div class="flabel"><span>Supporting line</span></div>
          <input type="text" id="bSub" aria-label="Supporting line"></div>
        <div class="frow"><div class="flabel"><span>Button text on image</span></div>
          <input type="text" id="bCta" aria-label="Button text on image"></div>
        <div class="frow"><div class="flabel"><span>Domain line</span></div>
          <input type="text" id="bDomain" aria-label="Domain line"></div>
        <div class="frow"><div class="flabel"><span>Photo <span class="hint">optional · Photo Harvest template · stays on your machine</span></span></div>
          <input type="file" id="bPhoto" accept="image/*" aria-label="Product photo for the Photo Harvest template">
          <button class="copybtn" id="bPhotoClear" type="button" style="margin-top:6px">Remove Photo</button></div>
        <p class="subnote">Drop in one of the Eden's Table product mockups for the Photo Harvest template. The Label and Forest templates are pure typography, engraved and on-palette, no photo needed.</p>
        <div class="field" style="margin-top:16px;border-top:1px solid var(--line-soft);padding-top:14px">
          <div class="flabel">Make it clickable</div>
          <p class="subnote" style="margin:0 0 8px">In Facebook and Instagram ads the whole ad is the click; Ads Manager attaches your URL and CTA button, so the painted CTA is never dead there. These exports make the image itself clickable everywhere else: email, web, and print.</p>
          <div class="frow"><div class="flabel"><span>Destination URL</span></div>
            <input type="text" id="ccUrl" inputmode="url" aria-label="Destination URL"></div>
          <label class="subnote" style="display:flex;gap:6px;align-items:center;margin:6px 0;cursor:pointer"><input type="checkbox" id="ccQr"> Paint a QR code onto the image (print becomes scannable)</label>
          <button class="copyall" id="ccPublish" type="button" style="width:100%">Publish &amp; Get Clickable Links</button>
          <button class="copyall" id="ccHtml" type="button" style="width:100%;margin-top:6px">Download Clickable HTML File</button>
          <p class="subnote" id="ccStatus" style="min-height:16px"></p>
          <div id="ccResults"></div>
        </div>
      </div>
      <div class="bprev">
        <canvas id="adCanvas" width="1080" height="1350" aria-label="Ad creative preview"></canvas>
        <button class="genbtn" id="dlBtn" type="button" style="max-width:420px;margin:12px auto 0;display:block">❦ &nbsp;Download PNG</button>
        <!-- One-click multi-size export. Each size is a true re-render at
             native pixels, not an upscale of the preview. -->
        <div class="exp-box">
          <div class="layer-h"><span>Export</span><span class="canva-state">1:1 · 4:5 · 9:16</span></div>
          <button class="genbtn" id="expAll" type="button" style="width:100%;margin:0">Export All Three Sizes</button>
          <p class="subnote" id="expStatus" style="min-height:16px;margin:8px 0 0"></p>
          <p class="subnote" style="margin:2px 0 0">Downloads a zip and records the export in your archive. The single-size PNG button above still works for one-offs.</p>
        </div>

        <!-- Free-placed text layers. The template's own zones still render
             underneath; these sit on top and can be dragged anywhere. -->
        <div class="layer-box">
          <div class="layer-h">
            <span>Text on the image</span>
            <button class="copybtn" id="lAdd" type="button">Add text</button>
          </div>
          <p class="subnote" style="margin:0 0 8px">Drag any text directly on the preview to place it, or use a zone preset.</p>
          <div id="layerList"></div>
          <div id="layerEditor" hidden>
            <label class="own-label" for="lText">Text</label>
            <textarea id="lText" class="own-input" rows="2"></textarea>
            <label class="own-label" for="lSize">Size <span class="adj-v" id="lSizeV">64px</span></label>
            <input type="range" id="lSize" min="18" max="220" value="64">
            <span class="own-label">Font</span><span class="chips" id="lFontChips"></span>
            <span class="own-label">Colour (brand kit only)</span><span class="chips" id="lColorChips"></span>
            <span class="own-label">Align</span><span class="chips" id="lAlignChips"></span>
            <span class="own-label">Snap to zone</span><span class="chips" id="lZoneChips"></span>
            <label class="layer-check"><input type="checkbox" id="lShadow"> Drop shadow for legibility over photos</label>
            <div class="layer-actions">
              <button class="copybtn" id="lDup" type="button">Duplicate</button>
              <button class="copybtn" id="lDel" type="button">Delete</button>
            </div>
          </div>
        </div>

        <!-- Caption: not painted on the image. Copied into Meta after download. -->
        <div class="cap-box">
          <div class="layer-h">
            <span>Caption</span>
            <span class="canva-state" id="capCount">0 characters</span>
          </div>
          <p class="subnote" style="margin:0 0 8px">This is not on the image. Copy it into Instagram or Facebook after you download.</p>
          <textarea id="capText" class="own-input" rows="6" placeholder="Write the caption, or draft one from your approved ad copy."></textarea>
          <div class="cap-actions">
            <button class="copybtn" id="capDraft" type="button">Draft from ad copy</button>
            <button class="copybtn" id="capCopy" type="button">Copy caption</button>
          </div>
          <p class="subnote" id="capStatus" style="min-height:16px;margin:6px 0 0"></p>
          <div id="capFlags"></div>
        </div>

        <div class="canva-box">
          <div class="canva-h">
            <span>Canva round-trip</span>
            <span class="canva-state" id="canvaState">checking…</span>
          </div>
          <div class="canva-actions">
            <button class="copyall" id="bCanvaSend" type="button">Send This Creative to Canva</button>
            <button class="copyall" id="bCanvaOpenDesign" type="button" hidden>Open the Design</button>
            <button class="copyall" id="bCanvaReimport" type="button" hidden>Bring the Finished Version Back</button>
            <button class="copyall" id="bCanvaConnect" type="button" hidden>Connect Canva</button>
          </div>
          <p class="subnote" id="canvaStatus" style="margin:8px 0 0"></p>
          <p class="subnote" style="margin:4px 0 0">Reimport replaces the working image with the Canva version. The version it replaces is kept for recovery.</p>
        </div>
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

  <div class="wiznav" id="wizNav">
    <button class="copyall" id="wizBack" type="button">← Back</button>
    <span class="subnote" id="wizHint" style="flex:1;text-align:center"></span>
    <button class="genbtn" id="wizNext" type="button" style="margin:0;max-width:260px;width:auto;padding:10px 22px">Continue →</button>
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
