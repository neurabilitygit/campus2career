export const PERSONAS = ["student", "parent", "coach", "admin"] as const;

export type Persona = (typeof PERSONAS)[number];

export type CapabilityKey =
  | "view_student_dashboard"
  | "view_parent_dashboard"
  | "view_coach_dashboard"
  | "view_student_profile"
  | "edit_student_profile"
  | "view_parent_profile"
  | "edit_parent_profile"
  | "view_coach_profile"
  | "edit_coach_profile"
  | "create_household"
  | "manage_household"
  | "view_household_admin"
  | "invite_student"
  | "invite_coach"
  | "approve_household_join_request"
  | "request_household_access"
  | "accept_household_invitation"
  | "view_documents"
  | "upload_documents"
  | "view_academic_evidence"
  | "edit_academic_evidence"
  | "upload_degree_requirements_pdf"
  | "verify_curriculum"
  | "coach_review_curriculum"
  | "view_scoring"
  | "run_scoring"
  | "view_recommendations"
  | "edit_recommendations"
  | "view_communication"
  | "communication_profile_parent_edit"
  | "communication_profile_student_edit"
  | "communication_translate_parent_to_student"
  | "communication_translate_student_to_parent"
  | "communication_feedback_submit"
  | "communication_summary_view"
  | "communication_coach_context_view"
  | "communication_admin_manage"
  | "use_chatbot"
  | "view_career_goals"
  | "create_career_goals"
  | "edit_career_goals"
  | "delete_career_goals"
  | "analyze_career_goals"
  | "manage_coach_notes"
  | "view_parent_brief"
  | "view_student_information"
  | "manage_users"
  | "manage_permissions"
  | "manage_roles"
  | "manage_system_settings"
  | "access_admin_console";

export type CapabilityDefinition = {
  key: CapabilityKey;
  label: string;
  description: string;
  applicablePersonas: Persona[];
  dependencies: CapabilityKey[];
  systemCritical: boolean;
  defaultEnabledByPersona: Partial<Record<Persona, boolean>>;
  adminChangeable: boolean;
};

