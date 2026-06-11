import React, { useState, useEffect } from 'react';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import api from '../utils/api';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Badge } from '../components/ui/badge';
import { Switch } from '../components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Checkbox } from '../components/ui/checkbox';
import { 
  Users, Shield, Building2, Plus, Search, Edit, Trash2, 
  Layers, Tag, Layout as LayoutIcon, Database
} from 'lucide-react';
import { toast } from 'sonner';
import CompanyProfileTab from '../components/settings/CompanyProfileTab';
import WorkspacesTab from '../components/settings/WorkspacesTab';
import StatusManagementTab from '../components/settings/StatusManagementTab';
import DatabaseToolsTab from '../components/hr/DatabaseToolsTab';

const SettingsPage = () => {
  const { isDark } = useTheme();
  const [users, setUsers] = useState([]);
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('company');
  const [searchTerm, setSearchTerm] = useState('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedService, setSelectedService] = useState(null);

  // Theme classes
  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const bgSecondary = isDark ? 'bg-[#27272a]' : 'bg-gray-100';
  const bgInput = isDark ? 'bg-[#09090b]' : 'bg-white';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-600';
  const borderColor = isDark ? 'border-[#27272a]' : 'border-gray-200';
  const hoverBg = isDark ? 'hover:bg-[#3f3f46]' : 'hover:bg-gray-200';

  const roles = [
    { value: 'super_admin', label: 'Super Admin', color: '#ef4444' },
    { value: 'admin', label: 'Admin', color: '#f59e0b' },
    { value: 'project_manager', label: 'Project Manager', color: '#8b5cf6' },
    { value: 'business_development', label: 'Business Development', color: '#3b82f6' },
    { value: 'employee', label: 'Employee', color: '#10b981' },
  ];

  const modules = [
    // Core Modules
    { value: 'calendar', label: 'Calendar' },
    { value: 'my_tasks', label: 'My Tasks' },
    { value: 'our_tasks', label: 'Our Tasks' },
    { value: 'my_profile', label: 'My Profile' },
    
    // Sales
    { value: 'sales', label: 'Sales' },
    { value: 'leads', label: 'Leads' },
    { value: 'bde_tasks', label: 'BDE Tasks' },
    
    // Operations
    { value: 'operations', label: 'Operations' },
    { value: 'tasks', label: 'Tasks' },
    { value: 'website_projects', label: 'Website Projects' },
    { value: 'seo_works', label: 'SEO Works' },
    { value: 'social_media', label: 'Social Media' },
    { value: 'creative_board', label: 'Creative Board' },
    { value: 'meta_ads', label: 'Meta Ads' },
    
    // Admin Modules
    { value: 'hr', label: 'HR' },
    { value: 'hr_admin', label: 'HR Admin' },
    { value: 'finance', label: 'Finance' },
    { value: 'settings', label: 'Settings' },
    { value: 'documentations', label: 'Documentations' },
    
    // Reports
    { value: 'reports', label: 'Reports' },
  ];

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [usersRes, servicesRes] = await Promise.all([
        api.get('/users').catch(() => ({ data: [] })),
        api.get('/services'),
      ]);
      setUsers(usersRes.data || []);
      setServices(servicesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load settings data');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = () => {
    setSelectedUser(null);
    setShowUserModal(true);
  };

  const handleEditUser = (user) => {
    setSelectedUser(user);
    setShowUserModal(true);
  };

  const handleSaveUser = async (userData) => {
    try {
      if (selectedUser) {
        await api.put(`/users/${selectedUser.user_id}`, userData);
        toast.success('User updated successfully');
      } else {
        const response = await api.post('/admin/create-user', userData);
        if (response.data.email_sent) {
          toast.success('User created and credentials sent via email');
        } else {
          toast.success('User created (email notification failed - please share credentials manually)');
        }
      }
      await fetchData();
      setShowUserModal(false);
      setSelectedUser(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save user');
    }
  };

  const handleDeleteUser = async (userId) => {
    if (!window.confirm('Are you sure you want to deactivate this user?')) return;
    try {
      await api.delete(`/users/${userId}`);
      toast.success('User deactivated');
      fetchData();
    } catch (error) {
      toast.error('Failed to deactivate user');
    }
  };

  const handleCreateService = () => {
    setSelectedService(null);
    setShowServiceModal(true);
  };

  const handleEditService = (service) => {
    setSelectedService(service);
    setShowServiceModal(true);
  };

  const handleSaveService = async (serviceData) => {
    try {
      if (selectedService) {
        await api.put(`/services/${selectedService.service_id}`, serviceData);
        toast.success('Service updated successfully');
      } else {
        await api.post('/services', serviceData);
        toast.success('Service created successfully');
      }
      await fetchData();
      setShowServiceModal(false);
      setSelectedService(null);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to save service');
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;
    try {
      await api.delete(`/services/${serviceId}`);
      toast.success('Service deleted');
      fetchData();
    } catch (error) {
      toast.error('Failed to delete service');
    }
  };

  const filteredUsers = users.filter((user) => {
    const search = searchTerm.toLowerCase();
    return (
      user.name?.toLowerCase().includes(search) ||
      user.email?.toLowerCase().includes(search) ||
      user.role?.toLowerCase().includes(search)
    );
  });

  const filteredServices = services.filter((service) => {
    const search = searchTerm.toLowerCase();
    return (
      service.name?.toLowerCase().includes(search) ||
      service.category?.toLowerCase().includes(search)
    );
  });

  const getRoleColor = (role) => {
    const r = roles.find((r) => r.value === role);
    return r ? r.color : '#71717a';
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full">
          <p className={textSecondary}>Loading settings...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className={`space-y-6 p-6 ${isDark ? 'bg-[#09090b]' : 'bg-gray-50'} min-h-screen`} data-testid="settings-page">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-4xl font-bold tracking-tight mb-2"
              style={{ fontFamily: 'Plus Jakarta Sans' }}
            >
              <span className="bg-gradient-to-r from-[#6366f1] to-[#8b5cf6] bg-clip-text text-transparent">
                Settings
              </span>
            </h1>
            <p className={`${textSecondary} text-base`}>
              Manage company profile, users, workspaces, and system settings
            </p>
          </div>
        </div>

        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className={`${bgCard} border ${borderColor} p-1 flex-wrap h-auto`}>
            <TabsTrigger
              value="company"
              data-testid="company-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <Building2 className="h-4 w-4 mr-2" />
              Company
            </TabsTrigger>
            <TabsTrigger
              value="database"
              data-testid="settings-database-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <Database className="h-4 w-4 mr-2" />
              Database Tools
            </TabsTrigger>
          </TabsList>

          {/* Company Tab Content */}
          <TabsContent value="company" className="mt-6">
            <CompanyProfileTab 
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              bgInput={bgInput}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          </TabsContent>

          {/* Database Tools Tab Content */}
          <TabsContent value="database" className="mt-6">
            <DatabaseToolsTab
              isDark={isDark}
              bgCard={bgCard}
              bgSecondary={bgSecondary}
              textPrimary={textPrimary}
              textSecondary={textSecondary}
              borderColor={borderColor}
            />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default SettingsPage;
