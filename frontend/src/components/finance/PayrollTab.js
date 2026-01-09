import React from 'react';
import { Users } from 'lucide-react';

const PayrollTab = () => {
  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-12 text-center">
      <Users className="h-16 w-16 text-[#a1a1aa] mx-auto mb-4" />
      <h3 className="text-xl font-semibold text-[#fafafa] mb-2">Payroll Management</h3>
      <p className="text-[#a1a1aa] mb-4">Employee management, attendance tracking, and payslip generation</p>
      <p className="text-sm text-[#6366f1]">Full payroll system with attendance integration coming soon</p>
    </div>
  );
};

export default PayrollTab;
