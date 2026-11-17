# Jasmine Jasmine — Production Gemini AI Chat Workspace

A full-featured, production-ready AI chat web application powered by Next.js (App Router), TypeScript, Tailwind CSS, Zustand, and the official `@google/genai` SDK.

---

## ⚡ Highlights

- **Official `@google/genai` SDK**: Built directly on Google's modern SDK (`GoogleGenAI`) running strictly inside secure server-side routes (`/api/chat`, `/api/upload`, `/api/title`).
- **Zero API Key Leaks**: `process.env.GEMINI_API_KEY` is never exposed or delivered to the client.
- **Multimodal Support**:
  - Drag, select, or paste (`Ctrl/Cmd+V`) PNG, JPG, WEBP, GIF, PDF, and audio (`mp3`, `wav`, `ogg`, `webm`, `mp4`).
  - Small images (`<= 2 MB`) render instantly as inline Base64.
  - Large files, PDFs, and audio automatically stream to Gemini Files API via `ai.files.upload`.
- **Gemini Model Switcher**: Seamlessly switch between `gemini-2.5-flash` (Fast), `gemini-2.5-pro` (Reasoning), and `gemini-2.5-flash-lite` (Lite).
- **Desktop & Mobile 2-Pane UI**:
  - `260px` collapsible sidebar with chronological thread grouping (Today, Yesterday, Previous 7 Days, Older).
  - Live search filter across past threads.
  - Inline thread renaming and deletion.
  - Background auto-title generation using `gemini-2.5-flash-lite` on the first exchange with a subtle pulse shimmer.
- **Rich Message Experience**:
  - Markdown prose, GitHub Flavored Markdown (tables, checklists, blockquotes).
  - Syntax-highlighted code blocks with language badge and 1-click `Copy` button.
  - Smart auto-scrolling with a floating "Scroll to bottom" button when user scrolls up.
  - Dynamic `Stop` button during streaming (`AbortController`).
  - `Regenerate` button on latest assistant message.
  - Inline retry card on network or quota errors.
- **Robust Persistence**: Repository-pattern storage adapter (`storageAdapter.ts`) wrapping `localStorage`, keeping high-frequency streaming chunks strictly in-memory and persisting only on finalize.

---

## 🚀 Quick Start

### 1. Configure Environment Variables
Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Get a free Gemini API key from [Google AI Studio](https://aistudio.google.com/) and paste it into `.env.local`:

```env
GEMINI_API_KEY=AIzaSy...
```

### 2. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📁 Architecture & File Layout

```
Jasmine Jasmine/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── chat/route.ts      # Streaming endpoint (ai.models.generateContentStream)
│   │   │   ├── upload/route.ts    # Files API endpoint (ai.files.upload)
│   │   │   └── title/route.ts     # Auto-titling endpoint (gemini-2.5-flash-lite)
│   │   ├── globals.css            # Dark zinc theme & minimal scrollbars
│   │   ├── layout.tsx             # Root layout with dark mode metadata
│   │   └── page.tsx               # Entry page rendering ChatWorkspace
│   ├── components/
│   │   ├── ChatWorkspace.tsx      # Main layout orchestrator
│   │   ├── Sidebar.tsx            # 260px collapsible sidebar with search & rename
│   │   ├── TopBar.tsx             # 52px header with model selector dropdown
│   │   ├── MessageList.tsx        # Reading column, Markdown, code highlighting
│   │   └── Composer.tsx           # Auto-expanding input, file chips & send/stop
│   ├── services/
│   │   ├── generateThreadTitle.ts # Background auto-titling client service
│   │   └── storageAdapter.ts      # LocalStorage repository adapter
│   ├── store/
│   │   └── useChatStore.ts        # Zustand reactive state store
│   ├── types/
│   │   └── chat.ts                # TypeScript interfaces & Gemini Content types
│   └── utils/
│       └── uploadAttachment.ts    # Client file processor & validation
├── .env.example
├── next.config.mjs
├── package.json
├── tailwind.config.ts
└── tsconfig.json
```

