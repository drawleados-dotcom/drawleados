# Drawlead OS - Product Requirements Document

## Last Updated: January 12, 2026

---

## Recent Changes (January 12, 2026 - Latest)

### Marketing Module ✅ NEW (Just Completed)
Built a comprehensive marketing hub for centralized marketing management:

**Features:**
- **Analytics Dashboard:** GA4-style metrics (users, sessions, pageviews, bounce rate)
- **Traffic Sources:** Organic Search, Direct, Social, Referral, Email breakdown
- **Top Pages:** Page views with average time on page
- **Blog Management:** Full CRUD for blog posts with SEO fields
- **Social Media Calendar:** Kanban board for Instagram, LinkedIn, YouTube, Twitter
- **Content Workflow:** Idea → In Creation → Review → Scheduled → Published
- **Email Visibility:** Read-only inbox view (demo data)
- **Demo Data Fallback:** All features work with sample data when not connected

**UI:**
- Marketing link in sidebar (admin only)
- Tabbed interface: Analytics, Blog, Social Media, Email
- Kanban board for social media content per platform
- Blog list with search, filter, create/edit modal
- Demo mode banner when integrations not connected

**Backend APIs:**
- `GET /api/marketing/dashboard` - Overall stats
- `GET /api/marketing/analytics` - GA4-style metrics
- `GET/POST /api/marketing/blog` - Blog CRUD
- `GET/POST/PUT/DELETE /api/marketing/content` - Social media CRUD
- `GET /api/marketing/emails` - Inbox visibility
- `POST /api/marketing/seed-demo` - Load demo data
- `GET/POST/DELETE /api/marketing/integrations` - Integration settings

**Database Collections:**
- `marketing_content` - Social media posts
- `marketing_blogs` - Blog articles
- `marketing_integrations` - Integration settings

### Previous (Same Day)
- Slack-like Team Chat Module
- Google Sheets/Docs integration with split view

## Architecture
```
/app/
├── backend/
│   ├── server.py
│   ├── marketing_routes.py  # NEW - Marketing API
│   ├── notion_routes.py
│   ├── chat_routes.py
│   ├── hr_routes.py
│   └── finance_routes.py
└── frontend/
    └── src/
        ├── components/
        │   ├── Sidebar.js
        │   ├── ChatPanel.jsx
        │   └── marketing/        # NEW
        │       ├── AnalyticsTab.jsx
        │       ├── BlogTab.jsx
        │       ├── SocialMediaTab.jsx
        │       └── EmailTab.jsx
        └── pages/
            ├── MarketingModule.js  # NEW
            └── OperationsPage.js
```

## Key Features

### Marketing Module ✅ NEW (Just Completed)
- Analytics dashboard with demo GA4 data
- Blog management with full CRUD
- Social media Kanban board (4 platforms)
- Email inbox visibility
- Demo data fallback for all integrations

### Team Chat Module ✅ COMPLETE
- Channels (team-wide & project-linked)
- Real-time messaging with polling
- Online status indicators
- Unread message badges

### Operations Module ✅ COMPLETE
- Notion-like databases
- Google Docs/Sheets integration
- Table, Kanban, By Project views
- Context menu, safe delete

### HR Module ✅ COMPLETE
- Employee & Admin portals
- Email notifications (MOCKED)

### Finance Module ✅ COMPLETE
- Invoices, reports, PDF export

## Database Schema

### marketing_content (NEW)
```json
{
  "content_id": "content_xxxx",
  "title": "Campaign Post",
  "platform": "instagram|linkedin|youtube|twitter",
  "content_type": "post|reel|video|short|article|tweet|thread",
  "caption": "...",
  "hashtags": ["marketing", "agency"],
  "status": "idea|in_creation|review|scheduled|published",
  "scheduled_date": "2026-01-15",
  "created_by": "user_xxxx",
  "created_at": "datetime"
}
```

### marketing_blogs (NEW)
```json
{
  "blog_id": "blog_xxxx",
  "title": "Marketing Trends 2026",
  "slug": "marketing-trends-2026",
  "content": "<html>...</html>",
  "category": "Marketing",
  "tags": ["seo", "trends"],
  "status": "draft|scheduled|published",
  "seo_title": "...",
  "seo_description": "...",
  "created_at": "datetime"
}
```

## Test Credentials
- **Admin:** vinoth@drawlead.com / admin123
- **Employee:** employee@drawlead.com / emp123

## Pending Tasks

### P1 (High Priority)
- Resend Email Config (requires user API key)
- Code Refactoring:
  - Split OperationsPage.js (2000+ lines)
  - Split SocialMediaTab.jsx into components
- Chat Backend Persistence (currently in-memory)

### P2 (Medium Priority)
- Finance: Payroll, GST, Budgeting tabs UI
- Direct Messages (1-on-1 chat)
- Real GA4/WordPress/Gmail integrations

### P3 (Backlog)
- WebSocket for real-time (replace polling)
- Message reactions/emojis
- File attachments in chat
- Kanban drag-and-drop in Operations

## Tech Stack
- **Backend:** FastAPI, MongoDB, Pydantic, JWT, bcrypt
- **Frontend:** React, Tailwind CSS, shadcn/ui, lucide-react
- **Real-time:** Polling (3s interval)

## Known Mocked Integrations
- **Resend Email:** Requires RESEND_API_KEY in backend/.env
- **Google Analytics:** Returns demo data (GA4 integration pending)
- **WordPress:** Blog stored locally (WP sync pending)
- **Gmail:** Returns demo emails (OAuth pending)
- **Team Chat:** In-memory storage (needs MongoDB migration)

## Testing
- **Marketing Module:** 23/23 tests passed
- Test file: `/app/tests/test_marketing_module.py`
- Test report: `/app/test_reports/iteration_6.json`
