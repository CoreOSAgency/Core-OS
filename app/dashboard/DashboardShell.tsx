"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Agent } from "@/lib/agents";
import type { Project } from "@/lib/projects";
import { extractDriveFolderId } from "@/lib/googleDrive";
import AgencyOverview from "./AgencyOverview";
import AgentGrid from "./AgentGrid";
import ChatPanel from "./ChatPanel";
import IconSidebar from "./IconSidebar";
import OnboardingWizard from "./OnboardingWizard";
import ProjectMemoryPanel from "./ProjectMemoryPanel";
import SecondaryNav from "./SecondaryNav";

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
  const [newDriveFolderUrl, setNewDriveFolderUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState<Record<string, string> | null>(
    null
  );
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [integrationBanner, setIntegrationBanner] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const searchParams = useSearchParams();

  useEffect(() => {
    fetch("/api/integrations")
      .then((res) => res.json())
      .then((data: { googleDrive?: boolean }) => setDriveConnected(!!data.googleDrive));
  }, []);

  useEffect(() => {
    const status = searchParams.get("integration");
    if (status === "connected") setIntegrationBanner("✓ Google Drive connected");
    else if (status === "error") setIntegrationBanner("Couldn't connect Google Drive — try again.");
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("view") === "agency") setOverviewOpen(true);
  }, [searchParams]);

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
    const driveFolderId = extractDriveFolderId(newDriveFolderUrl);
    setNewName("");
    setNewDescription("");
    setNewWebsiteUrl("");
    setNewDriveFolderUrl("");

    if (websiteUrl) {
      await importFromWebsite(data.project.id, websiteUrl);
    }
    if (driveFolderId) {
      await fetch(`/api/projects/${data.project.id}/context`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entries: { google_drive_folder_id: driveFolderId } }),
      });
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

  function goDashboard() {
    setOverviewOpen(false);
    setSelectedAgent(null);
  }

  function toggleAgency() {
    setOverviewOpen((v) => !v);
    setSelectedAgent(null);
  }

  function selectAgent(agent: Agent) {
    setOverviewOpen(false);
    setSelectedAgent(agent);
  }

  return (
    <div className="flex h-screen bg-core-main">
      <IconSidebar
        onDashboard={goDashboard}
        onAgency={toggleAgency}
        agencyActive={overviewOpen}
        userEmail={userEmail}
      />
      <SecondaryNav
        selectedAgentId={selectedAgent?.id ?? null}
        onSelectAgent={selectAgent}
        overviewActive={overviewOpen}
        onOverview={toggleAgency}
      />

      <main className="min-h-0 flex-1 overflow-y-auto bg-core-main">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 px-6 py-4">
          <div className="relative">
            {!loading && projects.length > 0 && (
              <>
                <button
                  onClick={() => setSelectorOpen((v) => !v)}
                  className="flex items-center gap-2 rounded-lg border border-white/10 bg-core-card px-3 py-1.5 text-sm text-neutral-200 hover:bg-white/5"
                >
                  📁 {activeProject?.name ?? "Select project"}
                  <span className="text-neutral-500">▾</span>
                </button>

                {selectorOpen && (
                  <div className="absolute left-0 z-30 mt-2 w-64 rounded-lg border border-white/10 bg-core-card shadow-xl">
                    <ul className="max-h-64 overflow-y-auto py-1">
                      {projects.map((p) => (
                        <li key={p.id}>
                          <button
                            onClick={() => setActiveProject(p.id)}
                            className={`block w-full truncate px-3 py-2 text-left text-sm hover:bg-white/5 ${
                              p.id === activeProjectId
                                ? "text-core-purple"
                                : "text-neutral-200"
                            }`}
                          >
                            {p.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                    <div className="border-t border-white/10 p-1">
                      <button
                        onClick={() => {
                          setSelectorOpen(false);
                          setCreating(true);
                        }}
                        className="block w-full rounded px-3 py-2 text-left text-sm text-core-purple hover:bg-white/5"
                      >
                        + New project
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {activeProjectId && (
            <button
              onClick={() => setMemoryOpen(true)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5"
            >
              Project Memory
            </button>
          )}
        </header>

        <div className="px-6 py-8">
          {integrationBanner && (
            <div className="mb-4 flex items-center justify-between rounded-lg border border-white/10 bg-core-card px-4 py-2 text-sm text-neutral-300">
              {integrationBanner}
              <button
                onClick={() => setIntegrationBanner(null)}
                className="text-xs text-neutral-500 hover:text-neutral-200"
              >
                Dismiss
              </button>
            </div>
          )}
          {importing && (
            <p className="mb-4 text-sm text-neutral-400">Importing from website…</p>
          )}
          {importPreview && (
            <div className="mb-6 rounded-xl border border-core-purple/40 bg-core-purple/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-core-purple">
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
          ) : !activeProjectId && projects.length === 0 ? (
            <OnboardingWizard
              onComplete={(project) => {
                setProjects((prev) => [...prev, project]);
                setActiveProject(project.id);
              }}
            />
          ) : !activeProjectId || creating ? (
            <div className="mx-auto max-w-sm rounded-xl border border-white/10 bg-core-card p-6">
              <h2 className="font-semibold text-neutral-100">New project</h2>
              <p className="mt-1 text-sm text-neutral-500">
                Agents remember what you tell them per project.
              </p>
              <form onSubmit={createProject} className="mt-4 space-y-3">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Project name"
                  required
                  className="w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple"
                />
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Description (optional)"
                  rows={2}
                  className="w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple"
                />
                <input
                  value={newWebsiteUrl}
                  onChange={(e) => setNewWebsiteUrl(e.target.value)}
                  placeholder="Website URL (optional) — import brand, offer, tagline"
                  type="text"
                  className="w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple"
                />
                <input
                  value={newDriveFolderUrl}
                  onChange={(e) => setNewDriveFolderUrl(e.target.value)}
                  placeholder="Google Drive folder URL (optional) — save generated docs here"
                  type="text"
                  className="w-full rounded-lg border border-white/10 bg-core-main px-3 py-2 text-sm text-neutral-100 outline-none focus:border-core-purple"
                />
                <div className="flex gap-2">
                  <button
                    type="submit"
                    className="rounded-lg bg-core-purple px-4 py-2 text-sm font-medium text-white hover:bg-core-purple/80"
                  >
                    Create project
                  </button>
                  {projects.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setCreating(false)}
                      className="rounded-lg border border-white/10 px-4 py-2 text-sm text-neutral-300 hover:bg-white/5"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>
            </div>
          ) : overviewOpen ? (
            <AgencyOverview projectId={activeProjectId} projectName={activeProject?.name ?? ""} />
          ) : (
            <AgentGrid onSelect={selectAgent} />
          )}
        </div>
      </main>

      <ChatPanel
        agent={selectedAgent}
        projectId={activeProjectId}
        projectName={activeProject?.name ?? null}
        driveConnected={driveConnected}
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
    </div>
  );
}
