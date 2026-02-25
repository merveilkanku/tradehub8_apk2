
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  User as UserIcon, Settings, ShoppingCart, Heart, LogOut, Globe, Moon, Shield, HelpCircle, Package, 
  BarChart3, PlusCircle, ChevronRight, Camera, Edit2, LayoutDashboard, Briefcase, Volume2, Sun, Languages, 
  Trash2, RefreshCcw, Link as LinkIcon, Upload, Users, Filter, CheckCircle2, TrendingUp, AlertTriangle, 
  CreditCard, ClipboardList, MessageSquare, ExternalLink, ShoppingBag, X, Save, AlertOctagon,
  ArrowDownWideNarrow, ArrowUpNarrowWide, CalendarDays, DollarSign, ListFilter, Smartphone, Send,
  Truck, Box, Loader2, Clock, UserCheck, ShieldAlert, Copy, Phone, Banknote, Check, ShieldCheck, Type,
  Coins
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { UserProfile, UserRole, Product, Order, CATEGORIES, Currency } from '../types';
import { supabase } from '../supabaseClient';
import { useLanguage } from '../contexts/LanguageContext';
import { useCurrency } from '../contexts/CurrencyContext';

interface MenuViewProps {
  user: UserProfile | null;
  onSignOut: () => void;
  onUpdateProfile: (newProfile: UserProfile) => void;
  onPostProduct: () => void;
  notify: (m: string) => void;
  currentTheme: 'dark' | 'light';
  onToggleTheme: () => void;
  currentFont: 'system' | 'modern' | 'future';
  onToggleFont: (style: 'system' | 'modern' | 'future') => void;
}

