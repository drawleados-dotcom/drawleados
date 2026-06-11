import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Database, Download, Upload, RefreshCw, AlertOctagon, Loader2 } from 'lucide-react';

const API = process.env.REACT_APP_BACKEND_URL;

export default function DatabaseToolsTab({
  isDark,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const [collections, setCollections] = useState([]);
  const [dbName, setDbName] = useState('');
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(null); // {collection, action}
  const [importTarget, setImportTarget] = useState(null); // {collection, file, mode}

  const token = typeof window !== 'undefined' ? localStorage.getItem('session_token') : null;
  const headers = { Authorization: `Bearer ${token}` };

  const loadCollections = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/admin/db/collections`, { headers });
      setCollections(res.data.collections || []);
      setDbName(res.data.db_name || '');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to load collections');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadCollections();
  }, [loadCollections]);

  // ------- Downloads -------
  const downloadBlob = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const handleExportOne = async (name) => {
    setBusy({ collection: name, action: 'export' });
    try {
      const res = await axios.get(`${API}/api/admin/db/export/${name}`, {
        headers,
        responseType: 'blob',
      });
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadBlob(res.data, `${name}-${ts}.json`);
      toast.success(`Exported ${name}`);
    } catch (e) {
      toast.error(e.response?.data?.detail || `Failed to export ${name}`);
    } finally {
      setBusy(null);
    }
  };

  const handleExportAll = async () => {
    setBusy({ action: 'export-all' });
    try {
      const res = await axios.get(`${API}/api/admin/db/export-all`, {
        headers,
        responseType: 'blob',
      });
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      downloadBlob(res.data, `drawlead-db-backup-${ts}.zip`);
      toast.success('Full backup downloaded');
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Failed to export full backup');
    } finally {
      setBusy(null);
    }
  };

  // ------- Import -------
  const triggerImport = (name) => {
    setImportTarget({ collection: name, file: null, mode: 'append' });
  };

  const submitImport = async () => {
    if (!importTarget?.file) {
      toast.error('Choose a JSON file first');
      return;
    }
    if (importTarget.mode === 'replace') {
      const ok = window.confirm(
        `This will WIPE all existing documents in "${importTarget.collection}" and then insert the file. Continue?`,
      );
      if (!ok) return;
    }
    setBusy({ collection: importTarget.collection, action: 'import' });
    try {
      const fd = new FormData();
      fd.append('file', importTarget.file);
      fd.append('mode', importTarget.mode);
      const res = await axios.post(
        `${API}/api/admin/db/import/${importTarget.collection}`,
        fd,
        { headers: { ...headers, 'Content-Type': 'multipart/form-data' } },
      );
      toast.success(
        `Imported ${res.data.inserted} docs into ${importTarget.collection}` +
          (res.data.deleted ? ` (deleted ${res.data.deleted})` : ''),
      );
      setImportTarget(null);
      loadCollections();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Import failed');
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-6" data-testid="database-tools-tab">
      {/* Header */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                <Database className="h-5 w-5 text-[#6366f1]" />
                Database Tools
              </CardTitle>
              <p className={`text-sm ${textSecondary} mt-1`}>
                Backup, restore and migrate the application database.{' '}
                {dbName && <span className="font-mono text-xs">({dbName})</span>}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                onClick={loadCollections}
                variant="outline"
                size="sm"
                className={`${borderColor}`}
                data-testid="db-refresh-btn"
              >
                <RefreshCw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              <Button
                onClick={handleExportAll}
                disabled={busy?.action === 'export-all'}
                className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                data-testid="db-export-all-btn"
              >
                {busy?.action === 'export-all' ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-1" />
                )}
                Export Full Backup (.zip)
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Migration hint */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <AlertOctagon className="h-5 w-5 text-[#f59e0b] flex-shrink-0 mt-0.5" />
            <div className={`text-sm ${textSecondary}`}>
              <p className={`font-semibold ${textPrimary} mb-1`}>Planning to migrate to your own VPS / MongoDB Atlas?</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Click <strong>Export Full Backup</strong> above — a single .zip with every collection as JSON.</li>
                <li>On your VPS, install MongoDB and create the target database.</li>
                <li>Use the <strong>Import</strong> button per collection (or <code>mongoimport</code>) to load the JSON files.</li>
                <li>Update <code>MONGO_URL</code> in the backend <code>.env</code> to point to your new database.</li>
              </ol>
              <p className="mt-2 text-xs">
                Tip: this preview database is <strong>not</strong> the same as your production / deployed database. Each is isolated.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Collections list */}
      <Card className={`${bgCard} border ${borderColor}`}>
        <CardHeader>
          <CardTitle className={`${textPrimary} text-base`}>Collections ({collections.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className={`p-8 text-center ${textSecondary}`}>
              <Loader2 className="h-6 w-6 animate-spin mx-auto" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className={`border-b ${borderColor}`}>
                    <th className={`text-left p-3 text-xs font-medium ${textSecondary}`}>Collection</th>
                    <th className={`text-right p-3 text-xs font-medium ${textSecondary}`}>Documents</th>
                    <th className={`text-right p-3 text-xs font-medium ${textSecondary} w-[280px]`}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {collections.map((c) => (
                    <tr
                      key={c.name}
                      className={`border-b ${borderColor} hover:${bgSecondary}`}
                      data-testid={`db-row-${c.name}`}
                    >
                      <td className={`p-3 ${textPrimary} font-mono text-sm`}>
                        {c.name}
                        {c.is_system && (
                          <Badge className="ml-2 bg-gray-500/20 text-gray-400 pointer-events-none text-[10px]">
                            system
                          </Badge>
                        )}
                      </td>
                      <td className={`p-3 text-right ${textPrimary}`}>{c.count.toLocaleString()}</td>
                      <td className="p-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleExportOne(c.name)}
                            disabled={c.is_system || (busy?.collection === c.name)}
                            className={`${borderColor} h-8`}
                            data-testid={`db-export-${c.name}`}
                          >
                            {busy?.collection === c.name && busy?.action === 'export' ? (
                              <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3 mr-1" />
                            )}
                            Export
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerImport(c.name)}
                            disabled={c.is_system}
                            className={`${borderColor} h-8`}
                            data-testid={`db-import-${c.name}`}
                          >
                            <Upload className="h-3 w-3 mr-1" />
                            Import
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Import Modal */}
      {importTarget && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
          onClick={() => setImportTarget(null)}
          data-testid="db-import-modal"
        >
          <Card
            className={`w-full max-w-md ${bgCard} border ${borderColor}`}
            onClick={(e) => e.stopPropagation()}
          >
            <CardHeader>
              <CardTitle className={`${textPrimary} flex items-center gap-2`}>
                <Upload className="h-5 w-5 text-[#6366f1]" />
                Import into <span className="font-mono">{importTarget.collection}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>JSON file</label>
                <input
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) =>
                    setImportTarget((t) => ({ ...t, file: e.target.files?.[0] || null }))
                  }
                  className={`block w-full text-sm ${textPrimary} ${isDark ? 'bg-[#27272a]' : 'bg-gray-100'} ${borderColor} border rounded p-2`}
                  data-testid="db-import-file"
                />
                {importTarget.file && (
                  <p className={`text-xs ${textSecondary} mt-1`}>
                    {importTarget.file.name} — {(importTarget.file.size / 1024).toFixed(1)} KB
                  </p>
                )}
              </div>
              <div>
                <label className={`text-sm ${textSecondary} block mb-1`}>Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: 'append', label: 'Append', hint: 'Add to existing docs' },
                    { id: 'replace', label: 'Replace', hint: 'WIPE first, then insert' },
                  ].map((m) => {
                    const selected = importTarget.mode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setImportTarget((t) => ({ ...t, mode: m.id }))}
                        className={`p-3 rounded-lg border text-left transition ${
                          selected
                            ? m.id === 'replace'
                              ? 'bg-red-500 border-red-500 text-white'
                              : 'bg-[#6366f1] border-[#6366f1] text-white'
                            : isDark
                              ? 'bg-[#27272a] border-[#3f3f46] text-[#fafafa] hover:bg-[#3f3f46]'
                              : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'
                        }`}
                        data-testid={`db-import-mode-${m.id}`}
                      >
                        <p className="text-sm font-semibold">{m.label}</p>
                        <p className="text-xs opacity-80">{m.hint}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => setImportTarget(null)}
                  className={`flex-1 ${borderColor}`}
                  data-testid="db-import-cancel"
                >
                  Cancel
                </Button>
                <Button
                  onClick={submitImport}
                  disabled={!importTarget.file || busy?.action === 'import'}
                  className="flex-1 bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                  data-testid="db-import-submit"
                >
                  {busy?.action === 'import' ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-1" />
                  )}
                  Import
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
