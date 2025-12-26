/**
 * Sandbox Types
 * 
 * Type definitions for the WebContainer-based sandbox system
 */

export type SandboxStatus = 
  | "idle" 
  | "booting" 
  | "ready" 
  | "installing" 
  | "running" 
  | "error" 
  | "stopped";

export interface FileNode {
  name: string;
  path: string;
  type: "file" | "directory";
  children?: FileNode[];
  content?: string;
}

export interface SandboxFile {
  path: string;
  content: string;
  language?: string;
}

export interface SandboxState {
  status: SandboxStatus;
  containerId: string | null;
  files: FileNode[];
  previewUrl: string | null;
  terminalOutput: string[];
  error: string | null;
  currentFile: SandboxFile | null;
  serverPort: number | null;
}

export interface SandboxAction {
  type: "write_file" | "read_file" | "delete_file" | "run_command" | "install_packages";
  payload: Record<string, unknown>;
}

export interface AIToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

export interface AIMessage {
  role: "user" | "assistant" | "system";
  content: string;
  toolCalls?: AIToolCall[];
  toolResults?: { toolCallId: string; result: string }[];
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  files: Record<string, string>;
  installCommand: string;
  startCommand: string;
  port: number;
}

// Default React template for new projects
export const REACT_TEMPLATE: ProjectTemplate = {
  id: "react-vite",
  name: "React + Vite",
  description: "A modern React app with Vite",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        vite: "^5.0.0"
      }
    }, null, 2),
    "vite.config.js": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
})`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>`,
    "src/main.jsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
    "src/App.jsx": `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="app">
      <header className="header">
        <h1>Welcome to Your App</h1>
        <p>Built with Evolvo</p>
      </header>
      
      <main className="main">
        <div className="card">
          <button onClick={() => setCount(c => c + 1)}>
            Count is {count}
          </button>
          <p>Edit <code>src/App.jsx</code> to get started</p>
        </div>
      </main>
    </div>
  )
}

export default App`,
    "src/App.css": `.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(90deg, #ff8a3d, #7c5cff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header p {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.main {
  padding: 2rem;
}

.card {
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.card button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #ff8a3d, #ff6f5b);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(255, 138, 61, 0.3);
}

.card p {
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.card code {
  background: rgba(124, 92, 255, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}`,
    "src/index.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}`,
    ".env": `# Environment Variables
# Add your configuration here
# Example: API_KEY=your_api_key_here
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 5173
};

// Next.js template (configured for WebContainer - uses Babel instead of SWC)
// Mirrors the structure created by create-next-app
export const NEXTJS_TEMPLATE: ProjectTemplate = {
  id: "nextjs",
  name: "Next.js",
  description: "A Next.js app with App Router",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      version: "0.1.0",
      private: true,
      scripts: {
        dev: "next dev",
        build: "next build",
        start: "next start",
        lint: "next lint"
      },
      dependencies: {
        next: "13.5.6",
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@babel/core": "^7.23.0"
      }
    }, null, 2),
    "next.config.js": `/** @type {import('next').NextConfig} */
const nextConfig = {
  swcMinify: false,
  experimental: {
    forceSwcTransforms: false
  },
  reactStrictMode: true,
}

module.exports = nextConfig`,
    ".babelrc": JSON.stringify({
      presets: ["next/babel"]
    }, null, 2),
    "jsconfig.json": JSON.stringify({
      compilerOptions: {
        paths: {
          "@/*": ["./*"]
        }
      }
    }, null, 2),
    "app/globals.css": `* {
  box-sizing: border-box;
  padding: 0;
  margin: 0;
}

html,
body {
  max-width: 100vw;
  overflow-x: hidden;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
}

body {
  background: linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%);
  color: #ffffff;
  min-height: 100vh;
}

a {
  color: inherit;
  text-decoration: none;
}`,
    "app/page.js": `import styles from './page.module.css'

export default function Home() {
  return (
    <main className={styles.main}>
      <div className={styles.center}>
        <h1 className={styles.title}>
          Welcome to Your App
        </h1>
        <p className={styles.description}>
          Built with Evolvo
        </p>
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h2>Getting Started</h2>
          <p>Edit <code>app/page.js</code> to customize this page.</p>
        </div>
        <div className={styles.card}>
          <h2>Learn More</h2>
          <p>This is a Next.js project with App Router.</p>
        </div>
      </div>
    </main>
  )
}`,
    "app/page.module.css": `.main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 2rem;
}

