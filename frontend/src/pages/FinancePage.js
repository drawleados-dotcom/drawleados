import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import api from '../utils/api';
import { DollarSign } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';

const FinancePage = () => {
  const [sales, setSales] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSales();
  }, []);

  const fetchSales = async () => {
    try {
      const response = await api.get('/finance/sales');
      setSales(response.data);
    } catch (error) {
      console.error('Error fetching sales:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateInvoiceStatus = async (saleId, newStatus) => {
    try {
      await api.put(`/finance/sales/${saleId}`, { invoice_status: newStatus });
      toast.success('Invoice status updated');
      fetchSales();
    } catch (error) {
      toast.error('Failed to update invoice status');
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className="text-[#a1a1aa]">Loading finance data...</p>
        </div>
      </Layout>
    );
  }

  const totalRevenue = sales.reduce((sum, sale) => sum + (sale.amount || 0), 0);
  const paidRevenue = sales.filter(s => s.invoice_status === 'paid').reduce((sum, sale) => sum + (sale.amount || 0), 0);
  const pendingRevenue = sales.filter(s => s.invoice_status === 'pending').reduce((sum, sale) => sum + (sale.amount || 0), 0);

  return (
    <Layout>
      <div className="space-y-8" data-testid="finance-page">
        <div>
          <h1
            className="text-4xl font-bold tracking-tight mb-2"
            style={{ fontFamily: 'Plus Jakarta Sans' }}
          >
            <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
              Finance & Sales
            </span>
          </h1>
          <p className="text-[#a1a1aa] text-base">Manage invoices and track revenue</p>
        </div>

        {/* Revenue Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#6366f1]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{totalRevenue.toLocaleString()}</h3>
            <p className="text-sm text-[#a1a1aa]">Total Revenue</p>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#10b981]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{paidRevenue.toLocaleString()}</h3>
            <p className="text-sm text-[#a1a1aa]">Paid</p>
          </div>

          <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-6">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-12 w-12 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
                <DollarSign className="h-6 w-6 text-[#f59e0b]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-3xl font-bold text-[#fafafa] mb-1">₹{pendingRevenue.toLocaleString()}</h3>
            <p className="text-sm text-[#a1a1aa]">Pending</p>
          </div>
        </div>

        {/* Sales Table */}
        <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#09090b] border-b border-[#27272a]">
                <tr>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                    Client
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                    Service
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                    Deal Date
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                    GST
                  </th>
                  <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                    Invoice Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#27272a]">
                {sales.length > 0 ? (
                  sales.map((sale) => (
                    <tr key={sale.sale_id} className="hover:bg-[#27272a]/20 transition-colors">
                      <td className="px-6 py-4 text-sm text-[#fafafa]">{sale.client_name}</td>
                      <td className="px-6 py-4 text-sm text-[#fafafa]">{sale.service_name}</td>
                      <td className="px-6 py-4 text-sm text-[#fafafa]">₹{sale.amount?.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-[#fafafa]">
                        {new Date(sale.deal_date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <span
                          className={`px-2 py-1 rounded-full text-xs font-medium ${
                            sale.has_gst ? 'bg-[#10b981]/20 text-[#10b981]' : 'bg-[#a1a1aa]/20 text-[#a1a1aa]'
                          }`}
                        >
                          {sale.has_gst ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <Select
                          value={sale.invoice_status}
                          onValueChange={(value) => handleUpdateInvoiceStatus(sale.sale_id, value)}
                        >
                          <SelectTrigger className="bg-[#09090b] border-[#27272a] text-[#fafafa] w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="paid">Paid</SelectItem>
                            <SelectItem value="overdue">Overdue</SelectItem>
                          </SelectContent>
                        </Select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center text-[#a1a1aa]">
                      No sales records found
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default FinancePage;
