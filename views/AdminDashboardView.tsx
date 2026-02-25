import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Users, ShoppingBag, AlertTriangle, Search, Filter, 
  CheckCircle2, XCircle, MoreVertical, Trash2, Ban, Eye, 
  LayoutDashboard, MessageSquare, ChevronLeft, CreditCard, Banknote,
  Smartphone, Loader2, ExternalLink, Store, ShieldAlert, Settings
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { UserProfile, Product, Report } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';

interface AdminDashboardProps {
  user: UserProfile | null;
  notify: (m: string) => void;
}

export const AdminDashboardView: React.FC<AdminDashboardProps> = ({ user, notify }) => {
  const navigate = useNavigate();
  const { cdfRate, setCdfRate } = useCurrency();
  const [activeTab, setActiveTab] = useState<'overview' | 'users' | 'verifications' | 'products' | 'reports' | 'settings'>('overview');
  const [loading, setLoading] = useState(true);
  const [newRate, setNewRate] = useState(cdfRate.toString());
  
  // Data States
  const [stats, setStats] = useState({ totalUsers: 0, activeSellers: 0, pendingVerifications: 0, totalProducts: 0 });
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<any[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const isAdmin = user?.email === 'irmerveilkanku@gmail.com';

  useEffect(() => {
    if (!isAdmin) {
      navigate('/');
      return;
    }
    fetchDashboardData();
  }, [isAdmin, activeTab]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      if (activeTab === 'overview') {
        const { count: usersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
        const { count: sellersCount } = await supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('role', 'supplier');
        const { count: verifCount } = await supabase.from('verification_requests').select('*', { count: 'exact', head: true }).eq('status', 'pending_admin');
        const { count: productsCount } = await supabase.from('products').select('*', { count: 'exact', head: true });
        
        setStats({
          totalUsers: usersCount || 0,
          activeSellers: sellersCount || 0,
          pendingVerifications: verifCount || 0,
          totalProducts: productsCount || 0
        });
      }
      
      if (activeTab === 'users') {
        const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
        setUsers(data || []);
      }

      if (activeTab === 'verifications') {
        const { data, error } = await supabase
          .from('verification_requests')
          .select('*, profiles(username, avatar_url, email)')
          .eq('status', 'pending_admin')
          .order('created_at', { ascending: false });
        
        if (error) throw error;

        if (data) {
          // Generate signed URLs for private documents
          const requestsWithSignedUrls = await Promise.all(data.map(async (req: any) => {
            try {
              // Extract path from public URL
              // Format: .../storage/v1/object/public/id-cards/id-cards/filename.ext
              const urlParts = req.id_card_url.split('/id-cards/');
              const path = urlParts[urlParts.length - 1];
              
              const { data: signedData, error: signedError } = await supabase.storage
                .from('id-cards')
                .createSignedUrl(path, 3600, {
                  download: true // Force download to avoid display issues
                });
              
              if (signedError) {
                console.error("Error creating signed URL:", signedError);
                return req;
              }

              return { ...req, id_card_url: signedData.signedUrl };
            } catch (err) {
              console.error("Failed to process signed URL for request:", req.id, err);
              return req;
            }
          }));
          setVerificationRequests(requestsWithSignedUrls);
        }
      }

      if (activeTab === 'products') {
        const { data } = await supabase.from('products').select('*, profiles(username)').order('created_at', { ascending: false });
        setProducts(data || []);
      }

      if (activeTab === 'reports') {
        const { data } = await supabase
          .from('reports')
          .select('*, reporter:reporter_id(username), reported:reported_id(username)')
          .order('created_at', { ascending: false });
        setReports(data || []);
      }

    } catch (error: any) {
      notify("Erreur chargement: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationAction = async (requestId: string, action: 'approve' | 'reject') => {
    try {
      setProcessingId(requestId);
      const status = action === 'approve' ? 'pending_payment' : 'rejected';
      
      const { error } = await supabase
        .from('verification_requests')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('id', requestId);

      if (error) throw error;
      
      setVerificationRequests(prev => prev.filter(r => r.id !== requestId));
      notify(action === 'approve' ? "Demande approuvée" : "Demande rejetée");
    } catch (error: any) {
      notify("Erreur: " + error.message);
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm("Supprimer ce produit définitivement ?")) return;
    try {
      const { error } = await supabase.from('products').delete().eq('id', productId);
      if (error) throw error;
      setProducts(prev => prev.filter(p => p.id !== productId));
      notify("Produit supprimé");
    } catch (error: any) {
      notify("Erreur: " + error.message);
    }
  };

  const toggleUserBan = async (userId: string, currentStatus: boolean) => {
    // This assumes we have an is_banned field, if not we might need to add it or use metadata
    // For now, let's just log it as we don't have is_banned in schema yet
    notify("Fonctionnalité de bannissement à venir");
  };

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-brand-primary flex flex-col md:flex-row">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-brand-card border-r border-white/5 p-6 flex flex-col gap-2">
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="p-2 bg-brand-accent rounded-lg text-white">
            <ShieldCheck size={24} />
          </div>
          <div>
            <h1 className="font-orbitron font-bold text-white uppercase tracking-tighter">Super Admin</h1>
            <p className="text-[10px] text-gray-500">Monitoring Dashboard</p>
          </div>
        </div>

        <nav className="space-y-1">
          <SidebarItem active={activeTab === 'overview'} icon={<LayoutDashboard size={20} />} label="Vue d'ensemble" onClick={() => setActiveTab('overview')} />
          <SidebarItem active={activeTab === 'users'} icon={<Users size={20} />} label="Utilisateurs" onClick={() => setActiveTab('users')} />
          <SidebarItem active={activeTab === 'verifications'} icon={<ShieldCheck size={20} />} label="Vérifications" badge={stats.pendingVerifications} onClick={() => setActiveTab('verifications')} />
          <SidebarItem active={activeTab === 'products'} icon={<ShoppingBag size={20} />} label="Produits" onClick={() => setActiveTab('products')} />
          <SidebarItem active={activeTab === 'reports'} icon={<AlertTriangle size={20} />} label="Plaintes" onClick={() => setActiveTab('reports')} />
          <SidebarItem active={activeTab === 'settings'} icon={<Settings size={20} />} label="Paramètres" onClick={() => setActiveTab('settings')} />
        </nav>

        <div className="mt-auto pt-8 border-t border-white/5">
          <button onClick={() => navigate('/menu')} className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all w-full">
            <ChevronLeft size={20} />
            <span>Retour au Menu</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto h-screen">
        <header className="flex justify-between items-center mb-8">
          <h2 className="text-2xl font-bold text-white capitalize">{activeTab}</h2>
          <div className="flex items-center gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
              <input type="text" placeholder="Rechercher..." className="bg-brand-card border border-white/10 rounded-full pl-10 pr-4 py-2 text-sm text-white focus:border-brand-accent outline-none w-64" />
            </div>
            <div className="w-10 h-10 rounded-full bg-brand-accent flex items-center justify-center text-white font-bold">
              SA
            </div>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-brand-accent" size={40} />
          </div>
        ) : (
          <div className="animate-in fade-in duration-300">
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard icon={<Users className="text-blue-500" />} label="Utilisateurs Total" value={stats.totalUsers} />
                <StatCard icon={<Store className="text-green-500" />} label="Vendeurs Actifs" value={stats.activeSellers} />
                <StatCard icon={<ShieldAlert className="text-orange-500" />} label="Vérifications en attente" value={stats.pendingVerifications} />
                <StatCard icon={<ShoppingBag className="text-purple-500" />} label="Produits Publiés" value={stats.totalProducts} />
              </div>
            )}

            {activeTab === 'users' && (
              <div className="bg-brand-card rounded-3xl border border-white/5 overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-white/5 text-gray-400 text-xs uppercase">
                    <tr>
                      <th className="p-4">Utilisateur</th>
                      <th className="p-4">Rôle</th>
                      <th className="p-4">Statut</th>
                      <th className="p-4">Date Inscription</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-white/5 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                          <img src={u.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.username}`} className="w-8 h-8 rounded-full bg-gray-800" />
                          <div>
                            <div className="font-bold text-white text-sm">{u.username}</div>
                            <div className="text-xs text-gray-500">{u.email}</div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`px-2 py-1 rounded-full text-[10px] uppercase font-bold ${u.role === 'supplier' ? 'bg-purple-500/10 text-purple-500' : 'bg-blue-500/10 text-blue-500'}`}>
                            {u.role}
                          </span>
                        </td>
                        <td className="p-4">
                          {u.is_verified_supplier ? (
                            <span className="flex items-center gap-1 text-green-500 text-xs font-bold"><CheckCircle2 size={12} /> Vérifié</span>
                          ) : (
                            <span className="text-gray-500 text-xs">Non vérifié</span>
                          )}
                        </td>
                        <td className="p-4 text-xs text-gray-500">{new Date(u.created_at || '').toLocaleDateString()}</td>
                        <td className="p-4 text-right">
                          <button onClick={() => toggleUserBan(u.id, false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-red-500">
                            <Ban size={16} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'verifications' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {verificationRequests.length === 0 ? (
                  <div className="col-span-full text-center py-20 text-gray-500">Aucune demande en attente</div>
                ) : (
                  verificationRequests.map(req => (
                    <div key={req.id} className="bg-brand-card p-6 rounded-3xl border border-white/5">
                      <div className="flex items-center gap-4 mb-4">
                        <img src={req.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${req.profiles?.username}`} className="w-12 h-12 rounded-xl bg-gray-800" />
                        <div>
                          <h4 className="font-bold text-white">{req.profiles?.username}</h4>
                          <p className="text-xs text-gray-500">{req.profiles?.email}</p>
                        </div>
                      </div>
                      
                      <div className="aspect-video bg-black rounded-xl overflow-hidden mb-4 relative group">
                        <img src={req.id_card_url} className="w-full h-full object-contain" />
                        <a href={req.id_card_url} target="_blank" className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white gap-2 transition-opacity">
                          <ExternalLink size={16} /> Voir document
                        </a>
                      </div>

                      <div className="flex gap-3">
                        <button 
                          disabled={!!processingId}
                          onClick={() => handleVerificationAction(req.id, 'reject')}
                          className="flex-1 py-3 bg-red-500/10 text-red-500 rounded-xl font-bold text-xs uppercase hover:bg-red-500 hover:text-white transition-all"
                        >
                          Rejeter
                        </button>
                        <button 
                          disabled={!!processingId}
                          onClick={() => handleVerificationAction(req.id, 'approve')}
                          className="flex-1 py-3 bg-green-500 text-white rounded-xl font-bold text-xs uppercase hover:bg-green-600 transition-all"
                        >
                          Approuver
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'products' && (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map(p => (
                  <div key={p.id} className="bg-brand-card rounded-2xl overflow-hidden border border-white/5 group relative">
                    <div className="aspect-square bg-gray-800">
                      <img src={p.image_url} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-3">
                      <h4 className="font-bold text-white text-sm truncate">{p.name}</h4>
                      <p className="text-xs text-gray-500">{p.profiles?.username}</p>
                    </div>
                    <button 
                      onClick={() => handleDeleteProduct(p.id)}
                      className="absolute top-2 right-2 p-2 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'reports' && (
              <div className="space-y-4">
                {reports.length === 0 ? (
                  <div className="text-center py-20 text-gray-500">Aucune plainte signalée</div>
                ) : (
                  reports.map(r => (
                    <div key={r.id} className="bg-brand-card p-6 rounded-3xl border border-white/5 flex flex-col md:flex-row gap-6">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-1 bg-red-500/10 text-red-500 rounded-lg text-[10px] font-bold uppercase">Signalement</span>
                          <span className="text-xs text-gray-500">{new Date(r.created_at).toLocaleDateString()}</span>
                        </div>
                        <h4 className="font-bold text-white mb-1">Raison: {r.reason}</h4>
                        <p className="text-sm text-gray-400">
                          Signalé par <span className="text-brand-accent">{r.reporter?.username}</span> contre <span className="text-red-400">{r.reported?.username}</span>
                        </p>
                        {r.status === 'resolved' && (
                          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <p className="text-xs text-green-500 font-bold">Résolu: {r.admin_response}</p>
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col gap-2 justify-center">
                        {r.status === 'pending' && (
                          <>
                            <button className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-colors">
                              Ignorer
                            </button>
                            <button className="px-4 py-2 bg-brand-accent hover:bg-brand-accent/80 rounded-xl text-xs font-bold text-white transition-colors">
                              Marquer Résolu
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'settings' && (
              <div className="bg-brand-card p-8 rounded-3xl border border-white/5 max-w-2xl">
                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-3">
                  <div className="p-2 bg-brand-accent/20 rounded-xl text-brand-accent">
                    <Banknote size={24} />
                  </div>
                  Configuration Taux de Change
                </h3>
                
                <div className="space-y-6">
                  <div className="bg-brand-primary/50 p-6 rounded-2xl border border-white/5">
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Taux de conversion USD / CDF (RDC)</label>
                    
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2 bg-brand-card px-4 py-3 rounded-xl border border-white/10">
                        <span className="text-brand-accent font-black text-lg">1 USD</span>
                      </div>
                      <span className="text-gray-500 font-bold">=</span>
                      <div className="flex items-center gap-2 bg-brand-card px-4 py-3 rounded-xl border border-white/10 focus-within:border-brand-accent transition-colors flex-1">
                        <input 
                          type="number" 
                          value={newRate}
                          onChange={(e) => setNewRate(e.target.value)}
                          className="bg-transparent text-white font-bold text-lg outline-none w-full"
                          placeholder="2350"
                        />
                        <span className="text-gray-500 font-bold text-xs">FC</span>
                      </div>
                    </div>
                    
                    <p className="text-[10px] text-gray-500 mt-4 leading-relaxed">
                      Ce taux sera utilisé pour afficher automatiquement les prix en Francs Congolais pour tous les utilisateurs connectés depuis la RDC.
                      La mise à jour est immédiate.
                    </p>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      onClick={() => {
                        setCdfRate(Number(newRate));
                        notify("Taux de change mis à jour avec succès !");
                      }}
                      className="px-8 py-4 bg-brand-accent text-white rounded-xl font-bold text-xs uppercase hover:scale-105 transition-transform shadow-glow"
                    >
                      Sauvegarder les modifications
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

const SidebarItem = ({ active, icon, label, badge, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${active ? 'bg-brand-accent text-white shadow-glow' : 'text-gray-400 hover:bg-white/5 hover:text-white'}`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span className="text-sm font-medium">{label}</span>
    </div>
    {badge > 0 && (
      <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{badge}</span>
    )}
  </button>
);

const StatCard = ({ icon, label, value }: any) => (
  <div className="bg-brand-card p-6 rounded-3xl border border-white/5 flex items-center gap-4">
    <div className="p-4 bg-white/5 rounded-2xl">
      {icon}
    </div>
    <div>
      <div className="text-2xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-500 uppercase font-bold">{label}</div>
    </div>
  </div>
);
