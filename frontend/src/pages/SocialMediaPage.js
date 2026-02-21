import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import Layout from '../components/Layout';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useTheme } from '../contexts/ThemeContext';
import {
  Plus, Calendar, Clock, User, ExternalLink, Image, Video, FileText,
  Instagram, Facebook, Linkedin, Twitter, Youtube, Send, Eye, Edit2, Trash2,
  CheckCircle, Circle, AlertCircle, Filter, Search, ChevronLeft, ChevronRight,
  LayoutGrid, List, Download
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

// Platform configurations
const PLATFORMS = {
  instagram: { name: 'Instagram', icon: Instagram, color: '#E4405F', bg: '#E4405F20' },
  facebook: { name: 'Facebook', icon: Facebook, color: '#1877F2', bg: '#1877F220' },
  linkedin: { name: 'LinkedIn', icon: Linkedin, color: '#0A66C2', bg: '#0A66C220' },
  twitter: { name: 'Twitter/X', icon: Twitter, color: '#1DA1F2', bg: '#1DA1F220' },
  youtube: { name: 'YouTube', icon: Youtube, color: '#FF0000', bg: '#FF000020' },
};

const CONTENT_STATUS = {
  'Draft': { color: 'bg-gray-500/20 text-gray-400', icon: Circle },
  'In Review': { color: 'bg-yellow-500/20 text-yellow-400', icon: AlertCircle },
  'Approved': { color: 'bg-green-500/20 text-green-400', icon: CheckCircle },
  'Scheduled': { color: 'bg-blue-500/20 text-blue-400', icon: Clock },
  'Posted': { color: 'bg-purple-500/20 text-purple-400', icon: Send },
};

const CONTENT_TYPES = ['Image', 'Video', 'Carousel', 'Reel', 'Story', 'Text'];

const SocialMediaPage = () => {
  const { isDark } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };

  // State
  const [activePlatform, setActivePlatform] = useState('instagram');
  const [viewMode, setViewMode] = useState('calendar'); // calendar, list
  const [posts, setPosts] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [showAddPost, setShowAddPost] = useState(false);
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [selectedPost, setSelectedPost] = useState(null);

  // Form state
  const [postForm, setPostForm] = useState({
    platform: 'instagram',
    content_type: 'Image',
    caption: '',
    hashtags: '',
    design_url: '',
    scheduled_date: new Date().toISOString().split('T')[0],
    scheduled_time: '10:00',
    status: 'Draft',
    assigned_to: '',
    project_id: '',
  });

  // Load data
  const loadPosts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/social-media/posts`, {
        headers,
        params: { platform: activePlatform }
      });
      setPosts(res.data || []);
    } catch (error) {
      console.error('Error loading posts:', error);
      // Initialize with empty array if API doesn't exist yet
      setPosts([]);
    }
  }, [activePlatform, token]);

  const loadProjects = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/social-media/projects`, { headers });
      setProjects(res.data || []);
    } catch (error) {
      setProjects([]);
    }
  }, [token]);

  const loadTeamMembers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/users`, { headers });
      setTeamMembers(res.data || []);
    } catch (error) {
      setTeamMembers([]);
    }
  }, [token]);

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([loadPosts(), loadProjects(), loadTeamMembers()]);
      setLoading(false);
    };
    loadAll();
  }, [loadPosts, loadProjects, loadTeamMembers]);

  useEffect(() => {
    loadPosts();
  }, [activePlatform, loadPosts]);

  // Handlers
  const handleAddPost = async () => {
    try {
      await axios.post(`${API}/api/social-media/posts`, postForm, { headers });
      toast.success('Post created');
      setShowAddPost(false);
      setPostForm({
        platform: activePlatform,
        content_type: 'Image',
        caption: '',
        hashtags: '',
        design_url: '',
        scheduled_date: new Date().toISOString().split('T')[0],
        scheduled_time: '10:00',
        status: 'Draft',
        assigned_to: '',
        project_id: '',
      });
      loadPosts();
    } catch (error) {
      toast.error('Failed to create post');
    }
  };

  const handleUpdateStatus = async (postId, newStatus) => {
    try {
      await axios.put(`${API}/api/social-media/posts/${postId}`, { status: newStatus }, { headers });
      toast.success('Status updated');
      loadPosts();
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const handleDeletePost = async (postId) => {
    if (!window.confirm('Delete this post?')) return;
    try {
      await axios.delete(`${API}/api/social-media/posts/${postId}`, { headers });
      toast.success('Post deleted');
      loadPosts();
    } catch (error) {
      toast.error('Failed to delete post');
    }
  };

  // Calendar helpers
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const days = [];
    
    // Add empty days for padding
    for (let i = 0; i < firstDay.getDay(); i++) {
      days.push(null);
    }
    
    // Add actual days
    for (let i = 1; i <= lastDay.getDate(); i++) {
      days.push(new Date(year, month, i));
    }
    
    return days;
  };

  const getPostsForDate = (date) => {
    if (!date) return [];
    const dateStr = date.toISOString().split('T')[0];
    return posts.filter(p => p.scheduled_date === dateStr);
  };

  const formatDate = (date) => {
    return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' }).format(date);
  };

  // Filter posts
  const filteredPosts = posts.filter(post => {
    if (searchTerm && !post.caption?.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (statusFilter !== 'all' && post.status !== statusFilter) return false;
    return true;
  });

  // Theme classes
  const cardClass = isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white border-gray-200';
  const textClass = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const mutedClass = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-[#E4405F] to-[#6366f1] bg-clip-text text-transparent">
              Social Media
            </h1>
            <p className={mutedClass}>Content calendar and post management</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-lg overflow-hidden border border-[#27272a]">
              <button
                onClick={() => setViewMode('calendar')}
                className={`px-3 py-2 ${viewMode === 'calendar' ? 'bg-[#6366f1] text-white' : isDark ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-gray-100 text-gray-600'}`}
              >
                <Calendar className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-2 ${viewMode === 'list' ? 'bg-[#6366f1] text-white' : isDark ? 'bg-[#27272a] text-[#a1a1aa]' : 'bg-gray-100 text-gray-600'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
            <Button onClick={() => { setPostForm({ ...postForm, platform: activePlatform }); setShowAddPost(true); }} className="bg-[#6366f1] hover:bg-[#5855eb]">
              <Plus className="h-4 w-4 mr-2" /> Create Post
            </Button>
          </div>
        </div>

        {/* Platform Tabs */}
        <div className={`p-1 rounded-xl ${isDark ? 'bg-[#18181b]' : 'bg-gray-100'}`}>
          <div className="flex gap-1">
            {Object.entries(PLATFORMS).map(([key, platform]) => {
              const Icon = platform.icon;
              const isActive = activePlatform === key;
              const postCount = posts.filter(p => p.platform === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setActivePlatform(key)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                    isActive
                      ? 'text-white'
                      : isDark ? 'text-[#a1a1aa] hover:text-white hover:bg-[#27272a]' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-200'
                  }`}
                  style={isActive ? { backgroundColor: platform.color } : {}}
                >
                  <Icon className="h-4 w-4" />
                  <span className="font-medium">{platform.name}</span>
                  <Badge className={`text-xs ${isActive ? 'bg-white/20 text-white' : 'bg-[#27272a] text-[#a1a1aa]'}`}>
                    {postCount}
                  </Badge>
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className={`p-4 rounded-xl border ${cardClass}`}>
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className={`absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 ${mutedClass}`} />
              <Input
                placeholder="Search posts..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className={`pl-10 ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className={`w-40 ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}>
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.keys(CONTENT_STATUS).map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <div className={`rounded-xl border ${cardClass}`}>
            {/* Calendar Header */}
            <div className="p-4 border-b border-[#27272a] flex items-center justify-between">
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() - 1)))} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#27272a]' : 'hover:bg-gray-100'}`}>
                <ChevronLeft className="h-5 w-5" />
              </button>
              <h3 className={`text-lg font-semibold ${textClass}`}>{formatDate(currentMonth)}</h3>
              <button onClick={() => setCurrentMonth(new Date(currentMonth.setMonth(currentMonth.getMonth() + 1)))} className={`p-2 rounded-lg ${isDark ? 'hover:bg-[#27272a]' : 'hover:bg-gray-100'}`}>
                <ChevronRight className="h-5 w-5" />
              </button>
            </div>

            {/* Calendar Grid */}
            <div className="p-4">
              {/* Days Header */}
              <div className="grid grid-cols-7 gap-2 mb-2">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className={`text-center text-sm font-medium py-2 ${mutedClass}`}>{day}</div>
                ))}
              </div>

              {/* Days Grid */}
              <div className="grid grid-cols-7 gap-2">
                {getDaysInMonth(currentMonth).map((date, idx) => {
                  const dayPosts = date ? getPostsForDate(date) : [];
                  const isToday = date && date.toDateString() === new Date().toDateString();
                  return (
                    <div
                      key={idx}
                      onClick={() => date && setSelectedDate(date)}
                      className={`min-h-[100px] p-2 rounded-lg border cursor-pointer transition-all ${
                        !date ? 'border-transparent' :
                        isToday ? 'border-[#6366f1] bg-[#6366f1]/10' :
                        isDark ? 'border-[#27272a] hover:border-[#3f3f46]' : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {date && (
                        <>
                          <div className={`text-sm font-medium mb-1 ${isToday ? 'text-[#6366f1]' : textClass}`}>
                            {date.getDate()}
                          </div>
                          <div className="space-y-1">
                            {dayPosts.slice(0, 2).map(post => (
                              <div
                                key={post.post_id}
                                className={`text-xs p-1 rounded truncate ${CONTENT_STATUS[post.status]?.color || 'bg-gray-500/20 text-gray-400'}`}
                              >
                                {post.content_type}: {post.caption?.slice(0, 15)}...
                              </div>
                            ))}
                            {dayPosts.length > 2 && (
                              <div className={`text-xs ${mutedClass}`}>+{dayPosts.length - 2} more</div>
                            )}
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* List View */}
        {viewMode === 'list' && (
          <div className={`rounded-xl border overflow-hidden ${cardClass}`}>
            <table className="w-full">
              <thead className={isDark ? 'bg-[#27272a]' : 'bg-gray-50'}>
                <tr>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Content</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Design/View</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Status</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Due Date</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Post Status</th>
                  <th className={`p-3 text-left text-sm font-medium ${mutedClass}`}>Assignee</th>
                  <th className={`p-3 text-center text-sm font-medium ${mutedClass}`}>Actions</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${isDark ? 'divide-[#27272a]' : 'divide-gray-100'}`}>
                {filteredPosts.map(post => {
                  const StatusIcon = CONTENT_STATUS[post.status]?.icon || Circle;
                  return (
                    <tr key={post.post_id} className={isDark ? 'hover:bg-[#1f1f23]' : 'hover:bg-gray-50'}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          <Badge style={{ backgroundColor: PLATFORMS[post.platform]?.bg, color: PLATFORMS[post.platform]?.color }}>
                            {post.content_type}
                          </Badge>
                          <div>
                            <p className={`font-medium ${textClass}`}>{post.caption?.slice(0, 50)}...</p>
                            <p className={`text-xs ${mutedClass}`}>{post.hashtags?.slice(0, 30)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-3">
                        {post.design_url ? (
                          <a href={post.design_url} target="_blank" rel="noopener noreferrer" className="text-[#6366f1] hover:underline flex items-center gap-1">
                            <ExternalLink className="h-3 w-3" /> View
                          </a>
                        ) : (
                          <span className={mutedClass}>-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <Select value={post.status} onValueChange={v => handleUpdateStatus(post.post_id, v)}>
                          <SelectTrigger className={`w-32 h-8 text-xs ${CONTENT_STATUS[post.status]?.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.keys(CONTENT_STATUS).map(s => (
                              <SelectItem key={s} value={s}>{s}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <div className={`text-sm ${textClass}`}>{post.scheduled_date}</div>
                        <div className={`text-xs ${mutedClass}`}>{post.scheduled_time}</div>
                      </td>
                      <td className="p-3">
                        <Badge className={CONTENT_STATUS[post.status]?.color}>
                          <StatusIcon className="h-3 w-3 mr-1" />
                          {post.status}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-xs text-white">
                            {post.assigned_to?.[0]?.toUpperCase() || 'U'}
                          </div>
                          <span className={`text-sm ${textClass}`}>{post.assigned_to || 'Unassigned'}</span>
                        </div>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-center gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setSelectedPost(post); setShowPostDetail(true); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => handleDeletePost(post.post_id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {filteredPosts.length === 0 && (
                  <tr>
                    <td colSpan={7} className={`p-8 text-center ${mutedClass}`}>
                      No posts found. Create your first post!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Add Post Modal */}
        <Dialog open={showAddPost} onOpenChange={setShowAddPost}>
          <DialogContent className={`max-w-xl ${isDark ? 'bg-[#18181b] border-[#27272a]' : 'bg-white'}`}>
            <DialogHeader>
              <DialogTitle className={textClass}>Create New Post</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${mutedClass}`}>Platform</label>
                  <Select value={postForm.platform} onValueChange={v => setPostForm({ ...postForm, platform: v })}>
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(PLATFORMS).map(([key, p]) => (
                        <SelectItem key={key} value={key}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-sm font-medium ${mutedClass}`}>Content Type</label>
                  <Select value={postForm.content_type} onValueChange={v => setPostForm({ ...postForm, content_type: v })}>
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CONTENT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className={`text-sm font-medium ${mutedClass}`}>Caption</label>
                <Textarea
                  placeholder="Write your caption..."
                  value={postForm.caption}
                  onChange={e => setPostForm({ ...postForm, caption: e.target.value })}
                  className={`min-h-[100px] ${isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}`}
                />
              </div>

              <div>
                <label className={`text-sm font-medium ${mutedClass}`}>Hashtags</label>
                <Input
                  placeholder="#marketing #social #business"
                  value={postForm.hashtags}
                  onChange={e => setPostForm({ ...postForm, hashtags: e.target.value })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>

              <div>
                <label className={`text-sm font-medium ${mutedClass}`}>Design URL</label>
                <Input
                  placeholder="https://..."
                  value={postForm.design_url}
                  onChange={e => setPostForm({ ...postForm, design_url: e.target.value })}
                  className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${mutedClass}`}>Scheduled Date</label>
                  <Input
                    type="date"
                    value={postForm.scheduled_date}
                    onChange={e => setPostForm({ ...postForm, scheduled_date: e.target.value })}
                    className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                  />
                </div>
                <div>
                  <label className={`text-sm font-medium ${mutedClass}`}>Scheduled Time</label>
                  <Input
                    type="time"
                    value={postForm.scheduled_time}
                    onChange={e => setPostForm({ ...postForm, scheduled_time: e.target.value })}
                    className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={`text-sm font-medium ${mutedClass}`}>Status</label>
                  <Select value={postForm.status} onValueChange={v => setPostForm({ ...postForm, status: v })}>
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.keys(CONTENT_STATUS).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className={`text-sm font-medium ${mutedClass}`}>Assign To</label>
                  <Select value={postForm.assigned_to} onValueChange={v => setPostForm({ ...postForm, assigned_to: v })}>
                    <SelectTrigger className={isDark ? 'bg-[#27272a] border-[#3f3f46]' : ''}><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>
                      {teamMembers.map(m => <SelectItem key={m.user_id} value={m.name}>{m.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowAddPost(false)}>Cancel</Button>
              <Button onClick={handleAddPost} className="bg-[#6366f1] hover:bg-[#5855eb]">Create Post</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
};

export default SocialMediaPage;
