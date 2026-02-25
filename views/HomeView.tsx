
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, MapPin, Zap, ShoppingBag, ShieldCheck, ChevronRight, PlusCircle, Heart, Loader2, DollarSign, TrendingUp } from 'lucide-react';
import { motion } from 'motion/react';
import { CATEGORIES, UserProfile, UserRole, Product } from '../types';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { Logo } from '../components/Logo';
import { supabase } from '../supabaseClient';

interface HomeViewProps {
  onOpenAuth: () => void;
  user: UserProfile | null;
  onOpenAddProduct?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onOpenAuth, user, onOpenAddProduct }) => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { formatPrice } = useCurrency();
  const [search, setSearch] = useState('');
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [recentProducts, setRecentProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [supplierStats, setSupplierStats] = useState({ revenue: 0, orders: 0 });

  const handleContactSupport = async () => {
    if (!user) {
      onOpenAuth();
      return;
    }
    
    try {
      const { data: adminProfile, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('email', 'irmerveilkanku@gmail.com')
        .single();
        
      if (error || !adminProfile) {
        alert("Le support est actuellement indisponible.");
        return;
      }
      
      navigate('/discussions', { 
        state: { 
          supplier_id: adminProfile.id, 
          name: "Support TradeHub" 
        } 
      });
    } catch (err: any) {
      console.error("Support error", err);
    }
  };

  // Charger les produits réels pour rendre la page dynamique
  useEffect(() => {
    const fetchHomeData = async () => {
        try {
            // ... existing product fetching ...
            const { data: recents } = await supabase
                .from('products')
                .select('*, profiles!products_supplier_id_fkey(username, is_verified_supplier)')
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (recents) setRecentProducts(recents);

            const { data: featured } = await supabase
                .from('products')
                .select('*')
                .limit(5);
            
            if (featured) setFeaturedProducts(featured);

            // Fetch supplier stats if user is supplier
            if (user?.role === UserRole.SUPPLIER) {
                const { data: orders } = await supabase
                    .from('orders')
                    .select('total_amount, status, products!inner(supplier_id)')
                    .eq('products.supplier_id', user.id);
                
                if (orders) {
                    const revenue = orders
                        .filter(o => o.status === 'delivered')
                        .reduce((acc, curr) => acc + Number(curr.total_amount), 0);
                    setSupplierStats({ revenue, orders: orders.length });
                }
            }
        } catch (e) {
            console.error("Erreur chargement home", e);
        } finally {
            setLoading(false);
        }
    };
    fetchHomeData();
  }, [user]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) {
      navigate(`/products?q=${encodeURIComponent(search)}`);
    }
  };

  const categoriesIcons = [
    { name: t('cat_electronics'), color: 'text-blue-500', bg: 'bg-blue-500/10' },
    { name: t('cat_fashion'), color: 'text-pink-500', bg: 'bg-pink-500/10' },
    { name: t('cat_machines'), color: 'text-amber-500', bg: 'bg-amber-500/10' },
    { name: t('cat_vehicles'), color: 'text-emerald-500', bg: 'bg-emerald-500/10' }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-4 pb-20"
    >
      
      {/* Search Header */}
      <div className="sticky top-16 z-30 bg-brand-primary/95 backdrop-blur-md py-2 -mx-4 px-4 mb-4 transition-all">
        <form onSubmit={handleSearch} className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-brand-accent transition-colors" size={18} />
          <input 
            type="text" 
            placeholder={t('search_placeholder')}
            className="w-full bg-brand-card border border-transparent rounded-full py-3 pl-12 pr-4 text-sm font-medium placeholder:text-gray-500 focus:bg-brand-primary focus:border-brand-accent focus:shadow-md outline-none text-brand-secondary transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </form>
      </div>

      {/* Hero / Call to Action */}
      {!user ? (
          <div className="mb-8 p-6 rounded-3xl bg-gradient-to-r from-brand-accent to-purple-600 text-white shadow-lg shadow-brand-accent/20">
            <h2 className="text-xl font-bold mb-2">Bienvenue sur TradeHub</h2>
            <p className="text-sm opacity-90 mb-4">La plateforme B2B n°1 en Afrique. Connectez-vous pour commencer.</p>
            <button onClick={onOpenAuth} className="px-6 py-2 bg-white text-brand-accent rounded-full text-sm font-bold shadow-sm hover:scale-105 transition-transform">
                Se connecter
            </button>
          </div>
      ) : user.role === UserRole.SUPPLIER && (
          <div className="space-y-4 mb-8">
              <div className="grid grid-cols-2 gap-3">
                  <div className="bg-brand-card border border-white/5 rounded-3xl p-4 shadow-sm cursor-pointer" onClick={() => navigate('/orders')}>
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                          <DollarSign size={12} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Ventes</span>
                      </div>
                      <div className="text-lg font-black text-brand-accent">{formatPrice(supplierStats.revenue)}</div>
                  </div>
                  <div className="bg-brand-card border border-white/5 rounded-3xl p-4 shadow-sm cursor-pointer" onClick={() => navigate('/orders')}>
                      <div className="flex items-center gap-2 text-gray-500 mb-1">
                          <TrendingUp size={12} />
                          <span className="text-[9px] font-black uppercase tracking-widest">Commandes</span>
                      </div>
                      <div className="text-lg font-black text-brand-secondary">{supplierStats.orders}</div>
                  </div>
              </div>
              <button onClick={onOpenAddProduct} className="w-full py-3 bg-brand-card border border-dashed border-gray-300 dark:border-gray-700 rounded-2xl text-gray-500 font-medium flex items-center justify-center gap-2 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors">
                <PlusCircle size={20} className="text-brand-accent" />
                <span>Publier une nouvelle offre</span>
              </button>
          </div>
      )}

      {/* Categories - Horizontal Scroll */}
      <div className="mb-8">
        <div className="flex justify-between items-center mb-4 px-1">
          <h3 className="text-base font-bold text-brand-secondary">Catégories</h3>
          <button onClick={() => navigate('/products')} className="text-sm text-brand-accent font-medium hover:underline">Voir tout</button>
        </div>
        <div className="flex gap-4 overflow-x-auto scrollbar-hide pb-2">
          {categoriesIcons.map((cat) => (
            <div key={cat.name} className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0 w-20" onClick={() => navigate(`/products?cat=${cat.name}`)}>
              <div className={`w-14 h-14 rounded-full ${cat.bg} flex items-center justify-center transition-transform hover:scale-110`}>
                <ShoppingBag size={24} className={cat.color} />
              </div>
              <span className="text-xs font-medium text-center text-gray-600 dark:text-gray-400 leading-tight">{cat.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Featured / Sponsored */}
      <div className="p-4 rounded-2xl bg-brand-card mb-8 flex items-center gap-4 cursor-pointer hover:shadow-md transition-shadow" onClick={() => navigate('/suppliers')}>
        <div className="w-12 h-12 rounded-full bg-brand-accent/10 flex items-center justify-center text-brand-accent">
          <ShieldCheck size={28} />
        </div>
        <div className="flex-1">
          <h4 className="text-sm font-bold text-brand-secondary">Fournisseurs Vérifiés</h4>
          <p className="text-xs text-gray-500 mt-0.5">Transactions sécurisées & garanties</p>
        </div>
        <ChevronRight size={20} className="text-gray-400" />
      </div>

      {/* Dynamic Feed - Grid Layout */}
      <div>
        <h3 className="text-base font-bold text-brand-secondary mb-4 px-1">Fil d'actualité</h3>
        
        {loading ? (
            <div className="grid grid-cols-2 gap-4">
                {[1,2,3,4].map(i => <div key={i} className="h-48 bg-brand-card rounded-xl animate-pulse"/>)}
            </div>
        ) : recentProducts.length > 0 ? (
            <div className="grid grid-cols-2 gap-3">
              {recentProducts.map(p => (
                <div key={p.id} className="bg-brand-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow cursor-pointer group" onClick={() => navigate(`/products/${p.id}`)}>
                  <div className="aspect-[4/5] relative bg-gray-100 dark:bg-gray-800">
                    <img src={p.image_url || `https://picsum.photos/seed/${p.id}/400/500`} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                    {p.profiles?.is_verified_supplier && (
                        <div className="absolute top-2 right-2 bg-white rounded-full p-1 shadow-sm">
                            <ShieldCheck size={12} className="text-green-500" fill="currentColor" />
                        </div>
                    )}
                  </div>
                  <div className="p-3">
                    <h5 className="text-sm font-medium text-brand-secondary line-clamp-1 mb-1">{p.name}</h5>
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-bold text-brand-accent">{formatPrice(p.price)}</span>
                        <div className="flex items-center text-xs text-gray-400">
                           <MapPin size={10} className="mr-0.5" /> {p.city}
                        </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
        ) : (
            <div className="text-center py-10 text-gray-500 text-sm">Aucun produit récent.</div>
        )}
      </div>

      {/* Support Section */}
      <div className="mt-12 p-6 bg-brand-card border border-white/5 rounded-[2rem] text-center shadow-sm">
          <h3 className="text-lg font-bold text-brand-secondary mb-2 italic uppercase">Besoin d'aide ?</h3>
          <p className="text-[10px] text-gray-500 mb-6 font-medium uppercase tracking-wider">Notre équipe de support est là pour vous accompagner dans vos transactions.</p>
          <button 
            onClick={handleContactSupport}
            className="w-full py-4 bg-brand-accent/10 text-brand-accent border border-brand-accent/30 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-brand-accent hover:text-white transition-all shadow-glow shadow-brand-accent/5"
          >
            Contacter le Support
          </button>
      </div>

      <div className="mt-12 text-center pb-8 opacity-30">
          <p className="text-[10px] text-gray-400 font-black tracking-[0.3em] uppercase">TradeHub Africa © 2026</p>
      </div>
    </motion.div>
  );
};
