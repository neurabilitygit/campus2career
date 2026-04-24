import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTcnjProgramKindsFromDetailHtml,
  extractMontclairProgramsFromFinderHtml,
  extractTcnjProgramsFromJsonLdHtml,
  extractTcnjProgramsFromDirectoryHtml,
} from "./catalogInstitutionAdapters";

test("extractTcnjProgramsFromDirectoryHtml keeps program cards and ignores generic site sections", () => {
  const html = `
    <div class="program-card" id="african-american-studies">
      <a class="program-card-gtm program-link" href="./african-american-studies">
        <h2>African American Studies</h2>
        <div class="icon-container">
          <img alt="Major/Specialization" src="/major.svg" />
          <img alt="Minor" src="/minor.svg" />
          <img alt="Teacher Preparation" src="/teacher.svg" />
        </div>
      </a>
    </div>
    <div class="program-card" id="art-history">
      <a class="program-card-gtm program-link" href="https://art.tcnj.edu/academics/minors/art-history-visual-culture-minor/">
        <h2>Art History and Visual Culture</h2>
        <div class="icon-container">
          <img alt="Minor" src="/minor.svg" />
        </div>
      </a>
    </div>
    <div class="section-card">
      <a class="program-card-gtm program-link" href="/a-z">
        <h2>A-Z</h2>
      </a>
    </div>
    <div class="section-card">
      <a class="program-card-gtm program-link" href="/archive">
        <h2>Archive</h2>
      </a>
    </div>
  `;

  const programs = extractTcnjProgramsFromDirectoryHtml("https://programs.tcnj.edu/", html);
  const labels = programs.map((program) => `${program.kind}:${program.displayName}`);

  assert.deepEqual(labels, [
    "major:African American Studies",
    "minor:African American Studies",
    "minor:Art History and Visual Culture",
  ]);
});

test("extractMontclairProgramsFromFinderHtml reads embedded programList and keeps only undergraduate majors/minors", () => {
  const html = `
    <script type='text/javascript'>
      window.programList = {
        "1": {
          "title": "Economics",
          "url": "https://www.montclair.edu/academics/programs/ba-economics/",
          "program_level": [{"name":"Undergraduate"}],
          "program_type": [{"name":"Major"},{"name":"Minor"}],
          "degree_type": [{"name":"BA"}]
        },
        "2": {
          "title": "Artificial Intelligence (AI) Systems (Certificate)",
          "url": "https://www.montclair.edu/academics/programs/artificial-intelligence-certificate/",
          "program_level": [{"name":"Graduate"}],
          "program_type": [{"name":"Certificate"}],
          "degree_type": []
        },
        "3": {
          "title": "Accounting",
          "url": "https://www.montclair.edu/academics/programs/bs-accounting/",
          "program_level": [{"name":"Undergraduate"}],
          "program_type": [{"name":"Major"}],
          "degree_type": [{"name":"BS"}]
        }
      };
    </script>
  `;

  const programs = extractMontclairProgramsFromFinderHtml(
    "https://www.montclair.edu/academics/program-finder/",
    html
  );
  const labels = programs.map((program) => `${program.degreeType}:${program.kind}:${program.displayName}`);

  assert.deepEqual(labels, [
    "BA:major:Economics",
    "BA:minor:Economics",
    "BS:major:Accounting",
  ]);
});

test("extractTcnjProgramsFromJsonLdHtml reads the full JSON-LD inventory list", () => {
  const html = `
    <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "ItemList",
        "itemListElement": [
          { "item": { "name": "Accounting", "url": "https://programs.tcnj.edu/accounting" } },
          { "item": { "name": "Art History and Visual Culture Minor", "url": "https://art.tcnj.edu/academics/minors/art-history-visual-culture-minor/" } }
        ]
      }
    </script>
  `;

  const programs = extractTcnjProgramsFromJsonLdHtml(html);
  assert.deepEqual(programs, [
    { name: "Accounting", url: "https://programs.tcnj.edu/accounting" },
    { name: "Art History and Visual Culture", url: "https://art.tcnj.edu/academics/minors/art-history-visual-culture-minor/" },
  ]);
});

test("classifyTcnjProgramKindsFromDetailHtml distinguishes major, minor, and advisory pages", () => {
  const both = classifyTcnjProgramKindsFromDetailHtml({
    url: "https://programs.tcnj.edu/accounting",
    fallbackName: "Accounting",
    html: `
      <title>Accounting Program | TCNJ</title>
      <meta name="description" content="Accounting is offered as a major and minor." />
    `,
  });
  assert.deepEqual(both, { displayName: "Accounting", kinds: ["minor", "major"] });

  const minorOnly = classifyTcnjProgramKindsFromDetailHtml({
    url: "https://art.tcnj.edu/academics/minors/art-history-visual-culture-minor/",
    fallbackName: "Art History and Visual Culture Minor",
    html: `
      <title>Art History and Visual Culture Minor | Department of Art and Art Education</title>
      <meta name="description" content="The Art History and Visual Culture minor." />
    `,
  });
  assert.deepEqual(minorOnly, { displayName: "Art History and Visual Culture", kinds: ["minor"] });

  const advisory = classifyTcnjProgramKindsFromDetailHtml({
    url: "https://programs.tcnj.edu/prelaw",
    fallbackName: "Prelaw",
    html: `
      <title>Prelaw | TCNJ</title>
      <meta name="description" content="Prelaw options are available to students and can be paired with any major." />
    `,
  });
  assert.deepEqual(advisory, { displayName: "Prelaw", kinds: [] });
});
