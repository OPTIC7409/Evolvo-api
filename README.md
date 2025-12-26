# Evolvo API

Backend API services for the Evolvo AI app builder platform.

## Overview

This is the standalone API backend for Evolvo, separated from the frontend application. It provides:

- **Authentication** - NextAuth.js with Google and GitHub OAuth
- **User Management** - User profiles, subscriptions, and usage tracking
- **Project Management** - CRUD operations for user projects
- **AI Chat** - Streaming AI responses with tool calling via Anthropic Claude
- **Subscription Billing** - Stripe integration for Pro and Enterprise tiers
- **Docker Cloud Services** - PostgreSQL, Redis, and pgvector provisioning
- **Security Audits** - Static and heuristic code security analysis

## Tech Stack

- **Framework**: Next.js 16 (API Routes)
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma
- **Auth**: NextAuth.js
- **Payments**: Stripe
- **AI**: Anthropic Claude

## API Endpoints

### Authentication
- `GET|POST /api/auth/[...nextauth]` - NextAuth.js handler

### Projects
- `GET /api/projects` - List user's projects
- `POST /api/projects` - Create new project
- `GET /api/projects/[id]` - Get project details
- `PATCH /api/projects/[id]` - Update project
- `DELETE /api/projects/[id]` - Delete project
- `GET /api/projects/[id]/messages` - Get chat history
- `POST /api/projects/[id]/messages` - Save message
- `GET /api/projects/[id]/files` - Get project files
- `POST /api/projects/[id]/files` - Save files

### AI Sandbox
- `POST /api/sandbox/chat` - Stream AI responses
- `POST /api/sandbox/execute-tool` - Execute tool results

### User & Subscription
- `GET /api/user/subscription` - Get subscription details
- `DELETE /api/user/delete` - Delete account

### Stripe
- `POST /api/stripe/create-checkout` - Create checkout session
- `POST /api/stripe/portal` - Customer portal link
- `POST /api/stripe/sync` - Sync subscription
- `POST /api/stripe/webhooks` - Webhook handler

### Docker Cloud
- `POST /api/docker/provision` - Provision containers
- `GET /api/docker/status` - Container status
- `POST /api/docker/cleanup` - Clean up containers
- `POST /api/docker/exec` - Execute commands

### Security
- `POST /api/security/scan` - Run security scan
- `POST /api/security/audit` - Get full audit
- `POST /api/security/checkout` - Purchase audit
- `POST /api/security/verify-payment` - Verify payment

## Setup

### Prerequisites

- Node.js 18+
- PostgreSQL database (Supabase recommended)
- Stripe account
- Google and/or GitHub OAuth credentials
- Anthropic API key

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/Evolvo-api.git
cd Evolvo-api

# Install dependencies
npm install

# Copy environment file
cp .env.example .env.local
# Edit .env.local with your credentials

# Generate Prisma client
npm run db:generate

# Run migrations
npm run db:migrate:deploy

# Start development server
npm run dev
```

The API will be available at `http://localhost:3001`.

### Environment Variables

See `.env.example` for all required environment variables.

Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SUPABASE_URL` & `SUPABASE_SERVICE_ROLE_KEY` - Supabase credentials
- `NEXTAUTH_SECRET` - NextAuth.js secret
- `STRIPE_SECRET_KEY` & `STRIPE_WEBHOOK_SECRET` - Stripe credentials
- `ANTHROPIC_API_KEY` - For AI features

## Development

```bash
# Start development server
npm run dev

# Run linter
npm run lint

# Open Prisma Studio
npm run db:studio
```

## Deployment

### Vercel (Recommended)

1. Connect your repository to Vercel
2. Add environment variables in project settings
3. Deploy

### Docker

```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

## Database Schema

The database schema is defined in `prisma/schema.prisma`. Key tables:

- `users` - User accounts
- `sessions` / `accounts` - NextAuth.js tables
- `subscriptions` - Stripe subscription data
- `usage` - Monthly AI request tracking
- `projects` - User projects
- `project_messages` - Chat history
- `project_files` - Saved code files
- `security_audits` - Security scan results
- `security_audit_purchases` - Audit payment records

## License

ISC License - See package.json for details.
