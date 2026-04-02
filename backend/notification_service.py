"""
Notification Service - Centralized email notifications for Drawlead OS
Sends emails to individual users based on their responsibilities
"""
import os
import asyncio
import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

# Email setup
try:
    import resend
    resend.api_key = os.environ.get("RESEND_API_KEY", "")
    SENDER_EMAIL = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    EMAIL_ENABLED = bool(resend.api_key and resend.api_key != "re_your_api_key_here")
except ImportError:
    EMAIL_ENABLED = False
    SENDER_EMAIL = ""

logger = logging.getLogger(__name__)

# Base URL for view buttons
APP_URL = os.environ.get("APP_URL", "https://drawlead-docs.preview.emergentagent.com")

# ============== EMAIL TEMPLATES ==============

def get_email_template(title: str, content: str, view_url: str, view_text: str = "View Details") -> str:
    """Generate HTML email template with View button"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Arial, sans-serif; background-color: #f4f4f5;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 30px; text-align: center;">
                                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 600;">
                                    Drawlead
                                </h1>
                                <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">
                                    Digital Transformation Company
                                </p>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 40px 30px;">
                                <h2 style="color: #18181b; margin: 0 0 20px 0; font-size: 20px; font-weight: 600;">
                                    {title}
                                </h2>
                                <div style="color: #52525b; font-size: 15px; line-height: 1.6;">
                                    {content}
                                </div>
                                <!-- View Button -->
                                <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 30px;">
                                    <tr>
                                        <td align="center">
                                            <a href="{view_url}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 14px;">
                                                {view_text}
                                            </a>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color: #18181b; padding: 25px 30px; text-align: center;">
                                <p style="color: #a1a1aa; margin: 0; font-size: 13px;">
                                    This is an automated notification from Drawlead OS
                                </p>
                                <p style="color: #71717a; margin: 10px 0 0 0; font-size: 12px;">
                                    EPK Business Centre, Anna Salai, Chennai, Tamil Nadu 600006
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

# ============== SEND EMAIL FUNCTION ==============

async def send_notification(
    to_emails: List[str],
    subject: str,
    title: str,
    content: str,
    view_url: str,
    view_text: str = "View Details"
) -> Dict[str, Any]:
    """Send notification email to multiple recipients"""
    
    if not EMAIL_ENABLED:
        logger.info(f"[MOCKED] Email to {to_emails}: {subject}")
        return {"status": "mocked", "message": "Email service not configured", "recipients": to_emails}
    
    html_content = get_email_template(title, content, view_url, view_text)
    
    results = []
    for email in to_emails:
        if not email:
            continue
        try:
            params = {
                "from": SENDER_EMAIL,
                "to": [email],
                "subject": f"[Drawlead] {subject}",
                "html": html_content
            }
            result = await asyncio.to_thread(resend.Emails.send, params)
            logger.info(f"Email sent to {email}: {subject}")
            results.append({"email": email, "status": "sent", "id": result.get("id")})
        except Exception as e:
            logger.error(f"Failed to send email to {email}: {str(e)}")
            results.append({"email": email, "status": "failed", "error": str(e)})
    
    return {"status": "completed", "results": results}

# ============== NOTIFICATION FUNCTIONS ==============

# --- LEAVE NOTIFICATIONS ---

async def notify_leave_request(
    requester_name: str,
    requester_email: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    reason: str,
    hr_admin_emails: List[str],
    leave_id: str
):
    """Notify HR Admin about new leave request"""
    content = f"""
    <p><strong>{requester_name}</strong> has submitted a leave request.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Type:</td><td style="padding: 8px 0; color: #18181b; font-weight: 500;">{leave_type.upper()}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">From:</td><td style="padding: 8px 0; color: #18181b;">{start_date}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">To:</td><td style="padding: 8px 0; color: #18181b;">{end_date}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Reason:</td><td style="padding: 8px 0; color: #18181b;">{reason}</td></tr>
    </table>
    <p style="color: #71717a;">Please review and take action.</p>
    """
    
    return await send_notification(
        to_emails=hr_admin_emails,
        subject=f"Leave Request from {requester_name}",
        title="New Leave Request",
        content=content,
        view_url=f"{APP_URL}/hr-admin?tab=leaves&id={leave_id}",
        view_text="Review Request"
    )

async def notify_leave_decision(
    employee_email: str,
    employee_name: str,
    leave_type: str,
    start_date: str,
    end_date: str,
    status: str,  # approved or rejected
    approved_by: str
):
    """Notify employee about leave decision"""
    status_color = "#10b981" if status == "approved" else "#ef4444"
    status_text = "Approved" if status == "approved" else "Rejected"
    
    content = f"""
    <p>Hi {employee_name},</p>
    <p>Your leave request has been <span style="color: {status_color}; font-weight: 600;">{status_text}</span>.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Type:</td><td style="padding: 8px 0; color: #18181b; font-weight: 500;">{leave_type.upper()}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Duration:</td><td style="padding: 8px 0; color: #18181b;">{start_date} to {end_date}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">{status_text} by:</td><td style="padding: 8px 0; color: #18181b;">{approved_by}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=[employee_email],
        subject=f"Leave Request {status_text}",
        title=f"Leave Request {status_text}",
        content=content,
        view_url=f"{APP_URL}/hr?tab=leave",
        view_text="View My Leaves"
    )

