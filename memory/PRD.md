# Drawlead OS - Product Requirements Document

## Last Updated: January 12, 2026

---

## Recent Changes (January 12, 2026 - Latest)

### Drawlead AI Assistant ✅ NEW (Just Completed)
Built a context-aware operational AI assistant powered by Claude Sonnet 4.5:

**Features:**
- **Global AI Button:** Floating button on all pages (bottom-right)
- **Context Awareness:** Auto-detects current module (Sales on /leads, Operations on /operations)
- **Smart Prompts:** Suggested prompts change per context
- **Conversation Memory:** Chat history persisted in MongoDB
- **Quick Actions:** Lead summary, follow-up suggestions, project analysis
- **5 Modes:** General, Sales, Operations, Marketing, Finance

**UI:**
- Floating purple gradient button with pulse indicator
- Slide-out chat panel (420x550px)
- Color-coded context badges
- Message bubbles (user right, AI left)
- "Powered by Claude" footer

**Backend APIs:**
- `POST /api/ai/chat` - Send message, get AI response
- `POST /api/ai/chat/{id}` - Continue conversation
- `GET /api/ai/conversations` - List user's conversations
- `GET /api/ai/suggested-prompts/{context}` - Get context prompts
- `POST /api/ai/quick/lead-summary` - Analyze specific lead
- `POST /api/ai/quick/follow-up-suggestions` - Get follow-up actions
- `POST /api/ai/quick/project-analysis` - Analyze projects

**Database:**
- `ai_conversations` collection for chat history

### Previous (Same Day)
- Marketing Module with Analytics, Blog, Social Media, Email tabs

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── ai_routes.py          # NEW - Drawlead AI
│   ├── marketing_routes.py
│   ├── notion_routes.py
│   ├── chat_routes.py
│   ├── hr_routes.py
│   └── finance_routes.py
└── frontend/
    └── src/
        ├── components/
        │   ├── DrawleadAI.jsx   # NEW - AI floating button & chat
        │   ├── Layout.js        # Updated with AI integration
        │   ├── Sidebar.js
        │   └── marketing/
        └── pages/
            ├── MarketingModule.js
            └── OperationsPage.js
```

## Key Features

### Drawlead AI ✅ NEW (Just Completed)
- Context-aware AI assistant (Claude Sonnet 4.5)
- Auto-switches context based on current page
- Sales & Operations intelligence
- Conversation history & quick actions

### Marketing Module ✅ COMPLETE
- Analytics dashboard (demo GA4 data)
- Blog management with full CRUD
- Social media Kanban (4 platforms)
- Email inbox visibility

### Team Chat Module ✅ COMPLETE
- Team channels & real-time messaging
- Online status indicators
- Unread message badges

### Operations Module ✅ COMPLETE
- Notion-like databases
- Google Docs/Sheets integration
- Multiple view modes

### HR Module ✅ COMPLETE
- Employee & Admin portals

### Finance Module ✅ COMPLETE
- Invoices, reports, PDF export

## Database Schema

### ai_conversations (NEW)
```json
{
  "conversation_id": "conv_xxxx",
  "user_id": "user_xxxx",
  "context_type": "sales|operations|marketing|finance|general",
  "messages": [
    {"role": "user", "content": "...", "timestamp": "..."},
    {"role": "assistant", "content": "...", "timestamp": "..."}
  ],
  "created_at": "datetime",
  "updated_at": "datetime"
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Pending Tasks

### P1 (High Priority)
- Add inline AI buttons to Lead detail modal
- Add inline AI buttons to Project/Task views
- Resend Email Config (requires user API key)
- Code Refactoring (split OperationsPage.js)

### P2 (Medium Priority)
- Finance: Payroll, GST, Budgeting tabs UI
- Direct Messages (1-on-1 chat)
- Real GA4/WordPress/Gmail integrations
- Chat Backend Persistence (MongoDB)

### P3 (Backlog)
- WebSocket for real-time (replace polling)
- AI conversation export
- AI learning from user feedback
- Marketing Module integrations

## Tech Stack
- **Backend:** FastAPI, MongoDB, Pydantic, JWT, bcrypt
- **Frontend:** React, Tailwind CSS, shadcn/ui, lucide-react
- **AI:** Claude Sonnet 4.5 via emergentintegrations library
- **Real-time:** Polling (3s interval)

## Known Mocked Integrations
- **Resend Email:** Requires RESEND_API_KEY
- **Google Analytics:** Demo data (GA4 integration pending)
- **WordPress:** Local storage (WP sync pending)
- **Gmail:** Demo emails (OAuth pending)
- **Team Chat:** In-memory storage

## Testing
- **AI Module:** 22/22 tests passed
- **Marketing Module:** 23/23 tests passed
- Test files: `/app/tests/test_ai_module.py`, `/app/tests/test_marketing_module.py`
