import React, { useEffect, useState } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import { LayoutDashboard, Key, BarChart2, Webhook, Code, CreditCard, BookOpen, Settings, LogOut, Menu, X } from "lucide-react";
import { usePortalAuthStore } from "../../stores/portalAuthStore";
import { portalAuth } from "../../lib/portalApi";
import { motion } from "framer-motion";
import UsageProgress from "../../components/developer/UsageProgress";

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { hasError: false }; }
  static getDerivedStateFromError(error) { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="p-8 w-full"><div className="bg-red-50 text-red-500 font-bold p-6 rounded-xl border border-red-200 flex flex-col items-start gap-3"><h3>Something went wrong.</h3><button onClick={()=>window.location.reload()} className="px-4 py-2 bg-red-100 rounded-lg text-sm">Retry</button></div></div>;
    return this.props.children;
  }
}

export default function DeveloperPortalLayout() {
  const { jwt, developer, company_name, initFromStorage, clearAuth, setAuth } = usePortalAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const [mobileMenu, setMobileMenu] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    initFromStorage();
    setMounted(true);
    const token = usePortalAuthStore.getState().jwt || localStorage.getItem("portal_jwt");
    if (!token) {
      navigate("/developer/login");
      return;
    }

    // Refresh profile on layout mount
    portalAuth.getMe()
      .then((meData) => {
        setAuth(meData);
      })
      .catch((err) => {
        console.error("Failed to sync developer info:", err);
        if (err.message === "Session expired" || err.message === "Unauthorized") {
          clearAuth();
        }
      });
  }, [initFromStorage, navigate, setAuth, clearAuth]);

  if (!mounted || !jwt) return null;

  const navItems = [
    { name: "Overview", href: "/developer/portal/dashboard", icon: LayoutDashboard },
    { name: "API Keys", href: "/developer/portal/keys", icon: Key },
    { name: "Usage & Logs", href: "/developer/portal/usage", icon: BarChart2 },
    { name: "Webhooks", href: "/developer/portal/webhooks", icon: Webhook },
    { name: "Embed", href: "/developer/portal/embed", icon: Code },
    { name: "Billing", href: "/developer/portal/billing", icon: CreditCard },
  ];

  const bottomItems = [
    { name: "API Docs", href: "/developer/portal/docs", icon: BookOpen },
    { name: "Settings", href: "/developer/portal/settings", icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-bg overflow-hidden font-sans text-charcoal" style={{ '--accent': '#2563eb', '--accent-foreground': '#ffffff', '--accent-light': '#EFF6FF' }}>
      
      {/* Mobile Toggle */}
      <div className="md:hidden fixed top-0 w-full bg-white border-b z-50 p-4 flex justify-between items-center text-charcoal shadow-sm">
        <div className="flex items-center gap-2">
          <Key className="text-accent" size={24} />
          <span className="font-bold">Portal</span>
        </div>
        <button onClick={() => setMobileMenu(!mobileMenu)} className="p-2">
          {mobileMenu ? <X /> : <Menu />}
        </button>
      </div>

      {/* Sidebar */}
      <aside className={`${mobileMenu ? "translate-x-0" : "-translate-x-full"} md:translate-x-0 fixed md:relative z-40 w-64 h-full bg-white border-r border-[#e6dfcd] flex flex-col transition-transform duration-300 ease-in-out`}>
        
        <div className="p-6 pb-2">
          <div className="flex items-start flex-col mb-8 gap-0.5 mt-4 md:mt-0">
             <span className="text-2xl font-black text-accent tracking-tight cursor-pointer" onClick={() => navigate("/developer")}>Vishleshan</span>
             <span className="text-xs font-bold text-gray-700 uppercase tracking-widest pl-0.5">Dev Portal</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 hide-scrollbar">
          <div className="flex flex-col gap-1 mb-8">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname.startsWith(item.href);
              return (
                <button
                  key={item.href}
                  onClick={() => { navigate(item.href); setMobileMenu(false); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                    isActive ? "bg-gray-100 border border-gray-200 text-black" : "text-gray-850 hover:bg-gray-50 hover:text-black"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-black stroke-[2.5]" : "text-gray-700"} />
                  {item.name}
                </button>
              )
            })}
          </div>

          <div className="flex flex-col gap-1 mb-4 border-t border-[#e6dfcd] pt-4">
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <button
                  key={item.href}
                  onClick={() => { navigate(item.href); setMobileMenu(false); }}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl font-bold transition-all text-left ${
                    isActive ? "bg-gray-100 text-black" : "text-gray-850 hover:bg-gray-50 hover:text-black"
                  }`}
                >
                  <Icon size={18} className={isActive ? "text-black" : "text-gray-700"} />
                  {item.name}
                </button>
              )
            })}
             <button
                onClick={clearAuth}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl font-semibold text-red-500 hover:bg-red-50 transition-all mt-2 text-left"
              >
                <LogOut size={18} className="text-red-400" />
                Logout
              </button>
          </div>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-[#e6dfcd] bg-gray-50/50">
           <UsageProgress />
            
            <div className="flex items-center gap-2 pt-4 mt-3 border-t border-gray-100">
              <div className="w-8 h-8 rounded-full bg-accent text-white flex items-center justify-center font-bold text-sm tracking-tighter shrink-0 cursor-default">
                {(company_name || developer?.email || "D").substring(0, 2).toUpperCase()}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-sm font-bold truncate text-charcoal">{company_name || "Developer"}</span>
                <span className="text-[11px] text-gray-750 truncate font-bold">{developer?.email || "developer@example.com"}</span>
              </div>
            </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto bg-white md:mt-0 mt-16 md:p-8 p-4 relative z-0 hide-scrollbar">
          <ErrorBoundary>
              <motion.div key={pathname} initial={{opacity:0}} animate={{opacity:1}} transition={{duration:0.08}} className="w-full h-full">
                <Outlet />
              </motion.div>
          </ErrorBoundary>
      </main>

      {/* Mobile overlay */}
      {mobileMenu && (
        <div 
          className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-30 md:hidden"
          onClick={() => setMobileMenu(false)}
        />
      )}
    </div>
  );
}
