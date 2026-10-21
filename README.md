<div align="center">

![Wuwa Chisa](https://media1.tenor.com/m/nL04FAmlxUkAAAAC/wuwa-chisa.gif)

# 🏢 Bos Baut - Enterprise Application

[![Vue 3](https://img.shields.io/badge/Vue-3.x-4FC08D?style=for-the-badge&logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white)](https://vitejs.dev/)
[![TailwindCSS](https://img.shields.io/badge/Tailwind-3.x-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![Pinia](https://img.shields.io/badge/Pinia-2.x-F7D336?style=for-the-badge&logo=vue.js&logoColor=white)](https://pinia.vuejs.org/)

**Modern web application built with Vue 3, TypeScript, and Vite.**  
Full-featured ERP system with dynamic module generation & approval workflow.

[Getting Started](#-installation) • [Features](#-features) • [Documentation](#-documentation) • [Contributing](#-contributing)

</div>

---

## 📋 Table of Contents

- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Development](#development)
- [Project Structure](#project-structure)
- [Features](#features)
- [Scripts & Generators](#scripts--generators)
- [Tech Stack](#tech-stack)
- [IDE Setup](#ide-setup)

## 🔧 Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **pnpm** (v8 or higher) - Package manager

### Install pnpm

If you don't have pnpm installed, install it globally:

```bash
# Using npm
npm install -g pnpm

# Using PowerShell (Windows)
iwr https://get.pnpm.io/install.ps1 -useb | iex

# Verify installation
pnpm --version
```

## 🚀 Installation

### 1. Clone the Repository

```bash
git clone https://github.com/YutsuriHisekawa/mitravisualgroup.git
cd mitravisualgroup
```

### 2. Install Dependencies

```bash
pnpm install
```

This will install all required dependencies including:
- Vue 3
- TypeScript
- Vite
- TailwindCSS
- Shadcn-vue (UI Components)
- Vue Router
- Pinia (State Management)
- And more...

### 3. API Configuration

API Base URL is configured in `src/lib/api.ts`:

```typescript
const API_BASE_URL = 'https://server.qqltech.com:7129/api'
```

To change the API endpoint, edit this file directly.

## 💻 Development

### Start Development Server

```bash
pnpm dev
```

Application will run at: `http://localhost:5173`

### Build for Production

```bash
pnpm build
```

Build output will be in the `dist/` directory.

### Preview Production Build

```bash
pnpm preview
```

### Run Tests

```bash
pnpm test:unit
```

### Type Checking

```bash
pnpm type-check
```

### Lint Code

```bash
pnpm lint
```

## 📁 Project Structure

```
bosbaut/
├── public/                 # Static assets
├── src/
│   ├── assets/            # Images, fonts, etc.
│   ├── components/        # Reusable components
│   │   ├── ui/           # Shadcn-vue components
│   │   ├── button/       # Action buttons (Edit, Delete, etc.)
│   │   ├── dialog/       # Dialog components
│   │   ├── field/        # Form field components
│   │   ├── table/        # Table components
│   │   └── ...
│   ├── composables/       # Vue composables
│   ├── lib/              # Utility functions
│   │   ├── api.ts        # API client
│   │   └── utils.ts      # Helper functions
│   ├── plugins/          # Vue plugins
│   │   └── lucide.ts     # Icon system
│   ├── router/           # Vue Router configuration
│   │   └── index.ts
│   ├── stores/           # Pinia stores
│   │   ├── auth.ts       # Authentication store
│   │   └── counter.ts
│   ├── styles/           # Global styles
│   │   └── main.css      # TailwindCSS + custom styles
│   ├── views/            # Page components
│   │   ├── dashboard/
│   │   ├── login/
│   │   ├── notifikasi/
│   │   ├── setup/
│   │   │   ├── menu/     # Menu management
│   │   │   ├── m_general/
│   │   │   └── m_prefix/
│   │   └── ...
│   ├── App.vue           # Root component
│   └── main.ts           # Application entry point
├── add_route.ps1          # PowerShell script for module generation
├── ADD_ROUTE_README.md    # Module generator documentation
├── QUICK_START.md         # Quick reference guide
├── components.json        # Shadcn-vue configuration
├── tsconfig.json          # TypeScript configuration
├── vite.config.ts         # Vite configuration
├── tailwind.config.js     # TailwindCSS configuration
└── package.json           # Project dependencies

```

## ✨ Features

### Core Features

- 🔐 **Authentication System** - Login with JWT token & session management
- 📊 **Dashboard** - Overview with statistics & widgets
- 🔔 **Notification System** - Real-time approval notifications with Items & PR support
- 📋 **Dynamic Menu System** - Database-driven menu management
- 🎨 **Modern UI** - Built with Shadcn-vue components
- 📱 **Responsive Design** - Mobile-first responsive interface
- 🌓 **Sidebar Navigation** - Collapsible sidebar with search
- ♻️ **Refresh Menu** - Dynamic menu refresh without page reload

### Approval Workflow Features

- ✅ **Multi-level Approval** - Configurable approval hierarchy
- 📝 **REVISI Status** - Revision workflow with required approval message
- 🔒 **Status Lock** - APPROVED/REJECT data protection (readonly)
- 📨 **Auto Send Approval** - Automatic approval submission after REVISI save
- 🔔 **Approval Notifications** - Separate sections for pending & revision items
- 📊 **Status Tracking** - DRAFT → IN APPROVAL → APPROVED/REJECT/REVISI

### Module Features

- ✅ **CRUD Operations** - Create, Read, Update, Delete
- 🔍 **Advanced Search & Filter** - Real-time search with status filtering
- 📄 **Pagination** - Efficient data loading with infinite scroll
- 📤 **Export Data** - Export to Excel/CSV
- 👁️ **View Mode** - Read-only detail view
- ✏️ **Edit Mode** - Inline editing with validation
- 📋 **Copy Mode** - Duplicate records
- 🗑️ **Soft Delete** - Recoverable deletion
- 📊 **Sorting** - Multi-column sorting
- 🏷️ **Status Management** - Active/Inactive toggle

### Developer Features

- 🛠️ **Module Generator** - Auto-generate module with PowerShell/Node.js script
- 📝 **Type Safety** - Full TypeScript support
- 🎯 **Code Reusability** - Composables & shared components
- 🔥 **Hot Module Replacement** - Instant feedback during development
- 📦 **Optimized Build** - Tree-shaking & code splitting
- 📑 **Template System** - Form, FormWithApproval, Landing, LandingWithApproval templates

## 🔧 Scripts & Generators

### PowerShell Script: Module Generator

Automatically generate new modules with complete CRUD functionality.

#### Quick Start

```powershell
# Generate new module
.\add_route.ps1 module/path/name

# Example: Create General module
.\add_route.ps1 setup/m_general

# Example: Create Supplier module with sub-folder
.\add_route.ps1 purchasing/master/m_supplier
```

#### What Gets Created?

- ✅ Folder structure
- ✅ Landing page (List/Table)
- ✅ Form page (Add/Edit/View)
- ✅ Service file (API calls)
- ✅ Route registration (3 routes: list, form, view)

#### Documentation

- **Full Guide**: [ADD_ROUTE_README.md](ADD_ROUTE_README.md)
- **Quick Reference**: [QUICK_START.md](QUICK_START.md)

### Other Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm preview          # Preview production build

# Testing & Quality
pnpm test:unit        # Run unit tests
pnpm type-check       # TypeScript type checking
pnpm lint             # Lint code

# Utilities
pnpm format           # Format code with Prettier (if configured)
```

## 🛠️ Tech Stack

<div align="center">

![Wuthering Waves](https://media1.tenor.com/m/DGmpmuKLV-8AAAAd/wuthering-waves-wuwa.gif)

</div>

### Frontend Framework

- **Vue 3** (Composition API) - Progressive JavaScript framework
- **TypeScript** - Type-safe development
- **Vite** - Next-generation frontend tooling

### UI & Styling

- **TailwindCSS** - Utility-first CSS framework
- **Shadcn-vue** - Beautiful UI components
- **Lucide Icons** - Icon library
- **Sonner** - Toast notifications

### State Management & Routing

- **Vue Router** - Official routing solution
- **Pinia** - State management

### Development Tools

- **Vitest** - Unit testing framework
- **ESLint** - Code linting
- **Prettier** - Code formatting (optional)
- **vue-tsc** - TypeScript type checking for Vue

### Build Tools

- **Vite** - Build tool & dev server
- **PostCSS** - CSS processing
- **Autoprefixer** - CSS vendor prefixes

## 💻 IDE Setup

### Recommended IDE

**Visual Studio Code** - [Download](https://code.visualstudio.com/)

### Required Extensions

- [Vue - Official (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.volar) - Vue 3 support
- [TypeScript Vue Plugin (Volar)](https://marketplace.visualstudio.com/items?itemName=Vue.vscode-typescript-vue-plugin)

**Important**: Disable **Vetur** if you have it installed (conflicts with Volar).

### Recommended Extensions

- [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint)
- [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)
- [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss)
- [Path Intellisense](https://marketplace.visualstudio.com/items?itemName=christian-kohler.path-intellisense)
- [Auto Rename Tag](https://marketplace.visualstudio.com/items?itemName=formulahendry.auto-rename-tag)

### Browser Extensions

#### Chromium-based (Chrome, Edge, Brave)

- [Vue.js devtools](https://chromewebstore.google.com/detail/vuejs-devtools/nhdogjmejiglipccpnnnanhbledajbpd)
- [Turn on Custom Object Formatter](http://bit.ly/object-formatters)

#### Firefox

- [Vue.js devtools](https://addons.mozilla.org/en-US/firefox/addon/vue-js-devtools/)
- [Turn on Custom Object Formatter](https://fxdx.dev/firefox-devtools-custom-object-formatters/)

## 📖 Documentation

- [Module Generator Guide](ADD_ROUTE_README.md) - Complete guide for generating modules
- [Quick Start Guide](QUICK_START.md) - Quick reference for common tasks
- [Vite Configuration](https://vite.dev/config/) - Vite documentation
- [Vue 3 Documentation](https://vuejs.org/) - Vue.js documentation
- [TypeScript Documentation](https://www.typescriptlang.org/) - TypeScript documentation

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary and confidential.

---

<div align="center">

**Bos Baut** © 2025 - Enterprise Application

Made with ❤️ using Vue 3 + TypeScript + Vite

</div>
