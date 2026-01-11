import React, { useState, useEffect, useCallback, useRef } from 'react';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { 
  Plus, Database, ChevronDown, ChevronRight, MoreHorizontal,
  Link2, Calendar, Hash, Mail, Phone, Check, User, X,
  Trash2, Edit2, Copy, GripVertical, Search, Filter,
  LayoutGrid, List, Table2
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
  { type: 'text', name: 'Text', icon: 'Aa' },
  { type: 'number', name: 'Number', icon: '#' },
  { type: 'select', name: 'Select', icon: '▼' },
  { type: 'multi_select', name: 'Multi-select', icon: '⊞' },
  { type: 'date', name: 'Date', icon: '📅' },
  { type: 'url', name: 'URL', icon: '🔗' },
  { type: 'email', name: 'Email', icon: '✉️' },
  { type: 'phone', name: 'Phone', icon: '📞' },
  { type: 'checkbox', name: 'Checkbox', icon: '☑️' },
  { type: 'person', name: 'Person', icon: '👤' }
];

export default function OperationsPage() {
  const [databases, setDatabases] = useState([]);
  const [selectedDb, setSelectedDb] = useState(null);
  const [rows, setRows] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [showNewDbModal, setShowNewDbModal] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [users, setUsers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState('table');
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  const loadDatabases = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/notion/databases`, { headers });
      setDatabases(res.data);
      if (res.data.length > 0 && !selectedDb) {
        setSelectedDb(res.data[0]);
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
      setShowNewDbModal(false);
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
      toast.success('Database created from template');
    } catch (error) {
      toast.error('Failed to create database');
    }
  };

  const handleDeleteDatabase = async (dbId) => {
    if (!window.confirm('Delete this database and all its data?')) return;
    try {
      await axios.delete(`${API}/api/notion/databases/${dbId}`, { headers });
      const newDbs = databases.filter(d => d.database_id !== dbId);
      setDatabases(newDbs);
      if (selectedDb?.database_id === dbId) {
        setSelectedDb(newDbs[0] || null);
      }
      toast.success('Database deleted');
    } catch (error) {
      toast.error('Failed to delete database');
    }
  };

  const handleAddRow = async () => {
    if (!selectedDb) return;
    try {
      const res = await axios.post(`${API}/api/notion/databases/${selectedDb.database_id}/rows`, { values: {} }, { headers });
      setRows([...rows, res.data]);
    } catch (error) {
      toast.error('Failed to add row');
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
      toast.error('Failed to update cell');
    }
  };

  const handleDeleteRow = async (rowId) => {
    try {
      await axios.delete(`${API}/api/notion/databases/${selectedDb.database_id}/rows/${rowId}`, { headers });
      setRows(rows.filter(r => r.row_id !== rowId));
    } catch (error) {
      toast.error('Failed to delete row');
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
      toast.success('Column deleted');
    } catch (error) {
      toast.error('Failed to delete column');
    }
  };

  const filteredRows = rows.filter(row => {
    if (!searchQuery) return true;
    return Object.values(row.values || {}).some(val => 
      String(val).toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  return (
    <Layout>
      <div className="h-full flex" data-testid="operations-page">
        {/* Sidebar - Database List */}
        <div className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col">
          <div className="p-4 border-b border-[#27272a]">
            <h2 className="text-lg font-semibold text-[#fafafa] mb-3">Databases</h2>
            <div className="flex gap-2">
              <Button
                onClick={() => setShowTemplateModal(true)}
                className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white text-sm"
                data-testid="new-database-btn"
              >
                <Plus className="h-4 w-4 mr-1" />
                New
              </Button>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2">
            {databases.map(db => (
              <div
                key={db.database_id}
                onClick={() => setSelectedDb(db)}
                className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer group ${
                  selectedDb?.database_id === db.database_id
                    ? 'bg-[#27272a] text-[#fafafa]'
                    : 'text-[#a1a1aa] hover:bg-[#27272a]/50'
                }`}
              >
                <span className="text-lg">{db.icon}</span>
                <span className="flex-1 truncate text-sm">{db.name}</span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => { e.stopPropagation(); handleDeleteDatabase(db.database_id); }}
                  className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-[#71717a] hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            ))}
            
            {databases.length === 0 && (
              <p className="text-center text-[#71717a] text-sm py-4">No databases yet</p>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col bg-[#09090b]">
          {selectedDb ? (
            <>
              {/* Database Header */}
              <div className="p-4 border-b border-[#27272a]">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{selectedDb.icon}</span>
                    <h1 className="text-2xl font-bold text-[#fafafa]">{selectedDb.name}</h1>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#71717a]" />
                      <Input
                        placeholder="Search..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-9 w-64 bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                      />
                    </div>
                    <Button
                      onClick={handleAddRow}
                      className="bg-[#10b981] hover:bg-[#059669] text-white"
                      data-testid="add-row-btn"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      New
                    </Button>
                  </div>
                </div>
              </div>

              {/* Table View */}
              <div className="flex-1 overflow-auto p-4">
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
                <h2 className="text-xl font-semibold text-[#fafafa] mb-2">No database selected</h2>
                <p className="text-[#a1a1aa] mb-4">Create a new database or select one from the sidebar</p>
                <Button
                  onClick={() => setShowTemplateModal(true)}
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Database
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Template Selection Modal */}
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

// ============== NOTION TABLE COMPONENT ==============
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
    <div className="min-w-full">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b border-[#27272a]">
            <th className="w-8 p-2 text-left"></th>
            {sortedColumns.map(col => (
              <th 
                key={col.column_id} 
                className="p-2 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider group"
                style={{ minWidth: col.width || 200 }}
              >
                <div className="flex items-center gap-2">
                  {COLUMN_ICONS[col.type]}
                  <span>{col.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteColumn(col.column_id)}
                    className="opacity-0 group-hover:opacity-100 h-5 w-5 p-0 text-[#71717a] hover:text-red-400"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </th>
            ))}
            <th className="w-32 p-2">
              {showAddColumn ? (
                <div className="flex items-center gap-1">
                  <Input
                    value={newColumnName}
                    onChange={(e) => setNewColumnName(e.target.value)}
                    placeholder="Name"
                    className="h-7 text-xs bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleAddColumn()}
                  />
                  <select
                    value={newColumnType}
                    onChange={(e) => setNewColumnType(e.target.value)}
                    className="h-7 text-xs bg-[#27272a] border border-[#3f3f46] rounded text-[#fafafa]"
                  >
                    {COLUMN_TYPES.map(t => (
                      <option key={t.type} value={t.type}>{t.name}</option>
                    ))}
                  </select>
                  <Button size="sm" onClick={handleAddColumn} className="h-7 bg-[#10b981] hover:bg-[#059669]">
                    <Check className="h-3 w-3" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowAddColumn(false)} className="h-7">
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
                  Add Column
                </Button>
              )}
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, rowIndex) => (
            <tr key={row.row_id} className="border-b border-[#27272a]/50 hover:bg-[#27272a]/30 group">
              <td className="p-2">
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRow(row.row_id)}
                    className="h-6 w-6 p-0 text-[#71717a] hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </td>
              {sortedColumns.map(col => (
                <td key={col.column_id} className="p-1">
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
              <td></td>
            </tr>
          ))}
          
          {/* Add New Row */}
          <tr className="border-b border-[#27272a]/30">
            <td colSpan={sortedColumns.length + 2} className="p-2">
              <Button
                variant="ghost"
                onClick={onAddRow}
                className="text-[#71717a] hover:text-[#fafafa] text-sm w-full justify-start"
              >
                <Plus className="h-4 w-4 mr-2" />
                New row
              </Button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ============== CELL EDITOR COMPONENT ==============
function CellEditor({ column, value, users, isEditing, onStartEdit, onEndEdit, onChange }) {
  const [localValue, setLocalValue] = useState(value);
  const inputRef = useRef(null);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isEditing]);

  const handleSave = () => {
    onChange(localValue);
    onEndEdit();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && column.type !== 'text') {
      handleSave();
    }
    if (e.key === 'Escape') {
      setLocalValue(value);
      onEndEdit();
    }
  };

  // Render based on column type
  switch (column.type) {
    case 'text':
      return isEditing ? (
        <Input
          ref={inputRef}
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]"
        />
      ) : (
        <div
          onClick={onStartEdit}
          className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded"
        >
          {value || <span className="text-[#71717a]">Empty</span>}
        </div>
      );

    case 'number':
      return isEditing ? (
        <Input
          ref={inputRef}
          type="number"
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]"
        />
      ) : (
        <div
          onClick={onStartEdit}
          className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded"
        >
          {value || <span className="text-[#71717a]">-</span>}
        </div>
      );

    case 'select':
      return (
        <SelectCell
          column={column}
          value={value}
          onChange={onChange}
        />
      );

    case 'multi_select':
      return (
        <MultiSelectCell
          column={column}
          value={value}
          onChange={onChange}
        />
      );

    case 'date':
      return isEditing ? (
        <Input
          ref={inputRef}
          type="date"
          value={localValue || ''}
          onChange={(e) => { setLocalValue(e.target.value); onChange(e.target.value); }}
          onBlur={onEndEdit}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]"
        />
      ) : (
        <div
          onClick={onStartEdit}
          className="min-h-[32px] px-2 py-1 cursor-text text-[#fafafa] hover:bg-[#27272a] rounded flex items-center gap-2"
        >
          {value ? (
            <>
              <Calendar className="h-3 w-3 text-[#71717a]" />
              {new Date(value).toLocaleDateString()}
            </>
          ) : (
            <span className="text-[#71717a]">No date</span>
          )}
        </div>
      );

    case 'url':
      return isEditing ? (
        <Input
          ref={inputRef}
          type="url"
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          placeholder="https://"
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]"
        />
      ) : (
        <div
          onClick={onStartEdit}
          className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded flex items-center gap-2"
        >
          {value ? (
            <a href={value} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <Link2 className="h-3 w-3" />
              {value.replace(/^https?:\/\//, '').substring(0, 30)}...
            </a>
          ) : (
            <span className="text-[#71717a]">Add URL</span>
          )}
        </div>
      );

    case 'email':
      return isEditing ? (
        <Input
          ref={inputRef}
          type="email"
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]"
        />
      ) : (
        <div
          onClick={onStartEdit}
          className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded"
        >
          {value ? (
            <a href={`mailto:${value}`} className="text-[#6366f1] hover:underline" onClick={(e) => e.stopPropagation()}>
              {value}
            </a>
          ) : (
            <span className="text-[#71717a]">Add email</span>
          )}
        </div>
      );

    case 'phone':
      return isEditing ? (
        <Input
          ref={inputRef}
          type="tel"
          value={localValue || ''}
          onChange={(e) => setLocalValue(e.target.value)}
          onBlur={handleSave}
          onKeyDown={handleKeyDown}
          className="h-8 bg-[#27272a] border-[#6366f1] text-[#fafafa]"
        />
      ) : (
        <div
          onClick={onStartEdit}
          className="min-h-[32px] px-2 py-1 cursor-text hover:bg-[#27272a] rounded"
        >
          {value ? (
            <a href={`tel:${value}`} className="text-[#fafafa]" onClick={(e) => e.stopPropagation()}>
              {value}
            </a>
          ) : (
            <span className="text-[#71717a]">Add phone</span>
          )}
        </div>
      );

    case 'checkbox':
      return (
        <div className="flex items-center justify-center">
          <input
            type="checkbox"
            checked={!!value}
            onChange={(e) => onChange(e.target.checked)}
            className="h-4 w-4 rounded border-[#3f3f46] bg-[#27272a] text-[#6366f1] focus:ring-[#6366f1]"
          />
        </div>
      );

    case 'person':
      return (
        <PersonCell
          value={value}
          users={users}
          onChange={onChange}
        />
      );

    default:
      return <div className="px-2 py-1 text-[#fafafa]">{String(value || '')}</div>;
  }
}

