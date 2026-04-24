export function canAccessStudentOutcomes(role: string): boolean {
  return role === "student" || role === "admin";
}

export function canAccessParentOutcomes(role: string): boolean {
  return role === "parent" || role === "admin";
}

export function canAccessCoachOutcomes(role: string): boolean {
  return role === "coach" || role === "admin";
}
