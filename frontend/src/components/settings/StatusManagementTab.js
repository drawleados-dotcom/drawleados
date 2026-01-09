import React, { useState, useEffect } from 'react';
import api from '../../utils/api';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Plus, Edit, Trash2, GripVertical, Check } from 'lucide-react';
import { toast } from 'sonner';
import { DndProvider, useDrag, useDrop } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';

const colorOptions = [
  '#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444',
  '#ec4899', '#06b6d4', '#22c55e', '#f97316', '#a855f7',
];

const StatusItem = ({ status, index, moveStatus, onEdit, onDelete }) => {
  const [{ isDragging }, drag, preview] = useDrag({
    type: 'STATUS',
    item: { index },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
  });

  const [, drop] = useDrop({
    accept: 'STATUS',
    hover: (draggedItem) => {
      if (draggedItem.index !== index) {
        moveStatus(draggedItem.index, index);
        draggedItem.index = index;
      }
    },
  });

  return (
    <div
      ref={(node) => drag(drop(node))}
      className={`flex items-center justify-between p-3 rounded-lg border border-[#27272a] bg-[#09090b] transition-all ${
        isDragging ? 'opacity-50' : 'opacity-100'
      }`}
      data-testid={`status-item-${status.status_id}`}
    >
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-[#a1a1aa] cursor-grab" />
        <div
          className="h-4 w-4 rounded-full"
          style={{ backgroundColor: status.color }}
        />
        <span className="text-sm font-medium text-[#fafafa]">{status.name}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#a1a1aa]">Order: {status.order}</span>
        <Button
          size="sm"
          onClick={() => onEdit(status)}
          className="bg-[#27272a] hover:bg-[#3f3f46] text-[#fafafa] h-7 w-7 p-0"
        >
          <Edit className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          onClick={() => onDelete(status.status_id)}
          className="bg-[#27272a] hover:bg-[#ef4444] text-[#fafafa] h-7 w-7 p-0"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
};

const StatusManagementTab = () => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchStatuses();
  }, []);

  const fetchStatuses = async () => {
    try {
      const response = await api.get('/statuses');
      setStatuses(response.data.sort((a, b) => a.order - b.order));
    } catch (error) {
      console.error('Error fetching statuses:', error);
      toast.error('Failed to load statuses');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedStatus(null);
    setShowModal(true);
  };

  const handleEdit = (status) => {
    setSelectedStatus(status);
    setShowModal(true);
  };

  const handleSave = async (statusData) => {
    try {
      if (selectedStatus) {
        await api.put(`/statuses/${selectedStatus.status_id}`, statusData);
        toast.success('Status updated successfully');
      } else {
        // Set order to be last
        statusData.order = statuses.length;
        await api.post('/statuses', statusData);
        toast.success('Status created successfully');
      }
      fetchStatuses();
      setShowModal(false);
      setSelectedStatus(null);
    } catch (error) {
      toast.error('Failed to save status');
    }
  };

  const handleDelete = async (statusId) => {
    if (!window.confirm('Are you sure you want to delete this status?')) return;
    try {
      await api.delete(`/statuses/${statusId}`);
      toast.success('Status deleted');
      fetchStatuses();
    } catch (error) {
      toast.error('Failed to delete status');
    }
  };

  const moveStatus = (fromIndex, toIndex) => {
    const updatedStatuses = [...statuses];
    const [movedItem] = updatedStatuses.splice(fromIndex, 1);
    updatedStatuses.splice(toIndex, 0, movedItem);
    
    // Update order values
    const reorderedStatuses = updatedStatuses.map((status, index) => ({
      ...status,
      order: index,
    }));
    
    setStatuses(reorderedStatuses);
    setHasChanges(true);
  };

  const handleSaveOrder = async () => {
    try {
      const statusOrders = statuses.map((s, index) => ({
        status_id: s.status_id,
        order: index,
      }));
      await api.put('/statuses/reorder', statusOrders);
      toast.success('Status order saved');
      setHasChanges(false);
    } catch (error) {
      toast.error('Failed to save order');
    }
  };

  if (loading) {
    return <div className="text-[#a1a1aa]">Loading statuses...</div>;
  }

  return (
    <DndProvider backend={HTML5Backend}>
      <div className="space-y-6" data-testid="status-management-tab">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-[#fafafa]">Status Management</h2>
            <p className="text-sm text-[#a1a1aa]">
              Create, edit, and reorder statuses. Drag to change order.
            </p>
          </div>
          <div className="flex gap-2">
            {hasChanges && (
              <Button
                onClick={handleSaveOrder}
                className="bg-[#10b981] hover:bg-[#059669] text-white"
                data-testid="save-order-button"
              >
                <Check className="h-4 w-4 mr-2" />
                Save Order
              </Button>
            )}
            <Button
              onClick={handleCreate}
              className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
              data-testid="create-status-button"
            >
              <Plus className="h-4 w-4 mr-2" />
              New Status
            </Button>
          </div>
        </div>

        {/* Status List */}
        <div className="space-y-2">
          {statuses.map((status, index) => (
            <StatusItem
              key={status.status_id}
              status={status}
              index={index}
              moveStatus={moveStatus}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
          {statuses.length === 0 && (
            <div className="text-center py-8 text-[#a1a1aa]">
              No statuses found. Create your first status!
            </div>
          )}
        </div>

        {/* Status Form Modal */}
        {showModal && (
          <StatusFormModal
            status={selectedStatus}
            onClose={() => setShowModal(false)}
            onSave={handleSave}
          />
        )}
      </div>
    </DndProvider>
  );
};

// Status Form Modal
const StatusFormModal = ({ status, onClose, onSave }) => {
  const [formData, setFormData] = useState({
    name: status?.name || '',
    color: status?.color || '#3b82f6',
  });

  const handleSubmit = () => {
    if (!formData.name) {
      toast.error('Please enter a status name');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className="bg-[#18181b] border-[#27272a] text-[#fafafa]">
        <DialogHeader>
          <DialogTitle>{status ? 'Edit Status' : 'Create Status'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., In Progress"
              className="bg-[#09090b] border-[#27272a]"
              data-testid="status-name-input"
            />
          </div>
          <div className="space-y-2">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2">
              {colorOptions.map((color) => (
                <button
                  key={color}
                  onClick={() => setFormData({ ...formData, color })}
                  className={`h-8 w-8 rounded-lg transition-all ${
                    formData.color === color ? 'ring-2 ring-white ring-offset-2 ring-offset-[#18181b]' : ''
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
          <div className="p-3 bg-[#09090b] rounded-lg">
            <p className="text-xs text-[#a1a1aa] mb-2">Preview:</p>
            <span
              className="px-3 py-1 rounded-full text-sm font-medium text-white"
              style={{ backgroundColor: formData.color }}
            >
              {formData.name || 'Status Name'}
            </span>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className="border-[#27272a] text-[#a1a1aa]">
            Cancel
          </Button>
          <Button onClick={handleSubmit} className="bg-[#6366f1] hover:bg-[#4f46e5]">
            {status ? 'Update' : 'Create'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default StatusManagementTab;