# --- PERMISSION NOTIFICATIONS ---

async def notify_permission_request(
    requester_name: str,
    date: str,
    hours: float,
    reason: str,
    hr_admin_emails: List[str],
    permission_id: str
):
    """Notify HR Admin about permission request"""
    content = f"""
    <p><strong>{requester_name}</strong> has requested permission.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Date:</td><td style="padding: 8px 0; color: #18181b;">{date}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Hours:</td><td style="padding: 8px 0; color: #18181b; font-weight: 500;">{hours} hours</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Reason:</td><td style="padding: 8px 0; color: #18181b;">{reason}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=hr_admin_emails,
        subject=f"Permission Request from {requester_name}",
        title="New Permission Request",
        content=content,
        view_url=f"{APP_URL}/hr-admin?tab=approvals&id={permission_id}",
        view_text="Review Request"
    )

async def notify_permission_decision(
    employee_email: str,
    employee_name: str,
    date: str,
    hours: float,
    status: str,
    approved_by: str
):
    """Notify employee about permission decision"""
    status_color = "#10b981" if status == "approved" else "#ef4444"
    status_text = "Approved" if status == "approved" else "Rejected"
    
    content = f"""
    <p>Hi {employee_name},</p>
    <p>Your permission request has been <span style="color: {status_color}; font-weight: 600;">{status_text}</span>.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Date:</td><td style="padding: 8px 0; color: #18181b;">{date}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Hours:</td><td style="padding: 8px 0; color: #18181b;">{hours} hours</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">{status_text} by:</td><td style="padding: 8px 0; color: #18181b;">{approved_by}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=[employee_email],
        subject=f"Permission Request {status_text}",
        title=f"Permission {status_text}",
        content=content,
        view_url=f"{APP_URL}/hr?tab=attendance",
        view_text="View Attendance"
    )

# --- ATTENDANCE NOTIFICATIONS ---

async def notify_attendance_approval_needed(
    employee_name: str,
    date: str,
    approval_type: str,  # early_login or early_logout
    hr_admin_emails: List[str],
    attendance_id: str
):
    """Notify HR Admin about attendance needing approval"""
    type_text = "Early Login" if approval_type == "early_login" else "Early Logout"
    
    content = f"""
    <p><strong>{employee_name}</strong> has an attendance record that needs your approval.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Date:</td><td style="padding: 8px 0; color: #18181b;">{date}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Type:</td><td style="padding: 8px 0; color: #f59e0b; font-weight: 500;">{type_text}</td></tr>
    </table>
    <p style="color: #71717a;">Please review and approve/reject.</p>
    """
    
    return await send_notification(
        to_emails=hr_admin_emails,
        subject=f"Attendance Approval Required - {employee_name}",
        title="Attendance Approval Needed",
        content=content,
        view_url=f"{APP_URL}/hr-admin?tab=approvals&id={attendance_id}",
        view_text="Review Attendance"
    )

# --- TASK NOTIFICATIONS ---

