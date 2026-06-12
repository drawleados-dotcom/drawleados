import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { ScrollArea } from './ui/scroll-area';
import {
  Bot,
  X,
  Send,
  Sparkles,
  Loader2,
  MessageSquare,
  Trash2,
  ChevronDown,
  Lightbulb,
  TrendingUp,
  Settings2,
  DollarSign,
  Users
} from 'lucide-react';
import axios from 'axios';
import { toast } from 'sonner';

const API = process.env.REACT_APP_BACKEND_URL;

const contextIcons = {
  general: Sparkles,
  sales: TrendingUp,
  operations: Settings2,
  marketing: MessageSquare,
  finance: DollarSign
};

const contextColors = {
  general: '#6366f1',
  sales: '#10b981',
  operations: '#f59e0b',
  marketing: '#8b5cf6',
  finance: '#ef4444'
};

const DrawleadAI = ({ currentModule = 'general', contextData = null }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState([]);
  const [contextType, setContextType] = useState(currentModule);
  const [showContextMenu, setShowContextMenu] = useState(false);
  
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const token = localStorage.getItem('session_token');

  // Scroll to bottom when messages change
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Update context when module changes
  useEffect(() => {
    setContextType(currentModule);
  }, [currentModule]);

  // Load suggested prompts
  const loadSuggestedPrompts = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/api/ai/suggested-prompts/${contextType}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSuggestedPrompts(res.data || []);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  }, [token, contextType]);

  useEffect(() => {
    if (isOpen) {
      loadSuggestedPrompts();
      inputRef.current?.focus();
    }
  }, [isOpen, loadSuggestedPrompts]);

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || loading) return;

    const userMessage = { role: 'user', content: messageText.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const endpoint = conversationId
        ? `${API}/api/ai/chat/${conversationId}`
        : `${API}/api/ai/chat`;

      const res = await axios.post(endpoint, {
        prompt: messageText.trim(),
        context_type: contextType,
        context_data: contextData
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const assistantMessage = { role: 'assistant', content: res.data.response };
      setMessages(prev => [...prev, assistantMessage]);
      
      if (!conversationId) {
        setConversationId(res.data.conversation_id);
      }
    } catch (error) {
      console.error('AI error:', error);
      toast.error('Failed to get AI response');
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        isError: true
      }]);
    } finally {
      setLoading(false);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const ContextIcon = contextIcons[contextType] || Sparkles;

  return (
    <>
      {/* Floating AI Button */}
      <button
        onClick={() => setIsOpen(true)}
        className={`fixed bottom-24 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300 hover:scale-110 ${
          isOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
        }`}
        style={{ background: `linear-gradient(135deg, ${contextColors[contextType]}, #8b5cf6)` }}
        data-testid="ai-floating-button"
      >
        <Bot className="h-6 w-6 text-white" />
        <span className="absolute -top-1 -right-1 h-4 w-4 bg-[#10b981] rounded-full animate-pulse" />
      </button>

      {/* AI Chat Panel */}
      <div
        className={`fixed bottom-24 right-6 z-50 w-[420px] h-[550px] bg-[#0c0a09] border border-[#27272a] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
          isOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'
        }`}
        data-testid="ai-chat-panel"
      >
        {/* Header */}
        <div 
          className="p-4 border-b border-[#27272a] flex items-center justify-between"
          style={{ background: `linear-gradient(135deg, ${contextColors[contextType]}15, transparent)` }}
        >
          <div className="flex items-center gap-3">
            <div 
              className="h-10 w-10 rounded-xl flex items-center justify-center"
              style={{ background: `${contextColors[contextType]}30` }}
            >
              <Bot className="h-5 w-5" style={{ color: contextColors[contextType] }} />
            </div>
            <div>
              <h3 className="text-[#fafafa] font-semibold flex items-center gap-2">
                Drawlead AI
                <Badge 
                  className="text-xs capitalize"
                  style={{ 
                    background: `${contextColors[contextType]}20`,
                    color: contextColors[contextType]
                  }}
                >
                  {contextType}
                </Badge>
              </h3>
              <p className="text-xs text-[#71717a]">Your operational assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                size="icon"
                variant="ghost"
                onClick={startNewConversation}
                className="text-[#71717a] hover:text-[#fafafa] h-8 w-8"
                title="New conversation"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              className="text-[#71717a] hover:text-[#fafafa] h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Context Selector */}
        <div className="px-4 py-2 border-b border-[#27272a]">
          <div className="relative">
            <button
              onClick={() => setShowContextMenu(!showContextMenu)}
              className="flex items-center gap-2 text-sm text-[#a1a1aa] hover:text-[#fafafa] transition-colors"
            >
              <ContextIcon className="h-4 w-4" style={{ color: contextColors[contextType] }} />
              <span className="capitalize">{contextType} Mode</span>
              <ChevronDown className={`h-3 w-3 transition-transform ${showContextMenu ? 'rotate-180' : ''}`} />
            </button>
            
            {showContextMenu && (
              <div className="absolute top-full left-0 mt-1 bg-[#18181b] border border-[#27272a] rounded-lg shadow-lg py-1 z-10 min-w-[160px]">
                {Object.entries(contextIcons).map(([type, Icon]) => (
                  <button
                    key={type}
                    onClick={() => {
                      setContextType(type);
                      setShowContextMenu(false);
                      startNewConversation();
                    }}
                    className={`w-full px-3 py-2 flex items-center gap-2 text-sm hover:bg-[#27272a] transition-colors ${
                      contextType === type ? 'text-[#fafafa]' : 'text-[#71717a]'
                    }`}
                  >
                    <Icon className="h-4 w-4" style={{ color: contextColors[type] }} />
                    <span className="capitalize">{type}</span>
                    {contextType === type && (
                      <span className="ml-auto text-[#10b981]">✓</span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 p-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center px-4">
              <div 
                className="h-16 w-16 rounded-2xl flex items-center justify-center mb-4"
                style={{ background: `${contextColors[contextType]}20` }}
              >
                <Sparkles className="h-8 w-8" style={{ color: contextColors[contextType] }} />
              </div>
              <h4 className="text-[#fafafa] font-medium mb-2">How can I help you?</h4>
              <p className="text-sm text-[#71717a] mb-6">
                I can analyze your data, suggest actions, and help you work smarter.
              </p>
              
              {/* Suggested Prompts */}
              <div className="w-full space-y-2">
                <p className="text-xs text-[#52525b] flex items-center gap-1 mb-2">
                  <Lightbulb className="h-3 w-3" />
                  Try asking:
                </p>
                {suggestedPrompts.slice(0, 3).map((prompt, index) => (
                  <button
                    key={index}
                    onClick={() => sendMessage(prompt)}
                    className="w-full text-left px-3 py-2 text-sm text-[#a1a1aa] bg-[#18181b] hover:bg-[#27272a] rounded-lg transition-colors border border-[#27272a]"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] px-4 py-3 rounded-2xl ${
                      message.role === 'user'
                        ? 'bg-[#6366f1] text-white rounded-br-md'
                        : message.isError
                        ? 'bg-[#ef4444]/20 text-[#ef4444] border border-[#ef4444]/30 rounded-bl-md'
                        : 'bg-[#18181b] text-[#fafafa] border border-[#27272a] rounded-bl-md'
                    }`}
                  >
                    <p className="text-sm whitespace-pre-wrap">{message.content}</p>
                  </div>
                </div>
              ))}
              
              {loading && (
                <div className="flex justify-start">
                  <div className="bg-[#18181b] border border-[#27272a] px-4 py-3 rounded-2xl rounded-bl-md">
                    <div className="flex items-center gap-2 text-[#71717a]">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="p-4 border-t border-[#27272a]">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Ask Drawlead AI..."
              className="flex-1 bg-[#18181b] border-[#27272a] focus:border-[#6366f1] text-[#fafafa] placeholder:text-[#71717a]"
              disabled={loading}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || loading}
              className="bg-[#6366f1] hover:bg-[#5558dd] h-10 w-10 p-0"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-xs text-[#52525b] mt-2 text-center">
            Powered by Claude • Context-aware responses
          </p>
        </div>
      </div>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default DrawleadAI;
