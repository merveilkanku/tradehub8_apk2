
import React, { useState } from 'react';
import { X, ShieldCheck, Mail, User, Store, DollarSign, AlertCircle, CheckCircle2, KeyRound, ArrowLeft, WifiOff, RefreshCw, Server } from 'lucide-react';
import { UserRole, UserProfile, AFRICAN_CITIES } from '../types';
import { supabase, supabaseUrl } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfile) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onAuthSuccess }) => {
  const { t } = useLanguage();
  const [mode, setMode] = useState<'login' | 'register' | 'reset'>('login');
  const [step, setStep] = useState(1);
  const [userRole, setUserRole] = useState<UserRole>(UserRole.USER);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showOfflineOption, setShowOfflineOption] = useState(false);

  const [formData, setFormData] = useState({
    identifier: '',
    password: '',
    username: '',
    email: '',
    phone: '',
    country: 'RDC',
    city: 'Kinshasa',
    address: ''
  });

  if (!isOpen) return null;

  // --- VIP CHECK ---
  const isVipEmail = (email: string) => email === 'irmerveilkanku@gmail.com';

  // Helper pour éviter le chargement infini
  const withTimeout = (promise: any, ms = 15000): Promise<any> => {
      let timeoutId: any;
      const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Délai d'attente dépassé (Timeout).")), ms);
      });
      return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timeoutId));
  };

  const translateError = (msg: string) => {
    if (msg.includes("Invalid login credentials")) return "Identifiants incorrects.";
    if (msg.includes("User not found")) return "Compte introuvable.";
    if (msg.includes("Database error") || msg.includes("unexpected error") || msg.includes("error saving new user")) 
      return "Erreur serveur (Pseudo déjà pris ou email déjà utilisé).";
    if (msg.includes("rate limit") || msg.includes("Too many requests")) return "Limite d'envoi atteinte. Réessayez plus tard.";
    if (msg.includes("Failed to fetch") || msg.includes("Network Error")) return "Impossible de joindre le serveur. Vérifiez votre connexion.";
    if (msg.includes("Délai d'attente")) return "Le serveur met trop de temps à répondre.";
    return msg;
  };

  const createOptimisticProfile = (userId: string, email: string, role: UserRole): UserProfile => {
    const isVerified = isVipEmail(email) ? true : (role === UserRole.SUPPLIER ? false : true);
    return {
        id: userId,
        username: formData.username || email.split('@')[0] || "Utilisateur_Offline",
        email: email,
        role: role,
        country: formData.country,
        city: formData.city,
        address: formData.address || 'Mode Hors Ligne',
        is_verified_supplier: isVerified,
        created_at: new Date().toISOString()
    };
  };

  const isNetworkError = (msg: string) => {
    const m = msg.toLowerCase();
    return m.includes("failed to fetch") || 
           m.includes("load failed") || 
           m.includes("network request failed") || 
           m.includes("connection error") || 
           m.includes("networkerror") ||
           m.includes("network error") ||
           m.includes("fetch failed") ||
           m.includes("timeout");
  };

  const handleOfflineLogin = () => {
       const fakeId = `offline-${Date.now()}`;
       const fakeProfile = createOptimisticProfile(fakeId, formData.identifier || "User_Offline", userRole);
       console.warn("Mode Simulation Activé Manuellement");
       onAuthSuccess(fakeProfile);
       onClose();
       resetState();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setShowOfflineOption(false);

    let emailToUse = formData.identifier.trim();

    try {
      const password = formData.password.trim();

      if (!emailToUse || !password) throw new Error("Champs requis.");

      // Si ce n'est pas un email, on suppose que c'est un pseudo
      if (!emailToUse.includes('@')) {
        try {
          const { data: profileData, error: profileError } = await withTimeout(
            supabase
            .from('profiles')
            .select('email')
            .eq('username', emailToUse)
            .single()
          );
          
          if (!profileError && profileData) {
            emailToUse = profileData.email;
          }
        } catch (ignored) {
            console.warn("Username lookup failed, trying as raw ID");
        }
      }

      const { data, error: authError } = await withTimeout(
        supabase.auth.signInWithPassword({
            email: emailToUse,
            password: password,
        })
      );

      if (authError) throw authError;

      if (data.user) {
        try {
            const { data: profile } = await withTimeout(
                supabase
                .from('profiles')
                .select('*')
                .eq('id', data.user.id)
                .single(),
                5000 
            );

            if (profile) {
                if (isVipEmail(profile.email)) profile.is_verified_supplier = true;
                onAuthSuccess(profile as UserProfile);
            } else {
                const metaRole = data.user.user_metadata?.role as UserRole || UserRole.USER;
                onAuthSuccess(createOptimisticProfile(data.user.id, data.user.email!, metaRole));
            }
        } catch (innerErr) {
             const metaRole = data.user.user_metadata?.role as UserRole || UserRole.USER;
             onAuthSuccess(createOptimisticProfile(data.user.id, data.user.email!, metaRole));
        }

        onClose();
        resetState();
      }
    } catch (err: any) {
      let errorMsg = "unknown error";
      if (typeof err === 'string') errorMsg = err;
      else if (err instanceof Error) errorMsg = err.message;
      else if (err?.message) errorMsg = err.message;
      
      const lowerMsg = errorMsg.toLowerCase();

      if (lowerMsg.includes("email not confirmed")) {
           if (isVipEmail(emailToUse)) {
               const fakeProfile = createOptimisticProfile(`vip-${Date.now()}`, emailToUse, UserRole.USER);
               fakeProfile.is_verified_supplier = true;
               onAuthSuccess(fakeProfile);
               onClose();
               resetState();
               return;
           }
           setError("Veuillez confirmer votre email avant de vous connecter.");
           setLoading(false);
           return;
      }

      if (isNetworkError(lowerMsg)) {
           setError("Serveur inaccessible. Vérifiez votre connexion ou utilisez le mode Hors-Ligne.");
           setShowOfflineOption(true);
           setLoading(false);
           return;
      }

      console.error("Login Error:", err);
      setError(translateError(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
      const fakeId = `demo-${Date.now()}`;
      const fakeProfile = createOptimisticProfile(fakeId, "demo@tradehub.com", UserRole.USER);
      fakeProfile.username = "DemoUser";
      onAuthSuccess(fakeProfile);
      onClose();
      resetState();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 1) { setStep(2); return; }
    
    setLoading(true);
    setError(null);
    setShowOfflineOption(false);

    try {
      const emailToUse = formData.email.trim();
      const password = formData.password.trim();
      const usernameToUse = formData.username.trim();

      if (usernameToUse.length < 3) {
        setError("Le pseudo doit contenir au moins 3 caractères.");
        setLoading(false);
        return;
      }

      if (password.length < 6) {
        setError("Le mot de passe doit contenir au moins 6 caractères.");
        setLoading(false);
        return;
      }

      // Vérifier si le pseudo est déjà pris
      const { data: existingUser } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', usernameToUse)
        .maybeSingle();

      if (existingUser) {
        setError("Ce pseudo est déjà utilisé. Veuillez en choisir un autre.");
        setLoading(false);
        return;
      }
      
      const isVerified = isVipEmail(emailToUse) ? true : (userRole === UserRole.SUPPLIER ? false : true);

      // 1. Inscription Auth
      const { data: authData, error: signUpError } = await withTimeout(
          supabase.auth.signUp({
            email: emailToUse,
            password: password,
            options: {
            emailRedirectTo: window.location.origin,
            data: {
                username: usernameToUse,
                role: userRole,
                country: formData.country,
                city: formData.city,
                address: formData.address,
                is_verified_supplier: isVerified,
                preferred_currency: 'USD'
            }
            }
        })
      );

      if (signUpError) throw signUpError;

      if (authData.user) {
        // Check if email confirmation is required
        if (authData.user.identities?.length === 0) {
             setError("Cet email est déjà enregistré. Veuillez vous connecter.");
             setLoading(false);
             return;
        }

        if (!authData.session) {
            setSuccessMsg("Inscription réussie ! Veuillez vérifier votre email pour confirmer votre compte.");
            setLoading(false);
            return;
        }

        // Le profil est créé automatiquement par le trigger handle_new_user
        const finalProfile = createOptimisticProfile(authData.user.id, emailToUse, userRole);
        
        onAuthSuccess(finalProfile);
        onClose();
        resetState();
      }

    } catch (err: any) {
      let errorMsg = "unknown error";
      if (typeof err === 'string') errorMsg = err;
      else if (err instanceof Error) errorMsg = err.message;
      else if (err?.message) errorMsg = err.message;
      
      const lowerMsg = errorMsg.toLowerCase();
      
      if (isNetworkError(lowerMsg)) {
          setError("Inscription impossible hors-ligne.");
          setShowOfflineOption(true);
          setLoading(false);
          return;
      }

      console.error("Register Error:", err);
      setError(translateError(errorMsg));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const email = formData.identifier.trim();
      if (!email || !email.includes('@')) throw new Error(t('invalid_email'));

      const { error } = await withTimeout(
        supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin,
        })
      );

      if (error) throw error;
      setSuccessMsg(t('reset_email_sent'));
    } catch (err: any) {
      if (!isNetworkError(String(err))) {
         console.error(err);
      }
      setError(translateError(err?.message || String(err)));
    } finally {
      setLoading(false);
    }
  };

  const resetState = () => {
    setMode('login');
    setStep(1);
    setError(null);
    setSuccessMsg(null);
    setShowOfflineOption(false);
    setFormData(prev => ({ ...prev, password: '' }));
  };

  // Extraction de l'ID du projet pour affichage
  const projectId = supabaseUrl.split('//')[1].split('.')[0];

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-brand-primary/95 backdrop-blur-sm animate-in fade-in duration-300">
      <div className="relative w-full max-w-md bg-brand-card border border-gray-200 dark:border-white/10 rounded-[2rem] shadow-glass overflow-hidden text-gray-900 dark:text-white flex flex-col max-h-[90vh]">
        <div className="p-8 overflow-y-auto">
          <button onClick={onClose} className="absolute top-6 right-6 text-gray-400 hover:text-gray-900 dark:hover:text-white"><X size={20} /></button>

          {error && (
            <div className="mb-6 animate-in fade-in zoom-in">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                    <AlertCircle size={16} className="flex-shrink-0" /> <span className="flex-1">{error}</span>
                </div>
                {showOfflineOption && (
                     <div className="grid grid-cols-2 gap-3">
                         <button onClick={handleOfflineLogin} className="p-3 bg-brand-accent/20 border border-brand-accent/50 rounded-xl text-brand-accent text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-brand-accent hover:text-white transition-all">
                             <WifiOff size={16} /> Mode Hors-Ligne
                         </button>
                         <button onClick={() => { setError(null); setShowOfflineOption(false); }} className="p-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-xs font-bold uppercase flex items-center justify-center gap-2 hover:bg-white/10 transition-all">
                             <RefreshCw size={16} /> Réessayer
                         </button>
                     </div>
                )}
            </div>
          )}

          {successMsg ? (
             <div className="text-center py-10 animate-in zoom-in duration-300">
               <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6 text-green-500">
                 <CheckCircle2 size={40} />
               </div>
               <h3 className="text-xl font-orbitron font-bold text-gray-900 dark:text-white mb-4">{t('reset_success_title')}</h3>
               <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed px-4 mb-6">{successMsg}</p>
               <button onClick={() => { setSuccessMsg(null); setMode('login'); }} className="px-6 py-3 bg-brand-accent text-white rounded-xl font-bold uppercase text-xs">
                 {t('return_login')}
               </button>
             </div>
          ) : (
            <>
              <h2 className="text-3xl font-orbitron font-bold mb-2 text-center tracking-tighter uppercase italic text-gray-900 dark:text-white">
                {mode === 'login' ? t('login_title') : mode === 'register' ? t('register_title') : t('recover_title')}
                <span className="text-brand-accent"> HUB</span>
              </h2>
              <p className="text-gray-500 dark:text-gray-300 text-center mb-8 text-[10px] uppercase tracking-widest font-bold">Sécurisation TradeHub 4.0</p>

              {/* Formulaire Login */}
              {mode === 'login' && (
                <form onSubmit={handleLogin} className="space-y-4 animate-in slide-in-from-right duration-300">
                  <input 
                    type="text" 
                    placeholder={t('email_placeholder')}
                    className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm outline-none focus:border-brand-accent transition-all text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    value={formData.identifier}
                    onChange={(e) => setFormData(prev => ({...prev, identifier: e.target.value}))}
                    required
                  />
                  <div className="space-y-2">
                    <input 
                      type="password" 
                      placeholder={t('password_placeholder')}
                      className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm outline-none focus:border-brand-accent text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                      value={formData.password}
                      onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                      required
                    />
                    <div className="text-right">
                      <button type="button" onClick={() => { setMode('reset'); setError(null); }} className="text-[10px] font-bold text-gray-400 hover:text-brand-accent uppercase tracking-wider">
                        {t('forgot_password')}
                      </button>
                    </div>
                  </div>
                  <button type="submit" disabled={loading} className="w-full bg-brand-accent text-brand-primary font-bold py-4 rounded-xl shadow-glow uppercase tracking-widest text-xs disabled:opacity-50 hover:scale-[1.02] transition-transform">
                    {loading ? 'CONNEXION...' : t('login_btn')}
                  </button>
                  <p className="text-center text-[10px] text-gray-400 dark:text-gray-200 mt-4 uppercase tracking-widest">
                    {t('no_account')} <button type="button" onClick={() => {setMode('register'); setStep(1); setError(null);}} className="text-brand-accent ml-2 font-black">{t('register_link')}</button>
                  </p>
                  <button type="button" onClick={handleDemoLogin} className="w-full mt-2 py-2 bg-gray-100 dark:bg-white/5 rounded-xl text-xs font-bold text-gray-500 hover:text-brand-secondary transition-colors uppercase tracking-widest">
                    Mode Démo (Sans Compte)
                  </button>
                </form>
              )}

              {/* Formulaire Mot de passe oublié */}
              {mode === 'reset' && (
                <form onSubmit={handlePasswordReset} className="space-y-6 animate-in slide-in-from-right duration-300">
                  <div className="bg-gray-100 dark:bg-brand-primary/50 p-4 rounded-xl border border-gray-200 dark:border-white/5 text-center">
                    <KeyRound size={32} className="mx-auto text-brand-accent mb-3" />
                    <p className="text-xs text-gray-600 dark:text-gray-300 leading-relaxed">{t('reset_instruction')}</p>
                  </div>
                  <input 
                    type="text" 
                    placeholder={t('email_label')}
                    className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm outline-none focus:border-brand-accent transition-all text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                    value={formData.identifier}
                    onChange={(e) => setFormData(prev => ({...prev, identifier: e.target.value}))}
                    required
                  />
                  <div className="flex gap-3">
                    <button type="button" onClick={() => { setMode('login'); setError(null); }} className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-500 dark:text-gray-300 font-bold uppercase hover:bg-gray-100 dark:hover:bg-white/5 flex items-center justify-center gap-2">
                      <ArrowLeft size={14} /> {t('back_btn')}
                    </button>
                    <button type="submit" disabled={loading} className="flex-[2] bg-brand-accent text-brand-primary font-bold py-4 rounded-xl shadow-glow uppercase tracking-widest text-xs disabled:opacity-50">
                      {loading ? '...' : t('reset_btn')}
                    </button>
                  </div>
                </form>
              )}

              {/* Formulaire Inscription */}
              {mode === 'register' && (
                <form onSubmit={handleRegister} className="space-y-4 animate-in slide-in-from-right duration-300">
                   {step === 1 && (
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <button type="button" onClick={() => setUserRole(UserRole.USER)} className={`p-4 rounded-2xl border transition-all ${userRole === UserRole.USER ? 'border-brand-accent bg-brand-accent/5' : 'border-gray-200 dark:border-white/5 opacity-50'}`}>
                        <User className="mx-auto mb-1 text-brand-accent" />
                        <span className="text-[10px] font-bold block text-gray-900 dark:text-white">{t('buyer_role')}</span>
                      </button>
                      <button type="button" onClick={() => setUserRole(UserRole.SUPPLIER)} className={`p-4 rounded-2xl border transition-all ${userRole === UserRole.SUPPLIER ? 'border-brand-accent bg-brand-accent/5' : 'border-gray-200 dark:border-white/5 opacity-50'}`}>
                        <Store className="mx-auto mb-1 text-brand-accent" />
                        <span className="text-[10px] font-bold block text-gray-900 dark:text-white">{t('seller_role')}</span>
                      </button>
                    </div>
                  )}

                  {step === 1 ? (
                    <>
                      <input 
                        type="text" 
                        placeholder={t('pseudo_placeholder')}
                        className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm outline-none focus:border-brand-accent transition-all text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        value={formData.username}
                        onChange={(e) => setFormData(prev => ({...prev, username: e.target.value}))}
                        required
                      />
                      <input 
                        type="email" 
                        placeholder="Email Terminal (Réel)"
                        className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm outline-none focus:border-brand-accent text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({...prev, email: e.target.value}))}
                        required
                      />
                      <input 
                        type="password" 
                        placeholder={t('password_placeholder')}
                        className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm outline-none focus:border-brand-accent text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        value={formData.password}
                        onChange={(e) => setFormData(prev => ({...prev, password: e.target.value}))}
                        required
                      />
                      <button type="submit" disabled={loading} className="w-full bg-brand-accent text-brand-primary font-bold py-4 rounded-xl shadow-glow uppercase tracking-widest text-xs disabled:opacity-50">
                        {loading ? '...' : 'ÉTAPE SUIVANTE'}
                      </button>
                      <p className="text-center text-[10px] text-gray-400 mt-4 uppercase tracking-widest">
                        {t('no_account')} ? <button type="button" onClick={() => {setMode('login'); setStep(1); setError(null);}} className="text-brand-accent ml-2 font-black">Connexion</button>
                      </p>
                    </>
                  ) : (
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-2">
                        <select className="bg-brand-primary border border-gray-200 dark:border-white/10 p-4 rounded-xl text-xs text-gray-900 dark:text-white" value={formData.country} onChange={(e) => setFormData({...formData, country: e.target.value})}>
                          {Array.from(new Set(AFRICAN_CITIES.map(c => c.country))).map(c => <option key={c} value={c} className="bg-brand-card">{c}</option>)}
                        </select>
                        <select className="bg-brand-primary border border-gray-200 dark:border-white/10 p-4 rounded-xl text-xs text-gray-900 dark:text-white" value={formData.city} onChange={(e) => setFormData({...formData, city: e.target.value})}>
                          {AFRICAN_CITIES.filter(c => c.country === formData.country).map(c => <option key={c.city} value={c.city} className="bg-brand-card">{c.city}</option>)}
                        </select>
                      </div>
                      <input 
                        type="text" 
                        placeholder={t('address_placeholder')}
                        className="modal-input w-full bg-brand-primary border border-gray-200 dark:border-white/10 rounded-xl py-4 px-6 text-sm text-gray-900 dark:text-white placeholder:text-gray-500 dark:placeholder:text-gray-400"
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        required
                      />
                      
                      <div className="flex gap-2">
                        <button type="button" onClick={() => setStep(1)} className="flex-1 py-4 border border-gray-200 dark:border-white/10 rounded-xl text-xs text-gray-500 dark:text-gray-300 uppercase font-bold hover:bg-gray-100 dark:hover:bg-white/5">RETOUR</button>
                        <button type="submit" disabled={loading} className="flex-[2] bg-brand-accent text-brand-primary font-bold py-4 rounded-xl shadow-glow text-xs disabled:opacity-50 uppercase">
                          {loading ? 'INSCRIPTION...' : t('register_btn')}
                        </button>
                      </div>
                    </div>
                  )}
                </form>
              )}
            </>
          )}
        </div>
        {/* FOOTER DIAGNOSTIC */}
        <div className="p-4 border-t border-white/5 bg-brand-primary/50 text-center">
             <div className="flex items-center justify-center gap-2 text-[9px] text-gray-600 font-mono">
                 <Server size={10} />
                 <span>Project: {projectId}</span>
                 <div className={`w-2 h-2 rounded-full ${error ? 'bg-red-500' : 'bg-green-500'} animate-pulse`}/>
             </div>
        </div>
      </div>
    </div>
  );
};
