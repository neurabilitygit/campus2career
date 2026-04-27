import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTcnjProgramKindsFromDetailHtml,
  classifyUclaDepartmentPageFromNextData,
  dedupeRepeatedProgramLabel,
  extractBrownConcentrationsFromBulletinHtml,
  extractBostonCollegeProgramsFromHtml,
  extractBostonUniversityProgramsFromHtml,
  extractBerkeleyProgramsFromAdmissionsHtml,
  extractBucknellProgramsFromMajorsMinorsHtml,
  extractCaltechProgramsFromCatalogHtml,
  extractCmuProgramsFromFinderHtml,
  extractDartmouthProgramsFromCatalogHtml,
  extractDukeProgramsFromAdmissionsHtml,
  extractEmoryProgramsFromHtml,
  extractGeorgetownProgramsFromDegreePage,
  extractJhuProgramsFromHtml,
  extractMichiganProgramsFromHtml,
  extractMontclairProgramsFromFinderHtml,
  extractMitProgramsFromCourseleafHtml,
  extractNorthwesternProgramsFromAdmissionsHtml,
  extractNortheasternProgramsFromCatalogSchoolHtml,
  extractNotreDameProgramsFromHtml,
  extractPennProgramsFromCatalogHtml,
  extractRiceProgramsFromCatalogHtml,
  extractRochesterProgramsFromHtml,
  extractRutgersProgramsFromUndergraduateHtml,
  extractUncProgramsFromCatalogHtml,
  extractUcdavisProgramsFromCatalogHtml,
  extractUclaDepartmentLinksFromNextData,
  extractUcsdProgramsFromMajorCodesHtml,
  extractUcsdProgramsFromMinorCodesHtml,
  extractUcsdProgramsFromDegreesHtml,
  extractUChicagoProgramsFromCourseleafHtml,
  extractUcsbProgramsFromDepartmentPage,
  extractTuftsProgramsFromAdmissionsHtml,
  extractUtAustinMajorProgramsFromHtml,
  extractUtAustinMinorProgramsFromHtml,
  extractVanderbiltProgramsFromApiPayload,
  extractWashingtonProgramsFromDegreeProgramsHtml,
  extractWashuProgramsFromHtml,
  extractWisconsinProgramsFromHtml,
  extractGeorgiaProgramsFromSearchHtml,
  extractYaleMajorsFromHtml,
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

test("extractNortheasternProgramsFromCatalogSchoolHtml keeps degree pages and filters catalog scaffolding", () => {
  const html = `
    <a href="/undergraduate/business/business-administration-bsba/">Business Administration, BSBA (Boston)</a>
    <a href="/undergraduate/business/business-administration-bsba-oak/">Business Administration, BSBA (Oakland)</a>
    <a href="/undergraduate/business/interdisciplinary-minors/">Minors</a>
    <a href="/undergraduate/business/business-data-analytics-minor/">Business Data Analytics Minor</a>
    <a href="/undergraduate/business/concentrations/">Concentrations</a>
    <a href="/undergraduate/business/accelerated-bachelor-graduate-degree-programs/">Accelerated Bachelor/Graduate Degree Programs</a>
    <a href="/undergraduate/business/">D'Amore-McKim School of Business</a>
  `;

  const programs = extractNortheasternProgramsFromCatalogSchoolHtml(
    "https://catalog.northeastern.edu/undergraduate/business/",
    html
  );

  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    [
      "major:Business Administration, BSBA (Boston)",
      "major:Business Administration, BSBA (Oakland)",
      "minor:Business Data Analytics",
    ]
  );
});

test("dedupeRepeatedProgramLabel collapses duplicated catalog labels", () => {
  assert.equal(
    dedupeRepeatedProgramLabel("African American Studies, BA African American Studies, BA"),
    "African American Studies, BA"
  );
});

test("extractYaleMajorsFromHtml keeps Yale College major entries and strips degree suffixes", () => {
  const html = `
    <a href="/ycps/subjects-of-instruction/anthropology/">Anthropology (B.A.)</a>
    <a href="/ycps/subjects-of-instruction/applied-mathematics/">Applied Mathematics (B.A. or B.S.)</a>
    <a href="/ycps/programs_certificates/">Certificates in Yale College</a>
  `;

  const programs = extractYaleMajorsFromHtml("https://catalog.yale.edu/ycps/majors-in-yale-college/", html);
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:Anthropology", "major:Applied Mathematics"]
  );
});

test("extractWashuProgramsFromHtml reads all-school major and minor pages", () => {
  const majorsHtml = `
    <a href="/undergrad/artsci/majors/anthropology-ba/">Anthropology Major</a>
    <a href="/undergrad/business/majors/accounting-bsba/">Accounting, BSBA</a>
  `;
  const minorsHtml = `
    <a href="/undergrad/artsci/minors/anthropology/">Anthropology Minor</a>
    <a href="/undergrad/business/minors/accounting-nonbsba/">Accounting Minor (Non-BSBA)</a>
  `;

  assert.deepEqual(
    extractWashuProgramsFromHtml("https://bulletin.wustl.edu/undergrad/majors/", majorsHtml, "major").map(
      (program) => `${program.kind}:${program.degreeType}:${program.displayName}`
    ),
    ["major:Undergraduate:Anthropology", "major:BS:Accounting"]
  );
  assert.deepEqual(
    extractWashuProgramsFromHtml("https://bulletin.wustl.edu/undergrad/minors/", minorsHtml, "minor").map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["minor:Anthropology", "minor:Accounting Minor (Non BSBA)"]
  );
});

test("extractJhuProgramsFromHtml keeps undergraduate majors and minors while filtering graduate entries", () => {
  const html = `
    <a href="/arts-sciences/full-time-residential-programs/degree-programs/economics/economics-bachelor-arts/">Economics, Bachelor of Arts</a>
    <a href="/arts-sciences/full-time-residential-programs/degree-programs/economics/economics-minor/">Economics, Minor</a>
    <a href="/arts-sciences/full-time-residential-programs/degree-programs/economics/economics-phd/">Economics, PhD</a>
  `;

  const programs = extractJhuProgramsFromHtml(
    "https://e-catalogue.jhu.edu/arts-sciences/full-time-residential-programs/degree-programs/",
    html
  );
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:Economics", "minor:Economics"]
  );
});

