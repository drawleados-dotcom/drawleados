import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Plus, ChevronDown, ChevronRight, Link2, Calendar, Hash, Mail, Phone, Check, User, X,
  Trash2, Search, SlidersHorizontal, Database, Star, Copy, Edit3, ExternalLink,
  LayoutGrid, Table2, FolderPlus, MoreHorizontal, GripVertical
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Column type icons
const COLUMN_ICONS = {
  text: <span className="text-[#a1a1aa]">Aa</span>,
  number: <Hash className="h-4 w-4 text-[#a1a1aa]" />,
  select: <ChevronDown className="h-4 w-4 text-[#a1a1aa]" />,
  multi_select: <span className="text-[#a1a1aa]">⊞</span>,
  date: <Calendar className="h-4 w-4 text-[#a1a1aa]" />,
  url: <Link2 className="h-4 w-4 text-[#a1a1aa]" />,
  email: <Mail className="h-4 w-4 text-[#a1a1aa]" />,
  phone: <Phone className="h-4 w-4 text-[#a1a1aa]" />,
  checkbox: <Check className="h-4 w-4 text-[#a1a1aa]" />,
  person: <User className="h-4 w-4 text-[#a1a1aa]" />
};

const COLUMN_TYPES = [
  { type: 'text', name: 'Text' },
  { type: 'number', name: 'Number' },
  { type: 'select', name: 'Select' },
  { type: 'multi_select', name: 'Multi-select' },
  { type: 'date', name: 'Date' },
  { type: 'url', name: 'URL' },
  { type: 'email', name: 'Email' },
  { type: 'phone', name: 'Phone' },
  { type: 'checkbox', name: 'Checkbox' },
  { type: 'person', name: 'Person' }
];

