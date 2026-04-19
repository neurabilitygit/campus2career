import type { StudentTranscriptInput, TranscriptCourseInput, TranscriptTermInput } from "../../../../../packages/shared/src/contracts/academic";

const TERM_HEADER_PATTERNS = [
  /^(fall|spring|summer|winter)\s+\d{4}$/i,
  /^\d{4}\s+(fall|spring|summer|winter)$/i,
  /^(autumn|spring|summer|winter)\s+\d{4}$/i,
];

const COURSE_LINE_PATTERNS = [
  /^(?<code>[A-Z&]{2,6}[-\s]?\d{2,4}[A-Z]?)\s+(?<title>.+?)(?:\s{2,}|\t+)(?<grade>A|A-|B\+|B|B-|C\+|C|C-|D\+|D|D-|F|P|NP|W|I|IP)?(?:\s+)?(?<credits>\d+(?:\.\d+)?)?$/i,
  /^(?<code>[A-Z&]{2,6}[-\s]?\d{2,4}[A-Z]?)\s*[:\-]\s*(?<title>.+)$/i,
];

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function looksLikeTermHeader(line: string): boolean {
  const normalized = normalizeWhitespace(line);
  return TERM_HEADER_PATTERNS.some((pattern) => pattern.test(normalized));
}

function parseCredits(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function classifyCompletionStatus(grade: string | undefined): TranscriptCourseInput["completionStatus"] {
  const normalized = (grade || "").trim().toUpperCase();
  if (normalized === "IP") return "in_progress";
  if (normalized === "W") return "withdrawn";
  if (normalized === "F") return "failed";
  return "completed";
}

function parseCourseLine(line: string): TranscriptCourseInput | null {
  const trimmed = normalizeWhitespace(line);
  for (const pattern of COURSE_LINE_PATTERNS) {
    const match = trimmed.match(pattern);
    if (!match?.groups) continue;

    const rawCourseCode = match.groups.code ? normalizeWhitespace(match.groups.code).replace(/\s+/g, "") : undefined;
    const rawCourseTitle = match.groups.title ? normalizeWhitespace(match.groups.title) : "";
    if (!rawCourseTitle) {
      continue;
    }

    const grade = match.groups.grade ? normalizeWhitespace(match.groups.grade).toUpperCase() : undefined;
    const credits = parseCredits(match.groups.credits);

    return {
      rawCourseCode,
      rawCourseTitle,
      creditsAttempted: credits,
      creditsEarned: credits,
      grade,
      completionStatus: classifyCompletionStatus(grade),
      rawTextExcerpt: line,
    };
  }

  return null;
}

function fallbackTermLabel(index: number): string {
  return index === 0 ? "Imported Transcript" : `Imported Transcript ${index + 1}`;
}

export function extractStructuredTranscript(input: {
  studentProfileId: string;
  transcriptText: string;
  academicArtifactId?: string;
  institutionCanonicalName?: string;
  transcriptSummary?: string;
}): StudentTranscriptInput {
  const lines = input.transcriptText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const terms: TranscriptTermInput[] = [];
  let currentTerm: TranscriptTermInput = {
    termLabel: fallbackTermLabel(0),
    displayOrder: 0,
    courses: [],
  };

  for (const line of lines) {
    if (looksLikeTermHeader(line)) {
      if (currentTerm.courses.length > 0 || terms.length === 0) {
        if (currentTerm.courses.length > 0 || terms.length === 0) {
          terms.push(currentTerm);
        }
      }
      currentTerm = {
        termLabel: normalizeWhitespace(line),
        displayOrder: terms.length,
        courses: [],
      };
      continue;
    }

    const course = parseCourseLine(line);
    if (!course) {
      continue;
    }

    currentTerm.courses.push(course);
  }

  if (currentTerm.courses.length > 0) {
    const existing = terms.find((term) => term.termLabel === currentTerm.termLabel && term.displayOrder === currentTerm.displayOrder);
    if (!existing) {
      terms.push(currentTerm);
    }
  }

  const normalizedTerms = terms
    .filter((term) => term.courses.length > 0)
    .map((term, index) => ({
      ...term,
      displayOrder: index,
      termLabel: term.termLabel || fallbackTermLabel(index),
    }));

  if (!normalizedTerms.length) {
    throw new Error("TRANSCRIPT_EXTRACTION_EMPTY");
  }

  return {
    studentProfileId: input.studentProfileId,
    academicArtifactId: input.academicArtifactId,
    institutionCanonicalName: input.institutionCanonicalName,
    transcriptSummary:
      input.transcriptSummary ??
      `Extracted ${normalizedTerms.reduce((sum, term) => sum + term.courses.length, 0)} course entries across ${normalizedTerms.length} term(s).`,
    parsedStatus: "parsed",
    terms: normalizedTerms,
  };
}
