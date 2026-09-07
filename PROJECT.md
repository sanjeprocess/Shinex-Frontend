# Shinex HRIS Frontend

This document describes the Shinex Human Resources Information System (HRIS)
frontend application.

## Overview

The frontend is a React 18 single-page application built with Vite and
TypeScript. It provides the user interface for:

- Employee management
- Attendance and leave management
- Employee additions, deductions, loans, and payroll-related workflows
- Master data administration
- Reports and employee history
- Audit logging

The application currently uses local mock data for most services. The Axios
client is prepared for communication with the backend API.

## Technology stack

- React 18 and React DOM
- TypeScript
- Vite
- React Router DOM
- TanStack React Query
- TanStack React Table
- Axios
- Tailwind CSS
- React Hook Form and Zod
- Recharts
- Sonner notifications
- Lucide React icons
- date-fns and dayjs
- react-dropzone
- uuid

## Requirements

- Node.js 18 or newer
- npm
- Shinex backend running on `http://localhost:8080` when using the local
  development proxy

## Installation

From the `Frontend` directory:

```bash
npm install
```

## Available commands

```bash
# Start the Vite development server
npm run dev

# Create a production build
npm run build

# Preview the production build locally
npm run preview
```

The development server uses port `5173` and listens on all network
interfaces.

## Environment configuration

### Development

`Frontend/.env.development` contains:

```env
VITE_API_URL=/api
```

Vite proxies `/api` requests to `http://localhost:8080`.

### Production

`Frontend/.env.production` contains:

```env
VITE_API_URL=/api
```

The production deployment expects `/api` to be routed to the backend by the
hosting platform, such as an Amplify rewrite/proxy.

Do not commit passwords, private keys, or access tokens to environment files.

## Application startup

The entry point is [`src/main.tsx`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/main.tsx).
It initializes:

1. React strict mode
2. TanStack Query provider
3. Browser routing
4. Global styles from `src/index.css`

The shared query client is defined in
[`src/lib/queryClient.ts`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/lib/queryClient.ts).

## Project structure

```text
Frontend/
├── index.html
├── package.json
├── vite.config.ts
├── tailwind.config.cjs
├── postcss.config.cjs
├── tsconfig.json
├── .env.development
├── .env.production
└── src/
    ├── api/          Axios API client and interceptors
    ├── components/   Reusable UI components and layout components
    ├── layouts/      Application shell layouts
    ├── lib/          Shared libraries and providers
    ├── mocks/        In-memory mock data and mock CRUD functions
    ├── pages/        Route-level screens
    ├── routes/       React Router configuration
    ├── services/     Domain service functions
    ├── types/        TypeScript domain types
    └── utils/        Validation and audit utilities
```

## Routes

Public route:

- `/login` - Login screen

Protected routes:

- `/` - Dashboard
- `/employees` - Employee list and employee management
- `/attendance` - Attendance
- `/employee-additions` - Employee additions
- `/employee-deductions` - Employee deductions
- `/leaves` - Leave management
- `/loans` - Loan management
- `/reports` - General reports
- `/employee-history` - Employee history dossier
- `/audit-logs` - Audit log
- `/business-centers` - Business center master data
- `/sections` - Employee section master data
- `/additions` - Addition type master data
- `/deductions` - Deduction type master data
- `/customers` - Customer and plant master data

Routes are configured in
[`src/routes/AppRouter.tsx`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/routes/AppRouter.tsx).

The navigation menu also contains a Payroll Run link at `/payroll`; a
corresponding route page is not currently registered in the router.

## Authentication

`ProtectedRoute` currently uses test-mode local storage authentication. A user
is considered authenticated when `hsb_test_auth` exists in `localStorage`.

The login and shell use these storage keys:

- `hsb_test_auth` - Test authentication flag
- `hsb_test_user` - Display name for the test user
- `hsb_active_bc` - Selected business center
- `hsb_auth_token`, `token`, or `jwt` - Candidate API token keys

This is a temporary client-side mechanism and must be replaced or connected to
the backend authentication flow before production use.

## API client

The shared Axios client is in
[`src/api/axios.ts`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/api/axios.ts).
It:

- Uses `VITE_API_URL` as its base URL
- Falls back to `http://localhost:8080/api` in Vite development mode
- Falls back to `/api` for hosted production use
- Applies a 10-second request timeout
- Attaches a stored bearer token when available
- Shows user-facing notifications for network, client, and server errors

## Data and services

Most current screens use mock modules under
[`src/mocks`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/mocks).
Mock modules cover employees, attendance, business centers, customers,
deductions, additions, leave types, leaves, loans, sections, and transaction
data.

Domain access should be kept behind service modules. For example,
[`src/services/employeeService.ts`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/services/employeeService.ts)
provides employee list, lookup, create, update, and delete operations and
records audit events.

When backend integration is completed, replace mock implementations inside
services rather than coupling page components directly to Axios calls.

## Shared UI

Reusable components are located in
[`src/components`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/components),
including:

- Application layout, header, sidebar, and top menu
- Data table
- Modal and slide-over panels
- Confirmation dialog
- Search input and employee selector
- Toggle controls
- Shinex logo

The main authenticated shell is implemented by
[`src/components/Layout/Layout.tsx`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/components/Layout/Layout.tsx).

## Styling

Tailwind CSS is configured in
[`tailwind.config.cjs`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/tailwind.config.cjs).
Global styles are in
[`src/index.css`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/index.css).

