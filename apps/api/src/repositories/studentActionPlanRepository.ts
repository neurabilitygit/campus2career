import crypto from "node:crypto";
import { executeQuery, type DbExecutor, query, withTransaction } from "../db/client";
import type { StudentActionPlanDecision } from "../../../../packages/shared/src/contracts/actionPlan";

type ActionItemRow = {
  action_plan_id: string;
  generated_at: string;
  title: string;
  description: string | null;
  action_category: string | null;
  due_date: string | null;
  priority_level: number | null;
  status: "pending" | "in_progress" | "completed" | "skipped";
};

export type PersistedStudentActionPlanItem = {
  actionPlanId: string;
  generatedAt: string;
  title: string;
  planningNotes: string | null;
  actionCategory: string | null;
  nextStepDate: string | null;
  priorityLevel: number | null;
  decision: StudentActionPlanDecision;
};

function newId() {
  return crypto.randomUUID();
}

function decisionFromStatus(status: ActionItemRow["status"]): StudentActionPlanDecision {
  if (status === "skipped") return "ignore";
  if (status === "pending") return "explore";
  return "accept";
}

function statusFromDecision(decision: StudentActionPlanDecision): ActionItemRow["status"] {
  if (decision === "ignore") return "skipped";
  if (decision === "explore") return "pending";
  return "in_progress";
}

function startOfTodayIso() {
  return new Date().toISOString().slice(0, 10);
}

function plusDaysIso(days: number) {
  const value = new Date();
  value.setDate(value.getDate() + days);
  return value.toISOString().slice(0, 10);
}

function normalizeDateOnly(value: string | Date | null | undefined) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    return value.slice(0, 10);
  }

  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  const normalized = String(value);
  return normalized ? normalized.slice(0, 10) : null;
}

async function findLatestActivePlan(studentProfileId: string, executor?: DbExecutor) {
  const result = await executeQuery<{ action_plan_id: string }>(
    executor,
    `
    select action_plan_id
    from action_plans
    where student_profile_id = $1
      and plan_status in ('active', 'draft')
    order by case when plan_status = 'active' then 0 else 1 end, generated_at desc
    limit 1
    `,
    [studentProfileId]
  );

  return result.rows[0]?.action_plan_id || null;
}

async function ensureActivePlan(studentProfileId: string, executor: DbExecutor) {
  const existing = await findLatestActivePlan(studentProfileId, executor);
  if (existing) {
    return existing;
  }

  const actionPlanId = newId();
  await executeQuery(
    executor,
    `
    insert into action_plans (
      action_plan_id,
      student_profile_id,
      planning_period_start,
      planning_period_end,
      plan_status
    ) values ($1, $2, $3, $4, 'active')
    `,
    [actionPlanId, studentProfileId, startOfTodayIso(), plusDaysIso(90)]
  );

  return actionPlanId;
}

export async function listStudentActionPlanItems(studentProfileId: string): Promise<PersistedStudentActionPlanItem[]> {
  const result = await query<ActionItemRow>(
    `
    select
      ap.action_plan_id,
      ap.generated_at,
      ai.title,
      ai.description,
      ai.action_category,
      ai.due_date,
      ai.priority_level,
      ai.status
    from action_plans ap
    join action_items ai on ai.action_plan_id = ap.action_plan_id
    where ap.student_profile_id = $1
      and ap.plan_status in ('active', 'draft')
    order by case when ap.plan_status = 'active' then 0 else 1 end, ap.generated_at desc, ai.priority_level desc nulls last, ai.title asc
    `,
    [studentProfileId]
  );

  const seen = new Set<string>();
  const items: PersistedStudentActionPlanItem[] = [];

  for (const row of result.rows) {
    const key = row.title.trim().toLowerCase();
    if (!key || seen.has(key)) {
      continue;
    }
    seen.add(key);
    items.push({
      actionPlanId: row.action_plan_id,
      generatedAt: row.generated_at,
      title: row.title,
      planningNotes: row.description,
      actionCategory: row.action_category,
      nextStepDate: normalizeDateOnly(row.due_date),
      priorityLevel: row.priority_level,
      decision: decisionFromStatus(row.status),
    });
  }

  return items;
}

export async function saveStudentActionPlanItem(input: {
  studentProfileId: string;
  title: string;
  planningNotes: string | null;
  actionCategory: string | null;
  nextStepDate: string | null;
  priorityLevel: number | null;
  decision: StudentActionPlanDecision;
}) {
  await withTransaction(async (tx) => {
    const actionPlanId = await ensureActivePlan(input.studentProfileId, tx);
    const existing = await executeQuery<{ action_item_id: string }>(
      tx,
      `
      select action_item_id
      from action_items
      where action_plan_id = $1
        and lower(title) = lower($2)
      limit 1
      `,
      [actionPlanId, input.title]
    );

    const nextStatus = statusFromDecision(input.decision);

    if (existing.rows[0]?.action_item_id) {
      await executeQuery(
        tx,
        `
        update action_items
        set
          description = $2,
          action_category = $3,
          due_date = $4,
          priority_level = $5,
          status = $6,
          completion_date = case when $6 = 'completed' then now() else null end
        where action_item_id = $1
        `,
        [
          existing.rows[0].action_item_id,
          input.planningNotes,
          input.actionCategory,
          input.nextStepDate,
          input.priorityLevel,
          nextStatus,
        ]
      );
      return;
    }

    await executeQuery(
      tx,
      `
      insert into action_items (
        action_item_id,
        action_plan_id,
        title,
        description,
        action_category,
        due_date,
        priority_level,
        status
      ) values ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        newId(),
        actionPlanId,
        input.title,
        input.planningNotes,
        input.actionCategory,
        input.nextStepDate,
        input.priorityLevel,
        nextStatus,
      ]
    );
  });
}