test("extractWisconsinProgramsFromHtml keeps undergraduate degree rows and filters certificates", () => {
  const html = `
    <li id="isotope-item691" class="item filter_33 filter_48">
      <a href="/undergraduate/letters-science/african-american-studies/african-american-studies-ba/">
        <span class="title visual"><h3>African American Studies, BA</h3></span>
        <span class="title list"><h3>African American Studies, BA</h3></span>
      </a>
    </li>
    <li id="isotope-item692" class="item filter_33 filter_48">
      <a href="/undergraduate/letters-science/african-american-studies/african-american-studies-bs/">
        <span class="title visual"><h3>African American Studies, BS</h3></span>
        <span class="title list"><h3>African American Studies, BS</h3></span>
      </a>
    </li>
    <li id="isotope-item693" class="item filter_33 filter_45">
      <a href="/undergraduate/letters-science/african-american-studies/african-american-studies-certificate/">
        <span class="title visual"><h3>African American Studies, Certificate</h3></span>
        <span class="title list"><h3>African American Studies, Certificate</h3></span>
      </a>
    </li>
  `;

  const programs = extractWisconsinProgramsFromHtml("https://guide.wisc.edu/explore-majors/", html);
  assert.deepEqual(
    programs.map((program) => `${program.degreeType}:${program.kind}:${program.displayName}`),
    ["Undergraduate:major:African American Studies"]
  );
});

test("extractBucknellProgramsFromMajorsMinorsHtml keeps real majors and minors while skipping dual-degree and utility entries", () => {
  const html = `
    <div id="m_fullList"></div>
    <li class="c-accordion-item__list-item">
      <h3>
        <button data-targetid="college-of-arts-sciences">
          <span class="label label--upper">Majors in the<span class="u-sr-only">: </span></span>
          <span class="title title--xs">College of Arts &amp; Sciences</span>
        </button>
      </h3>
      <div class="c-accordion-item__panel-wrapper js-accordion-panel">
        <div id="college-of-arts-sciences" class="c-accordion-item__panel c-wysiwyg">
          <ul>
            <li><a href="/academics/college-arts-sciences/academic-departments-programs/animal-behavior-program">Animal Behavior</a></li>
            <li><a href="/academics/college-arts-sciences/academic-departments-programs/east-asian-studies">Chinese</a></li>
            <li><a href="/academics/college-arts-sciences/academic-departments-programs/mathematics-statistics">Applied Mathematic</a><a href="/node/2452">s</a></li>
            <li><a href="https://coursecatalog.bucknell.edu/collegeofartsandsciencescurricula/areasofstudy/interdepartmental/">Interdepartmental</a></li>
          </ul>
          <span aria-hidden="true">&nbsp;</span>
        </div>
      </div>
    </li>
    <li class="c-accordion-item__list-item">
      <h3>
        <button data-targetid="college-of-engineering--2">
          <span class="label label--upper">Five-Year-Dual-Degree Programs<span class="u-sr-only">: </span></span>
          <span class="title title--xs">College of Engineering</span>
        </button>
      </h3>
      <div class="c-accordion-item__panel-wrapper js-accordion-panel">
        <div id="college-of-engineering--2" class="c-accordion-item__panel c-wysiwyg">
          <ul>
            <li><a href="/academics/college-engineering/majors-departments/dual-program-engineering-management">Bachelor of Science in Engineering &amp; Bachelor of Management for Engineers</a></li>
          </ul>
          <span aria-hidden="true">&nbsp;</span>
        </div>
      </div>
    </li>
    <li class="c-accordion-item__list-item">
      <h3>
        <button data-targetid="minors">
          <span class="title title--xs">Minors</span>
        </button>
      </h3>
      <div class="c-accordion-item__panel-wrapper js-accordion-panel">
        <div id="minors" class="c-accordion-item__panel c-wysiwyg">
          <ul>
            <li><a href="/academics/freeman-college-management/majors-departments/accounting-financial-management">Accounting</a></li>
            <li><a href="/academics/college-arts-sciences/academic-departments-programs/art-art-history">Art — Studio</a></li>
            <li><a href="/academics/college-arts-sciences/academic-departments-programs/critical-black-studies">Critical Black Studies&nbsp;(previously Africana Studies)</a></li>
            <li><a href="https://coursecatalog.bucknell.edu/collegeofengineeringcurricula/areasofstudy/militaryscience/">Military Science</a></li>
          </ul>
          <span aria-hidden="true">&nbsp;</span>
        </div>
      </div>
    </li>
  `;

  const programs = extractBucknellProgramsFromMajorsMinorsHtml("https://www.bucknell.edu/academics/majors-minors", html);

  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    [
      "major:Animal Behavior",
      "major:Chinese",
      "major:Applied Mathematics",
      "minor:Accounting",
      "minor:Art — Studio",
      "minor:Critical Black Studies",
    ]
  );
});

test("extractCaltechProgramsFromCatalogHtml keeps undergraduate options and minors while ignoring scaffolding", () => {
  const html = `
    <a href="/current/information-for-undergraduate-students/graduation-requirements-all-options/">Graduation Requirements, All Options</a>
    <a href="/current/information-for-undergraduate-students/graduation-requirements-all-options/applied-and-computational-mathematics-acm/">
      Applied and Computational Mathematics Option (ACM)
    </a>
    <a href="/current/information-for-undergraduate-students/graduation-requirements-all-options/astrophysics-option-and-minor-ay/">
      Astrophysics Option and Minor (Ay)
    </a>
    <a href="/current/information-for-undergraduate-students/graduation-requirements-all-options/aerospace-minor-ae/">
      Aerospace Minor (Ae)
    </a>
  `;

  assert.deepEqual(
    extractCaltechProgramsFromCatalogHtml("https://catalog.caltech.edu/current/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    [
      "major:Applied and Computational Mathematics",
      "major:Astrophysics",
      "minor:Astrophysics",
      "minor:Aerospace",
    ]
  );
});

