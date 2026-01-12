import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Plus, 
  Edit2, 
  Trash2, 
  Eye,
  RefreshCw,
  Calendar,
  Tag,
  Search,
  FileText,
  ExternalLink
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const BlogTab = () => {
  const [blogs, setBlogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBlog, setEditingBlog] = useState(null);
  const [formData, setFormData] = useState({
    title: '',
    slug: '',
    content: '',
    featured_image: '',
    category: '',
    tags: [],
    seo_title: '',
    seo_description: '',
    status: 'draft',
    scheduled_date: ''
  });

  const token = localStorage.getItem('session_token');

  const loadBlogs = useCallback(async () => {
    setLoading(true);
    try {
      const url = filterStatus === 'all' 
        ? `${API}/api/marketing/blog`
        : `${API}/api/marketing/blog?status=${filterStatus}`;
      const res = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setBlogs(res.data);
    } catch (error) {
      console.error('Error loading blogs:', error);
      toast.error('Failed to load blogs');
    } finally {
      setLoading(false);
    }
  }, [token, filterStatus]);

  useEffect(() => {
    loadBlogs();
  }, [loadBlogs]);

  const generateSlug = (title) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  const handleTitleChange = (e) => {
    const title = e.target.value;
    setFormData(prev => ({
      ...prev,
      title,
      slug: generateSlug(title),
      seo_title: title
    }));
  };

  const openCreateModal = () => {
    setEditingBlog(null);
    setFormData({
      title: '',
      slug: '',
      content: '',
      featured_image: '',
      category: '',
      tags: [],
      seo_title: '',
      seo_description: '',
      status: 'draft',
      scheduled_date: ''
    });
    setIsModalOpen(true);
  };

  const openEditModal = (blog) => {
    setEditingBlog(blog);
    setFormData({
      title: blog.title || '',
      slug: blog.slug || '',
      content: blog.content || '',
      featured_image: blog.featured_image || '',
      category: blog.category || '',
      tags: blog.tags || [],
      seo_title: blog.seo_title || '',
      seo_description: blog.seo_description || '',
      status: blog.status || 'draft',
      scheduled_date: blog.scheduled_date || ''
    });
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.title.trim()) {
      toast.error('Title is required');
      return;
    }

    try {
      if (editingBlog) {
        await axios.put(`${API}/api/marketing/blog/${editingBlog.blog_id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Blog updated successfully');
      } else {
        await axios.post(`${API}/api/marketing/blog`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
        toast.success('Blog created successfully');
      }
      setIsModalOpen(false);
      loadBlogs();
    } catch (error) {
      console.error('Error saving blog:', error);
      toast.error('Failed to save blog');
    }
  };

  const handleDelete = async (blogId) => {
    if (!window.confirm('Are you sure you want to delete this blog post?')) return;
    
    try {
      await axios.delete(`${API}/api/marketing/blog/${blogId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      toast.success('Blog deleted successfully');
      loadBlogs();
    } catch (error) {
      console.error('Error deleting blog:', error);
      toast.error('Failed to delete blog');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'published': return 'bg-[#10b981]/20 text-[#10b981]';
      case 'scheduled': return 'bg-[#f59e0b]/20 text-[#f59e0b]';
      case 'draft': return 'bg-[#71717a]/20 text-[#71717a]';
      default: return 'bg-[#27272a] text-[#a1a1aa]';
    }
  };

  const filteredBlogs = blogs.filter(blog => 
    blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    blog.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="blog-tab">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#52525b]" />
            <Input
              placeholder="Search blogs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-[#18181b] border-[#27272a] w-64"
            />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-36 bg-[#18181b] border-[#27272a]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="draft">Drafts</SelectItem>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="published">Published</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button
          onClick={openCreateModal}
          data-testid="create-blog-btn"
          className="bg-[#6366f1] hover:bg-[#5558dd]"
        >
          <Plus className="h-4 w-4 mr-2" />
          New Blog Post
        </Button>
      </div>

      {/* Blog Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
              <FileText className="h-5 w-5 text-[#10b981]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">
                {blogs.filter(b => b.status === 'published').length}
              </p>
              <p className="text-sm text-[#71717a]">Published</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">
                {blogs.filter(b => b.status === 'scheduled').length}
              </p>
              <p className="text-sm text-[#71717a]">Scheduled</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#71717a]/20 flex items-center justify-center">
              <Edit2 className="h-5 w-5 text-[#71717a]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">
                {blogs.filter(b => b.status === 'draft').length}
              </p>
              <p className="text-sm text-[#71717a]">Drafts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Blog List */}
      {filteredBlogs.length === 0 ? (
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-[#52525b] mx-auto mb-4" />
            <p className="text-[#71717a]">No blog posts found</p>
            <Button
              onClick={openCreateModal}
              variant="outline"
              className="mt-4 border-[#27272a]"
            >
              Create your first post
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredBlogs.map((blog) => (
            <Card key={blog.blog_id} className="bg-[#18181b] border-[#27272a] hover:border-[#3f3f46] transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-medium text-[#fafafa] truncate">
                        {blog.title}
                      </h3>
                      <Badge className={getStatusColor(blog.status)}>
                        {blog.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-[#71717a]">
                      {blog.category && (
                        <span className="flex items-center gap-1">
                          <Tag className="h-3 w-3" />
                          {blog.category}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {new Date(blog.created_at).toLocaleDateString()}
                      </span>
                      {blog.scheduled_date && blog.status === 'scheduled' && (
                        <span className="text-[#f59e0b]">
                          Scheduled: {blog.scheduled_date}
                        </span>
                      )}
                    </div>
                    {blog.seo_description && (
                      <p className="text-sm text-[#52525b] mt-2 line-clamp-2">
                        {blog.seo_description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => openEditModal(blog)}
                      className="text-[#71717a] hover:text-[#fafafa]"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDelete(blog.blog_id)}
                      className="text-[#71717a] hover:text-[#ef4444]"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-[#18181b] border-[#27272a] max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#fafafa]">
              {editingBlog ? 'Edit Blog Post' : 'Create New Blog Post'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Title *</label>
              <Input
                value={formData.title}
                onChange={handleTitleChange}
                placeholder="Enter blog title"
                className="bg-[#0c0a09] border-[#27272a]"
              />
            </div>
            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Slug</label>
              <Input
                value={formData.slug}
                onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                placeholder="blog-post-slug"
                className="bg-[#0c0a09] border-[#27272a]"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Category</label>
                <Input
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  placeholder="e.g., Marketing, SEO"
                  className="bg-[#0c0a09] border-[#27272a]"
                />
              </div>
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Status</label>
                <Select value={formData.status} onValueChange={(v) => setFormData(prev => ({ ...prev, status: v }))}>
                  <SelectTrigger className="bg-[#0c0a09] border-[#27272a]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-[#18181b] border-[#27272a]">
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="scheduled">Scheduled</SelectItem>
                    <SelectItem value="published">Published</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            {formData.status === 'scheduled' && (
              <div>
                <label className="text-sm text-[#a1a1aa] mb-1 block">Scheduled Date</label>
                <Input
                  type="date"
                  value={formData.scheduled_date}
                  onChange={(e) => setFormData(prev => ({ ...prev, scheduled_date: e.target.value }))}
                  className="bg-[#0c0a09] border-[#27272a]"
                />
              </div>
            )}
            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Featured Image URL</label>
              <Input
                value={formData.featured_image}
                onChange={(e) => setFormData(prev => ({ ...prev, featured_image: e.target.value }))}
                placeholder="https://example.com/image.jpg"
                className="bg-[#0c0a09] border-[#27272a]"
              />
            </div>
            <div>
              <label className="text-sm text-[#a1a1aa] mb-1 block">Content</label>
              <Textarea
                value={formData.content}
                onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                placeholder="Write your blog content (HTML supported)..."
                className="bg-[#0c0a09] border-[#27272a] min-h-[200px]"
              />
            </div>
            <div className="border-t border-[#27272a] pt-4">
              <h4 className="text-sm font-medium text-[#fafafa] mb-3">SEO Settings</h4>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">SEO Title</label>
                  <Input
                    value={formData.seo_title}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_title: e.target.value }))}
                    placeholder="SEO optimized title"
                    className="bg-[#0c0a09] border-[#27272a]"
                  />
                </div>
                <div>
                  <label className="text-sm text-[#a1a1aa] mb-1 block">Meta Description</label>
                  <Textarea
                    value={formData.seo_description}
                    onChange={(e) => setFormData(prev => ({ ...prev, seo_description: e.target.value }))}
                    placeholder="Brief description for search engines..."
                    className="bg-[#0c0a09] border-[#27272a] min-h-[80px]"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
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
              {editingBlog ? 'Update' : 'Create'} Post
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BlogTab;
