import React, { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { Calendar } from '../ui/calendar';
import { X, Plus, Filter, CalendarIcon, ChevronDown } from 'lucide-react';
import { format } from 'date-fns';

const filterTypes = [
  { value: 'status', label: 'Status', type: 'select' },
  { value: 'priority', label: 'Priority', type: 'select' },
  { value: 'assigned_to', label: 'Assigned To', type: 'select' },
  { value: 'service_type', label: 'Service Type', type: 'select' },
  { value: 'due_date', label: 'Due Date', type: 'date' },
  { value: 'created_at', label: 'Created Date', type: 'date' },
];

const statusOptions = [
  { value: 'not_started', label: 'Not Started', color: '#71717a' },
  { value: 'in_progress', label: 'In Progress', color: '#3b82f6' },
  { value: 'waiting_client', label: 'Waiting on Client', color: '#f59e0b' },
  { value: 'review', label: 'Review', color: '#8b5cf6' },
  { value: 'completed', label: 'Completed', color: '#10b981' },
  { value: 'on_hold', label: 'On Hold', color: '#ef4444' },
];

const priorityOptions = [
  { value: 'low', label: 'Low', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
];

const dateOperators = [
  { value: 'is', label: 'Is' },
  { value: 'before', label: 'Before' },
  { value: 'after', label: 'After' },
  { value: 'this_week', label: 'This Week' },
  { value: 'this_month', label: 'This Month' },
  { value: 'overdue', label: 'Overdue' },
];

const NotionFilters = ({ filters, onFiltersChange, users = [], serviceTypes = [] }) => {
  const [showAddFilter, setShowAddFilter] = useState(false);

  const addFilter = (filterType) => {
    const newFilter = {
      id: Date.now(),
      field: filterType,
      operator: 'is',
      value: '',
    };
    onFiltersChange([...filters, newFilter]);
    setShowAddFilter(false);
  };

  const updateFilter = (filterId, updates) => {
    onFiltersChange(
      filters.map((f) => (f.id === filterId ? { ...f, ...updates } : f))
    );
  };

  const removeFilter = (filterId) => {
    onFiltersChange(filters.filter((f) => f.id !== filterId));
  };

  const clearAllFilters = () => {
    onFiltersChange([]);
  };

  const renderFilterValue = (filter) => {
    const filterConfig = filterTypes.find((f) => f.value === filter.field);

    if (filterConfig?.type === 'date') {
      return (
        <div className="flex items-center gap-2">
          <Select
            value={filter.operator}
            onValueChange={(v) => updateFilter(filter.id, { operator: v })}
          >
            <SelectTrigger className="h-7 w-24 bg-[#09090b] border-[#27272a] text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              {dateOperators.map((op) => (
                <SelectItem key={op.value} value={op.value} className="text-[#fafafa] text-xs">
                  {op.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!['this_week', 'this_month', 'overdue'].includes(filter.operator) && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-7 px-2 bg-[#09090b] border-[#27272a] text-xs"
                >
                  <CalendarIcon className="h-3 w-3 mr-1" />
                  {filter.value ? format(new Date(filter.value), 'MMM dd') : 'Pick date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 bg-[#18181b] border-[#27272a]">
                <Calendar
                  mode="single"
                  selected={filter.value ? new Date(filter.value) : undefined}
                  onSelect={(date) => updateFilter(filter.id, { value: date?.toISOString() })}
                />
              </PopoverContent>
            </Popover>
          )}
        </div>
      );
    }

    let options = [];
    if (filter.field === 'status') {
      options = statusOptions;
    } else if (filter.field === 'priority') {
      options = priorityOptions;
    } else if (filter.field === 'assigned_to') {
      options = users.map((u) => ({ value: u.user_id, label: u.name }));
    } else if (filter.field === 'service_type') {
      options = serviceTypes.map((s) => ({ value: s.value, label: s.label }));
    }

    return (
      <Select
        value={filter.value}
        onValueChange={(v) => updateFilter(filter.id, { value: v })}
      >
        <SelectTrigger className="h-7 w-36 bg-[#09090b] border-[#27272a] text-xs">
          <SelectValue placeholder="Select..." />
        </SelectTrigger>
        <SelectContent className="bg-[#18181b] border-[#27272a]">
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value} className="text-[#fafafa] text-xs">
              <div className="flex items-center gap-2">
                {opt.color && (
                  <div
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: opt.color }}
                  />
                )}
                {opt.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="notion-filters">
      {/* Active Filters */}
      {filters.map((filter) => (
        <div
          key={filter.id}
          className="flex items-center gap-1 bg-[#27272a] rounded-lg px-2 py-1 border border-[#3f3f46]"
        >
          <span className="text-xs text-[#a1a1aa]">
            {filterTypes.find((f) => f.value === filter.field)?.label}
          </span>
          {renderFilterValue(filter)}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => removeFilter(filter.id)}
            className="h-5 w-5 p-0 hover:bg-[#3f3f46] text-[#a1a1aa]"
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ))}

      {/* Add Filter Button */}
      <Popover open={showAddFilter} onOpenChange={setShowAddFilter}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-7 bg-[#18181b] border-[#27272a] text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#fafafa]"
          >
            <Plus className="h-3 w-3 mr-1" />
            Add Filter
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-48 p-2 bg-[#18181b] border-[#27272a]">
          <div className="space-y-1">
            {filterTypes.map((type) => (
              <Button
                key={type.value}
                variant="ghost"
                size="sm"
                onClick={() => addFilter(type.value)}
                className="w-full justify-start text-xs text-[#fafafa] hover:bg-[#27272a]"
              >
                {type.label}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>

      {/* Clear All */}
      {filters.length > 0 && (
        <Button
          variant="ghost"
          size="sm"
          onClick={clearAllFilters}
          className="h-7 text-xs text-[#a1a1aa] hover:text-[#ef4444]"
        >
          Clear All
        </Button>
      )}
    </div>
  );
};

// Apply filters to data
export const applyFilters = (data, filters) => {
  if (!filters || filters.length === 0) return data;

  return data.filter((item) => {
    return filters.every((filter) => {
      if (!filter.value && !['this_week', 'this_month', 'overdue'].includes(filter.operator)) {
        return true;
      }

      const itemValue = item[filter.field];
      const filterConfig = filterTypes.find((f) => f.value === filter.field);

      if (filterConfig?.type === 'date') {
        const itemDate = itemValue ? new Date(itemValue) : null;
        const now = new Date();

        switch (filter.operator) {
          case 'is':
            if (!itemDate || !filter.value) return true;
            return itemDate.toDateString() === new Date(filter.value).toDateString();
          case 'before':
            if (!itemDate || !filter.value) return true;
            return itemDate < new Date(filter.value);
          case 'after':
            if (!itemDate || !filter.value) return true;
            return itemDate > new Date(filter.value);
          case 'this_week':
            if (!itemDate) return false;
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekStart.getDate() + 6);
            return itemDate >= weekStart && itemDate <= weekEnd;
          case 'this_month':
            if (!itemDate) return false;
            return (
              itemDate.getMonth() === now.getMonth() &&
              itemDate.getFullYear() === now.getFullYear()
            );
          case 'overdue':
            if (!itemDate || item.status === 'completed') return false;
            return itemDate < now;
          default:
            return true;
        }
      }

      return itemValue === filter.value;
    });
  });
};

export default NotionFilters;
