export function canAccessParentCommunication(role: string): boolean {
  return role === "parent" || role === "admin";
}

export function canAccessStudentCommunication(role: string): boolean {
  return role === "student" || role === "admin";
}
