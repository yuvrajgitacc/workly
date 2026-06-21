import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { portalWebhooks } from "../../lib/portalApi"; 
import { usePortalAuthStore } from "../../stores/portalAuthStore";
import { Plus, Lock, Bell, X, Trash2, Edit2, Play, ChevronRight, RefreshCw, AlertTriangle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-hot-toast";
import CopyButton from "../../components/CopyButton";

const AVAILABLE_EVENTS = [
  { id: "resume.parsed", desc: "Fired when each resume is parsed" },
  { id: "batch.completed", desc: "Fired when batch upload finishes" },
  { id: "match.done", desc: "Fired when matching completes" },
  { id: "candidate.hired", desc: "Fired when candidate is hired" },
  { id: "candidate.rejected", desc: "Fired when candidate is rejected" },
  { id: "session.created", desc: "Fired when new session is created" }
];

export default function DeveloperWebhooks() {
  const { tier } = usePortalAuthStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [activeWebhook, setActiveWebhook] = useState(null);

  // Modal states
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState([]);
  const [createdSecret, setCreatedSecret] = useState(null);

  const isFree = tier === "free" || !tier;

  const fetchWebhooks = async () => {
    if (portalWebhooks?.list) return portalWebhooks.list();
    return [];
  };

  const { data: webhooks, refetch } = useQuery({
    queryKey: ["webhooks"],
    queryFn: fetchWebhooks,
    enabled: !isFree
  });

  const { data: logsData, isLoading: logsLoading, refetch: refetchLogs } = useQuery({
    queryKey: ["webhook-logs", activeWebhook?.id],
    queryFn: () => portalWebhooks.logs(activeWebhook.id),
    enabled: !!activeWebhook?.id
  });

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!url.startsWith("https://") && !url.startsWith("http://")) return toast.error("Invalid URL protocol");
    if (selectedEvents.length === 0) return toast.error("Select at least one event");
    
    try {
      const res = await portalWebhooks.create({ url, events: selectedEvents });
      setCreatedSecret(res.secret);
      toast.success("Webhook created");
    } catch (err) {
      toast.error(err.message || "Failed to create webhook");
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm("Delete this webhook?")) {
      try {
        await portalWebhooks.delete(id);
        toast.success("Webhook deleted");
        refetch();
      } catch (err) {
        toast.error(err.message || "Failed to delete webhook");
      }
    }
  };

  const handleTest = async (id) => {
    try {
      const res = await portalWebhooks.test(id);
      if (res.delivered) {
        toast.success(`Test webhook delivered (Status ${res.status_code})`);
      } else {
        toast.error(`Delivery failed: ${res.error || ('Status ' + res.status_code)}`);
      }
      refetch();
    } catch (err) {
      toast.error(err.message || "Failed to test webhook");
    }
  };

  const openLogs = (webhook) => {
    setActiveWebhook(webhook);
    setPanelOpen(true);
  };

  if (isFree) {
    return (
      <div className="w-full max-w-5xl mx-auto flex items-center justify-center min-h-[60vh] relative">
         <div className="bg-white border-2 border-gray-100 rounded-3xl p-10 max-w-lg w-full flex flex-col items-center text-center shadow-2xl relative z-10">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-gray-400 mb-6"><Lock size={32} /></div>
            <h2 className="text-2xl font-black text-charcoal mb-3">Webhooks require Starter plan</h2>
            <p className="text-gray-500 font-medium mb-8">Receive real-time HTTP callbacks to your infrastructure when processing completes. Eliminate constant polling.</p>
            <Link to="/developer/portal/billing" className="w-full py-4 bg-accent text-white text-sm font-bold rounded-2xl hover:bg-accent-dark transition-all text-center">Upgrade to Starter &rarr;</Link>
         </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto pb-12 relative flex overflow-hidden">
      <div className={`flex-1 transition-all duration-300 ${panelOpen ? "pr-4 sm:pr-96" : ""}`}>
         {/* HEADER */}
         <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8">
            <div>
               <h1 className="text-3xl font-black text-charcoal">Webhooks</h1>
               <p className="text-gray-500 font-medium mt-1">Receive event notifications directly to your application.</p>
            </div>
            <button onClick={() => { setCreatedSecret(null); setUrl(""); setSelectedEvents([]); setIsModalOpen(true); }} className="flex items-center gap-2 bg-accent text-white px-5 py-2.5 rounded-xl font-bold hover:bg-accent-dark transition-all shadow-md shadow-accent/20">
               <Plus size={18} /> Add Webhook
            </button>
         </div>

         {/* LIST */}
         <div className="flex flex-col gap-6">
            {webhooks?.length > 0 ? webhooks.map(wh => (
              <div key={wh.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:border-gray-300 transition-all">
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <Bell className="text-gray-400" size={20} />
                    <h3 className="font-bold text-lg text-charcoal truncate max-w-[300px] sm:max-w-md">{wh.url}</h3>
                  </div>
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <div className={`w-2 h-2 rounded-full ${wh.is_active ? "bg-green-500" : "bg-gray-400"}`}></div>
                    <span className={wh.is_active ? "text-green-600" : "text-gray-500"}>{wh.is_active ? "Active" : "Inactive"}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 mb-6">
                  {wh.events.map(ev => (
                    <span key={ev} className="bg-gray-100 border border-gray-200 text-gray-600 text-xs px-2.5 py-1 rounded-full font-bold">{ev}</span>
                  ))}
                </div>

                <div className="flex gap-8 text-[13px] font-medium text-gray-500 mb-6 pb-6 border-b border-gray-100">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Success Rate</span>
                    <span className="text-charcoal font-bold">{wh.success_rate}%</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Last Triggered</span>
                    <span>{wh.last_triggered}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-gray-400 text-[10px] uppercase tracking-wider font-bold">Failures (24h)</span>
                    <span className={wh.fail_count > 5 ? "text-red-500 font-bold" : ""}>{wh.fail_count}</span>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <button onClick={() => handleTest(wh.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><Play size={14}/> Test</button>
                  <button onClick={() => openLogs(wh)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><ChevronRight size={14}/> View Logs</button>
                  <div className="flex-1"></div>
                  <button onClick={() => handleDelete(wh.id)} className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-bold text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /> Delete</button>
                </div>
              </div>
            )) : (
              <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl">
                <p className="text-gray-400 font-medium">No webhooks configured.</p>
              </div>
            )}
         </div>
      </div>

      {/* RIGHT SLIDE PANEL LOGS */}
      <AnimatePresence>
        {panelOpen && (
          <motion.div initial={{x: "100%"}} animate={{x: 0}} exit={{x: "100%"}} className="fixed top-0 right-0 h-full w-full sm:w-[400px] bg-white border-l border-gray-200 shadow-2xl z-40 flex flex-col pt-16 md:pt-0">
             <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50 md:mt-0 mt-4">
               <div>
                  <h3 className="font-bold text-charcoal">Delivery Logs</h3>
                  <p className="text-xs text-gray-500 font-medium truncate max-w-[250px]">{activeWebhook?.url}</p>
               </div>
               <button onClick={() => setPanelOpen(false)} className="p-2 hover:bg-gray-200 rounded-full text-gray-500"><X size={20}/></button>
             </div>
              <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-3 hide-scrollbar">
                {logsLoading ? (
                  <div className="text-center py-8 text-sm font-semibold text-gray-400">Loading logs...</div>
                ) : logsData && logsData.length > 0 ? (
                  logsData.map((log) => {
                    const isFail = !log.status_code || log.status_code < 200 || log.status_code >= 300;
                    return (
                      <div key={log.id} className="bg-gray-50 border border-gray-200 p-3 rounded-xl">
                         <div className="flex justify-between items-start mb-2">
                           <span className="text-xs font-bold text-charcoal bg-white border border-gray-200 px-2 py-0.5 rounded-md">{log.event_type}</span>
                           <span className="text-[11px] font-semibold text-gray-400">
                             {new Date(log.created_at).toLocaleTimeString()}
                           </span>
                         </div>
                         <div className="flex items-center justify-between text-sm font-medium">
                           <span className={`px-2 py-0.5 rounded w-fit text-xs font-bold ${isFail ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
                             {log.status_code ? `${log.status_code} ${log.status_code >= 400 ? 'Error' : 'OK'}` : 'Failed'}
                           </span>
                           {isFail && log.error && <p className="text-[10px] text-red-500 mt-1">{log.error}</p>}
                         </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-8 text-sm font-semibold text-gray-400">No delivery logs found</div>
                )}
              </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ADD WEBHOOK MODAL */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-charcoal"><X size={20}/></button>

              {createdSecret ? (
                <div className="p-8 flex flex-col items-center">
                  <div className="w-16 h-16 bg-green-100 text-green-500 rounded-full flex items-center justify-center mb-4"><CheckCircle size={32} /></div>
                  <h2 className="text-2xl font-black text-charcoal mb-2">Webhook Created</h2>
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 mt-2">
                    <p className="text-sm font-semibold text-amber-800 mb-3 flex items-center gap-1.5"><AlertTriangle size={16} /> Use this signing secret to cryptographically verify the payload. <strong className="font-black">Never shown again.</strong></p>
                    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg p-2 px-3 w-full">
                      <code className="text-xs flex-1 text-gray-600 font-mono break-all whitespace-pre-wrap">{createdSecret}</code>
                      <CopyButton text={createdSecret} />
                    </div>
                  </div>
                  <button onClick={() => {setIsModalOpen(false); refetch();}} className="w-full py-3 rounded-xl bg-accent text-white font-bold hover:bg-accent-dark transition-colors">Done</button>
                </div>
              ) : (
                <div className="p-8">
                  <h2 className="text-2xl font-black text-charcoal mb-6">Add Webhook</h2>
                  <form onSubmit={handleCreate} className="flex flex-col gap-6">
                    <div className="flex flex-col gap-1.5">
                       <label className="text-sm font-semibold text-charcoal">Endpoint URL*</label>
                       <input autoFocus type="url" placeholder="https://yourapp.com/webhooks/vishleshan" value={url} onChange={e=>setUrl(e.target.value)} required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-accent/20 focus:border-accent outline-none font-medium text-sm" />
                    </div>
                    <div>
                       <label className="text-sm font-semibold text-charcoal mb-2 block">Events to send</label>
                       <div className="flex flex-col gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                         {AVAILABLE_EVENTS.map(ev => (
                           <label key={ev.id} className="flex items-start gap-3 cursor-pointer group">
                             <input type="checkbox" checked={selectedEvents.includes(ev.id)} onChange={e => {
                               if (e.target.checked) setSelectedEvents([...selectedEvents, ev.id]);
                               else setSelectedEvents(selectedEvents.filter(id => id !== ev.id));
                             }} className="mt-1 w-4 h-4 accent-accent rounded" />
                             <div className="flex flex-col">
                               <span className="text-sm font-bold text-gray-700 group-hover:text-charcoal transition-colors">{ev.id}</span>
                               <span className="text-xs font-medium text-gray-400">{ev.desc}</span>
                             </div>
                           </label>
                         ))}
                       </div>
                    </div>
                    <button type="submit" className="w-full mt-2 bg-accent text-white py-3.5 rounded-xl font-bold hover:bg-accent-dark transition-all">Create Webhook</button>
                  </form>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function CheckCircle({size, className}) { return <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>; }