async def notify_task_assigned(
    assignee_email: str,
    assignee_name: str,
    task_name: str,
    assigned_by: str,
    department: str,
    priority: str,
    due_date: str,
    database_id: str,
    row_id: str
):
    """Notify employee about task assignment"""
    priority_colors = {"Low": "#71717a", "Medium": "#f59e0b", "High": "#ef4444", "Urgent": "#dc2626"}
    priority_color = priority_colors.get(priority, "#71717a")
    
    content = f"""
    <p>Hi {assignee_name},</p>
    <p>A new task has been assigned to you by <strong>{assigned_by}</strong>.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Task:</td><td style="padding: 8px 0; color: #18181b; font-weight: 600;">{task_name}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Department:</td><td style="padding: 8px 0; color: #18181b;">{department}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Priority:</td><td style="padding: 8px 0; color: {priority_color}; font-weight: 500;">{priority}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Due Date:</td><td style="padding: 8px 0; color: #18181b;">{due_date}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=[assignee_email],
        subject=f"New Task Assigned: {task_name}",
        title="New Task Assigned",
        content=content,
        view_url=f"{APP_URL}/operations?db={database_id}&row={row_id}",
        view_text="View Task"
    )

async def notify_task_comment(
    recipient_emails: List[str],
    task_name: str,
    commenter_name: str,
    comment: str,
    database_id: str,
    row_id: str
):
    """Notify about new comment on task"""
    content = f"""
    <p><strong>{commenter_name}</strong> commented on task <strong>{task_name}</strong>:</p>
    <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #6366f1;">
        <p style="color: #18181b; margin: 0; font-style: italic;">"{comment}"</p>
    </div>
    """
    
    return await send_notification(
        to_emails=recipient_emails,
        subject=f"New Comment on: {task_name}",
        title="New Comment",
        content=content,
        view_url=f"{APP_URL}/operations?db={database_id}&row={row_id}",
        view_text="View Task"
    )

async def notify_task_status_change(
    recipient_emails: List[str],
    task_name: str,
    old_status: str,
    new_status: str,
    changed_by: str,
    database_id: str,
    row_id: str
):
    """Notify about task status change (approval workflow)"""
    content = f"""
    <p>Task status has been updated by <strong>{changed_by}</strong>.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Task:</td><td style="padding: 8px 0; color: #18181b; font-weight: 600;">{task_name}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Previous Status:</td><td style="padding: 8px 0; color: #71717a;">{old_status}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">New Status:</td><td style="padding: 8px 0; color: #10b981; font-weight: 500;">{new_status}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=recipient_emails,
        subject=f"Task Status Updated: {task_name}",
        title="Task Status Changed",
        content=content,
        view_url=f"{APP_URL}/operations?db={database_id}&row={row_id}",
        view_text="View Task"
    )

# --- LEAD NOTIFICATIONS ---

