import { useState } from "react";

const MODEL = "claude-sonnet-4-20250514";
const SERVICES = [
  ["🚨","Emergency Plumbing"],["🏠","Residential Plumbing"],["🏢","Commercial Plumbing"],
  ["📍","Local & Near Me"],["🔧","General Plumbing"],["🔥","Water Heater Repair"],
  ["🔥","Water Heater Install"],["🔥","Water Heater Replacement"],["🔩","Sewer Repair"],
  ["🔩","Sewer Installation"],["🔩","Sewer Replacement"],["🔩","Trenchless Sewer Repair"],
  ["🔩","Trenchless Sewer Install"],["🌀","Drain Repair"],["🌀","Drain Replacement"],
  ["🌀","Drain Installation"],["💧","Water Leak Repair"],["💧","Water Leak Detection"],
  ["🔧","Underground Pipe Repair"],["🏠","Whole House Repiping"],["🌊","Water Filtration Install"],
  ["🌊","Water Filtration Repair"],["💎","Water Softener Install"],["💎","Water Softener Repair"]
];

async function callClaude(systemPrompt, userMsg, maxTokens = 4000) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }]
    })
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  if (data.stop_reason === "max_tokens") throw new Error("Response cut off — try fewer services at once.");

  const raw = (data.content || []).map(b => b.text || "").join("").trim();
  const a = raw.indexOf("{");
  if (a === -1) throw new Error("No JSON in response: " + raw.slice(0, 200));

  let depth = 0, end = -1, inStr = false, esc = false;
  for (let i = a; i < raw.length; i++) {
    const ch = raw[i];
    if (esc) { esc = false; continue; }
    if (ch === "\\" && inStr) { esc = true; continue; }
    if (ch === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (ch === "{") depth++;
    if (ch === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  if (end === -1) throw new Error("JSON not closed — response may be truncated.");
  try { return JSON.parse(raw.slice(a, end + 1)); }
  catch (e) { throw new Error("Parse error: " + e.message); }
}

function kwPrompt() {
  return `You are a Google Ads keyword specialist for plumbing businesses.
Generate keywords for the given service ad group.

1. AD GROUP NAME: use the service name exactly as provided
2. KEYWORDS: exactly 8-10 highly relevant plain-text search terms. No match type formatting (no quotes, no brackets, no symbols). Mix 2-word seeds and 3-5 word intent phrases. Include "near me" variants. Title Case.

RULES:
- Plain text only — no formatting symbols
- If city is provided add 1-2 location keywords
- Buyer intent only — people ready to hire

Return ONLY raw JSON starting with { ending with }:
{"adGroup":"...","keywords":["...","...","...","...","...","...","...","..."]}`;
}

function adsPrompt(client) {
  const hasOffer = !!(client.offer && client.offer.trim());
  const hasYears = client.years >= 10;
  const h6c1 = hasOffer
    ? "H6: Use offer + credentials. Format: \"[short offer] / Licensed & Insured\" max 30 chars. Offer: \"" + client.offer + "\". Always use when offer is provided."
    : "H6: Write exactly: Licensed & Insured Plumbers";
  const h10c1 = hasYears
    ? "H10: Write exactly: " + client.years + "+ Years Experience"
    : "H10: Write exactly: Reliable Same Day Plumbing";
  const d2 = hasYears
    ? "D2: Write exactly: With Over " + client.years + " Years Of Experience, We Specialize In [Service]. Call Us Now!"
    : "D2: Write exactly: We Specialize In [Service]. Professional & Reliable. Call Us Now!";

  return "You are a Google Ads RSA copywriter. ALL headlines and descriptions must be Title Case.\n\n" +
    "HARD LIMITS: Each headline MAX 30 characters. Each description MAX 90 characters. Count carefully.\n\n" +
    "Generate exactly 2 ad copies. Each has 15 headlines and 4 descriptions.\n\n" +
    "AD COPY 1 - HEADLINES in this exact order:\n" +
    "H1: [Service] Plumber Near You\n" +
    "H2: [Service] Plumbing Service\n" +
    "H3: Same Day [Service] Available (shorten service if needed to stay under 30)\n" +
    "H4: Urgent Plumbing Help Today\n" +
    "H5: Immediate Plumbing Service\n" +
    h6c1 + "\n" +
    "H7: [Service] Plumbing Repairs\n" +
    "H8: Local [Service] Plumbers\n" +
    "H9: No Hidden Fees\n" +
    h10c1 + "\n" +
    "H11: Reliable Same Day Plumbing\n" +
    "H12: A+ BBB Rated Plumbing Company\n" +
    "H13: Book [Service] Plumbing Now\n" +
    "H14: Need A Plumber Fast? Call Now\n" +
    "H15: Same Day [Service] Services\n\n" +
    "AD COPY 2 - HEADLINES in this exact order:\n" +
    "H1: [Service] Plumber Available\n" +
    "H2: Need Urgent Plumbing Help?\n" +
    "H3: Same Day [Service] Plumber\n" +
    "H4: Fast Help For Plumbing Issues\n" +
    "H5: Local Plumber Ready To Help\n" +
    "H6: Plumbing Problem? Call Now\n" +
    "H7: Immediate Help For Leaks & Clogs (trim if over 30)\n" +
    "H8: [Service] Plumbing Done Right\n" +
    "H9: Quick Local Plumbing Response\n" +
    "H10: Book A Plumber Today\n" +
    "H11: Licensed & Insured Plumbers\n" +
    "H12: Most Trusted [Service] Plumber (shorten service if needed)\n" +
    "H13: Fast Fix For Plumbing Problems\n" +
    "H14: Get A Plumber Out Today\n" +
    "H15: Call Now For Urgent Plumbing\n\n" +
    "DESCRIPTIONS - same 4 for both copies, Title Case, max 90 chars each:\n" +
    "D1: Schedule [Service] With No Hidden Charges. Give Us A Call Now!\n" +
    d2 + "\n" +
    "D3: We Are Your Local, Professional & Reliable [Service] Expert. Call Us Now.\n" +
    "D4: We Offer Affordable, Reliable, And Top-Rated [Service]. Get A Quote Now!\n\n" +
    "Replace [Service] with the actual service name in Title Case. Shorten as needed to stay under char limits.\n" +
    "Path URL 1 = main service word lowercase (e.g. emergency). Path URL 2 = plumbing.\n\n" +
    "Return ONLY a raw JSON object. No markdown. No explanation. No preamble. Start response with { and end with }.\n" +
    "{\"variants\":[{\"label\":\"Ad Copy 1\",\"headlines\":[\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\"],\"descriptions\":[\"fill\",\"fill\",\"fill\",\"fill\"],\"pathUrl1\":\"fill\",\"pathUrl2\":\"plumbing\"},{\"label\":\"Ad Copy 2\",\"headlines\":[\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\"],\"descriptions\":[\"fill\",\"fill\",\"fill\",\"fill\"],\"pathUrl1\":\"fill\",\"pathUrl2\":\"plumbing\"}]}";
}

function assetsPrompt() {
  return "You are a Google Ads asset specialist for plumbing.\n\n" +
    "SITELINKS: exactly 4. Each has: text (max 25 chars), desc1 (benefit, max 35 chars), desc2 (action, max 35 chars).\n" +
    "CALLOUTS: exactly 8, each 2-4 words max 25 chars. Examples: 24/7 Emergency Service, No Hidden Fees, Licensed & Insured, Same-Day Service\n" +
    "STRUCTURED SNIPPETS: header is Services, values are 5-6 relevant sub-services.\n\n" +
    "Return ONLY raw JSON. No markdown. No preamble. Start with { end with }.\n" +
    "{\"sitelinks\":[{\"text\":\"fill\",\"desc1\":\"fill\",\"desc2\":\"fill\"},{\"text\":\"fill\",\"desc1\":\"fill\",\"desc2\":\"fill\"},{\"text\":\"fill\",\"desc1\":\"fill\",\"desc2\":\"fill\"},{\"text\":\"fill\",\"desc1\":\"fill\",\"desc2\":\"fill\"}],\"callouts\":[\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\",\"fill\"],\"snippets\":{\"header\":\"Services\",\"values\":[\"fill\",\"fill\",\"fill\",\"fill\",\"fill\"]}}";
}

function lpPrompt() {
  return "You are a conversion copywriter for plumbing landing pages.\n\n" +
    "Generate content for these exact sections based on the client details provided:\n\n" +
    "announcementBar: text = short offer or financing line. cta = 2-3 word button label.\n\n" +
    "hero: ratingLine = always write exactly: Rated 4.9 on Google. h1 = benefit-led headline including service and location. subheadline = 1-2 sentences with urgency and business name. bullets = exactly 3 trust points starting with a checkmark covering: speed, pricing transparency, credentials. cta = write exactly: [PHONE]. promoBadge = X+ Years of Experience using actual years if provided.\n\n" +
    "servicesOverview: label = Our [Service] Services. h2 = problem-aware urgency headline. intro = 2-3 sentences mentioning years in business and urgency. cards = exactly 4 cards each with icon (single emoji), title (specific sub-service), body (2-3 sentences: problem then fast response then outcome).\n\n" +
    "trustBlock: label = Trusted [Service] Company for. h2 = Fast, Same-Day Service. para1 = 3-4 sentences about speed and quality mentioning business name. para2 = 3-4 sentences about differentiators. promiseLabel = Our Promise to Every Customer. promises = exactly 4 items: first about years of trust, second about family-owned local focus, third about licensed insured BBB, fourth about savings and coupons. Each promise has icon (single emoji), title, and body.\n\n" +
    "ctaSection: primary = Schedule Now. secondary = [PHONE].\n\n" +
    "JSON SAFETY RULES:\n" +
    "- Return ONLY a raw JSON object. No markdown. No explanation. No preamble.\n" +
    "- First character must be { and last character must be }\n" +
    "- Do NOT use apostrophes anywhere in the text (write: do not, we are, it is — never don't, we're, it's)\n" +
    "- Do NOT use double quotes inside string values\n" +
    "- No newlines inside any string values\n" +
    "- Keep body and paragraph strings under 220 characters each\n\n" +
    "{\"announcementBar\":{\"text\":\"fill\",\"cta\":\"fill\"},\"hero\":{\"ratingLine\":\"fill\",\"h1\":\"fill\",\"subheadline\":\"fill\",\"bullets\":[\"fill\",\"fill\",\"fill\"],\"cta\":\"[PHONE]\",\"promoBadge\":\"fill\"},\"servicesOverview\":{\"label\":\"fill\",\"h2\":\"fill\",\"intro\":\"fill\",\"cards\":[{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"},{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"},{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"},{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"}]},\"trustBlock\":{\"label\":\"fill\",\"h2\":\"Fast, Same-Day Service\",\"para1\":\"fill\",\"para2\":\"fill\",\"promiseLabel\":\"Our Promise to Every Customer\",\"promises\":[{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"},{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"},{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"},{\"icon\":\"fill\",\"title\":\"fill\",\"body\":\"fill\"}]},\"ctaSection\":{\"primary\":\"Schedule Now\",\"secondary\":\"[PHONE]\"}}";
}

const css = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:Inter,system-ui,sans-serif;background:#f3f4f6;color:#111827;font-size:13px}
  .wrap{display:flex;height:100vh;overflow:hidden}
  .left{width:280px;min-width:280px;background:#fff;border-right:1px solid #e5e7eb;display:flex;flex-direction:column;overflow-y:auto}
  .left-inner{padding:16px;display:flex;flex-direction:column;gap:16px;flex:1}
  .right{flex:1;overflow-y:auto;padding:20px;display:flex;flex-direction:column;gap:20px}
  .topbar{background:#fff;border-bottom:1px solid #e5e7eb;height:52px;padding:0 20px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
  .brand{display:flex;align-items:center;gap:9px}
  .brand-icon{width:32px;height:32px;background:linear-gradient(135deg,#1a56db,#3b82f6);border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:16px}
  .brand-name{font-size:14px;font-weight:700;letter-spacing:-.02em}
  .brand-sub{font-size:10px;color:#9ca3af;font-family:monospace;background:#f3f4f6;padding:2px 6px;border-radius:4px;margin-left:3px}
  .powered{background:#eff6ff;color:#1d4ed8;font-size:11px;font-weight:500;padding:3px 8px;border-radius:5px}
  .sec-title{font-size:10px;font-weight:600;letter-spacing:.08em;text-transform:uppercase;color:#9ca3af;padding-bottom:7px;border-bottom:1px solid #e5e7eb;margin-bottom:6px}
  .field{display:flex;flex-direction:column;gap:3px;margin-bottom:8px}
  .field label{font-size:11px;font-weight:500;color:#6b7280}
  .field input,.field textarea{padding:7px 10px;border:1px solid #e5e7eb;border-radius:7px;font-family:inherit;font-size:12px;color:#111827;background:#f9fafb;outline:none;width:100%}
  .field input:focus,.field textarea:focus{border-color:#3b82f6;background:#fff;box-shadow:0 0 0 3px rgba(59,130,246,.1)}
  .field textarea{resize:vertical;min-height:52px}
  .chips{display:flex;flex-direction:column;gap:4px;max-height:240px;overflow-y:auto}
  .chip{padding:6px 10px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:11px;font-weight:500;color:#6b7280;cursor:pointer;text-align:left;background:#fff;user-select:none}
  .chip:hover{border-color:#3b82f6;color:#1d4ed8;background:#eff6ff}
  .chip.on{background:#1d4ed8;border-color:#1d4ed8;color:#fff;font-weight:600}
  .mods{display:flex;flex-direction:column;gap:6px}
  .mod{display:flex;align-items:center;justify-content:space-between;padding:8px 11px;border:1.5px solid #e5e7eb;border-radius:7px;cursor:pointer;background:#fff}
  .mod.on{border-color:#3b82f6;background:#eff6ff}
  .mod-lbl{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:500;color:#374151}
  .mod.on .mod-lbl{color:#1d4ed8}
  .dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
  .sw{width:30px;height:17px;background:#d1d5db;border-radius:9px;position:relative;transition:background .2s;flex-shrink:0}
  .sw::after{content:'';position:absolute;width:13px;height:13px;background:#fff;border-radius:50%;top:2px;left:2px;transition:transform .2s;box-shadow:0 1px 2px rgba(0,0,0,.2)}
  .mod.on .sw{background:#1d4ed8}
  .mod.on .sw::after{transform:translateX(13px)}
  .gen-btn{width:100%;padding:10px;background:linear-gradient(135deg,#1a56db,#2563eb);color:#fff;border:none;border-radius:8px;font-family:inherit;font-size:13px;font-weight:600;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:7px;margin-top:4px}
  .gen-btn:disabled{background:#d1d5db;cursor:not-allowed}
  .spin{width:14px;height:14px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:spin .65s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .empty{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:80px 40px;color:#9ca3af;min-height:300px}
  .empty-icon{font-size:40px;margin-bottom:14px;opacity:.4}
  .svc-block{display:flex;flex-direction:column;gap:12px}
  .svc-header{display:flex;align-items:center;gap:10px;padding-bottom:10px;border-bottom:2px solid #e5e7eb}
  .svc-icon{width:36px;height:36px;border-radius:9px;background:#eff6ff;color:#1d4ed8;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0}
  .svc-name{font-size:17px;font-weight:700;color:#111827}
  .ocard{background:#fff;border:1px solid #e5e7eb;border-radius:10px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.07)}
  .ocard-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:#f9fafb;border-bottom:1px solid #e5e7eb}
  .ocard-title{display:flex;align-items:center;gap:7px;font-size:12px;font-weight:600;color:#374151}
  .ocard-badge{font-size:9px;font-weight:600;padding:2px 6px;border-radius:4px;font-family:monospace;letter-spacing:.04em}
  .ocard-body{padding:14px}
  .copy-btn{padding:4px 10px;border:1px solid #e5e7eb;border-radius:5px;background:#fff;font-family:inherit;font-size:11px;font-weight:500;color:#6b7280;cursor:pointer}
  .copy-btn:hover{border-color:#3b82f6;color:#1d4ed8;background:#eff6ff}
  .copy-btn.ok{background:#ecfdf5;color:#059669;border-color:#6ee7b7}
  .kw-core{background:#f9fafb;border:1px solid #e5e7eb;border-radius:7px;padding:9px 11px;margin-bottom:10px}
  .kw-lbl{font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px}
  .kw-name{font-size:12px;font-weight:600;color:#1f2937;margin-bottom:8px}
  .kw-chips{display:flex;flex-wrap:wrap;gap:4px}
  .kw{padding:3px 9px;border-radius:14px;font-size:11px;font-family:monospace;border:1px solid;background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
  .ad-tabs{display:flex;gap:7px;margin-bottom:12px}
  .ad-tab{flex:1;padding:7px;border:1.5px solid #e5e7eb;border-radius:7px;font-size:11px;font-weight:500;color:#6b7280;cursor:pointer;text-align:center;background:#fff}
  .ad-tab.on{border-color:#3b82f6;background:#eff6ff;color:#1d4ed8;font-weight:600}
  .h-grid{display:flex;flex-direction:column;gap:1px;margin-bottom:10px}
  .h-row{display:flex;align-items:baseline;gap:7px;padding:3px 0;border-bottom:1px solid #f3f4f6}
  .h-num{font-size:9px;font-family:monospace;color:#9ca3af;min-width:22px;flex-shrink:0}
  .h-text{font-size:12px;font-weight:500;color:#1a56db;flex:1}
  .h-cnt{font-size:9px;font-family:monospace;color:#9ca3af;flex-shrink:0}
  .h-cnt.warn{color:#d97706}.h-cnt.over{color:#dc2626;font-weight:700}
  .d-grid{display:flex;flex-direction:column;gap:5px}
  .d-row{display:flex;align-items:flex-start;gap:7px;padding:6px 9px;background:#f9fafb;border-radius:5px;border:1px solid #f3f4f6}
  .d-num{font-size:9px;font-family:monospace;color:#9ca3af;min-width:22px;flex-shrink:0;padding-top:2px}
  .d-text{font-size:11px;color:#374151;flex:1;line-height:1.5}
  .d-cnt{font-size:9px;font-family:monospace;color:#9ca3af;flex-shrink:0;white-space:nowrap}
  .d-cnt.warn{color:#d97706}.d-cnt.over{color:#dc2626;font-weight:700}
  .url-row{display:flex;align-items:center;gap:7px;margin-top:10px;padding-top:8px;border-top:1px solid #f3f4f6;flex-wrap:wrap}
  .url-pill{font-size:10px;font-family:monospace;background:#f3f4f6;color:#4b5563;padding:2px 7px;border-radius:4px;border:1px solid #e5e7eb}
  .sec-div{font-size:10px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin:8px 0 5px;padding-bottom:3px;border-bottom:1px solid #f3f4f6;display:flex;align-items:center;gap:5px}
  .sec-div span{font-weight:400;font-size:9px;color:#9ca3af}
  .asset-sec{margin-bottom:14px}
  .sl-card{border:1px solid #e5e7eb;border-radius:7px;padding:9px 11px;margin-bottom:6px;background:#f9fafb}
  .sl-text{font-size:12px;font-weight:600;color:#1d4ed8;margin-bottom:3px}
  .sl-descs{font-size:11px;color:#6b7280;line-height:1.6}
  .callout-chips{display:flex;flex-wrap:wrap;gap:5px}
  .callout{padding:3px 10px;border-radius:14px;font-size:11px;font-weight:500;background:#fffbeb;color:#d97706;border:1px solid #fde68a}
  .lp-block{border:1px solid #e5e7eb;border-radius:7px;overflow:hidden;margin-bottom:7px}
  .lp-bhead{padding:5px 11px;background:#f3f4f6;font-size:9px;font-weight:600;color:#9ca3af;text-transform:uppercase;letter-spacing:.07em;border-bottom:1px solid #e5e7eb;font-family:monospace}
  .lp-bbody{padding:9px 11px;font-size:12px;color:#374151;line-height:1.65;white-space:pre-line;background:#fff}
  .lp-bbody.hl{font-size:14px;font-weight:700;color:#111827}
  .lp-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:7px;margin-bottom:7px}
  .lp-card{border:1px solid #e5e7eb;border-radius:7px;overflow:hidden}
  .loading{display:flex;align-items:center;gap:12px;padding:16px;background:#fff;border:1px solid #e5e7eb;border-radius:10px}
  .loading-spin{width:28px;height:28px;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0}
  .loading-spin .spin{display:block;width:18px;height:18px}
  .err{background:#fef2f2;border:1px solid #fecaca;border-radius:7px;padding:10px 13px;font-size:12px;color:#dc2626}
`;

function cc(s) { return s ? s.length : 0; }
function cCls(n, lim) { return n > lim ? "over" : n > lim * 0.9 ? "warn" : ""; }

function CopyBtn({ getText }) {
  const [ok, setOk] = useState(false);
  return (
    <button className={`copy-btn${ok ? " ok" : ""}`} onClick={() => {
      navigator.clipboard.writeText(getText()).then(() => { setOk(true); setTimeout(() => setOk(false), 2000); });
    }}>{ok ? "✓ Copied" : "⎘ Copy"}</button>
  );
}

function KwCard({ data }) {
  return (
    <div className="ocard">
      <div className="ocard-head">
        <div className="ocard-title">🔍 Keywords <span className="ocard-badge" style={{background:"#eff6ff",color:"#1d4ed8"}}>KEYWORDS</span></div>
        <CopyBtn getText={() => `AD GROUP: ${data.adGroup}\n\nKEYWORDS:\n${(data.keywords||[]).join("\n")}`} />
      </div>
      <div className="ocard-body">
        <div className="kw-core">
          <div className="kw-lbl">Ad Group</div>
          <div className="kw-name">{data.adGroup}</div>
          <div className="kw-lbl">Keywords</div>
          <div className="kw-chips">{(data.keywords||[]).map((k,i) => <span key={i} className="kw">{k}</span>)}</div>
        </div>
      </div>
    </div>
  );
}

function AdsCard({ data }) {
  const [tab, setTab] = useState(0);
  const v = data.variants?.[tab] || {};
  return (
    <div className="ocard">
      <div className="ocard-head">
        <div className="ocard-title">📝 RSA Ad Copies <span className="ocard-badge" style={{background:"#ecfdf5",color:"#059669"}}>2 COPIES</span></div>
        <CopyBtn getText={() => (data.variants||[]).map(v =>
          `${v.label}\n\nHEADLINES:\n${(v.headlines||[]).map((h,i)=>`H${i+1}: ${h} (${cc(h)} chars)`).join("\n")}\n\nDESCRIPTIONS:\n${(v.descriptions||[]).map((d,i)=>`D${i+1}: ${d} (${cc(d)} chars)`).join("\n")}\n\nPath URLs: ${v.pathUrl1} / ${v.pathUrl2}`
        ).join("\n\n─────────────────────\n\n")} />
      </div>
      <div className="ocard-body">
        <div className="ad-tabs">
          {(data.variants||[]).map((v,i) => <div key={i} className={`ad-tab${tab===i?" on":""}`} onClick={()=>setTab(i)}>📄 {v.label}</div>)}
        </div>
        <div className="sec-div">Headlines <span>30 char limit</span></div>
        <div className="h-grid">
          {(v.headlines||[]).map((h,i) => { const c=cc(h); return <div key={i} className="h-row"><span className="h-num">H{i+1}</span><span className="h-text">{h}</span><span className={`h-cnt ${cCls(c,30)}`}>{c}/30</span></div>; })}
        </div>
        <div className="sec-div">Descriptions <span>90 char limit</span></div>
        <div className="d-grid">
          {(v.descriptions||[]).map((d,i) => { const c=cc(d); return <div key={i} className="d-row"><span className="d-num">D{i+1}</span><span className="d-text">{d}</span><span className={`d-cnt ${cCls(c,90)}`}>{c}/90</span></div>; })}
        </div>
        <div className="url-row">
          <span style={{fontSize:10,color:"#9ca3af"}}>Path URLs:</span>
          <span className="url-pill">{v.pathUrl1||"—"}</span>
          <span className="url-pill">{v.pathUrl2||"—"}</span>
        </div>
      </div>
    </div>
  );
}

function AssetsCard({ data }) {
  return (
    <div className="ocard">
      <div className="ocard-head">
        <div className="ocard-title">📎 Ad Assets <span className="ocard-badge" style={{background:"#fffbeb",color:"#d97706"}}>ASSETS</span></div>
        <CopyBtn getText={() => `SITELINKS:\n${(data.sitelinks||[]).map((s,i)=>`SL${i+1}: ${s.text}\n  ${s.desc1}\n  ${s.desc2}`).join("\n")}\n\nCALLOUTS:\n${(data.callouts||[]).join(", ")}\n\nSNIPPETS:\nHeader: ${data.snippets?.header}\nValues: ${(data.snippets?.values||[]).join(", ")}`} />
      </div>
      <div className="ocard-body">
        <div className="asset-sec">
          <div className="kw-lbl">Sitelinks</div>
          {(data.sitelinks||[]).map((s,i) => <div key={i} className="sl-card"><div className="sl-text">SL{i+1}: {s.text}</div><div className="sl-descs">{s.desc1}<br/>{s.desc2}</div></div>)}
        </div>
        <div className="asset-sec">
          <div className="kw-lbl">Callouts</div>
          <div className="callout-chips">{(data.callouts||[]).map((c,i) => <span key={i} className="callout">{c}</span>)}</div>
        </div>
        <div className="asset-sec">
          <div className="kw-lbl">Structured Snippets</div>
          <div style={{fontSize:11}}><strong>{data.snippets?.header}:</strong> {(data.snippets?.values||[]).join(" · ")}</div>
        </div>
      </div>
    </div>
  );
}

function LpCard({ data }) {
  const b = (label, content, hl) => (
    <div className="lp-block" key={label}>
      <div className="lp-bhead">{label}</div>
      <div className={`lp-bbody${hl ? " hl" : ""}`}>{content}</div>
    </div>
  );
  const getText = () => [
    `SECTION 1 — ANNOUNCEMENT BAR\nText: ${data.announcementBar?.text}\nCTA: ${data.announcementBar?.cta}`,
    `\nSECTION 2 — HERO\nRating: ${data.hero?.ratingLine}\nH1: ${data.hero?.h1}\nSubheadline: ${data.hero?.subheadline}\nBullets:\n${(data.hero?.bullets||[]).join("\n")}\nCTA: ${data.hero?.cta}\nPromo Badge: ${data.hero?.promoBadge||""}`,
    `\nSECTION 4 — SERVICES OVERVIEW\nLabel: ${data.servicesOverview?.label}\nH2: ${data.servicesOverview?.h2}\nIntro: ${data.servicesOverview?.intro}\n${(data.servicesOverview?.cards||[]).map((c,i)=>`Card ${i+1} ${c.icon||""}: ${c.title}\n${c.body}`).join("\n\n")}`,
    `\nSECTION 5 — TRUST BLOCK\nLabel: ${data.trustBlock?.label}\nH2: ${data.trustBlock?.h2}\nPara 1: ${data.trustBlock?.para1}\nPara 2: ${data.trustBlock?.para2}\n${data.trustBlock?.promiseLabel}\n${(data.trustBlock?.promises||[]).map(p=>`${p.icon} ${p.title}: ${p.body}`).join("\n")}`,
    `\nCTA BUTTONS\nPrimary: ${data.ctaSection?.primary} | Secondary: ${data.ctaSection?.secondary}`
  ].join("\n");

  return (
    <div className="ocard">
      <div className="ocard-head">
        <div className="ocard-title">🖥️ Landing Page <span className="ocard-badge" style={{background:"#f5f3ff",color:"#7c3aed"}}>LANDING PAGE</span></div>
        <CopyBtn getText={getText} />
      </div>
      <div className="ocard-body">
        {b("Section 1 — Announcement Bar", `${data.announcementBar?.text}  |  CTA: ${data.announcementBar?.cta}`)}
        {b("Section 2 — Rating Line", data.hero?.ratingLine)}
        {b("H1 Headline", data.hero?.h1, true)}
        {b("Subheadline", data.hero?.subheadline)}
        {b("Trust Bullets", (data.hero?.bullets||[]).join("\n"))}
        {b("Primary CTA", data.hero?.cta)}
        {b("Promo Badge", data.hero?.promoBadge||"")}
        {b("Section 4 — Services Label", data.servicesOverview?.label)}
        {b("H2 — Services Headline", data.servicesOverview?.h2, true)}
        {b("Intro Paragraph", data.servicesOverview?.intro)}
        <div className="lp-card-grid">
          {(data.servicesOverview?.cards||[]).map((c,i) => (
            <div key={i} className="lp-card">
              <div className="lp-bhead">Card {i+1} {c.icon||""}</div>
              <div className="lp-bbody"><strong>{c.title}</strong><br/><br/>{c.body}</div>
            </div>
          ))}
        </div>
        {b("Section 5 — Trust Label", data.trustBlock?.label)}
        {b("H2 — Trust Headline", data.trustBlock?.h2, true)}
        {b("Paragraph 1", data.trustBlock?.para1)}
        {b("Paragraph 2", data.trustBlock?.para2)}
        {(data.trustBlock?.promises||[]).map((p,i) => b(`Promise ${i+1}`, `${p.icon} ${p.title}\n${p.body}`))}
        {b("CTA Buttons", `Primary: ${data.ctaSection?.primary}  |  Secondary: ${data.ctaSection?.secondary}`)}
      </div>
    </div>
  );
}

export default function App() {
  const [selected, setSelected] = useState(new Set());
  const [mods, setMods] = useState(new Set(["kw","ads","assets","lp"]));
  const [client, setClient] = useState({ name:"", city:"", years:"", usps:"", offer:"", phone:"" });
  const [results, setResults] = useState([]);
  const [running, setRunning] = useState(false);

  const toggleSvc = s => setSelected(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  const toggleMod = m => setMods(prev => { const n = new Set(prev); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const setField = k => e => setClient(prev => ({ ...prev, [k]: e.target.value }));

  const generate = async () => {
    if (!selected.size) { alert("Select at least one service."); return; }
    if (!mods.size) { alert("Enable at least one module."); return; }
    setRunning(true);
    setResults([]);
    const c = { ...client, years: parseInt(client.years) || 0 };
    const ctxTpl = `Service: {SVC}\nBusiness Name: ${c.name||"the client"}\nCity: ${c.city||"not provided"}\nYears in Business: ${c.years||"not provided"}\nUSPs: ${c.usps||"not provided"}\nOffer/Promo: ${c.offer||"none"}\nPhone: ${c.phone||"[PHONE]"}`;
    const svcList = [...selected];
    const res = svcList.map(svc => ({ svc, kw:null, ads:null, assets:null, lp:null, errors:{} }));
    setResults([...res]);
    const delay = ms => new Promise(r => setTimeout(r, ms));

    for (let i = 0; i < svcList.length; i++) {
      const ctx = ctxTpl.replace("{SVC}", svcList[i]);
      if (mods.has("kw")) {
        await callClaude(kwPrompt(), ctx, 1500)
          .then(d => { res[i].kw = d; setResults([...res]); })
          .catch(e => { res[i].errors.kw = e.message; setResults([...res]); });
        await delay(400);
      }
      if (mods.has("ads")) {
        await callClaude(adsPrompt(c), ctx, 4000)
          .then(d => { res[i].ads = d; setResults([...res]); })
          .catch(e => { res[i].errors.ads = e.message; setResults([...res]); });
        await delay(400);
      }
      if (mods.has("assets")) {
        await callClaude(assetsPrompt(), ctx, 2000)
          .then(d => { res[i].assets = d; setResults([...res]); })
          .catch(e => { res[i].errors.assets = e.message; setResults([...res]); });
        await delay(400);
      }
      if (mods.has("lp")) {
        await callClaude(lpPrompt(), ctx, 8000)
          .then(d => { res[i].lp = d; setResults([...res]); })
          .catch(e => { res[i].errors.lp = e.message; setResults([...res]); });
        if (i < svcList.length - 1) await delay(400);
      }
    }
    setRunning(false);
  };

  const modConfig = [
    { id:"kw", label:"Keywords", color:"#1d4ed8" },
    { id:"ads", label:"RSA Ad Copies", color:"#059669" },
    { id:"assets", label:"Ad Assets", color:"#d97706" },
    { id:"lp", label:"Landing Page", color:"#7c3aed" },
  ];

  return (
    <>
      <style>{css}</style>
      <div style={{display:"flex",flexDirection:"column",height:"100vh"}}>
        <div className="topbar">
          <div className="brand">
            <div className="brand-icon">🔧</div>
            <span className="brand-name">PlumbAds</span>
            <span className="brand-sub">v1.0</span>
          </div>
          <div className="powered">Powered by Claude AI</div>
        </div>
        <div className="wrap">
          <div className="left">
            <div className="left-inner">
              <div>
                <div className="sec-title">Client Details</div>
                <div className="field"><label>Business name</label><input value={client.name} onChange={setField("name")} placeholder="e.g. Rapid Flow Plumbing"/></div>
                <div className="field"><label>City / Service area</label><input value={client.city} onChange={setField("city")} placeholder="e.g. Phoenix, AZ"/></div>
                <div className="field"><label>Years in business</label><input type="number" value={client.years} onChange={setField("years")} placeholder="e.g. 12"/></div>
                <div className="field"><label>Key USPs</label><textarea value={client.usps} onChange={setField("usps")} placeholder="e.g. 24/7 service, same-day, family-owned..."/></div>
                <div className="field"><label>Current offer / promo <span style={{fontWeight:400,color:"#9ca3af"}}>(optional)</span></label><input value={client.offer} onChange={setField("offer")} placeholder="e.g. $49 Drain Cleaning Special"/></div>
                <div className="field"><label>Phone number</label><input value={client.phone} onChange={setField("phone")} placeholder="e.g. (602) 555-0100"/></div>
              </div>
              <div>
                <div className="sec-title">Select Services</div>
                <div className="chips">
                  {SERVICES.map(([icon,svc]) => (
                    <div key={svc} className={`chip${selected.has(svc)?" on":""}`} onClick={() => toggleSvc(svc)}>{icon} {svc}</div>
                  ))}
                </div>
              </div>
              <div>
                <div className="sec-title">Output Modules</div>
                <div className="mods">
                  {modConfig.map(m => (
                    <div key={m.id} className={`mod${mods.has(m.id)?" on":""}`} onClick={() => toggleMod(m.id)}>
                      <div className="mod-lbl"><div className="dot" style={{background:m.color}}/>{m.label}</div>
                      <div className="sw"/>
                    </div>
                  ))}
                </div>
              </div>
              <button className="gen-btn" onClick={generate} disabled={running}>
                {running && <div className="spin"/>}
                <span>{running ? "Generating…" : "✨ Generate Content"}</span>
              </button>
            </div>
          </div>
          <div className="right">
            {results.length === 0 && !running && (
              <div className="empty">
                <div className="empty-icon">🔧</div>
                <div style={{fontSize:14,fontWeight:600,color:"#6b7280",marginBottom:6}}>Ready to generate</div>
                <div style={{fontSize:12,lineHeight:1.7,maxWidth:280,color:"#9ca3af"}}>Fill in client details, pick services, then click Generate.</div>
              </div>
            )}
            {results.map(({ svc, kw, ads, assets, lp, errors }, i) => {
              const icon = (SERVICES.find(([,s]) => s === svc)||["🔧"])[0];
              const loading = (label, color) => (
                <div className="loading">
                  <div className="loading-spin" style={{background:color+"22"}}>
                    <div className="spin" style={{borderColor:color+"44",borderTopColor:color}}/>
                  </div>
                  <div style={{fontSize:12,color:"#6b7280"}}>Generating <strong>{label}</strong> for <strong>{svc}</strong>…</div>
                </div>
              );
              return (
                <div key={i} className="svc-block">
                  <div className="svc-header">
                    <div className="svc-icon">{icon}</div>
                    <div className="svc-name">{svc}</div>
                  </div>
                  {mods.has("kw") && (kw ? <KwCard data={kw}/> : errors.kw ? <div className="err">Keywords failed: {errors.kw}</div> : loading("keywords","#1d4ed8"))}
                  {mods.has("ads") && (ads ? <AdsCard data={ads}/> : errors.ads ? <div className="err">Ad copies failed: {errors.ads}</div> : loading("RSA ad copies","#059669"))}
                  {mods.has("assets") && (assets ? <AssetsCard data={assets}/> : errors.assets ? <div className="err">Assets failed: {errors.assets}</div> : loading("ad assets","#d97706"))}
                  {mods.has("lp") && (lp ? <LpCard data={lp}/> : errors.lp ? <div className="err">Landing page failed: {errors.lp}</div> : loading("landing page","#7c3aed"))}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
