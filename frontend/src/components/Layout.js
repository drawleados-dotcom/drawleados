import React from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DrawleadAI from './DrawleadAI';

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
  '/settings': 'general'
};

const Layout = ({ children }) => {
  const location = useLocation();
  const currentModule = routeToContext[location.pathname] || 'general';

  return (
    <div className="flex h-screen bg-[#09090b] overflow-hidden">
      <Sidebar />
      <div className="flex-1 overflow-auto">
        <div className="p-8">{children}</div>
      </div>
      <DrawleadAI currentModule={currentModule} />
    </div>
  );
};

export default Layout;