test("extractMichiganProgramsFromHtml strips major and degree suffixes while skipping sub-majors", () => {
  const html = `
    <tr id="row-1">
      <td class="dept-name"><a href="/lsa/academics/majors-minors.html#anthropology-maj">Anthropology (Major)</a></td>
    </tr>
    <tr id="row-2">
      <td class="dept-name"><a href="/lsa/academics/majors-minors.html#anthropology-min">Anthropology (Minor)</a></td>
    </tr>
    <tr id="row-3">
      <td class="dept-name"><a href="/lsa/academics/majors-minors.html#biochemistry_bs-maj">Biochemistry [B.S.] (Major)</a></td>
    </tr>
    <tr id="row-4">
      <td class="dept-name"><a href="/lsa/academics/majors-minors.html#actuarial_mathematics-sub">Actuarial Mathematics (Sub-Major)</a></td>
    </tr>
  `;

  assert.deepEqual(
    extractMichiganProgramsFromHtml("https://prod.lsa.umich.edu/lsa/academics/majors-minors.html", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:Anthropology", "minor:Anthropology", "major:Biochemistry"]
  );
});

test("extractUncProgramsFromCatalogHtml collapses degree and concentration variants to clean majors and minors", () => {
  const html = `
    <a href="/undergraduate/programs-study/american-studies-major-ba/">American Studies Major, B.A.</a>
    <a href="/undergraduate/programs-study/american-studies-major-baamerican-indian-indigenous-studies-concentration/">
      American Studies Major, B.A.–American Indian and Indigenous Studies Concentration
    </a>
    <a href="/undergraduate/programs-study/biology-major-bs-quantitative-biology-track/">Biology Major, B.S.–Quantitative Biology Track</a>
    <a href="/undergraduate/programs-study/american-studies-minor/">American Studies Minor</a>
  `;

  assert.deepEqual(
    extractUncProgramsFromCatalogHtml("https://catalog.unc.edu/undergraduate/programs-study/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:American Studies", "major:Biology", "minor:American Studies"]
  );
});

test("extractBostonCollegeProgramsFromHtml classifies major and minor links from BC undergraduate pages", () => {
  const html = `
    <a href="https://www.bc.edu/content/bc-web/schools/mcas/departments/communication/undergrad/major-requirements.html">Communication</a>
    <a href="https://www.bc.edu/content/bc-web/schools/morrissey/departments/chemistry/academics/undergraduate/minor.html">Chemistry</a>
    <a href="https://www.bc.edu/content/bc-web/schools/lynch-school/academics/undergraduate/interdisciplinary-majors.html#tab-mathematics_computer_science">Mathematics/Computer Science</a>
  `;

  const programs = extractBostonCollegeProgramsFromHtml(
    "https://www.bc.edu/content/bc-web/academics/undergraduate-programs.html",
    html
  );
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:Communication", "minor:Chemistry", "major:Mathematics/Computer Science"]
  );
});

test("extractNorthwesternProgramsFromAdmissionsHtml reads program rows and option links", () => {
  const html = `
    <table id="majors_minors">
      <tbody>
        <tr>
          <td><div class="program">African Studies</div></td>
          <td>
            <ul class="options">
              <li><a href="https://africanstudies.northwestern.edu/students/undergraduate/major.html">Adjunct Major</a></li>
              <li><a href="https://africanstudies.northwestern.edu/students/undergraduate/minor.html">Minor</a></li>
            </ul>
          </td>
        </tr>
        <tr>
          <td><div class="program">Civic Engagement</div></td>
          <td>
            <ul class="options">
              <li><a href="https://sesp.northwestern.edu/undergraduate/options-concentrations/civic-engagement-certificate/">Certificate</a></li>
            </ul>
          </td>
        </tr>
      </tbody>
    </table>
  `;

  const programs = extractNorthwesternProgramsFromAdmissionsHtml(
    "https://admissions.northwestern.edu/academics/majors-minors/",
    html
  );
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:African Studies", "minor:African Studies"]
  );
});

test("extractGeorgetownProgramsFromDegreePage keeps major and minor section links only", () => {
  const html = `
    <h2 id="majors">1. Majors</h2>
    <ul>
      <li><a href="https://bulletin.georgetown.edu/schools-programs/college/degree-programs/history/#HistoryMajor">History</a></li>
      <li><a href="https://bulletin.georgetown.edu/schools-programs/college/degree-programs/anthropology/#AnthropologyMajor">Anthropology</a></li>
    </ul>
    <h2 id="minors">2. Minors</h2>
    <ul>
      <li><a href="https://bulletin.georgetown.edu/schools-programs/college/degree-programs/history/#HistoryMinor">History</a></li>
      <li><a href="https://bulletin.georgetown.edu/schools-programs/college/degree-programs/film/#FilmMinor">Film and Media Studies</a></li>
    </ul>
    <h2 id="certificates">3. Certificates</h2>
    <ul>
      <li><a href="https://bulletin.georgetown.edu/schools-programs/sfs/majors-and-certificates/certificates/#AfricanStudiesCertificate">African Studies</a></li>
    </ul>
  `;

  const programs = extractGeorgetownProgramsFromDegreePage(
    "https://bulletin.georgetown.edu/schools-programs/college/degree-programs/",
    html
  );
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:History", "major:Anthropology", "minor:History", "minor:Film and Media Studies"]
  );
});

test("extractDukeProgramsFromAdmissionsHtml reads major and minor card lists", () => {
  const html = `
    <h3>Majors</h3>
    <div class="desc body-text-lg"><p>-Biology<br /> -Computer Science<br /> -Global Health**</p></div>
    <h3>Minors</h3>
    <div class="desc body-text-lg"><p>-Economics<br /> -Writing and Rhetoric</p></div>
    <h3>Certificates </h3>
    <div class="desc body-text-lg"><p>-Documentary Studies</p></div>
  `;

  const programs = extractDukeProgramsFromAdmissionsHtml("https://admissions.duke.edu/academic-possibilities/", html);
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:Biology", "major:Computer Science", "major:Global Health", "minor:Economics", "minor:Writing and Rhetoric"]
  );
});

test("extractEmoryProgramsFromHtml reads filtered result cards and respects category tags", () => {
  const html = `
    <ul class="filter-results-list">
      <li class="filter-results-item">
        <div class="filter-results-title">Accounting</div>
        <div class="sr-only">'Major', 'Preprofessional Program'</div>
      </li>
      <li class="filter-results-item">
        <div class="filter-results-title">African American Studies</div>
        <div class="sr-only">'Major', 'Minor'</div>
      </li>
      <li class="filter-results-item">
        <div class="filter-results-title">Pre-Med</div>
        <div class="sr-only">'Preprofessional Program'</div>
      </li>
    </ul>
  `;

  const programs = extractEmoryProgramsFromHtml("https://apply.emory.edu/academics/majors-minors.html", html);
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:Accounting", "major:African American Studies", "minor:African American Studies"]
  );
});