// ============== SELECT CELL ==============
function SelectCell({ column, value, onChange }) {
  const [isOpen, setIsOpen] = useState(false);
  const options = column.options || [];
  
  const selectedOption = options.find(o => o.id === value || o.name === value);

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[32px] px-2 py-1 cursor-pointer hover:bg-[#27272a] rounded flex items-center"
      >
        {selectedOption ? (
          <Badge style={{ backgroundColor: `${selectedOption.color}20`, color: selectedOption.color }}>
            {selectedOption.name}
          </Badge>
        ) : (
          <span className="text-[#71717a]">Select...</span>
        )}
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-xl min-w-[150px] py-1">
            <div
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="px-3 py-2 text-sm text-[#71717a] hover:bg-[#3f3f46] cursor-pointer"
            >
              Clear
            </div>
            {options.map(opt => (
              <div
                key={opt.id}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                className="px-3 py-2 hover:bg-[#3f3f46] cursor-pointer flex items-center gap-2"
              >
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
  
  const selectedOptions = options.filter(o => selectedIds.includes(o.id));

  const toggleOption = (optId) => {
    const newValue = selectedIds.includes(optId)
      ? selectedIds.filter(id => id !== optId)
      : [...selectedIds, optId];
    onChange(newValue);
  };

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[32px] px-2 py-1 cursor-pointer hover:bg-[#27272a] rounded flex flex-wrap gap-1"
      >
        {selectedOptions.length > 0 ? (
          selectedOptions.map(opt => (
            <Badge key={opt.id} style={{ backgroundColor: `${opt.color}20`, color: opt.color }} className="text-xs">
              {opt.name}
            </Badge>
          ))
        ) : (
          <span className="text-[#71717a]">Select...</span>
        )}
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-xl min-w-[150px] py-1">
            {options.map(opt => (
              <div
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className="px-3 py-2 hover:bg-[#3f3f46] cursor-pointer flex items-center gap-2"
              >
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
  const selectedUser = users.find(u => u.user_id === value);

  return (
    <div className="relative">
      <div
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[32px] px-2 py-1 cursor-pointer hover:bg-[#27272a] rounded flex items-center gap-2"
      >
        {selectedUser ? (
          <>
            <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">
              {selectedUser.name?.charAt(0).toUpperCase()}
            </div>
            <span className="text-[#fafafa] text-sm">{selectedUser.name}</span>
          </>
        ) : (
          <span className="text-[#71717a]">Assign...</span>
        )}
      </div>
      
      {isOpen && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setIsOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#27272a] border border-[#3f3f46] rounded-lg shadow-xl min-w-[180px] py-1 max-h-[200px] overflow-y-auto">
            <div
              onClick={() => { onChange(null); setIsOpen(false); }}
              className="px-3 py-2 text-sm text-[#71717a] hover:bg-[#3f3f46] cursor-pointer"
            >
              Unassign
            </div>
            {users.map(user => (
              <div
                key={user.user_id}
                onClick={() => { onChange(user.user_id); setIsOpen(false); }}
                className="px-3 py-2 hover:bg-[#3f3f46] cursor-pointer flex items-center gap-2"
              >
                <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">
                  {user.name?.charAt(0).toUpperCase()}
                </div>
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
    if (!dbName.trim()) {
      toast.error('Please enter a name');
      return;
    }
    if (selectedTemplate) {
      onSelect(selectedTemplate, dbName);
    } else {
      onCreateBlank(dbName);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="bg-[#18181b] border-[#27272a] w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between border-b border-[#27272a]">
          <CardTitle className="text-[#fafafa]">Create New Database</CardTitle>
          <Button variant="ghost" onClick={onClose} className="text-[#a1a1aa]">
            <X className="h-5 w-5" />
          </Button>
        </CardHeader>
        <CardContent className="flex-1 overflow-y-auto p-4">
          {/* Name Input */}
          <div className="mb-6">
            <label className="block text-sm text-[#a1a1aa] mb-2">Database Name</label>
            <Input
              value={dbName}
              onChange={(e) => setDbName(e.target.value)}
              placeholder="Enter database name..."
              className="bg-[#27272a] border-[#3f3f46] text-[#fafafa]"
              autoFocus
            />
          </div>

          {/* Templates */}
          <div className="mb-4">
            <label className="block text-sm text-[#a1a1aa] mb-3">Choose a Template (optional)</label>
            <div className="grid grid-cols-2 gap-3">
              {/* Blank option */}
              <div
                onClick={() => setSelectedTemplate(null)}
                className={`p-4 rounded-lg border cursor-pointer transition-all ${
                  selectedTemplate === null
                    ? 'border-[#6366f1] bg-[#6366f1]/10'
                    : 'border-[#27272a] hover:border-[#3f3f46]'
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-2xl">📄</span>
                  <span className="font-medium text-[#fafafa]">Blank</span>
                </div>
                <p className="text-xs text-[#71717a]">Start from scratch with default columns</p>
              </div>

              {/* Templates */}
              {templates.map(template => (
                <div
                  key={template.id}
                  onClick={() => setSelectedTemplate(template.id)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedTemplate === template.id
                      ? 'border-[#6366f1] bg-[#6366f1]/10'
                      : 'border-[#27272a] hover:border-[#3f3f46]'
                  }`}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{template.icon}</span>
                    <span className="font-medium text-[#fafafa]">{template.name}</span>
                  </div>
                  <p className="text-xs text-[#71717a]">{template.description}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-[#27272a]">
            <Button
              onClick={onClose}
              className="flex-1 bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
            >
              Create Database
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
