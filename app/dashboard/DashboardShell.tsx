"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { findAgent, type Agent } from "@/lib/agents";
import type { Project } from "@/lib/projects";
import { extractDriveFolderId } from "@/lib/googleDrive";
import { ACTIVE_PROJECT_KEY, LAST_AGENT_KEY } from "@/lib/localStorageKeys";
import AgencyIntegrations from "./settings/integrations/page";
import AgencySettings from "./settings/organization/page";
import AgencyMedia from "./AgencyMedia";
import AgencyOverview from "./AgencyOverview";
import AgentGrid from "./AgentGrid";
import ClientsView from "./ClientsView";
import { DomainsSettingsBody } from "./settings/domains/DomainsSettingsBody";
import ChatPanel from "./ChatPanel";
import CorePanel from "./CorePanel";
import IconSidebar, { type IconSection } from "./IconSidebar";
import OnboardingWizard from "./OnboardingWizard";
import ProjectMemoryPanel from "./ProjectMemoryPanel";
import SecondaryNav, { type AgencySubView } from "./SecondaryNav";

type Section = Exclude<IconSection, "workflows" | "settings">;

export default function DashboardShell({
  userEmail,
  avatarUrl,
}: {
  userEmail: string;
  avatarUrl?: string | null;
}) {
  const router = useRouter();
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
  const [importPreview, setImportPreview] = useState<Record<string, string> | null>(null);
  const [memoryOpen, setMemoryOpen] = useState(false);
  const [driveConnected, setDriveConnected] = useState(false);
  const [integrationBanner, setIntegrationBanner] = useState<string | null>(null);

  const [section, setSection] = useState<Section>("dashboard");
  const [agencySubView, setAgencySubView] = useState<AgencySubView>("overview");
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [lastAgent, setLastAgent] = useState<Agent | null>(null);

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

  // Other routes (settings, workflows, the agent chat page) send you back
  // here via ?view=<section> since those sections live in client state, not
  // their own routes.
  useEffect(() => {
    const view = searchParams.get("view");
    if (view === "agency" || view === "clients" || view === "files" || view === "domains") {
      setSection(view);
    }
  }, [searchParams]);

  useEffect(() => {
    try {
      const id = localStorage.getItem(LAST_AGENT_KEY);
      if (id) setLastAgent(findAgent(id));
    } catch {
      // per-browser convenience only
    }
  }, []);

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

  function onNavigate(next: IconSection) {
    if (next === "workflows") return router.push("/dashboard/workflows");
    if (next === "settings") return router.push("/dashboard/settings/organization");
    setActiveTool(null);
    setSection(next);
  }

  function selectAgent(agent: Agent) {
    try {
      localStorage.setItem(LAST_AGENT_KEY, agent.id);
    } catch {
      // per-browser convenience only
    }
    router.push(`/dashboard/agency/${agent.id}`);
  }

  function clearLastAgent() {
    setLastAgent(null);
    try {
      localStorage.removeItem(LAST_AGENT_KEY);
    } catch {
      // per-browser convenience only
    }
  }

  const hasProject = !loading && !!activeProjectId && !creating;

  return (
    <div className="flex h-screen bg-core-main">
      <IconSidebar active={section} onNavigate={onNavigate} userEmail={userEmail} avatarUrl={avatarUrl} />
      <SecondaryNav
        section={section}
        agencySubView={agencySubView}
        onAgencySubView={(v) => {
          setActiveTool(null);
          setAgencySubView(v);
        }}
        selectedAgentId={lastAgent?.id ?? null}
        onSelectAgent={selectAgent}
        onToolClick={setActiveTool}
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
                            className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5 ${
                              p.id === activeProjectId ? "text-core-purple" : "text-neutral-200"
                            }`}
                          >
                            <span className="truncate">{p.name}</span>
                            <span className="shrink-0 text-[10px] uppercase tracking-wide text-neutral-500">
                              {p.status}
                            </span>
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
          {importing && <p className="mb-4 text-sm text-neutral-400">Importing from website…</p>}
          {importPreview && (
            <div className="mb-6 rounded-xl border border-core-purple/40 bg-core-purple/10 p-4">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-core-purple">Imported from website</h3>
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
                      <dt className="text-xs uppercase tracking-wide text-neutral-500">{key}</dt>
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
              <p className="mt-1 text-sm text-neutral-500">Agents remember what you tell them per project.</p>
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
          ) : section === "dashboard" ? (
            <AgentGrid onSelect={selectAgent} />
          ) : section === "agency" ? (
            activeTool ? (
              <div className="rounded-xl border border-dashed border-white/10 bg-core-card/50 p-10 text-center">
                <div className="mb-2 text-2xl">🛠️</div>
                <h3 className="font-medium text-neutral-200">{activeTool} isn&apos;t wired up yet</h3>
                <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                  This tool is on the roadmap but has no working page behind it yet.
                </p>
                <button
                  onClick={() => setActiveTool(null)}
                  className="mt-4 rounded-lg border border-white/10 px-3 py-1.5 text-sm text-neutral-300 hover:bg-white/5"
                >
                  Back to Overview
                </button>
              </div>
            ) : agencySubView === "overview" ? (
              <AgencyOverview projectId={activeProjectId} projectName={activeProject?.name ?? ""} />
            ) : agencySubView === "integrations" ? (
              <AgencyIntegrations />
            ) : agencySubView === "media" ? (
              <AgencyMedia />
            ) : (
              <AgencySettings />
            )
          ) : section === "clients" ? (
            <ClientsView
              projects={projects}
              activeProjectId={activeProjectId}
              onOpen={(id) => {
                setActiveProject(id);
                setSection("dashboard");
              }}
            />
          ) : section === "files" ? (
            <div className="rounded-xl border border-dashed border-white/10 bg-core-card/50 p-10 text-center">
              <div className="mb-2 text-2xl">📁</div>
              <h3 className="font-medium text-neutral-200">File manager isn&apos;t built yet</h3>
              <p className="mx-auto mt-1 max-w-sm text-sm text-neutral-500">
                Generated documents download directly or save to Google Drive — there&apos;s no file
                storage inside CoreOS yet.
              </p>
            </div>
          ) : (
            <div className="mx-auto max-w-3xl">
              <DomainsSettingsBody />
            </div>
          )}
        </div>
      </main>

      {hasProject && section === "dashboard" && (
        <CorePanel
          projectId={activeProjectId}
          projectName={activeProject?.name ?? null}
          driveConnected={driveConnected}
        />
      )}

      {hasProject && section === "agency" && agencySubView === "overview" ? (
        lastAgent ? (
          <ChatPanel
            agent={lastAgent}
            projectId={activeProjectId}
            projectName={activeProject?.name ?? null}
            driveConnected={driveConnected}
            onClose={clearLastAgent}
          />
        ) : (
          <aside className="flex h-full w-[380px] max-w-full shrink-0 flex-col items-center justify-center gap-2 border-l border-white/10 bg-core-nav px-6 text-center">
            <span className="text-2xl">💬</span>
            <p className="text-sm text-neutral-500">
              Select an agent from the sidebar to chat alongside Agency Overview.
            </p>
          </aside>
        )
      ) : null}

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