export const MenuView: React.FC<MenuViewProps> = ({ 
  user, 
  onSignOut, 
  onUpdateProfile, 
  onPostProduct, 
  notify,
  currentTheme,
  onToggleTheme,
  currentFont,
  onToggleFont
}) => {
  const navigate = useNavigate();
  const { t, language, setLanguage } = useLanguage();
  const { currency, setCurrency, formatPrice } = useCurrency();
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [showVerificationModal, setShowVerificationModal] = useState(false);
  
  const [viewState, setViewState] = useState<'menu' | 'dashboard' | 'inventory' | 'settings' | 'favorites'>(
    user?.role === UserRole.SUPPLIER ? 'dashboard' : 'menu'
  );

  const [userProducts, setUserProducts] = useState<Product[]>([]);
  const [favorites, setFavorites] = useState<Product[]>([]);
  const [supplierOrders, setSupplierOrders] = useState<any[]>([]);
  const [recentMessages, setRecentMessages] = useState<any[]>([]); 
  const [salesStats, setSalesStats] = useState({ totalRevenue: 0, totalSales: 0, activeProducts: 0, pendingOrders: 0 });
  const [loadingData, setLoadingData] = useState(false); 

  // Inventory Filters
  const [showSoldOnly, setShowSoldOnly] = useState(false);
  const [sortOption, setSortOption] = useState<'date_desc' | 'date_asc' | 'price_desc' | 'price_asc' | 'moq_desc' | 'moq_asc'>('date_desc');
  
  // States for Product Management
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const productFileInputRef = useRef<HTMLInputElement>(null);
  
  const [editedProfileData, setEditedProfileData] = useState({
    username: user?.username || '',
    bio: user?.bio || '',
    avatar_url: user?.avatar_url || ''
  });

  const handleContactSupport = async () => {
    if (!user) {
      notify("Veuillez vous connecter pour contacter le support");
      return;
    }
    
    try {
      setLoading(true);
      const { data: adminProfile, error } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('email', 'irmerveilkanku@gmail.com')
        .single();
        
      if (error || !adminProfile) {
        notify("Le support est actuellement indisponible (Admin non configuré)");
        return;
      }
      
      navigate('/discussions', { 
        state: { 
          supplier_id: adminProfile.id, 
          name: "Support TradeHub" 
        } 
      });
    } catch (err: any) {
      notify("Erreur lors de la mise en relation");
    } finally {
      setLoading(false);
    }
  };

  const isSupplier = user?.role === UserRole.SUPPLIER;

  useEffect(() => {
    if (user && user.role === UserRole.SUPPLIER) {
      if (viewState === 'dashboard' || viewState === 'inventory') {
          fetchSupplierData();
      }
    }
    if (user && viewState === 'favorites') {
      fetchFavorites();
    }
  }, [user, viewState]);

  useEffect(() => {
    if (user) {
      setEditedProfileData({
        username: user.username,
        bio: user.bio || '',
        avatar_url: user.avatar_url || ''
      });
    }
  }, [user]);

  const fetchSupplierData = async () => {
    if (!user) return;
    
    setLoadingData(true);
    try {
      const { data: products, error: prodError } = await supabase
        .from('products')
        .select('*')
        .eq('supplier_id', user.id)
        .order('created_at', { ascending: false });

      if (prodError) throw prodError;
      if (products) setUserProducts(products);
      
    } catch (err: any) {
      console.error("Erreur chargement produits:", err);
    } finally {
      setLoadingData(false);
    }

    try {
      const { data: orders } = await supabase
        .from('orders')
        .select(`*, products(name, price, supplier_id, image_url), profiles:buyer_id(username, avatar_url)`)
        .eq('products.supplier_id', user.id) 
        .order('created_at', { ascending: false });

      const validOrders = orders ? orders.filter((o: any) => o.products?.supplier_id === user.id) : [];

      if (validOrders) {
        setSupplierOrders(validOrders);
        const revenue = validOrders
          .filter((o: any) => o.status === 'delivered')
          .reduce((acc: number, order: any) => acc + (Number(order.total_amount) || 0), 0);
        const pending = validOrders.filter((o: any) => o.status === 'pending' || o.status === 'processing').length;
        
        setSalesStats(prev => ({
          ...prev,
          totalRevenue: revenue,
          totalSales: validOrders.length,
          activeProducts: userProducts.length || prev.activeProducts, 
          pendingOrders: pending
        }));
      }

      const { data: convos, error: chatError } = await supabase.rpc('get_user_conversations', { current_user_id: user.id });
      if (!chatError && convos) {
          setRecentMessages(convos.slice(0, 3));
      }

    } catch (err: any) {
      console.warn("Erreur chargement données secondaires:", err);
    }
  };

  const fetchFavorites = () => {
    setFavorites([
      { id: '3', name: 'Module Moto 125cc', price: 850, description: '...', category: 'Véhicules', image_url: 'https://picsum.photos/seed/moto/400/300', supplier_id: 's3', country: 'Côte d’Ivoire', city: 'Abidjan', likes_count: 124, created_at: '', moq: 5 }
    ]);
  };

  const handleUpdateProfile = async () => {
    setLoading(true);
    try {
      await supabase.from('profiles').update({
        username: editedProfileData.username,
        bio: editedProfileData.bio,
        avatar_url: editedProfileData.avatar_url
      }).eq('id', user!.id);
      
      onUpdateProfile({ ...user!, ...editedProfileData });
      setIsEditingProfile(false);
      notify(t('profile_updated'));
    } catch (err) {
      console.error("Erreur update profil", err);
      notify("ERREUR MISE À JOUR");
    } finally { setLoading(false); }
  };

  const handleOrderStatus = async (orderId: string, newStatus: string) => {
      try {
          const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
          if (error) throw error;
          
          const updatedOrders = supplierOrders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
          setSupplierOrders(updatedOrders);
          
          const revenue = updatedOrders
            .filter((o: any) => o.status === 'delivered')
            .reduce((acc: number, order: any) => acc + (Number(order.total_amount) || 0), 0);
          const pending = updatedOrders.filter((o: any) => o.status === 'pending' || o.status === 'processing').length;
          
          setSalesStats(prev => ({
            ...prev,
            totalRevenue: revenue,
            pendingOrders: pending
          }));

          notify(`Statut mis à jour : ${newStatus.toUpperCase()}`);
      } catch (err) {
          notify(`Erreur lors de la mise à jour`);
      }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir supprimer cette unité ?")) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      setUserProducts(prev => prev.filter(p => p.id !== productId));
      notify("Produit retiré");
    } catch (err: any) {
        setUserProducts(prev => prev.filter(p => p.id !== productId));
        notify("Retiré (Mode Local)");
    }
  };

  const handleSaveProductEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProduct) return;
    setLoading(true);
    try {
      const { error } = await supabase.from('products').update({
        name: editingProduct.name,
        price: editingProduct.price,
        description: editingProduct.description,
        category: editingProduct.category,
        moq: editingProduct.moq,
        image_url: editingProduct.image_url
      }).eq('id', editingProduct.id);
      if (error) throw error;
      setUserProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
      setEditingProduct(null);
      notify("Produit mis à jour");
    } catch (err: any) {
        setUserProducts(prev => prev.map(p => p.id === editingProduct.id ? editingProduct : p));
        setEditingProduct(null);
        notify("Modifié (Mode Local)");
    } finally {
      setLoading(false);
    }
  };

  const handleProductImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if(file && editingProduct) {
          const url = URL.createObjectURL(file);
          setEditingProduct({...editingProduct, image_url: url});
      }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 2 * 1024 * 1024) { notify("Image trop volumineuse (>2MB)"); return; }
    setUploadingPhoto(true);
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `avatar-${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage.from('chat-uploads').upload(fileName, file);
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('chat-uploads').getPublicUrl(fileName);
        setEditedProfileData(prev => ({ ...prev, avatar_url: urlData.publicUrl }));
        notify("Photo prête - Sauvegardez");
    } catch (err) {
        console.error("Upload error:", err);
        notify("Erreur upload");
    } finally {
        setUploadingPhoto(false);
    }
  };

  const filteredProducts = useMemo(() => {
    let result = [...userProducts];
    result.sort((a, b) => {
      switch (sortOption) {
        case 'price_asc': return a.price - b.price;
        case 'price_desc': return b.price - a.price;
        case 'moq_asc': return (a.moq || 1) - (b.moq || 1);
        case 'moq_desc': return (b.moq || 1) - (a.moq || 1);
        case 'date_asc': return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        case 'date_desc': 
        default: return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });
    return result;
  }, [userProducts, showSoldOnly, sortOption]);

  const copyToClipboard = (text: string) => {
      navigator.clipboard.writeText(text);
      notify("Copié dans le presse-papier");
  };

  if (!user) return (
    <div className="px-4 py-20 flex flex-col items-center justify-center min-h-[70vh] text-center gap-6">
      <div className="w-24 h-24 rounded-full bg-brand-card flex items-center justify-center text-gray-500"><UserIcon size={48} /></div>
      <h2 className="text-2xl font-bold">{t('access_denied')}</h2>
      <p className="text-sm text-gray-500">{t('auth_required')}</p>
    </div>
  );

  if (viewState === 'favorites') {
    return (
      <div className="px-4 py-6 animate-in slide-in-from-right duration-300 pb-20">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setViewState('menu')} className="p-2 bg-brand-card rounded-full hover:bg-gray-200 dark:hover:bg-white/10"><ChevronRight size={20} className="rotate-180" /></button>
          <h2 className="text-2xl font-bold text-brand-secondary">{t('my_favorites')}</h2>
        </div>
        <div className="space-y-4">
          {favorites.length > 0 ? favorites.map(f => (
            <div key={f.id} className="p-4 bg-brand-card rounded-2xl flex items-center gap-4 cursor-pointer hover:shadow-md transition-all" onClick={() => navigate(`/products/${f.id}`)}>
              <img src={f.image_url || `https://picsum.photos/seed/${f.id}/200/200`} className="w-20 h-20 rounded-xl object-cover" />
              <div className="flex-1">
                <h4 className="font-bold text-brand-secondary text-sm">{f.name}</h4>
                <p className="text-brand-accent font-bold text-xs">{f.price} USD</p>
              </div>
              <button onClick={(e) => { e.stopPropagation(); setFavorites(prev => prev.filter(x => x.id !== f.id)); notify("Retiré"); }} className="p-3 text-red-500/50 hover:text-red-500"><Trash2 size={20}/></button>
            </div>
          )) : <p className="text-center text-gray-500 py-20">Aucun favori.</p>}
        </div>
      </div>
    );
  }

  if (viewState === 'settings') {
    return (
      <div className="px-4 py-6 animate-in slide-in-from-right duration-300 pb-20">
        <div className="flex items-center gap-4 mb-8">
          <button onClick={() => setViewState('menu')} className="p-2 bg-brand-card rounded-full hover:bg-gray-200 dark:hover:bg-white/10"><ChevronRight size={20} className="rotate-180" /></button>
          <h2 className="text-2xl font-bold text-brand-secondary">{t('settings')}</h2>
        </div>
        <div className="space-y-4">
          <div className="p-6 bg-brand-card rounded-3xl space-y-6">
            
            {/* Theme Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                {currentTheme === 'dark' ? <Moon size={20} className="text-brand-accent" /> : <Sun size={20} className="text-brand-accent" />}
                <span className="text-sm font-medium text-brand-secondary">{t('theme')}</span>
              </div>
              <button onClick={onToggleTheme} className={`w-12 h-6 rounded-full relative transition-colors ${currentTheme === 'dark' ? 'bg-brand-accent' : 'bg-gray-300'}`}>
                <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${currentTheme === 'dark' ? 'right-1' : 'left-1'}`}/>
              </button>
            </div>

            {/* Font Toggle */}
            <div className="flex items-center justify-between">
               <div className="flex items-center gap-4">
                  <Type size={20} className="text-brand-accent" />
                  <span className="text-sm font-medium text-brand-secondary">Style de Police</span>
               </div>
               <select 
                  className="bg-brand-primary border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-secondary outline-none"
                  value={currentFont}
                  onChange={(e) => onToggleFont(e.target.value as any)}
               >
                   <option value="system">Système (Facebook)</option>
                   <option value="modern">Moderne (Jakarta)</option>
                   <option value="future">Futuriste (Orbitron)</option>
               </select>
            </div>

            {/* Language Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Languages size={20} className="text-brand-accent" />
                <span className="text-sm font-medium text-brand-secondary">{t('language')}</span>
              </div>
              <select 
                className="bg-brand-primary border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-secondary outline-none" 
                value={language}
                onChange={(e) => { setLanguage(e.target.value as any); notify(t('lang_updated')); }}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>

            {/* Currency Toggle */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Coins size={20} className="text-brand-accent" />
                <span className="text-sm font-medium text-brand-secondary">Devise</span>
              </div>
              <select 
                className="bg-brand-primary border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs font-medium text-brand-secondary outline-none" 
                value={currency}
                onChange={(e) => { setCurrency(e.target.value as Currency); notify("Devise mise à jour"); }}
              >
                {Object.values(Currency).map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (viewState === 'dashboard') {
     return (
        <div className="px-4 py-6 animate-in slide-in-from-right duration-300 pb-20">
            <div className="flex items-center justify-between mb-6">
                 <div className="flex items-center gap-4">
                    <button onClick={() => setViewState('menu')} className="p-3 bg-brand-card rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10"><ChevronRight size={20} className="rotate-180" /></button>
                    <h2 className="text-xl font-bold text-brand-secondary">Tableau de bord</h2>
                 </div>
                 <button onClick={() => setViewState('inventory')} className="p-3 bg-brand-accent rounded-2xl text-white shadow-lg"><Package size={20} /></button>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-8">
                <div className="bg-brand-card p-5 rounded-3xl relative overflow-hidden">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-2">{t('monthly_sales')}</span>
                    <div className="text-2xl font-bold text-brand-accent">{formatPrice(salesStats.totalRevenue)}</div>
                </div>
                <div className="bg-brand-card p-5 rounded-3xl relative overflow-hidden">
                    <span className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-2">{t('sales_count')}</span>
                    <div className="text-2xl font-bold text-brand-secondary">{salesStats.totalSales}</div>
                </div>
                <div className="bg-brand-card p-5 rounded-3xl relative overflow-hidden">
                     <span className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-2">En Stock</span>
                     <div className="text-2xl font-bold text-brand-secondary">{userProducts.length || salesStats.activeProducts}</div>
                </div>
                <div className="bg-brand-card p-5 rounded-3xl relative overflow-hidden">
                     <span className="text-xs text-gray-500 font-bold uppercase tracking-wide block mb-2">En Attente</span>
                     <div className="text-2xl font-bold text-orange-500">{salesStats.pendingOrders}</div>
                </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 px-2">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ventes Récentes</h3>
                 <button onClick={() => navigate('/orders')} className="text-xs text-brand-accent font-bold hover:underline">Voir tout</button>
              </div>
              
              <div className="bg-brand-card rounded-3xl overflow-hidden">
                 {supplierOrders.length > 0 ? (
                    supplierOrders.slice(0, 5).map((order, idx) => (
                      <div 
                        key={order.id} 
                        className={`p-4 flex items-center gap-3 ${idx !== Math.min(supplierOrders.length, 5) - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''}`}
                      >
                         <div className="w-10 h-10 rounded-xl bg-gray-100 flex-shrink-0 overflow-hidden">
                            <img src={order.products?.image_url || `https://picsum.photos/seed/${order.product_id}/200/200`} className="w-full h-full object-cover" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                               <span className="text-sm font-bold text-brand-secondary truncate">{order.products?.name || 'Produit inconnu'}</span>
                               <span className="text-xs font-bold text-brand-accent">{formatPrice(order.total_amount)}</span>
                            </div>
                            <div className="flex justify-between items-center mt-1">
                               <span className="text-[10px] text-gray-500">Client: {order.profiles?.username || 'Inconnu'}</span>
                               <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase ${
                                 order.status === 'delivered' ? 'bg-green-500/10 text-green-500' :
                                 order.status === 'cancelled' ? 'bg-red-500/10 text-red-500' :
                                 'bg-orange-500/10 text-orange-500'
                               }`}>
                                 {order.status === 'pending' ? 'En attente' : 
                                  order.status === 'processing' ? 'En cours' : 
                                  order.status === 'shipped' ? 'Expédié' : 
                                  order.status === 'delivered' ? 'Livré' : 'Annulé'}
                               </span>
                            </div>
                         </div>
                      </div>
                    ))
                 ) : (
                    <div className="p-6 text-center">
                       <ShoppingBag size={24} className="text-gray-400 mx-auto mb-2" />
                       <p className="text-xs text-gray-500">Aucune vente récente</p>
                    </div>
                 )}
              </div>
            </div>

            <div className="mb-8">
              <div className="flex justify-between items-center mb-4 px-2">
                 <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide">Demandes Clients</h3>
                 <button onClick={() => navigate('/discussions')} className="text-xs text-brand-accent font-bold hover:underline">Voir tout</button>
              </div>
              
              <div className="bg-brand-card rounded-3xl overflow-hidden">
                 {recentMessages.length > 0 ? (
                    recentMessages.map((msg, idx) => (
                      <div 
                        key={idx} 
                        onClick={() => navigate('/discussions', { state: { supplier_id: msg.partner_id, name: msg.username }})}
                        className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-200 dark:hover:bg-white/5 transition-all ${idx !== recentMessages.length - 1 ? 'border-b border-gray-200 dark:border-white/5' : ''}`}
                      >
                         <div className="relative">
                            <img src={msg.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${msg.username}`} className="w-10 h-10 rounded-full bg-gray-200 object-cover" />
                            <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-green-500 rounded-full border-2 border-brand-card" />
                         </div>
                         <div className="flex-1 min-w-0">
                            <div className="flex justify-between items-center">
                               <span className="text-sm font-bold text-brand-secondary">{msg.username}</span>
                               <span className="text-xs text-gray-500">{new Date(msg.last_message_time).toLocaleDateString()}</span>
                            </div>
                            <p className="text-xs text-gray-500 truncate mt-0.5">{msg.last_message}</p>
                         </div>
                         <ChevronRight size={14} className="text-gray-400" />
                      </div>
                    ))
                 ) : (
                    <div className="p-6 text-center">
                       <MessageSquare size={24} className="text-gray-400 mx-auto mb-2" />
                       <p className="text-xs text-gray-500">Aucune demande récente</p>
                    </div>
                 )}
              </div>
            </div>
        </div>
     );
  }

  if (viewState === 'inventory') {
      return (
        <div className="px-4 py-6 animate-in slide-in-from-right duration-300 pb-20">
             <div className="flex items-center gap-4 mb-6">
                 <button onClick={() => setViewState('dashboard')} className="p-3 bg-brand-card rounded-2xl hover:bg-gray-200 dark:hover:bg-white/10"><ChevronRight size={20} className="rotate-180" /></button>
                 <h2 className="text-xl font-bold text-brand-secondary">{t('my_inventory')}</h2>
                 <button 
                    onClick={fetchSupplierData} 
                    className="ml-auto p-2 bg-brand-card rounded-full hover:bg-gray-200 dark:hover:bg-white/10 text-gray-500 transition-all"
                    disabled={loadingData}
                 >
                    <RefreshCcw size={18} className={loadingData ? "animate-spin text-brand-accent" : ""} />
                 </button>
             </div>

             {editingProduct && (
                 <div className="fixed inset-0 z-[110] bg-black/80 flex items-center justify-center p-4">
                     <div className="bg-brand-card w-full max-w-sm rounded-3xl overflow-hidden flex flex-col max-h-[90vh]">
                         <div className="p-4 border-b border-gray-200 dark:border-white/10 flex justify-between items-center">
                             <h3 className="font-bold text-brand-secondary">Édition Rapide</h3>
                             <button onClick={() => setEditingProduct(null)}><X size={20} className="text-gray-500" /></button>
                         </div>
                         <form onSubmit={handleSaveProductEdit} className="p-6 space-y-4 overflow-y-auto">
                             <div className="flex justify-center mb-4">
                                 <div className="w-24 h-24 rounded-2xl bg-gray-100 dark:bg-black relative overflow-hidden group">
                                     <img src={editingProduct.image_url || `https://picsum.photos/seed/${editingProduct.id}/200/200`} className="w-full h-full object-cover" />
                                     <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" onClick={() => productFileInputRef.current?.click()}>
                                         <Camera size={20} className="text-white"/>
                                     </div>
                                     <input type="file" ref={productFileInputRef} className="hidden" onChange={handleProductImageChange}/>
                                 </div>
                             </div>
                             <div className="space-y-1">
                                 <label className="text-xs font-bold text-gray-500">Nom</label>
                                 <input className="w-full bg-brand-primary p-3 rounded-xl text-sm text-brand-secondary border border-gray-200 dark:border-white/10" value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} />
                             </div>
                             <div className="grid grid-cols-2 gap-3">
                                 <div className="space-y-1">
                                     <label className="text-xs font-bold text-gray-500">Prix</label>
                                     <input type="number" className="w-full bg-brand-primary p-3 rounded-xl text-sm text-brand-secondary border border-gray-200 dark:border-white/10" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: parseFloat(e.target.value)})} />
                                 </div>
                                 <div className="space-y-1">
                                     <label className="text-xs font-bold text-gray-500">MOQ</label>
                                     <input type="number" className="w-full bg-brand-primary p-3 rounded-xl text-sm text-brand-secondary border border-gray-200 dark:border-white/10" value={editingProduct.moq} onChange={e => setEditingProduct({...editingProduct, moq: parseInt(e.target.value)})} />
                                 </div>
                             </div>
                             <button type="submit" disabled={loading} className="w-full py-4 bg-brand-accent text-white font-bold rounded-xl shadow-lg">
                                 {loading ? 'Sauvegarde...' : 'Enregistrer'}
                             </button>
                         </form>
                     </div>
                 </div>
             )}

             <div className="space-y-4">
                 {loadingData && filteredProducts.length === 0 ? (
                    <div className="text-center py-20 animate-pulse">
                        <Loader2 size={32} className="mx-auto text-brand-accent animate-spin mb-4" />
                        <p className="text-sm text-gray-500">Chargement...</p>
                    </div>
                 ) : filteredProducts.length > 0 ? (
                    filteredProducts.map(p => (
                     <div key={p.id} className="bg-brand-card p-4 rounded-2xl flex gap-4 group shadow-sm">
                         <div className="w-20 h-20 bg-gray-100 rounded-xl overflow-hidden flex-shrink-0">
                             <img src={p.image_url || `https://picsum.photos/seed/${p.id}/200/200`} className="w-full h-full object-cover" />
                         </div>
                         <div className="flex-1 min-w-0">
                             <div className="flex justify-between items-start">
                                 <h4 className="text-sm font-bold text-brand-secondary truncate pr-2">{p.name}</h4>
                             </div>
                             <div className="text-brand-accent font-bold text-sm mt-1">{p.price} USD</div>
                             <div className="flex items-center gap-4 mt-3">
                                 <button onClick={() => setEditingProduct(p)} className="flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-secondary"><Edit2 size={12}/> Éditer</button>
                                 <button onClick={() => handleDeleteProduct(p.id)} className="flex items-center gap-1 text-xs font-medium text-red-500 hover:text-red-600"><Trash2 size={12}/> Retirer</button>
                             </div>
                         </div>
                     </div>
                 ))) : (
                    <div className="text-center py-20">
                         <p className="text-sm text-gray-500">Inventaire vide</p>
                    </div>
                 )}
             </div>
        </div>
      );
  }

  // --- MAIN MENU VIEW ---
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 pb-24"
    >
      {/* MODALE VERIFICATION */}
      {showVerificationModal && (
          <div className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-md flex items-center justify-center p-4">
              <div className="bg-brand-card rounded-3xl w-full max-w-md max-h-[90vh] flex flex-col overflow-hidden relative shadow-2xl">
                  <div className="p-6 border-b border-gray-200 dark:border-white/10 relative">
                      <button onClick={() => setShowVerificationModal(false)} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 dark:hover:text-white"><X size={20}/></button>
                      <div className="w-16 h-16 bg-brand-accent/10 rounded-full flex items-center justify-center mb-4 mx-auto text-brand-accent">
                          <ShieldCheck size={32} />
                      </div>
                      <h2 className="text-xl font-bold text-center text-brand-secondary">Certification PRO</h2>
                  </div>
                  {/* ... Contenu Modal Verification identique mais styles simplifiés ... */}
                  <div className="p-6 text-center">
                      <p className="text-sm text-gray-500 mb-6">Contactez le support pour activer votre compte PRO.</p>
                      <button onClick={() => setShowVerificationModal(false)} className="w-full py-3 bg-brand-accent text-white rounded-xl font-bold">Fermer</button>
                  </div>
              </div>
          </div>
      )}

      <div className="relative rounded-3xl bg-brand-card p-6 mb-8 shadow-sm">
        <div className="flex flex-col items-center">
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-tr from-brand-accent to-blue-500">
              <img 
                src={editedProfileData.avatar_url || user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.username}`} 
                className="w-full h-full object-cover rounded-full bg-brand-primary border-2 border-brand-card"
                alt="Avatar"
              />
            </div>
            {isSupplier && (
                <div className={`absolute bottom-0 right-0 p-1.5 rounded-full border-2 border-brand-card ${user.is_verified_supplier ? 'bg-green-500 text-white' : 'bg-orange-500 text-white'}`}>
                    {user.is_verified_supplier ? <CheckCircle2 size={12} fill="currentColor" /> : <AlertTriangle size={12} />}
                </div>
            )}
            <button onClick={() => setIsEditingProfile(true)} className="absolute top-0 right-0 p-2 bg-brand-card rounded-full text-gray-500 shadow-md">
              <Camera size={14} />
            </button>
          </div>

          {isEditingProfile ? (
            <div className="w-full space-y-3 flex flex-col items-center">
               <div className="flex gap-2 w-full mb-2 items-center">
                 <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileUpload} />
                 <button type="button" onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-100 dark:bg-white/5 rounded-lg text-gray-500 flex items-center gap-2 w-full justify-center text-xs font-medium">
                    {uploadingPhoto ? <Loader2 className="animate-spin" size={16} /> : <Upload size={16} />}
                    <span>{uploadingPhoto ? '...' : t('upload_photo')}</span>
                 </button>
               </div>
               <input className="bg-gray-100 dark:bg-white/5 rounded-lg px-4 py-2 text-sm text-center w-full outline-none text-brand-secondary" value={editedProfileData.username} onChange={(e) => setEditedProfileData({...editedProfileData, username: e.target.value})} placeholder="Pseudo" />
               <textarea placeholder="Bio..." className="bg-gray-100 dark:bg-white/5 rounded-lg px-4 py-2 text-sm text-center w-full min-h-[60px] outline-none text-brand-secondary" value={editedProfileData.bio} onChange={(e) => setEditedProfileData({...editedProfileData, bio: e.target.value})} />
               <div className="flex gap-2 w-full pt-2">
                <button onClick={() => { setIsEditingProfile(false); setEditedProfileData({...editedProfileData, avatar_url: user.avatar_url || ''}); }} className="flex-1 py-2 text-xs font-bold text-gray-500">{t('cancel')}</button>
                <button onClick={handleUpdateProfile} disabled={loading || uploadingPhoto} className="flex-1 py-2 bg-brand-accent text-white rounded-lg text-xs font-bold">{loading ? '...' : t('save')}</button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="text-xl font-bold text-brand-secondary">{user.username}</h2>
               <div className="flex items-center gap-1 text-gray-500 text-xs mt-1">
                <Globe size={12} /> <span>{user.city}, {user.country}</span>
              </div>

              {isSupplier && !user.is_verified_supplier && (
                <button 
                  onClick={() => navigate('/verification')}
                  className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-full text-xs font-bold shadow-glow flex items-center gap-2 hover:scale-105 transition-transform"
                >
                  <ShieldCheck size={14} />
                  Vérifier mon compte
                </button>
              )}

              {user.email === 'irmerveilkanku@gmail.com' && (
                <button 
                  onClick={() => navigate('/admin/dashboard')}
                  className="mt-4 px-6 py-2 bg-brand-accent text-white rounded-full text-xs font-bold flex items-center gap-2 shadow-glow hover:scale-105 transition-all"
                >
                  <LayoutDashboard size={14} />
                  Super Admin Dashboard
                </button>
              )}

              <p className="text-gray-500 text-xs mt-3 text-center px-4">
                {user.bio ? user.bio : "Membre TradeHub"}
              </p>
              <button onClick={() => setIsEditingProfile(true)} className="mt-4 flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-white/5 rounded-full text-xs font-bold text-brand-secondary hover:bg-gray-200 dark:hover:bg-white/10 transition-colors">
                <Edit2 size={12} /> {t('edit_profile')}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="space-y-4">
          {isSupplier && !user.is_verified_supplier && (
            <MenuLink onClick={() => navigate('/verification')} icon={<ShieldAlert size={20} />} label="Vérifier mon compte" color="text-brand-accent" />
          )}
          <MenuLink onClick={() => navigate('/orders')} icon={<ShoppingCart size={20} />} label={t('order_history')} />
          <MenuLink onClick={() => setViewState('favorites')} icon={<Heart size={20} />} label={t('favorite_units')} badge={favorites.length.toString()} />
          <MenuLink onClick={() => setViewState('settings')} icon={<Settings size={20} />} label={t('system_config')} />
          <MenuLink onClick={handleContactSupport} icon={<HelpCircle size={20} />} label="Nous contacter" />
          <MenuLink onClick={onSignOut} icon={<LogOut size={20} />} label={t('logout')} color="text-red-500" />
      </div>

      <div className="mt-12 text-center pb-8">
          <p className="text-xs text-gray-400 font-medium">TradeHub v4.1</p>
      </div>

    </motion.div>
  );
};

const MenuLink = ({ icon, label, color = "text-gray-500", badge = "", onClick }: { icon: any, label: string, color?: string, badge?: string, onClick?: () => void }) => (
  <button onClick={onClick} className="w-full flex items-center justify-between p-4 rounded-2xl bg-brand-card hover:bg-gray-100 dark:hover:bg-white/5 transition-all group shadow-sm">
    <div className="flex items-center gap-4">
      <div className={`${color} group-hover:scale-110 transition-transform duration-200`}>{icon}</div>
      <span className="text-sm font-medium text-brand-secondary">{label}</span>
    </div>
    <div className="flex items-center gap-3">
      {badge && <span className="px-2 py-0.5 rounded-full bg-brand-accent/10 text-xs font-bold text-brand-accent">{badge}</span>}
      <ChevronRight size={18} className="text-gray-400" />
    </div>
  </button>
);
