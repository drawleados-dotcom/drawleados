import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { 
  Mail, 
  Inbox,
  Star,
  Paperclip,
  RefreshCw,
  Clock,
  User,
  Eye,
  AlertCircle
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const EmailTab = () => {
  const [emails, setEmails] = useState([]);
  const [isDemo, setIsDemo] = useState(true);
  const [folder, setFolder] = useState('inbox');
  const [loading, setLoading] = useState(true);
  const [selectedEmail, setSelectedEmail] = useState(null);

  const token = localStorage.getItem('session_token');

  const loadEmails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/api/marketing/emails?folder=${folder}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmails(res.data.emails || []);
      setIsDemo(res.data.is_demo);
    } catch (error) {
      console.error('Error loading emails:', error);
      toast.error('Failed to load emails');
    } finally {
      setLoading(false);
    }
  }, [token, folder]);

  useEffect(() => {
    loadEmails();
  }, [loadEmails]);

  const formatDate = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 1) return 'Just now';
    if (hours < 24) return `${hours}h ago`;
    if (hours < 48) return 'Yesterday';
    return date.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-[#6366f1]" />
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="email-tab">
      {/* Demo Mode Banner */}
      {isDemo && (
        <div className="bg-[#1c1917] border border-[#422006] rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-[#f59e0b]" />
          <div className="flex-1">
            <p className="text-sm text-[#fafafa]">
              <strong>Demo Mode:</strong> Connect your Gmail account to see real emails. 
              This is read-only visibility for marketing-related emails.
            </p>
          </div>
          <Badge className="bg-[#422006] text-[#f59e0b] hover:bg-[#422006]">
            Demo Data
          </Badge>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Select value={folder} onValueChange={setFolder}>
            <SelectTrigger className="w-36 bg-[#18181b] border-[#27272a]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#18181b] border-[#27272a]">
              <SelectItem value="inbox">Inbox</SelectItem>
              <SelectItem value="starred">Starred</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-[#71717a]">
            {emails.length} emails
          </span>
        </div>
        <Button
          onClick={loadEmails}
          variant="outline"
          size="sm"
          className="border-[#27272a]"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Email Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#6366f1]/20 flex items-center justify-center">
              <Inbox className="h-5 w-5 text-[#6366f1]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">{emails.length}</p>
              <p className="text-sm text-[#71717a]">Total Emails</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#3b82f6]/20 flex items-center justify-center">
              <Eye className="h-5 w-5 text-[#3b82f6]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">
                {emails.filter(e => !e.is_read).length}
              </p>
              <p className="text-sm text-[#71717a]">Unread</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#f59e0b]/20 flex items-center justify-center">
              <Star className="h-5 w-5 text-[#f59e0b]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">0</p>
              <p className="text-sm text-[#71717a]">Starred</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-[#18181b] border-[#27272a]">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-[#10b981]/20 flex items-center justify-center">
              <Paperclip className="h-5 w-5 text-[#10b981]" />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#fafafa]">
                {emails.filter(e => e.has_attachment).length}
              </p>
              <p className="text-sm text-[#71717a]">With Attachments</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* List */}
        <div className="lg:col-span-2 space-y-2">
          {emails.length === 0 ? (
            <Card className="bg-[#18181b] border-[#27272a]">
              <CardContent className="p-12 text-center">
                <Mail className="h-12 w-12 text-[#52525b] mx-auto mb-4" />
                <p className="text-[#71717a]">No emails in {folder}</p>
              </CardContent>
            </Card>
          ) : (
            emails.map((email) => (
              <Card 
                key={email.email_id} 
                className={`bg-[#18181b] border-[#27272a] cursor-pointer transition-all hover:border-[#3f3f46] ${
                  selectedEmail?.email_id === email.email_id ? 'border-[#6366f1]' : ''
                } ${!email.is_read ? 'border-l-2 border-l-[#6366f1]' : ''}`}
                onClick={() => setSelectedEmail(email)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 rounded-full bg-[#27272a] flex items-center justify-center flex-shrink-0">
                      <span className="text-sm font-medium text-[#fafafa]">
                        {email.from_name?.charAt(0).toUpperCase() || 'U'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <p className={`text-sm truncate ${!email.is_read ? 'font-semibold text-[#fafafa]' : 'text-[#a1a1aa]'}`}>
                          {email.from_name}
                        </p>
                        <span className="text-xs text-[#52525b] flex-shrink-0 ml-2">
                          {formatDate(email.date)}
                        </span>
                      </div>
                      <p className={`text-sm truncate ${!email.is_read ? 'font-medium text-[#fafafa]' : 'text-[#a1a1aa]'}`}>
                        {email.subject}
                      </p>
                      <p className="text-xs text-[#52525b] truncate mt-1">
                        {email.snippet}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {email.has_attachment && (
                        <Paperclip className="h-4 w-4 text-[#52525b]" />
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Preview */}
        <div className="lg:col-span-1">
          <Card className="bg-[#18181b] border-[#27272a] sticky top-4">
            <CardHeader className="border-b border-[#27272a]">
              <CardTitle className="text-[#fafafa] text-lg">Email Preview</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {selectedEmail ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-lg font-medium text-[#fafafa] mb-2">
                      {selectedEmail.subject}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-[#71717a]">
                      <User className="h-4 w-4" />
                      <span>{selectedEmail.from_name}</span>
                      <span className="text-[#52525b]">
                        &lt;{selectedEmail.from_email}&gt;
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-[#52525b] mt-1">
                      <Clock className="h-4 w-4" />
                      <span>{new Date(selectedEmail.date).toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="border-t border-[#27272a] pt-4">
                    <p className="text-sm text-[#a1a1aa] leading-relaxed">
                      {selectedEmail.snippet}...
                    </p>
                    <p className="text-xs text-[#52525b] mt-4 italic">
                      Full email preview available when Gmail is connected.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <Mail className="h-12 w-12 text-[#52525b] mx-auto mb-3" />
                  <p className="text-sm text-[#71717a]">
                    Select an email to preview
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default EmailTab;
