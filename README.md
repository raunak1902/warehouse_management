# EDSignage Inventory Management System

A modern inventory/warehouse management tool with role-based access control (RBAC) built with React, Vite, and Tailwind CSS.

## Features

### Phase 1 - Current Implementation

- **Authentication System**
  - Login page with role-based access
  - Session management using localStorage

- **User Management**
  - Create, read, update, and delete users
  - Assign roles to users (SuperAdmin, Admin, Team)
  - User status management (Active/Inactive)
  - Search and filter functionality

- **Role Management**
  - Create and manage user roles
  - View role statistics (permissions count, user count)
  - Role descriptions and metadata

- **Permission Management**
  - Create and manage system permissions
  - Module-based organization (Users, Inventory, Roles, Reports, etc.)
  - CRUD operation tracking (Create, Read, Update, Delete, All)
  - Search and filter by module

- **Assign Permissions**
  - Assign permissions to roles
  - Visual permission assignment interface
  - Bulk permission management
  - Real-time permission count tracking

- **Dashboard**
  - Overview statistics
  - Recent activities
  - Quick action buttons
  - Role-based content display

## Tech Stack

- **Frontend**: React 18 + Vite
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Routing**: React Router DOM v6
- **Backend** (Planned): Node.js + Express
- **Database** (Planned): PostgreSQL

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Start the development server:
```bash
npm run dev
```

3. Open your browser and navigate to `http://localhost:3000`

### Demo Login

For the UI demo, you can use any email and password to login. The system will automatically assign you the SuperAdmin role.

## Project Structure

```
edsignage-inventory/
├── src/
│   ├── components/
│   │   └── Layout.jsx          # Main layout with sidebar navigation
│   ├── pages/
│   │   ├── Login.jsx           # Login page
│   │   ├── Dashboard.jsx       # Main dashboard
│   │   ├── UserManagement.jsx  # User CRUD operations
│   │   ├── RoleManagement.jsx  # Role management
│   │   ├── PermissionManagement.jsx  # Permission management
│   │   └── AssignPermission.jsx      # Assign permissions to roles
│   ├── App.jsx                 # Main app component with routing
│   ├── main.jsx                # Entry point
│   └── index.css               # Global styles
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
└── postcss.config.js
```

## Role Hierarchy

1. **SuperAdmin**
   - Full access to all features
   - Can manage users, roles, and permissions
   - Cannot be restricted

2. **Admin**
   - Administrative access
   - Can manage users, roles, and permissions
   - Limited compared to SuperAdmin (to be defined)

3. **Team**
   - Limited access
   - Specific permissions to be assigned by SuperAdmin/Admin
   - Cannot access management features

## Future Modules (Planned)

- Inventory Management
- Warehouse Management
- Stock Tracking
- Reports & Analytics
- Audit Logs
- Notifications

## Development Notes

- This is currently a **UI-only implementation**
- All data is stored in component state (will be replaced with API calls)
- Authentication is simulated using localStorage
- Backend integration will be added in the next phase

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## License

Proprietary - EDSignage