test("extractUcsbProgramsFromDepartmentPage uses degree prose and cautious fallback labels", () => {
  const programs = extractUcsbProgramsFromDepartmentPage(
    "https://catalog.ucsb.edu/departments/ENVST/overview",
    "Environmental Studies",
    `
      <p>The Environmental Studies Program offers three undergraduate degrees.</p>
      <p>The bachelor of arts degree in environmental studies provides a basis in social science, natural science, and humanities courses.</p>
      <p>The bachelor of science degree in environmental studies also emphasizes the importance of an integrative approach.</p>
      <p>The Environmental Studies Program is also home to one of the first academic programs on the West Coast to offer a bachelor of science degree in hydrologic sciences and policy.</p>
      <p>The department also offers a minor in environmental studies.</p>
    `
  );

  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    [
      "major:Environmental Studies",
      "major:Hydrologic Sciences and Policy",
      "minor:Environmental Studies",
    ]
  );

  const fallback = extractUcsbProgramsFromDepartmentPage(
    "https://catalog.ucsb.edu/departments/ENGL/overview",
    "English",
    `
      <p>Students who major in English learn to appreciate the significance of literature.</p>
    `
  );

  assert.deepEqual(fallback.map((program) => `${program.kind}:${program.displayName}`), ["major:English"]);
});

test("extractNotreDameProgramsFromHtml keeps undergraduate entries and filters graduate links", () => {
  const html = `
    <a href="https://africana.nd.edu/majors-and-minors/">Africana Studies</a>
    <a href="https://graduateschool.nd.edu/degree-programs/applied-and-computational-mathematics-and-statistics-ms---masters-professional/">Applied and Computational Mathematics and Statistics: M.S.</a>
    <a href="https://economics.nd.edu/undergraduate/">Economics</a>
    <a href="https://graduateschool.nd.edu/degree-programs/computational-science-and-engineering-minor---current-students-only/">Computational Science and Engineering: Minor</a>
  `;

  const programs = extractNotreDameProgramsFromHtml("https://www.nd.edu/academics/programs/", html);
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:Africana Studies", "major:Economics"]
  );
});

test("extractRochesterProgramsFromHtml splits merged labels and filters obvious UI noise", () => {
  const html = `
    <a href="https://www.sas.rochester.edu/eng/undergraduate/majors/literature.html">English: British and American Literature BA English: Creative Writing</a>
    <a href="https://www.sas.rochester.edu/rel/undergraduate/minors.html">Greek</a>
    <a href="https://www.sas.rochester.edu/ees/major-minor/environmental-geology-minor.html">Environmental Geology minor Environmental Health BS Environmental Science BS</a>
    <a href="https://www.rochester.edu/athletics/">Athletics</a>
  `;

  const programs = extractRochesterProgramsFromHtml("https://www.rochester.edu/academics/programs.html", html);
  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    [
      "major:English: British and American Literature",
      "major:English: Creative Writing",
      "minor:Greek",
      "minor:Environmental Geology",
      "minor:Environmental Health",
      "minor:Environmental Science",
    ]
  );
});

test("extractVanderbiltProgramsFromApiPayload keeps undergraduate entries with clean majors", () => {
  const programs = extractVanderbiltProgramsFromApiPayload([
    {
      program: "African American and Diaspora Studies",
      bachelors: "https://admissions.vanderbilt.edu/academics/fact-sheet/?program=1244",
      schoollist: ["College of Arts and Science"],
    },
    {
      program: "Applied Behavior Analysis",
      schoollist: ["Peabody College of Education and Human Development"],
    },
    {
      program: "Anthropology",
      bachelors: "https://as.vanderbilt.edu/anthropology/undergraduate/aboutmajor.php",
      schoollist: ["College of Arts and Science", "Graduate School"],
    },
  ]);

  assert.deepEqual(
    programs.map((program) => `${program.kind}:${program.displayName}`),
    ["major:African American and Diaspora Studies", "major:Anthropology"]
  );
});

