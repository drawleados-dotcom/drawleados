"""
Centralised RBAC predicates.

The app has two layers of access control that have drifted apart over time:

1. `role` — a single coarse field on the user (super_admin / admin / hr_manager / ...).
2. `module_access` — a list set on the user (often from their designation), e.g.
   `['hr_admin', 'finance', 'operations']`. This is what the frontend uses to
   show / hide menus.

A bunch of backend endpoints historically only checked `role`, which means when
you grant a regular employee module access via their designation (the documented
workflow), the menu opens but every API still 403s — producing empty screens.

These helpers let endpoints honour BOTH layers consistently. Each predicate
returns True if the user has the relevant access by *either* mechanism.
"""
from typing import Any


# Privileged roles that ALWAYS bypass module-level checks.
ADMIN_ROLES = {"admin", "super_admin"}


def _role(user: Any) -> str:
    return getattr(user, "role", None) or (user.get("role") if isinstance(user, dict) else "") or ""


def _modules(user: Any) -> list:
    m = getattr(user, "module_access", None)
    if m is None and isinstance(user, dict):
        m = user.get("module_access")
    return m or []


def is_admin(user: Any) -> bool:
    return _role(user) in ADMIN_ROLES


def has_module(user: Any, *module_names: str) -> bool:
    """True if the user has ANY of the listed modules in module_access."""
    mods = set(_modules(user))
    return any(m in mods for m in module_names)


def has_hr_access(user: Any) -> bool:
    """Manage HR / Payroll / Reviews / WFH / Attendance for everyone."""
    if is_admin(user) or _role(user) in ("hr_manager",):
        return True
    return has_module(user, "hr_admin", "hr_manager")


def has_operations_access(user: Any) -> bool:
    """Manage Operations / Projects / Tasks across the org."""
    if is_admin(user) or _role(user) in ("project_manager", "operations_admin"):
        return True
    return has_module(user, "operations", "our_tasks")


def has_finance_access(user: Any) -> bool:
    """Manage Finance: invoices, banks, cashbook, expense split."""
    if is_admin(user) or _role(user) in ("finance",):
        return True
    return has_module(user, "finance")


def has_settings_access(user: Any) -> bool:
    """Manage Settings: designations, departments, menu order, integrations."""
    if is_admin(user):
        return True
    return has_module(user, "settings")


def has_leads_access(user: Any) -> bool:
    if is_admin(user) or _role(user) in ("bde", "business_development"):
        return True
    return has_module(user, "leads")