async def notify_lead_assigned(
    assignee_email: str,
    assignee_name: str,
    lead_name: str,
    company: str,
    assigned_by: str,
    lead_id: str
):
    """Notify about lead assignment"""
    content = f"""
    <p>Hi {assignee_name},</p>
    <p>A new lead has been assigned to you by <strong>{assigned_by}</strong>.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Lead Name:</td><td style="padding: 8px 0; color: #18181b; font-weight: 600;">{lead_name}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Company:</td><td style="padding: 8px 0; color: #18181b;">{company}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=[assignee_email],
        subject=f"New Lead Assigned: {lead_name}",
        title="New Lead Assigned",
        content=content,
        view_url=f"{APP_URL}/leads?id={lead_id}",
        view_text="View Lead"
    )

async def notify_lead_closed(
    recipient_emails: List[str],
    lead_name: str,
    company: str,
    closed_by: str,
    deal_value: str,
    lead_id: str
):
    """Notify about deal/lead closed"""
    content = f"""
    <p>A deal has been closed by <strong>{closed_by}</strong>.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Lead:</td><td style="padding: 8px 0; color: #18181b; font-weight: 600;">{lead_name}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Company:</td><td style="padding: 8px 0; color: #18181b;">{company}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Deal Value:</td><td style="padding: 8px 0; color: #10b981; font-weight: 600;">{deal_value}</td></tr>
    </table>
    """
    
    return await send_notification(
        to_emails=recipient_emails,
        subject=f"Deal Closed: {lead_name}",
        title="Deal Closed!",
        content=content,
        view_url=f"{APP_URL}/leads?id={lead_id}",
        view_text="View Lead"
    )

async def notify_lead_remark(
    recipient_emails: List[str],
    lead_name: str,
    remark_by: str,
    remark: str,
    lead_id: str
):
    """Notify about new remark on lead"""
    content = f"""
    <p><strong>{remark_by}</strong> added a remark on lead <strong>{lead_name}</strong>:</p>
    <div style="background-color: #f4f4f5; padding: 15px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #10b981;">
        <p style="color: #18181b; margin: 0;">"{remark}"</p>
    </div>
    """
    
    return await send_notification(
        to_emails=recipient_emails,
        subject=f"New Remark on Lead: {lead_name}",
        title="New Lead Remark",
        content=content,
        view_url=f"{APP_URL}/leads?id={lead_id}",
        view_text="View Lead"
    )

# --- PAYSLIP NOTIFICATIONS ---

async def notify_payslip_ready(
    employee_email: str,
    employee_name: str,
    month: str,
    year: int,
    net_salary: str,
    payslip_id: str
):
    """Notify employee about payslip ready for acknowledgment"""
    content = f"""
    <p>Hi {employee_name},</p>
    <p>Your payslip for <strong>{month} {year}</strong> is ready for review.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Period:</td><td style="padding: 8px 0; color: #18181b;">{month} {year}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Net Salary:</td><td style="padding: 8px 0; color: #10b981; font-weight: 600;">{net_salary}</td></tr>
    </table>
    <p style="color: #71717a;">Please review and acknowledge your payslip.</p>
    """
    
    return await send_notification(
        to_emails=[employee_email],
        subject=f"Payslip Ready - {month} {year}",
        title="Payslip Ready",
        content=content,
        view_url=f"{APP_URL}/hr?tab=payslips&id={payslip_id}",
        view_text="View & Acknowledge"
    )

async def notify_payslip_acknowledged(
    hr_finance_emails: List[str],
    employee_name: str,
    month: str,
    year: int,
    payslip_id: str
):
    """Notify HR/Finance about payslip acknowledgment"""
    content = f"""
    <p><strong>{employee_name}</strong> has acknowledged their payslip for <strong>{month} {year}</strong>.</p>
    <p style="color: #71717a; margin-top: 20px;">The payslip is now ready for payment processing.</p>
    """
    
    return await send_notification(
        to_emails=hr_finance_emails,
        subject=f"Payslip Acknowledged - {employee_name}",
        title="Payslip Acknowledged",
        content=content,
        view_url=f"{APP_URL}/hr-admin?tab=payslips&id={payslip_id}",
        view_text="Process Payment"
    )

async def notify_payment_released(
    employee_email: str,
    employee_name: str,
    month: str,
    year: int,
    net_salary: str,
    payslip_id: str
):
    """Notify employee about payment release"""
    content = f"""
    <p>Hi {employee_name},</p>
    <p>Your salary for <strong>{month} {year}</strong> has been credited.</p>
    <table style="margin: 20px 0; border-collapse: collapse;">
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Period:</td><td style="padding: 8px 0; color: #18181b;">{month} {year}</td></tr>
        <tr><td style="padding: 8px 15px 8px 0; color: #71717a;">Amount:</td><td style="padding: 8px 0; color: #10b981; font-weight: 600;">{net_salary}</td></tr>
    </table>
    <p style="color: #71717a;">You can now download your payslip from the HR portal.</p>
    """
    
    return await send_notification(
        to_emails=[employee_email],
        subject=f"Salary Credited - {month} {year}",
        title="Salary Credited",
        content=content,
        view_url=f"{APP_URL}/hr?tab=payslips&id={payslip_id}",
        view_text="Download Payslip"
    )

# --- HELPER FUNCTIONS ---

async def get_hr_admin_emails(db) -> List[str]:
    """Get all HR admin/manager emails"""
    hr_users = await db.users.find(
        {"role": {"$in": ["super_admin", "admin", "hr_manager"]}},
        {"_id": 0, "email": 1}
    ).to_list(50)
    return [u["email"] for u in hr_users if u.get("email")]

async def get_finance_emails(db) -> List[str]:
    """Get all finance team emails"""
    finance_users = await db.users.find(
        {"role": {"$in": ["super_admin", "admin", "finance"]}},
        {"_id": 0, "email": 1}
    ).to_list(50)
    return [u["email"] for u in finance_users if u.get("email")]

async def get_user_email_by_id(db, user_id: str) -> Optional[str]:
    """Get user email by user_id"""
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "email": 1})
    return user.get("email") if user else None
