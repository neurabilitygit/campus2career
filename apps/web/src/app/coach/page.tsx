"use client";
import { Suspense } from "react";
import CoachDashboardView from "../../components/dashboards/CoachDashboardView";
export default function CoachDashboardPage() {
  return (
    <Suspense fallback={null}>
      <CoachDashboardView />
    </Suspense>
  );
}
