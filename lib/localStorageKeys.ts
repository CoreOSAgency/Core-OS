// Shared localStorage keys — kept in one file so DashboardShell and the
// full-page agent chat route (separate module trees) don't import each
// other just to reach a string constant.
export const ACTIVE_PROJECT_KEY = "coreos_active_project_id";
export const LAST_AGENT_KEY = "coreos_last_agent_id";
