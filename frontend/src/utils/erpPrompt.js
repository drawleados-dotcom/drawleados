// ERP task "Prompt" breadcrumb: Project > User > Page > [Sub Tab] > [Ultra Sub
// Tab] > [Ultra Tab] > "Task Name" — each bracketed level only shows once a
// task is actually tagged that deep into the ERP Users hierarchy (most tasks
// stop at Page). Shared between OurTasksPage (My Tasks / Assign to Team) and
// ProjectErpUsersTab (the per-project ERP Users tab) so both render the same
// breadcrumb for the same task.
export const buildErpPrompt = ({ projectName, userName, pageName, subTabName, ultraSubTabName, ultraTabName, ultraTabProName, taskName }) => {
  const parts = [projectName, userName, pageName, subTabName, ultraSubTabName, ultraTabName, ultraTabProName].filter(Boolean);
  return `${parts.join(' > ')}${parts.length ? ' > ' : ''}"${taskName || ''}"`;
};
