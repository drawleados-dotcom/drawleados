import React from 'react';
import { Crown, Building2, Briefcase, Wrench, Megaphone } from 'lucide-react';

// Static company hierarchy
const TREE = [
  // [depth, id, name, color, IconName]
  { depth: 0, id: 'ceo', name: 'CEO', color: '#f59e0b', icon: 'crown' },
  { depth: 1, id: 'finance', name: 'Finance', color: '#10b981', icon: 'building' },
  { depth: 1, id: 'sales', name: 'Sales', color: '#3b82f6', icon: 'brief' },
  { depth: 1, id: 'hr', name: 'HR', color: '#ec4899', icon: 'building' },
  { depth: 1, id: 'operations', name: 'Operations', color: '#6366f1', icon: 'brief' },
  { depth: 2, id: 'ops_marketing', name: 'Marketing', color: '#ec4899', icon: 'mega' },
  { depth: 3, id: 'seo', name: 'SEO', color: '#8b5cf6' },
  { depth: 3, id: 'social_media', name: 'Social Media', color: '#06b6d4' },
  { depth: 3, id: 'meta_ads', name: 'Meta Ads', color: '#3b82f6' },
  { depth: 3, id: 'google_ads', name: 'Google Ads', color: '#ef4444' },
  { depth: 2, id: 'technology', name: 'Technology', color: '#10b981', icon: 'wrench' },
  { depth: 3, id: 'website', name: 'Website', color: '#6366f1' },
  { depth: 3, id: 'ecommerce', name: 'Ecommerce', color: '#f59e0b' },
  { depth: 3, id: 'erp', name: 'ERP', color: '#8b5cf6' },
];

const ICONS = { crown: Crown, building: Building2, brief: Briefcase, wrench: Wrench, mega: Megaphone };

export default function OrgChart({ isDark, bgSecondary, textPrimary, textSecondary, borderColor }) {
  const dashColor = isDark ? 'border-[#3f3f46]' : 'border-gray-300';
  return (
    <div className="font-sans space-y-1" data-testid="org-chart">
      {TREE.map((n) => {
        const Icon = n.icon ? ICONS[n.icon] : null;
        const indent = n.depth * 28;
        return (
          <div
            key={n.id}
            className="flex items-center"
            style={{ paddingLeft: indent }}
            data-testid={`org-node-${n.id}`}
          >
            {n.depth > 0 && (
              <span className={`inline-block w-4 border-t border-dashed ${dashColor} mr-2`} />
            )}
            <div
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${borderColor} ${bgSecondary} min-w-[200px]`}
              style={{ borderLeft: `4px solid ${n.color}` }}
            >
              {Icon ? (
                <Icon className="h-4 w-4" style={{ color: n.color }} />
              ) : (
                <span className="w-3 h-3 rounded-full inline-block" style={{ backgroundColor: n.color }} />
              )}
              <span className={`text-sm font-medium ${textPrimary}`}>{n.name}</span>
              {n.depth === 0 && (
                <span className={`text-[10px] ${textSecondary} ml-auto`}>Top</span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
