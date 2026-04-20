import { CatalogRepository } from "../../repositories/academic/catalogRepository";

const repo = new CatalogRepository();

export async function searchInstitutionDirectory(input: {
  query?: string;
  limit?: number;
}) {
  const institutions = await repo.searchInstitutions({
    query: input.query,
    limit: input.limit,
  });

  return institutions.map((institution) => ({
    institutionId: institution.institution_id,
    canonicalName: institution.canonical_name,
    displayName: institution.display_name,
    stateRegion: institution.state_region,
    city: institution.city,
    websiteUrl: institution.website_url,
    countryCode: institution.country_code,
  }));
}

export async function getInstitutionDirectoryOptions(input: {
  institutionCanonicalName?: string;
  catalogLabel?: string;
  degreeType?: string;
  programName?: string;
  majorCanonicalName?: string;
}) {
  if (!input.institutionCanonicalName) {
    return {
      institution: null,
      catalogs: [],
      degreePrograms: [],
      majors: [],
      minors: [],
      concentrations: [],
    };
  }

  const institution = await repo.getInstitutionByCanonicalName(input.institutionCanonicalName);
  if (!institution) {
    throw new Error(`Institution not found: ${input.institutionCanonicalName}`);
  }

  const catalogs = await repo.listAcademicCatalogsForInstitution(institution.institution_id);
  const selectedCatalog =
    input.catalogLabel
      ? catalogs.find((catalog) => catalog.catalog_label === input.catalogLabel) || null
      : catalogs[0] || null;

  const degreePrograms = selectedCatalog
    ? await repo.listDegreeProgramsForCatalog(selectedCatalog.academic_catalog_id)
    : [];

  const selectedDegreeProgram =
    selectedCatalog
      ? input.degreeType && input.programName
        ? await repo.getDegreeProgram(selectedCatalog.academic_catalog_id, input.degreeType, input.programName)
        : degreePrograms[0] || null
      : null;

  const majors = selectedDegreeProgram
    ? await repo.listMajorsForDegreeProgram(selectedDegreeProgram.degree_program_id)
    : [];
  const minors = selectedDegreeProgram
    ? await repo.listMinorsForDegreeProgram(selectedDegreeProgram.degree_program_id)
    : [];

  const selectedMajor =
    selectedDegreeProgram
      ? input.majorCanonicalName
        ? await repo.getMajor(selectedDegreeProgram.degree_program_id, input.majorCanonicalName)
        : majors[0] || null
      : null;

  const concentrations = selectedMajor
    ? await repo.listConcentrationsForMajor(selectedMajor.major_id)
    : [];

  return {
    institution: {
      institutionId: institution.institution_id,
      canonicalName: institution.canonical_name,
      displayName: institution.display_name,
      city: institution.city,
      stateRegion: institution.state_region,
      websiteUrl: institution.website_url,
      countryCode: institution.country_code,
    },
    catalogs: catalogs.map((catalog) => ({
      academicCatalogId: catalog.academic_catalog_id,
      catalogLabel: catalog.catalog_label,
      startYear: catalog.start_year,
      endYear: catalog.end_year,
      sourceUrl: catalog.source_url,
      sourceFormat: catalog.source_format,
      extractionStatus: catalog.extraction_status,
      isSelected: selectedCatalog?.academic_catalog_id === catalog.academic_catalog_id,
    })),
    degreePrograms: degreePrograms.map((program) => ({
      degreeProgramId: program.degree_program_id,
      degreeType: program.degree_type,
      programName: program.program_name,
      schoolName: program.school_name,
      totalCreditsRequired: program.total_credits_required,
      isSelected: selectedDegreeProgram?.degree_program_id === program.degree_program_id,
    })),
    majors: majors.map((major) => ({
      majorId: major.major_id,
      canonicalName: major.canonical_name,
      displayName: major.display_name,
      departmentName: major.department_name,
      cipCode: major.cip_code,
      isSelected: selectedMajor?.major_id === major.major_id,
    })),
    minors: minors.map((minor) => ({
      minorId: minor.minor_id,
      canonicalName: minor.canonical_name,
      displayName: minor.display_name,
      departmentName: minor.department_name,
    })),
    concentrations: concentrations.map((concentration) => ({
      concentrationId: concentration.concentration_id,
      canonicalName: concentration.canonical_name,
      displayName: concentration.display_name,
    })),
  };
}
