"use client";

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { 
  Plus, Search, Copy, Trash2, Sparkles, 
  Tag, X, Command, Calendar, Filter,
  Heart, MessageCircle, Send, User, MoreHorizontal, ThumbsDown, LogOut
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabaseClient"; // Make sure this path is correct

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
type Comment = {
  id: string;
  user_name: string;
  text: string;
  created_at: string;
};

type Prompt = {
  id: string;
  author_id: string;
  author_name: string;
  title: string;
  content: string;
  category: string;
  created_at: string;
  likes: number;
  liked_by_user: boolean;
  comments: Comment[];
};

type ToastType = { id: number; message: string; type: "success" | "error" };

// --- COMPONENTS ---

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
        <span className="text-sm font-medium">{toast.message}</span>
      </div>
    ))}
  </div>
);

// --- MAIN APP ---
export default function SocialPromptApp() {
  const [user, setUser] = useState<any>(null); // SUPABASE USER STATE
  const [prompts, setPrompts] = useState<Prompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [toasts, setToasts] = useState<ToastType[]>([]);
  
  // Form State
  const [form, setForm] = useState({ title: "", content: "", category: "" });
  
  // Comment Input State
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});

  const addToast = useCallback((message: string, type: "success" | "error" = "success") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // --- SUPABASE AUTH ---
  useEffect(() => {
    // 1. Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const loginWithGoogle = async () => {
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin }
    });
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
    addToast("Logged out successfully");
  };

  // --- DATA LOADING ---
  const loadPrompts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/prompts");
      const data = await res.json();
      
      const socialData = data.map((p: any) => ({
        ...p,
        likes: p.likes || 0,
        liked_by_user: false,
        comments: p.comments || [],
        author_id: p.author_id || "other_user",
        author_name: p.author_name || "Anonymous"
      }));
      setPrompts(socialData.sort((a: Prompt, b: Prompt) => 
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      ));
    } catch {
      // Mock Data Fallback
      setPrompts([
        {
          id: "1", author_id: "other_user", author_name: "DesignGuru",
          title: "Midjourney Photorealism", content: "Hyper realistic photo of...", category: "Art", created_at: new Date().toISOString(),
          likes: 45, liked_by_user: false, comments: []
        },
        // We use the real user ID if logged in, otherwise a dummy ID for the demo
        {
          id: "2", author_id: user?.id || "demo_id", author_name: user?.user_metadata?.full_name || "You",
          title: "Python Debugger", content: "Act as a python expert...", category: "Code", created_at: new Date().toISOString(),
          likes: 12, liked_by_user: true, comments: []
        }
      ]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadPrompts(); }, [loadPrompts]);

  // --- ACTIONS ---

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user) {
      addToast("Please login to share prompts", "error");
      return;
    }
    if (!form.title.trim() || !form.content.trim()) return;

    const newPrompt: Prompt = {
      id: Date.now().toString(),
      author_id: user.id, // REAL USER ID
      author_name: user.user_metadata?.full_name || user.email?.split('@')[0] || "Anonymous",
      ...form,
      created_at: new Date().toISOString(),
      likes: 0,
      liked_by_user: false,
      comments: []
    };

    setPrompts([newPrompt, ...prompts]);
    setForm({ title: "", content: "", category: "" });
    setShowForm(false);
    addToast("Prompt Shared!");
    
    // await fetch("/api/prompts", { method: "POST", body: JSON.stringify(newPrompt) });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this prompt?")) return;
    setPrompts((prev) => prev.filter((p) => p.id !== id));
    addToast("Prompt deleted");
    // await fetch(`/api/prompts/${id}`, { method: "DELETE" });
  };

  const handleLike = (id: string) => {
    if (!user) {
      addToast("Login to like posts", "error");
      return;
    }
    setPrompts(prev => prev.map(p => {
      if (p.id === id) {
        const isLiked = !p.liked_by_user;
        return {
          ...p,
          liked_by_user: isLiked,
          likes: isLiked ? p.likes + 1 : p.likes - 1
        };
      }
      return p;
    }));
  };

  const handleCommentSubmit = (id: string) => {
    if (!user) {
       addToast("Login to comment", "error");
       return;
    }
    const text = commentInputs[id];
    if (!text?.trim()) return;

    const newComment: Comment = {
      id: Date.now().toString(),
      user_name: user.user_metadata?.full_name || "User",
      text: text,
      created_at: new Date().toISOString()
    };

    setPrompts(prev => prev.map(p => 
      p.id === id ? { ...p, comments: [...p.comments, newComment] } : p
    ));

    setCommentInputs(prev => ({ ...prev, [id]: "" }));
  };

  const handleCopy = async (text: string) => {
    await navigator.clipboard.writeText(text);
    addToast("Copied to clipboard");
  };

  // Filtering
  const categories = useMemo(() => ["All", ...Array.from(new Set(prompts.map(p => p.category).filter(Boolean)))], [prompts]);
  const filtered = prompts.filter(p => {
    const matchSearch = (p.title + p.content).toLowerCase().includes(search.toLowerCase());
    const matchCat = activeTab === "All" || p.category === activeTab;
    return matchSearch && matchCat;
  });

  return (
    <div className="min-h-screen bg-gray-50 text-slate-900 font-sans">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      {/* --- INSTAGRAM STYLE PROFILE HEADER --- */}
      <div className="bg-white border-b border-gray-200 pt-8 pb-6 mb-6">
        <div className="max-w-4xl mx-auto px-4 flex items-center gap-6">
          
          {/* Avatar (Dynamic based on login) */}
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-full bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-[2px]">
            <div className="w-full h-full rounded-full bg-white p-1">
              {user?.user_metadata?.avatar_url ? (
                <img 
                  src={user.user_metadata.avatar_url} 
                  alt="Avatar" 
                  className="w-full h-full rounded-full object-cover"
                />
              ) : (
                <div className="w-full h-full rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                  <User className="w-10 h-10" />
                </div>
              )}
            </div>
          </div>
          
          {/* Stats & Info OR Login Button */}
          <div className="flex-1">
            {user ? (
              // LOGGED IN VIEW
              <>
                <div className="flex items-center gap-4 mb-3">
                  <h2 className="text-xl md:text-2xl font-bold">
                    {user.user_metadata?.full_name || user.email?.split('@')[0]}
                  </h2>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setShowForm(true)}
                      className="bg-black text-white px-4 py-1.5 rounded-lg text-sm font-semibold hover:bg-gray-800 transition"
                    >
                      Share Prompt
                    </button>
                    <button 
                      onClick={handleLogout}
                      className="border border-gray-300 px-3 py-1.5 rounded-lg hover:bg-gray-50"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4 text-gray-600" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-6 text-sm md:text-base">
                  <div><span className="font-bold">{prompts.filter(p => p.author_id === user.id).length}</span> posts</div>
                  <div><span className="font-bold">{prompts.reduce((acc, p) => p.author_id === user.id ? acc + p.likes : acc, 0)}</span> likes received</div>
                </div>
                <p className="mt-3 text-sm text-gray-600">{user.email}</p>
              </>
            ) : (
              // LOGGED OUT VIEW
              <div className="space-y-3">
                <h2 className="text-2xl font-bold">Welcome to PromptSocial</h2>
                <p className="text-gray-600">Join the community to share, like, and comment on AI prompts.</p>
                <button
                  onClick={loginWithGoogle}
                  className="flex items-center gap-2 bg-red-600 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-red-700 transition shadow-sm"
                >
                  {/* Simple Google Icon SVG */}
                  <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .533 5.333.533 12S5.867 24 12.48 24c3.44 0 6.013-1.133 8.027-3.24 2.053-2.053 2.627-4.96 2.627-7.467 0-.573-.053-1.093-.12-1.627h-10.53z"/></svg>
                  Login with Google
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- CREATE FORM MODAL --- */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-lg">New Post</h3>
              <button onClick={() => setShowForm(false)}><X/></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <input 
                placeholder="Title" 
                className="w-full border p-2 rounded-lg"
                value={form.title}
                onChange={e => setForm({...form, title: e.target.value})}
              />
               <input 
                placeholder="Category" 
                className="w-full border p-2 rounded-lg"
                value={form.category}
                onChange={e => setForm({...form, category: e.target.value})}
              />
              <textarea 
                placeholder="Prompt content..." 
                className="w-full border p-2 rounded-lg h-32"
                value={form.content}
                onChange={e => setForm({...form, content: e.target.value})}
              />
              <button className="w-full bg-blue-600 text-white py-2 rounded-lg font-bold">Share</button>
            </form>
          </div>
        </div>
      )}

      {/* --- FEED --- */}
      <main className="max-w-2xl mx-auto p-4 space-y-6">
        
        {/* Search & Filter */}
        <div className="sticky top-4 z-30 flex flex-col gap-3 bg-gray-50/95 backdrop-blur-sm pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
            <input 
              className="w-full bg-white border border-gray-300 rounded-lg pl-9 p-2 focus:ring-2 focus:ring-black outline-none"
              placeholder="Search prompts..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {categories.map(cat => (
              <button key={cat} onClick={() => setActiveTab(cat)} className={cn("px-4 py-1 rounded-full text-sm font-medium border whitespace-nowrap", activeTab === cat ? "bg-black text-white" : "bg-white text-gray-600")}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* POSTS LIST */}
        {loading ? <div className="text-center py-10">Loading feed...</div> : filtered.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
            
            {/* Post Header */}
            <div className="p-3 flex items-center justify-between border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center overflow-hidden">
                   {/* Avatar Placeholder for Post Author */}
                   <span className="font-bold text-xs text-gray-500">{p.author_name[0]}</span>
                </div>
                <div>
                  <div className="font-bold text-sm">{p.author_name}</div>
                  <div className="text-xs text-gray-400" suppressHydrationWarning>{getRelativeTime(p.created_at)}</div>
                </div>
              </div>
              
              {/* Only Owner can see Delete */}
              {user && p.author_id === user.id && (
                <button onClick={() => handleDelete(p.id)} className="text-gray-400 hover:text-red-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Post Content */}
            <div className="p-4 bg-gray-50/50">
               <h3 className="font-bold mb-2 text-lg">{p.title}</h3>
               <div className="font-mono text-sm text-gray-700 bg-white p-3 border rounded-md whitespace-pre-wrap">
                  {p.content}
               </div>
               {p.category && <div className="mt-2 text-blue-600 text-sm font-medium">#{p.category}</div>}
            </div>

            {/* Actions Bar */}
            <div className="px-4 py-3 flex items-center gap-4">
              <button 
                onClick={() => handleLike(p.id)}
                className="flex items-center gap-1.5 group"
              >
                <Heart className={cn("w-6 h-6 transition-all", p.liked_by_user ? "fill-red-500 text-red-500 scale-110" : "text-gray-600 group-hover:text-gray-900")} />
                <span className="font-semibold text-sm">{p.likes}</span>
              </button>

              <button className="flex items-center gap-1.5 text-gray-600 hover:text-gray-900">
                <MessageCircle className="w-6 h-6" />
                <span className="font-semibold text-sm">{p.comments.length}</span>
              </button>

              <div className="flex-1" />

              <button onClick={() => handleCopy(p.content)} className="flex items-center gap-1 text-sm font-semibold bg-gray-100 px-3 py-1.5 rounded-full hover:bg-gray-200 transition">
                <Copy className="w-4 h-4" /> Copy
              </button>
            </div>

            {/* Comments Section */}
            <div className="px-4 pb-4 border-t border-gray-50 pt-3">
              {p.comments.length > 0 && (
                <div className="space-y-2 mb-3 max-h-32 overflow-y-auto">
                  {p.comments.map(c => (
                    <div key={c.id} className="text-sm">
                      <span className="font-bold mr-2">{c.user_name}</span>
                      <span className="text-gray-700">{c.text}</span>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2">
                <input 
                  className="flex-1 text-sm outline-none placeholder:text-gray-400"
                  placeholder={user ? "Add a comment..." : "Login to comment"}
                  disabled={!user}
                  value={commentInputs[p.id] || ""}
                  onChange={(e) => setCommentInputs(prev => ({ ...prev, [p.id]: e.target.value }))}
                  onKeyDown={(e) => e.key === 'Enter' && handleCommentSubmit(p.id)}
                />
                <button 
                  onClick={() => handleCommentSubmit(p.id)}
                  disabled={!user || !commentInputs[p.id]?.trim()}
                  className="text-blue-600 font-bold text-sm disabled:opacity-30 hover:text-blue-800"
                >
                  Post
                </button>
              </div>
            </div>

          </div>
        ))}
      </main>
    </div>
  );
}