export const CAPABILITY_CATALOG: CapabilityDefinition[] = [
  {
    key: "view_student_dashboard",
    label: "View student dashboard",
    description: "Open the student dashboard and student strategy views.",
    applicablePersonas: ["student", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { student: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_parent_dashboard",
    label: "View parent dashboard",
    description: "Open the parent dashboard and family-facing progress views.",
    applicablePersonas: ["parent", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_coach_dashboard",
    label: "View coach dashboard",
    description: "Open the coach dashboard and roster workspace.",
    applicablePersonas: ["coach", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_student_profile",
    label: "View student profile",
    description: "See the student profile and academic path details.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "edit_student_profile",
    label: "Edit student profile",
    description: "Change the student profile, academic path, and preferences.",
    applicablePersonas: ["student", "parent", "admin"],
    dependencies: ["view_student_profile"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_parent_profile",
    label: "View parent profile",
    description: "See the parent profile and family context information.",
    applicablePersonas: ["parent", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "edit_parent_profile",
    label: "Edit parent profile",
    description: "Update the parent profile and household context fields.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["view_parent_profile"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_coach_profile",
    label: "View coach profile",
    description: "See the coach profile and organization details.",
    applicablePersonas: ["coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "edit_coach_profile",
    label: "Edit coach profile",
    description: "Update coach profile details and coaching preferences.",
    applicablePersonas: ["coach", "admin"],
    dependencies: ["view_coach_profile"],
    systemCritical: false,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "create_household",
    label: "Create household",
    description: "Create a new household and become its parent administrator.",
    applicablePersonas: ["parent", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: false,
  },
  {
    key: "manage_household",
    label: "Manage household",
    description: "Manage household members, statuses, and household-level access.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["view_household_admin"],
    systemCritical: true,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_household_admin",
    label: "View household administration",
    description: "Open the household administration workspace.",
    applicablePersonas: ["parent", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "invite_student",
    label: "Invite student",
    description: "Invite a student into the household.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["manage_household"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "invite_coach",
    label: "Invite coach",
    description: "Invite a coach into the household context.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["manage_household"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "approve_household_join_request",
    label: "Approve household join request",
    description: "Approve or deny a student or coach request to join the household.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["manage_household"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "request_household_access",
    label: "Request household access",
    description: "Submit a household access request when no invitation exists.",
    applicablePersonas: ["student", "coach", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { student: true, coach: true, admin: true },
    adminChangeable: false,
  },
  {
    key: "accept_household_invitation",
    label: "Accept household invitation",
    description: "Accept a pending household invitation.",
    applicablePersonas: ["student", "coach", "parent", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { student: true, coach: true, parent: true, admin: true },
    adminChangeable: false,
  },
  {
    key: "view_documents",
    label: "View documents",
    description: "Review uploaded transcripts, resumes, and supporting files.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "upload_documents",
    label: "Upload documents",
    description: "Upload transcripts, resumes, PDFs, and supporting files.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_documents"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_academic_evidence",
    label: "View academic evidence",
    description: "See academic evidence, degree requirements, and curriculum state.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "edit_academic_evidence",
    label: "Edit academic evidence",
    description: "Change academic evidence selections and requirement sources.",
    applicablePersonas: ["student", "parent", "admin"],
    dependencies: ["view_academic_evidence"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "upload_degree_requirements_pdf",
    label: "Upload degree requirements PDF",
    description: "Upload a program PDF when automated requirement discovery fails.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_academic_evidence", "upload_documents"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "verify_curriculum",
    label: "Verify curriculum",
    description: "Mark curriculum requirements as visually inspected and verified.",
    applicablePersonas: ["student", "parent", "admin"],
    dependencies: ["view_academic_evidence"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "coach_review_curriculum",
    label: "Coach review curriculum",
    description: "Review curriculum coverage and coach-side academic evidence notes.",
    applicablePersonas: ["coach", "admin"],
    dependencies: ["view_academic_evidence", "view_coach_dashboard"],
    systemCritical: false,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_scoring",
    label: "View scoring",
    description: "View readiness scoring and explanations.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "run_scoring",
    label: "Run scoring",
    description: "Run or refresh readiness scoring.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_scoring"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_recommendations",
    label: "View recommendations",
    description: "See recommendations, action items, and follow-up guidance.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "edit_recommendations",
    label: "Edit recommendations",
    description: "Create or modify recommendations and follow-up actions.",
    applicablePersonas: ["coach", "admin"],
    dependencies: ["view_recommendations", "view_coach_dashboard"],
    systemCritical: false,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_communication",
    label: "View communication",
    description: "Open communication history and role-aware messaging surfaces.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_profile_parent_edit",
    label: "Edit parent communication profile",
    description: "Answer parent communication prompts, update parent insight notes, and manage parent-side visibility choices.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["view_communication"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_profile_student_edit",
    label: "Edit student communication profile",
    description: "Answer student communication prompts, update tone preferences, and manage student-side visibility choices.",
    applicablePersonas: ["student", "admin"],
    dependencies: ["view_communication"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_translate_parent_to_student",
    label: "Translate parent to student",
    description: "Turn a parent message or concern into student-facing language with lower-friction framing.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["view_communication", "use_chatbot"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_translate_student_to_parent",
    label: "Translate student to parent",
    description: "Turn a student concern or update into parent-readable language with empathy and clarity.",
    applicablePersonas: ["student", "admin"],
    dependencies: ["view_communication", "use_chatbot"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_feedback_submit",
    label: "Submit communication feedback",
    description: "Rate translation quality and provide feedback that can improve future communication guidance.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_communication"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_summary_view",
    label: "View communication summary",
    description: "See communication completion, recent translation activity, and shared summaries.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_communication"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_coach_context_view",
    label: "View coach communication context",
    description: "See authorized communication summaries and friction-reduction guidance for the selected student.",
    applicablePersonas: ["coach", "admin"],
    dependencies: ["view_communication", "communication_summary_view"],
    systemCritical: false,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "communication_admin_manage",
    label: "Manage communication administration",
    description: "Review communication settings, scoped records, and feature administration controls.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["view_communication", "manage_household"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "use_chatbot",
    label: "Use chatbot",
    description: "Use the chatbot and communication assistant features.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_communication"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_career_goals",
    label: "View Career Goals",
    description: "Open saved Career Goals and comparison views.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "create_career_goals",
    label: "Create Career Goals",
    description: "Create new Career Goals.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_career_goals"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "edit_career_goals",
    label: "Edit Career Goals",
    description: "Edit existing Career Goals and change assumptions.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_career_goals"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "delete_career_goals",
    label: "Delete Career Goals",
    description: "Archive or delete saved Career Goals.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_career_goals"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "analyze_career_goals",
    label: "Analyze Career Goals",
    description: "Run or refresh Career Goal analysis and scenario comparison snapshots.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: ["view_career_goals", "view_scoring"],
    systemCritical: false,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "manage_coach_notes",
    label: "Manage coach notes",
    description: "Create coach notes, findings, recommendations, and outbound drafts.",
    applicablePersonas: ["coach", "admin"],
    dependencies: ["view_coach_dashboard"],
    systemCritical: false,
    defaultEnabledByPersona: { coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_parent_brief",
    label: "View parent brief",
    description: "View parent-facing briefs and coach summaries.",
    applicablePersonas: ["parent", "coach", "admin"],
    dependencies: [],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "view_student_information",
    label: "View student information",
    description: "View student-centric data across dashboards, outcomes, and evidence.",
    applicablePersonas: ["student", "parent", "coach", "admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { student: true, parent: true, coach: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "manage_users",
    label: "Manage users",
    description: "Manage user accounts within the visible household or system scope.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["view_household_admin"],
    systemCritical: false,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: true,
  },
  {
    key: "manage_permissions",
    label: "Manage permissions",
    description: "Grant or deny capability overrides for users.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["manage_users"],
    systemCritical: true,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: false,
  },
  {
    key: "manage_roles",
    label: "Manage roles",
    description: "Change the primary persona assigned to a user.",
    applicablePersonas: ["parent", "admin"],
    dependencies: ["manage_users"],
    systemCritical: true,
    defaultEnabledByPersona: { parent: true, admin: true },
    adminChangeable: false,
  },
  {
    key: "manage_system_settings",
    label: "Manage system settings",
    description: "Manage platform-wide settings reserved for administrators.",
    applicablePersonas: ["admin"],
    dependencies: ["access_admin_console"],
    systemCritical: true,
    defaultEnabledByPersona: { admin: true },
    adminChangeable: false,
  },
  {
    key: "access_admin_console",
    label: "Access admin console",
    description: "Open the administrator console and cross-household management views.",
    applicablePersonas: ["admin"],
    dependencies: [],
    systemCritical: true,
    defaultEnabledByPersona: { admin: true },
    adminChangeable: false,
  },
] as const;

export const CAPABILITY_BY_KEY = new Map(
  CAPABILITY_CATALOG.map((capability) => [capability.key, capability] as const)
);

export function getCapabilityDefinition(key: CapabilityKey): CapabilityDefinition {
  const definition = CAPABILITY_BY_KEY.get(key);
  if (!definition) {
    throw new Error(`Unknown capability: ${key}`);
  }
  return definition;
}

export function getPersonaDefaultCapabilities(persona: Persona): CapabilityKey[] {
  return CAPABILITY_CATALOG.filter((capability) => capability.defaultEnabledByPersona[persona]).map(
    (capability) => capability.key
  );
}

export function expandCapabilitiesWithDependencies(input: Iterable<CapabilityKey>): CapabilityKey[] {
  const enabled = new Set<CapabilityKey>();
  const queue = Array.from(input);

  while (queue.length) {
    const key = queue.shift();
    if (!key || enabled.has(key)) {
      continue;
    }

    enabled.add(key);
    const definition = getCapabilityDefinition(key);
    for (const dependency of definition.dependencies) {
      if (!enabled.has(dependency)) {
        queue.push(dependency);
      }
    }
  }

  return Array.from(enabled);
}

export function validateCapabilityCatalog() {
  for (const capability of CAPABILITY_CATALOG) {
    for (const dependency of capability.dependencies) {
      if (!CAPABILITY_BY_KEY.has(dependency)) {
        throw new Error(`Capability ${capability.key} depends on unknown capability ${dependency}`);
      }
    }
  }
}

export function capabilityAppliesToPersona(capability: CapabilityKey, persona: Persona) {
  return getCapabilityDefinition(capability).applicablePersonas.includes(persona);
}
