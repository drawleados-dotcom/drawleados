import React, { useState, useEffect, useCallback } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { 
  FileSpreadsheet, 
  FileText, 
  Plus, 
  ExternalLink, 
  Trash2, 
  Edit2,
  X,
  Link as LinkIcon,
  FolderOpen
} from 'lucide-react';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

export default function MyDocumentsPage() {
  const { isDark } = useTheme();
  const { user } = useAuth();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Theme classes
  const bgPage = isDark ? 'bg-[#09090b]' : 'bg-gray-50';
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  // State
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState('sheets');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [editingDoc, setEditingDoc] = useState(null);
  const [formData, setFormData] = useState({ name: '', link: '', description: '' });

  // Load my documents
  const loadDocuments = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/docs/my-documents`, { headers });
      setDocuments(res.data || []);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  // Filter by type
  const sheets = documents.filter(d => d.doc_type === 'sheet');
  const docs = documents.filter(d => d.doc_type === 'doc');

  // Reset form
  const resetForm = () => {
    setFormData({ name: '', link: '', description: '' });
    setEditingDoc(null);
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
      if (editingDoc) {
        await axios.put(`${API}/api/docs/documents/${editingDoc.doc_id}`, {
          name: formData.name,
          link: formData.link,
          description: formData.description
        }, { headers });
        toast.success('Document updated');
      } else {
        await axios.post(`${API}/api/docs/my-documents`, {
          name: formData.name,
          link: formData.link,
          description: formData.description,
          doc_type: activeTab === 'sheets' ? 'sheet' : 'doc'
        }, { headers });
        toast.success('Document added');
      }
      setShowAddModal(false);
      resetForm();
      loadDocuments();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save document');
    }
  };

  // Delete document
  const deleteDocument = async (docId) => {
    if (!window.confirm('Delete this document?')) return;
    try {
      await axios.delete(`${API}/api/docs/documents/${docId}`, { headers });
      toast.success('Document deleted');
      loadDocuments();
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  // Open edit modal
  const openEditModal = (doc) => {
    setEditingDoc(doc);
    setFormData({ name: doc.name, link: doc.link, description: doc.description || '' });
    setShowAddModal(true);
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

  // Document table
  const DocumentTable = ({ items, type }) => (
    <Card className={`${bgCard} border ${borderColor}`}>
      <CardContent className="p-0">
        <table className="w-full">
          <thead className={bgSecondary}>
            <tr>
              <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase w-16`}>S.No</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Name</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Link</th>
              <th className={`px-4 py-3 text-left text-xs font-medium ${textSecondary} uppercase`}>Added</th>
              <th className={`px-4 py-3 text-right text-xs font-medium ${textSecondary} uppercase w-32`}>Actions</th>
            </tr>
          </thead>
          <tbody className={`divide-y ${borderColor}`}>
            {items.length === 0 ? (
              <tr>
                <td colSpan={5} className={`px-4 py-12 text-center ${textSecondary}`}>
                  <FolderOpen className="h-12 w-12 mx-auto mb-3 opacity-50" />
                  <p>No {type === 'sheet' ? 'sheets' : 'documents'} yet</p>
                  <Button onClick={() => setShowAddModal(true)} className="mt-4 bg-[#6366f1]">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First {type === 'sheet' ? 'Sheet' : 'Document'}
                  </Button>
                </td>
              </tr>
            ) : items.map((doc, index) => (
              <tr key={doc.doc_id} className={`${isDark ? 'hover:bg-[#27272a]/50' : 'hover:bg-gray-50'}`}>
                <td className={`px-4 py-3 ${textSecondary}`}>{index + 1}</td>
                <td className="px-4 py-3">
                  <div>
                    <p className={`font-medium ${textPrimary}`}>{doc.name}</p>
                    {doc.description && <p className={`text-xs ${textSecondary} mt-0.5`}>{doc.description}</p>}
                  </div>
                </td>
                <td className="px-4 py-3">
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
                <td className={`px-4 py-3 text-sm ${textSecondary}`}>
                  {doc.created_at ? new Date(doc.created_at).toLocaleDateString() : '-'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      size="sm"
                      onClick={() => { setSelectedDoc(doc); setShowViewModal(true); }}
                      className="bg-[#22c55e] hover:bg-[#16a34a] h-8"
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Open
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEditModal(doc)} className="h-8 w-8 p-0">
                      <Edit2 className="h-3 w-3" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => deleteDocument(doc.doc_id)} className="h-8 w-8 p-0 text-red-400 hover:text-red-500">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <Layout>
        <div className={`h-full flex items-center justify-center ${bgPage}`}>
          <div className="animate-spin h-8 w-8 border-2 border-[#6366f1] border-t-transparent rounded-full" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`h-full flex flex-col ${bgPage}`} data-testid="my-documents-page">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${borderColor} ${bgCard}`}>
          <div className="flex items-center justify-between">
            <div>
              <h1 className={`text-xl font-semibold ${textPrimary}`}>My Documents</h1>
              <p className={`text-sm ${textSecondary}`}>Your personal Google Sheets & Documents</p>
            </div>
            <div className="flex items-center gap-3">
              <Badge className={`${bgSecondary} ${textSecondary}`}>
                <FileSpreadsheet className="h-3 w-3 mr-1" />
                {sheets.length} Sheets
              </Badge>
              <Badge className={`${bgSecondary} ${textSecondary}`}>
                <FileText className="h-3 w-3 mr-1" />
                {docs.length} Docs
              </Badge>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <div className="flex items-center justify-between mb-6">
              <TabsList className={`${bgCard} border ${borderColor}`}>
                <TabsTrigger value="sheets" className="data-[state=active]:bg-[#22c55e] data-[state=active]:text-white">
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Sheets ({sheets.length})
                </TabsTrigger>
                <TabsTrigger value="docs" className="data-[state=active]:bg-[#3b82f6] data-[state=active]:text-white">
                  <FileText className="h-4 w-4 mr-2" />
                  Docs ({docs.length})
                </TabsTrigger>
              </TabsList>

              <Button
                onClick={() => { resetForm(); setShowAddModal(true); }}
                className={activeTab === 'sheets' ? 'bg-[#22c55e] hover:bg-[#16a34a]' : 'bg-[#3b82f6] hover:bg-[#2563eb]'}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add {activeTab === 'sheets' ? 'Sheet' : 'Document'}
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

        {/* Add/Edit Modal */}
        <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
          <DialogContent className={`${bgCard} ${textPrimary} max-w-md`}>
            <DialogHeader>
              <DialogTitle>{editingDoc ? 'Edit' : 'Add'} {activeTab === 'sheets' ? 'Sheet' : 'Document'}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Name *</label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder={activeTab === 'sheets' ? 'e.g., My Report' : 'e.g., Project Notes'}
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
                <label className={`text-sm ${textSecondary} block mb-1`}>Description (optional)</label>
                <Input
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description..."
                  className={bgSecondary}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => { setShowAddModal(false); resetForm(); }}>Cancel</Button>
              <Button onClick={saveDocument} className={activeTab === 'sheets' ? 'bg-[#22c55e]' : 'bg-[#3b82f6]'}>
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
                  {selectedDoc?.description && <p className={`text-xs ${textSecondary}`}>{selectedDoc.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => window.open(selectedDoc?.link, '_blank')} className={borderColor}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open in New Tab
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowViewModal(false)} className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <div className="flex-1 h-[calc(85vh-70px)]">
              {selectedDoc && (
                <iframe src={getEmbedUrl(selectedDoc.link)} className="w-full h-full border-0" title={selectedDoc.name} allow="fullscreen" />
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
