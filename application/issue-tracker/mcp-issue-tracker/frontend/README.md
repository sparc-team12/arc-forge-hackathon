# Issues Tracker Frontend

This frontend application uses Vite with a proxy configuration to automatically forward API requests to the backend server.

## Quick Start

### Start from Root Directory (Recommended)

```bash
# From the project root directory
cd ..  # if you're in the frontend directory
npm run dev
```

This starts both backend (port 3000) and frontend (port 5173) with proxy configuration.

````

This will start both the backend server (port 3000) and frontend dev server (port 5173) with automatic API proxying.

### Option 2: Manual start (if Option 1 doesn't work)
```bash
# Terminal 1: Start backend
cd ../backend
npm run dev

# Terminal 2: Start frontend (from frontend directory)
npm run dev
````

## Proxy Configuration

The Vite dev server is configured to proxy all `/api/*` requests to `http://localhost:3000`. This means:

- Frontend: `http://localhost:5173`
- API calls: `/api/...` → automatically proxied to `http://localhost:3000/api/...`

### Benefits

- ✅ No CORS issues during development
- ✅ Simplified API configuration
- ✅ Single command to start everything
- ✅ Automatic request forwarding

## Available Scripts

- `npm run dev` - Start frontend dev server with proxy
- `npm run dev:backend` - Start backend server
- `npm run dev:full` - Start both backend and frontend
- `npm run build` - Build for production
- `npm run preview` - Preview production build

## API Configuration

The API base URL is automatically set to `/api` in development, which gets proxied to the backend. For production, set the `VITE_API_URL` environment variable:

```bash
VITE_API_URL=https://your-api-domain.com/api
```

## Technologies

- **Vite** - Fast development server with HMR
- **React 19** - UI framework
- **TypeScript** - Type safety
- **Tailwind CSS v3** - Styling
- **shadcn/ui** - UI components
- **Sonner** - Toast notifications
- **Axios** - HTTP client

        // Remove tseslint.configs.recommended and replace with this
        ...tseslint.configs.recommendedTypeChecked,
        // Alternatively, use this for stricter rules
        ...tseslint.configs.strictTypeChecked,
        // Optionally, add this for stylistic rules
        ...tseslint.configs.stylisticTypeChecked,

        // Other configs...
      ],
      languageOptions: {
        parserOptions: {
          project: ['./tsconfig.node.json', './tsconfig.app.json'],
          tsconfigRootDir: import.meta.dirname,
        },
        // other options...
      },

  },
  ])

````

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default tseslint.config([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
````
