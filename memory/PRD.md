# Drawlead OS - Product Requirements Document

## Last Updated: January 12, 2026

---

## Recent Changes (January 12, 2026 - Latest)

### Slack-like Team Chat Module - NEW
Built a full team communication system:

**Features:**
- **Team Channels:** Create channels like #general, #marketing
- **Project-linked Channels:** Each project auto-gets a chat channel
- **Real-time Messages:** Polling updates every 3 seconds
- **Online Status:** Green indicators for online users
- **Unread Badges:** Shows unread count on sidebar and channels
- **Message Actions:** Send, edit (own), delete (own) messages
- **User Avatars:** Initials-based avatars with colors

**UI:**
- Team Chat button in sidebar with unread badge
- Slide-out chat panel (400px wide)
- Channel list on left, messages on right
- Message input with send button
- Online users list with green dot indicators

**Backend APIs:**
- `GET /api/chat/channels` - List all channels
- `POST /api/chat/channels` - Create channel
- `GET /api/chat/channels/{id}/messages` - Get messages
- `POST /api/chat/channels/{id}/messages` - Send message
- `DELETE /api/chat/channels/{id}/messages/{msg_id}` - Delete message
- `GET /api/chat/unread-count` - Total unread count
- `POST /api/chat/online` - Heartbeat for online status
- `GET /api/chat/online-users` - List online users

### Previous (Same Day)
- Google Sheets/Docs integration with split view
- Paste-link approach for document embedding

## Previous Changes (January 11, 2026)
- Right-click context menu, 3 view modes
- Project hierarchy, safe delete confirmation
- Login fix for vinoth@drawlead.com

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── notion_routes.py
│   ├── chat_routes.py        # NEW - Team chat API
│   ├── hr_routes.py
│   └── finance_routes.py
└── frontend/
    └── src/
        ├── components/
        │   ├── Sidebar.js      # Updated with chat button
        │   └── ChatPanel.jsx   # NEW - Chat UI component
        └── pages/
            └── OperationsPage.js
```

## Key Features

### Team Chat Module ✅ NEW
- Channels (team-wide & project-linked)
- Real-time messaging with polling
- Online status indicators
- Unread message badges
- Message history

### Operations Module ✅ COMPLETE
- Notion-like databases
- Google Docs/Sheets integration
- Split view for documents
- Table, Kanban, By Project views
- Context menu, safe delete

### HR Module ✅ COMPLETE
- Employee & Admin portals
- Email notifications (MOCKED)

### Finance Module ✅ COMPLETE
- Invoices, reports, PDF export

## Database Schema

### chat_channels (NEW)
```json
{
  "channel_id": "ch_xxxx",
  "name": "general",
  "description": "General team chat",
  "icon": "#",
  "project_id": "proj_xxxx | null",
  "is_project_channel": false,
  "created_by": "user_xxxx",
  "created_at": "datetime"
}
```

### chat_messages (NEW)
```json
{
  "message_id": "msg_xxxx",
  "channel_id": "ch_xxxx",
  "content": "Hello team!",
  "user_id": "user_xxxx",
  "user_name": "Vinoth",
  "created_at": "datetime",
  "is_edited": false
}
```

### chat_read_status (NEW)
```json
{
  "channel_id": "ch_xxxx",
  "user_id": "user_xxxx",
  "last_read_at": "datetime"
}
```

### user_online_status (NEW)
```json
{
  "user_id": "user_xxxx",
  "user_name": "Vinoth",
  "last_seen": "datetime",
  "is_online": true
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123

## Pending Tasks

### P1 (High Priority)
- Resend Email Config
- Code Refactoring (split large components)

### P2 (Medium Priority)
- Finance: Payroll, GST, Budgeting tabs
- Direct Messages (1-on-1 chat)

### P3 (Backlog)
- WebSocket for real-time (replace polling)
- Message reactions/emojis
- File attachments in chat

## Tech Stack
- **Backend:** FastAPI, MongoDB, Pydantic, JWT
- **Frontend:** React, Tailwind CSS, shadcn/ui, lucide-react
- **Real-time:** Polling (3s interval) - can upgrade to WebSocket

## Known Mocked Integrations
- **Resend Email:** Requires user's RESEND_API_KEY
