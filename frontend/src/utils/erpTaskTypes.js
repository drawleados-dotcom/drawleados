// Shared "Type" options for a Task tagged to the ERP hierarchy — used by every
// place a task's erp_task_type gets set (OurTasksPage's Add/Edit Task modal,
// the Project's own Tasks tab, and the ERP Users tab's quick Add Task popup)
// so they never drift out of sync.
export const ERP_TASK_TYPE_OPTIONS = [
  'WorkFlow Creation',
  'WorkFlow Bug',
  'Bug',
  'UI Change',
  'Mobile Responsive',
  'Testing',
  'New Feature',
];
