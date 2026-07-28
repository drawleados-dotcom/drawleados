import React from 'react';
import { useNavigate } from 'react-router-dom';
import Layout from '../components/Layout';
import { useTheme } from '../contexts/ThemeContext';
import {
  Bot, Linkedin, Mail, MessageCircle, Sparkles, Workflow, Plug, ScrollText, Settings,
} from 'lucide-react';

const CARDS = [
  {
    key: 'linkedin_partnership',
    title: 'LinkedIn Partnership',
    description: 'Build long-term agency partnerships with AI-assisted outreach.',
    icon: Linkedin,
    color: '#0a66c2',
    path: '/automation/linkedin-partnership',
    live: true,
  },
  { key: 'email_outreach', title: 'Email Outreach', description: 'AI-drafted cold email sequences.', icon: Mail, color: '#f59e0b' },
  { key: 'whatsapp_automation', title: 'WhatsApp Automation', description: 'Client updates and follow-ups over WhatsApp.', icon: MessageCircle, color: '#22c55e' },
  { key: 'ai_agents', title: 'AI Agents', description: 'Autonomous assistants for recurring work.', icon: Sparkles, color: '#8b5cf6' },
  { key: 'workflow_builder', title: 'Workflow Builder', description: 'Visual builder for multi-step automations.', icon: Workflow, color: '#ec4899' },
  { key: 'integrations', title: 'Integrations', description: 'Connect Google, Slack, n8n and more.', icon: Plug, color: '#14b8a6' },
  { key: 'automation_logs', title: 'Automation Logs', description: 'Every automation run, tracked.', icon: ScrollText, color: '#6366f1' },
  { key: 'automation_settings', title: 'Settings', description: 'AI models, approval rules, limits.', icon: Settings, color: '#71717a' },
];

const AutomationPage = () => {
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const bgCard = isDark ? 'bg-[#18181b]' : 'bg-white';
  const borderColor = isDark ? 'border-[#3f3f46]' : 'border-gray-200';
  const textPrimary = isDark ? 'text-[#fafafa]' : 'text-gray-900';
  const textSecondary = isDark ? 'text-[#a1a1aa]' : 'text-gray-500';

  return (
    <Layout>
      <div className="p-6" data-testid="automation-page">
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-[#6366f1]/20">
            <Bot className="h-6 w-6 text-[#6366f1]" />
          </div>
          <div>
            <h1 className={`text-xl font-bold ${textPrimary}`}>Automation</h1>
            <p className={`text-sm ${textSecondary}`}>The intelligence layer of Drawlead OS — AI-powered automations for every relationship.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {CARDS.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.key}
                type="button"
                disabled={!card.live}
                onClick={() => card.live && navigate(card.path)}
                data-testid={`automation-card-${card.key}`}
                className={`text-left p-5 rounded-xl border ${borderColor} ${bgCard} transition-all ${
                  card.live ? 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer' : 'opacity-60 cursor-not-allowed'
                }`}
                style={{ borderTop: `3px solid ${card.color}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="p-2.5 rounded-lg" style={{ backgroundColor: `${card.color}20` }}>
                    <Icon className="h-5 w-5" style={{ color: card.color }} />
                  </div>
                  {!card.live && (
                    <span className={`text-[10px] font-medium uppercase tracking-wide px-2 py-0.5 rounded border ${borderColor} ${textSecondary}`}>
                      Coming Soon
                    </span>
                  )}
                </div>
                <h3 className={`text-sm font-semibold ${textPrimary}`}>{card.title}</h3>
                <p className={`text-xs ${textSecondary} mt-1`}>{card.description}</p>
              </button>
            );
          })}
        </div>
      </div>
    </Layout>
  );
};

export default AutomationPage;
