"""
Drawlead AI - Context-Aware Operational Assistant
Powered by Claude Sonnet 4.5 via Emergent LLM Integration

Capabilities:
- Sales: Lead analysis, follow-up suggestions, deal predictions
- Operations: Project analysis, task suggestions, workload assessment
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone, timedelta
import uuid
import os
from dotenv import load_dotenv

load_dotenv()

from emergentintegrations.llm.chat import LlmChat, UserMessage

ai_router = APIRouter(prefix="/ai", tags=["AI Assistant"])
db = None

def init_ai_db(database):
    global db
    db = database

# ============== MODELS ==============

class AIMessage(BaseModel):
    role: str  # 'user' or 'assistant'
    content: str
    timestamp: Optional[str] = None

class AIPromptRequest(BaseModel):
    prompt: str
    context_type: str = "general"  # general, sales, operations, marketing, finance
    context_data: Optional[Dict[str, Any]] = None  # Additional context like lead_id, project_id

class AIConversation(BaseModel):
    conversation_id: str
    user_id: str
    messages: List[AIMessage]
    context_type: str
    created_at: datetime
    updated_at: datetime

# ============== SYSTEM PROMPTS ==============

SYSTEM_PROMPTS = {
    "general": """You are Drawlead AI, an intelligent operational assistant for Drawlead OS - an internal agency management system.

Your role is to help users with:
- Analyzing business data and providing insights
- Suggesting next actions and improvements
- Answering questions about leads, projects, tasks, and finances
- Drafting content and communications

Guidelines:
- Be professional, clear, and action-oriented
- Provide specific, actionable suggestions
- Reference actual data when available
- Never make up data - if you don't have information, say so
- Keep responses concise but helpful""",

    "sales": """You are Drawlead AI, a Sales Intelligence Assistant for Drawlead OS.

Your expertise includes:
- Analyzing lead discussions and status
- Predicting deal outcomes (hot/warm/cold)
- Suggesting follow-up actions and timings
- Identifying stuck or at-risk deals
- Drafting proposal notes and follow-up messages

When analyzing leads:
- Consider the status, last contact date, and discussion notes
- Look for buying signals or concerns
- Suggest specific next steps with reasoning
- Prioritize leads by potential and urgency

Always provide actionable insights, not just observations.""",

    "operations": """You are Drawlead AI, an Operations Intelligence Assistant for Drawlead OS.

Your expertise includes:
- Analyzing project progress and timelines
- Identifying bottlenecks and delays
- Assessing team workload distribution
- Suggesting task prioritization
- Creating task breakdowns for services
- Detecting workflow issues

When analyzing projects and tasks:
- Look at status distributions and completion rates
- Identify overdue or at-risk items
- Consider team capacity and assignments
- Suggest specific improvements with clear reasoning

Focus on actionable recommendations that improve efficiency.""",

    "marketing": """You are Drawlead AI, a Marketing Intelligence Assistant for Drawlead OS.

Your expertise includes:
- Generating content ideas for different platforms
- Analyzing marketing performance metrics
- Suggesting content calendar optimizations
- Repurposing content across channels
- Identifying best posting times and strategies

Provide creative but practical suggestions aligned with marketing goals.""",

    "finance": """You are Drawlead AI, a Finance Intelligence Assistant for Drawlead OS.

Your expertise includes:
- Summarizing revenue and payment status
- Identifying overdue invoices and cash flow risks
- Drafting payment reminder messages
- Explaining financial data in simple terms
- Predicting potential payment issues

Be precise with numbers and provide clear financial insights."""
}

# ============== HELPERS ==============

async def get_current_user(request: Request):
    """Get current user from session token"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    return user

