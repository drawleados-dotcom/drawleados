import React from 'react';
import { Edit, Trash2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useAuth } from '../../contexts/AuthContext';

const LeadsListView = ({ leads, services, sources, statuses, onEditLead, onDeleteLead }) => {
  const { isAdmin } = useAuth();

  return (
    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full" data-testid="leads-table">
          <thead className="bg-[#09090b] border-b border-[#27272a]">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Contact
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Service
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Source
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-4 text-left text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Cost
              </th>
              <th className="px-6 py-4 text-right text-xs font-medium text-[#a1a1aa] uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#27272a]">
            {leads.length > 0 ? (
              leads.map((lead) => (
                <tr
                  key={lead.lead_id}
                  className="hover:bg-[#27272a]/20 transition-colors"
                  data-testid={`lead-row-${lead.lead_id}`}
                >
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm font-medium text-[#fafafa]">{lead.name}</p>
                      {lead.business_name && (
                        <p className="text-xs text-[#a1a1aa] mt-1">{lead.business_name}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-sm text-[#fafafa]">{lead.phone}</p>
                      {lead.email && (
                        <p className="text-xs text-[#a1a1aa] mt-1">{lead.email}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-[#fafafa]">{lead.service_name || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-[#fafafa]">{lead.source_name || '-'}</p>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-medium inline-block"
                      style={{
                        backgroundColor: `${lead.status_color}20`,
                        color: lead.status_color,
                      }}
                    >
                      {lead.status_name}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-sm text-[#fafafa]">
                      {lead.service_cost ? `₹${lead.service_cost.toLocaleString()}` : '-'}
                    </p>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => onEditLead(lead)}
                        data-testid={`edit-lead-${lead.lead_id}`}
                        className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          size="sm"
                          onClick={() => onDeleteLead(lead.lead_id)}
                          data-testid={`delete-lead-${lead.lead_id}`}
                          className="bg-[#ef4444]/10 hover:bg-[#ef4444]/20 text-[#ef4444] h-8 w-8 p-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="7" className="px-6 py-12 text-center">
                  <p className="text-[#a1a1aa]">No leads found</p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default LeadsListView;
