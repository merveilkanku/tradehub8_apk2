
import React, { useState, useEffect } from 'react';
import { HashRouter as Router, Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { 
  Home, 
  Package, 
  Store, 
  MessageSquare, 
  Menu, 
  Bell,
  CheckCircle2,
  Plus,
  WifiOff
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { supabase } from './supabaseClient';
import { UserRole, UserProfile } from './types';
import { LanguageProvider, useLanguage } from './contexts/LanguageContext';
import { CurrencyProvider } from './contexts/CurrencyContext';
import { Logo } from './components/Logo';

// Components
import { HomeView } from './views/HomeView';
import { ProductsView } from './views/ProductsView';
import { ProductDetailsView } from './views/ProductDetailsView';
import { SuppliersView } from './views/SuppliersView';
import { ChatsView } from './views/ChatsView';
import { MenuView } from './views/MenuView';
import { OrdersView } from './views/OrdersView';
import { VerificationView } from './views/VerificationView';
import { AdminDashboardView } from './views/AdminDashboardView';
import { AuthModal } from './components/AuthModal';
import { NotificationCenter } from './components/NotificationCenter';
import { Notification } from './types';

function AppContent() {
  const navigate = useNavigate();
  const location = useLocation();
  const { t } = useLanguage(); 
  const [user, setUser] = useState<UserProfile | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [isNotificationCenterOpen, setIsNotificationCenterOpen] = useState(false);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [isAddProductOpen, setIsAddProductOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<string | null>(null);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [fontStyle, setFontStyle] = useState<'system' | 'modern' | 'future'>('system'); // Nouvelle gestion de police
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  // --- SUPER ADMIN / VIP EMAIL CHECK ---
  const isVipEmail = (email?: string) => email === 'irmerveilkanku@gmail.com';

  // Fonction d'auto-réparation du profil
  const ensureProfileExists = async (sessionUser: any) => {
    try {
        const { data: existingProfile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', sessionUser.id)
            .single();

        if (existingProfile && !error) return existingProfile;

        // Si pas de profil, on le crée (Self-Healing)
        console.warn("Profil manquant détecté. Tentative de réparation automatique...");
        const metaRole = sessionUser.user_metadata?.role as UserRole || UserRole.USER;
        const email = sessionUser.email!;
        
        const newProfile = {
            id: sessionUser.id,
            username: sessionUser.user_metadata?.username || email.split('@')[0],
            email: email,
            role: metaRole,
            country: sessionUser.user_metadata?.country || 'RDC',
            city: sessionUser.user_metadata?.city || 'Kinshasa',
            address: sessionUser.user_metadata?.address || 'Adresse inconnue',
            is_verified_supplier: isVipEmail(email) ? true : (metaRole === UserRole.SUPPLIER ? false : true),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { error: insertError } = await supabase.from('profiles').insert([newProfile]);
        
        if (insertError) {
             console.error("Echec auto-réparation:", insertError);
             return null;
        }
        
        return newProfile;
    } catch (e) {
        console.error("Erreur ensureProfileExists:", e);
        return null;
    }
  };

  useEffect(() => {
    checkSession();
    document.documentElement.classList.add('dark');

    // Online status listeners
    const handleOnline = () => { 
        setIsOnline(true); 
        showNotification("CONNEXION RÉTABLIE"); 
        checkSession(); // Retry session check when back online
    };
    const handleOffline = () => { 
        setIsOnline(false); 
        showNotification("CONNEXION PERDUE"); 
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const profile = await ensureProfileExists(session.user);
        
        if (profile) {
            setUser(profile as UserProfile);
            showNotification("CONNEXION RÉUSSIE");
            fetchUnreadCount(profile.id);
        } else {
            // Fallback ultime (Mode dégradé/Offline)
            const metaRole = session.user.user_metadata?.role as UserRole || UserRole.USER;
            setUser({
              id: session.user.id,
              username: session.user.user_metadata?.username || session.user.email!.split('@')[0],
              email: session.user.email!,
              role: metaRole,
              country: 'RDC',
              city: 'Kinshasa',
              address: '',
              is_verified_supplier: false,
              created_at: new Date().toISOString()
            });
        }
      } else if (event === 'SIGNED_OUT') {
        setUser(null);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
      showNotification("MODE SOMBRE ACTIVÉ");
    } else {
      document.documentElement.classList.remove('dark');
      showNotification("MODE CLAIR ACTIVÉ");
    }
  };

  // Fonction pour changer la police
  const toggleFont = (style: 'system' | 'modern' | 'future') => {
      setFontStyle(style);
      showNotification("POLICE MISE À JOUR");
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  const checkSession = async () => {
    setLoading(true);
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      
      if (session?.user) {
        const profile = await ensureProfileExists(session.user);
        if (profile) {
             setUser(profile as UserProfile);
             fetchUnreadCount(profile.id);
        }
      }
    } catch (err: any) {
      const msg = (err?.message || String(err)).toLowerCase();
      if (msg.includes('failed to fetch') || msg.includes('network error')) {
        setIsOnline(false);
        showNotification("MODE HORS LIGNE (ERREUR RÉSEAU)");
      } else {
        console.error("Erreur session:", err);
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchUnreadCount = async (userId: string) => {
    try {
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (!error) setUnreadNotifications(count || 0);
    } catch (err) {
      console.error("Error fetching unread count:", err);
    }
  };

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel(`app_notifications_${user.id}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, () => {
        fetchUnreadCount(user.id);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // --- DÉCONNEXION ROBUSTE ---
  const handleSignOut = async () => {
    try {
      // 1. Tenter la déconnexion côté serveur
      await supabase.auth.signOut();
    } catch (error) {
      console.warn("Erreur signOut serveur (non-bloquant):", error);
    } finally {
      // 2. Nettoyage agressif de l'état local et du stockage
      setUser(null);
      
      // Suppression de tous les tokens Supabase potentiels
      Object.keys(localStorage).forEach(key => {
          if(key.startsWith('sb-') && key.endsWith('-auth-token')) {
              localStorage.removeItem(key);
          }
      });
      sessionStorage.clear();

      // 3. Feedback UI
      showNotification("DÉCONNEXION RÉUSSIE");
      navigate('/');
    }
  };

  const activeTab = (() => {
    const path = location.pathname;
    if (path === '/') return 'home';
    if (path.startsWith('/products')) return 'products';
    if (path === '/suppliers') return 'suppliers';
    if (path === '/discussions') return 'discussions';
    if (path === '/menu') return 'menu';
    return 'home';
  })();

  const handleOpenAddProduct = () => {
    if (user?.role !== UserRole.SUPPLIER) {
      showNotification("ACCÈS RÉSERVÉ AUX FOURNISSEURS");
      return;
    }
    navigate('/products');
    setTimeout(() => setIsAddProductOpen(true), 100);
  };

  return (
    // Application de la classe de police globale
    <div className={`min-h-screen bg-brand-primary text-brand-secondary selection:bg-brand-accent/30 selection:text-white pb-20 relative transition-colors duration-300 font-style-${fontStyle}`}>
      
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-red-500 text-white text-[10px] font-bold uppercase tracking-widest p-2 text-center flex items-center justify-center gap-2">
            <WifiOff size={12} /> Connexion Perdue - Mode Hors Ligne
        </div>
      )}

      {notification && (
        <div className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] animate-in slide-in-from-top duration-300">
          <div className="bg-brand-accent text-white px-6 py-3 rounded-2xl shadow-glow flex items-center gap-3 font-bold text-[10px] tracking-widest">
            <CheckCircle2 size={16} /> {notification}
          </div>
        </div>
      )}

      {/* App Header */}
      <header className="sticky top-0 z-50 glass-nav px-6 py-4 flex justify-between items-center shadow-lg transition-colors duration-300">
        <Link to="/" className="hover:scale-105 transition-transform">
          <Logo className="h-9" />
        </Link>
        <div className="flex items-center gap-5">
          <div className="relative cursor-pointer" onClick={() => user && setIsNotificationCenterOpen(true)}>
            <Bell size={24} className={`${unreadNotifications > 0 ? 'text-brand-accent' : 'text-gray-500'} hover:text-brand-accent transition-colors`} />
            {unreadNotifications > 0 && (
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-bold w-4 h-4 rounded-full flex items-center justify-center border-2 border-brand-primary">
                {unreadNotifications > 9 ? '9+' : unreadNotifications}
              </span>
            )}
          </div>
          {!user ? (
            <button onClick={() => setIsAuthModalOpen(true)} className="bg-brand-accent text-white text-xs font-bold px-4 py-2 rounded-xl shadow-glow">Connect</button>
          ) : (
            <Link to="/menu" className="w-9 h-9 rounded-full border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <img 
                src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                className="w-full h-full object-cover" 
                alt="Me" 
              />
            </Link>
          )}
        </div>
      </header>

      {/* View Container */}
      <main className="max-w-xl mx-auto min-h-[calc(100vh-140px)] relative">
        {loading ? (
          <div className="flex h-[60vh] items-center justify-center text-brand-accent animate-pulse">Chargement...</div>
        ) : (
          <AnimatePresence mode="wait">
            <Routes location={location}>
              <Route path="/" element={<HomeView onOpenAuth={() => setIsAuthModalOpen(true)} user={user} onOpenAddProduct={handleOpenAddProduct} />} />
              <Route path="/products" element={<ProductsView user={user} isAddModalOpen={isAddProductOpen} setIsAddModalOpen={setIsAddProductOpen} notify={showNotification} />} />
              <Route path="/products/:id" element={<ProductDetailsView user={user} onOpenAuth={() => setIsAuthModalOpen(true)} notify={showNotification} />} />
              <Route path="/suppliers" element={<SuppliersView />} />
              <Route path="/discussions" element={user ? <ChatsView user={user} /> : <div className="p-20 text-center font-bold text-gray-600">Connectez-vous pour chatter</div>} />
              <Route path="/menu" element={
                <MenuView 
                  user={user} 
                  onSignOut={handleSignOut} 
                  onUpdateProfile={setUser} 
                  onPostProduct={handleOpenAddProduct} 
                  notify={showNotification} 
                  currentTheme={theme}
                  onToggleTheme={toggleTheme}
                  currentFont={fontStyle}
                  onToggleFont={toggleFont}
                />
              } />
              <Route path="/orders" element={<OrdersView user={user} />} />
              <Route path="/verification" element={<VerificationView user={user} onUpdateProfile={setUser} notify={showNotification} />} />
              <Route path="/admin/dashboard" element={<AdminDashboardView user={user} notify={showNotification} />} />
            </Routes>
          </AnimatePresence>
        )}
      </main>

      {/* Floating Action Button for Suppliers */}
      {user?.role === UserRole.SUPPLIER && !isAddProductOpen && (
        <button 
          onClick={handleOpenAddProduct}
          className="fixed bottom-24 right-4 z-40 bg-brand-accent text-white p-4 rounded-full shadow-lg shadow-brand-accent/40 animate-in zoom-in duration-300 hover:scale-110 transition-transform active:scale-90"
        >
          <Plus size={24} strokeWidth={3} />
        </button>
      )}

      {/* Bottom Navigation */}
      {!location.pathname.includes('/products/') && (
        <nav className="fixed bottom-0 left-0 right-0 z-50 glass-nav h-16 flex items-center justify-around px-2 shadow-glass border-t border-white/5 transition-colors duration-300">
          <NavButton active={activeTab === 'home'} icon={<Home size={24} />} label={t('nav_home')} onClick={() => navigate('/')} />
          <NavButton active={activeTab === 'products'} icon={<Package size={24} />} label={t('nav_products')} onClick={() => navigate('/products')} />
          <NavButton active={activeTab === 'suppliers'} icon={<Store size={24} />} label={t('nav_suppliers')} onClick={() => navigate('/suppliers')} />
          <NavButton active={activeTab === 'discussions'} icon={<MessageSquare size={24} />} label={t('nav_messages')} onClick={() => navigate('/discussions')} />
          <NavButton active={activeTab === 'menu'} icon={<Menu size={24} />} label={t('nav_menu')} onClick={() => navigate('/menu')} />
        </nav>
      )}

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        onAuthSuccess={(u) => { setUser(u); showNotification("CONNEXION RÉUSSIE"); }} 
      />

      {user && (
        <NotificationCenter 
          user={user} 
          isOpen={isNotificationCenterOpen} 
          onClose={() => setIsNotificationCenterOpen(false)} 
        />
      )}
    </div>
  );
}

const NavButton = ({ active, icon, label, onClick }: any) => (
  <button onClick={onClick} className={`flex flex-col items-center justify-center gap-1 transition-all ${active ? 'text-brand-accent' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}>
    <div className={`transition-all duration-300 ${active ? 'scale-110' : ''}`}>{icon}</div>
    {/* <span className="text-[9px] font-medium">{label}</span> */}
  </button>
);

export function App() {
  return (
    <Router>
      <LanguageProvider>
        <CurrencyProvider>
          <AppContent />
        </CurrencyProvider>
      </LanguageProvider>
    </Router>
  );
}
