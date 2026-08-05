import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { 
  MessageSquare, X, Send, Hash, Users, ChevronRight, ChevronDown,
  MoreHorizontal, Smile, Paperclip, Circle, Edit2, Trash2
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

export default function ChatPanel({ isOpen, onClose }) {
  const [channels, setChannels] = useState([]);
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showChannelList, setShowChannelList] = useState(true);
  const messagesEndRef = useRef(null);
  const pollIntervalRef = useRef(null);
  
  const token = localStorage.getItem('session_token');
  const headers = { Authorization: `Bearer ${token}` };
  const currentUser = JSON.parse(localStorage.getItem('user') || '{}');

  // Load channels
  const loadChannels = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/chat/channels`, { headers });
      setChannels(res.data);
    } catch (error) {
      console.error('Error loading channels:', error);
    }
  }, [token]);

  // Load messages for selected channel
  const loadMessages = useCallback(async () => {
    if (!selectedChannel) return;
    try {
      const res = await axios.get(
        `${API}/api/chat/channels/${selectedChannel.channel_id}/messages`,
        { headers }
      );
      setMessages(res.data);
    } catch (error) {
      console.error('Error loading messages:', error);
    }
  }, [selectedChannel, token]);

  // Load online users
  const loadOnlineUsers = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/chat/online-users`, { headers });
      setOnlineUsers(res.data);
    } catch (error) {
      console.error('Error loading online users:', error);
    }
  }, [token]);

  // Send heartbeat
  const sendHeartbeat = useCallback(async () => {
    try {
      await axios.post(`${API}/api/chat/online`, {}, { headers });
    } catch (error) {
      console.error('Heartbeat error:', error);
    }
  }, [token]);

  // Initial load
  useEffect(() => {
    if (isOpen) {
      loadChannels();
      loadOnlineUsers();
      sendHeartbeat();
    }
  }, [isOpen, loadChannels, loadOnlineUsers, sendHeartbeat]);

  // Poll for new messages
  useEffect(() => {
    if (isOpen && selectedChannel) {
      loadMessages();
      
      // Poll every 3 seconds
      pollIntervalRef.current = setInterval(() => {
        loadMessages();
        loadChannels(); // Also refresh unread counts
        sendHeartbeat();
      }, 3000);
      
      return () => {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current);
        }
      };
    }
  }, [isOpen, selectedChannel, loadMessages, loadChannels, sendHeartbeat]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChannel) return;
    
    try {
      await axios.post(
        `${API}/api/chat/channels/${selectedChannel.channel_id}/messages`,
        { content: newMessage },
        { headers }
      );
      setNewMessage('');
      loadMessages();
    } catch (error) {
      toast.error('Failed to send message');
    }
  };

  // Delete message
  const handleDeleteMessage = async (messageId) => {
    try {
      await axios.delete(
        `${API}/api/chat/channels/${selectedChannel.channel_id}/messages/${messageId}`,
        { headers }
      );
      loadMessages();
      toast.success('Message deleted');
    } catch (error) {
      toast.error('Failed to delete message');
    }
  };

  // Create default channels if none exist
  const createDefaultChannel = async () => {
    try {
      setLoading(true);
      await axios.post(
        `${API}/api/chat/channels`,
        { name: 'general', description: 'General team chat', icon: '#' },
        { headers }
      );
      loadChannels();
      toast.success('General channel created');
    } catch (error) {
      toast.error('Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  // Format timestamp
  const formatTime = (dateStr) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString();
  };

  // Get initials for avatar
  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  };

  // Check if user is online
  const isUserOnline = (userId) => {
    return onlineUsers.some(u => u.user_id === userId);
  };

  if (!isOpen) return null;

  const totalUnread = channels.reduce((sum, ch) => sum + (ch.unread_count || 0), 0);

  return (
    <div className="fixed right-0 top-0 h-full w-full max-w-[400px] bg-[#18181b] border-l border-[#27272a] shadow-2xl z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-[#27272a]">
        <div className="flex items-center gap-3">
          <MessageSquare className="h-5 w-5 text-[#6366f1]" />
          <h2 className="text-lg font-semibold text-[#fafafa]">Team Chat</h2>
          {totalUnread > 0 && (
            <Badge className="bg-[#ef4444] text-white text-xs">{totalUnread}</Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onClose} className="text-[#71717a] hover:text-[#fafafa]">
          <X className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Channel List */}
        <div className={`${showChannelList ? 'w-1/3' : 'w-0'} border-r border-[#27272a] overflow-hidden transition-all`}>
          <div className="p-2">
            <div className="flex items-center justify-between px-2 py-1">
              <span className="text-xs font-medium text-[#71717a] uppercase">Channels</span>
            </div>
            
            {channels.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-sm text-[#71717a] mb-3">No channels yet</p>
                <Button 
                  size="sm" 
                  onClick={createDefaultChannel}
                  disabled={loading}
                  className="bg-[#6366f1]"
                >
                  Create #general
                </Button>
              </div>
            ) : (
              <div className="space-y-0.5">
                {channels.map(channel => (
                  <button
                    key={channel.channel_id}
                    onClick={() => setSelectedChannel(channel)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors ${
                      selectedChannel?.channel_id === channel.channel_id
                        ? 'bg-[#27272a] text-[#fafafa]'
                        : 'text-[#a1a1aa] hover:bg-[#27272a]/50'
                    }`}
                  >
                    <span className="text-[#71717a]">{channel.icon || '#'}</span>
                    <span className="flex-1 truncate text-left">{channel.name}</span>
                    {channel.unread_count > 0 && (
                      <Badge className="bg-[#ef4444] text-white text-xs px-1.5 py-0">
                        {channel.unread_count}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
            
            {/* Online Users */}
            <div className="mt-4 pt-4 border-t border-[#27272a]">
              <div className="flex items-center gap-2 px-2 py-1">
                <Users className="h-3 w-3 text-[#71717a]" />
                <span className="text-xs font-medium text-[#71717a] uppercase">Online</span>
                <span className="text-xs text-[#10b981]">{onlineUsers.length}</span>
              </div>
              <div className="space-y-1 mt-1">
                {onlineUsers.slice(0, 5).map(user => (
                  <div key={user.user_id} className="flex items-center gap-2 px-2 py-1">
                    <div className="relative">
                      <div className="w-6 h-6 rounded-full bg-[#6366f1] flex items-center justify-center text-white text-xs">
                        {getInitials(user.user_name)}
                      </div>
                      <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-[#10b981] text-[#10b981]" />
                    </div>
                    <span className="text-xs text-[#a1a1aa] truncate">{user.user_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 flex flex-col">
          {selectedChannel ? (
            <>
              {/* Channel Header */}
              <div className="flex items-center gap-2 p-3 border-b border-[#27272a]">
                <button
                  onClick={() => setShowChannelList(!showChannelList)}
                  className="text-[#71717a] hover:text-[#fafafa] lg:hidden"
                >
                  {showChannelList ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
                <span className="text-[#71717a]">{selectedChannel.icon || '#'}</span>
                <span className="font-medium text-[#fafafa]">{selectedChannel.name}</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="text-center py-8">
                    <MessageSquare className="h-12 w-12 text-[#27272a] mx-auto mb-3" />
                    <p className="text-sm text-[#71717a]">No messages yet</p>
                    <p className="text-xs text-[#52525b]">Be the first to say hello!</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.user_id === currentUser.user_id;
                    const showAvatar = idx === 0 || messages[idx - 1]?.user_id !== msg.user_id;
                    
                    return (
                      <div key={msg.message_id} className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                        {showAvatar && (
                          <div className="relative flex-shrink-0">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs ${isOwn ? 'bg-[#6366f1]' : 'bg-[#3f3f46]'}`}>
                              {getInitials(msg.user_name)}
                            </div>
                            {isUserOnline(msg.user_id) && (
                              <Circle className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 fill-[#10b981] text-[#10b981]" />
                            )}
                          </div>
                        )}
                        {!showAvatar && <div className="w-8" />}
                        
                        <div className={`flex-1 ${isOwn ? 'text-right' : ''}`}>
                          {showAvatar && (
                            <div className={`flex items-center gap-2 mb-1 ${isOwn ? 'justify-end' : ''}`}>
                              <span className="text-sm font-medium text-[#fafafa]">{msg.user_name}</span>
                              <span className="text-xs text-[#52525b]">{formatTime(msg.created_at)}</span>
                              {msg.is_edited && <span className="text-xs text-[#52525b]">(edited)</span>}
                            </div>
                          )}
                          <div className={`relative inline-block max-w-[85%] ${isOwn ? 'text-left' : ''}`}>
                            <div className={`px-3 py-2 rounded-lg ${isOwn ? 'bg-[#6366f1] text-white' : 'bg-[#27272a] text-[#fafafa]'}`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                            
                            {isOwn && (
                              <button
                                onClick={() => handleDeleteMessage(msg.message_id)}
                                className="absolute -right-6 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-[#71717a] hover:text-red-400"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Message Input */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-[#27272a]">
                <div className="flex items-center gap-2">
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder={`Message #${selectedChannel.name}`}
                    className="flex-1 bg-[#27272a] border-[#3f3f46] text-[#fafafa] placeholder:text-[#52525b]"
                  />
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim()}
                    className="bg-[#6366f1] hover:bg-[#4f46e5] disabled:opacity-50"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <MessageSquare className="h-16 w-16 text-[#27272a] mx-auto mb-4" />
                <p className="text-[#71717a]">Select a channel to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
