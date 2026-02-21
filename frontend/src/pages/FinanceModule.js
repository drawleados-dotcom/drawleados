import React from 'react';
import Layout from '../components/Layout';
import ExpenseTab from '../components/finance/ExpenseTab';

const FinanceModule = () => {
  return (
    <Layout>
      <div className="space-y-6" data-testid="finance-module">
        {/* Header */}
        <div>
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              Finance & Billing
            </span>
          </h1>
          <p className="text-[#a1a1aa] text-base">Complete financial management system with customizable tabs</p>
        </div>

        {/* Main Expense/Finance Tab */}
        <ExpenseTab />
      </div>
    </Layout>
  );
};

export default FinanceModule;
