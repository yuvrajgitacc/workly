import React from 'react';
import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { CheckCircle, XCircle, Loader2, Shield } from "lucide-react";

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1").replace("/api/v1", "");

export default function AuthVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const [status, setStatus] = useState("verifying"); // verifying | success | error
  const [errorMsg, setErrorMsg] = useState("");
  const [user, setUser] = useState(null);

  useEffect(() => {
    const token = searchParams.get("token");

    if (!token) {
      setStatus("error");
      setErrorMsg("No authentication token found in the URL.");
      return;
    }

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/auth/verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });

        const data = await res.json();

        if (!data.success) {
          throw new Error(data.error || "Verification failed");
        }

        const userData = data.data;

        // Save user identity for the Vishleshan frontend session
        localStorage.setItem("vishleshan_user", JSON.stringify(userData));

        // Also populate the existing auth stores so the dashboard works seamlessly
        localStorage.setItem("vish_jwt", token);
        localStorage.setItem(
          "vish_company",
          JSON.stringify({
            id: userData.user_id,
            email: userData.email,
            name: userData.email.split("@")[0],
            tier: "free",
          })
        );

        setUser(userData);
        setStatus("success");

        // Navigate to the Vishleshan dashboard
        setTimeout(() => {
          navigate("/admin/dashboard");
        }, 1200);
      } catch (err) {
        setStatus("error");
        setErrorMsg(err.message || "Token invalid or expired");
      }
    })();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-10 max-w-md w-full text-center">
        {status === "verifying" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-6">
              <Loader2 size={32} className="text-accent animate-spin" />
            </div>
            <h2 className="text-xl font-black text-charcoal mb-2">
              Verifying Your Login
            </h2>
            <p className="text-gray-500 font-medium text-sm">
              Authenticating with Vishleshan...
            </p>
          </>
        )}

        {status === "success" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-green-50 flex items-center justify-center mx-auto mb-6">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-black text-charcoal mb-2">
              Authentication Successful
            </h2>
            <p className="text-gray-500 font-medium text-sm mb-1">
              Welcome, <strong className="text-charcoal">{user?.email}</strong>
            </p>
            <p className="text-xs text-gray-400 font-medium mt-3">
              Redirecting to dashboard...
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6">
              <XCircle size={32} className="text-red-500" />
            </div>
            <h2 className="text-xl font-black text-charcoal mb-2">
              Login Link Invalid
            </h2>
            <p className="text-gray-500 font-medium text-sm mb-6">
              Login link invalid or expired. Please request a new one from the portal.
            </p>
            <button
              onClick={() => navigate("/login")}
              className="px-6 py-2.5 bg-accent text-white rounded-xl font-bold text-sm hover:bg-accent-dark transition-colors"
            >
              Go to Login
            </button>
          </>
        )}

        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
          <Shield size={12} /> Vishleshan Secure Auth
        </div>
      </div>
    </div>
  );
}
