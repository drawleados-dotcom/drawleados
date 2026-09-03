import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { ShoppingBag, ExternalLink } from 'lucide-react';

// Walks every page's sub_pages tree (to unbounded depth, same shape the
// Pages tab's recursive Sub Pages editor writes) collecting nodes tagged
// Page Type "Single Product Page", each carrying its full ancestor trail
// (Page, then every Sub Page down to this node) — used both for the
// breadcrumb display and the Sub Page filter dropdown below.
function collectSingleProductPages(pages) {
  const results = [];
  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const nextTrail = [...trail, { id: node.id, name: node.name }];
      if (node.page_type === 'Single Product Page') {
        results.push({
          id: node.id,
          name: node.name,
          pageLink: node.page_link || '',
          trail: nextTrail,
          breadcrumb: nextTrail.map((t) => t.name).join(' > '),
        });
      }
      walk(node.sub_pages || [], nextTrail);
    }
  };
  for (const page of pages || []) {
    walk(page.sub_pages || [], [{ id: page.id, name: page.page_name }]);
  }
  return results;
}

/**
 * Read-only rollup of every Sub Page (at any depth, under any Page) whose
 * Page Type is "Single Product Page" — set from the Pages tab's Add/Edit
 * Sub Page popup — so one buried three levels deep still surfaces here
 * with its full location, without anyone having to go hunt for it.
 */
export default function ProjectSingleProductPagesTab({
  project,
  bgCard,
  bgSecondary,
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const items = collectSingleProductPages(project?.pages || []);

  // Every Page/Sub Page that has at least one Single Product Page beneath
  // it (i.e. every proper ancestor across all items, deduped by id) —
  // picking one narrows the list to items whose trail passes through it.
  const ancestorOptions = [];
  const seenAncestorIds = new Set();
  for (const it of items) {
    for (const anc of it.trail.slice(0, -1)) {
      if (!seenAncestorIds.has(anc.id)) {
        seenAncestorIds.add(anc.id);
        ancestorOptions.push(anc);
      }
    }
  }

  const [subPageFilter, setSubPageFilter] = useState('all');
  const filteredItems = subPageFilter === 'all'
    ? items
    : items.filter((it) => it.trail.some((t) => t.id === subPageFilter));

  return (
    <div className="space-y-3" data-testid="project-single-product-pages-tab">
      <div>
        <h3 className={`text-lg font-semibold ${textPrimary} flex items-center gap-2`}>
          <ShoppingBag className="h-5 w-5 text-[#6366f1]" /> Single Product Pages
        </h3>
        <p className={`text-xs ${textSecondary}`}>
          Every sub page tagged Page Type "Single Product Page", across every page and sub page, with its full location.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className={`${bgCard} border ${borderColor} rounded-lg p-3 w-fit`} data-testid="single-product-pages-summary-total">
          <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Total</p>
          <p className={`text-2xl font-bold mt-0.5 ${textPrimary}`}>{items.length}</p>
        </div>
        <Select value={subPageFilter} onValueChange={setSubPageFilter}>
          <SelectTrigger className={`h-9 w-[220px] ${bgSecondary} border ${borderColor} ${textPrimary} text-sm`} data-testid="single-product-pages-filter-subpage">
            <SelectValue placeholder="All Sub Pages" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sub Pages</SelectItem>
            {ancestorOptions.map((anc) => (
              <SelectItem key={anc.id} value={anc.id}>{anc.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
          {subPageFilter !== 'all' && (
            <p className={`px-3 pt-3 text-[11px] ${textSecondary}`}>Showing {filteredItems.length} of {items.length} single product pages.</p>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className={`border-b ${borderColor}`}>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Page Name</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Location</th>
                  <th className={`text-left p-3 text-[11px] font-medium ${textSecondary} uppercase`}>Page Link</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((it) => (
                  <tr key={it.id} className={`border-b ${borderColor} last:border-b-0`} data-testid={`single-product-page-row-${it.id}`}>
                    <td className={`p-3 text-sm font-medium ${textPrimary}`}>{it.name}</td>
                    <td className={`p-3 text-xs ${textSecondary}`}>{it.breadcrumb}</td>
                    <td className="p-3">
                      {it.pageLink ? (
                        <a
                          href={it.pageLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-[#6366f1] hover:underline inline-flex items-center gap-1"
                        >
                          <ExternalLink className="h-3 w-3" /> Open
                        </a>
                      ) : (
                        <span className={`text-xs ${textSecondary}`}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={3} className={`p-8 text-center text-xs ${textSecondary}`}>
                      {items.length === 0
                        ? 'No Single Product Pages yet. Tag a sub page\'s Page Type as "Single Product Page" from the Pages tab.'
                        : 'No single product pages under this sub page.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
