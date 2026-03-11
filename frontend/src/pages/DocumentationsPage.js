import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit2,
  X,
  Link as LinkIcon,
  Users,
  Briefcase,
  Globe,
  Search,
  TrendingUp,
  Megaphone
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

// Department configuration with icons
const DEPARTMENT_CONFIG = {
  ceo: { name: 'CEO', icon: Users, color: '#ef4444' },
  bd: { name: 'BD', icon: Briefcase, color: '#3b82f6' },
  operations: { name: 'Operations', icon: TrendingUp, color: '#8b5cf6' },
  website: { name: 'Website', icon: Globe, color: '#22c55e' },
  seo: { name: 'SEO', icon: Search, color: '#f59e0b' },
  meta: { name: 'Meta', icon: Megaphone, color: '#ec4899' },
};

const DocumentationsPage = () => {
  const { isDark } = useTheme();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';

  // User info state
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);

  // For admin view - all documents grouped by department
  const [allDocuments, setAllDocuments] = useState({});
  const [deptStats, setDeptStats] = useState({});
  const [activeDept, setActiveDept] = useState('ceo');

  // For regular user view
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ sheets: 0, docs: 0, total: 0 });
  const [activeDocType, setActiveDocType] = useState('sheets');

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    link: '',
    description: '',
    department: ''
  });

  // Load user info
  const loadUserInfo = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/docs/user-info`, { headers });
      setUserInfo(res.data);
      if (res.data.department) {
        setActiveDept(res.data.department);
      }
      return res.data;
    } catch (error) {
      console.error('Error loading user info:', error);
      return null;
    }
  }, []);

  // Load documents for regular users
  const loadDocuments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/docs/documents`, { headers });
      setDocuments(res.data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  }, []);

  // Load all documents grouped (admin only)
  const loadAllDocumentsGrouped = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/docs/documents/all`, { headers });
      setAllDocuments(res.data || {});
    } catch (error) {
      console.error('Error loading all documents:', error);
    }
  }, []);

  // Load stats
  const loadStats = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/docs/stats`, { headers });
      setStats(res.data || { sheets: 0, docs: 0, total: 0 });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }, []);

  // Load stats by department (admin only)
  const loadStatsByDepartment = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/docs/stats/by-department`, { headers });
      setDeptStats(res.data || {});
    } catch (error) {
      console.error('Error loading department stats:', error);
    }
  }, []);

  // Initial load
  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      const info = await loadUserInfo();
      
      if (info?.can_view_all) {
        // Admin view - load all documents grouped
        await Promise.all([loadAllDocumentsGrouped(), loadStatsByDepartment()]);
      } else {
        // Regular user view - load only their department's documents
        await Promise.all([loadDocuments(), loadStats()]);
      }
      setLoading(false);
    };
    loadAll();
  }, [loadUserInfo, loadDocuments, loadStats, loadAllDocumentsGrouped, loadStatsByDepartment]);

  // Refresh data
  const refreshData = async () => {
    if (userInfo?.can_view_all) {
      await Promise.all([loadAllDocumentsGrouped(), loadStatsByDepartment()]);
    } else {
      await Promise.all([loadDocuments(), loadStats()]);
    }
  };

  // Filter documents by type for regular users
  const sheets = documents.filter(d => d.doc_type === 'sheet');
  const docs = documents.filter(d => d.doc_type === 'doc');

  // Reset form
  const resetForm = () => {
    setFormData({ name: '', link: '', description: '', department: userInfo?.can_view_all ? activeDept : '' });
    setEditingDoc(null);
  };

  // Open add modal
  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  // Open edit modal
  const openEditModal = (doc) => {
    setEditingDoc(doc);
    setFormData({
      name: doc.name,
      link: doc.link,
      description: doc.description || '',
      department: doc.department || ''
    });
    setShowAddModal(true);
  };

  // Save document
  const saveDocument = async () => {
    if (!formData.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (!formData.link.trim()) {
      toast.error('Link is required');
      return;
    }

    try {
      const docType = userInfo?.can_view_all 
        ? (activeDocType === 'sheets' ? 'sheet' : 'doc')
        : (activeDocType === 'sheets' ? 'sheet' : 'doc');

      if (editingDoc) {
        await axios.put(`${API}/api/docs/documents/${editingDoc.doc_id}`, {
          name: formData.name,
          link: formData.link,
          description: formData.description
        }, { headers });
        toast.success('Document updated');
      } else {
        await axios.post(`${API}/api/docs/documents`, {
          name: formData.name,
          link: formData.link,
          description: formData.description,
          doc_type: docType,
          department: userInfo?.can_view_all ? (formData.department || activeDept) : undefined
        }, { headers });
        toast.success('Document added');
      }
      setShowAddModal(false);
      resetForm();
      refreshData();
    } catch (error) {
      toast.error('Failed to save document');
    }
  };

  // Delete document
  const deleteDocument = async (docId) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    
    try {
      await axios.delete(`${API}/api/docs/documents/${docId}`, { headers });
      toast.success('Document deleted');
      refreshData();
    } catch (error) {
      toast.error('Failed to delete document');
    }
  };

  // Open document in viewer
  const openViewer = (doc) => {
    setSelectedDoc(doc);
    setShowViewModal(true);
  };

  // Get embeddable URL for Google Docs/Sheets
  const getEmbedUrl = (url) => {
    if (url.includes('docs.google.com/spreadsheets')) {
      if (url.includes('/edit')) return url.replace('/edit', '/preview');
      if (!url.includes('/preview')) return url + '/preview';
    }
    if (url.includes('docs.google.com/document')) {
      if (url.includes('/edit')) return url.replace('/edit', '/preview');
      if (!url.includes('/preview')) return url + '/preview';
    }
    return url;
  };

  // Document table component
  const DocumentTable = ({ items, type }) => (
    <div className={`rounded-lg border ${borderColor} overflow-hidden`}>
      <table className="w-full">
        <thead className={bgSecondary}>
          <tr>
            <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider w-16`}>
              S.No
            </th>
            <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider`}>
              {type === 'sheet' ? 'Sheet Name' : 'Document Name'}
            </th>
            <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider`}>
              Link
            </th>
            <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase tracking-wider`}>
              Added By
            </th>
            <th className={`px-4 py-3 text-right text-xs font-medium ${textSecondary} uppercase tracking-wider w-32`}>
              Actions
            </th>
          </tr>
        </thead>
        <tbody className={`divide-y ${borderColor}`}>
          {items.length === 0 ? (
            <tr>
              <td colSpan={5} className={`px-4 py-8 text-center ${textSecondary}`}>
                No {type === 'sheet' ? 'sheets' : 'documents'} added yet
              </td>
            </tr>
          ) : (
            items.map((doc, index) => (
              <tr key={doc.doc_id} className={`${isDark ? 'hover:bg-[#27272a]/50' : 'hover:bg-gray-50'}`}>
                <td className={`px-4 py-3 ${textSecondary}`}>{index + 1}</td>
                <td className={`px-4 py-3`}>
                  <div>
                    <p className={`font-medium ${textPrimary}`}>{doc.name}</p>
                    {doc.description && (
                      <p className={`text-xs ${textSecondary} mt-0.5`}>{doc.description}</p>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3`}>
                  <a 
                    href={doc.link} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-[#3b82f6] hover:underline text-sm flex items-center gap-1 max-w-[200px] truncate"
                  >
                    <LinkIcon className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">{doc.link}</span>
                  </a>
                </td>
                <td className={`px-4 py-3 ${textSecondary} text-sm`}>
                  {doc.created_by_name}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => openViewer(doc)}
                      className="bg-[#22c55e] hover:bg-[#16a34a] h-8"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(doc)}
                      className="h-8 w-8 p-0"
                    >
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteDocument(doc.doc_id)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  if (loading) {
    return (
      <Layout>
        <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} flex items-center justify-center`}>
          <p className={textSecondary}>Loading...</p>
        </div>
      </Layout>
    );
  }

  // ============== ADMIN VIEW ==============
  if (userInfo?.can_view_all) {
    const currentDeptDocs = allDocuments[activeDept] || { sheets: [], docs: [] };
    const currentDeptStats = deptStats[activeDept] || { sheets: 0, docs: 0, total: 0 };

    return (
      <Layout>
        <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
          {/* Header */}
          <div className={`p-6 border-b ${borderColor}`}>
            <div className="flex items-center justify-between">
              <div>
                <h1 className={`text-2xl font-bold ${textPrimary}`}>Documentations</h1>
                <p className={`${textSecondary} mt-1`}>
                  View and manage documents across all departments
                </p>
              </div>
            </div>
          </div>

          {/* Department Tabs */}
          <div className="p-6">
            <Tabs value={activeDept} onValueChange={setActiveDept} className="w-full">
              <TabsList className={`${bgCard} border ${borderColor} h-auto flex-wrap p-1 mb-6`}>
                {Object.entries(DEPARTMENT_CONFIG).map(([key, config]) => {
                  const Icon = config.icon;
                  const deptStat = deptStats[key] || { total: 0 };
                  return (
                    <TabsTrigger
                      key={key}
                      value={key}
                      className="data-[state=active]:text-white px-4 py-2"
                      style={{
                        backgroundColor: activeDept === key ? config.color : 'transparent',
                      }}
                    >
                      <Icon className="h-4 w-4 mr-2" />
                      {config.name}
                      {deptStat.total > 0 && (
                        <Badge className="ml-2 bg-white/20 text-inherit">{deptStat.total}</Badge>
                      )}
                    </TabsTrigger>
                  );
                })}
              </TabsList>

              {Object.keys(DEPARTMENT_CONFIG).map((deptKey) => (
                <TabsContent key={deptKey} value={deptKey} className="mt-0">
                  {/* Stats for selected department */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex gap-3">
                      <Badge className={`${bgSecondary} ${textSecondary}`}>
                        <FileSpreadsheet className="h-3 w-3 mr-1" />
                        {(deptStats[deptKey] || {}).sheets || 0} Sheets
                      </Badge>
                      <Badge className={`${bgSecondary} ${textSecondary}`}>
                        <FileText className="h-3 w-3 mr-1" />
                        {(deptStats[deptKey] || {}).docs || 0} Docs
                      </Badge>
                    </div>
                    <Button
                      onClick={openAddModal}
                      style={{ backgroundColor: DEPARTMENT_CONFIG[deptKey].color }}
                      className="hover:opacity-90"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Add Document
                    </Button>
                  </div>

                  {/* Sheets/Docs sub-tabs */}
                  <Tabs value={activeDocType} onValueChange={setActiveDocType} className="w-full">
                    <TabsList className={`${bgCard} border ${borderColor} mb-4`}>
                      <TabsTrigger
                        value="sheets"
                        className="data-[state=active]:bg-[#22c55e] data-[state=active]:text-white"
                      >
                        <FileSpreadsheet className="h-4 w-4 mr-2" />
                        Sheets ({(allDocuments[deptKey] || {}).sheets?.length || 0})
                      </TabsTrigger>
                      <TabsTrigger
                        value="docs"
                        className="data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Docs ({(allDocuments[deptKey] || {}).docs?.length || 0})
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="sheets" className="mt-0">
                      <DocumentTable 
                        items={(allDocuments[deptKey] || {}).sheets || []} 
                        type="sheet" 
                      />
                    </TabsContent>
                    <TabsContent value="docs" className="mt-0">
                      <DocumentTable 
                        items={(allDocuments[deptKey] || {}).docs || []} 
                        type="doc" 
                      />
                    </TabsContent>
                  </Tabs>
                </TabsContent>
              ))}
            </Tabs>
          </div>

          {/* Add Modal for Admin - includes department selector */}
          <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
            <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
              <DialogHeader>
                <DialogTitle>
                  {editingDoc ? 'Edit' : 'Add'} Document
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Department</label>
                  <Select 
                    value={formData.department || activeDept} 
                    onValueChange={(val) => setFormData({ ...formData, department: val })}
                  >
                    <SelectTrigger className={bgSecondary}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      {Object.entries(DEPARTMENT_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <div 
                              className="w-3 h-3 rounded-full" 
                              style={{ backgroundColor: config.color }}
                            />
                            {config.name}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Type</label>
                  <Select 
                    value={activeDocType} 
                    onValueChange={setActiveDocType}
                  >
                    <SelectTrigger className={bgSecondary}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className={`${bgCard} border ${borderColor}`}>
                      <SelectItem value="sheets">
                        <div className="flex items-center gap-2">
                          <FileSpreadsheet className="h-4 w-4 text-[#22c55e]" />
                          Sheet
                        </div>
                      </SelectItem>
                      <SelectItem value="docs">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-[#3b82f6]" />
                          Document
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Name *</label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="e.g., Sales Report Q4"
                    className={bgSecondary}
                  />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Link *</label>
                  <Input
                    value={formData.link}
                    onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                    placeholder="https://docs.google.com/..."
                    className={bgSecondary}
                  />
                </div>
                <div>
                  <label className={`text-sm ${textSecondary} block mb-1`}>Description (Optional)</label>
                  <Input
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Brief description..."
                    className={bgSecondary}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setShowAddModal(false); resetForm(); }}>
                  Cancel
                </Button>
                <Button 
                  onClick={saveDocument}
                  style={{ backgroundColor: DEPARTMENT_CONFIG[formData.department || activeDept]?.color }}
                >
                  {editingDoc ? 'Update' : 'Add'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Document Viewer Modal */}
          <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
            <DialogContent className={`${bgCard} ${textPrimary} max-w-[95vw] w-[1400px] h-[85vh] p-0`}>
              <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
                <div className="flex items-center gap-3">
                  {selectedDoc?.doc_type === 'sheet' ? (
                    <FileSpreadsheet className="h-5 w-5 text-[#22c55e]" />
                  ) : (
                    <FileText className="h-5 w-5 text-[#3b82f6]" />
                  )}
                  <div>
                    <h3 className={`font-semibold ${textPrimary}`}>{selectedDoc?.name}</h3>
                    <div className="flex items-center gap-2">
                      {selectedDoc?.department && (
                        <Badge 
                          style={{ 
                            backgroundColor: `${DEPARTMENT_CONFIG[selectedDoc.department]?.color}20`,
                            color: DEPARTMENT_CONFIG[selectedDoc.department]?.color 
                          }}
                        >
                          {DEPARTMENT_CONFIG[selectedDoc.department]?.name}
                        </Badge>
                      )}
                      {selectedDoc?.description && (
                        <span className={`text-xs ${textSecondary}`}>{selectedDoc.description}</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(selectedDoc?.link, '_blank')}
                    className={borderColor}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open in New Tab
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowViewModal(false)}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 h-[calc(85vh-70px)]">
                {selectedDoc && (
                  <iframe
                    src={getEmbedUrl(selectedDoc.link)}
                    className="w-full h-full border-0"
                    title={selectedDoc.name}
                    allow="fullscreen"
                  />
                )}
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </Layout>
    );
  }

  // ============== REGULAR USER VIEW ==============
  return (
    <Layout>
      <div className={`min-h-screen ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
        {/* Header */}
        <div className={`p-6 border-b ${borderColor}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-2xl font-bold ${textPrimary}`}>My Documents</h1>
              <p className={`${textSecondary} mt-1`}>
                Manage your Google Sheets and Documents
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Badge 
                style={{ 
                  backgroundColor: `${DEPARTMENT_CONFIG[userInfo?.department]?.color}20`,
                  color: DEPARTMENT_CONFIG[userInfo?.department]?.color 
                }}
              >
                {DEPARTMENT_CONFIG[userInfo?.department]?.name || 'My Department'}
              </Badge>
              <Badge className={`${bgSecondary} ${textSecondary}`}>
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {stats.sheets} Sheets
              </Badge>
              <Badge className={`${bgSecondary} ${textSecondary}`}>
                <FileText className="h-3 w-3 mr-1" />
                {stats.docs} Docs
              </Badge>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="p-6">
          <Tabs value={activeDocType} onValueChange={setActiveDocType} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className={`${bgCard} border ${borderColor}`}>
                <TabsTrigger 
                  value="sheets" 
                  className="data-[state=active]:bg-[#22c55e] data-[state=active]:text-white"
                >
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Sheets ({sheets.length})
                </TabsTrigger>
                <TabsTrigger 
                  value="docs"
                  className="data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Docs ({docs.length})
                </TabsTrigger>
              </TabsList>

              <Button
                onClick={openAddModal}
                className={activeDocType === 'sheets' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-[#3b82f6] hover:bg-[#2563eb]'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {activeDocType === 'sheets' ? 'Sheet' : 'Document'}
              </Button>
            </div>

            <TabsContent value="sheets" className="mt-0">
              <DocumentTable items={sheets} type="sheet" />
            </TabsContent>

            <TabsContent value="docs" className="mt-0">
              <DocumentTable items={docs} type="doc" />
            </TabsContent>
          </Tabs>
        </div>

        {/* Add/Edit Modal for Regular Users */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle>
                {editingDoc ? 'Edit' : 'Add'} {activeDocType === 'sheets' ? 'Sheet' : 'Document'}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={activeDocType === 'sheets' ? 'e.g., Sales Report Q4' : 'e.g., Project Proposal'}
                  className={bgSecondary}
                />
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Link *</label>
                <Input
                  value={formData.link}
                  onChange={(e) => setFormData({ ...formData, link: e.target.value })}
                  placeholder="https://docs.google.com/..."
                  className={bgSecondary}
                />
                <p className={`text-xs ${textSecondary} mt-1`}>
                  Paste the Google {activeDocType === 'sheets' ? 'Sheets' : 'Docs'} URL
                </p>
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Description (Optional)</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description..."
                  className={bgSecondary}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowAddModal(false); resetForm(); }}>
                Cancel
              </Button>
              <Button 
                onClick={saveDocument}
                className={activeDocType === 'sheets' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-[#3b82f6] hover:bg-[#2563eb]'}
              >
                {editingDoc ? 'Update' : 'Add'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Document Viewer Modal */}
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-[95vw] w-[1400px] h-[85vh] p-0`}>
            <div className={`flex items-center justify-between p-4 border-b ${borderColor}`}>
              <div className="flex items-center gap-3">
                {selectedDoc?.doc_type === 'sheet' ? (
                  <FileSpreadsheet className="h-5 w-5 text-[#22c55e]" />
                ) : (
                  <FileText className="h-5 w-5 text-[#3b82f6]" />
                )}
                <div>
                  <h3 className={`font-semibold ${textPrimary}`}>{selectedDoc?.name}</h3>
                  {selectedDoc?.description && (
                    <p className={`text-xs ${textSecondary}`}>{selectedDoc.description}</p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedDoc?.link, '_blank')}
                  className={borderColor}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowViewModal(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 h-[calc(85vh-70px)]">
              {selectedDoc && (
                <iframe
                  src={getEmbedUrl(selectedDoc.link)}
                  className="w-full h-full border-0"
                  title={selectedDoc.name}
                  allow="fullscreen"
                />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default DocumentationsPage;