test("extractCmuProgramsFromFinderHtml keeps clean major and minor cards from the undergraduate finder", () => {
  const html = `
    <a class="grid__box program-finder__program" href="/admission/majors-programs/college-of-fine-arts/school-of-architecture#majors-minors-more">
      <h2 class="program-finder__program__title">Architecture</h2>
      <p class="program-finder__program__summary">Students can pursue architecture pathways.</p>
      <div class="program-finder__program__concentrations">
        <span class="icon-concentration icon-concentration--major">Major</span>
        <span class="icon-concentration icon-concentration--minor">Minor</span>
      </div>
    </a>
    <a class="grid__box program-finder__program" href="/admission/majors-programs/college-of-engineering#engineering-only-minors">
      <h2 class="program-finder__program__title">Additive Manufacturing</h2>
      <p class="program-finder__program__summary">Minor only.</p>
      <div class="program-finder__program__concentrations">
        <span class="icon-concentration icon-concentration--minor">Minor</span>
      </div>
    </a>
    <a class="grid__box program-finder__program" href="/admission/majors-programs/school-of-computer-science/artificial-intelligence#artificial-intelligence">
      <h2 class="program-finder__program__title">Artificial Intelligence</h2>
      <p class="program-finder__program__summary">Major and minor.</p>
      <div class="program-finder__program__concentrations">
        <span class="icon-concentration icon-concentration--major">Major</span>
        <span class="icon-concentration icon-concentration--minor">Minor</span>
      </div>
    </a>
  `;

  assert.deepEqual(
    extractCmuProgramsFromFinderHtml("https://www.cmu.edu/admission/majors-programs/undergraduate-program-finder", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    [
      "major:Architecture",
      "minor:Architecture",
      "minor:Additive Manufacturing",
      "major:Artificial Intelligence",
      "minor:Artificial Intelligence",
    ]
  );
});

test("extractBostonUniversityProgramsFromHtml keeps undergraduate majors and minors while dropping graduate-only entries", () => {
  const html = `
    <li class="mj">Acting (<a href="/academics/cfa/programs/school-of-theatre/acting/">BFA</a>)</li>
    <li class="ma ol">Advanced Information Technology (<a href="/academics/met/programs/computer-science/graduate-certificates/">GRAD Cert</a>)</li>
    <li class="ma mi mj">Advertising <strong>COM</strong> (<a href="/academics/com/programs/advertising/advertising-bs/">BS</a>, <a href="/academics/com/programs/advertising/advertising-minor/">minor</a>, <a href="/academics/com/programs/advertising/advertising-ms/">MS</a>)</li>
    <li class="mj mi">African American &#038; Black Diaspora Studies <strong>CAS</strong> (<a href="/academics/cas/programs/african-american-black-diaspora-studies/ba/">BA</a>, <a href="/academics/cas/programs/african-american-black-diaspora-studies/minor/">minor</a>)</li>
  `;

  assert.deepEqual(
    extractBostonUniversityProgramsFromHtml("https://www.bu.edu/academics/degree-programs/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    [
      "major:Acting",
      "major:Advertising",
      "minor:Advertising",
      "major:African American & Black Diaspora Studies",
      "minor:African American & Black Diaspora Studies",
    ]
  );
});

test("extractTuftsProgramsFromAdmissionsHtml keeps only real program cards and derives major/minor availability", () => {
  const html = `
    <div class="js-program program_finder_box arts_sciences major arts_sciences_major interdisciplinary-programs social-sciences">
      <a href="#" class="js-swap js-lightbox-link" data-url="https://admissions.tufts.edu/ajax/majors-minors/details/1">
        <div class="program_finder_content clearfix">
          <h3 class="program_finder_heading">American Studies</h3>
          <div class="program_finder_content_wrap">
            <p class="program_finder_subheading">School of Arts &amp; Sciences</p>
            <p class="program_finder_label">Major</p>
          </div>
        </div>
      </a>
    </div>
    <div class="js-program program_finder_box arts_sciences major arts_sciences_major arts_sciences minor arts_sciences_minor">
      <a href="#" class="js-swap js-lightbox-link" data-url="https://admissions.tufts.edu/ajax/majors-minors/details/98">
        <div class="program_finder_content clearfix">
          <h3 class="program_finder_heading">Africana Studies</h3>
          <div class="program_finder_content_wrap">
            <p class="program_finder_subheading">School of Arts &amp; Sciences</p>
            <p class="program_finder_label">Major &amp; Minor</p>
          </div>
        </div>
      </a>
    </div>
  `;

  assert.deepEqual(
    extractTuftsProgramsFromAdmissionsHtml("https://admissions.tufts.edu/discover-tufts/academics/majors-and-minors/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    [
      "major:American Studies",
      "major:Africana Studies",
      "minor:Africana Studies",
    ]
  );
});

test("extractRutgersProgramsFromUndergraduateHtml keeps accordion program names and ignores filter chrome", () => {
  const html = `
    <ul class="accordion-list">
      <li class="views-row accordion-list-item">
        <div class="program">
          <button type="button" class="accordion-trigger">
            <h3>Accounting</h3>
          </button>
          <div id="section-8653" class="accordion-panel" role="region">
            <table class="program-data">
              <tbody>
                <tr class="program_implementation">
                  <td>Rutgers-Camden</td>
                  <td>School of Business - Camden</td>
                  <td><a href="https://business.camden.rutgers.edu/undergraduate/bachelor-of-science-programs/#majors">Learn More</a></td>
                </tr>
                <tr class="program_implementation">
                  <td>Rutgers-New Brunswick</td>
                  <td>Rutgers Business School - New Brunswick</td>
                  <td><a href="https://www.business.rutgers.edu/undergraduate-new-brunswick/accounting">Learn More</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </li>
      <li class="views-row accordion-list-item">
        <div class="program">
          <button type="button" class="accordion-trigger">
            <h3>Naval Science</h3>
          </button>
          <div id="section-8654" class="accordion-panel" role="region">
            <table class="program-data">
              <tbody>
                <tr class="program_implementation">
                  <td>Rutgers-New Brunswick</td>
                  <td>Other campus sample</td>
                  <td><a href="https://example.com/naval-science">Learn More</a></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </li>
      <li><button type="button" class="all-button"><a href="?field_name_alpha=">All</a></button></li>
    </ul>
  `;

  assert.deepEqual(
    extractRutgersProgramsFromUndergraduateHtml("https://www.rutgers.edu/academics/explore-undergraduate-programs", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:Accounting", "major:Naval Science"]
  );
});

test("extractPennProgramsFromCatalogHtml keeps official Penn program entries and university-minor labels", () => {
  const majorsHtml = `
    <a href="/undergraduate/programs/africana-studies-african-american-ba/">African American Studies</a>
    <a href="/undergraduate/programs/economics-ba/">Economics, BA</a>
    <a href="/undergraduate/programs/english-creative-writing-ba/">Creative Writing</a>
    <a href="#header">Back to Top</a>
  `;
  const minorsHtml = `
    <a href="#text">Consumer Psychology</a>
    <a href="/undergraduate/programs/consumer-psychology-minor">View Program Requirements</a>
    <a href="#text">Urban Education</a>
  `;

  assert.deepEqual(
    extractPennProgramsFromCatalogHtml("https://catalog.upenn.edu/undergraduate/arts-sciences/majors/", majorsHtml, "major").map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:African American Studies", "major:Economics", "major:Creative Writing"]
  );

  assert.deepEqual(
    extractPennProgramsFromCatalogHtml(
      "https://catalog.upenn.edu/undergraduate/interdisciplinary/university-minors/",
      minorsHtml,
      "minor"
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["minor:Consumer Psychology", "minor:Urban Education"]
  );
});

test("extractUChicagoProgramsFromCourseleafHtml keeps the curated major and minor lists from CourseLeaf", () => {
  const majorsHtml = `
    <h3>List of Majors</h3>
    <p class="noindent" style="margin-left:40px">
      <a href="/thecollege/anthropology/">Anthropology</a><br/>
      <a href="/thecollege/economics/">Economics</a><br/>
      <a href="/thecollege/minors/">Minors</a><br/>
      <a href="/thecollege/jointdegreeprograms/">Joint Degree Programs</a>
    </p>
  `;

  const minorsHtml = `
    <h3>List of Minors</h3>
    <p style="margin-left:40px">
      <a href="/thecollege/anthropology/#minorinanthropology">Anthropology</a><br/>
      <a href="/thecollege/linguistics/#minorprograminlinguistics">Linguistics</a><br/>
      <a href="/thecollege/programsofstudy/">Programs of Study</a>
    </p>
  `;

  assert.deepEqual(
    extractUChicagoProgramsFromCourseleafHtml(
      "http://collegecatalog.uchicago.edu/thecollege/programsofstudy/",
      majorsHtml,
      "List of Majors",
      "major"
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["major:Anthropology", "major:Economics"]
  );

  assert.deepEqual(
    extractUChicagoProgramsFromCourseleafHtml(
      "http://collegecatalog.uchicago.edu/thecollege/minors/",
      minorsHtml,
      "List of Minors",
      "minor"
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["minor:Anthropology", "minor:Linguistics"]
  );
});

test("extractMitProgramsFromCourseleafHtml keeps undergraduate SB majors and catalog minors", () => {
  const majorsHtml = `
    <a href="/degree-charts/architecture-course-4/">Architecture (SB, Course 4)</a>
    <a href="/degree-charts/computer-science-engineering-course-6-3/">Computer Science and Engineering (SB, Course 6-3)</a>
    <a href="/degree-charts/master-architecture/">Architecture (MArch)</a>
    <a href="/degree-charts/science-technology-society-sts/">Science, Technology, and Society/Second Major (SB, STS)</a>
  `;

  const minorsHtml = `
    <div id="textcontainer" class="page_content">
      <p>
        <a href="/schools/science/biology/#undergraduatetext">Biology</a><br/>
        <a href="/interdisciplinary/undergraduate-programs/minors/energy-studies/">Energy Studies</a><br/>
        <a href="https://registrar.mit.edu/registration-academics/academic-requirements/majors-minors/declaring-minor">Registrar's Office website</a>
      </p>
    </div><!--end #textcontainer -->
  `;

  assert.deepEqual(
    extractMitProgramsFromCourseleafHtml(
      "https://catalog.mit.edu/mit/undergraduate-education/academic-programs/majors/",
      majorsHtml,
      "major"
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["major:Architecture", "major:Computer Science and Engineering"]
  );

  assert.deepEqual(
    extractMitProgramsFromCourseleafHtml(
      "https://catalog.mit.edu/mit/undergraduate-education/academic-programs/minors/",
      minorsHtml,
      "minor"
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["minor:Biology", "minor:Energy Studies"]
  );
});

test("extractUcdavisProgramsFromCatalogHtml keeps undergraduate bachelors and minors while filtering graduate entries", () => {
  const html = `
    <div id="programsanddegreestextcontainer" class="page_content tab_content">
      <div class="az_sitemap">
        <ul>
          <li><a href="/departments-programs-degrees/american-studies/american-studies-ab/">American Studies, Bachelor of Arts</a></li>
          <li><a href="/departments-programs-degrees/american-studies/american-studies-minor/">American Studies, Minor</a></li>
          <li><a href="/departments-programs-degrees/animal-behavior/animal-behavior-phd/">Animal Behavior, Doctor of Philosophy</a></li>
          <li><a href="/departments-programs-degrees/biomedical-engineering/biomedical-engineering-bs/">Biomedical Engineering, Bachelor of Science</a></li>
        </ul>
      </div>
    </div>
  `;

  assert.deepEqual(
    extractUcdavisProgramsFromCatalogHtml(
      "https://catalog.ucdavis.edu/departments-programs-degrees/",
      html
    ).map((program) => `${program.degreeType}:${program.kind}:${program.displayName}`),
    ["BA:major:American Studies", "Undergraduate:minor:American Studies", "BS:major:Biomedical Engineering"]
  );
});

test("extractUcsdProgramsFromDegreesHtml keeps undergraduate majors and specializations while filtering advisory items", () => {
  const html = `
    <h1>Undergraduate Degrees Offered, 2025&#8211;26</h1>
    <h4>POLITICAL SCIENCE</h4>
    <ul>
      <li>Political Science BA</li>
      <li>Political Science (International Affairs) BA/MIA only</li>
      <li>Political Science (Public Policy) BA</li>
    </ul>
    <h4>PUBLIC HEALTH</h4>
    <ul>
      <li><span>Public Health BS</span></li>
      <li><span>Public Health with Concentration in Biostatistics BS</span></li>
    </ul>
    <h4>PREMEDICAL</h4>
    <p class=\"note\">(see Footnote 3)</p>
    <div class=\"clear footnotes\"></div>
  `;

  assert.deepEqual(
    extractUcsdProgramsFromDegreesHtml(
      "https://catalog.ucsd.edu/undergraduate/degrees-offered/index.html",
      html
    ).map((program) => `${program.degreeType}:${program.kind}:${program.displayName}`),
    [
      "BA:major:Political Science",
      "BA:major:Political Science (Public Policy)",
      "BS:major:Public Health",
      "BS:major:Public Health with Concentration in Biostatistics",
    ]
  );
});

test("extractBrownConcentrationsFromBulletinHtml reads the official concentration list", () => {
  const html = `
    <div id="textcontainer" class="page_content">
      <ul>
        <li><a href="/the-college/concentrations/afri/">Africana Studies</a></li>
        <li><a href="/the-college/concentrations/anth/">Anthropology</a></li>
        <li><a href="/the-college/concentrations/">Undergraduate Concentrations</a></li>
      </ul>
    </div><!--end #textcontainer -->
  `;

  assert.deepEqual(
    extractBrownConcentrationsFromBulletinHtml(
      "https://bulletin.brown.edu/the-college/concentrations/",
      html
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["major:Africana Studies", "major:Anthropology"]
  );
});

test("extractRiceProgramsFromCatalogHtml reads undergraduate majors and minors from the catalog table", () => {
  const html = `
    <table role="grid">
      <tr role="row">
        <td role="gridcell"><span>Ancient Mediterranean Civilizations</span></td>
        <td role="gridcell"><span><a href="/programs-study/departments-programs/humanities/ancient-mediterranean-civilizations">Department</a></span></td>
        <td role="gridcell"><span><a href="/programs-study/departments-programs/humanities">HU</a></span></td>
        <td role="gridcell">
          <span><a href="/programs-study/departments-programs/humanities/ancient-mediterranean-civilizations/ancient-mediterranean-civilization-ba/">BA</a></span>
          <span><a href="/programs-study/departments-programs/humanities/ancient-mediterranean-civilizations/ancient-mediterranean-civilizations-minor/">Minor</a></span>
        </td>
        <td role="gridcell"><span>-</span></td>
      </tr>
      <tr role="row">
        <td role="gridcell"><span>African and African American Studies</span></td>
        <td role="gridcell"><span><a href="/programs-study/departments-programs/humanities/african-african-american-studies">Department</a></span></td>
        <td role="gridcell"><span><a href="/programs-study/departments-programs/humanities">HU</a></span></td>
        <td role="gridcell"><span>-</span></td>
        <td role="gridcell"><span><a href="/programs-study/departments-programs/humanities/african-african-american-studies/african-african-american-studies-certificate/">Certificate</a></span></td>
      </tr>
    </table>
  `;

  assert.deepEqual(
    extractRiceProgramsFromCatalogHtml(
      "https://ga.rice.edu/programs-study/departments-programs/",
      html
    ).map((program) => `${program.degreeType}:${program.kind}:${program.displayName}`),
    ["BA:major:Ancient Mediterranean Civilizations", "Undergraduate:minor:Ancient Mediterranean Civilizations"]
  );
});

test("extractWashingtonProgramsFromDegreeProgramsHtml distinguishes majors and minors from registrar program anchors", () => {
  const html = `
    <h3 id="PH">Public Health</h3>
    <ul>
      <li><a href="https://uw.edu/students/gencat/program/S/SchoolofPublicHealth-715.html#program-UG-HLTHI-MAJOR">Health Informatics</a></li>
      <li><a href="https://uw.edu/students/gencat/program/S/SchoolofPublicHealth-715.html">Public Health Genetics</a></li>
    </ul>
    <h3 id="UIP">Undergraduate Interdisciplinary Programs</h3>
    <ul>
      <li><a href="https://uw.edu/students/gencat/program/S/UndergraduateAcademicAffairs-1115.html#program-UG-DATASC-MINOR">Data Science</a></li>
      <li><a href="https://uw.edu/students/gencat/program/S/GeneralStudies-185.html#program-UG-HRGT-MINOR">Human Rights</a></li>
    </ul>
  `;

  assert.deepEqual(
    extractWashingtonProgramsFromDegreeProgramsHtml(
      "https://www.washington.edu/students/gencat/degree_programs.html",
      html
    ).map((program) => `${program.kind}:${program.displayName}`),
    [
      "major:Health Informatics",
      "major:Public Health Genetics",
      "minor:Data Science",
      "minor:Human Rights",
    ]
  );
});

test("extractWashingtonProgramsFromDegreeProgramsHtml filters restricted graduate-only sections and labels", () => {
  const html = `
    <h3 id="B"><a href="https://uw.edu/students/gencat/program/S/school_business.html">Michael G. Foster School of Business</a></h3>
    <ul>
      <li><a href="https://uw.edu/students/gencat/program/S/Business-300.html">Business</a></li>
      <li><a href="https://uw.edu/students/gencat/program/S/Accounting-301.html">Accounting (Graduate Degree Programs)</a></li>
    </ul>
    <h3 id="M"><a href="https://uw.edu/students/gencat/program/S/school_medicine.html">School of Medicine</a></h3>
    <ul>
      <li><a href="https://uw.edu/students/gencat/program/S/anesth.html">Anesthesiology</a></li>
      <li><a href="https://uw.edu/students/gencat/program/S/SchoolofMedicine-999.html#program-UG-TEST-MAJOR">Undergraduate Health</a></li>
    </ul>
  `;
  assert.deepEqual(
    extractWashingtonProgramsFromDegreeProgramsHtml(
      "https://www.washington.edu/students/gencat/degree_programs.html",
      html
    ).map((program) => `${program.kind}:${program.displayName}`),
    ["major:Business", "major:Undergraduate Health"]
  );
});

test("extractUcsdProgramsFromMajorCodesHtml reads major names from the UCSD code table", () => {
  const html = `
    <table class="styled">
      <tr><th>Department or program</th><th>D</th><th>ISIS Major code</th><th>TSS Major code</th><th>Major</th></tr>
      <tr>
        <td class="body" rowspan="2"><a href="https://astro.ucsd.edu/">Astronomy &amp; Astrophysics</a></td>
        <td>D</td><td>AT25</td><td>ASTR-BS-001</td><td>Astronomy &amp; Astrophysics (B.S.)</td>
      </tr>
      <tr>
        <td></td><td>AT27</td><td>ASTR-BS-002</td><td>Astrophysical Sciences (B.S.)</td>
      </tr>
      <tr>
        <td class="body"><a href="https://anthropology.ucsd.edu/">Anthropology</a></td>
        <td></td><td>AN27</td><td>ANTH-BA-003</td><td>Anthropology (Concentration in Archaeology)</td>
      </tr>
    </table>
  `;
  assert.deepEqual(
    extractUcsdProgramsFromMajorCodesHtml("http://blink.ucsd.edu/instructors/academic-info/majors/major-codes.html", html).map(
      (program) => `${program.degreeType}:${program.kind}:${program.displayName}`
    ),
    [
      "BS:major:Astronomy & Astrophysics",
      "BS:major:Astrophysical Sciences",
      "Undergraduate:major:Anthropology (Concentration in Archaeology)",
    ]
  );
});

test("extractUcsdProgramsFromMinorCodesHtml reads minor names from the UCSD code table", () => {
  const html = `
    <table class="table">
      <tr><th>ISIS Code</th><th>TSS Code</th><th>Minor</th><th>Administered By</th></tr>
      <tr><td>M070</td><td>RSM-MN-001</td><td><a href="https://rady.ucsd.edu/programs/undergraduate-programs/accounting-minor/">Accounting</a></td><td>Rady</td></tr>
      <tr><td>M044</td><td>SOC-MN-002</td><td>African Studies</td><td>Sociology</td></tr>
    </table>
  `;
  assert.deepEqual(
    extractUcsdProgramsFromMinorCodesHtml("http://blink.ucsd.edu/instructors/academic-info/majors/minor-codes.html", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["minor:Accounting", "minor:African Studies"]
  );
});

test("extractDartmouthProgramsFromCatalogHtml reads undergraduate department entries from the current ORC index", () => {
  const html = `
    <li class="hasChildren active"><a href="/en/current/orc/departments-programs-undergraduate">Departments/Programs and Courses - Undergraduate</a><ul>
      <li class="hasChildren"><a href="/en/current/orc/departments-programs-undergraduate/anthropology">Anthropology</a></li>
      <li class="hasChildren"><a href="/en/current/orc/departments-programs-undergraduate/education">Minor in Education</a></li>
      <li class="hasChildren"><a href="/en/current/orc/departments-programs-undergraduate/computer-science">Computer Science - Undergraduate</a></li>
      <li class="hasChildren"><a href="/en/current/orc/departments-programs-undergraduate/college-courses">College Courses</a></li>
    </ul></li>
  `;
  assert.deepEqual(
    extractDartmouthProgramsFromCatalogHtml("https://dartmouth.smartcatalogiq.com/en/current/orc/departments-programs-undergraduate/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:Anthropology", "minor:Education", "major:Computer Science"]
  );
});

test("extractUclaDepartmentLinksFromNextData reads department browse folders from the UCLA home payload", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          navigation: {
            browse_nav: [
              {},
              {
                children: [
                  { title: "Anthropology", href: "/browse/Departments/Anthropology", children: [] },
                  { title: "Letters and Science Collegewide Programs", href: "/browse/Departments/LettersandScienceCollegewidePrograms", children: [] },
                ],
              },
            ],
          },
        },
      },
    })}</script>
  `;
  assert.deepEqual(extractUclaDepartmentLinksFromNextData(html), [
    { title: "Anthropology", href: "/browse/Departments/Anthropology", children: [] },
  ]);
});

test("classifyUclaDepartmentPageFromNextData reads major and minor tab availability", () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">${JSON.stringify({
      props: {
        pageProps: {
          browseContent: {
            content: { name: "Anthropology" },
            totalCount: { aos: { ucla: 3 }, minor: { ucla: 1 } },
            tabs: [
              {
                sections: [{ label: "Majors" }, { label: "Minors" }, { label: "Courses" }],
              },
            ],
          },
        },
      },
    })}</script>
  `;
  assert.deepEqual(classifyUclaDepartmentPageFromNextData(html), {
    displayName: "Anthropology",
    hasMajor: true,
    hasMinor: true,
  });
});

test("extractBerkeleyProgramsFromAdmissionsHtml removes undeclared buckets and cleans catalog notes", () => {
  const html = `
    <h5>Majors</h5>
    <ul>
      <li>Astrophysics <em>(including Astronomy)</em></li>
      <li>Chemistry <i>also offered in the College of Chemistry</i></li>
      <li>Undeclared - Social Sciences*</li>
    </ul>
    <h5>Minors</h5>
    <ul>
      <li>Ancient Greek &amp; Roman Studies</li>
      <li>Undeclared - Arts and Humanities*</li>
    </ul>
  `;

  assert.deepEqual(
    extractBerkeleyProgramsFromAdmissionsHtml("https://admissions.berkeley.edu/majors", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:Astrophysics", "major:Chemistry", "minor:Ancient Greek & Roman Studies"]
  );
});

test("extractUtAustinMajorProgramsFromHtml keeps real programs and skips degree containers", () => {
  const html = `
    <a href="/undergraduate/business/degrees-and-programs/">Degrees and Programs</a>
    <a href="/undergraduate/business/degrees-and-programs/bachelor-of-business-administration/">Bachelor of Business Administration</a>
    <a href="/undergraduate/business/degrees-and-programs/bachelor-of-business-administration/accounting/">Accounting</a>
    <a href="/undergraduate/business/degrees-and-programs/bachelor-of-business-administration/accounting/suggested-arrangement-of-courses/">Suggested Arrangement of Courses, Accounting (BBA)</a>
    <a href="/undergraduate/architecture/degrees-and-programs/bs-interior-design/">BS Interior Design</a>
    <a href="/undergraduate/fine-arts/degrees-and-programs/ba-art/sugg-art-history-ba/">Suggested Arrangement of Courses, Art History (BA)</a>
  `;

  assert.deepEqual(
    extractUtAustinMajorProgramsFromHtml("https://catalog.utexas.edu/undergraduate/business/degrees-and-programs/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["major:Accounting", "major:Interior Design", "major:Art History"]
  );
});

test("extractUtAustinMinorProgramsFromHtml reads h4 minors and excludes certificates", () => {
  const html = `
    <h2>Minors</h2>
    <h3>Minors for Business Majors</h3>
    <h4>Accounting Minor for Business Majors</h4>
    <h4>Entrepreneurship Minor</h4>
    <h2>Certificates</h2>
    <h4>The Elements of Business Certificate</h4>
  `;

  assert.deepEqual(
    extractUtAustinMinorProgramsFromHtml("https://catalog.utexas.edu/undergraduate/business/minor-and-certificate-programs/", html).map(
      (program) => `${program.kind}:${program.displayName}`
    ),
    ["minor:Accounting Minor for Business Majors", "minor:Entrepreneurship"]
  );
});

test("extractGeorgiaProgramsFromSearchHtml reads program cards from the bulletin partial view", () => {
  const html = `
    <div class="program-card">
      <div class="entry-card--text">
        <p class="large-mw">Accounting and International Business Co-Major</p>
        <a href="/Program/Details/31532?IDc=BUS" class="btn btn--outline"><span class="program-undergrad"></span> BBA</a>
      </div>
    </div>
    <div class="program-card">
      <div class="entry-card--text">
        <p class="large-mw">Minor in Aerospace Studies</p>
        <a href="/Program/Details/50315" class="btn btn--outline"><span class="program-minor"></span> MINOR</a>
      </div>
    </div>
  `;

  assert.deepEqual(
    extractGeorgiaProgramsFromSearchHtml("https://bulletin.uga.edu/Program/Index", html, "major").map(
      (program) => `${program.kind}:${program.displayName}:${program.sourceUrl}`
    ),
    [
      "major:Accounting and International Business:https://bulletin.uga.edu/Program/Details/31532?IDc=BUS",
      "major:Aerospace Studies:https://bulletin.uga.edu/Program/Details/50315",
    ]
  );
});
