import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { 
  Plus, ChevronDown, Link2, Calendar, Hash, Mail, Phone, Check, User, X,
  Trash2, Search, Filter, SlidersHorizontal, Database
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
  const [templates, setTemplates] = useState([]);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [users, setUsers] = useState([]);
  
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

  // Get pinned databases for tabs
  const pinnedDatabases = databases
    .filter(db => db.is_pinned)
    .sort((a, b) => (a.pin_order || 0) - (b.pin_order || 0));

  const loadDatabases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/notion/databases`, { headers });
      setDatabases(res.data);
      
      // Select from URL param or first pinned or first database
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
    }
  }, [selectedDb, loadRows]);

  const handleCreateDatabase = async (name) => {
    try {
      const res = await axios.post(`${API}/api/notion/databases`, { name, icon: '📋' }, { headers });
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

  const handleAddRow = async () => {
    if (!selectedDb) return;
    try {
      const res = await axios.post(`${API}/api/notion/databases/${selectedDb.database_id}/rows`, { values: {} }, { headers });
      setRows([...rows, res.data]);
      toast.success('Task added');
    } catch (error) {
      toast.error('Failed to add task');
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
    try {
      await axios.delete(`${API}/api/notion/databases/${selectedDb.database_id}/rows/${rowId}`, { headers });
      setRows(rows.filter(r => r.row_id !== rowId));
      toast.success('Task deleted');
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

  // Apply filters
  const filteredRows = rows.filter(row => {
    // Search filter
    if (searchQuery) {
      const matches = Object.values(row.values || {}).some(val => 
        String(val).toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (!matches) return false;
    }

    // Status filter
    if (filters.status) {
      const statusCol = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'status');
      if (statusCol) {
        const rowStatus = row.values?.[statusCol.column_id];
        if (rowStatus !== filters.status) return false;
      }
    }

    // Priority filter
    if (filters.priority) {
      const priorityCol = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'priority');
      if (priorityCol) {
        const rowPriority = row.values?.[priorityCol.column_id];
        if (rowPriority !== filters.priority) return false;
      }
    }

    // Assignee filter
    if (filters.assignee) {
      const personCol = selectedDb?.columns?.find(c => c.type === 'person');
      if (personCol) {
        const rowAssignee = row.values?.[personCol.column_id];
        if (rowAssignee !== filters.assignee) return false;
      }
    }

    // Date range filter
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

  // Get filter options
  const statusColumn = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'status');
  const priorityColumn = selectedDb?.columns?.find(c => c.name.toLowerCase() === 'priority');

  const clearFilters = () => {
    setFilters({ status: '', priority: '', assignee: '', dateFrom: '', dateTo: '' });
    setSearchQuery('');
  };

  const hasActiveFilters = Object.values(filters).some(v => v) || searchQuery;

  return (
    <Layout>
      <div className="h-full flex flex-col bg-[#09090b]" data-testid="operations-page">
        {/* Header with Pinned Tabs */}
        <div className="bg-[#18181b] border-b border-[#27272a] px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-[#fafafa]">Operations</h1>
            <Button
              onClick={() => setShowTemplateModal(true)}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Project
            </Button>
          </div>

          {/* Pinned Database Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {pinnedDatabases.map(db => (
              <button
                key={db.database_id}
                onClick={() => setSelectedDb(db)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  selectedDb?.database_id === db.database_id
                    ? 'bg-[#6366f1] text-white'
                    : 'bg-[#27272a] text-[#a1a1aa] hover:bg-[#3f3f46] hover:text-white'
                }`}
              >
                <span>{db.icon}</span>
                <span>{db.name}</span>
              </button>
            ))}
            
            {pinnedDatabases.length === 0 && databases.length > 0 && (
              <p className="text-sm text-[#71717a]">Pin databases from sidebar to show as tabs</p>
            )}
          </div>
        </div>

        {selectedDb ? (
          <>
            {/* Toolbar */}
            <div className="px-6 py-3 border-b border-[#27272a] bg-[#0c0a09]">
              <div className="flex items-center justify-between gap-4">
                {/* Left side - Database info & Add Task */}
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{selectedDb.icon}</span>
                    <h2 className="text-lg font-semibold text-[#fafafa]">{selectedDb.name}</h2>
                    <Badge className="bg-[#27272a] text-[#a1a1aa]">{filteredRows.length} tasks</Badge>
                  </div>
                  <Button
                    onClick={handleAddRow}
                    className="bg-[#10b981] hover:bg-[#059669] text-white"
                    data-testid="add-task-btn"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Task
                  </Button>
                </div>

                {/* Right side - Search & Filters */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717a]" />
                    <Input
                      placeholder="Search tasks..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9 w-64 bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                    />
                  </div>
                  <Button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`${showFilters || hasActiveFilters ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'} hover:bg-[#3f3f46]`}
                  >
                    <SlidersHorizontal className="h-4 w-4 mr-2" />
                    Filters
                    {hasActiveFilters && (
                      <Badge className="ml-2 bg-white/20 text-white text-xs">Active</Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Expanded Filters */}
              {showFilters && (
                <div className="mt-4 p-4 bg-[#18181b] rounded-lg border border-[#27272a]">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-[#fafafa]">Filters</h3>
                    {hasActiveFilters && (
                      <Button variant="ghost" size="sm" onClick={clearFilters} className="text-[#71717a] hover:text-[#fafafa]">
                        Clear all
                      </Button>
                    )}
                  </div>
                  <div className="grid grid-cols-5 gap-4">
                    {/* Status Filter */}
                    {statusColumn && (
                      <div>
                        <label className="block text-xs text-[#71717a] mb-1">Status</label>
                        <select
                          value={filters.status}
                          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                          className="w-full p-2 bg-[#27272a] border border-[#3f3f46] rounded-lg text-sm text-[#fafafa]"
                        >
                          <option value="">All</option>
                          {statusColumn.options?.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Priority Filter */}
                    {priorityColumn && (
                      <div>
                        <label className="block text-xs text-[#71717a] mb-1">Priority</label>
                        <select
                          value={filters.priority}
                          onChange={(e) => setFilters({ ...filters, priority: e.target.value })}
                          className="w-full p-2 bg-[#27272a] border border-[#3f3f46] rounded-lg text-sm text-[#fafafa]"
                        >
                          <option value="">All</option>
                          {priorityColumn.options?.map(opt => (
                            <option key={opt.id} value={opt.id}>{opt.name}</option>
                          ))}
                        </select>
                      </div>
                    )}

                    {/* Assignee Filter */}
                    <div>
                      <label className="block text-xs text-[#71717a] mb-1">Assignee</label>
                      <select
                        value={filters.assignee}
                        onChange={(e) => setFilters({ ...filters, assignee: e.target.value })}
                        className="w-full p-2 bg-[#27272a] border border-[#3f3f46] rounded-lg text-sm text-[#fafafa]"
                      >
                        <option value="">All</option>
                        {users.map(u => (
                          <option key={u.user_id} value={u.user_id}>{u.name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Date From */}
                    <div>
                      <label className="block text-xs text-[#71717a] mb-1">Date From</label>
                      <Input
                        type="date"
                        value={filters.dateFrom}
                        onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                        className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                      />
                    </div>

                    {/* Date To */}
                    <div>
                      <label className="block text-xs text-[#71717a] mb-1">Date To</label>
                      <Input
                        type="date"
                        value={filters.dateTo}
                        onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                        className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Table */}
            <div className="flex-1 overflow-auto p-6">
              <NotionTable
                columns={selectedDb.columns}
                rows={filteredRows}
                users={users}
                onUpdateCell={handleUpdateCell}
                onDeleteRow={handleDeleteRow}
                onAddColumn={handleAddColumn}
                onDeleteColumn={handleDeleteColumn}
                onAddRow={handleAddRow}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Database className="h-16 w-16 text-[#3f3f46] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[#fafafa] mb-2">No project selected</h2>
              <p className="text-[#a1a1aa] mb-4">Select a project from the sidebar or create a new one</p>
              <Button
                onClick={() => setShowTemplateModal(true)}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Project
              </Button>
            </div>
          </div>
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

// ============== NOTION TABLE ==============
function NotionTable({ columns, rows, users, onUpdateCell, onDeleteRow, onAddColumn, onDeleteColumn, onAddRow }) {
  const [editingCell, setEditingCell] = useState(null);
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
                    placeholder="Column name"
                    className="h-7 text-xs bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
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
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddColumn(true)}
                  className="text-[#71717a] hover:text-[#fafafa] text-xs"
                >
                  <Plus className="h-3 w-3 mr-1" />
                  Column
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
                    isEditing={editingCell === `${row.row_id}-${col.column_id}`}
                    onStartEdit={() => setEditingCell(`${row.row_id}-${col.column_id}`)}
                    onEndEdit={() => setEditingCell(null)}
                    onChange={(value) => onUpdateCell(row.row_id, col.column_id, value)}
                  />
                </td>
              ))}
              <td className="border-l border-[#27272a]"></td>
            </tr>
          ))}
          <tr className="border-t border-[#27272a]">
            <td colSpan={sortedColumns.length + 2} className="p-2">
              <Button
                variant="ghost"
                onClick={onAddRow}
                className="text-[#71717a] hover:text-[#fafafa] text-sm w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                New task
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============== CELL EDITOR ==============
function CellEditor({ column, value, users, isEditing, onStartEdit, onEndEdit, onChange }) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => { setLocalValue(value); }, [value]);
  useEffect(() => { if (isEditing && inputRef.current) inputRef.current.focus(); }, [isEditing]);

  const handleSave = () => { onChange(localValue); onEndEdit(); };
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && column.type !== 'text') handleSave();
    if (e.key === 'Escape') { setLocalValue(value); onEndEdit(); }
  };

  switch (column.type) {
    case 'text':
      return isEditing ? (
        <Input ref={inputRef} value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={onStartEdit} className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded">
          {value || <span className="text-[#52525b]">Empty</span>}
        </div>
      );

    case 'number':
      return isEditing ? (
        <Input ref={inputRef} type="number" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={onStartEdit} className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded">
          {value ?? <span className="text-[#52525b]">-</span>}
        </div>
      );

    case 'select':
      return <SelectCell column={column} value={value} onChange={onChange} />;

    case 'multi_select':
      return <MultiSelectCell column={column} value={value} onChange={onChange} />;

    case 'date':
      return isEditing ? (
        <Input ref={inputRef} type="date" value={localValue || ''}
          onChange={(e) => { setLocalValue(e.target.value); onChange(e.target.value); }}
          onBlur={onEndEdit} className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={onStartEdit} className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded flex items-center gap-2">
          {value ? <><Calendar className="h-3 w-3 text-[#71717a]" />{new Date(value).toLocaleDateString()}</> : <span className="text-[#52525b]">Set date</span>}
        </div>
      );

    case 'url':
      return isEditing ? (
        <Input ref={inputRef} type="url" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown} placeholder="https://"
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={onStartEdit} className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded">
          {value ? <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <Link2 className="h-3 w-3" />{value.replace(/^https?:\/\//, '').substring(0, 25)}
          </a> : <span className="text-[#52525b]">Add URL</span>}
        </div>
      );

    case 'email':
      return isEditing ? (
        <Input ref={inputRef} type="email" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={onStartEdit} className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded">
          {value ? <a href={`mailto:${value}`} className="text-[#6366f1] hover:underline" onClick={(e) => e.stopPropagation()}>{value}</a> : <span className="text-[#52525b]">Add email</span>}
        </div>
      );

    case 'phone':
      return isEditing ? (
        <Input ref={inputRef} type="tel" value={localValue || ''} onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave} onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]" />
      ) : (
        <div onClick={onStartEdit} className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded">
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
    if (!dbName.trim()) { toast.error('Enter a project name'); return; }
    if (selectedTemplate) onSelect(selectedTemplate, dbName);
    else onCreateBlank(dbName);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-[#18181b] border border-[#27272a] rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
          <h2 className="text-lg font-semibold text-[#fafafa]">New Project</h2>
          <Button variant="ghost" onClick={onClose} className="text-[#71717a]"><X className="h-5 w-5" /></Button>
        </div>
        <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 130px)' }}>
          <div className="mb-6">
            <label className="block text-sm text-[#a1a1aa] mb-2">Project Name</label>
            <Input value={dbName} onChange={(e) => setDbName(e.target.value)} placeholder="e.g., Website Development"
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
          <Button onClick={handleCreate} className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white">Create Project</Button>
        </div>
      </div>
    </div>
  );
}
