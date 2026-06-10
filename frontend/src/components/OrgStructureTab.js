import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, CardContent } from './ui/card';
import OrgChart from './OrgChart';

export default function OrgStructureTab({ isDark, bgCard, bgSecondary, textPrimary, textSecondary, borderColor }) {
  return (
    <div className="space-y-6" data-testid="org-structure-tab">
      <div>
        <h2 className={`text-xl font-bold ${textPrimary}`}>Org Structure</h2>
        <p className={textSecondary}>Company hierarchy from CEO down to every sub-department.</p>
      </div>

      <Card className={`${bgCard} border ${borderColor}`}>
        <CardContent className="p-6 overflow-x-auto">
          <OrgChart
            isDark={isDark}
            bgCard={bgCard}
            bgSecondary={bgSecondary}
            textPrimary={textPrimary}
            textSecondary={textSecondary}
            borderColor={borderColor}
          />
        </CardContent>
      </Card>

      <div className={`text-xs ${textSecondary}`}>
        <AlertCircle className="h-3 w-3 inline mr-1" />
        Edit support coming soon — drag, add, rename, delete nodes inline.
      </div>
    </div>
  );
}
