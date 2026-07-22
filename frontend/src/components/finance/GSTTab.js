import React from 'react';
import { FileText } from 'lucide-react';

const GSTTab = () => {
  return (
    <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-12 text-center">
      <FileText className="h-16 w-16 text-gray-600 dark:text-[#a1a1aa] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 dark:text-[#fafafa] mb-2">GST Management</h3>
      <p className="text-gray-600 dark:text-[#a1a1aa] mb-4">Monthly GST reports, CGST/SGST/IGST tracking, and audit exports</p>
      <p className="text-sm text-[#6366f1]">Comprehensive GST dashboard coming soon</p>
    </div>
  );
};

export default GSTTab;
