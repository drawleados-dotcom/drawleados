# Test Credentials

## Super Admin (CANONICAL — only one allowed system-wide)
- **Email:** vinoth@drawlead.com
- **Password:** Admin@123
- Role: super_admin
- ⚠️ This is the ONLY super_admin in the system. The backend enforces:
  - `/auth/admin-signup` refuses any other email and refuses to create a second super admin.
  - `POST /api/users` refuses `role: super_admin`.
  - `PUT /api/users/{id}` refuses upgrading any user to super_admin unless `email == vinoth@drawlead.com`.
- If the password is lost, use the in-app **Forgot Password** flow (verified working — OTP email + reset endpoint).

## Operations Head
- Email: ops-user@drawlead.com
- Password: ops123
- Role: admin (was super_admin earlier, demoted as part of the single-super-admin invariant)

## Demo Admin
- Email: demo@drawlead.com
- Password: demo123

## Google OAuth (separate flow)
- drawleados@gmail.com