async def get_sales_context(context_data: Dict = None) -> str:
    """Gather relevant sales data for context"""
    context_parts = []
    
    # Get lead statistics
    total_leads = await db.leads.count_documents({"is_deleted": False})
    
    # Get status breakdown
    statuses = await db.statuses.find({"is_active": True}, {"_id": 0}).to_list(100)
    status_counts = {}
    for status in statuses:
        count = await db.leads.count_documents({"status_id": status["status_id"], "is_deleted": False})
        status_counts[status["name"]] = count
    
    context_parts.append(f"LEAD STATISTICS:\n- Total Active Leads: {total_leads}")
    context_parts.append("- Status Breakdown: " + ", ".join([f"{k}: {v}" for k, v in status_counts.items()]))
    
    # Get recent leads (last 7 days)
    week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    recent_leads = await db.leads.find(
        {"is_deleted": False, "created_at": {"$gte": week_ago}},
        {"_id": 0, "lead_id": 1, "name": 1, "business_name": 1, "status_id": 1, "discussion_notes": 1, "service_cost": 1}
    ).limit(10).to_list(10)
    
    if recent_leads:
        context_parts.append(f"\nRECENT LEADS ({len(recent_leads)}):")
        for lead in recent_leads:
            status = next((s["name"] for s in statuses if s["status_id"] == lead.get("status_id")), "Unknown")
            context_parts.append(f"- {lead.get('name', 'N/A')} ({lead.get('business_name', 'N/A')}) - Status: {status}, Value: ₹{lead.get('service_cost', 0)}")
    
    # If specific lead requested
    if context_data and context_data.get("lead_id"):
        lead = await db.leads.find_one({"lead_id": context_data["lead_id"], "is_deleted": False}, {"_id": 0})
        if lead:
            status = next((s["name"] for s in statuses if s["status_id"] == lead.get("status_id")), "Unknown")
            context_parts.append(f"\nFOCUSED LEAD:")
            context_parts.append(f"- Name: {lead.get('name', 'N/A')}")
            context_parts.append(f"- Business: {lead.get('business_name', 'N/A')}")
            context_parts.append(f"- Status: {status}")
            context_parts.append(f"- Service Cost: ₹{lead.get('service_cost', 0)}")
            context_parts.append(f"- Discussion Notes: {lead.get('discussion_notes', 'None')}")
            context_parts.append(f"- Expected Closing: {lead.get('expected_closing_date', 'Not set')}")
    
    return "\n".join(context_parts)

async def get_operations_context(context_data: Dict = None) -> str:
    """Gather relevant operations data for context"""
    context_parts = []
    
    # Get database statistics
    databases = await db.notion_databases.find({}, {"_id": 0}).to_list(100)
    context_parts.append(f"DATABASES: {len(databases)} databases found")
    
    for database in databases[:5]:  # Limit to 5 databases
        db_id = database.get("database_id")
        db_name = database.get("name", "Unnamed")
        
        # Get row counts
        total_rows = await db.notion_rows.count_documents({"database_id": db_id})
        
        # Get status column if exists
        columns = database.get("columns", [])
        status_col = next((c for c in columns if c.get("type") == "status"), None)
        
        context_parts.append(f"\n{db_name}:")
        context_parts.append(f"  - Total Items: {total_rows}")
        
        if status_col:
            # Count by status
            status_options = status_col.get("options", [])
            for opt in status_options[:5]:  # Limit status options
                count = await db.notion_rows.count_documents({
                    "database_id": db_id,
                    f"data.{status_col['name']}": opt
                })
                context_parts.append(f"  - {opt}: {count}")
    
    # Get projects
    projects = await db.notion_projects.find({}, {"_id": 0}).to_list(50)
    if projects:
        context_parts.append(f"\nPROJECTS: {len(projects)} projects")
        for proj in projects[:10]:
            context_parts.append(f"  - {proj.get('name', 'Unnamed')}")
    
    # If specific project requested
    if context_data and context_data.get("project_id"):
        project = await db.notion_projects.find_one({"project_id": context_data["project_id"]}, {"_id": 0})
        if project:
            context_parts.append(f"\nFOCUSED PROJECT: {project.get('name', 'Unnamed')}")
            # Get tasks in this project
            tasks = await db.notion_rows.find(
                {"project_id": context_data["project_id"]},
                {"_id": 0}
            ).to_list(50)
            context_parts.append(f"  - Total Tasks: {len(tasks)}")
    
    return "\n".join(context_parts)

async def get_context_for_type(context_type: str, context_data: Dict = None) -> str:
    """Get relevant context based on type"""
    if context_type == "sales":
        return await get_sales_context(context_data)
    elif context_type == "operations":
        return await get_operations_context(context_data)
    elif context_type == "marketing":
        # Get marketing stats
        content_count = await db.marketing_content.count_documents({})
        blog_count = await db.marketing_blogs.count_documents({})
        return f"MARKETING DATA:\n- Social Media Posts: {content_count}\n- Blog Posts: {blog_count}"
    elif context_type == "finance":
        # Get finance stats
        sales_count = await db.finance_sales.count_documents({})
        pending = await db.finance_sales.count_documents({"invoice_status": "pending"})
        return f"FINANCE DATA:\n- Total Sales Records: {sales_count}\n- Pending Invoices: {pending}"
    else:
        return "No specific context loaded. Ask me anything about your Drawlead OS data."

# ============== AI ROUTES ==============

