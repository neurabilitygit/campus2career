import test from "node:test";
import assert from "node:assert/strict";
import {
  classifyTcnjProgramKindsFromDetailHtml,
  classifyUclaDepartmentPageFromNextData,
  dedupeRepeatedProgramLabel,
  extractBrownConcentrationsFromBulletinHtml,
  extractBostonCollegeProgramsFromHtml,
  extractDartmouthProgramsFromCatalogHtml,
  extractDukeProgramsFromAdmissionsHtml,
  extractEmoryProgramsFromHtml,
  extractGeorgetownProgramsFromDegreePage,
  extractJhuProgramsFromHtml,
  extractMontclairProgramsFromFinderHtml,
  extractMitProgramsFromCourseleafHtml,
  extractNorthwesternProgramsFromAdmissionsHtml,
  extractNortheasternProgramsFromCatalogSchoolHtml,
  extractNotreDameProgramsFromHtml,
  extractPennProgramsFromCatalogHtml,
  extractRiceProgramsFromCatalogHtml,
  extractRochesterProgramsFromHtml,
  extractUcdavisProgramsFromCatalogHtml,
  extractUclaDepartmentLinksFromNextData,
  extractUcsdProgramsFromMajorCodesHtml,
  extractUcsdProgramsFromMinorCodesHtml,
  extractUcsdProgramsFromDegreesHtml,
  extractUChicagoProgramsFromCourseleafHtml,
  extractUcsbProgramsFromDepartmentPage,
  extractVanderbiltProgramsFromApiPayload,
  extractWashingtonProgramsFromDegreeProgramsHtml,
  extractWashuProgramsFromHtml,
  extractWisconsinProgramsFromHtml,
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
    <a href="/undergraduate/letters-science/anthropology/anthropology-ba/">Anthropology, BA Anthropology, BA</a>
    <a href="/undergraduate/education/art/art-bfa/">Art, BFA Art, BFA</a>
    <a href="/undergraduate/education/art/art-studio-certificate/">Art Studio, Certificate Art Studio, Certificate</a>
  `;

  const programs = extractWisconsinProgramsFromHtml("https://guide.wisc.edu/explore-majors/", html);
  assert.deepEqual(
    programs.map((program) => `${program.degreeType}:${program.kind}:${program.displayName}`),
    ["Undergraduate:major:Anthropology", "BFA:major:Art"]
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
