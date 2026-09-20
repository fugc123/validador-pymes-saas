# Feature: Self-Service Free Trial Auto-Provisioning & Login Mock Data Cleanup

## Objective
1. Eliminate all automatic prefill of demo credentials (ranco@kiosko.com / password123) and remove fake user fallbacks in the login screen.
2. Enable full self-service 7-day free trial registration: require users to define their password during signup, automatically provision their store, owner account, and 7-day trial immediately so they can log in and use the system right away.
3. Remove all remaining fake/mock users and store references across the entire codebase and frontend views.

## Scope
1. **Frontend Login Cleanup**:
   - LoginView.tsx: Initialize email and password to empty strings. Provide visible error feedback on failed login attempts.
   - AuthContext.tsx: Remove fallback demo credentials (usr-franco, 	enant-kiosko, etc.) that were triggered on network/auth failures.
2. **Backend Self-Service Free Trial Auto-Provisioning**:
   - SubmitMerchantRequestDto: Add required password field (min 6 characters).
   - SubmitMerchantRequestUseCase: Auto-provision the merchant on request: hash password, create User, create Merchant, create MerchantMembership (MERCHANT_OWNER), create 7-day Subscription (status: 'trial'), and record MerchantRequest as approved.
   - Update and add unit tests to verify instant trial provisioning.
3. **Public Registration UI**:
   - LandingPage.tsx: Add password field to the 7-day trial form; show immediate success and link to login.
   - PublicRegisterScreen.tsx: Add password field, connect form to POST /api/v1/onboarding/request, and navigate to login upon successful provisioning.
4. **Mock Data Eradication**:
   - OwnerDashboard.tsx: Remove hardcoded fallback kiosko-san-roque, remove static mock cashiers (carlos@kiosko.com, na@kiosko.com).
   - SuperAdminPanel.tsx: Clear default simulation state.
5. **Deployment & Live Verification**:
   - Rebuild backend and frontend, deploy to VPS 67.205.168.176, restart PM2, and verify live self-service registration and login.

## Tasks
- [x] **TASK-01**: Clean frontend login (LoginView.tsx & AuthContext.tsx) and remove demo user fallbacks. *(Commit: `c83c1f2`)*
- [x] **TASK-02**: Implement backend self-service trial auto-provisioning with password in SubmitMerchantRequestUseCase and update unit tests. *(Commit: `7d133cd`)*
- [x] **TASK-03**: Update public registration forms (LandingPage.tsx & PublicRegisterScreen.tsx) with password field and immediate activation flow. *(Commit: `063957f`)*
- [x] **TASK-04**: Clean up mock cashiers and fallback tenant references in OwnerDashboard.tsx and SuperAdminPanel.tsx. *(Commit: `784afc0`)*
- [ ] **TASK-05**: Run all unit tests, build locally, deploy to production VPS, and verify live trial signup and login.

## Verification Evidence
- Clean login view without prefilled inputs.
- Invalid login returns proper error message and does NOT log in as fake Franco.
- Registering via public landing creates an active trial user with chosen password immediately.
- User can immediately log in with their credentials and access OwnerDashboard with 7 days remaining.
- VPS production deployment updated and verified live.