@ai_router.post("/chat")
async def chat_with_ai(request: Request, prompt_request: AIPromptRequest):
    """Main AI chat endpoint"""
    user = await get_current_user(request)
    
    try:
        # Get API key
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Get context data
        context_data = await get_context_for_type(
            prompt_request.context_type, 
            prompt_request.context_data
        )
        
        # Build system message with context
        system_prompt = SYSTEM_PROMPTS.get(prompt_request.context_type, SYSTEM_PROMPTS["general"])
        full_system_message = f"""{system_prompt}

CURRENT USER: {user.get('name', 'Unknown')} ({user.get('role', 'user')})

AVAILABLE DATA:
{context_data}

Remember to:
1. Reference the data above when relevant
2. Provide specific, actionable suggestions
3. Be concise but thorough"""

        # Initialize chat with Claude Sonnet 4.5
        session_id = f"ai_{user['user_id']}_{datetime.now().strftime('%Y%m%d%H%M%S')}"
        chat = LlmChat(
            api_key=api_key,
            session_id=session_id,
            system_message=full_system_message
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        # Create user message
        user_message = UserMessage(text=prompt_request.prompt)
        
        # Get response
        response = await chat.send_message(user_message)
        
        # Save conversation to database
        conversation_id = f"conv_{uuid.uuid4().hex[:12]}"
        now = datetime.now(timezone.utc)
        
        conversation_doc = {
            "conversation_id": conversation_id,
            "user_id": user["user_id"],
            "context_type": prompt_request.context_type,
            "messages": [
                {
                    "role": "user",
                    "content": prompt_request.prompt,
                    "timestamp": now.isoformat()
                },
                {
                    "role": "assistant",
                    "content": response,
                    "timestamp": now.isoformat()
                }
            ],
            "created_at": now,
            "updated_at": now
        }
        
        await db.ai_conversations.insert_one(conversation_doc)
        
        return {
            "response": response,
            "conversation_id": conversation_id,
            "context_type": prompt_request.context_type
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@ai_router.post("/chat/{conversation_id}")
async def continue_conversation(request: Request, conversation_id: str, prompt_request: AIPromptRequest):
    """Continue an existing conversation"""
    user = await get_current_user(request)
    
    # Get existing conversation
    conversation = await db.ai_conversations.find_one(
        {"conversation_id": conversation_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    try:
        api_key = os.environ.get("EMERGENT_LLM_KEY")
        if not api_key:
            raise HTTPException(status_code=500, detail="AI service not configured")
        
        # Build conversation history for context
        history_text = "\n".join([
            f"{'User' if m['role'] == 'user' else 'Assistant'}: {m['content']}"
            for m in conversation["messages"][-6:]  # Last 6 messages for context
        ])
        
        # Get fresh context
        context_data = await get_context_for_type(
            conversation["context_type"],
            prompt_request.context_data
        )
        
        system_prompt = SYSTEM_PROMPTS.get(conversation["context_type"], SYSTEM_PROMPTS["general"])
        full_system_message = f"""{system_prompt}

CURRENT USER: {user.get('name', 'Unknown')} ({user.get('role', 'user')})

CONVERSATION HISTORY:
{history_text}

CURRENT DATA:
{context_data}"""

        # Initialize chat
        chat = LlmChat(
            api_key=api_key,
            session_id=conversation_id,
            system_message=full_system_message
        ).with_model("anthropic", "claude-sonnet-4-5-20250929")
        
        user_message = UserMessage(text=prompt_request.prompt)
        response = await chat.send_message(user_message)
        
        # Update conversation
        now = datetime.now(timezone.utc)
        await db.ai_conversations.update_one(
            {"conversation_id": conversation_id},
            {
                "$push": {
                    "messages": {
                        "$each": [
                            {"role": "user", "content": prompt_request.prompt, "timestamp": now.isoformat()},
                            {"role": "assistant", "content": response, "timestamp": now.isoformat()}
                        ]
                    }
                },
                "$set": {"updated_at": now}
            }
        )
        
        return {
            "response": response,
            "conversation_id": conversation_id,
            "context_type": conversation["context_type"]
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI error: {str(e)}")

@ai_router.get("/conversations")
async def get_conversations(request: Request, limit: int = 20):
    """Get user's conversation history"""
    user = await get_current_user(request)
    
    conversations = await db.ai_conversations.find(
        {"user_id": user["user_id"]},
        {"_id": 0, "conversation_id": 1, "context_type": 1, "created_at": 1, "updated_at": 1, "messages": {"$slice": 2}}
    ).sort("updated_at", -1).limit(limit).to_list(limit)
    
    return conversations

@ai_router.get("/conversations/{conversation_id}")
async def get_conversation(request: Request, conversation_id: str):
    """Get a specific conversation"""
    user = await get_current_user(request)
    
    conversation = await db.ai_conversations.find_one(
        {"conversation_id": conversation_id, "user_id": user["user_id"]},
        {"_id": 0}
    )
    
    if not conversation:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return conversation

@ai_router.delete("/conversations/{conversation_id}")
async def delete_conversation(request: Request, conversation_id: str):
    """Delete a conversation"""
    user = await get_current_user(request)
    
    result = await db.ai_conversations.delete_one(
        {"conversation_id": conversation_id, "user_id": user["user_id"]}
    )
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Conversation not found")
    
    return {"message": "Conversation deleted"}

# ============== QUICK ACTIONS ==============

@ai_router.post("/quick/lead-summary")
async def quick_lead_summary(request: Request, lead_id: str):
    """Quick action: Get AI summary of a lead"""
    user = await get_current_user(request)
    
    lead = await db.leads.find_one({"lead_id": lead_id, "is_deleted": False}, {"_id": 0})
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")
    
    # Get status name
    status = await db.statuses.find_one({"status_id": lead.get("status_id")}, {"_id": 0})
    status_name = status.get("name", "Unknown") if status else "Unknown"
    
    prompt = f"""Analyze this lead and provide:
1. A brief summary (2-3 sentences)
2. Deal temperature (Hot/Warm/Cold) with reasoning
3. Recommended next action
4. Any risks or concerns

Lead Details:
- Name: {lead.get('name', 'N/A')}
- Business: {lead.get('business_name', 'N/A')}
- Status: {status_name}
- Service Cost: ₹{lead.get('service_cost', 0)}
- Discussion Notes: {lead.get('discussion_notes', 'None')}
- Expected Closing: {lead.get('expected_closing_date', 'Not set')}"""

    return await chat_with_ai(request, AIPromptRequest(
        prompt=prompt,
        context_type="sales",
        context_data={"lead_id": lead_id}
    ))

@ai_router.post("/quick/follow-up-suggestions")
async def quick_follow_up_suggestions(request: Request):
    """Quick action: Get leads needing follow-up today"""
    prompt = """Based on the lead data, identify:
1. Which leads need follow-up TODAY (urgent)
2. Which leads are at risk of going cold
3. Top 3 highest priority leads to focus on

For each, provide a specific action recommendation."""

    return await chat_with_ai(request, AIPromptRequest(
        prompt=prompt,
        context_type="sales"
    ))

@ai_router.post("/quick/project-analysis")
async def quick_project_analysis(request: Request, project_id: Optional[str] = None):
    """Quick action: Analyze project status"""
    if project_id:
        prompt = f"""Analyze the project with ID {project_id} and provide:
1. Current status summary
2. Any delays or risks
3. Task prioritization suggestions
4. Team workload assessment"""
    else:
        prompt = """Provide an overview of all projects:
1. Which projects are on track vs at risk
2. Common bottlenecks across projects
3. Resource allocation suggestions
4. Priority recommendations"""

    return await chat_with_ai(request, AIPromptRequest(
        prompt=prompt,
        context_type="operations",
        context_data={"project_id": project_id} if project_id else None
    ))

@ai_router.post("/quick/task-breakdown")
async def quick_task_breakdown(request: Request, service_type: str):
    """Quick action: Generate task checklist for a service"""
    prompt = f"""Create a detailed task breakdown/checklist for a "{service_type}" project.

Include:
1. All major phases
2. Specific tasks under each phase
3. Estimated effort (hours) for each task
4. Dependencies between tasks
5. Common pitfalls to avoid

Format as a structured checklist that can be used directly."""

    return await chat_with_ai(request, AIPromptRequest(
        prompt=prompt,
        context_type="operations"
    ))

# ============== SUGGESTED PROMPTS ==============

@ai_router.get("/suggested-prompts/{context_type}")
async def get_suggested_prompts(context_type: str):
    """Get suggested prompts for a context type"""
    prompts = {
        "general": [
            "Give me a quick overview of business health",
            "What should I focus on today?",
            "Summarize recent activity across all modules"
        ],
        "sales": [
            "Which leads need follow-up today?",
            "Analyze my pipeline and identify risks",
            "Which deals are most likely to close this week?",
            "Draft a follow-up message for cold leads",
            "Why are leads getting stuck?"
        ],
        "operations": [
            "Which projects are at risk of delay?",
            "Who is overloaded this week?",
            "Create a task checklist for a new project",
            "Identify workflow bottlenecks",
            "Suggest task prioritization for today"
        ],
        "marketing": [
            "Generate content ideas for Instagram",
            "Summarize marketing performance this month",
            "Create a content calendar for next week",
            "Which posts performed best recently?",
            "Repurpose this blog into social posts"
        ],
        "finance": [
            "Which invoices are overdue?",
            "Summarize revenue this month",
            "Draft a payment reminder email",
            "Identify cash flow risks",
            "Explain GST obligations simply"
        ]
    }
    
    return prompts.get(context_type, prompts["general"])