The interface uses the Shinex green palette together with neutral light
backgrounds and dark navigation surfaces.

## Validation and audit logging

Reusable field validators are in
[`src/utils/validators.ts`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/utils/validators.ts).
They cover names, text fields, and numeric fields.

Audit events are handled by
[`src/utils/auditLogger.ts`](C:/Users/TharinduChathuranga/Desktop/Shinex/Frontend/src/utils/auditLogger.ts).
Create, update, and delete operations should record an audit event where
appropriate.

## Development guidelines

- Keep route-level UI in `src/pages`.
- Keep reusable UI in `src/components`.
- Keep backend or mock access in `src/services`.
- Define shared domain contracts in `src/types`.
- Use existing validators and notification patterns.
- Avoid putting credentials or sensitive data in source control.
- Run `npm run build` before opening a pull request.

## Deployment

Build the application with:

```bash
npm run build
```

The generated static assets are written to `Frontend/dist`. Deploy that
directory to the static hosting provider and configure an `/api` rewrite to
the Shinex backend. Configure the host to serve `index.html` as the fallback
for client-side routes.

## Frontend relationships and data flow

The frontend relationship is layered:

```text
src/main.tsx
  └── QueryClientProvider
      └── BrowserRouter
          └── AppRouter
              ├── /login -> Login
              └── ProtectedRoute
                  └── Layout
                      ├── Header + ShinexLogo + profile/business center controls
                      ├── TopMenuBar -> route links
                      └── Outlet -> active page component
```

### Relationship rules

| Layer | Depends on | Responsibility |
| --- | --- | --- |
| `main.tsx` | React, Router, Query Client | Application bootstrap |
| `routes/` | Pages, layout, React Router | Maps URLs to screens and protects private routes |
| `components/` | Router and shared utilities | Reusable presentation and interaction |
| `pages/` | Components, mocks/services, utilities | Screen-specific UI and user workflows |
| `services/` | Types, mocks/API, audit utility | Domain operations and integration boundary |
| `mocks/` | Domain data/types | Current in-memory data source |
| `api/` | Axios, Sonner | Backend requests, auth headers, and global errors |
| `utils/` | Browser storage/API | Validation and audit behavior |
| `types/` | None or domain contracts | Shared TypeScript data shapes |

### Route relationships

- `AppRouter` renders `Login` outside the protected layout.
- All other registered pages render as children of `Layout` through
  React Router's `Outlet`.
- `TopMenuBar` links to master data, transactions, processing, and reporting
  pages.
- `Layout` and `TopMenuBar` both read business center mock data and use
  `hsb_active_bc` to preserve the selected center.
- The `/payroll` menu link currently has no matching route component.

### Page-to-data relationships

| Page area | Main related data |
| --- | --- |
| Dashboard | Employees, attendance, leaves, sections, and loans |
| Employees | Employee type and employee service/mock operations |
| Attendance | Attendance records and employee references |
| Employee additions | Transaction additions, addition types, and employees |
| Employee deductions | Transaction deductions, deduction types, and employees |
| Leaves | Leave records, leave types, and employees |
| Loans | Loan records and employees |
| Business centers | Business center master data |
| Sections | Section master data and employee section codes |
| Additions | Addition type master data |
| Deductions | Deduction type master data |
| Customers | Customer/plant master data |
| Reports and employee history | Employee and transaction-related records |
| Audit logs | `auditLogger`, local storage cache, and `/audit-logs` API |

### Dashboard data flow

`Dashboard` loads employees, attendance, leaves, sections, and loans from their
mock modules when the page mounts. It derives:

- Total employees from the employee list
- Present-today count from attendance dates
- Monthly leave count from leave start dates
- Active loan count from loan records
- Employees-by-section by matching `employee.sectionCode` to `section.code`
- Recent activity from attendance and leave records
- Upcoming leaves from future leave dates

The derived section data is passed to Recharts for the bar chart. Dashboard
data is independent page state and is not currently cached through React Query.

### Employee service relationship

```text
Employees page
  -> employeeService
      -> mocks/employees
      -> types/employee
      -> utils/auditLogger
          -> localStorage cache
          -> api/axios -> POST /audit-logs
```

The employee service is the preferred boundary for replacing mock CRUD
operations with backend calls. Create, update, and delete operations also
produce audit records.

### API request flow

```text
Page/service
  -> api/axios
      -> base URL from VITE_API_URL
      -> request interceptor adds Bearer token
      -> backend /api endpoint
      -> response interceptor displays Sonner error notification
```

The API client is available for backend integration, while most current
features still call mock modules directly. New backend-backed features should
prefer a service module so pages remain independent of transport details.

### Shared state and browser storage

- React component state controls menus, dialogs, selected records, and form
  values.
- React Router controls the current page and protected navigation.
- TanStack Query is initialized globally but is not yet the primary data
  source for the current mock-based screens.
- `localStorage` stores test authentication, test user information, selected
  business center, and a capped local audit-log cache.
- `sessionStorage` is checked as a fallback location for an auth token.

### Cross-cutting relationships

- `Sonner` is mounted by `Layout` and receives errors from the Axios
  interceptor and page-level actions.
- `validators.ts` is shared by forms that need name, text, or number validation.
- `auditLogger.ts` connects mutation workflows to both local audit history and
  the backend audit endpoint.
- `SearchableEmployeeSelect` connects employee-based transaction forms to the
  shared employee data shape.
- Tailwind classes are used by pages and components, with global behavior and
  custom utilities defined in `src/index.css`.
