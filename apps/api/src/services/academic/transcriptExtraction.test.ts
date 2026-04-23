import test from "node:test";
import assert from "node:assert/strict";
import { extractStructuredTranscript } from "./transcriptExtraction";

test("extractStructuredTranscript groups transcript rows into ordered terms", () => {
  const transcript = extractStructuredTranscript({
    studentProfileId: "student-1",
    transcriptText: `
      Fall 2024
      CS 111 Introduction to Computer Science    A    3
      MATH 221 Calculus I    B+    4

      Spring 2025
      STAT 201: Applied Statistics
      ENGL 105 Writing Seminar    IP    3
      BIOL 150 Laboratory Skills    W    1
    `,
  });

  assert.equal(transcript.terms.length, 2);
  assert.equal(transcript.terms[0]?.termLabel, "Fall 2024");
  assert.equal(transcript.terms[0]?.courses.length, 2);
  assert.equal(transcript.terms[0]?.courses[0]?.rawCourseCode, "CS111");
  assert.equal(transcript.terms[0]?.courses[0]?.grade, "A");
  assert.equal(transcript.terms[0]?.courses[0]?.completionStatus, "completed");
  assert.equal(transcript.terms[1]?.termLabel, "Spring 2025");
  assert.equal(transcript.terms[1]?.courses.length, 3);
  assert.equal(transcript.terms[1]?.courses[0]?.rawCourseCode, "STAT201");
  assert.equal(transcript.terms[1]?.courses[0]?.rawCourseTitle, "Applied Statistics");
  assert.equal(transcript.terms[1]?.courses[1]?.completionStatus, "in_progress");
  assert.equal(transcript.terms[1]?.courses[2]?.completionStatus, "withdrawn");
});

test("extractStructuredTranscript throws when no recognizable course rows are present", () => {
  assert.throws(
    () =>
      extractStructuredTranscript({
        studentProfileId: "student-2",
        transcriptText: "This PDF had no parsable course lines.",
      }),
    /TRANSCRIPT_EXTRACTION_EMPTY/
  );
});
