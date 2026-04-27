import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { chromium } = await import("@playwright/test");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..");
const downloadsDir = path.join(repoRoot, "downloads");
const generatedDate = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "long",
  day: "numeric",
}).format(new Date());

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeXml(value) {
  return escapeHtml(value);
}

function bulletList(items) {
  return `
    <ul class="bullet-list">
      ${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
    </ul>
  `;
}

function paragraphBlock(paragraphs) {
  return paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("");
}

function buildInfographicSvg(config) {
  const width = 1600;
  const height = 900;
  const cardWidth = 320;
  const gap = 40;
  const startX = 80;
  const startY = 230;
  const cardHeight = 420;
  const footerY = 735;
  const positions = config.columns.map((_, index) => startX + index * (cardWidth + gap));

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">${escapeXml(config.title)}</title>
  <desc id="desc">${escapeXml(config.subtitle)}</desc>
  <defs>
    <linearGradient id="hero" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${config.heroFrom}" />
      <stop offset="100%" stop-color="${config.heroTo}" />
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="16" flood-color="#0f172a" flood-opacity="0.12" />
    </filter>
  </defs>
  <rect width="${width}" height="${height}" fill="#f7f9fc" />
  <rect x="0" y="0" width="${width}" height="170" fill="url(#hero)" />
  <text x="80" y="78" fill="#ffffff" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="38" font-weight="800">${escapeXml(config.title)}</text>
  <text x="80" y="118" fill="rgba(255,255,255,0.92)" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="20">${escapeXml(config.subtitle)}</text>
  ${config.columns
    .map((column, index) => {
      const x = positions[index];
      const arrowX = x + cardWidth + 10;
      return `
    <rect x="${x}" y="${startY}" width="${cardWidth}" height="${cardHeight}" rx="26" fill="#ffffff" filter="url(#shadow)" />
    <rect x="${x}" y="${startY}" width="${cardWidth}" height="78" rx="26" fill="${config.headerColors[index]}" />
    <text x="${x + 26}" y="${startY + 44}" fill="#ffffff" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="28" font-weight="800">${escapeXml(column.heading)}</text>
    <text x="${x + 26}" y="${startY + 96}" fill="#334155" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="20" font-weight="700">${escapeXml(column.tagline)}</text>
    ${column.items
      .map((item, itemIndex) => {
        const y = startY + 145 + itemIndex * 54;
        return `
    <circle cx="${x + 30}" cy="${y - 6}" r="7" fill="${config.headerColors[index]}" />
    <text x="${x + 50}" y="${y}" fill="#0f172a" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="22">${escapeXml(item)}</text>`;
      })
      .join("")}
    ${
      index < config.columns.length - 1
        ? `
    <path d="M ${arrowX} ${startY + cardHeight / 2} C ${arrowX + 20} ${startY + cardHeight / 2}, ${arrowX + 40} ${startY + cardHeight / 2}, ${arrowX + 70} ${startY + cardHeight / 2}" fill="none" stroke="${config.headerColors[index]}" stroke-width="10" stroke-linecap="round" />
    <path d="M ${arrowX + 56} ${startY + cardHeight / 2 - 18} L ${arrowX + 88} ${startY + cardHeight / 2} L ${arrowX + 56} ${startY + cardHeight / 2 + 18}" fill="none" stroke="${config.headerColors[index]}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" />`
        : ""
    }`;
    })
    .join("")}
  <rect x="80" y="${footerY}" width="1440" height="110" rx="24" fill="#ffffff" stroke="#dbe4f0" stroke-width="2" />
  <text x="115" y="${footerY + 42}" fill="#0f172a" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="24" font-weight="800">${escapeXml(config.footerHeading)}</text>
  <text x="115" y="${footerY + 78}" fill="#475569" font-family="'Avenir Next', 'Segoe UI', sans-serif" font-size="20">${escapeXml(config.footerText)}</text>
</svg>`;
}

function buildDocumentHtml(doc, svgMarkup) {
  const coverHighlights = doc.coverHighlights
    .map((item) => `<div class="highlight-chip">${escapeHtml(item)}</div>`)
    .join("");
  const sectionHtml = doc.sections
    .map((section) => {
      const body = section.paragraphs ? paragraphBlock(section.paragraphs) : "";
      const bullets = section.bullets ? bulletList(section.bullets) : "";
      const callout = section.callout
        ? `
          <div class="callout">
            <div class="callout-label">${escapeHtml(section.callout.label)}</div>
            <div class="callout-text">${escapeHtml(section.callout.text)}</div>
          </div>
        `
        : "";
      return `
        <section class="content-card">
          <div class="section-kicker">${escapeHtml(section.kicker)}</div>
          <h2>${escapeHtml(section.heading)}</h2>
          ${body}
          ${bullets}
          ${callout}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(doc.title)}</title>
    <style>
      @page {
        size: Letter;
        margin: 0.55in;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        color: #10243f;
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: #f4f7fb;
      }
      .page {
        page-break-after: always;
        min-height: 9.6in;
        display: flex;
        flex-direction: column;
        gap: 22px;
      }
      .page:last-child {
        page-break-after: auto;
      }
      .hero {
        border-radius: 28px;
        padding: 34px 36px 28px;
        color: #ffffff;
        background: linear-gradient(135deg, ${doc.heroFrom}, ${doc.heroTo});
      }
      .eyebrow {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.9;
      }
      h1 {
        margin: 12px 0 10px;
        font-size: 34px;
        line-height: 1.08;
      }
      .subtitle {
        margin: 0;
        max-width: 8.6in;
        font-size: 17px;
        line-height: 1.55;
        color: rgba(255, 255, 255, 0.94);
      }
      .meta-row {
        margin-top: 22px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .meta-chip,
      .highlight-chip {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        padding: 8px 12px;
        border-radius: 999px;
        font-size: 12px;
        font-weight: 700;
      }
      .meta-chip {
        background: rgba(255, 255, 255, 0.18);
      }
      .highlight-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
      }
      .highlight-chip {
        justify-content: flex-start;
        border-radius: 18px;
        background: #ffffff;
        color: #12335a;
        min-height: 54px;
        padding: 14px 16px;
        line-height: 1.4;
      }
      .cover-layout {
        display: grid;
        grid-template-columns: 1.2fr 0.9fr;
        gap: 18px;
      }
      .content-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 16px;
      }
      .content-card,
      .closing-card,
      .legend-card {
        background: #ffffff;
        border: 1px solid #dbe4f0;
        border-radius: 24px;
        padding: 22px 22px 20px;
      }
      .section-kicker {
        color: ${doc.accent};
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      h2 {
        margin: 10px 0 10px;
        font-size: 21px;
        line-height: 1.25;
        color: #10243f;
      }
      p {
        margin: 0 0 12px;
        font-size: 14px;
        line-height: 1.65;
        color: #334155;
      }
      .bullet-list {
        margin: 10px 0 0 0;
        padding-left: 20px;
        color: #243b53;
      }
      .bullet-list li {
        margin: 0 0 10px;
        line-height: 1.52;
        font-size: 14px;
      }
      .callout {
        margin-top: 14px;
        padding: 14px 16px;
        border-radius: 18px;
        background: ${doc.calloutBg};
        border-left: 5px solid ${doc.accent};
      }
      .callout-label {
        color: ${doc.accent};
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .callout-text {
        color: #27435f;
        font-size: 14px;
        line-height: 1.55;
      }
      .infographic-shell {
        background: #ffffff;
        border: 1px solid #dbe4f0;
        border-radius: 28px;
        padding: 18px;
      }
      .infographic-shell svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .legend-card {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 14px;
      }
      .legend-card h3 {
        margin: 0 0 8px;
        font-size: 15px;
        color: #10243f;
      }
      .legend-card p {
        margin: 0;
        font-size: 13px;
      }
      .closing-card {
        padding-top: 24px;
      }
      .closing-card h2 {
        margin-top: 0;
      }
      .footer-note {
        margin-top: auto;
        font-size: 11px;
        color: #64748b;
        text-align: right;
      }
    </style>
  </head>
  <body>
    <main>
      <section class="page">
        <div class="hero">
          <div class="eyebrow">Rising Senior</div>
          <h1>${escapeHtml(doc.title)}</h1>
          <p class="subtitle">${escapeHtml(doc.subtitle)}</p>
          <div class="meta-row">
            <div class="meta-chip">Generated ${escapeHtml(generatedDate)}</div>
            <div class="meta-chip">${escapeHtml(doc.audience)}</div>
            <div class="meta-chip">${escapeHtml(doc.purpose)}</div>
          </div>
        </div>
        <div class="cover-layout">
          <section class="content-card">
            <div class="section-kicker">What this brief covers</div>
            <h2>${escapeHtml(doc.coverHeading)}</h2>
            ${paragraphBlock(doc.coverParagraphs)}
          </section>
          <section class="content-card">
            <div class="section-kicker">At a glance</div>
            <h2>${escapeHtml(doc.coverHighlightsHeading)}</h2>
            <div class="highlight-grid">${coverHighlights}</div>
          </section>
        </div>
        <div class="content-grid">
          ${sectionHtml}
        </div>
        <div class="footer-note">Prepared from the current Rising Senior product flows, help content, navigation, and role-aware dashboards.</div>
      </section>

      <section class="page">
        <div class="infographic-shell">
          ${svgMarkup.replace(/^<\?xml[^>]*>\s*/u, "")}
        </div>
        <div class="legend-card">
          <div>
            <h3>${escapeHtml(doc.infographicLegend.leftHeading)}</h3>
            <p>${escapeHtml(doc.infographicLegend.leftText)}</p>
          </div>
          <div>
            <h3>${escapeHtml(doc.infographicLegend.rightHeading)}</h3>
            <p>${escapeHtml(doc.infographicLegend.rightText)}</p>
          </div>
        </div>
        <section class="closing-card">
          <div class="section-kicker">Closing thought</div>
          <h2>${escapeHtml(doc.closingHeading)}</h2>
          ${paragraphBlock(doc.closingParagraphs)}
        </section>
      </section>
    </main>
  </body>
</html>`;
}

function buildLandingPageHtml(doc, svgMarkup) {
  const featureCards = doc.sections
    .slice(0, 4)
    .map((section) => {
      const bullets = (section.bullets || []).slice(0, 3);
      const previewParagraph = section.paragraphs?.[0];
      return `
        <article class="feature-card">
          <div class="feature-kicker">${escapeHtml(section.kicker)}</div>
          <h3>${escapeHtml(section.heading)}</h3>
          ${previewParagraph ? `<p>${escapeHtml(previewParagraph)}</p>` : ""}
          ${
            bullets.length
              ? `<ul>${bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
              : ""
          }
        </article>
      `;
    })
    .join("");

  const valuePoints = doc.sections[doc.sections.length - 1]?.bullets || doc.coverHighlights.slice(0, 5);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(doc.title)}</title>
    <style>
      :root {
        --hero-from: ${doc.heroFrom};
        --hero-to: ${doc.heroTo};
        --accent: ${doc.accent};
        --callout: ${doc.calloutBg};
        --ink: #10243f;
        --body: #334155;
        --line: #dbe4f0;
        --panel: #ffffff;
        --bg: #f4f7fb;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: "Avenir Next", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
        background: radial-gradient(circle at top left, #ffffff 0%, var(--bg) 50%, #eef3f9 100%);
        color: var(--ink);
      }
      .shell {
        width: min(1180px, calc(100vw - 40px));
        margin: 0 auto;
      }
      .hero {
        padding: 72px 0 28px;
      }
      .hero-panel {
        background: linear-gradient(135deg, var(--hero-from), var(--hero-to));
        color: #fff;
        border-radius: 32px;
        padding: 42px;
        box-shadow: 0 24px 60px rgba(15, 23, 42, 0.18);
      }
      .eyebrow {
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.18em;
        text-transform: uppercase;
        opacity: 0.92;
      }
      h1 {
        margin: 14px 0 10px;
        font-size: clamp(2.2rem, 4vw, 3.6rem);
        line-height: 1.05;
      }
      .subtitle {
        margin: 0;
        max-width: 850px;
        font-size: 1.05rem;
        line-height: 1.7;
        color: rgba(255,255,255,0.94);
      }
      .meta {
        margin-top: 22px;
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
      }
      .chip {
        display: inline-flex;
        align-items: center;
        padding: 9px 13px;
        border-radius: 999px;
        background: rgba(255,255,255,0.16);
        font-size: 0.82rem;
        font-weight: 700;
      }
      .intro-grid {
        margin-top: 24px;
        display: grid;
        grid-template-columns: 1.2fr 0.8fr;
        gap: 18px;
      }
      .panel {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 26px;
        padding: 26px;
      }
      .panel h2,
      .section h2 {
        margin: 10px 0 10px;
        font-size: 1.6rem;
        line-height: 1.2;
      }
      .kicker {
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      p {
        color: var(--body);
        line-height: 1.7;
      }
      .highlight-list {
        display: grid;
        gap: 10px;
      }
      .highlight-item {
        min-height: 58px;
        padding: 14px 16px;
        border-radius: 18px;
        background: #f8fbff;
        border: 1px solid var(--line);
        display: flex;
        align-items: center;
        font-weight: 700;
        color: #163254;
      }
      .section {
        padding: 26px 0;
      }
      .feature-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
      }
      .feature-card {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 24px;
        padding: 24px;
      }
      .feature-kicker {
        color: var(--accent);
        font-size: 12px;
        font-weight: 800;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .feature-card h3 {
        margin: 10px 0;
        font-size: 1.25rem;
        line-height: 1.25;
      }
      .feature-card ul,
      .value-list {
        margin: 12px 0 0;
        padding-left: 20px;
        color: var(--body);
      }
      .feature-card li,
      .value-list li {
        margin: 0 0 8px;
        line-height: 1.6;
      }
      .infographic {
        background: var(--panel);
        border: 1px solid var(--line);
        border-radius: 30px;
        padding: 18px;
      }
      .infographic svg {
        width: 100%;
        height: auto;
        display: block;
      }
      .value-panel {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 18px;
      }
      .callout {
        background: var(--callout);
        border-left: 5px solid var(--accent);
        border-radius: 22px;
        padding: 22px;
      }
      .callout strong {
        display: block;
        margin-bottom: 8px;
        color: var(--accent);
        font-size: 0.85rem;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      footer {
        padding: 10px 0 56px;
        color: #64748b;
        font-size: 0.92rem;
      }
      @media (max-width: 900px) {
        .shell {
          width: min(100vw - 24px, 1180px);
        }
        .hero-panel {
          padding: 28px;
        }
        .intro-grid,
        .feature-grid,
        .value-panel {
          grid-template-columns: 1fr;
        }
      }
    </style>
  </head>
  <body>
    <main class="shell">
      <section class="hero">
        <div class="hero-panel">
          <div class="eyebrow">Rising Senior</div>
          <h1>${escapeHtml(doc.title)}</h1>
          <p class="subtitle">${escapeHtml(doc.subtitle)}</p>
          <div class="meta">
            <div class="chip">Generated ${escapeHtml(generatedDate)}</div>
            <div class="chip">${escapeHtml(doc.audience)}</div>
            <div class="chip">${escapeHtml(doc.purpose)}</div>
          </div>
        </div>
        <div class="intro-grid">
          <section class="panel">
            <div class="kicker">Overview</div>
            <h2>${escapeHtml(doc.coverHeading)}</h2>
            ${paragraphBlock(doc.coverParagraphs)}
          </section>
          <section class="panel">
            <div class="kicker">At a glance</div>
            <h2>${escapeHtml(doc.coverHighlightsHeading)}</h2>
            <div class="highlight-list">
              ${doc.coverHighlights.map((item) => `<div class="highlight-item">${escapeHtml(item)}</div>`).join("")}
            </div>
          </section>
        </div>
      </section>

      <section class="section">
        <div class="kicker">Key sections</div>
        <h2>What the live product already supports</h2>
        <div class="feature-grid">
          ${featureCards}
        </div>
      </section>

      <section class="section">
        <div class="kicker">Infographic</div>
        <h2>${escapeHtml(doc.infographic.title)}</h2>
        <div class="infographic">
          ${svgMarkup.replace(/^<\?xml[^>]*>\s*/u, "")}
        </div>
      </section>

      <section class="section">
        <div class="value-panel">
          <section class="panel">
            <div class="kicker">Why it matters</div>
            <h2>${escapeHtml(doc.closingHeading)}</h2>
            ${paragraphBlock(doc.closingParagraphs)}
          </section>
          <section class="callout">
            <strong>Expected value</strong>
            <ul class="value-list">
              ${valuePoints.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}
            </ul>
          </section>
        </div>
      </section>
      <footer>Generated from the current Rising Senior codebase, dashboards, help content, navigation, and role-aware flows.</footer>
    </main>
  </body>
</html>`;
}

const docs = [
  {
    title: "Rising Senior System Overview",
    subtitle: "A structured college-to-career workspace that helps students, families, and coaches move from scattered concern to clearer action.",
    audience: "General stakeholder overview",
    purpose: "Whole-system summary",
    pdfFile: "Rising Senior System Overview.pdf",
    infographicFile: "Rising Senior System Overview Infographic.svg",
    landingFile: "Rising Senior System Overview.html",
    heroFrom: "#0f3d66",
    heroTo: "#198f8c",
    accent: "#0f766e",
    calloutBg: "#ecfeff",
    coverHeading: "Rising Senior is designed for the period when academic progress, employability, timing, family communication, and job targeting all begin to collide.",
    coverParagraphs: [
      "In the current product, students, parents, coaches, and administrators work inside role-aware spaces tied to the same underlying student record. The platform combines profile context, academic evidence, curriculum review, Career Goal analysis, communication tools, and dashboard guidance without pretending weak evidence is final truth.",
      "The result is a more coordinated place to understand what is known, what still needs verification, and what the next practical move should be before graduation pressure turns into avoidable confusion.",
    ],
    coverHighlightsHeading: "Core product threads",
    coverHighlights: [
      "Student profile, academic path, and optional guidance preferences",
      "Academic evidence plus curriculum and degree requirement verification",
      "Career Goal scenarios with saved comparisons and re-runs",
      "Transparent readiness scoring with evidence-quality context",
      "Parent, student, and coach communication support",
      "Role-aware dashboards, alerts, and next-step visibility",
    ],
    sections: [
      {
        kicker: "Problem definition",
        heading: "Why families and students lose momentum",
        paragraphs: [
          "Senior-year planning often breaks apart across too many disconnected tools and conversations. A student may have a major, a transcript, a resume, a few job ideas, and a growing sense of urgency, but still no unified picture of employability.",
          "Parents can feel concern without having visibility. Coaches may see parts of the picture but not the full academic or family context. That fragmentation creates stress, poor timing, repeated misunderstandings, and missed chances to close gaps while there is still time.",
        ],
        bullets: [
          "Students often approach senior year without a clear employment-readiness plan.",
          "Career evidence is scattered across school records, files, projects, and informal updates.",
          "Academic requirements, job targets, communication patterns, and next actions are rarely held together in one place.",
        ],
      },
      {
        kicker: "How the system works",
        heading: "One workspace that connects evidence, goals, and action",
        paragraphs: [
          "Rising Senior uses a household and role-aware model: parents create households, students and coaches join through invitation or approved access, and each workspace exposes only the features a role is allowed to use.",
          "Inside that structure, the system connects student profile data, institution and program selection, academic evidence, degree requirement review, Career Goal scenarios, scoring, recommendations, communication context, and dashboard alerts.",
        ],
        callout: {
          label: "What makes this credible",
          text: "The platform distinguishes direct evidence, inferred material, fallback data, and unresolved gaps so weak information does not quietly look stronger than it is.",
        },
      },
      {
        kicker: "Academic layer",
        heading: "Academic path and curriculum review are part of readiness",
        paragraphs: [
          "The academic path flow anchors school, catalog, program, major, minor, and concentration context. Academic evidence cards then show whether offerings were discovered cleanly, whether degree requirements were found, and whether curriculum has been visually verified.",
          "When school websites are incomplete, the system supports manual recovery and program PDF upload. That means readiness guidance can stay tied to real degree progress instead of generic assumptions.",
        ],
      },
      {
        kicker: "Career layer",
        heading: "Career Goal turns broad planning into target-specific analysis",
        paragraphs: [
          "Career Goal lets a user save named job-target scenarios, paste a real job description, compare multiple paths, set one scenario active, and re-run analysis after evidence changes.",
          "That job-specific frame feeds the dashboards with more targeted strengths, likely gaps, missing evidence, and action ideas without overwriting the student’s baseline record.",
        ],
      },
      {
        kicker: "Communication layer",
        heading: "Communication support is built in, not bolted on",
        paragraphs: [
          "The Communication workspace collects parent insight, student preferences, translation history, inferred communication patterns, and role-aware summaries. Parents can soften a concern before sending it. Students can say what tone, reminder style, or topics tend to help or backfire. Coaches can review authorized summaries when support needs to stay calm and useful.",
        ],
        bullets: [
          "Prompt-based context collection can happen gradually over time.",
          "Saved answers can be edited or deleted when circumstances change.",
          "Visibility controls and consent boundaries shape what another person may see directly.",
        ],
      },
      {
        kicker: "Intended outcomes",
        heading: "What better coordination is meant to produce",
        bullets: [
          "A clearer readiness picture before graduation deadlines compress.",
          "Earlier identification of missing evidence, unverified curriculum, and role-specific gaps.",
          "More actionable next steps instead of vague pressure.",
          "Better parent-student alignment and lower-friction communication.",
          "Stronger confidence about progress toward satisfying employment and independent adult life.",
        ],
      },
    ],
    infographic: {
      title: "From scattered concern to coordinated launch plan",
      subtitle: "How Rising Senior connects evidence, interpretation, guided action, and better outcomes.",
      heroFrom: "#0f3d66",
      heroTo: "#198f8c",
      headerColors: ["#275d8c", "#0f766e", "#d97706", "#0f4c81"],
      columns: [
        {
          heading: "Inputs",
          tagline: "What the platform gathers",
          items: [
            "Student information",
            "Academic evidence",
            "Curriculum requirements",
            "Job descriptions",
            "Parent insight",
            "Coach notes",
          ],
        },
        {
          heading: "System Intelligence",
          tagline: "What the workspace interprets",
          items: [
            "Profile context",
            "Readiness analysis",
            "Scenario comparison",
            "Communication translation",
            "Alerts",
          ],
        },
        {
          heading: "Guided Actions",
          tagline: "What users can do next",
          items: [
            "Recommendations",
            "Dashboard next steps",
            "Communication support",
            "Curriculum verification",
            "Career Goal updates",
          ],
        },
        {
          heading: "Outcomes",
          tagline: "What improves over time",
          items: [
            "Better visibility",
            "Better decisions",
            "Less friction",
            "Improved employability",
            "Stronger launch readiness",
          ],
        },
      ],
      footerHeading: "Platform promise",
      footerText: "Move the student, family, and coach from scattered concern toward a more factual, role-aware launch plan.",
    },
    infographicLegend: {
      leftHeading: "Why this matters",
      leftText: "The audited product flows show a system built to combine school context, job targeting, evidence quality, and family communication instead of treating them as separate problems.",
      rightHeading: "How to read it",
      rightText: "Inputs become more useful when they are verified, translated into context, and turned into a smaller set of practical next moves.",
    },
    closingHeading: "Rising Senior is strongest when it reduces uncertainty without pretending uncertainty is gone.",
    closingParagraphs: [
      "The platform does not replace student ownership, parent care, or coach judgment. It gives those relationships a steadier, more evidence-aware place to work.",
      "That is what makes the system valuable for students preparing to launch, families trying to help well, and early partners looking for a credible readiness workflow.",
    ],
  },
  {
    title: "Rising Senior Parent Overview",
    subtitle: "How the parent workspace helps concern become calmer, more constructive support.",
    audience: "Parent and family audience",
    purpose: "Parent point of view",
    pdfFile: "Rising Senior Parent Overview.pdf",
    infographicFile: "Rising Senior Parent Overview Infographic.svg",
    landingFile: "Rising Senior Parent Overview.html",
    heroFrom: "#18534e",
    heroTo: "#4d8f6d",
    accent: "#166534",
    calloutBg: "#f0fdf4",
    coverHeading: "This parent view is built for families who care deeply, want a clearer factual picture, and do not want every conversation to turn into pressure.",
    coverParagraphs: [
      "In the current product, parents can see a family-facing dashboard, generate a monthly update, review academic evidence and curriculum status, explore Career Goal context, and use communication tools that help concern land more constructively.",
      "The goal is not surveillance. The goal is to replace guessing, repeated arguments, and vague worry with a more grounded view of what the student is building and what kind of support is actually useful.",
    ],
    coverHighlightsHeading: "What parents can rely on",
    coverHighlights: [
      "A parent dashboard with current status, top concern, and next best action",
      "Academic evidence and degree requirement review tied to the student record",
      "Career Goal comparisons that show whether a target role looks realistic yet",
      "Alerts when information is missing, unverified, or still weak",
      "Communication context, prompts, and translation support",
      "Saved monthly parent updates for a stable snapshot over time",
    ],
    sections: [
      {
        kicker: "Parent reality",
        heading: "Why this problem feels personal",
        paragraphs: [
          "Parents are often emotionally and financially invested long before the student feels fully ready to plan. It is common to sense risk early while still lacking a shared factual picture of readiness.",
          "That gap can turn care into repetition. Questions about majors, internships, job timing, and follow-through can start to sound controlling even when the underlying goal is support.",
        ],
        bullets: [
          "Parents may worry without knowing whether the student is truly on track.",
          "Students may resist advice, especially when the same concern keeps resurfacing.",
          "Families often lack a shared way to connect academic choices, employability, and timing.",
        ],
      },
      {
        kicker: "Key friction",
        heading: "What makes support hard",
        bullets: [
          "Limited visibility into academic and career readiness.",
          "Uncertainty about whether degree requirements support current job goals.",
          "Difficulty knowing what to ask without sounding controlling.",
          "A weak link between major, skills, experience, and actual jobs.",
          "Communication breakdowns when concern turns into pressure.",
          "Low confidence that progress is being tracked concretely.",
        ],
        callout: {
          label: "Common pattern",
          text: "Parents often see risk earlier than the student does, but without a factual shared view, the conversation can spiral before the problem is even named clearly.",
        },
      },
      {
        kicker: "System response",
        heading: "How the parent workspace addresses those pain points",
        paragraphs: [
          "The parent dashboard translates the broader student picture into calmer, family-facing context. It highlights the current goal, the overall status, the top concern, and the next best action. From there, parents can review academic evidence, curriculum verification, Career Goal context, communication progress, and coach-visible updates that are explicitly marked for parent visibility.",
        ],
        bullets: [
          "Structured data collection reduces guesswork.",
          "Dashboard visibility keeps current status and next moves in one place.",
          "Curriculum verification distinguishes verified requirements from provisional ones.",
          "Career Goal compares the student record against a saved role or pasted job description.",
          "Alerts surface missing or unverified information before it quietly distorts the picture.",
        ],
      },
      {
        kicker: "Communication support",
        heading: "Support the student without taking over",
        paragraphs: [
          "Parents can add insight about worries, friction patterns, and what has or has not worked before. The translator can then rewrite a concern into student-facing language that is calmer, shorter, and more likely to be heard.",
          "Those tools are paired with consent and visibility rules. The system is designed to support respectful communication, not hide where a message came from or override the student’s boundaries.",
        ],
      },
      {
        kicker: "What parents gain",
        heading: "The practical benefits of a better shared picture",
        bullets: [
          "Less guessing and fewer repetitive arguments.",
          "A better basis for timely intervention before deadlines close in.",
          "More trust because effort and evidence are easier to see.",
          "A clearer path from college progress to employment readiness.",
          "More confidence that support is helping rather than escalating conflict.",
        ],
      },
      {
        kicker: "Longer-term value",
        heading: "Why saved scenarios and monthly snapshots matter",
        paragraphs: [
          "Parent support usually gets stronger when it can compare today’s picture with earlier ones. That is why the product includes saved Career Goals, re-runs after new evidence, and monthly parent updates that hold a stable snapshot of one reporting period.",
          "Instead of relitigating the whole picture every time, a family can keep moving from one documented step to the next.",
        ],
      },
    ],
    infographic: {
      title: "Parent concern becomes constructive support",
      subtitle: "A family-facing flow from uncertainty toward steadier, more useful involvement.",
      heroFrom: "#18534e",
      heroTo: "#4d8f6d",
      headerColors: ["#1f6b61", "#2f855a", "#ca8a04", "#2563eb"],
      columns: [
        {
          heading: "Concern",
          tagline: "What parents often feel first",
          items: [
            "Uncertainty",
            "Worry",
            "Communication friction",
          ],
        },
        {
          heading: "Visibility",
          tagline: "What the system clarifies",
          items: [
            "Readiness dashboard",
            "Academic evidence",
            "Career Goal",
            "Alerts",
          ],
        },
        {
          heading: "Shared Plan",
          tagline: "What support can become",
          items: [
            "Recommendations",
            "Communication support",
            "Tracked actions",
            "Verified requirements",
          ],
        },
        {
          heading: "Better Launch",
          tagline: "What families want next",
          items: [
            "Student ownership",
            "Parent confidence",
            "Stronger employability path",
            "Better relationship",
          ],
        },
      ],
      footerHeading: "Parent value story",
      footerText: "The strongest support is informed, timely, and calm enough that the student can still stay in the driver’s seat.",
    },
    infographicLegend: {
      leftHeading: "What is different here",
      leftText: "This product gives parents a structured, family-safe view of readiness without requiring them to reconstruct the student story from scattered evidence and emotional guesswork.",
      rightHeading: "What it is not",
      rightText: "It is not a surveillance dashboard. The live product uses visibility rules, consent boundaries, and role-aware views to keep support constructive.",
    },
    closingHeading: "Parents do not need perfect certainty. They need a better shared basis for support.",
    closingParagraphs: [
      "Rising Senior helps turn concern into clearer visibility, smaller next moves, and more respectful conversations.",
      "That can make it easier to help a student move toward employability without taking over the process that still needs to become the student’s own.",
    ],
  },
  {
    title: "Rising Senior Student Overview",
    subtitle: "A respectful guide to how the student workspace turns pressure into a clearer, more usable plan.",
    audience: "Student audience",
    purpose: "Student point of view",
    pdfFile: "Rising Senior Student Overview.pdf",
    infographicFile: "Rising Senior Student Overview Infographic.svg",
    landingFile: "Rising Senior Student Overview.html",
    heroFrom: "#7c3f00",
    heroTo: "#d17a00",
    accent: "#b45309",
    calloutBg: "#fff7ed",
    coverHeading: "This workspace is designed for students who want more clarity, more control, and less noise while they figure out how school progress connects to real employment goals.",
    coverParagraphs: [
      "Senior year can feel like a lot at once: classes, money, future pressure, job uncertainty, and family expectations. The current product is built to help students see where they stand without treating them like a passive subject of someone else’s plan.",
      "It connects school context, degree requirements, Career Goal scenarios, evidence on file, and practical next steps so progress is easier to understand and easier to show.",
    ],
    coverHighlightsHeading: "What students can do here",
    coverHighlights: [
      "Set the academic path, school context, and guidance preferences",
      "Track readiness, evidence, and next moves from the student dashboard",
      "Review academic evidence and degree requirement status",
      "Paste a real job description into Career Goal and compare paths",
      "Use communication preferences and translation helpers",
      "Build a more factual story of progress before graduation",
    ],
    sections: [
      {
        kicker: "Starting point",
        heading: "Acknowledge the pressure, then turn it into a plan",
        paragraphs: [
          "Senior year often comes with pressure from school, parents, money, job uncertainty, and the future in general. It can be hard to tell what matters most, especially when every choice starts to feel connected to graduation and independence.",
          "You may want more room to make your own decisions while still needing useful support. Career planning can feel vague, and conversations with parents can get frustrating fast. What if there were a way to turn all of that pressure into a clearer plan?",
        ],
      },
      {
        kicker: "What the workspace does",
        heading: "See where you stand without losing ownership",
        paragraphs: [
          "The student workspace is built to show your current picture, what evidence is already on file, what still needs to be verified, and what the next best move is likely to be.",
          "It connects school progress, degree requirements, interests, skills, job descriptions, and recommendations in one place so you do not have to keep rebuilding the same story from scratch.",
        ],
        callout: {
          label: "Important tone",
          text: "The goal is to support independence, not replace it. The strongest version of this tool helps you understand and show progress with evidence.",
        },
      },
      {
        kicker: "Features that matter",
        heading: "What students are most likely to use",
        bullets: [
          "Academic path setup for school, catalog, program, major, and degree context.",
          "Readiness dashboard sections for strategy, evidence, career readiness, and outcomes.",
          "Academic evidence and curriculum review so school progress is grounded in real requirements.",
          "Career Goal for saved scenarios, pasted job descriptions, strengths, gaps, and missing evidence.",
          "Recommendations and next steps that are easier to act on than a vague score alone.",
          "Communication preferences that help adults understand what tone and reminder style actually work.",
        ],
      },
      {
        kicker: "Career Goal",
        heading: "Try real job targets, not just broad ideas",
        paragraphs: [
          "Career Goal lets you save named targets, paste a real job description, compare different directions, and keep one goal active without losing your baseline record.",
          "That means you can ask a more useful question than “Am I doing okay?” You can ask, “How do I line up with this specific direction, and what do I need next?”",
        ],
      },
      {
        kicker: "Communication support",
        heading: "Make support feel less annoying and more useful",
        paragraphs: [
          "The Communication workspace gives you a way to explain what kinds of reminders help, what makes you shut down, and what adults misunderstand. It also includes tools that can help translate a message between student and parent in a lower-friction way.",
          "That can make family conversations easier to handle, especially when you want support but do not want every concern to arrive as pressure.",
        ],
      },
      {
        kicker: "Expected benefits",
        heading: "What students get out of it",
        bullets: [
          "Less confusion about what matters now.",
          "Clearer priorities and stronger job-readiness planning.",
          "An easier way to explain progress with evidence.",
          "Less stressful parent conversations.",
          "More control, more confidence, and better preparation for graduation and adult life.",
        ],
      },
    ],
    infographic: {
      title: "From pressure to plan",
      subtitle: "How the student workspace helps turn uncertainty into a clearer launch path.",
      heroFrom: "#7c3f00",
      heroTo: "#d17a00",
      headerColors: ["#b45309", "#0f766e", "#2563eb", "#7c3aed"],
      columns: [
        {
          heading: "Pressure",
          tagline: "What can feel heavy",
          items: [
            "School",
            "Parents",
            "Money",
            "Job search",
            "Future uncertainty",
          ],
        },
        {
          heading: "Clarity",
          tagline: "What the workspace shows",
          items: [
            "Dashboard",
            "Scenario analysis",
            "Curriculum review",
            "Strengths and gaps",
          ],
        },
        {
          heading: "Action",
          tagline: "What you can do next",
          items: [
            "Next steps",
            "Skills focus",
            "Evidence building",
            "Communication tools",
          ],
        },
        {
          heading: "Launch",
          tagline: "What improves",
          items: [
            "Job readiness",
            "Independence",
            "Confidence",
            "Better conversations",
          ],
        },
      ],
      footerHeading: "Student value story",
      footerText: "The workspace is most useful when it helps you see progress, close gaps earlier, and keep the future from feeling so vague.",
    },
    infographicLegend: {
      leftHeading: "What students should notice",
      leftText: "The real product keeps connecting the same underlying story: academic context, evidence, job targets, communication patterns, and next actions.",
      rightHeading: "Why that helps",
      rightText: "When those pieces stay connected, it becomes easier to decide what matters now and easier to show progress without overselling it.",
    },
    closingHeading: "A clearer plan can lower pressure without lowering ambition.",
    closingParagraphs: [
      "Rising Senior is designed to help students move from vague stress toward more grounded next steps, better evidence, and better conversations.",
      "That combination can make graduation feel less like a cliff and more like a launch you can prepare for on purpose.",
    ],
  },
];

async function ensureDownloadsDir() {
  await fs.mkdir(downloadsDir, { recursive: true });
}

async function writeReadme() {
  const readmePath = path.join(downloadsDir, "README.md");
  const body = `# Rising Senior Downloads

Generated user-facing documents and infographics based on the current product codebase.

- \`Rising Senior System Overview.pdf\`
- \`Rising Senior System Overview.html\`
- \`Rising Senior System Overview Infographic.svg\`
- \`Rising Senior Parent Overview.pdf\`
- \`Rising Senior Parent Overview.html\`
- \`Rising Senior Parent Overview Infographic.svg\`
- \`Rising Senior Student Overview.pdf\`
- \`Rising Senior Student Overview.html\`
- \`Rising Senior Student Overview Infographic.svg\`

Generated on ${generatedDate}.
`;
  await fs.writeFile(readmePath, body, "utf8");
}

async function renderAll() {
  await ensureDownloadsDir();
  await writeReadme();

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 1800 },
    deviceScaleFactor: 1,
  });

  for (const doc of docs) {
    const svg = buildInfographicSvg(doc.infographic);
    const svgPath = path.join(downloadsDir, doc.infographicFile);
    const pdfPath = path.join(downloadsDir, doc.pdfFile);
    const landingPath = path.join(downloadsDir, doc.landingFile);
    const html = buildDocumentHtml(doc, svg);
    const landingHtml = buildLandingPageHtml(doc, svg);

    await fs.writeFile(svgPath, svg, "utf8");
    await fs.writeFile(landingPath, landingHtml, "utf8");
    await page.setContent(html, { waitUntil: "load" });
    await page.emulateMedia({ media: "screen" });
    await page.pdf({
      path: pdfPath,
      format: "Letter",
      printBackground: true,
      margin: { top: "0.55in", right: "0.55in", bottom: "0.55in", left: "0.55in" },
    });
  }

  await browser.close();
}

