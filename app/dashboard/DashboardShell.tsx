"use client";

import { useEffect, useState } from "react";
import type { Agent } from "@/lib/agents";
import type { Project } from "@/lib/projects";
import { signOut } from "../logout/actions";
import AgentGrid from "./AgentGrid";
import ChatPanel from "./ChatPanel";
import ProjectMemoryPanel from "./ProjectMemoryPanel";

const ACTIVE_PROJECT_KEY = "coreos_active_project_id";

export default function DashboardShell({ userEmail }: { userEmail: string }) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newWebsiteUrl, setNewWebsiteUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Record<string, string> | null>(
    null
  );
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(ACTIVE_PROJECT_KEY);
    } catch {
      // localStorage unavailable — fall back to picking the first project
    }

    fetch("/api/projects")
      .then((res) => res.json())
      .then((data: { projects?: Project[] }) => {
        const list = data.projects ?? [];
        setProjects(list);
        const validStored = list.find((p) => p.id === stored);
        setActiveProjectId(validStored?.id ?? list[0]?.id ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  function setActiveProject(id: string) {
    setActiveProjectId(id);
    setSelectorOpen(false);
    try {
      localStorage.setItem(ACTIVE_PROJECT_KEY, id);
    } catch {
      // per-browser convenience only — fine if this silently fails
    }
  }

  async function createProject(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;

    const res = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, description: newDescription.trim() || undefined }),
    });
    const data = await res.json();
    if (!res.ok || !data.project) return;

    setProjects((prev) => [...prev, data.project]);
    setActiveProject(data.project.id);
    setCreating(false);

    const websiteUrl = newWebsiteUrl.trim();
    setNewName("");
    setNewDescription("");
    setNewWebsiteUrl("");

    if (websiteUrl) {
      await importFromWebsite(data.project.id, websiteUrl);
    }
  }

  async function importFromWebsite(projectId: string, url: string) {
    setImporting(true);
    setImportPreview(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url, projectId }),
      });
      const data = await res.json();
      if (res.ok && data.extracted) setImportPreview(data.extracted);
    } finally {
      setImporting(false);
    }
  }

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  return (
    <main className="min-h-screen bg-neutral-950">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-6 py-4 sm:px-10">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-lg font-semibold text-neutral-100">CoreOS</h1>
            <p className="text-xs text-neutral-500">{userEmail}</p>
          </div>

          {!loading && projects.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setSelectorOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 hover:bg-neutral-800"
              >
                📁 {activeProject?.name ?? "Select project"}
                <span className="text-neutral-500">▾</span>
              </button>

              {selectorOpen && (
                <div className="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-neutral-800 bg-neutral-900 shadow-xl">
                  <ul className="max-h-64 overflow-y-auto py-1">
                    {projects.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setActiveProject(p.id)}
                          className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-neutral-800 ${
                            p.id === activeProjectId
                              ? "text-emerald-400"
                              : "text-neutral-200"
                          }`}
                        >
                          {p.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-neutral-800 p-1">
                    <button
                      onClick={() => {
                        setSelectorOpen(false);
                        setCreating(true);
                      }}
                      className="block w-full rounded px-3 py-2 text-left text-sm text-emerald-400 hover:bg-neutral-800"
                    >
                      + New project
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {activeProjectId && (
            <button
              onClick={() => setMemoryOpen(true)}
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              Project Memory
            </button>
          )}
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-neutral-800 px-3 py-1.5 text-sm text-neutral-300 hover:bg-neutral-900"
            >
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="px-6 py-8 sm:px-10">
        {importing && (
          <p className="mb-4 text-sm text-neutral-400">Importing from website…</p>
        )}
        {importPreview && (
          <div className="mb-6 rounded-xl border border-emerald-800 bg-emerald-950/30 p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-emerald-400">
                Imported from website
              </h3>
              <button
                onClick={() => setImportPreview(null)}
                className="text-xs text-neutral-400 hover:text-neutral-200"
              >
                Dismiss
              </button>
            </div>
            <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
              {Object.entries(importPreview)
                .filter(([, value]) => value)
                .map(([key, value]) => (
                  <div key={key}>
                    <dt className="text-xs uppercase tracking-wide text-neutral-500">
                      {key}
                    </dt>
                    <dd className="truncate text-neutral-200">{value}</dd>
                  </div>
                ))}
            </dl>
          </div>
        )}

        {loading ? (
          <p className="text-sm text-neutral-500">Loading…</p>
        ) : !activeProjectId || creating ? (
          <div className="mx-auto max-w-sm rounded-xl border border-neutral-800 bg-neutral-900/60 p-6">
            <h2 className="font-semibold text-neutral-100">
              {projects.length === 0 ? "Create your first project" : "New project"}
            </h2>
            <p className="mt-1 text-sm text-neutral-500">
              Agents remember what you tell them per project.
            </p>
            <form onSubmit={createProject} className="mt-4 space-y-3">
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Project name"
                required
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
              />
              <textarea
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Description (optional)"
                rows={2}
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
              />
              <input
                value={newWebsiteUrl}
                onChange={(e) => setNewWebsiteUrl(e.target.value)}
                placeholder="Website URL (optional) — import brand, offer, tagline"
                type="text"
                className="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-emerald-500"
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-medium text-neutral-950 hover:bg-emerald-400"
                >
                  Create project
                </button>
                {projects.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="rounded-lg border border-neutral-800 px-4 py-2 text-sm text-neutral-300 hover:bg-neutral-900"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        ) : (
          <AgentGrid onSelect={setSelectedAgent} />
        )}
      </div>

      <ChatPanel
        agent={selectedAgent}
        projectId={activeProjectId}
        projectName={activeProject?.name ?? null}
        onClose={() => setSelectedAgent(null)}
      />

      {memoryOpen && activeProjectId && (
        <ProjectMemoryPanel
          projectId={activeProjectId}
          projectName={activeProject?.name ?? ""}
          onImport={(url) => importFromWebsite(activeProjectId, url)}
          onClose={() => setMemoryOpen(false)}
        />
      )}
    </main>
  );
}