.center {
  text-align: center;
  margin-bottom: 3rem;
}

.title {
  font-size: 3rem;
  font-weight: 700;
  background: linear-gradient(90deg, #ff8a3d, #7c5cff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  margin-bottom: 1rem;
}

.description {
  color: rgba(255, 255, 255, 0.6);
  font-size: 1.1rem;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  max-width: 800px;
  width: 100%;
}

.card {
  padding: 1.5rem;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: all 0.2s ease;
}

.card:hover {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.2);
  transform: translateY(-2px);
}

.card h2 {
  font-size: 1.25rem;
  margin-bottom: 0.5rem;
  color: #fff;
}

.card p {
  color: rgba(255, 255, 255, 0.6);
  font-size: 0.9rem;
  line-height: 1.5;
}

.card code {
  background: rgba(255, 138, 61, 0.2);
  color: #ff8a3d;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-size: 0.85rem;
}`,
    "app/layout.js": `import './globals.css'

export const metadata = {
  title: 'Vibe App',
  description: 'Built with Evolvo',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}`,
    "public/placeholder.txt": "Place your static assets here (images, fonts, etc.)",
    ".env": `# Environment Variables
# Add your configuration here
# Example: NEXT_PUBLIC_API_URL=https://api.example.com
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 3000
};

// Vue + Vite template
export const VUE_TEMPLATE: ProjectTemplate = {
  id: "vue-vite",
  name: "Vue + Vite",
  description: "A Vue 3 app with Vite and Composition API",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        vue: "^3.4.0"
      },
      devDependencies: {
        "@vitejs/plugin-vue": "^5.0.0",
        vite: "^5.0.0"
      }
    }, null, 2),
    "vite.config.js": `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    host: true,
    port: 5173
  }
})`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,
    "src/main.js": `import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

createApp(App).mount('#app')`,
    "src/App.vue": `<script setup>
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>Welcome to Your App</h1>
      <p>Built with Evolvo</p>
    </header>
    
    <main class="main">
      <div class="card">
        <button @click="count++">
          Count is {{ count }}
        </button>
        <p>Edit <code>src/App.vue</code> to get started</p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(90deg, #42b883, #35495e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header p {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.card {
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.card button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #42b883, #35495e);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(66, 184, 131, 0.3);
}

.card p {
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.card code {
  background: rgba(66, 184, 131, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}
</style>`,
    "src/style.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}`,
    ".env": `# Environment Variables
# Add your configuration here
# Example: VITE_API_URL=https://api.example.com
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 5173
};

// Svelte + Vite template
export const SVELTE_TEMPLATE: ProjectTemplate = {
  id: "svelte-vite",
  name: "Svelte + Vite",
  description: "A Svelte app with Vite",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      devDependencies: {
        "@sveltejs/vite-plugin-svelte": "^3.0.0",
        svelte: "^4.2.0",
        vite: "^5.0.0"
      }
    }, null, 2),
    "vite.config.js": `import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

export default defineConfig({
  plugins: [svelte()],
  server: {
    host: true,
    port: 5173
  }
})`,
    "svelte.config.js": `import { vitePreprocess } from '@sveltejs/vite-plugin-svelte'

