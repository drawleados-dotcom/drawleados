import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Upload, FileText } from 'lucide-react';
import { toast } from 'sonner';

// Quote-aware CSV line parser (handles commas inside "quoted values").
const parseCSVLine = (line) => {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
};

const normalize = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * CSVImportModal — generic "upload CSV → map columns to fields → import"
 * flow, shared across any page that needs the same pattern (BNI Members /
 * Category / Role Players, LinkedIn Partnership Partners, ...).
 *
 * `fields`: [{ key, label, required, synonyms }] — the target fields to map
 * columns to; `synonyms` are extra header strings that auto-match the field.
 * `onImport(rows)`: called with the mapped rows once confirmed; each row is
 * an object keyed by field `key` with the raw string cell value.
 */
export default function CSVImportModal({ open, onClose, title, fields, onImport, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'map'
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]); // array of string arrays
  const [mapping, setMapping] = useState({}); // { header: fieldKey }
  const [importing, setImporting] = useState(false);

  const reset = () => {
    setStep('upload');
    setHeaders([]);
    setRows([]);
    setMapping({});
    setImporting(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      const lines = text.split(/\r?\n/).filter((l) => l.trim());
      if (lines.length < 2) {
        toast.error('CSV file is empty or has only a header row');
        return;
      }
      const parsedHeaders = parseCSVLine(lines[0]);
      const parsedRows = lines.slice(1).map(parseCSVLine);

      // Auto-suggest a mapping by matching header text to a field's label,
      // key, or declared synonyms (e.g. "Category Name" / "Category" both
      // resolve to the Category import field).
      const autoMapping = {};
      parsedHeaders.forEach((h) => {
        const nh = normalize(h);
        const match = fields.find((f) => {
          const candidates = [f.label, f.key, ...(f.synonyms || [])];
          return candidates.some((c) => normalize(c) === nh);
        });
        if (match) autoMapping[h] = match.key;
      });

      setHeaders(parsedHeaders);
      setRows(parsedRows);
      setMapping(autoMapping);
      setStep('map');
    };
    reader.onerror = () => toast.error('Failed to read CSV file');
    reader.readAsText(file);
  };

  const doImport = async () => {
    const mappedFieldKeys = new Set(Object.values(mapping).filter(Boolean));
    const missingRequired = fields.filter((f) => f.required && !mappedFieldKeys.has(f.key));
    if (missingRequired.length > 0) {
      toast.error(`Map a column to: ${missingRequired.map((f) => f.label).join(', ')}`);
      return;
    }

    const mappedRows = rows.map((rowArr) => {
      const obj = {};
      headers.forEach((h, i) => {
        const fieldKey = mapping[h];
        if (fieldKey) obj[fieldKey] = rowArr[i] || '';
      });
      return obj;
    }).filter((obj) => fields.every((f) => !f.required || (obj[f.key] || '').trim()));

    if (mappedRows.length === 0) {
      toast.error('No valid rows to import — check your column mapping');
      return;
    }

    setImporting(true);
    try {
      await onImport(mappedRows);
      handleClose();
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className={`${bgCard} max-w-2xl max-h-[85vh] overflow-y-auto`}>
        <DialogHeader>
          <DialogTitle className={textPrimary}>{title}</DialogTitle>
        </DialogHeader>

        {step === 'upload' && (
          <label
            className={`flex flex-col items-center justify-center gap-2 border-2 border-dashed ${borderColor} rounded-xl p-10 cursor-pointer hover:border-[#6366f1]/50 transition-colors`}
          >
            <Upload className={`h-8 w-8 ${textSecondary}`} />
            <span className={`text-sm font-medium ${textPrimary}`}>Choose a CSV file</span>
            <span className={`text-xs ${textSecondary}`}>First row must be column headers</span>
            <input
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
              data-testid="csv-import-file-input"
            />
          </label>
        )}

        {step === 'map' && (
          <div className="space-y-4">
            <p className={`text-sm ${textSecondary} flex items-center gap-2`}>
              <FileText className="h-4 w-4" /> {rows.length} row{rows.length === 1 ? '' : 's'} detected — map each column below.
            </p>
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {headers.map((h, i) => (
                <div key={h + i} className="grid grid-cols-2 gap-3 items-center">
                  <div>
                    <p className={`text-sm font-medium ${textPrimary}`}>{h}</p>
                    <p className={`text-xs ${textSecondary} truncate`}>e.g. "{rows[0]?.[i] || ''}"</p>
                  </div>
                  <Select
                    value={mapping[h] || 'skip'}
                    onValueChange={(v) => setMapping((p) => ({ ...p, [h]: v === 'skip' ? '' : v }))}
                  >
                    <SelectTrigger className={`${bgSecondary} border ${borderColor} ${textPrimary}`} data-testid={`csv-import-map-${i}`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="skip">— Skip this column —</SelectItem>
                      {fields.map((f) => (
                        <SelectItem key={f.key} value={f.key}>
                          {f.label}{f.required ? ' *' : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>Cancel</Button>
          {step === 'map' && (
            <Button
              onClick={doImport}
              disabled={importing}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="csv-import-confirm"
            >
              {importing ? 'Importing…' : `Import ${rows.length} row${rows.length === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
