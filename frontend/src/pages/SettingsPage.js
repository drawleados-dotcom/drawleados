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
  Layers, Tag, Layout as LayoutIcon
} from 'lucide-react';
import { toast } from 'sonner';
import CompanyProfileTab from '../components/settings/CompanyProfileTab';
import WorkspacesTab from '../components/settings/WorkspacesTab';
import StatusManagementTab from '../components/settings/StatusManagementTab';

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
              value="workspaces"
              data-testid="workspaces-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <LayoutIcon className="h-4 w-4 mr-2" />
              Workspaces
            </TabsTrigger>
            <TabsTrigger
              value="users"
              data-testid="users-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <Users className="h-4 w-4 mr-2" />
              Users
            </TabsTrigger>
            <TabsTrigger
              value="services"
              data-testid="services-settings-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <Layers className="h-4 w-4 mr-2" />
              Services
            </TabsTrigger>
            <TabsTrigger
              value="statuses"
              data-testid="statuses-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <Tag className="h-4 w-4 mr-2" />
              Statuses
            </TabsTrigger>
            <TabsTrigger
              value="roles"
              data-testid="roles-tab"
              className="data-[state=active]:bg-[#6366f1] data-[state=active]:text-white"
            >
              <Shield className="h-4 w-4 mr-2" />
              Roles
            </TabsTrigger>
          </TabsList>

          {/* Company Profile Tab */}
          <TabsContent value="company" className="mt-6">
            <CompanyProfileTab />
          </TabsContent>

          {/* Workspaces Tab */}
          <TabsContent value="workspaces" className="mt-6">
            <WorkspacesTab users={users} />
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                  <Input
                    placeholder="Search users..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="search-users-input"
                    className={`pl-10 ${bgInput} border ${borderColor} ${textPrimary} focus:border-[#6366f1]`}
                  />
                </div>
                <Button
                  onClick={handleCreateUser}
                  data-testid="create-user-button"
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>

              {/* Users Table */}
              <div className={`${bgCard} border ${borderColor} rounded-xl overflow-hidden`}>
                <table className="w-full">
                  <thead className={isDark ? 'bg-[#09090b]' : 'bg-gray-50'}>
                    <tr>
                      <th className={`text-left p-4 text-xs font-medium ${textSecondary} uppercase`}>User</th>
                      <th className={`text-left p-4 text-xs font-medium ${textSecondary} uppercase`}>Role</th>
                      <th className={`text-left p-4 text-xs font-medium ${textSecondary} uppercase`}>Module Access</th>
                      <th className={`text-left p-4 text-xs font-medium ${textSecondary} uppercase`}>Permissions</th>
                      <th className={`text-right p-4 text-xs font-medium ${textSecondary} uppercase`}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.user_id}
                        className={`border-t ${borderColor} ${isDark ? 'hover:bg-[#27272a]/30' : 'hover:bg-gray-50'} transition-colors`}
                        data-testid={`user-row-${user.user_id}`}
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-gradient-to-br from-[#6366f1] to-[#8b5cf6] flex items-center justify-center text-white font-semibold">
                              {user.name?.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className={`text-sm font-medium ${textPrimary}`}>{user.name}</p>
                              <p className={`text-xs ${textSecondary}`}>{user.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <Badge
                            style={{ backgroundColor: `${getRoleColor(user.role)}20`, color: getRoleColor(user.role), borderColor: getRoleColor(user.role) }}
                            className="border"
                          >
                            {roles.find((r) => r.value === user.role)?.label || user.role}
                          </Badge>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {(user.module_access || []).map((mod) => (
                              <Badge key={mod} variant="outline" className={`text-xs ${borderColor} ${textSecondary}`}>
                                {mod}
                              </Badge>
                            ))}
                          </div>
                        </td>
                        <td className="p-4">
                          <div className="flex flex-wrap gap-1">
                            {user.can_create_projects && (
                              <Badge className="text-xs bg-[#10b981]/20 text-[#10b981] border-[#10b981]">Create Projects</Badge>
                            )}
                            {user.can_delete_tasks && (
                              <Badge className="text-xs bg-[#f59e0b]/20 text-[#f59e0b] border-[#f59e0b]">Delete Tasks</Badge>
                            )}
                            {user.can_manage_users && (
                              <Badge className="text-xs bg-[#ef4444]/20 text-[#ef4444] border-[#ef4444]">Manage Users</Badge>
                            )}
                          </div>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              size="sm"
                              onClick={() => handleEditUser(user)}
                              data-testid={`edit-user-${user.user_id}`}
                              className={`${bgSecondary} hover:bg-[#3f3f46] ${textPrimary} h-8`}
                            >
                              <Edit className="h-3 w-3" />
                            </Button>
                            <Button
                              size="sm"
                              onClick={() => handleDeleteUser(user.user_id)}
                              data-testid={`delete-user-${user.user_id}`}
                              className={`${bgSecondary} hover:bg-[#ef4444] ${textPrimary} h-8`}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {filteredUsers.length === 0 && (
                  <div className={`p-8 text-center ${textSecondary}`}>No users found</div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Services Tab */}
          <TabsContent value="services" className="mt-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="relative flex-1 max-w-md">
                  <Search className={`absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 ${textSecondary}`} />
                  <Input
                    placeholder="Search services..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    data-testid="search-services-input"
                    className={`pl-10 ${bgInput} border ${borderColor} ${textPrimary} focus:border-[#6366f1]`}
                  />
                </div>
                <Button
                  onClick={handleCreateService}
                  data-testid="create-service-button"
                  className="bg-[#6366f1] hover:bg-[#4f46e5] text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Service
                </Button>
              </div>

              {/* Services Grid */}
              <div className="grid grid-cols-3 gap-4">
                {filteredServices.map((service) => (
                  <div
                    key={service.service_id}
                    className={`${bgCard} border ${borderColor} rounded-xl p-4 hover:border-[#6366f1]/30 transition-all`}
                    data-testid={`service-card-${service.service_id}`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className={`text-sm font-semibold ${textPrimary}`}>{service.name}</h3>
                        <p className={`text-xs ${textSecondary}`}>{service.category}</p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          onClick={() => handleEditService(service)}
                          className={`${bgSecondary} hover:bg-[#3f3f46] ${textPrimary} h-7 w-7 p-0`}
                        >
                          <Edit className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleDeleteService(service.service_id)}
                          className={`${bgSecondary} hover:bg-[#ef4444] ${textPrimary} h-7 w-7 p-0`}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className={`text-xs ${textSecondary}`}>Base Price</span>
                        <span className={`text-sm font-medium ${textPrimary}`}>₹{service.amount?.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className={`text-xs ${textSecondary}`}>Billing</span>
                        <Badge variant="outline" className={`text-xs ${borderColor} ${textSecondary}`}>
                          {service.billing_type}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              {filteredServices.length === 0 && (
                <div className={`p-8 text-center ${textSecondary} ${bgCard} border ${borderColor} rounded-xl`}>
                  No services found
                </div>
              )}
            </div>
          </TabsContent>

          {/* Statuses Tab */}
          <TabsContent value="statuses" className="mt-6">
            <StatusManagementTab />
          </TabsContent>

          {/* Roles Tab */}
          <TabsContent value="roles" className="mt-6">
            <div className="space-y-6">
              <p className={`text-sm ${textSecondary}`}>
                Role-based access control defines what each user type can see and do in the system.
              </p>
              
              <div className="grid grid-cols-1 gap-4">
                {roles.map((role) => (
                  <div
                    key={role.value}
                    className={`${bgCard} border ${borderColor} rounded-xl p-6`}
                    data-testid={`role-card-${role.value}`}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div
                          className="h-10 w-10 rounded-lg flex items-center justify-center"
                          style={{ backgroundColor: `${role.color}20` }}
                        >
                          <Shield className="h-5 w-5" style={{ color: role.color }} />
                        </div>
                        <div>
                          <h3 className={`text-lg font-semibold ${textPrimary}`}>{role.label}</h3>
                          <p className={`text-xs ${textSecondary}`}>{role.value}</p>
                        </div>
                      </div>
                      <Badge style={{ backgroundColor: `${role.color}20`, color: role.color }}>
                        {users.filter((u) => u.role === role.value).length} users
                      </Badge>
                    </div>
                    
                    <div className="grid grid-cols-5 gap-4">
                      {modules.map((mod) => {
                        const hasAccess = 
                          role.value === 'super_admin' ||
                          (role.value === 'admin' && mod.value !== 'settings') ||
                          (role.value === 'project_manager' && ['operations', 'reports'].includes(mod.value)) ||
                          (role.value === 'bde' && mod.value === 'leads') ||
                          (role.value === 'employee' && mod.value === 'operations');
                        
                        return (
                          <div
                            key={mod.value}
                            className={`p-3 rounded-lg border ${
                              hasAccess
                                ? 'bg-[#10b981]/10 border-[#10b981]/30'
                                : `${bgSecondary} ${borderColor}`
                            }`}
                          >
                            <p className={`text-sm font-medium ${hasAccess ? 'text-[#10b981]' : 'text-[#71717a]'}`}>
                              {mod.label}
                            </p>
                            <p className={`text-xs ${textSecondary}`}>
                              {hasAccess ? 'Enabled' : 'Disabled'}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* User Modal */}
      {showUserModal && (
        <UserFormModal
          user={selectedUser}
          roles={roles}
          modules={modules}
          onClose={() => setShowUserModal(false)}
          onSave={handleSaveUser}
          isDark={isDark}
          bgCard={bgCard}
          bgInput={bgInput}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      )}

      {/* Service Modal */}
      {showServiceModal && (
        <ServiceFormModal
          service={selectedService}
          onClose={() => setShowServiceModal(false)}
          onSave={handleSaveService}
          isDark={isDark}
          bgCard={bgCard}
          bgInput={bgInput}
          textPrimary={textPrimary}
          textSecondary={textSecondary}
          borderColor={borderColor}
        />
      )}
    </Layout>
  );
};

// User Form Modal Component
const UserFormModal = ({ user, roles, modules, onClose, onSave, isDark, bgCard, bgInput, textPrimary, textSecondary, borderColor }) => {
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    password: '',
    role: user?.role || 'employee',
    module_access: user?.module_access || [],
    can_create_projects: user?.can_create_projects || false,
    can_delete_tasks: user?.can_delete_tasks || false,
    can_manage_users: user?.can_manage_users || false,
  });

  const handleModuleToggle = (module) => {
    setFormData((prev) => ({
      ...prev,
      module_access: prev.module_access.includes(module)
        ? prev.module_access.filter((m) => m !== module)
        : [...prev.module_access, module],
    }));
  };

  const handleSubmit = () => {
    if (!formData.name || !formData.email) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!user && !formData.password) {
      toast.error('Password is required for new users');
      return;
    }
    const submitData = { ...formData };
    if (!submitData.password) delete submitData.password;
    onSave(submitData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-lg`}>
        <DialogHeader>
          <DialogTitle className={textPrimary}>{user ? 'Edit User' : 'Add New User'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className={textPrimary}>Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Enter full name"
              data-testid="user-name-input"
              className={`${bgInput} border ${borderColor} ${textPrimary}`}
            />
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>Email *</Label>
            <Input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="Enter email address"
              data-testid="user-email-input"
              className={`${bgInput} border ${borderColor} ${textPrimary}`}
            />
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>{user ? 'New Password (leave blank to keep current)' : 'Password *'}</Label>
            <Input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              placeholder="Enter password"
              data-testid="user-password-input"
              className={`${bgInput} border ${borderColor} ${textPrimary}`}
            />
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>Role</Label>
            <Select value={formData.role} onValueChange={(v) => setFormData({ ...formData, role: v })}>
              <SelectTrigger className={`${bgInput} border ${borderColor} ${textPrimary}`} data-testid="user-role-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`${bgCard} border ${borderColor}`}>
                {roles.map((role) => (
                  <SelectItem key={role.value} value={role.value} className={`${textPrimary} focus:bg-[#27272a]`}>
                    {role.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>Module Access</Label>
            <div className="grid grid-cols-3 gap-2">
              {modules.map((mod) => (
                <div key={mod.value} className="flex items-center gap-2">
                  <Checkbox
                    checked={formData.module_access.includes(mod.value)}
                    onCheckedChange={() => handleModuleToggle(mod.value)}
                    id={`module-${mod.value}`}
                  />
                  <label htmlFor={`module-${mod.value}`} className={`text-sm ${textSecondary}`}>
                    {mod.label}
                  </label>
                </div>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            <Label className={textPrimary}>Permissions</Label>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>Can Create Projects</span>
                <Switch
                  checked={formData.can_create_projects}
                  onCheckedChange={(v) => setFormData({ ...formData, can_create_projects: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>Can Delete Tasks</span>
                <Switch
                  checked={formData.can_delete_tasks}
                  onCheckedChange={(v) => setFormData({ ...formData, can_delete_tasks: v })}
                />
              </div>
              <div className="flex items-center justify-between">
                <span className={`text-sm ${textSecondary}`}>Can Manage Users</span>
                <Switch
                  checked={formData.can_manage_users}
                  onCheckedChange={(v) => setFormData({ ...formData, can_manage_users: v })}
                />
              </div>
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={`border ${borderColor} ${textSecondary}`}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} data-testid="save-user-button" className="bg-[#6366f1] hover:bg-[#4f46e5]">
            {user ? 'Update User' : 'Create User'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// Service Form Modal Component
const ServiceFormModal = ({ service, onClose, onSave, isDark, bgCard, bgInput, textPrimary, textSecondary, borderColor }) => {
  const [formData, setFormData] = useState({
    name: service?.name || '',
    category: service?.category || '',
    billing_type: service?.billing_type || 'one-time',
    amount: service?.amount || 0,
  });

  const handleSubmit = () => {
    if (!formData.name || !formData.category) {
      toast.error('Please fill in all required fields');
      return;
    }
    onSave(formData);
  };

  return (
    <Dialog open={true} onOpenChange={onClose}>
      <DialogContent className={`${bgCard} border ${borderColor} ${textPrimary} max-w-md`}>
        <DialogHeader>
          <DialogTitle className={textPrimary}>{service ? 'Edit Service' : 'Add New Service'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label className={textPrimary}>Service Name *</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Website Development"
              data-testid="service-name-input"
              className={`${bgInput} border ${borderColor} ${textPrimary}`}
            />
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>Category *</Label>
            <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
              <SelectTrigger className={`${bgInput} border ${borderColor} ${textPrimary}`} data-testid="service-category-select">
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent className={`${bgCard} border ${borderColor}`}>
                <SelectItem value="Development" className={`${textPrimary} focus:bg-[#27272a]`}>Development</SelectItem>
                <SelectItem value="Marketing" className={`${textPrimary} focus:bg-[#27272a]`}>Marketing</SelectItem>
                <SelectItem value="Consulting" className={`${textPrimary} focus:bg-[#27272a]`}>Consulting</SelectItem>
                <SelectItem value="Design" className={`${textPrimary} focus:bg-[#27272a]`}>Design</SelectItem>
                <SelectItem value="Other" className={`${textPrimary} focus:bg-[#27272a]`}>Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>Billing Type</Label>
            <Select value={formData.billing_type} onValueChange={(v) => setFormData({ ...formData, billing_type: v })}>
              <SelectTrigger className={`${bgInput} border ${borderColor} ${textPrimary}`} data-testid="service-billing-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={`${bgCard} border ${borderColor}`}>
                <SelectItem value="one-time" className={`${textPrimary} focus:bg-[#27272a]`}>One-time</SelectItem>
                <SelectItem value="recurring" className={`${textPrimary} focus:bg-[#27272a]`}>Recurring (Monthly)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label className={textPrimary}>Base Amount (₹)</Label>
            <Input
              type="number"
              value={formData.amount}
              onChange={(e) => setFormData({ ...formData, amount: parseFloat(e.target.value) || 0 })}
              placeholder="Enter base price"
              data-testid="service-amount-input"
              className={`${bgInput} border ${borderColor} ${textPrimary}`}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} className={`border ${borderColor} ${textSecondary}`}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} data-testid="save-service-button" className="bg-[#6366f1] hover:bg-[#4f46e5]">
            {service ? 'Update Service' : 'Create Service'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsPage;
