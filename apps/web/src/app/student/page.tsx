"use client";
import { Suspense } from "react";
import StudentDashboardView from "../../components/dashboards/StudentDashboardView";
export default function StudentDashboardPage() {
  return (
    <Suspense fallback={null}>
      <StudentDashboardView />
    </Suspense>
  );
}
