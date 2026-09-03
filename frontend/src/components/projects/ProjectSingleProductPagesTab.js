import React from 'react';
import { Card, CardContent } from '../ui/card';
import { ShoppingBag, ExternalLink } from 'lucide-react';

// Walks every page's sub_pages tree (to unbounded depth, same shape the
// Pages tab's recursive Sub Pages editor writes) collecting nodes tagged
// Page Type "Single Product Page", each with a breadcrumb of its full
// location (Page > Sub Page > ... > this node).
function collectSingleProductPages(pages) {
  const results = [];
  const walk = (nodes, trail) => {
    for (const node of nodes || []) {
      const nextTrail = [...trail, node.name];
      if (node.page_type === 'Single Product Page') {
        results.push({ id: node.id, name: node.name, pageLink: node.page_link || '', breadcrumb: nextTrail.join(' > ') });
      }
      walk(node.sub_pages || [], nextTrail);
    }
  };
  for (const page of pages || []) {
    walk(page.sub_pages || [], [page.page_name]);
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
  textPrimary,
  textSecondary,
  borderColor,
}) {
  const items = collectSingleProductPages(project?.pages || []);

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

      <div className={`${bgCard} border ${borderColor} rounded-lg p-3 w-fit`} data-testid="single-product-pages-summary-total">
        <p className={`text-[11px] uppercase tracking-wide ${textSecondary}`}>Total</p>
        <p className={`text-2xl font-bold mt-0.5 ${textPrimary}`}>{items.length}</p>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-0">
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
                {items.map((it) => (
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
                {items.length === 0 && (
                  <tr>
                    <td colSpan={3} className={`p-8 text-center text-xs ${textSecondary}`}>
                      No Single Product Pages yet. Tag a sub page's Page Type as "Single Product Page" from the Pages tab.
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