export default {
  preprocess: vitePreprocess()
}`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>`,
    "src/main.js": `import App from './App.svelte'
import './app.css'

const app = new App({
  target: document.getElementById('app'),
})

export default app`,
    "src/App.svelte": `<script>
  let count = 0
</script>

<div class="app">
  <header class="header">
    <h1>Welcome to Your App</h1>
    <p>Built with Evolvo</p>
  </header>
  
  <main class="main">
    <div class="card">
      <button on:click={() => count++}>
        Count is {count}
      </button>
      <p>Edit <code>src/App.svelte</code> to get started</p>
    </div>
  </main>
</div>

<style>
  .app {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
    color: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .header h1 {
    font-size: 2.5rem;
    margin: 0;
    background: linear-gradient(90deg, #ff3e00, #ff8a3d);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }

  .header p {
    color: rgba(255, 255, 255, 0.6);
    margin-top: 0.5rem;
  }

  .card {
    padding: 2rem;
    background: rgba(255, 255, 255, 0.05);
    border-radius: 12px;
    border: 1px solid rgba(255, 255, 255, 0.1);
    text-align: center;
  }

  .card button {
    padding: 0.75rem 1.5rem;
    font-size: 1rem;
    font-weight: 500;
    border: none;
    border-radius: 8px;
    background: linear-gradient(90deg, #ff3e00, #ff8a3d);
    color: white;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .card button:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(255, 62, 0, 0.3);
  }

  .card p {
    margin-top: 1rem;
    color: rgba(255, 255, 255, 0.5);
  }

  .card code {
    background: rgba(255, 62, 0, 0.2);
    padding: 0.2rem 0.4rem;
    border-radius: 4px;
    font-family: monospace;
  }
</style>`,
    "src/app.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}`,
    ".env": `# Environment Variables
# Add your configuration here
# Example: VITE_API_URL=https://api.example.com
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 5173
};

// Vanilla JS + Vite template
export const VANILLA_TEMPLATE: ProjectTemplate = {
  id: "vanilla-vite",
  name: "Vanilla JS + Vite",
  description: "A vanilla JavaScript app with Vite",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      devDependencies: {
        vite: "^5.0.0"
      }
    }, null, 2),
    "vite.config.js": `import { defineConfig } from 'vite'

export default defineConfig({
  server: {
    host: true,
    port: 5173
  }
})`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe App</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <div id="app">
      <header class="header">
        <h1>Welcome to Your App</h1>
        <p>Built with Evolvo</p>
      </header>
      
      <main class="main">
        <div class="card">
          <button id="counter">Count is 0</button>
          <p>Edit <code>main.js</code> to get started</p>
        </div>
      </main>
    </div>
    <script type="module" src="/main.js"></script>
  </body>
</html>`,
    "main.js": `let count = 0
const button = document.getElementById('counter')

button.addEventListener('click', () => {
  count++
  button.textContent = \`Count is \${count}\`
})`,
    "style.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}

#app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(90deg, #f7df1e, #ffb13d);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header p {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.card {
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.card button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #f7df1e, #ffb13d);
  color: #1a1a2e;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(247, 223, 30, 0.3);
}

.card p {
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.card code {
  background: rgba(247, 223, 30, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}`,
    ".env": `# Environment Variables
# Add your configuration here
# Example: VITE_API_URL=https://api.example.com
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 5173
};

// TypeScript + React + Vite template
export const REACT_TS_TEMPLATE: ProjectTemplate = {
  id: "react-ts-vite",
  name: "React + TypeScript",
  description: "A React app with TypeScript and Vite",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "tsc && vite build",
        preview: "vite preview"
      },
      dependencies: {
        react: "^18.2.0",
        "react-dom": "^18.2.0"
      },
      devDependencies: {
        "@types/react": "^18.2.0",
        "@types/react-dom": "^18.2.0",
        "@vitejs/plugin-react": "^4.2.0",
        typescript: "^5.3.0",
        vite: "^5.0.0"
      }
    }, null, 2),
    "vite.config.ts": `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173
  }
})`,
    "tsconfig.json": JSON.stringify({
      compilerOptions: {
        target: "ES2020",
        useDefineForClassFields: true,
        lib: ["ES2020", "DOM", "DOM.Iterable"],
        module: "ESNext",
        skipLibCheck: true,
        moduleResolution: "bundler",
        allowImportingTsExtensions: true,
        resolveJsonModule: true,
        isolatedModules: true,
        noEmit: true,
        jsx: "react-jsx",
        strict: true,
        noUnusedLocals: true,
        noUnusedParameters: true,
        noFallthroughCasesInSwitch: true
      },
      include: ["src"],
      references: [{ path: "./tsconfig.node.json" }]
    }, null, 2),
    "tsconfig.node.json": JSON.stringify({
      compilerOptions: {
        composite: true,
        skipLibCheck: true,
        module: "ESNext",
        moduleResolution: "bundler",
        allowSyntheticDefaultImports: true
      },
      include: ["vite.config.ts"]
    }, null, 2),
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
    "src/main.tsx": `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)`,
    "src/App.tsx": `import { useState } from 'react'
import './App.css'

function App() {
  const [count, setCount] = useState<number>(0)

  return (
    <div className="app">
      <header className="header">
        <h1>Welcome to Your App</h1>
        <p>Built with Evolvo + TypeScript</p>
      </header>
      
      <main className="main">
        <div className="card">
          <button onClick={() => setCount((c) => c + 1)}>
            Count is {count}
          </button>
          <p>Edit <code>src/App.tsx</code> to get started</p>
        </div>
      </main>
    </div>
  )
}

export default App`,
    "src/App.css": `.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(90deg, #3178c6, #7c5cff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header p {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.card {
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.card button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #3178c6, #7c5cff);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(49, 120, 198, 0.3);
}

.card p {
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.card code {
  background: rgba(49, 120, 198, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}`,
    "src/index.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}`,
    "src/vite-env.d.ts": `/// <reference types="vite/client" />`,
    ".env": `# Environment Variables
# Add your configuration here
# Example: VITE_API_URL=https://api.example.com
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 5173
};

// Solid.js + Vite template
export const SOLID_TEMPLATE: ProjectTemplate = {
  id: "solid-vite",
  name: "Solid.js + Vite",
  description: "A Solid.js app with Vite",
  files: {
    "package.json": JSON.stringify({
      name: "vibe-app",
      private: true,
      version: "0.0.0",
      type: "module",
      scripts: {
        dev: "vite",
        build: "vite build",
        preview: "vite preview"
      },
      dependencies: {
        "solid-js": "^1.8.0"
      },
      devDependencies: {
        "vite-plugin-solid": "^2.8.0",
        vite: "^5.0.0"
      }
    }, null, 2),
    "vite.config.js": `import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [solid()],
  server: {
    host: true,
    port: 5173
  }
})`,
    "index.html": `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vibe App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.jsx"></script>
  </body>
