import crypto from "node:crypto";
import { ArtifactRepository } from "../../repositories/student/artifactRepository";
import { OnboardingRepository } from "../../repositories/student/onboardingRepository";

const artifactRepo = new ArtifactRepository();
const onboardingRepo = new OnboardingRepository();

function stableId(namespace: string, key: string): string {
  return crypto.createHash("sha256").update(`${namespace}:${key}`).digest("hex").slice(0, 32);
}

function inferParserType(artifactType: string): string {
  if (artifactType === "resume") return "resume_parser";
  if (artifactType === "transcript") return "transcript_parser";
  return "generic_artifact_parser";
}

export async function persistArtifactAndQueueParse(input: {
  studentProfileId: string;
  artifactType: string;
  objectPath: string;
}) {
  const academicArtifactId = stableId(
    "academic_artifact",
    `${input.studentProfileId}:${input.artifactType}:${input.objectPath}`
  );
  const artifactParseJobId = stableId(
    "artifact_parse_job",
    `${academicArtifactId}:${inferParserType(input.artifactType)}`
  );
  const onboardingStateId = stableId("onboarding_state", input.studentProfileId);

  await artifactRepo.createAcademicArtifact({
    academicArtifactId,
    studentProfileId: input.studentProfileId,
    artifactType: input.artifactType,
    fileUri: input.objectPath,
    sourceLabel: "supabase_storage",
    parsedStatus: "pending",
  });

  await artifactRepo.createArtifactParseJob({
    artifactParseJobId,
    academicArtifactId,
    studentProfileId: input.studentProfileId,
    artifactType: input.artifactType,
    parserType: inferParserType(input.artifactType),
  });

  await onboardingRepo.ensureState(input.studentProfileId, onboardingStateId);
  await onboardingRepo.updateFlags(input.studentProfileId, {
    uploads_completed: true,
  });

  return {
    academicArtifactId,
    artifactParseJobId,
  };
}
