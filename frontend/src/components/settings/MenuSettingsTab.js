import React from 'react';
import { useMenuLayout } from '../../hooks/useMenuLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../ui/card';
import { Sidebar as SidebarIcon, AlignJustify } from 'lucide-react';

export default function MenuSettingsTab({
  bgCard, bgSecondary, textPrimary, textSecondary, borderColor,
}) {
  const { layout, setLayout } = useMenuLayout();

  const options = [
    {
      key: 'sidebar',
      label: 'Sidebar View',
      desc: 'Classic left vertical sidebar with all your assigned modules.',
      icon: SidebarIcon,
    },
    {
      key: 'top',
      label: 'Top Menu View',
      desc: 'Compact horizontal nav at the top — all assigned pages in one row.',
      icon: AlignJustify,
    },
  ];

  return (
    <Card className={`${bgCard} border ${borderColor}`}>
      <CardHeader>
        <CardTitle className={textPrimary}>Menu Layout</CardTitle>
        <CardDescription className={textSecondary}>
          Choose how the navigation menu is displayed across the app. Saved on this device.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {options.map((opt) => {
            const Icon = opt.icon;
            const selected = layout === opt.key;
            return (
              <button
                key={opt.key}
                type="button"
                onClick={() => setLayout(opt.key)}
                data-testid={`menu-layout-${opt.key}`}
                className={`text-left p-4 rounded-xl border-2 transition-all hover:shadow-md
                  ${selected ? 'border-[#6366f1] ring-2 ring-[#6366f1]/30 bg-[#6366f1]/5' : `${borderColor} ${bgSecondary}`}`}
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg ${selected ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <div className={`font-semibold ${textPrimary}`}>{opt.label}</div>
                    <p className={`text-xs ${textSecondary} mt-1`}>{opt.desc}</p>
                    {selected && (
                      <span className="inline-block mt-2 text-xs text-[#6366f1] font-medium">
                        ● Active
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
