"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { 
  Plus, Search, Copy, Check, Trash2, Sparkles, 
  Tag, X, Command, Calendar, Filter 
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// --- UTILS ---
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

function getRelativeTime(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (seconds < 60) return "Just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return date.toLocaleDateString();
}

// --- TYPES ---
type Prompt = {
  id: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
};

type ToastType = { id: number; message: string; type: "success" | "error" };

// --- COMPONENTS ---

// 1. Toast Notification System
const ToastContainer = ({ toasts, removeToast }: { toasts: ToastType[], removeToast: (id: number) => void }) => (
  <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
    {toasts.map((toast) => (
      <div
        key={toast.id}
        onAnimationEnd={() => setTimeout(() => removeToast(toast.id), 3000)}
        className={cn(
          "pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg border backdrop-blur-md animate-in slide-in-from-bottom-5 fade-in duration-300",
          toast.type === "success" 
            ? "bg-emerald-50/90 border-emerald-200 text-emerald-800" 
            : "bg-red-50/90 border-red-200 text-red-800"
        )}
      >
        {toast.type === "success" ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    ))}
  </div>
);

// 2. Skeleton Loader
const PromptSkeleton = () => (
  <div className="break-inside-avoid mb-4 border border-gray-100 rounded-xl p-5 bg-white shadow-sm space-y-3">
    <div className="h-6 bg-gray-100 rounded-md w-3/4 animate-pulse" />
    <div className="h-4 bg-gray-50 rounded-md w-1/4 animate-pulse" />
    <div className="space-y-2 pt-2">
      <div className="h-3 bg-gray-100 rounded w-full animate-pulse" />
      <div className="h-3 bg-gray-100 rounded w-5/6 animate-pulse" />
      <div className="h-3 bg-gray-100 rounded w-4/6 animate-pulse" />
    </div>
  </div>
);

// --- MAIN APP ---
export default function PromptLibrary() {
  // State
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [form, setForm] = useState({ title: "", content: "", category: "" });
  const [showForm, setShowForm] = useState(false);
  
  // Toast State
  const [toasts, setToasts] = useState<ToastType[]>([]);
  const addToast = (message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  };
  const removeToast = (id: number) => setToasts((prev) => prev.filter((t) => t.id !== id));

  // Fetch Data
  const loadPrompts = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      setPrompts(data.sort((a: Prompt, b: Prompt) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch {
      addToast("Failed to load prompts", "error");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  // Actions
  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!form.title.trim() || !form.content.trim()) {
      addToast("Title and content are required", "error");
      return;
    }

    setIsSubmitting(true);
    try {
      await fetch("/api/prompts", {
        method: "POST",
        body: JSON.stringify(form),
        headers: { "Content-Type": "application/json" },
      });
      setForm({ title: "", content: "", category: "" });
      setShowForm(false);
      addToast("Prompt saved to library");
      await loadPrompts(true);
    } catch {
      addToast("Failed to save prompt", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prompt permanently?")) return;
    try {
      // Optimistic update
      setPrompts((prev) => prev.filter((p) => p.id !== id));
      await fetch(`/api/prompts/${id}`, { method: "DELETE" });
      addToast("Prompt deleted");
    } catch {
      addToast("Could not delete prompt", "error");
      loadPrompts(true); // Revert on error
    }
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    addToast("Copied to clipboard");
  };

  // Keyboard shortcut (Cmd+Enter)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter" && showForm) {
        handleSubmit();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showForm, form]);

  // Filtering
  const categories = useMemo(() => ["All", ...Array.from(new Set(prompts.map(p => p.category).filter(Boolean)))], [prompts]);
  const filtered = prompts.filter(p => {
    const matchSearch = (p.title + p.content).toLowerCase().includes(search.toLowerCase());
    const matchCat = activeTab === "All" || p.category === activeTab;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* --- HEADER --- */}
      <header className="sticky top-0 z-40 w-full border-b border-slate-200/80 bg-white/80 backdrop-blur-xl transition-all">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-indigo-200 shadow-md">
              <Sparkles className="h-5 w-5" />
            </div>
            <span className="hidden text-lg font-bold tracking-tight text-slate-900 sm:inline-block">PromptVault</span>
          </div>

          <div className="flex flex-1 items-center justify-end gap-3 sm:justify-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search library..."
                className="h-10 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm outline-none focus:border-indigo-500 focus:bg-white focus:ring-2 focus:ring-indigo-500/20 transition-all"
              />
            </div>
          </div>

          <button 
            onClick={() => setShowForm(!showForm)}
            className={cn(
              "flex h-10 items-center gap-2 rounded-full px-5 text-sm font-medium transition-all shadow-sm active:scale-95",
              showForm 
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200" 
                : "bg-slate-900 text-white hover:bg-slate-800"
            )}
          >
            {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
            <span className="hidden sm:inline">{showForm ? "Close" : "New Prompt"}</span>
          </button>
        </div>
        
        {/* Category Tabs */}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 pb-3 pt-1 overflow-x-auto scrollbar-hide">
          <div className="flex gap-1.5">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveTab(cat)}
                className={cn(
                  "px-3 py-1.5 rounded-md text-xs font-medium transition-colors border",
                  activeTab === cat
                    ? "bg-white border-slate-200 text-indigo-600 shadow-sm"
                    : "border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-100"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* --- MAIN CONTENT --- */}
      <main className="mx-auto max-w-6xl p-4 sm:p-6">
        
        {/* New Prompt Drawer/Panel */}
        <div className={cn(
          "mb-8 overflow-hidden rounded-2xl border border-indigo-100 bg-white shadow-xl shadow-indigo-500/5 transition-all duration-500 ease-in-out",
          showForm ? "max-h-[800px] opacity-100" : "max-h-0 opacity-0 border-0"
        )}>
          <div className="p-6 md:p-8">
            <h2 className="mb-6 text-xl font-bold text-slate-900">Create New Prompt</h2>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-5 md:grid-cols-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Title</label>
                  <input
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    placeholder="e.g. SEO Blog Generator"
                    className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Category</label>
                  <div className="relative">
                    <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={form.category}
                      onChange={(e) => setForm({ ...form, category: e.target.value })}
                      placeholder="Marketing, Coding, Email..."
                      className="w-full rounded-lg border border-slate-200 bg-slate-50 p-3 pl-10 text-sm font-medium outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                    />
                  </div>
                </div>
              </div>
              
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">Prompt Content</label>
                <textarea
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Act as a senior software engineer..."
                  rows={6}
                  className="w-full resize-none rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm leading-relaxed outline-none focus:border-indigo-500 focus:bg-white focus:ring-1 focus:ring-indigo-500 transition-all"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Command className="h-3 w-3" />
                  <span>+ Enter to save</span>
                </div>
                <button
                  disabled={isSubmitting}
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700 active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting ? "Saving..." : "Save to Library"}
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* Prompts Grid (Masonry Effect via CSS columns) */}
        {loading ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {[1, 2, 3, 4, 5, 6].map((i) => <PromptSkeleton key={i} />)}
          </div>
        ) : filtered.length > 0 ? (
          <div className="columns-1 md:columns-2 lg:columns-3 gap-6 space-y-6">
            {filtered.map((p) => (
              <div 
                key={p.id} 
                className="group break-inside-avoid relative rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md hover:border-indigo-200"
              >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h3 className="font-bold text-slate-900 leading-tight">{p.title}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-2 items-center">
                      {p.category && (
                        <span className="inline-flex items-center rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700">
                          {p.category}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" /> {getRelativeTime(p.created_at)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="relative mb-4 overflow-hidden">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-600 font-mono bg-slate-50/50 p-3 rounded-lg border border-slate-100">
                    {p.content.length > 300 ? p.content.slice(0, 300) + "..." : p.content}
                  </p>
                  {p.content.length > 300 && (
                     <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-slate-50 to-transparent pointer-events-none" />
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between border-t border-slate-100 pt-3 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                   <button
                    onClick={() => handleCopy(p.content)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-indigo-600 transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy
                  </button>
                  
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="flex items-center gap-1.5 text-xs font-medium text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-slate-100 p-4">
              <Filter className="h-8 w-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900">No prompts found</h3>
            <p className="text-slate-500 max-w-xs mx-auto mt-1">
              Try adjusting your search or create a new prompt to get started.
            </p>
          </div>
        )}
      </main>
    </div>
  );
 }