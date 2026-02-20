import React, { useState } from 'react';
import Layout from '../components/Layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import InvoicesTab from '../components/finance/InvoicesTab';
import PayrollTab from '../components/finance/PayrollTab';
import GSTTab from '../components/finance/GSTTab';
import BudgetTab from '../components/finance/BudgetTab';
import RevenueTab from '../components/finance/RevenueTab';
import ExpenseTab from '../components/finance/ExpenseTab';

const FinanceModule = () => {
  const [activeTab, setActiveTab] = useState('revenue');

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
          <p className="text-[#a1a1aa] text-base">Complete financial management system</p>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-[#18181b] border border-[#27272a] p-1">
            <TabsTrigger
              value="revenue"
              data-testid="revenue-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Revenue Dashboard
            </TabsTrigger>
            <TabsTrigger
              value="expenses"
              data-testid="expenses-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Expenses
            </TabsTrigger>
            <TabsTrigger
              value="invoices"
              data-testid="invoices-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Invoices
            </TabsTrigger>
            <TabsTrigger
              value="payroll"
              data-testid="payroll-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Payroll
            </TabsTrigger>
            <TabsTrigger
              value="gst"
              data-testid="gst-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              GST
            </TabsTrigger>
            <TabsTrigger
              value="budget"
              data-testid="budget-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              Budget
            </TabsTrigger>
          </TabsList>

          <TabsContent value="revenue" className="mt-6">
            <RevenueTab />
          </TabsContent>

          <TabsContent value="expenses" className="mt-6">
            <ExpenseTab />
          </TabsContent>

          <TabsContent value="invoices" className="mt-6">
            <InvoicesTab />
          </TabsContent>

          <TabsContent value="payroll" className="mt-6">
            <PayrollTab />
          </TabsContent>

          <TabsContent value="gst" className="mt-6">
            <GSTTab />
          </TabsContent>

          <TabsContent value="budget" className="mt-6">
            <BudgetTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default FinanceModule;
