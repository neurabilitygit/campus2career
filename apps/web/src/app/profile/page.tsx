"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "../../components/layout/AppShell";
import { SectionCard } from "../../components/layout/SectionCard";
import { SessionGate } from "../../components/SessionGate";
import { FieldInfoLabel } from "../../components/forms/FieldInfoLabel";
import { useAuthContext } from "../../hooks/useAuthContext";
import { useApiData } from "../../hooks/useApiData";
import { apiFetch } from "../../lib/apiClient";
import type {
  CoachEditableProfile,
  ParentEditableProfile,
  ParentHouseholdMember,
  StudentEditableProfile,
} from "../../../../../packages/shared/src/contracts/profile";
import { neurodivergentCategoryOptions } from "../../../../../packages/shared/src/contracts/profile";
import { buildDirectAddressName } from "../../lib/personalization";
import { useSaveNavigation } from "../../lib/saveNavigation";

const inputStyle: React.CSSProperties = {
  width: "100%",
  borderRadius: 12,
  border: "1px solid #d0d8e8",
  padding: "12px 14px",
  fontSize: 15,
  background: "#ffffff",
};

const labelStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  fontWeight: 600,
  color: "#183153",
};

type ProfileResponse<T> = {
  ok: boolean;
  profile: T | null;
};

