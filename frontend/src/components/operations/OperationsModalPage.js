import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../Layout';
import { useTheme } from '../../contexts/ThemeContext';
import OurTasksPage from '../../pages/OurTasksPage';
import { X } from 'lucide-react';

/**
 * OperationsModalPage
 * Renders the full Operations dashboard (OurTasksPage) inside a large
 * centered modal overlay (~90% width/height). Used when navigating to
 * /approvals from the sidebar — opens directly on the Approvals tab.
 *
 * Close → navigates back (router history) or to /our-tasks as fallback.
 */
export default function OperationsModalPage({ defaultTab = 'approvals' }) {
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const [open, setOpen] = useState(true);

  const bgCard = isDark ? 'bg-[#0a0a0a]' : 'bg-white';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';

  const handleClose = () => {
    setOpen(false);
    // Slight delay so the close animation can show before route change
    setTimeout(() => {
      if (window.history.length > 1) {
        navigate(-1);
      } else {
        navigate('/our-tasks');
      }
    }, 80);
  };

  // Close on Escape
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Layout>
      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/60 backdrop-blur-sm"
          onClick={handleClose}
          data-testid="operations-modal-overlay"
        >
          <div
            className={`relative w-[92vw] h-[92vh] max-w-[1600px] rounded-2xl border ${borderColor} ${bgCard} shadow-2xl overflow-hidden flex flex-col`}
            onClick={(e) => e.stopPropagation()}
            data-testid="operations-modal-container"
          >
            {/* Modal Top Bar */}
            <div className={`flex items-center justify-between px-6 py-3 border-b ${borderColor}`}>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-[#10b981]" />
                <span className={`text-sm font-medium ${textSecondary}`}>Operations Panel</span>
              </div>
              <button
                onClick={handleClose}
                className={`p-2 rounded-lg ${textSecondary} hover:bg-[#6366f1]/10 hover:text-[#6366f1] transition-all`}
                data-testid="operations-modal-close"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body — renders the same OurTasksPage in modal mode */}
            <div className="flex-1 overflow-auto p-6">
              <OurTasksPage inModal defaultTab={defaultTab} />
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
