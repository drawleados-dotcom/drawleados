import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DrawleadAI from './DrawleadAI';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';

// Map routes to AI context types
const routeToContext = {
  '/leads': 'sales',
  '/operations': 'operations',
  '/marketing': 'marketing',
  '/finance': 'finance',
  '/hr': 'general',
  '/hr-admin': 'general',
  '/dashboard': 'general',
  '/reports': 'sales',
  '/services': 'general',
  '/settings': 'general',
  '/sop-works': 'operations',
  '/website-projects': 'operations',
  '/profile': 'general'
};

const Layout = ({ children }) => {
  const location = useLocation();
  const { isDark } = useTheme();
  const currentModule = routeToContext[location.pathname] || 'general';

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Theme Toggle */}
        <header className={`h-14 flex items-center justify-end px-6 border-b ${isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          <ThemeToggle />
        </header>
        {/* Main Content */}
        <div className="flex-1 overflow-auto">
          <div className="p-8">{children}</div>
        </div>
      </div>
      <DrawleadAI currentModule={currentModule} />
    </div>
  );
};

export default Layout;
