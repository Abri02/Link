import { Hash, MessageSquare, Users, Settings, Send } from "lucide-react";

export default function App() {
  return (
    <div className="flex h-screen w-full bg-white text-slate-900 font-sans">
      {/* 1. Workspace Sidebar (Narrow) */}
      <nav className="w-16 bg-slate-900 flex flex-col items-center py-4 gap-4 text-white">
        <div className="w-10 h-10 bg-indigo-600 rounded-lg flex items-center justify-center font-bold">
          L
        </div>
        <div className="w-10 h-10 bg-slate-700 rounded-lg flex items-center justify-center hover:bg-slate-600 cursor-pointer">
          +
        </div>
      </nav>

      {/* 2. Channel Sidebar */}
      <aside className="w-64 bg-slate-800 text-slate-300 flex flex-col">
        <header className="p-4 border-b border-slate-700 flex justify-between items-center text-white">
          <h1 className="font-bold text-lg">Link Workspace</h1>
        </header>
        <div className="flex-1 overflow-y-auto p-2">
          <div className="mb-4">
            <h3 className="px-2 text-xs font-semibold uppercase tracking-wider mb-2">
              Channels
            </h3>
            <button className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-slate-700 text-white bg-slate-700">
              <Hash size={18} /> general
            </button>
            <button className="flex items-center gap-2 w-full px-2 py-1 rounded hover:bg-slate-700">
              <Hash size={18} /> development
            </button>
          </div>
        </div>
      </aside>

      {/* 3. Main Chat Area */}
      <main className="flex-1 flex flex-col">
        <header className="h-14 border-b flex items-center px-6 justify-between">
          <div className="flex items-center gap-2">
            <Hash size={20} className="text-slate-500" />
            <span className="font-bold">general</span>
          </div>
        </header>

        <div className="flex-1 p-6 overflow-y-auto">
          {/* Messages will go here */}
          <div className="flex gap-4 mb-6">
            <div className="w-10 h-10 bg-slate-200 rounded shrink-0"></div>
            <div>
              <span className="font-bold mr-2">John Doe</span>
              <span className="text-xs text-slate-500">10:30 PM</span>
              <p className="text-slate-700">
                Welcome to Link! This is our first message.
              </p>
            </div>
          </div>
        </div>

        {/* Input Area */}
        <footer className="p-4">
          <div className="border-2 border-slate-200 rounded-lg p-2 flex items-center">
            <input
              type="text"
              placeholder="Message #general"
              className="flex-1 outline-none px-2"
            />
            <button className="p-2 hover:bg-slate-100 rounded">
              <Send size={20} className="text-slate-500" />
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}
