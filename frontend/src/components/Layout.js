import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import DrawleadAI from './DrawleadAI';
import ThemeToggle from './ThemeToggle';
import { useTheme } from '../contexts/ThemeContext';
import { useAuth } from '../contexts/AuthContext';
import { Clock, LogIn, LogOut } from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';
import axios from 'axios';

const API = process.env.REACT_APP_BACKEND_URL;

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
  const { user } = useAuth();
  const currentModule = routeToContext[location.pathname] || 'general';
  
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // Load today's attendance
  const loadTodayAttendance = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${API}/api/hr/attendance/today`, { headers });
      setTodayAttendance(res.data.attendance);
    } catch (error) {
      console.error('Error loading attendance:', error);
    }
  }, [token]);

  useEffect(() => {
    loadTodayAttendance();
  }, [loadTodayAttendance]);

  const handleClockIn = async () => {
    setLoading(true);
    try {
      await axios.post(`${API}/api/hr/attendance/clock-in`, {}, { headers });
      toast.success('Clocked in successfully!');
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock in');
    }
    setLoading(false);
  };

  const handleClockOut = async () => {
    setLoading(true);
    try {
      await axios.put(`${API}/api/hr/attendance/clock-out`, {}, { headers });
      toast.success('Clocked out successfully!');
      loadTodayAttendance();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to clock out');
    }
    setLoading(false);
  };

  const formatTime = (dateStr) => {
    if (!dateStr) return '--:--';
    const date = new Date(dateStr);
    return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  const isClockedIn = todayAttendance?.clock_in && !todayAttendance?.clock_out;
  const isClockedOut = todayAttendance?.clock_out;

  return (
    <div className={`flex h-screen overflow-hidden ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'}`}>
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with Attendance & Theme Toggle */}
        <header className={`h-14 flex items-center justify-between px-6 border-b ${isDark ? 'bg-[#0c0a09] border-[#27272a]' : 'bg-white border-gray-200'}`}>
          {/* Left: Attendance Info */}
          <div className="flex items-center gap-4">
            <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-[#a1a1aa]' : 'text-gray-600'}`}>
              <Clock className="h-4 w-4" />
              <span>In: <strong className={isDark ? 'text-[#fafafa]' : 'text-gray-900'}>{formatTime(todayAttendance?.clock_in)}</strong></span>
              <span className="mx-1">|</span>
              <span>Out: <strong className={isDark ? 'text-[#fafafa]' : 'text-gray-900'}>{formatTime(todayAttendance?.clock_out)}</strong></span>
            </div>
            
            {/* Clock In/Out Button */}
            {!isClockedOut && (
              <Button
                size="sm"
                onClick={isClockedIn ? handleClockOut : handleClockIn}
                disabled={loading}
                className={`h-8 px-3 text-xs ${
                  isClockedIn 
                    ? 'bg-[#ef4444] hover:bg-[#dc2626] text-white' 
                    : 'bg-[#10b981] hover:bg-[#059669] text-white'
                }`}
              >
                {isClockedIn ? (
                  <>
                    <LogOut className="h-3 w-3 mr-1" />
                    Clock Out
                  </>
                ) : (
                  <>
                    <LogIn className="h-3 w-3 mr-1" />
                    Clock In
                  </>
                )}
              </Button>
            )}
            
            {isClockedOut && (
              <span className="text-xs text-[#10b981] font-medium">✓ Day Complete</span>
            )}
          </div>
          
          {/* Right: Theme Toggle */}
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
