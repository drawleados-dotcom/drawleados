import React from 'react';
import { PieChart } from 'lucide-react';

const BudgetTab = () => {
  return (
    <div className="bg-white dark:bg-[#18181b] border border-gray-200 dark:border-[#27272a] rounded-xl p-12 text-center">
      <PieChart className="h-16 w-16 text-gray-600 dark:text-[#a1a1aa] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-gray-900 dark:text-[#fafafa] mb-2">Budget Tracking</h3>
      <p className="text-gray-600 dark:text-[#a1a1aa] mb-4">Month-wise budget allocation, spending tracking, and alerts</p>
      <p className="text-sm text-[#6366f1]">Budget management dashboard coming soon</p>
    </div>
  );
};

export default BudgetTab;
