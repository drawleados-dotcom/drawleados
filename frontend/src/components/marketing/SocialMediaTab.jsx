import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { 
  Plus, 
  Edit2, 
  Trash2,
  RefreshCw,
  Calendar,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  Hash,
  Image as ImageIcon,
  Video,
  FileText,
  Eye,
  Clock
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const platformIcons = {
  instagram: Instagram,
  linkedin: Linkedin,
  youtube: Youtube,
  twitter: Twitter
};

const platformColors = {
  instagram: '#E4405F',
  linkedin: '#0A66C2',
  youtube: '#FF0000',
  twitter: '#1DA1F2'
};

const contentTypeOptions = {
  instagram: ['post', 'reel'],
  linkedin: ['post', 'article'],
  youtube: ['video', 'short'],
  twitter: ['tweet', 'thread']
};

const statusColors = {
  idea: 'bg-[#52525b]/20 text-[#a1a1aa]',
  in_creation: 'bg-[#3b82f6]/20 text-[#3b82f6]',
  review: 'bg-[#f59e0b]/20 text-[#f59e0b]',
  scheduled: 'bg-[#8b5cf6]/20 text-[#8b5cf6]',
  published: 'bg-[#10b981]/20 text-[#10b981]'
};

const SocialMediaTab = ({ dashboard, onRefresh }) => {
  const [activePlatform, setActivePlatform] = useState('instagram');
  const [content, setContent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingContent, setEditingContent] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    platform: 'instagram',
    content_type: 'post',
    caption: '',
    hashtags: [],
    creative_url: '',
    status: 'idea',
    scheduled_date: '',
    scheduled_time: '10:00',
    audio: '',
    duration: '',
    cta: '',
    video_url: '',
    thumbnail_url: '',
    is_thread: false
  });

  const token = localStorage.getItem('session_token');

  const loadContent = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/marketing/content/${activePlatform}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setContent(res.data);
    } catch (error) {
      console.error('Error loading content:', error);
      toast.error('Failed to load content');
    } finally {
      setLoading(false);
    }
  }, [token, activePlatform]);

  useEffect(() => {
    loadContent();
  }, [loadContent]);

  const openCreateModal = (platform = activePlatform) => {
    setEditingContent(null);
    setFormData({
      title: '',
      platform,
      content_type: contentTypeOptions[platform][0],
      caption: '',
      hashtags: [],
      creative_url: '',
      status: 'idea',
      scheduled_date: '',
      scheduled_time: '10:00',
      audio: '',
      duration: '',
      cta: '',
      video_url: '',
      thumbnail_url: '',
      is_thread: false
    });
    setIsModalOpen(true);
  };

  const openEditModal = (item) => {
    setEditingContent(item);
    setFormData({
      title: item.title || '',
      platform: item.platform || 'instagram',
      content_type: item.content_type || 'post',
      caption: item.caption || '',
      hashtags: item.hashtags || [],
      creative_url: item.creative_url || '',
      status: item.status || 'idea',
      scheduled_date: item.scheduled_date || '',
      scheduled_time: item.scheduled_time || '10:00',
      audio: item.audio || '',
      duration: item.duration || '',
      cta: item.cta || '',
      video_url: item.video_url || '',
      thumbnail_url: item.thumbnail_url || '',
      is_thread: item.is_thread || false
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      const payload = {
        ...formData,
        hashtags: typeof formData.hashtags === 'string' 
          ? formData.hashtags.split(',').map(t => t.trim()).filter(Boolean)
          : formData.hashtags
      };

      if (editingContent) {
        await axios.put(`${API}/api/marketing/content/${editingContent.content_id}`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Content updated successfully');
      } else {
        await axios.post(`${API}/api/marketing/content`, payload, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Content created successfully');
      }
      setIsModalOpen(false);
      loadContent();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error saving content:', error);
      toast.error('Failed to save content');
    }
  };

  const handleDelete = async (contentId) => {
    if (!window.confirm('Are you sure you want to delete this content?')) return;
    
    try {
      await axios.delete(`${API}/api/marketing/content/${contentId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Content deleted successfully');
      loadContent();
      if (onRefresh) onRefresh();
    } catch (error) {
      console.error('Error deleting content:', error);
      toast.error('Failed to delete content');
    }
  };

  const getPlatformStats = (platform) => {
    const stats = dashboard?.platform_stats?.find(p => p.platform === platform);
    return stats || { total: 0, published: 0, scheduled: 0, in_progress: 0 };
  };

  const PlatformIcon = platformIcons[activePlatform];

  // Group content by status for Kanban view
  const groupedContent = {
    idea: content.filter(c => c.status === 'idea'),
    in_creation: content.filter(c => c.status === 'in_creation'),
    review: content.filter(c => c.status === 'review'),
    scheduled: content.filter(c => c.status === 'scheduled'),
    published: content.filter(c => c.status === 'published')
  };

  return (
    <div className="space-y-6" data-testid="social-media-tab">
      {/* Platform Tabs */}
      <Tabs value={activePlatform} onValueChange={setActivePlatform}>
        <div className="flex items-center justify-between">
          <TabsList className="bg-[#18181b] border border-[#27272a] p-1">
            {Object.entries(platformIcons).map(([platform, Icon]) => {
              const stats = getPlatformStats(platform);
              return (
                <TabsTrigger
                  key={platform}
                  value={platform}
                  className="data-[state=active]:bg-[#27272a] flex items-center gap-2 capitalize"
                >
                  <Icon className="h-4 w-4" style={{ color: platformColors[platform] }} />
                  {platform}
                  {stats.total > 0 && (
                    <Badge variant="secondary" className="ml-1 bg-[#27272a] text-[#a1a1aa]">
                      {stats.total}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>
          <Button
            onClick={() => openCreateModal()}
            data-testid="create-content-btn"
            className="bg-[#6366f1] hover:bg-[#5558dd]"
          >
            <Plus className="h-4 w-4 mr-2" />
            New Content
          </Button>
        </div>

        {/* Platform Content */}
        {Object.keys(platformIcons).map((platform) => (
          <TabsContent key={platform} value={platform} className="mt-6">
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
              </div>
            ) : content.length === 0 ? (
              <Card className="bg-[#18181b] border-[#27272a]">
                <CardContent className="p-12 text-center">
                  <PlatformIcon className="h-12 w-12 mx-auto mb-4" style={{ color: platformColors[platform] }} />
                  <p className="text-[#71717a] mb-4">No content for {platform} yet</p>
                  <Button
                    onClick={() => openCreateModal(platform)}
                    variant="outline"
                    className="border-[#27272a]"
                  >
                    Create your first post
                  </Button>
                </CardContent>
              </Card>
            ) : (
              /* Kanban Board */
              <div className="grid grid-cols-5 gap-4">
                {Object.entries(groupedContent).map(([status, items]) => (
                  <div key={status} className="bg-[#0c0a09] rounded-lg p-3">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-medium text-[#a1a1aa] capitalize">
                        {status.replace('_', ' ')}
                      </h3>
                      <Badge className={`${statusColors[status]} text-xs`}>
                        {items.length}
                      </Badge>
                    </div>
                    <div className="space-y-2 min-h-[200px]">
                      {items.map((item) => (
                        <Card 
                          key={item.content_id} 
                          className="bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] cursor-pointer transition-all"
                          onClick={() => openEditModal(item)}
                        >
                          <CardContent className="p-3">
                            <p className="text-sm font-medium text-[#fafafa] mb-2 line-clamp-2">
                              {item.title}
                            </p>
                            <div className="flex items-center gap-2 text-xs text-[#71717a]">
                              {item.content_type === 'reel' || item.content_type === 'video' || item.content_type === 'short' ? (
                                <Video className="h-3 w-3" />
                              ) : (
                                <FileText className="h-3 w-3" />
                              )}
                              <span className="capitalize">{item.content_type}</span>
                            </div>
                            {item.scheduled_date && (
                              <div className="flex items-center gap-1 mt-2 text-xs text-[#8b5cf6]">
                                <Calendar className="h-3 w-3" />
                                {item.scheduled_date}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#18181b] border-[#27272a] max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#fafafa] flex items-center gap-2">
              {React.createElement(platformIcons[formData.platform], {
                className: "h-5 w-5",
                style: { color: platformColors[formData.platform] }
              })}
              {editingContent ? 'Edit Content' : 'Create New Content'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Title *</label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Content title"
                className="bg-[#0c0a09] border-[#27272a]"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Platform</label>
                <Select 
                  value={formData.platform} 
                  onValueChange={(v) => setFormData(prev => ({ 
                    ...prev, 
                    platform: v,
                    content_type: contentTypeOptions[v][0]
                  }))}
                >
                  <SelectTrigger className="bg-[#0c0a09] border-[#27272a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a]">
                    <SelectItem value="instagram">Instagram</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                    <SelectItem value="youtube">YouTube</SelectItem>
                    <SelectItem value="twitter">Twitter/X</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Content Type</label>
                <Select 
                  value={formData.content_type} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, content_type: v }))}
                >
                  <SelectTrigger className="bg-[#0c0a09] border-[#27272a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a]">
                    {contentTypeOptions[formData.platform].map(type => (
                      <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Status</label>
                <Select 
                  value={formData.status} 
                  onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}
                >
                  <SelectTrigger className="bg-[#0c0a09] border-[#27272a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a]">
                    <SelectItem value="idea">Idea</SelectItem>
                    <SelectItem value="in_creation">In Creation</SelectItem>
                    <SelectItem value="review">Review</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Scheduled Date</label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="bg-[#0c0a09] border-[#27272a]"
                />
              </div>
            </div>

            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Caption</label>
              <Textarea
                value={formData.caption}
                onChange={(e) => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                placeholder="Write your caption..."
                className="bg-[#0c0a09] border-[#27272a] min-h-[100px]"
              />
            </div>

            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Hashtags (comma separated)</label>
              <Input
                value={Array.isArray(formData.hashtags) ? formData.hashtags.join(', ') : formData.hashtags}
                onChange={(e) => setFormData(prev => ({ ...prev, hashtags: e.target.value }))}
                placeholder="#marketing, #agency, #tips"
                className="bg-[#0c0a09] border-[#27272a]"
              />
            </div>

            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Creative/Media URL</label>
              <Input
                value={formData.creative_url}
                onChange={(e) => setFormData(prev => ({ ...prev, creative_url: e.target.value }))}
                placeholder="Link to image or video"
                className="bg-[#0c0a09] border-[#27272a]"
              />
            </div>

            {/* Platform-specific fields */}
            {formData.platform === 'instagram' && formData.content_type === 'reel' && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Audio</label>
                  <Input
                    value={formData.audio}
                    onChange={(e) => setFormData(prev => ({ ...prev, audio: e.target.value }))}
                    placeholder="Trending audio name"
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Duration</label>
                  <Input
                    value={formData.duration}
                    onChange={(e) => setFormData(prev => ({ ...prev, duration: e.target.value }))}
                    placeholder="e.g., 30s, 1m"
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
              </div>
            )}

            {formData.platform === 'linkedin' && (
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Call to Action</label>
                <Input
                  value={formData.cta}
                  onChange={(e) => setFormData(prev => ({ ...prev, cta: e.target.value }))}
                  placeholder="e.g., Learn more, Sign up"
                  className="bg-[#0c0a09] border-[#27272a]"
                />
              </div>
            )}

            {formData.platform === 'youtube' && (
              <>
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Video URL</label>
                  <Input
                    value={formData.video_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, video_url: e.target.value }))}
                    placeholder="Link to video file"
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Thumbnail URL</label>
                  <Input
                    value={formData.thumbnail_url}
                    onChange={(e) => setFormData(prev => ({ ...prev, thumbnail_url: e.target.value }))}
                    placeholder="Link to thumbnail image"
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
              </>
            )}

            {formData.platform === 'twitter' && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_thread"
                  checked={formData.is_thread}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_thread: e.target.checked }))}
                  className="rounded border-[#27272a]"
                />
                <label htmlFor="is_thread" className="text-sm text-[#a1a1aa]">This is a thread</label>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            {editingContent && (
              <Button
                variant="destructive"
                onClick={() => {
                  handleDelete(editingContent.content_id);
                  setIsModalOpen(false);
                }}
                className="mr-auto"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              className="border-[#27272a]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              className="bg-[#6366f1] hover:bg-[#5558dd]"
            >
              {editingContent ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SocialMediaTab;
