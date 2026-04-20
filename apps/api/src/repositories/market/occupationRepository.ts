import { query } from "../../db/client";

export interface OccupationClusterRecord {
  occupationClusterId: string;
  canonicalName: string;
  onetCode?: string;
  description?: string;
  jobZone?: number;
  typicalEntryTitles?: string[];
  geographySensitivity?: "low" | "medium" | "high";
  aiExposureLevel?: "low" | "medium" | "high";
  underemploymentRiskLevel?: "low" | "medium" | "high";
  overallMarketTemperature?: "cool" | "mixed" | "warm" | "hot";
}

export interface OccupationSkillRequirementRecord {
  occupationSkillRequirementId: string;
  occupationClusterId: string;
  skillName: string;
  skillCategory:
    | "technical"
    | "analytical"
    | "communication"
    | "operational"
    | "interpersonal"
    | "creative"
    | "managerial"
    | "ai_fluency";
  importanceScore: number;
  requiredProficiencyBand: "basic" | "intermediate" | "advanced";
  evidenceSource?: string;
}

export interface MarketSignalRecord {
  marketSignalId: string;
  occupationClusterId?: string;
  geographyCode?: string;
  signalType:
    | "wage"
    | "demand_growth"
    | "unemployment_pressure"
    | "openings_trend"
    | "internship_availability"
    | "ai_disruption_signal"
    | "hiring_slowdown";
  signalValue?: number;
  signalDirection?: "rising" | "falling" | "stable";
  sourceName: string;
  effectiveDate: string;
  confidenceLevel?: "low" | "medium" | "high";
}

export interface OccupationMappingDiagnosticRecord {
  canonicalName: string;
  onetCode: string | null;
  description: string | null;
  jobZone: number | null;
  skillCount: number;
  topSkills: string[];
}

export class OccupationRepository {
  async deleteSkillRequirementsForOccupationCluster(occupationClusterId: string): Promise<void> {
    await query(
      `
      delete from occupation_skill_requirements
      where occupation_cluster_id = $1
      `,
      [occupationClusterId]
    );
  }

  async upsertOccupationCluster(record: OccupationClusterRecord): Promise<void> {
    await query(
      `
      insert into occupation_clusters (
        occupation_cluster_id,
        canonical_name,
        onet_code,
        description,
        job_zone,
        typical_entry_titles,
        geography_sensitivity,
        ai_exposure_level,
        underemployment_risk_level,
        overall_market_temperature,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
      on conflict (occupation_cluster_id) do update set
        canonical_name = excluded.canonical_name,
        onet_code = excluded.onet_code,
        description = excluded.description,
        job_zone = excluded.job_zone,
        typical_entry_titles = excluded.typical_entry_titles,
        geography_sensitivity = excluded.geography_sensitivity,
        ai_exposure_level = excluded.ai_exposure_level,
        underemployment_risk_level = excluded.underemployment_risk_level,
        overall_market_temperature = excluded.overall_market_temperature,
        updated_at = now()
      `,
      [
        record.occupationClusterId,
        record.canonicalName,
        record.onetCode ?? null,
        record.description ?? null,
        record.jobZone ?? null,
        record.typicalEntryTitles ?? [],
        record.geographySensitivity ?? null,
        record.aiExposureLevel ?? null,
        record.underemploymentRiskLevel ?? null,
        record.overallMarketTemperature ?? null,
      ]
    );
  }

  async upsertOccupationSkillRequirement(record: OccupationSkillRequirementRecord): Promise<void> {
    await query(
      `
      insert into occupation_skill_requirements (
        occupation_skill_requirement_id,
        occupation_cluster_id,
        skill_name,
        skill_category,
        importance_score,
        required_proficiency_band,
        evidence_source,
        updated_at
      ) values ($1,$2,$3,$4,$5,$6,$7,now())
      on conflict (occupation_cluster_id, skill_name) do update set
        skill_category = excluded.skill_category,
        importance_score = excluded.importance_score,
        required_proficiency_band = excluded.required_proficiency_band,
        evidence_source = excluded.evidence_source,
        updated_at = now()
      `,
      [
        record.occupationSkillRequirementId,
        record.occupationClusterId,
        record.skillName,
        record.skillCategory,
        record.importanceScore,
        record.requiredProficiencyBand,
        record.evidenceSource ?? null,
      ]
    );
  }

  async upsertMarketSignal(record: MarketSignalRecord): Promise<void> {
    await query(
      `
      insert into market_signals (
        market_signal_id,
        occupation_cluster_id,
        geography_code,
        signal_type,
        signal_value,
        signal_direction,
        source_name,
        effective_date,
        confidence_level
      ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      on conflict (market_signal_id) do update set
        occupation_cluster_id = excluded.occupation_cluster_id,
        geography_code = excluded.geography_code,
        signal_type = excluded.signal_type,
        signal_value = excluded.signal_value,
        signal_direction = excluded.signal_direction,
        source_name = excluded.source_name,
        effective_date = excluded.effective_date,
        confidence_level = excluded.confidence_level
      `,
      [
        record.marketSignalId,
        record.occupationClusterId ?? null,
        record.geographyCode ?? null,
        record.signalType,
        record.signalValue ?? null,
        record.signalDirection ?? null,
        record.sourceName,
        record.effectiveDate,
        record.confidenceLevel ?? null,
      ]
    );
  }

  async listOccupationMappingDiagnostics(): Promise<OccupationMappingDiagnosticRecord[]> {
    const result = await query<{
      canonical_name: string;
      onet_code: string | null;
      description: string | null;
      job_zone: number | null;
      skill_count: string | number;
      top_skills: string[] | null;
    }>(
      `
      select
        oc.canonical_name,
        oc.onet_code,
        oc.description,
        oc.job_zone,
        count(osr.occupation_skill_requirement_id)::int as skill_count,
        coalesce(
          array_agg(osr.skill_name order by osr.importance_score desc)
            filter (where osr.skill_name is not null),
          '{}'
        ) as top_skills
      from occupation_clusters oc
      left join occupation_skill_requirements osr
        on osr.occupation_cluster_id = oc.occupation_cluster_id
      group by
        oc.canonical_name,
        oc.onet_code,
        oc.description,
        oc.job_zone
      order by oc.canonical_name asc
      `
    );

    return result.rows.map((row) => ({
      canonicalName: row.canonical_name,
      onetCode: row.onet_code,
      description: row.description,
      jobZone: row.job_zone,
      skillCount: Number(row.skill_count) || 0,
      topSkills: (row.top_skills || []).slice(0, 5),
    }));
  }
}
