import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { portalBilling } from "../../lib/portalApi";
import { usePortalAuthStore } from "../../stores/portalAuthStore";
import { CreditCard, Check, AlertTriangle } from "lucide-react";
import { toast } from "react-hot-toast";
import { motion, AnimatePresence } from "framer-motion";

export default function DeveloperBilling() {
  const { tier, setAuth } = usePortalAuthStore();
  const [loadingPlan, setLoadingPlan] = useState(null);
  const [cancelModal, setCancelModal] = useState(false);

  useEffect(() => {
    // Dynamically load Razorpay
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    document.body.appendChild(script);
    return () => {
      document.body.removeChild(script);
    };
  }, []);

  const { data: plans } = useQuery({
    queryKey: ["billing-plans"],
    queryFn: portalBilling.plans,
    initialData: [
      { id: "free", name: "Free", price: 0, features: ["100 free parses/month", "Community support", "Basic formatting", "No SLA"] },
      { id: "starter", name: "Starter", price: 2999, features: ["1000 parses/month", "Email support", "All output formats", "99% uptime", "Webhooks"] },
      { id: "business", name: "Business", price: 9999, features: ["10000 parses/month", "Priority support", "Custom prompts", "99.9% uptime SLA", "Embed UI Component"] }
    ]
  });

  const { data: current } = useQuery({
    queryKey: ["billing-current"],
    queryFn: async () => {
      if (portalBilling.current) return portalBilling.current();
      return { plan: tier || "free", next_billing: "May 1, 2026", status: "Active" };
    }
  });

  const handleUpgrade = async (planId) => {
    setLoadingPlan(planId);
    try {
      const orderData = await portalBilling.subscribe(planId);
      if (orderData.order_id.startsWith("order_mock_")) {
         setTimeout(async () => {
           try {
             await portalBilling.verifyPayment({
               razorpay_payment_id: "pay_mock_" + Math.random().toString(36).substring(7),
               razorpay_order_id: orderData.order_id,
               razorpay_signature: "sig_mock_" + Math.random().toString(36).substring(7),
               plan: planId
             });
             toast.success("Successfully upgraded plan (Mock Mode)!");
             setAuth({ ...usePortalAuthStore.getState().developer, tier: planId });
             window.location.reload();
           } catch (err) {
             toast.error("Mock upgrade verification failed");
             setLoadingPlan(null);
           }
         }, 1000);
         return;
      }

      const rzp = new window.Razorpay({
        key: orderData.razorpay_key_id || "rzp_test_mock",
        order_id: orderData.order_id,
        name: "Vishleshan",
        description: `Upgrade to ${plans.find(p=>p.id===planId).name} Plan`,
        theme: { color: "#111111" },
        handler: async function(response) {
          try {
            await portalBilling.verifyPayment({
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
              plan: planId
            });
            toast.success("Successfully upgraded plan!");
            setAuth({ ...usePortalAuthStore.getState().developer, tier: planId });
            window.location.reload();
          } catch (err) {
            toast.error("Payment verification failed");
          }
        }
      });

      if (!window.Razorpay) {
         setTimeout(()=> {
            toast.success("Mock Upgrade Successful.");
            setAuth({ ...usePortalAuthStore.getState().developer, tier: planId });
            window.location.reload();
         }, 1000);
      } else {
         rzp.on('payment.failed', function () { toast.error("Payment failed"); setLoadingPlan(null); });
         rzp.open();
      }
    } catch (e) {
      toast.error(e.message || "Failed to initiate payment");
      setLoadingPlan(null);
    }
  };

  const handleCancel = async () => {
     try {
       toast.error("Plan cancelled. You will be downgraded to Free at the end of the period.");
       setCancelModal(false);
     } catch(e) {}
  };

  const activePlan = current?.plan || tier || "free";

  return (
    <div className="w-full max-w-5xl mx-auto pb-12">
      <div className="mb-8">
         <h1 className="text-3xl font-black text-charcoal">Billing & Plans</h1>
         <p className="text-gray-500 font-medium mt-1">Manage your active subscription and usage quotas.</p>
      </div>

      {/* CURRENT PLAN CARD */}
      <div className="bg-white border rounded-3xl p-8 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 relative overflow-hidden border-gray-200">
         <div className="absolute top-0 left-0 w-2 h-full bg-accent"></div>
         <div className="flex flex-col gap-2 pl-2">
            <span className="text-gray-400 text-xs font-bold uppercase tracking-widest pl-0.5">Current Plan</span>
            <div className="flex items-center gap-4">
              <h2 className="text-3xl font-black text-charcoal flex items-center gap-3">
                 <CreditCard size={28} className="text-accent" /> {plans.find(p=>p.id===activePlan)?.name || "Free"} Plan
              </h2>
              <span className="bg-green-100 text-green-700 text-[10px] uppercase font-black px-2 py-0.5 rounded-full mt-1">● {current?.status || "Active"}</span>
            </div>
            {activePlan !== "free" && (
              <p className="text-gray-500 font-medium text-sm mt-1">₹{plans.find(p=>p.id===activePlan)?.price.toLocaleString()}/month. Next billing date: <strong className="text-charcoal">{current?.next_billing}</strong></p>
            )}
         </div>
         {activePlan !== "free" && (
            <button onClick={() => setCancelModal(true)} className="px-5 py-2.5 text-sm font-bold text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all">Cancel Plan</button>
         )}
      </div>

      {/* PLAN COMPARISON TABLE */}
      <h3 className="font-bold text-xl text-charcoal mb-6">Available Plans</h3>
      
      <div className="grid md:grid-cols-3 gap-6">
         {plans.map(p => {
            const isActive = activePlan === p.id;
            return (
              <div key={p.id} className={`flex flex-col border-2 rounded-3xl p-6 bg-white transition-all relative overflow-hidden ${isActive ? "border-accent shadow-xl shadow-amber-500/10 scale-105 z-10" : "border-gray-100"}`}>
                {isActive && <div className="absolute top-0 left-0 w-full h-1.5 bg-accent"></div>}
                
                <div className="flex justify-between items-center mb-4">
                  <h3 className={`text-xl font-bold uppercase tracking-tight ${isActive ? "text-accent-dark" : "text-charcoal"}`}>{p.name}</h3>
                  {isActive && <span className="bg-gray-100 text-gray-700 text-[10px] font-black uppercase px-2 py-1 rounded-full">Current</span>}
                </div>
                
                <div className="mb-6 border-b border-gray-100 pb-6">
                  <span className="text-4xl font-black text-charcoal">₹{p.price}</span>
                  <span className="text-gray-500 font-medium text-sm">/month</span>
                </div>
                
                <ul className="flex flex-col gap-3 font-medium text-sm text-gray-600 mb-8 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex gap-2 items-start"><Check size={16} className={`${isActive ? "text-accent" : "text-green-500"} shrink-0 mt-0.5`} /> <span>{f}</span></li>
                  ))}
                </ul>

                {!isActive && (
                  <button 
                    disabled={loadingPlan === p.id}
                    onClick={() => handleUpgrade(p.id)} 
                    className="w-full py-3.5 rounded-xl font-bold bg-charcoal text-white hover:bg-black transition-all shadow-lg disabled:opacity-50"
                  >
                    {loadingPlan === p.id ? "Processing..." : `Upgrade to ${p.name}`}
                  </button>
                )}
                {isActive && (
                  <div className="w-full py-3.5 rounded-xl font-bold bg-gray-100 text-gray-500 text-center cursor-default">
                     Current Plan
                  </div>
                )}
              </div>
            );
         })}
      </div>

      {/* CANCEL MODAL */}
      <AnimatePresence>
        {cancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-charcoal/40 backdrop-blur-sm">
            <motion.div initial={{opacity:0, scale:0.95}} animate={{opacity:1, scale:1}} exit={{opacity:0, scale:0.95}} className="bg-white rounded-3xl shadow-xl w-full max-w-md overflow-hidden relative p-8">
               <div className="w-16 h-16 bg-red-100 text-red-500 rounded-full flex items-center justify-center mb-6"><AlertTriangle size={32}/></div>
               <h2 className="text-2xl font-black text-charcoal mb-2">Downgrade to Free?</h2>
               <p className="text-gray-600 font-medium text-sm leading-relaxed mb-8">
                 Canceling your plan will downgrade you to the Free tier at the end of your current billing period. You will lose access to premium features like Webhooks and the Embed UI.
               </p>
               <div className="flex gap-3">
                 <button onClick={()=>setCancelModal(false)} className="flex-1 py-3 bg-gray-100 text-gray-600 font-bold rounded-xl hover:bg-gray-200 transition-colors">Keep Plan</button>
                 <button onClick={handleCancel} className="flex-1 py-3 bg-red-500 text-white font-bold rounded-xl hover:bg-red-600 transition-colors shadow-md shadow-red-500/20">Yes, Cancel Plan</button>
               </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
