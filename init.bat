@echo off
echo Initializing Next.js Spa Booking Application...

echo Creating package.json...
echo {^
  "name": "spa-booking-app",^
  "version": "0.1.0",^
  "private": true,^
  "scripts": {^
    "dev": "next dev",^
    "build": "next build",^
    "start": "next start",^
    "lint": "next lint"^
  },^
  "dependencies": {^
    "@supabase/auth-helpers-nextjs": "^0.8.1",^
    "@supabase/auth-helpers-react": "^0.4.2",^
    "@supabase/auth-ui-react": "^0.4.6",^
    "@supabase/auth-ui-shared": "^0.1.8",^
    "@supabase/supabase-js": "^2.38.4",^
    "next": "14.0.3",^
    "react": "^18",^
    "react-dom": "^18",^
    "react-datepicker": "^4.21.0",^
    "date-fns": "^2.30.0",^
    "tailwindcss": "^3.3.5",^
    "postcss": "^8.4.31",^
    "autoprefixer": "^10.4.16"^
  },^
  "devDependencies": {^
    "@types/node": "^20",^
    "@types/react": "^18",^
    "@types/react-dom": "^18",^
    "eslint": "^8",^
    "eslint-config-next": "14.0.3",^
    "typescript": "^5"^
  }^
} > package.json

echo Creating postcss.config.js...
echo module.exports = {^
  plugins: {^
    tailwindcss: {},^
    autoprefixer: {},^
  },^
} > postcss.config.js

echo Creating tailwind.config.js...
echo /** @type {import('tailwindcss').Config} */^
module.exports = {^
  content: [^
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',^
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',^
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',^
  ],^
  theme: {^
    extend: {^
      colors: {^
        primary: {^
          50: '#f0f9ff',^
          100: '#e0f2fe',^
          200: '#bae6fd',^
          300: '#7dd3fc',^
          400: '#38bdf8',^
          500: '#0ea5e9',^
          600: '#0284c7',^
          700: '#0369a1',^
          800: '#075985',^
          900: '#0c4a6e',^
        },^
      },^
    },^
  },^
  plugins: [],^
} > tailwind.config.js

echo Creating next.config.js...
echo /** @type {import('next').NextConfig} */^
const nextConfig = {^
  reactStrictMode: true,^
  images: {^
    domains: ['images.unsplash.com', 'vkqpoixggppqumweltyk.supabase.co'],^
  },^
  env: {^
    NEXT_PUBLIC_SUPABASE_URL: 'https://vkqpoixggppqumweltyk.supabase.co',^
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZrcXBvaXhnZ3BwcXVtd2VsdHlrIiwicm9sZSI6ImFub24iLCJpYXQiOjE2OTk5NjQ4MDAsImV4cCI6MjAxNTU0MDgwMH0.qWsWvSp-g-4iBLKCHEWnw9HSUkXdI1wKKbpwJ1Zd2Uo',^
  },^
}^
^
module.exports = nextConfig > next.config.js

echo Creating directories...
mkdir src 2>nul
mkdir src\app 2>nul
mkdir src\components 2>nul
mkdir src\lib 2>nul

echo Installation instructions:
echo 1. Run: npm install
echo 2. Run: npm run dev
echo 3. Open: http://localhost:3000

echo Initialization complete!