import React from 'react';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { Edit } from 'lucide-react';
import { Button } from '../ui/button';
import api from '../../utils/api';
import { toast } from 'sonner';

const LeadCard = ({ lead, onEditLead }) => {
  const [{ isDragging }, drag] = useDrag(() => ({
    type: 'LEAD',
    item: { lead },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  }));

  return (
    <div
      ref={drag}
      className={`bg-[#09090b] border border-[#27272a] rounded-lg p-4 hover:border-[#6366f1]/20 transition-all cursor-move ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      data-testid={`kanban-lead-${lead.lead_id}`}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="text-sm font-medium text-[#fafafa] mb-1">{lead.name}</h4>
          {lead.business_name && (
            <p className="text-xs text-[#a1a1aa]">{lead.business_name}</p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => onEditLead(lead)}
          className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-7 w-7 p-0"
        >
          <Edit className="h-3 w-3" />
        </Button>
      </div>
      <div className="space-y-2 text-xs text-[#a1a1aa]">
        {lead.service_name && <p>📦 {lead.service_name}</p>}
        {lead.service_cost && <p>💰 ₹{lead.service_cost.toLocaleString()}</p>}
        {lead.phone && <p>📞 {lead.phone}</p>}
      </div>
    </div>
  );
};

const StatusColumn = ({ status, leads, onEditLead, onDrop }) => {
  const [{ isOver }, drop] = useDrop(() => ({
    accept: 'LEAD',
    drop: (item) => onDrop(item.lead, status.status_id),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
    }),
  }));

  return (
    <div
      ref={drop}
      className={`bg-[#18181b] border border-[#27272a] rounded-xl p-4 min-h-[500px] transition-all ${
        isOver ? 'border-[#6366f1] bg-[#6366f1]/5' : ''
      }`}
      data-testid={`kanban-column-${status.status_id}`}
    >
      <div className="flex items-center gap-2 mb-4">
        <div
          className="h-3 w-3 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <h3 className="text-sm font-semibold text-[#fafafa]" style={{ fontFamily: 'Plus Jakarta Sans' }}>
          {status.name}
        </h3>
        <span className="ml-auto text-xs text-[#a1a1aa] bg-[#27272a] px-2 py-1 rounded-full">
          {leads.length}
        </span>
      </div>
      <div className="space-y-3">
        {leads.map((lead) => (
          <LeadCard key={lead.lead_id} lead={lead} onEditLead={onEditLead} />
        ))}
      </div>
    </div>
  );
};

const LeadsKanbanView = ({ leads, statuses, onEditLead, onRefresh }) => {
  const handleDrop = async (lead, newStatusId) => {
    if (lead.status_id === newStatusId) return;

    try {
      await api.put(`/leads/${lead.lead_id}`, { status_id: newStatusId });
      toast.success('Lead status updated');
      onRefresh();
    } catch (error) {
      toast.error('Failed to update lead status');
    }
  };

  return (
    <DndProvider backend={HTML5Backend}>
      <div
        className="grid gap-4 overflow-x-auto pb-4"
        style={{ gridTemplateColumns: `repeat(${statuses.length}, minmax(280px, 1fr))` }}
        data-testid="kanban-board"
      >
        {statuses.map((status) => {
          const statusLeads = leads.filter((lead) => lead.status_id === status.status_id);
          return (
            <StatusColumn
              key={status.status_id}
              status={status}
              leads={statusLeads}
              onEditLead={onEditLead}
              onDrop={handleDrop}
            />
          );
        })}
      </div>
    </DndProvider>
  );
};

export default LeadsKanbanView;