</html>`,
    "src/index.jsx": `import { render } from 'solid-js/web'
import App from './App'
import './index.css'

render(() => <App />, document.getElementById('root'))`,
    "src/App.jsx": `import { createSignal } from 'solid-js'
import './App.css'

function App() {
  const [count, setCount] = createSignal(0)

  return (
    <div class="app">
      <header class="header">
        <h1>Welcome to Your App</h1>
        <p>Built with Evolvo + Solid.js</p>
      </header>
      
      <main class="main">
        <div class="card">
          <button onClick={() => setCount(c => c + 1)}>
            Count is {count()}
          </button>
          <p>Edit <code>src/App.jsx</code> to get started</p>
        </div>
      </main>
    </div>
  )
}

export default App`,
    "src/App.css": `.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
  color: white;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  text-align: center;
  margin-bottom: 2rem;
}

.header h1 {
  font-size: 2.5rem;
  margin: 0;
  background: linear-gradient(90deg, #2c4f7c, #446b9e);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.header p {
  color: rgba(255, 255, 255, 0.6);
  margin-top: 0.5rem;
}

.card {
  padding: 2rem;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  text-align: center;
}

.card button {
  padding: 0.75rem 1.5rem;
  font-size: 1rem;
  font-weight: 500;
  border: none;
  border-radius: 8px;
  background: linear-gradient(90deg, #2c4f7c, #446b9e);
  color: white;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.card button:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(44, 79, 124, 0.3);
}

.card p {
  margin-top: 1rem;
  color: rgba(255, 255, 255, 0.5);
}

.card code {
  background: rgba(44, 79, 124, 0.2);
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: monospace;
}`,
    "src/index.css": `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  margin: 0;
  min-height: 100vh;
}`,
    ".env": `# Environment Variables
# Add your configuration here
# Example: VITE_API_URL=https://api.example.com
`
  },
  installCommand: "npm install",
  startCommand: "npm run dev",
  port: 5173
};

// All templates
export const TEMPLATES: ProjectTemplate[] = [
  REACT_TEMPLATE,
  REACT_TS_TEMPLATE,
  NEXTJS_TEMPLATE,
  VUE_TEMPLATE,
  SVELTE_TEMPLATE,
  SOLID_TEMPLATE,
  VANILLA_TEMPLATE
];

// Get template by ID
export function getTemplateById(id: string): ProjectTemplate | undefined {
  return TEMPLATES.find(t => t.id === id);
}