function commaSeparatedValues(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function StudentProfileEditor() {
  const saveNavigation = useSaveNavigation();
  const data = useApiData<ProfileResponse<StudentEditableProfile>>("/students/me/account-profile", true);
  const auth = useAuthContext();
  const [form, setForm] = useState({
    fullName: "",
    preferredName: "",
    age: "",
    gender: "",
    housingStatus: "",
    knownNeurodivergentCategories: [] as string[],
    otherNeurodivergentDescription: "",
    communicationPreferences: "",
    personalChoices: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = data.data?.profile;
    if (!profile) {
      return;
    }
    setForm({
      fullName: profile.fullName || "",
      preferredName: profile.preferredName || "",
      age: profile.age == null ? "" : String(profile.age),
      gender: profile.gender || "",
      housingStatus: profile.housingStatus || "",
      knownNeurodivergentCategories: profile.knownNeurodivergentCategories || [],
      otherNeurodivergentDescription: profile.otherNeurodivergentDescription || "",
      communicationPreferences: profile.communicationPreferences || "",
      personalChoices: profile.personalChoices || "",
    });
  }, [data.data?.profile]);

  const directName =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  async function save() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/students/me/account-profile", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          preferredName: form.preferredName || null,
          age: form.age ? Number(form.age) : null,
          gender: form.gender || null,
          housingStatus: form.housingStatus || null,
          knownNeurodivergentCategories: form.knownNeurodivergentCategories,
          otherNeurodivergentDescription: form.otherNeurodivergentDescription || null,
          communicationPreferences: form.communicationPreferences || null,
          personalChoices: form.personalChoices || null,
        }),
      });
      saveNavigation.returnAfterSave("/student");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save the profile.");
    }
  }

  return (
    <SectionCard
      title="Student profile"
      subtitle={`Update the personal details that help the platform address ${directName} more clearly. Sensitive fields stay optional.`}
    >
      {data.loading ? <p>Loading profile...</p> : null}
      {data.error ? <p style={{ color: "crimson" }}>{data.error}</p> : null}
      {!data.loading && !data.error ? (
        <div style={{ display: "grid", gap: 18 }}>
          <label style={labelStyle}>
            <FieldInfoLabel
              label="Full name"
              info="Use the full name that should appear on your account."
              example="Maya Rivera"
            />
            <input
              style={inputStyle}
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Preferred name"
              info="Use the name you want the app to use when speaking directly to you."
              example="Maya"
            />
            <input
              style={inputStyle}
              value={form.preferredName}
              onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))}
            />
          </label>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel
                label="Age"
                info="Optional. Add this only if you want it stored."
                example="20"
              />
              <input
                type="number"
                min={0}
                max={130}
                style={inputStyle}
                value={form.age}
                onChange={(event) => setForm((current) => ({ ...current, age: event.target.value }))}
              />
            </label>

            <label style={labelStyle}>
              <FieldInfoLabel
                label="Gender"
                info="Optional. Choose the closest fit or prefer not to say."
                example="Prefer not to say"
              />
              <select
                style={inputStyle}
                value={form.gender}
                onChange={(event) => setForm((current) => ({ ...current, gender: event.target.value }))}
              >
                <option value="">Optional</option>
                <option value="Woman">Woman</option>
                <option value="Man">Man</option>
                <option value="Nonbinary">Nonbinary</option>
                <option value="Self describe">Self describe</option>
                <option value="Prefer not to say">Prefer not to say</option>
              </select>
            </label>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Living situation or housing status"
              info="Optional context that may shape scheduling or support needs."
              example="On campus during the semester"
            />
            <input
              style={inputStyle}
              value={form.housingStatus}
              onChange={(event) => setForm((current) => ({ ...current, housingStatus: event.target.value }))}
            />
          </label>

          <div style={{ display: "grid", gap: 10 }}>
            <FieldInfoLabel
              label="Neurodivergent categories"
              info="Optional. Select any categories you want the system to keep in mind."
              example="ADHD"
            />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {neurodivergentCategoryOptions.map((option) => {
                const checked = form.knownNeurodivergentCategories.includes(option);
                return (
                  <label
                    key={option}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "12px 14px",
                      borderRadius: 14,
                      border: "1px solid #dbe4f0",
                      background: checked ? "#eef6ff" : "#fff",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          knownNeurodivergentCategories: checked
                            ? current.knownNeurodivergentCategories.filter((item) => item !== option)
                            : [...current.knownNeurodivergentCategories, option],
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Other neurodivergent context"
              info="Use this only if you chose Other and want to add a short note."
              example="Sensory processing differences"
            />
            <textarea
              rows={3}
              style={{ ...inputStyle, fontFamily: "inherit" }}
              value={form.otherNeurodivergentDescription}
              onChange={(event) =>
                setForm((current) => ({ ...current, otherNeurodivergentDescription: event.target.value }))
              }
            />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Communication preferences"
              info="Add any personal communication notes you want the platform to respect."
              example="Short checklists work better than long messages"
            />
            <textarea
              rows={4}
              style={{ ...inputStyle, fontFamily: "inherit" }}
              value={form.communicationPreferences}
              onChange={(event) => setForm((current) => ({ ...current, communicationPreferences: event.target.value }))}
            />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel
              label="Personal choices or preferences"
              info="Add any optional context that helps the system keep recommendations realistic."
              example="I prefer local internships during the school year"
            />
            <textarea
              rows={4}
              style={{ ...inputStyle, fontFamily: "inherit" }}
              value={form.personalChoices}
              onChange={(event) => setForm((current) => ({ ...current, personalChoices: event.target.value }))}
            />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <span style={{ color: "#166534", fontWeight: 700 }}>{status}</span> : null}
            {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ParentProfileEditor() {
  const saveNavigation = useSaveNavigation();
  const data = useApiData<ProfileResponse<ParentEditableProfile>>("/parents/me/profile", true);
  const [form, setForm] = useState({
    fullName: "",
    preferredName: "",
    familyUnitName: "",
    relationshipToStudent: "",
    householdMembers: [] as ParentHouseholdMember[],
    familyStructure: "",
    partnershipStructure: "",
    knownNeurodivergentCategories: [] as string[],
    demographicInformation: "",
    communicationPreferences: "",
    parentGoalsOrConcerns: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = data.data?.profile;
    if (!profile) {
      return;
    }
    setForm({
      fullName: profile.fullName || "",
      preferredName: profile.preferredName || "",
      familyUnitName: profile.familyUnitName || "",
      relationshipToStudent: profile.relationshipToStudent || "",
      householdMembers: profile.householdMembers || [],
      familyStructure: profile.familyStructure || "",
      partnershipStructure: profile.partnershipStructure || "",
      knownNeurodivergentCategories: profile.knownNeurodivergentCategories || [],
      demographicInformation: profile.demographicInformation || "",
      communicationPreferences: profile.communicationPreferences || "",
      parentGoalsOrConcerns: profile.parentGoalsOrConcerns || "",
    });
  }, [data.data?.profile]);

  async function save() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/parents/me/profile", {
        method: "POST",
        body: JSON.stringify(form),
      });
      saveNavigation.returnAfterSave("/parent");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save the profile.");
    }
  }

  return (
    <SectionCard
      title="Parent profile"
      subtitle="Update family context and communication preferences at your discretion. Sensitive details stay optional."
    >
      {data.loading ? <p>Loading profile...</p> : null}
      {data.error ? <p style={{ color: "crimson" }}>{data.error}</p> : null}
      {!data.loading && !data.error ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Full name" info="Use the full name that should appear on your account." example="Elena Rivera" />
              <input style={inputStyle} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Preferred name" info="Use the name you want the platform to use in direct messages." example="Elena" />
              <input style={inputStyle} value={form.preferredName} onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Family unit name" info="Optional label for the family context shown in your account." example="Rivera family" />
              <input style={inputStyle} value={form.familyUnitName} onChange={(event) => setForm((current) => ({ ...current, familyUnitName: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Relationship to the student" info="Optional. Describe how you relate to the student." example="Parent" />
              <input style={inputStyle} value={form.relationshipToStudent} onChange={(event) => setForm((current) => ({ ...current, relationshipToStudent: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <FieldInfoLabel
              label="Household members"
              info="Add any household members you want reflected in the family context."
              example="Jordan Rivera - Sibling"
            />
            {(form.householdMembers || []).map((member, index) => (
              <div key={`${member.name}-${index}`} style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 12 }}>
                <input
                  style={inputStyle}
                  placeholder="Name"
                  value={member.name}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      householdMembers: current.householdMembers.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, name: event.target.value } : item
                      ),
                    }))
                  }
                />
                <input
                  style={inputStyle}
                  placeholder="Relationship"
                  value={member.relationship || ""}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      householdMembers: current.householdMembers.map((item, itemIndex) =>
                        itemIndex === index ? { ...item, relationship: event.target.value } : item
                      ),
                    }))
                  }
                />
                <button
                  type="button"
                  className="ui-button ui-button--secondary"
                  onClick={() =>
                    setForm((current) => ({
                      ...current,
                      householdMembers: current.householdMembers.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                >
                  Remove
                </button>
              </div>
            ))}
            <div>
              <button
                type="button"
                className="ui-button ui-button--secondary"
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    householdMembers: [...current.householdMembers, { name: "", relationship: "" }],
                  }))
                }
              >
                Add household member
              </button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Family structure" info="Optional. Add only what feels useful." example="Two-household family" />
              <input style={inputStyle} value={form.familyStructure} onChange={(event) => setForm((current) => ({ ...current, familyStructure: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Partnership structure" info="Optional. Use your own words if you want to store this context." example="Married" />
              <input style={inputStyle} value={form.partnershipStructure} onChange={(event) => setForm((current) => ({ ...current, partnershipStructure: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gap: 10 }}>
            <FieldInfoLabel label="Known neurodivergent categories" info="Optional. Add only what you want stored." example="ADHD" />
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 10 }}>
              {neurodivergentCategoryOptions.map((option) => {
                const checked = form.knownNeurodivergentCategories.includes(option);
                return (
                  <label key={option} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 14, border: "1px solid #dbe4f0", background: checked ? "#f8f2ff" : "#fff" }}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        setForm((current) => ({
                          ...current,
                          knownNeurodivergentCategories: checked
                            ? current.knownNeurodivergentCategories.filter((item) => item !== option)
                            : [...current.knownNeurodivergentCategories, option],
                        }))
                      }
                    />
                    <span>{option}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel label="Demographic information" info="Optional. Add only what you want kept in the profile." example="Spanish-speaking household" />
            <textarea rows={3} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.demographicInformation} onChange={(event) => setForm((current) => ({ ...current, demographicInformation: event.target.value }))} />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel label="Communication preferences" info="Describe how you want family communication handled." example="Short summaries before detailed recommendations" />
            <textarea rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.communicationPreferences} onChange={(event) => setForm((current) => ({ ...current, communicationPreferences: event.target.value }))} />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel label="Parent goals or concerns" info="Capture the outcomes or concerns you want the system to keep in mind." example="Help Maya stay consistent without creating extra tension at home" />
            <textarea rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.parentGoalsOrConcerns} onChange={(event) => setForm((current) => ({ ...current, parentGoalsOrConcerns: event.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <span style={{ color: "#166534", fontWeight: 700 }}>{status}</span> : null}
            {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function CoachProfileEditor() {
  const saveNavigation = useSaveNavigation();
  const data = useApiData<ProfileResponse<CoachEditableProfile>>("/coaches/me/profile", true);
  const [form, setForm] = useState({
    fullName: "",
    preferredName: "",
    professionalTitle: "",
    organizationName: "",
    coachingSpecialties: "",
    communicationPreferences: "",
  });
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const profile = data.data?.profile;
    if (!profile) {
      return;
    }
    setForm({
      fullName: profile.fullName || "",
      preferredName: profile.preferredName || "",
      professionalTitle: profile.professionalTitle || "",
      organizationName: profile.organizationName || "",
      coachingSpecialties: (profile.coachingSpecialties || []).join(", "),
      communicationPreferences: profile.communicationPreferences || "",
    });
  }, [data.data?.profile]);

  async function save() {
    setStatus("");
    setError("");
    try {
      await apiFetch("/coaches/me/profile", {
        method: "POST",
        body: JSON.stringify({
          fullName: form.fullName,
          preferredName: form.preferredName || null,
          professionalTitle: form.professionalTitle || null,
          organizationName: form.organizationName || null,
          coachingSpecialties: commaSeparatedValues(form.coachingSpecialties),
          communicationPreferences: form.communicationPreferences || null,
        }),
      });
      saveNavigation.returnAfterSave("/coach");
    } catch (saveError: any) {
      setError(saveError?.message || "Could not save the profile.");
    }
  }

  return (
    <SectionCard
      title="Coach profile"
      subtitle="Keep your coaching identity and communication style current so coach-facing actions stay clearly attributed."
    >
      {data.loading ? <p>Loading profile...</p> : null}
      {data.error ? <p style={{ color: "crimson" }}>{data.error}</p> : null}
      {!data.loading && !data.error ? (
        <div style={{ display: "grid", gap: 18 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Full name" info="Use the full name that should appear in coach workflows." example="Taylor Brooks" />
              <input style={inputStyle} value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Preferred name" info="Use the name the platform can use in direct coach-facing language." example="Taylor" />
              <input style={inputStyle} value={form.preferredName} onChange={(event) => setForm((current) => ({ ...current, preferredName: event.target.value }))} />
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
            <label style={labelStyle}>
              <FieldInfoLabel label="Professional title" info="Optional title shown in coach workflows." example="Career Coach" />
              <input style={inputStyle} value={form.professionalTitle} onChange={(event) => setForm((current) => ({ ...current, professionalTitle: event.target.value }))} />
            </label>
            <label style={labelStyle}>
              <FieldInfoLabel label="Organization name" info="Optional organization or practice name." example="North Star Advising" />
              <input style={inputStyle} value={form.organizationName} onChange={(event) => setForm((current) => ({ ...current, organizationName: event.target.value }))} />
            </label>
          </div>

          <label style={labelStyle}>
            <FieldInfoLabel label="Coaching specialties" info="List specialties separated by commas." example="Internships, networking, interview prep" />
            <input style={inputStyle} value={form.coachingSpecialties} onChange={(event) => setForm((current) => ({ ...current, coachingSpecialties: event.target.value }))} />
          </label>

          <label style={labelStyle}>
            <FieldInfoLabel label="Communication preferences" info="Add any communication notes you want reflected in coach tools." example="Follow-up drafts should stay concise and concrete" />
            <textarea rows={4} style={{ ...inputStyle, fontFamily: "inherit" }} value={form.communicationPreferences} onChange={(event) => setForm((current) => ({ ...current, communicationPreferences: event.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="ui-button ui-button--primary" onClick={() => void save()}>
              Save profile
            </button>
            {status ? <span style={{ color: "#166534", fontWeight: 700 }}>{status}</span> : null}
            {error ? <span style={{ color: "crimson" }}>{error}</span> : null}
          </div>
        </div>
      ) : null}
    </SectionCard>
  );
}

function ProfileContent() {
  const auth = useAuthContext();
  const role = auth.data?.context?.authenticatedRoleType;
  const directName =
    buildDirectAddressName({
      preferredName: auth.data?.context?.authenticatedPreferredName,
      firstName: auth.data?.context?.authenticatedFirstName,
      lastName: auth.data?.context?.authenticatedLastName,
      fallback: "you",
    }) || "you";

  const subtitle = useMemo(() => {
    if (role === "student") {
      return `${directName}, update only the personal profile details you control. Academic path, scoring, and coach-only information stay separate.`;
    }
    if (role === "parent") {
      return `${directName}, keep family context and communication preferences current so parent-facing guidance stays clear and respectful.`;
    }
    if (role === "coach") {
      return `${directName}, keep your coaching identity current so recommendations, action items, and follow-up drafts stay clearly attributed.`;
    }
    return "Update the profile details available to your current account role.";
  }, [directName, role]);

  return (
    <AppShell title="Profile" subtitle={subtitle}>
      {role === "student" ? <StudentProfileEditor /> : null}
      {role === "parent" ? <ParentProfileEditor /> : null}
      {role === "coach" ? <CoachProfileEditor /> : null}
      {!role ? <SectionCard title="Profile"><p>We could not determine your account role yet.</p></SectionCard> : null}
    </AppShell>
  );
}

export default function ProfilePage() {
  return (
    <SessionGate fallbackTitle="Sign in required">
      <ProfileContent />
    </SessionGate>
  );
}
