"use client";

import { useEffect, useState } from "react";
import type { Project } from "@/lib/projects";

const ACTIVE_PROJECT_KEY = "coreos_active_project_id";

// Shared with DashboardShell — settings pages live outside that component's
// tree, so they resolve "the current project" the same way: last id picked,
// falling back to the first project the user has.
export function useActiveProject() {
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
    } catch {
      // per-browser convenience only
    }
    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: { projects?: Project[] }) => {
        const list = data.projects ?? [];
        setProject(list.find((p) => p.id === stored) ?? list[0] ?? null);
      })
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  return { project, loading, refresh };
}
