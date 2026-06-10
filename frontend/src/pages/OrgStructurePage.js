import React from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import { Button } from '../components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import OrgStructureTab from '../components/OrgStructureTab';

export default function OrgStructurePage() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const navigate = useNavigate();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';

  return (
    <Layout>
      <div className={`p-6 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} min-h-screen`} data-testid="org-structure-page">
        <div className="flex items-center gap-3 mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/hr-admin')}
            className={textSecondary}
            data-testid="org-structure-back"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to HR Admin
          </Button>
        </div>
        <OrgStructureTab
          isDark={isDark}
          bgCard={bgCard}
          bgSecondary={bgSecondary}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      </div>
    </Layout>
  );
}
