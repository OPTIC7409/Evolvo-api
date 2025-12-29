-- Marketplace & Plugins Tables
-- Migration: 2_marketplace_admin

-- Marketplace Items (Plugins, Templates, Integrations, Themes)
CREATE TABLE IF NOT EXISTS marketplace_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    long_description TEXT,
    category TEXT NOT NULL,
    author TEXT NOT NULL,
    author_id UUID,
    icon TEXT NOT NULL,
    version TEXT DEFAULT '1.0.0',
    downloads INTEGER DEFAULT 0,
    rating FLOAT DEFAULT 0,
    rating_count INTEGER DEFAULT 0,
    verified BOOLEAN DEFAULT FALSE,
    published BOOLEAN DEFAULT FALSE,
    features JSONB DEFAULT '[]'::jsonb,
    requirements JSONB DEFAULT '[]'::jsonb,
    documentation TEXT,
    repository TEXT,
    config JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for marketplace_items
CREATE INDEX IF NOT EXISTS idx_marketplace_items_category ON marketplace_items(category);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_published ON marketplace_items(published);
CREATE INDEX IF NOT EXISTS idx_marketplace_items_author ON marketplace_items(author_id);

-- User Installed Plugins
CREATE TABLE IF NOT EXISTS user_installed_plugins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES marketplace_items(id) ON DELETE CASCADE,
    enabled BOOLEAN DEFAULT TRUE,
    settings JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, item_id)
);

-- Indexes for user_installed_plugins
CREATE INDEX IF NOT EXISTS idx_user_installed_plugins_user ON user_installed_plugins(user_id);
CREATE INDEX IF NOT EXISTS idx_user_installed_plugins_item ON user_installed_plugins(item_id);

-- Admin Sessions
CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    token TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for admin_sessions
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_email ON admin_sessions(email);

-- Analytics Events
CREATE TABLE IF NOT EXISTS analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID,
    event_type TEXT NOT NULL,
    event_data JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for analytics_events
CREATE INDEX IF NOT EXISTS idx_analytics_events_type ON analytics_events(event_type);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user ON analytics_events(user_id);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created ON analytics_events(created_at);

-- Gifted Subscriptions
CREATE TABLE IF NOT EXISTS gifted_subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    gifted_by TEXT NOT NULL,
    tier TEXT NOT NULL,
    duration_days INTEGER NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Indexes for gifted_subscriptions
CREATE INDEX IF NOT EXISTS idx_gifted_subscriptions_user ON gifted_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_gifted_subscriptions_expires ON gifted_subscriptions(expires_at);

-- Insert default marketplace items (official plugins)
INSERT INTO marketplace_items (slug, name, description, long_description, category, author, icon, version, downloads, rating, rating_count, verified, published, features, requirements)
VALUES 
    ('github-integration', 'GitHub Integration', 'Connect your GitHub repositories for seamless version control and deployment.', 'The GitHub Integration plugin enables seamless connection between Evolvo and your GitHub repositories. Push your projects directly to GitHub, manage branches, and set up automatic deployments with just a few clicks.', 'integrations', 'Evolvo', 'M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.008-.866-.013-1.7-2.782.604-3.369-1.341-3.369-1.341-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.831.092-.646.35-1.086.636-1.336-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.578 9.578 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z', '2.1.0', 12400, 4.9, 156, true, true, '["One-click repository creation", "Branch management", "Automatic deployments", "Pull request integration", "Commit history viewer"]'::jsonb, '["GitHub account", "Personal access token"]'::jsonb),
    
    ('supabase-connector', 'Supabase Connector', 'Direct integration with Supabase for authentication, database, and storage.', 'Connect your Evolvo projects directly to Supabase for a complete backend solution. This plugin provides seamless integration with Supabase Auth, Database, Storage, and Edge Functions.', 'integrations', 'Evolvo', 'M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5', '1.8.0', 8900, 4.8, 112, true, true, '["Authentication (OAuth, Magic Link, Email)", "Real-time database subscriptions", "File storage with CDN", "Edge Functions integration", "Row Level Security support"]'::jsonb, '["Supabase account", "Project URL and API keys"]'::jsonb),
    
    ('code-formatter', 'Code Formatter', 'Automatically format and lint your code with Prettier and ESLint integration.', 'Keep your code clean and consistent with automatic formatting. This plugin integrates Prettier and ESLint to format your code on save, ensuring consistent style across your entire project.', 'plugins', 'Evolvo', 'M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4', '2.5.0', 22100, 4.9, 234, true, true, '["Format on save", "ESLint integration", "Prettier support", "Custom rule configuration", "Multi-language support"]'::jsonb, '[]'::jsonb),
    
    ('api-generator', 'API Generator', 'Generate REST and GraphQL APIs from your data models automatically.', 'Automatically generate fully-functional REST and GraphQL APIs from your data models. Includes CRUD operations, filtering, pagination, and authentication middleware.', 'plugins', 'Evolvo', 'M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z', '1.4.0', 9800, 4.8, 98, true, true, '["Auto-generated REST endpoints", "GraphQL schema generation", "Built-in authentication", "API documentation", "Rate limiting"]'::jsonb, '[]'::jsonb),
    
    ('nextjs-starter', 'Next.js Starter', 'Production-ready Next.js template with auth, database, and API routes.', 'Start your next project with a production-ready Next.js template. Includes authentication, database setup, API routes, and best practices for building scalable applications.', 'templates', 'Evolvo', 'M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z', '4.0.0', 18200, 4.9, 189, true, true, '["Next.js 15 with App Router", "TypeScript configured", "Tailwind CSS setup", "Authentication ready", "Database integration"]'::jsonb, '[]'::jsonb),
    
    ('vercel-deploy', 'Vercel Deploy', 'One-click deployment to Vercel with automatic preview deployments.', 'Deploy your Evolvo projects to Vercel with a single click. Automatic preview deployments for every branch, custom domains, and seamless integration with your Git workflow.', 'integrations', 'Evolvo', 'M12 2l9 18H3l9-18z', '2.0.0', 11200, 4.9, 145, true, true, '["One-click deployment", "Preview deployments", "Custom domains", "Environment variables", "Analytics integration"]'::jsonb, '["Vercel account"]'::jsonb),
    
    ('typescript-tools', 'TypeScript Tools', 'Enhanced TypeScript support with advanced type checking and refactoring.', 'Supercharge your TypeScript development with advanced tools. Includes type inference helpers, automatic type generation, refactoring tools, and comprehensive error checking.', 'plugins', 'Evolvo', 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z', '3.1.0', 14300, 4.8, 167, true, true, '["Advanced type inference", "Auto type generation", "Refactoring tools", "Error highlighting", "JSDoc support"]'::jsonb, '[]'::jsonb),
    
    ('analytics-dashboard', 'Analytics Dashboard', 'Real-time analytics and insights for your deployed applications.', 'Get comprehensive insights into your applications performance and user behavior. Track page views, user sessions, performance metrics, and more with beautiful visualizations.', 'plugins', 'Evolvo', 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', '1.5.0', 7800, 4.7, 89, true, true, '["Real-time tracking", "User sessions", "Performance metrics", "Custom events", "Export reports"]'::jsonb, '[]'::jsonb)
ON CONFLICT (slug) DO NOTHING;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_marketplace_items_updated_at ON marketplace_items;
CREATE TRIGGER update_marketplace_items_updated_at
    BEFORE UPDATE ON marketplace_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_user_installed_plugins_updated_at ON user_installed_plugins;
CREATE TRIGGER update_user_installed_plugins_updated_at
    BEFORE UPDATE ON user_installed_plugins
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