async function verifyOutputs() {
  const checks = [];
  for (const doc of docs) {
    const pdfPath = path.join(downloadsDir, doc.pdfFile);
    const svgPath = path.join(downloadsDir, doc.infographicFile);
    const landingPath = path.join(downloadsDir, doc.landingFile);
    const [pdfStat, svgStat, landingStat] = await Promise.all([
      fs.stat(pdfPath),
      fs.stat(svgPath),
      fs.stat(landingPath),
    ]);
    if (pdfStat.size <= 0) {
      throw new Error(`${doc.pdfFile} is empty.`);
    }
    if (svgStat.size <= 0) {
      throw new Error(`${doc.infographicFile} is empty.`);
    }
    if (landingStat.size <= 0) {
      throw new Error(`${doc.landingFile} is empty.`);
    }
    checks.push({
      pdf: doc.pdfFile,
      pdfBytes: pdfStat.size,
      infographic: doc.infographicFile,
      infographicBytes: svgStat.size,
      landing: doc.landingFile,
      landingBytes: landingStat.size,
    });
  }
  return checks;
}

await renderAll();
const checks = await verifyOutputs();
console.log(`Generated ${checks.length} Rising Senior document sets in ${downloadsDir}`);
for (const check of checks) {
  console.log(`- ${check.pdf} (${check.pdfBytes} bytes)`);
  console.log(`  ${check.infographic} (${check.infographicBytes} bytes)`);
  console.log(`  ${check.landing} (${check.landingBytes} bytes)`);
}
