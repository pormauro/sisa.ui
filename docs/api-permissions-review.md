# API Permissions Review

This document records a review of the provided Slim route definitions to ensure permissions are consistently enforced. Each route is evaluated for the presence of `PermissionsMiddleware` alongside `CheckUserBlockedMiddleware`, with observations about potential gaps.

## Public routes
The following routes are intentionally public and do not require bearer tokens or permission checks because they are part of the authentication flow:

- `POST /register`
- `POST /login`
- `POST /forgot_password`
- `POST /reset_password`

`POST /token/refresh` remains protected by `CheckUserBlockedMiddleware` and returns a refreshed bearer token when appropriate.

## Routes missing permission checks
The routes below are protected by `CheckUserBlockedMiddleware` but **do not** currently apply `PermissionsMiddleware`. If these endpoints should be limited by role-based permissions, consider adding the corresponding permission keys.

- `GET /profile` (permission hint in code is commented out: `getProfile`).
- `PUT /user_profile` and `DELETE /user_profile` (no permission specified; related routes use `addUserProfile`, `getUserProfile`, `listUserProfiles`).
- `PUT /user_configurations` and `DELETE /user_configurations` (creation and fetching use `addUserConfigurations` and `getUserConfigurations`).

## General observations
- Most entity routes consistently apply both `PermissionsMiddleware` and `CheckUserBlockedMiddleware`.
- Membership-related company routes sometimes chain multiple permissions (e.g., `reactivateCompanyMember` plus `manageCompanyMemberships`), which matches the provided definitions.
- The catch-all `/{routes:.+}` route correctly returns a JSON `404` response.

Adding the missing `PermissionsMiddleware` instances above would make the permission strategy consistent across endpoints.