export default function OperationsPage() {
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState(null);
  const [rows, setRows] = useState([]);
  const [projects, setProjects] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table', 'kanban', 'byProject'
  const [expandedProjects, setExpandedProjects] = useState({});
  
  // Context Menu
  const [contextMenu, setContextMenu] = useState({ show: false, x: 0, y: 0, database: null });
  const [renameModal, setRenameModal] = useState({ show: false, database: null, name: '' });
  
  // Delete Confirmation Modal
  const [deleteModal, setDeleteModal] = useState({ 
    show: false, 
    type: '', // 'database', 'project', 'task'
    item: null,
    confirmText: ''
  });
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    assignee: '',
    dateFrom: '',
    dateTo: ''
  });
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const loadDatabases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/notion/databases`, { headers });
      setDatabases(res.data);
      
      const params = new URLSearchParams(window.location.search);
      const dbId = params.get('db');
      
      if (dbId) {
        const found = res.data.find(d => d.database_id === dbId);
        if (found) {
          setSelectedDb(found);
          return;
        }
      }
      
      if (res.data.length > 0 && !selectedDb) {
        const firstPinned = res.data.find(d => d.is_pinned);
        setSelectedDb(firstPinned || res.data[0]);
      }
    } catch (error) {
      console.error('Error loading databases:', error);
    }
  }, [token]);

  const loadRows = useCallback(async () => {
    if (!selectedDb) return;
    try {
      const res = await axios.get(`${API}/api/notion/databases/${selectedDb.database_id}/rows`, { headers });
      setRows(res.data.rows || []);
    } catch (error) {
      console.error('Error loading rows:', error);
    }
  }, [selectedDb, token]);

  const loadProjects = useCallback(async () => {
    if (!selectedDb) return;
    try {
      const res = await axios.get(`${API}/api/notion/databases/${selectedDb.database_id}/projects`, { headers });
      setProjects(res.data || []);
      // Expand all projects by default
      const expanded = {};
      res.data.forEach(p => { expanded[p.project_id] = true; });
      setExpandedProjects(expanded);
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  }, [selectedDb, token]);

  const loadTemplates = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/notion/templates`, { headers });
      setTemplates(res.data);
    } catch (error) {
      console.error('Error loading templates:', error);
    }
  }, [token]);

  const loadUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/notion/users`, { headers });
      setUsers(res.data);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  }, [token]);

  useEffect(() => {
    loadDatabases();
    loadTemplates();
    loadUsers();
  }, [loadDatabases, loadTemplates, loadUsers]);

  useEffect(() => {
    if (selectedDb) {
      loadRows();
      loadProjects();
    }
  }, [selectedDb, loadRows, loadProjects]);

  // Close context menu on click outside
  useEffect(() => {
    const handleClick = () => setContextMenu({ show: false, x: 0, y: 0, database: null });
    if (contextMenu.show) {
      document.addEventListener('click', handleClick);
      return () => document.removeEventListener('click', handleClick);
    }
  }, [contextMenu.show]);

  const handleCreateDatabase = async (name, category = '') => {
    try {
      const res = await axios.post(`${API}/api/notion/databases`, { name, icon: '📋', category }, { headers });
      setDatabases([res.data, ...databases]);
      setSelectedDb(res.data);
      setShowTemplateModal(false);
      toast.success('Database created');
    } catch (error) {
      toast.error('Failed to create database');
    }
  };

  const handleCreateFromTemplate = async (templateId, name) => {
    try {
      const res = await axios.post(`${API}/api/notion/databases/from-template/${templateId}`, { name }, { headers });
      setDatabases([res.data, ...databases]);
      setSelectedDb(res.data);
      setShowTemplateModal(false);
      toast.success('Database created');
    } catch (error) {
      toast.error('Failed to create database');
    }
  };

  const handleAddRow = async (projectId = null) => {
    if (!selectedDb) return;
    try {
      const res = await axios.post(`${API}/api/notion/databases/${selectedDb.database_id}/rows`, 
        { values: {}, project_id: projectId }, 
        { headers }
      );
      setRows([...rows, res.data]);
      toast.success('Task added');
    } catch (error) {
      toast.error('Failed to add task');
    }
  };

  const handleAddProject = async () => {
    if (!selectedDb) return;
    const name = prompt('Enter project name:');
    if (!name) return;
    try {
      const res = await axios.post(`${API}/api/notion/databases/${selectedDb.database_id}/projects`, 
        { name, icon: '📁' }, 
        { headers }
      );
      setProjects([...projects, res.data]);
      setExpandedProjects({ ...expandedProjects, [res.data.project_id]: true });
      toast.success('Project created');
    } catch (error) {
      toast.error('Failed to create project');
    }
  };

  const handleUpdateCell = async (rowId, columnId, value) => {
    try {
      await axios.put(`${API}/api/notion/databases/${selectedDb.database_id}/rows/${rowId}/cell`, 
        { column_id: columnId, value }, 
        { headers }
      );
      setRows(rows.map(r => r.row_id === rowId ? { ...r, values: { ...r.values, [columnId]: value } } : r));
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDeleteRow = async (rowId) => {
    // Find task name for confirmation
    const row = rows.find(r => r.row_id === rowId);
    const nameColumn = selectedDb?.columns?.find(c => c.is_primary || c.name.toLowerCase() === 'name');
    const taskName = row?.values?.[nameColumn?.column_id] || 'Untitled Task';
    
    setDeleteModal({
      show: true,
      type: 'task',
      item: { id: rowId, name: taskName },
      confirmText: ''
    });
  };

  const executeDeleteRow = async (rowId) => {
    try {
      await axios.delete(`${API}/api/notion/databases/${selectedDb.database_id}/rows/${rowId}`, { headers });
      setRows(rows.filter(r => r.row_id !== rowId));
      toast.success('Task deleted');
      setDeleteModal({ show: false, type: '', item: null, confirmText: '' });
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleDeleteProject = async (projectId) => {
    const project = projects.find(p => p.project_id === projectId);
    setDeleteModal({
      show: true,
      type: 'project',
      item: { id: projectId, name: project?.name || 'Untitled Project' },
      confirmText: ''
    });
  };

  const executeDeleteProject = async (projectId) => {
    try {
      await axios.delete(`${API}/api/notion/databases/${selectedDb.database_id}/projects/${projectId}`, { headers });
      setProjects(projects.filter(p => p.project_id !== projectId));
      // Move tasks to ungrouped
      setRows(rows.map(r => r.project_id === projectId ? { ...r, project_id: null } : r));
      toast.success('Project deleted');
      setDeleteModal({ show: false, type: '', item: null, confirmText: '' });
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleAddColumn = async (name, type, options = []) => {
    try {
      const res = await axios.post(`${API}/api/notion/databases/${selectedDb.database_id}/columns`, 
        { name, type, options }, 
        { headers }
      );
      setSelectedDb({
        ...selectedDb,
        columns: [...selectedDb.columns, res.data]
      });
      toast.success('Column added');
    } catch (error) {
      toast.error('Failed to add column');
    }
  };

  const handleDeleteColumn = async (columnId) => {
    if (!window.confirm('Delete this column?')) return;
    try {
      await axios.delete(`${API}/api/notion/databases/${selectedDb.database_id}/columns/${columnId}`, { headers });
      setSelectedDb({
        ...selectedDb,
        columns: selectedDb.columns.filter(c => c.column_id !== columnId)
      });
    } catch (error) {
      toast.error('Failed to delete column');
    }
  };

  // Context Menu Actions
  const handleContextMenu = (e, database) => {
    e.preventDefault();
    setContextMenu({
      show: true,
      x: e.clientX,
      y: e.clientY,
      database
    });
  };

  const handleFavorite = async (database) => {
    try {
      await axios.put(`${API}/api/notion/databases/${database.database_id}`, 
        { is_favorite: !database.is_favorite }, 
        { headers }
      );
      loadDatabases();
      toast.success(database.is_favorite ? 'Removed from favorites' : 'Added to favorites');
    } catch (error) {
      toast.error('Failed to update');
    }
  };

  const handleDuplicate = async (database) => {
    try {
      const res = await axios.post(`${API}/api/notion/databases/${database.database_id}/duplicate`, {}, { headers });
      setDatabases([res.data, ...databases]);
      toast.success('Database duplicated');
    } catch (error) {
      toast.error('Failed to duplicate');
    }
  };

  const handleRename = async () => {
    if (!renameModal.name.trim()) return;
    try {
      await axios.put(`${API}/api/notion/databases/${renameModal.database.database_id}`, 
        { name: renameModal.name }, 
        { headers }
      );
      loadDatabases();
      setRenameModal({ show: false, database: null, name: '' });
      toast.success('Renamed successfully');
    } catch (error) {
      toast.error('Failed to rename');
    }
  };

  const handleDelete = async (database) => {
    setDeleteModal({
      show: true,
      type: 'database',
      item: { id: database.database_id, name: database.name },
      confirmText: ''
    });
  };

  const executeDeleteDatabase = async (databaseId) => {
    try {
      await axios.delete(`${API}/api/notion/databases/${databaseId}`, { headers });
      setDatabases(databases.filter(d => d.database_id !== databaseId));
      if (selectedDb?.database_id === databaseId) {
        setSelectedDb(databases.find(d => d.database_id !== databaseId) || null);
      }
      toast.success('Database deleted');
      setDeleteModal({ show: false, type: '', item: null, confirmText: '' });
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleConfirmDelete = () => {
    if (deleteModal.type === 'database') {
      executeDeleteDatabase(deleteModal.item.id);
    } else if (deleteModal.type === 'project') {
      executeDeleteProject(deleteModal.item.id);
    } else if (deleteModal.type === 'task') {
      executeDeleteRow(deleteModal.item.id);
    }
  };

  const copyLink = (database) => {
    const url = `${window.location.origin}/operations?db=${database.database_id}`;
    navigator.clipboard.writeText(url);
    toast.success('Link copied!');
  };

  // Apply filters
  const filteredRows = rows.filter(row => {
    if (searchQuery) {
      const matches = Object.values(row.values || {}).some(val => 
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!matches) return false;
    }

    if (filters.status) {
      const statusCol = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'status');
      if (statusCol) {
        const rowStatus = row.values?.[statusCol.column_id];
        if (rowStatus !== filters.status) return false;
      }
    }

    if (filters.priority) {
      const priorityCol = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'priority');
      if (priorityCol) {
        const rowPriority = row.values?.[priorityCol.column_id];
        if (rowPriority !== filters.priority) return false;
      }
    }

    if (filters.assignee) {
      const personCol = selectedDb?.columns?.find(c => c.type === 'person');
      if (personCol) {
        const rowAssignee = row.values?.[personCol.column_id];
        if (rowAssignee !== filters.assignee) return false;
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      const dateCol = selectedDb?.columns?.find(c => c.type === 'date');
      if (dateCol) {
        const rowDate = row.values?.[dateCol.column_id];
        if (rowDate) {
          const date = new Date(rowDate);
          if (filters.dateFrom && date < new Date(filters.dateFrom)) return false;
          if (filters.dateTo && date > new Date(filters.dateTo)) return false;
        }
      }
    }

    return true;
  });

  const statusColumn = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'status');
  const priorityColumn = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'priority');

  const clearFilters = () => {
    setFilters({ status: '', priority: '', assignee: '', dateFrom: '', dateTo: '' });
    setSearchQuery('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v) || searchQuery;

  // Group rows by project for "By Project" view
  const getRowsByProject = () => {
    const grouped = { ungrouped: [] };
    projects.forEach(p => { grouped[p.project_id] = []; });
    
    filteredRows.forEach(row => {
      if (row.project_id && grouped[row.project_id]) {
        grouped[row.project_id].push(row);
      } else {
        grouped.ungrouped.push(row);
      }
    });
    
    return grouped;
  };

  // Group rows by status for Kanban view
  const getRowsByStatus = () => {
    const grouped = {};
    const statusOpts = statusColumn?.options || [];
    statusOpts.forEach(opt => { grouped[opt.id] = []; });
    grouped['none'] = [];
    
    filteredRows.forEach(row => {
      const status = row.values?.[statusColumn?.column_id];
      if (status && grouped[status]) {
        grouped[status].push(row);
      } else {
        grouped['none'].push(row);
      }
    });
    
    return grouped;
  };

  return (
    <Layout>
      <div className="h-full flex flex-col bg-[#09090b]" data-testid="operations-page">
        {/* Header with Tabs */}
        <div className="bg-[#0c0a09] border-b border-[#27272a] px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1 overflow-x-auto">
              {databases.map(db => (
                <button
                  key={db.database_id}
                  onClick={() => setSelectedDb(db)}
                  onContextMenu={(e) => handleContextMenu(e, db)}
                  data-testid={`db-tab-${db.database_id}`}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                    selectedDb?.database_id === db.database_id
                      ? 'bg-[#27272a] text-[#fafafa] border border-[#3f3f46]'
                      : 'text-[#71717a] hover:bg-[#18181b] hover:text-[#a1a1aa]'
                  }`}
                >
                  <span className="text-base">{db.icon}</span>
                  <span>{db.name}</span>
                  {db.is_favorite && <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />}
                </button>
              ))}
              
              {databases.length === 0 && (
                <p className="text-sm text-[#52525b] px-4">No projects yet. Create your first one!</p>
              )}
            </div>
            
            <Button
              onClick={() => setShowTemplateModal(true)}
              data-testid="new-project-btn"
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white shrink-0"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Database
            </Button>
          </div>
        </div>

        {selectedDb ? (
          <>
            {/* Toolbar */}
            <div className="px-6 py-4 bg-[#09090b]">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{selectedDb.icon}</span>
                  <h1 className="text-xl font-semibold text-[#fafafa]">{selectedDb.name}</h1>
                  <Badge className="bg-[#27272a] text-[#71717a] text-xs">{filteredRows.length} tasks</Badge>
                </div>
                <div className="flex items-center gap-2">
                  {/* View Mode Toggle */}
                  <div className="flex items-center bg-[#18181b] rounded-lg p-1 border border-[#27272a]">
                    <button
                      onClick={() => setViewMode('table')}
                      className={`p-2 rounded ${viewMode === 'table' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                      title="Table View"
                    >
                      <Table2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('kanban')}
                      className={`p-2 rounded ${viewMode === 'kanban' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                      title="Kanban View"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setViewMode('byProject')}
                      className={`p-2 rounded ${viewMode === 'byProject' ? 'bg-[#27272a] text-[#fafafa]' : 'text-[#71717a]'}`}
                      title="By Project View"
                    >
                      <FolderPlus className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <Button
                    onClick={handleAddProject}
                    variant="outline"
                    className="border-[#27272a] bg-[#18181b] text-[#a1a1aa] hover:text-[#fafafa]"
                  >
                    <FolderPlus className="h-4 w-4 mr-2" />
                    New Group
                  </Button>
                  
                  <Button
                    onClick={() => handleAddRow(null)}
                    data-testid="add-task-btn"
                    className="bg-[#10b981] hover:bg-[#059669] text-white font-medium px-6"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Add Task
                  </Button>
                </div>
              </div>
              
              {/* Search and Filters */}
              <div className="flex items-center gap-3">
                <div className="relative flex-1 max-w-md">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b]" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    data-testid="search-input"
                    className="pl-10 bg-[#18181b] border-[#27272a] text-[#fafafa] placeholder:text-[#52525b]"
                  />
                </div>
                
                {statusColumn && (
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setFilters({ ...filters, status: '' })}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        !filters.status ? 'bg-[#6366f1] text-white' : 'bg-[#18181b] text-[#71717a]'
                      }`}
                    >
                      All
                    </button>
                    {statusColumn.options?.slice(0, 4).map(opt => (
                      <button
                        key={opt.id}
                        onClick={() => setFilters({ ...filters, status: filters.status === opt.id ? '' : opt.id })}
                        className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                          filters.status === opt.id ? 'text-white' : 'bg-[#18181b] text-[#71717a]'
                        }`}
                        style={filters.status === opt.id ? { backgroundColor: opt.color } : {}}
                      >
                        {opt.name}
                      </button>
                    ))}
                  </div>
                )}
                
                <Button
                  onClick={() => setShowFilters(!showFilters)}
                  variant="outline"
                  className={`border-[#27272a] ${showFilters || hasActiveFilters ? 'bg-[#6366f1]/10 text-[#6366f1]' : 'bg-[#18181b] text-[#71717a]'}`}
                >
                  <SlidersHorizontal className="h-4 w-4 mr-2" />
                  More Filters
                  {hasActiveFilters && <span className="ml-2 w-2 h-2 rounded-full bg-[#6366f1]" />}
                </Button>
              </div>

              {/* Advanced Filters */}
              {showFilters && (
                <div className="mt-4 p-4 bg-[#18181b] rounded-lg border border-[#27272a]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#fafafa]">Advanced Filters</h3>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#71717a] text-xs">
                        <X className="h-3 w-3 mr-1" /> Clear all
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-4 gap-4">
                    {priorityColumn && (
                      <div>
                        <label className="block text-xs text-[#52525b] mb-1.5">Priority</label>
                        <select
                          value={filters.priority}
                          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                          className="w-full p-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#fafafa]"
                        >
                          <option value="">All</option>
                          {priorityColumn.options?.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-xs text-[#52525b] mb-1.5">Assignee</label>
                      <select
                        value={filters.assignee}
                        onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                        className="w-full p-2.5 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#fafafa]"
                      >
                        <option value="">All</option>
                        {users.map(u => (
                          <option key={u.user_id} value={u.user_id}>{u.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-[#52525b] mb-1.5">Due After</label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-[#52525b] mb-1.5">Due Before</label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="bg-[#09090b] border-[#27272a] text-[#fafafa]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto px-6 pb-6">
              {viewMode === 'table' && (
                <NotionTable
                  columns={selectedDb.columns}
                  rows={filteredRows}
                  users={users}
                  onUpdateCell={handleUpdateCell}
                  onDeleteRow={handleDeleteRow}
                  onAddColumn={handleAddColumn}
                  onDeleteColumn={handleDeleteColumn}
                  onAddRow={() => handleAddRow(null)}
                />
              )}
              
              {viewMode === 'kanban' && statusColumn && (
                <KanbanView
                  columns={selectedDb.columns}
                  rows={filteredRows}
                  statusColumn={statusColumn}
                  users={users}
                  onUpdateCell={handleUpdateCell}
                  onDeleteRow={handleDeleteRow}
                  onAddRow={() => handleAddRow(null)}
                  getRowsByStatus={getRowsByStatus}
                />
              )}
              
              {viewMode === 'byProject' && (
                <ByProjectView
                  columns={selectedDb.columns}
                  projects={projects}
                  rows={filteredRows}
                  users={users}
                  expandedProjects={expandedProjects}
                  setExpandedProjects={setExpandedProjects}
                  onUpdateCell={handleUpdateCell}
                  onDeleteRow={handleDeleteRow}
                  onDeleteProject={handleDeleteProject}
                  onAddRow={handleAddRow}
                  getRowsByProject={getRowsByProject}
                />
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center p-8">
            <div className="text-center max-w-md">
              <div className="w-20 h-20 rounded-2xl bg-[#18181b] border border-[#27272a] flex items-center justify-center mx-auto mb-6">
                <Database className="h-10 w-10 text-[#3f3f46]" />
              </div>
              <h2 className="text-xl font-semibold text-[#fafafa] mb-2">Start your first project</h2>
              <p className="text-[#71717a] mb-6 text-sm">
                Create a database to start tracking tasks, clients, or content.
              </p>
              <Button
                onClick={() => setShowTemplateModal(true)}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white px-8"
              >
                <Plus className="h-5 w-5 mr-2" />
                Create Database
              </Button>
            </div>
          </div>
        )}

        {/* Context Menu */}
        {contextMenu.show && (
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            database={contextMenu.database}
            onFavorite={() => handleFavorite(contextMenu.database)}
            onCopyLink={() => copyLink(contextMenu.database)}
            onDuplicate={() => handleDuplicate(contextMenu.database)}
            onRename={() => setRenameModal({ show: true, database: contextMenu.database, name: contextMenu.database.name })}
            onDelete={() => handleDelete(contextMenu.database)}
            onClose={() => setContextMenu({ show: false, x: 0, y: 0, database: null })}
          />
        )}

        {/* Rename Modal */}
        {renameModal.show && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6 w-full max-w-md">
              <h3 className="text-lg font-semibold text-[#fafafa] mb-4">Rename Database</h3>
              <Input
                value={renameModal.name}
                onChange={(e) => setRenameModal({ ...renameModal, name: e.target.value })}
                className="bg-[#27272a] border-[#3f3f46] text-[#fafafa] mb-4"
                autoFocus
                onKeyDown={(e) => e.key === 'Enter' && handleRename()}
              />
              <div className="flex gap-3">
                <Button onClick={() => setRenameModal({ show: false, database: null, name: '' })} className="flex-1 bg-[#27272a]">Cancel</Button>
                <Button onClick={handleRename} className="flex-1 bg-[#6366f1]">Save</Button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteModal.show && (
          <DeleteConfirmationModal
            type={deleteModal.type}
            itemName={deleteModal.item?.name || ''}
            confirmText={deleteModal.confirmText}
            onConfirmTextChange={(text) => setDeleteModal({ ...deleteModal, confirmText: text })}
            onConfirm={handleConfirmDelete}
            onCancel={() => setDeleteModal({ show: false, type: '', item: null, confirmText: '' })}
          />
        )}

        {/* Template Modal */}
        {showTemplateModal && (
          <TemplateModal
            templates={templates}
            onSelect={handleCreateFromTemplate}
            onCreateBlank={handleCreateDatabase}
            onClose={() => setShowTemplateModal(false)}
          />
        )}
      </div>
    </Layout>
  );
}

// ============== CONTEXT MENU ==============
function ContextMenu({ x, y, database, onFavorite, onCopyLink, onDuplicate, onRename, onDelete, onClose }) {
  const menuRef = useRef(null);
  
  // Adjust position if menu goes off screen
  const adjustedX = Math.min(x, window.innerWidth - 200);
  const adjustedY = Math.min(y, window.innerHeight - 300);
  
  return (
    <div 
      ref={menuRef}
      className="fixed z-50 bg-[#18181b] border border-[#27272a] rounded-lg shadow-xl py-1 min-w-[200px]"
      style={{ left: adjustedX, top: adjustedY }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-3 py-2 text-xs text-[#52525b] font-medium border-b border-[#27272a]">Database</div>
      
      <button
        onClick={() => { onFavorite(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#fafafa] hover:bg-[#27272a]"
      >
        <Star className={`h-4 w-4 ${database.is_favorite ? 'text-yellow-500 fill-yellow-500' : ''}`} />
        {database.is_favorite ? 'Remove from Favorites' : 'Add to Favorites'}
      </button>
      
      <button
        onClick={() => { onCopyLink(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#fafafa] hover:bg-[#27272a]"
      >
        <Link2 className="h-4 w-4" />
        Copy link
      </button>
      
      <button
        onClick={() => { onDuplicate(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#fafafa] hover:bg-[#27272a]"
      >
        <Copy className="h-4 w-4" />
        Duplicate
      </button>
      
      <button
        onClick={() => { onRename(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#fafafa] hover:bg-[#27272a]"
      >
        <Edit3 className="h-4 w-4" />
        Rename
      </button>
      
      <div className="border-t border-[#27272a] my-1" />
      
      <button
        onClick={() => { window.open(`/operations?db=${database.database_id}`, '_blank'); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-[#fafafa] hover:bg-[#27272a]"
      >
        <ExternalLink className="h-4 w-4" />
        Open in new tab
      </button>
      
      <div className="border-t border-[#27272a] my-1" />
      
      <button
        onClick={() => { onDelete(); onClose(); }}
        className="w-full flex items-center gap-3 px-3 py-2 text-sm text-red-400 hover:bg-[#27272a]"
      >
        <Trash2 className="h-4 w-4" />
        Move to Trash
      </button>
    </div>
  );
}

// ============== KANBAN VIEW ==============
function KanbanView({ columns, rows, statusColumn, users, onUpdateCell, onDeleteRow, onAddRow, getRowsByStatus }) {
  const rowsByStatus = getRowsByStatus();
  const nameColumn = columns.find(c => c.is_primary || c.name.toLowerCase() === 'name');
  
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {statusColumn.options?.map(status => (
        <div key={status.id} className="flex-shrink-0 w-72 bg-[#18181b] rounded-lg border border-[#27272a]">
          <div className="p-3 border-b border-[#27272a] flex items-center gap-2">
            <div className="w-3 h-3 rounded" style={{ backgroundColor: status.color }} />
            <span className="text-sm font-medium text-[#fafafa]">{status.name}</span>
            <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-auto">
              {rowsByStatus[status.id]?.length || 0}
            </Badge>
          </div>
          <div className="p-2 space-y-2 max-h-[calc(100vh-350px)] overflow-y-auto">
            {rowsByStatus[status.id]?.map(row => (
              <KanbanCard
                key={row.row_id}
                row={row}
                columns={columns}
                nameColumn={nameColumn}
                users={users}
                onDelete={() => onDeleteRow(row.row_id)}
              />
            ))}
            <button
              onClick={onAddRow}
              className="w-full p-2 text-sm text-[#71717a] hover:text-[#fafafa] hover:bg-[#27272a] rounded flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> Add task
            </button>
          </div>
        </div>
      ))}
      
      {/* No Status column */}
      {rowsByStatus['none']?.length > 0 && (
        <div className="flex-shrink-0 w-72 bg-[#18181b] rounded-lg border border-[#27272a]">
          <div className="p-3 border-b border-[#27272a] flex items-center gap-2">
            <div className="w-3 h-3 rounded bg-[#52525b]" />
            <span className="text-sm font-medium text-[#fafafa]">No Status</span>
            <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-auto">{rowsByStatus['none'].length}</Badge>
          </div>
          <div className="p-2 space-y-2">
            {rowsByStatus['none'].map(row => (
              <KanbanCard
                key={row.row_id}
                row={row}
                columns={columns}
                nameColumn={nameColumn}
                users={users}
                onDelete={() => onDeleteRow(row.row_id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({ row, columns, nameColumn, users, onDelete }) {
  const priorityCol = columns.find(c => c.name.toLowerCase() === 'priority');
  const dateCol = columns.find(c => c.type === 'date');
  const personCol = columns.find(c => c.type === 'person');
  
  const priority = priorityCol?.options?.find(o => o.id === row.values?.[priorityCol?.column_id]);
  const assignee = users.find(u => u.user_id === row.values?.[personCol?.column_id]);
  const dueDate = row.values?.[dateCol?.column_id];
  
  return (
    <div className="p-3 bg-[#0c0a09] rounded-lg border border-[#27272a] hover:border-[#3f3f46] group">
      <div className="flex items-start justify-between mb-2">
        <span className="text-sm text-[#fafafa]">
          {row.values?.[nameColumn?.column_id] || 'Untitled'}
        </span>
        <button
          onClick={onDelete}
          className="opacity-0 group-hover:opacity-100 text-[#71717a] hover:text-red-400"
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {priority && (
          <Badge style={{ backgroundColor: `${priority.color}20`, color: priority.color }} className="text-xs">
            {priority.name}
          </Badge>
        )}
        {dueDate && (
          <span className="text-xs text-[#71717a] flex items-center gap-1">
            <Calendar className="h-3 w-3" />
            {new Date(dueDate).toLocaleDateString()}
          </span>
        )}
        {assignee && (
          <div className="ml-auto w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">
            {assignee.name?.charAt(0).toUpperCase()}
          </div>
        )}
      </div>
    </div>
  );
}

// ============== BY PROJECT VIEW ==============
function ByProjectView({ columns, projects, rows, users, expandedProjects, setExpandedProjects, onUpdateCell, onDeleteRow, onDeleteProject, onAddRow, getRowsByProject }) {
  const rowsByProject = getRowsByProject();
  const nameColumn = columns.find(c => c.is_primary || c.name.toLowerCase() === 'name');
  
  const toggleProject = (projectId) => {
    setExpandedProjects({ ...expandedProjects, [projectId]: !expandedProjects[projectId] });
  };
  
  return (
    <div className="space-y-4">
      {projects.map(project => (
        <div key={project.project_id} className="bg-[#18181b] rounded-lg border border-[#27272a] group">
          <div className="flex items-center gap-3 p-3 hover:bg-[#27272a]/30">
            <button
              onClick={() => toggleProject(project.project_id)}
              className="flex items-center gap-3 flex-1 text-left"
            >
              {expandedProjects[project.project_id] ? (
                <ChevronDown className="h-4 w-4 text-[#71717a]" />
              ) : (
                <ChevronRight className="h-4 w-4 text-[#71717a]" />
              )}
              <span className="text-lg">{project.icon}</span>
              <span className="font-medium text-[#fafafa]">{project.name}</span>
              <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-2">
                {rowsByProject[project.project_id]?.length || 0}
              </Badge>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); onAddRow(project.project_id); }}
                className="text-[#71717a] hover:text-[#fafafa] p-1"
                title="Add task"
              >
                <Plus className="h-4 w-4" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); onDeleteProject(project.project_id); }}
                className="opacity-0 group-hover:opacity-100 text-[#71717a] hover:text-red-400 p-1"
                title="Delete project"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          
          {expandedProjects[project.project_id] && (
            <div className="border-t border-[#27272a]">
              <ProjectTable
                columns={columns}
                rows={rowsByProject[project.project_id] || []}
                users={users}
                onUpdateCell={onUpdateCell}
                onDeleteRow={onDeleteRow}
                onAddRow={() => onAddRow(project.project_id)}
              />
            </div>
          )}
        </div>
      ))}
      
      {/* Ungrouped Tasks */}
      {rowsByProject.ungrouped?.length > 0 && (
        <div className="bg-[#18181b] rounded-lg border border-[#27272a]">
          <div className="flex items-center gap-3 p-3">
            <span className="text-lg">📋</span>
            <span className="font-medium text-[#fafafa]">Ungrouped Tasks</span>
            <Badge className="bg-[#27272a] text-[#71717a] text-xs ml-2">
              {rowsByProject.ungrouped.length}
            </Badge>
          </div>
          <div className="border-t border-[#27272a]">
            <ProjectTable
              columns={columns}
              rows={rowsByProject.ungrouped}
              users={users}
              onUpdateCell={onUpdateCell}
              onDeleteRow={onDeleteRow}
              onAddRow={() => onAddRow(null)}
            />
          </div>
        </div>
      )}
      
      {projects.length === 0 && rowsByProject.ungrouped?.length === 0 && (
        <div className="text-center py-8 text-[#71717a]">
          <FolderPlus className="h-12 w-12 mx-auto mb-3 text-[#3f3f46]" />
          <p>No projects yet. Click &quot;New Group&quot; to create one.</p>
        </div>
      )}
    </div>
  );
}

function ProjectTable({ columns, rows, users, onUpdateCell, onDeleteRow, onAddRow }) {
  const sortedColumns = [...columns].sort((a, b) => (a.order || 0) - (b.order || 0));
  
  return (
    <table className="w-full">
      <thead>
        <tr className="bg-[#0c0a09]">
          <th className="w-10 p-2"></th>
          {sortedColumns.slice(0, 6).map(col => (
            <th key={col.column_id} className="p-2 text-left text-xs font-medium text-[#71717a] uppercase">
              {col.name}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map(row => (
          <tr key={row.row_id} className="border-t border-[#27272a] hover:bg-[#27272a]/30 group">
            <td className="p-2">
              <button
                onClick={() => onDeleteRow(row.row_id)}
                className="opacity-0 group-hover:opacity-100 text-[#71717a] hover:text-red-400"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </td>
            {sortedColumns.slice(0, 6).map(col => (
              <td key={col.column_id} className="p-2">
                <MiniCellEditor
                  column={col}
                  value={row.values?.[col.column_id]}
                  users={users}
                  onChange={(value) => onUpdateCell(row.row_id, col.column_id, value)}
                />
              </td>
            ))}
          </tr>
        ))}
        <tr className="border-t border-[#27272a]">
          <td colSpan={sortedColumns.length + 1} className="p-2">
            <button
              onClick={onAddRow}
              className="text-[#71717a] hover:text-[#fafafa] text-sm flex items-center gap-2"
            >
              <Plus className="h-4 w-4" /> New task
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

function MiniCellEditor({ column, value, users, onChange }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  
  useEffect(() => { setLocalValue(value); }, [value]);
  
  const handleSave = () => { onChange(localValue); setEditing(false); };
  
  if (column.type === 'select') {
    const selected = column.options?.find(o => o.id === value);
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-[#fafafa] border-none focus:ring-0 cursor-pointer"
      >
        <option value="">-</option>
        {column.options?.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.name}</option>
        ))}
      </select>
    );
  }
  
  if (column.type === 'checkbox') {
    return (
      <input
        type="checkbox"
        checked={!!value}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-[#3f3f46] bg-[#27272a] text-[#6366f1]"
      />
    );
  }
  
  if (column.type === 'date') {
    return (
      <input
        type="date"
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-[#fafafa] border-none"
      />
    );
  }
  
  if (column.type === 'person') {
    const selected = users.find(u => u.user_id === value);
    return (
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="bg-transparent text-sm text-[#fafafa] border-none focus:ring-0 cursor-pointer"
      >
        <option value="">-</option>
        {users.map(u => (
          <option key={u.user_id} value={u.user_id}>{u.name}</option>
        ))}
      </select>
    );
  }
  
  // Default text
  if (editing) {
    return (
      <input
        type="text"
        value={localValue || ''}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleSave}
        onKeyDown={(e) => e.key === 'Enter' && handleSave()}
        className="bg-[#27272a] text-sm text-[#fafafa] border border-[#6366f1] rounded px-1 w-full"
        autoFocus
      />
    );
  }
  
  return (
    <div
      onClick={() => setEditing(true)}
      className="text-sm text-[#fafafa] cursor-text min-h-[24px]"
    >
      {value || <span className="text-[#52525b]">-</span>}
    </div>
  );
}

// ============== NOTION TABLE (existing, simplified) ==============
function NotionTable({ columns, rows, users, onUpdateCell, onDeleteRow, onAddColumn, onDeleteColumn, onAddRow }) {
  const [showAddColumn, setShowAddColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState('');
  const [newColumnType, setNewColumnType] = useState('text');

  const sortedColumns = [...columns].sort((a, b) => (a.order || 0) - (b.order || 0));

  const handleAddColumn = () => {
    if (!newColumnName.trim()) return;
    let options = [];
    if (newColumnType === 'select' || newColumnType === 'multi_select') {
      options = [
        { id: 'opt_1', name: 'Option 1', color: '#71717a' },
        { id: 'opt_2', name: 'Option 2', color: '#3b82f6' },
        { id: 'opt_3', name: 'Option 3', color: '#10b981' }
      ];
    }
    onAddColumn(newColumnName, newColumnType, options);
    setNewColumnName('');
    setNewColumnType('text');
    setShowAddColumn(false);
  };

  return (
    <div className="bg-[#18181b] rounded-lg border border-[#27272a] overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-[#0c0a09]">
            <th className="w-10 p-3"></th>
            {sortedColumns.map(col => (
              <th 
                key={col.column_id} 
                className="p-3 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider group border-l border-[#27272a]"
                style={{ minWidth: col.width || 180 }}
              >
                <div className="flex items-center gap-2">
                  {COLUMN_ICONS[col.type]}
                  <span>{col.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteColumn(col.column_id)}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 p-0 text-[#71717a] hover:text-red-400 ml-auto"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </th>
            ))}
            <th className="w-36 p-3 border-l border-[#27272a]">
              {showAddColumn ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Name"
                    className="h-7 text-xs bg-[#27272a] border-[#3f3f46] text-[#fafafa] w-20"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                  />
                  <select
                    value={newColumnType}
                    onChange={(e) => setNewColumnType(e.target.value)}
                    className="h-7 text-xs bg-[#27272a] border border-[#3f3f46] rounded text-[#fafafa] px-1"
                  >
                    {COLUMN_TYPES.map(t => (
                      <option key={t.type} value={t.type}>{t.name}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleAddColumn} className="h-7 px-2 bg-[#10b981]">
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddColumn(false)} className="h-7 px-2">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button variant="ghost" size="sm" onClick={() => setShowAddColumn(true)} className="text-[#71717a] text-xs">
                  <Plus className="h-3 w-3 mr-1" /> Column
                </Button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.row_id} className="border-t border-[#27272a] hover:bg-[#27272a]/30 group">
              <td className="p-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteRow(row.row_id)}
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-[#71717a] hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </td>
              {sortedColumns.map(col => (
                <td key={col.column_id} className="p-2 border-l border-[#27272a]">
                  <CellEditor
                    column={col}
                    value={row.values?.[col.column_id]}
                    users={users}
                    onChange={(value) => onUpdateCell(row.row_id, col.column_id, value)}
                  />
                </td>
              ))}
              <td className="border-l border-[#27272a]"></td>
            </tr>
          ))}
          <tr className="border-t border-[#27272a]">
            <td colSpan={sortedColumns.length + 2} className="p-2">
              <Button variant="ghost" onClick={onAddRow} className="text-[#71717a] hover:text-[#fafafa] text-sm w-full justify-start">
                <Plus className="h-4 w-4 mr-2" /> New task
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============== CELL EDITOR ==============
function CellEditor({ column, value, users, onChange }) {
  const [editing, setEditing] = useState(false);
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setLocalValue(value); }, [value]);
  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);

  const handleSave = () => { onChange(localValue); setEditing(false); };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && column.type !== 'text') handleSave();
    if (e.key === 'Escape') { setLocalValue(value); setEditing(false); }
  };

  switch (column.type) {
    case 'text':
      return editing ? (
        <Input ref={inputRef} value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={() => setEditing(true)} className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded">
          {value || <span className="text-[#52525b]">Empty</span>}
        </div>
      );

    case 'number':
      return editing ? (
        <Input ref={inputRef} type="number" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={() => setEditing(true)} className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded">
          {value ?? <span className="text-[#52525b]">-</span>}
        </div>
      );

    case 'select':
      return <SelectCell column={column} value={value} onChange={onChange} />;

    case 'multi_select':
      return <MultiSelectCell column={column} value={value} onChange={onChange} />;

    case 'date':
      return editing ? (
        <Input ref={inputRef} type="date" value={localValue || ''}
          onChange={(e) => { setLocalValue(e.target.value); onChange(e.target.value); }}
          onBlur={() => setEditing(false)} className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={() => setEditing(true)} className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded flex items-center gap-2">
          {value ? <><Calendar className="h-3 w-3 text-[#71717a]" />{new Date(value).toLocaleDateString()}</> : <span className="text-[#52525b]">Set date</span>}
        </div>
      );

    case 'url':
      return editing ? (
        <Input ref={inputRef} type="url" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown} placeholder="https://"
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={() => setEditing(true)} className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded">
          {value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Link2 className="h-3 w-3" />{value.replace(/^https?:\/\//, '').substring(0, 25)}
          </a> : <span className="text-[#52525b]">Add URL</span>}
        </div>
      );

    case 'email':
      return editing ? (
        <Input ref={inputRef} type="email" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={() => setEditing(true)} className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded">
          {value ? <a href={`mailto:${value}`} className="text-[#6366f1] hover:underline" onClick={(e) => e.stopPropagation()}>{value}</a> : <span className="text-[#52525b]">Add email</span>}
        </div>
      );

    case 'phone':
      return editing ? (
        <Input ref={inputRef} type="tel" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={() => setEditing(true)} className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded">
          {value ? <a href={`tel:${value}`} className="text-[#fafafa]" onClick={(e) => e.stopPropagation()}>{value}</a> : <span className="text-[#52525b]">Add phone</span>}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center justify-center">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-[#3f3f46] bg-[#27272a] text-[#6366f1]" />
        </div>
      );

    case 'person':
      return <PersonCell value={value} users={users} onChange={onChange} />;

    default:
      return <div className="px-2 py-1 text-[#fafafa]">{String(value || '')}</div>;
  }
}

// ============== SELECT CELL ==============
function SelectCell({ column, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const options = column.options || [];
  const selected = options.find(o => o.id === value || o.name === value);

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)} className="min-h-[32px] px-2 py-1 cursor-pointer hover:bg-[#27272a] rounded flex items-center">
        {selected ? <Badge style={{ backgroundColor: `${selected.color}20`, color: selected.color }}>{selected.name}</Badge> : <span className="text-[#52525b]">Select...</span>}
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-xl min-w-[140px] py-1">
            <div onClick={() => { onChange(null); setIsOpen(false); }} className="px-3 py-2 text-sm text-[#71717a] hover:bg-[#3f3f46] cursor-pointer">Clear</div>
            {options.map(opt => (
              <div key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); }} className="px-3 py-2 hover:bg-[#3f3f46] cursor-pointer flex items-center gap-2">
                <div className="w-3 h-3 rounded" style={{ backgroundColor: opt.color }} />
                <span className="text-[#fafafa] text-sm">{opt.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============== MULTI-SELECT CELL ==============
function MultiSelectCell({ column, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const options = column.options || [];
  const selectedIds = Array.isArray(value) ? value : [];
  const selectedOpts = options.filter(o => selectedIds.includes(o.id));

  const toggle = (optId) => {
    const newVal = selectedIds.includes(optId) ? selectedIds.filter(id => id !== optId) : [...selectedIds, optId];
    onChange(newVal);
  };

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)} className="min-h-[32px] px-2 py-1 cursor-pointer hover:bg-[#27272a] rounded flex flex-wrap gap-1">
        {selectedOpts.length > 0 ? selectedOpts.map(opt => <Badge key={opt.id} style={{ backgroundColor: `${opt.color}20`, color: opt.color }} className="text-xs">{opt.name}</Badge>) : <span className="text-[#52525b]">Select...</span>}
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-xl min-w-[140px] py-1">
            {options.map(opt => (
              <div key={opt.id} onClick={() => toggle(opt.id)} className="px-3 py-2 hover:bg-[#3f3f46] cursor-pointer flex items-center gap-2">
                <div className={`w-4 h-4 rounded border ${selectedIds.includes(opt.id) ? 'bg-[#6366f1] border-[#6366f1]' : 'border-[#3f3f46]'} flex items-center justify-center`}>
                  {selectedIds.includes(opt.id) && <Check className="h-3 w-3 text-white" />}
                </div>
                <div className="w-3 h-3 rounded" style={{ backgroundColor: opt.color }} />
                <span className="text-[#fafafa] text-sm">{opt.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============== PERSON CELL ==============
function PersonCell({ value, users, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const selected = users.find(u => u.user_id === value);

  return (
    <div className="relative">
      <div onClick={() => setIsOpen(!isOpen)} className="min-h-[32px] px-2 py-1 cursor-pointer hover:bg-[#27272a] rounded flex items-center gap-2">
        {selected ? (
          <>
            <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">{selected.name?.charAt(0).toUpperCase()}</div>
            <span className="text-[#fafafa] text-sm">{selected.name}</span>
          </>
        ) : <span className="text-[#52525b]">Assign...</span>}
      </div>
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-xl min-w-[160px] py-1 max-h-[180px] overflow-y-auto">
            <div onClick={() => { onChange(null); setIsOpen(false); }} className="px-3 py-2 text-sm text-[#71717a] hover:bg-[#3f3f46] cursor-pointer">Unassign</div>
            {users.map(user => (
              <div key={user.user_id} onClick={() => { onChange(user.user_id); setIsOpen(false); }} className="px-3 py-2 hover:bg-[#3f3f46] cursor-pointer flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">{user.name?.charAt(0).toUpperCase()}</div>
                <span className="text-[#fafafa] text-sm">{user.name}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ============== TEMPLATE MODAL ==============
function TemplateModal({ templates, onSelect, onCreateBlank, onClose }) {
  const [dbName, setDbName] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState(null);

  const handleCreate = () => {
    if (!dbName.trim()) { toast.error('Enter a name'); return; }
    if (selectedTemplate) onSelect(selectedTemplate, dbName);
    else onCreateBlank(dbName);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold text-[#fafafa]">New Database</h2>
          <Button variant="ghost" onClick={onClose} className="text-[#71717a]"><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
          <div className="mb-6">
            <label className="block text-sm text-[#a1a1aa] mb-2">Database Name</label>
            <Input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="e.g., Client Projects"
              className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]" autoFocus />
          </div>
          <div className="mb-4">
            <label className="block text-sm text-[#a1a1aa] mb-3">Template (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              <div onClick={() => setSelectedTemplate(null)}
                className={`p-4 rounded-lg border cursor-pointer ${selectedTemplate === null ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#27272a] hover:border-[#3f3f46]'}`}>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📄</span>
                  <span className="font-medium text-[#fafafa]">Blank</span>
                </div>
                <p className="text-xs text-[#71717a]">Start with default columns</p>
              </div>
              {templates.map(t => (
                <div key={t.id} onClick={() => setSelectedTemplate(t.id)}
                  className={`p-4 rounded-lg border cursor-pointer ${selectedTemplate === t.id ? 'border-[#6366f1] bg-[#6366f1]/10' : 'border-[#27272a] hover:border-[#3f3f46]'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{t.icon}</span>
                    <span className="font-medium text-[#fafafa]">{t.name}</span>
                  </div>
                  <p className="text-xs text-[#71717a]">{t.description}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-[#27272a]">
          <Button onClick={onClose} className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]">Cancel</Button>
          <Button onClick={handleCreate} className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white">Create</Button>
        </div>
      </div>
    </div>
  );
}

// ============== DELETE CONFIRMATION MODAL ==============
function DeleteConfirmationModal({ type, itemName, confirmText, onConfirmTextChange, onConfirm, onCancel }) {
  const typeLabels = {
    database: 'Database',
    project: 'Project',
    task: 'Task'
  };
  
  const typeDescriptions = {
    database: 'This will permanently delete the database, all its projects, and all tasks. This action cannot be undone.',
    project: 'This will delete the project. All tasks in this project will be moved to "Ungrouped Tasks".',
    task: 'This will permanently delete this task. This action cannot be undone.'
  };
  
  const label = typeLabels[type] || 'Item';
  const description = typeDescriptions[type] || 'This action cannot be undone.';
  const isConfirmed = confirmText.toLowerCase() === itemName.toLowerCase();
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-md">
        <div className="p-6">
          {/* Warning Icon */}
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
            <Trash2 className="h-6 w-6 text-red-500" />
          </div>
          
          <h3 className="text-lg font-semibold text-[#fafafa] text-center mb-2">
            Delete {label}
          </h3>
          
          <p className="text-sm text-[#71717a] text-center mb-4">
            {description}
          </p>
          
          {/* Item name display */}
          <div className="bg-[#0c0a09] border border-[#27272a] rounded-lg p-3 mb-4">
            <p className="text-xs text-[#52525b] mb-1">{label} to be deleted:</p>
            <p className="text-[#fafafa] font-medium break-all">{itemName}</p>
          </div>
          
          {/* Confirmation input */}
          <div className="mb-4">
            <label className="block text-sm text-[#a1a1aa] mb-2">
              Type <span className="font-semibold text-[#fafafa]">{itemName}</span> to confirm:
            </label>
            <Input
              value={confirmText}
              onChange={(e) => onConfirmTextChange(e.target.value)}
              placeholder={`Enter "${itemName}" to confirm`}
              className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
              autoFocus
              data-testid="delete-confirm-input"
            />
          </div>
          
          {/* Match indicator */}
          {confirmText && (
            <div className={`text-xs mb-4 flex items-center gap-2 ${isConfirmed ? 'text-green-500' : 'text-red-400'}`}>
              {isConfirmed ? (
                <>
                  <Check className="h-3 w-3" />
                  <span>Name matches</span>
                </>
              ) : (
                <>
                  <X className="h-3 w-3" />
                  <span>Name does not match</span>
                </>
              )}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3 p-4 border-t border-[#27272a]">
          <Button 
            onClick={onCancel} 
            className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
          >
            Cancel
          </Button>
          <Button 
            onClick={onConfirm}
            disabled={!isConfirmed}
            className={`flex-1 ${isConfirmed ? 'bg-red-600 hover:bg-red-700' : 'bg-red-600/30 cursor-not-allowed'} text-white`}
            data-testid="delete-confirm-btn"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Delete {label}
          </Button>
        </div>
      </div>
    </div>
  );
}
