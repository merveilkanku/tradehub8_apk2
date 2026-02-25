
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Package, Clock, CheckCircle2, Truck, XCircle, 
  ShoppingBag, DollarSign, TrendingUp
} from 'lucide-react';
import { supabase } from '../supabaseClient';
import { UserProfile, Order, UserRole } from '../types';
import { useCurrency } from '../contexts/CurrencyContext';
import { createNotification } from '../services/notificationService';

interface OrdersViewProps {
  user: UserProfile | null;
}

export const OrdersView: React.FC<OrdersViewProps> = ({ user }) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'buyer' | 'supplier'>('buyer');
  const [totalSales, setTotalSales] = useState(0);

  useEffect(() => {
    if (user) {
      if (user.role === UserRole.SUPPLIER) {
        setViewMode('supplier');
      }
      fetchOrders();
    } else {
      setLoading(false);
    }
  }, [user, viewMode]);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      
      let query;
      
      if (viewMode === 'buyer') {
        query = supabase
          .from('orders')
          .select(`
            *,
            products (
              name,
              image_url,
              supplier_id
            )
          `)
          .eq('buyer_id', user!.id);
      } else {
        query = supabase
          .from('orders')
          .select(`
            *,
            products!inner (
              name,
              image_url,
              supplier_id
            )
          `)
          .eq('products.supplier_id', user!.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        const validOrders = (data as any[]).filter(o => o.products !== null);
        setOrders(validOrders as Order[]);
        
        if (viewMode === 'supplier') {
            const total = validOrders
                .filter(o => o.status !== 'cancelled')
                .reduce((acc, curr) => acc + Number(curr.total_amount), 0);
            setTotalSales(total);
        }
      }
    } catch (err: any) {
      const msg = err?.message || String(err);
      if (!msg.toLowerCase().includes('failed to fetch')) {
        console.error('Error fetching orders:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (orderId: string, newStatus: Order['status']) => {
      try {
          const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
          
          if (error) throw error;
          
          const order = orders.find(o => o.id === orderId);
          if (order) {
              const statusLabels: Record<string, string> = {
                  processing: 'en cours de traitement',
                  shipped: 'expédiée',
                  delivered: 'livrée',
                  cancelled: 'annulée'
              };
              
              // Notify the other party
              const targetUserId = viewMode === 'supplier' ? order.buyer_id : order.products?.supplier_id;
              if (targetUserId) {
                  await createNotification(
                      targetUserId,
                      `Mise à jour de commande`,
                      `Votre commande pour "${order.products?.name}" est désormais ${statusLabels[newStatus] || newStatus}.`,
                      'order',
                      '/orders'
                  );
              }
          }
          
          const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
          setOrders(updatedOrders);
          
          if (viewMode === 'supplier') {
              const total = updatedOrders
                .filter(o => o.status === 'delivered') // On ne compte que les ventes livrées comme "gagnées"
                .reduce((acc, curr) => acc + Number(curr.total_amount), 0);
              setTotalSales(total);
          }
      } catch (err) {
          console.error("Update Status Error:", err);
      }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'delivered': return { color: 'text-green-500', bg: 'bg-green-500/10', icon: <CheckCircle2 size={14} />, label: 'Livré' };
      case 'shipped': return { color: 'text-blue-500', bg: 'bg-blue-500/10', icon: <Truck size={14} />, label: 'En Transit' };
      case 'processing': return { color: 'text-orange-500', bg: 'bg-orange-500/10', icon: <Clock size={14} />, label: 'Traitement' };
      case 'cancelled': return { color: 'text-red-500', bg: 'bg-red-500/10', icon: <XCircle size={14} />, label: 'Annulé' };
      default: return { color: 'text-gray-400', bg: 'bg-gray-500/10', icon: <Package size={14} />, label: 'En Attente' };
    }
  };

  if (!user) {
    return (
      <div className="px-4 py-20 text-center">
        <h2 className="text-xl font-orbitron font-bold text-white mb-4">Accès Restreint</h2>
        <p className="text-sm text-gray-500 mb-6">Veuillez vous connecter pour voir vos commandes.</p>
        <button onClick={() => navigate('/')} className="px-6 py-3 bg-brand-accent text-white rounded-xl text-xs font-bold uppercase tracking-widest">Retour Accueil</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 pb-24"
    >
      <div className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/menu')} className="p-3 bg-brand-card rounded-2xl border border-white/5 hover:bg-white/5 transition-colors">
          <ChevronLeft size={20} className="text-white" />
        </button>
        <div>
          <h2 className="text-2xl font-orbitron font-black text-white uppercase italic tracking-tighter">Mes_Commandes</h2>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Suivi & Historique</p>
        </div>
      </div>

      {user.role === UserRole.SUPPLIER && (
        <>
            <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="bg-brand-card border border-white/5 rounded-3xl p-5 shadow-glow shadow-brand-accent/5">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <DollarSign size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Ventes Livrées</span>
                    </div>
                    <div className="text-2xl font-black text-brand-accent">{formatPrice(totalSales)}</div>
                </div>
                <div className="bg-brand-card border border-white/5 rounded-3xl p-5">
                    <div className="flex items-center gap-2 text-gray-500 mb-2">
                        <TrendingUp size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Commandes</span>
                    </div>
                    <div className="text-2xl font-black text-white">{orders.length}</div>
                </div>
            </div>

            <div className="flex p-1 bg-brand-card rounded-2xl border border-white/5 mb-6">
                <button 
                    onClick={() => setViewMode('buyer')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'buyer' ? 'bg-brand-accent text-white shadow-glow' : 'text-gray-500 hover:text-white'}`}
                >
                    Mes Achats
                </button>
                <button 
                    onClick={() => setViewMode('supplier')}
                    className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${viewMode === 'supplier' ? 'bg-brand-accent text-white shadow-glow' : 'text-gray-500 hover:text-white'}`}
                >
                    Mes Ventes
                </button>
            </div>
        </>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="w-10 h-10 border-4 border-brand-accent border-t-transparent rounded-full animate-spin" />
          <span className="text-xs font-orbitron text-brand-accent animate-pulse uppercase tracking-widest">Récupération des données...</span>
        </div>
      ) : orders.length > 0 ? (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusStyle = getStatusStyle(order.status);
            return (
              <div 
                key={order.id} 
                className="bg-brand-card border border-white/5 rounded-[2rem] p-5 hover:border-brand-accent/30 transition-all group cursor-pointer"
                onClick={() => navigate(`/products/${order.product_id}`)}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-black border border-white/10 overflow-hidden">
                      {order.products?.image_url ? (
                        <img src={order.products.image_url || `https://picsum.photos/seed/${order.product_id}/200/200`} alt={order.products.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-700"><Package size={20} /></div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white uppercase italic">{order.products?.name || 'Produit Inconnu'}</h3>
                      <span className="text-[10px] text-gray-500 font-mono">CMD: {order.id.slice(0, 8)}...</span>
                    </div>
                  </div>
                  <div className={`px-3 py-1.5 rounded-full flex items-center gap-2 ${statusStyle.bg} ${statusStyle.color}`}>
                    {statusStyle.icon}
                    <span className="text-[9px] font-black uppercase tracking-widest">{statusStyle.label}</span>
                  </div>
                </div>
                
                <div className="flex items-end justify-between border-t border-white/5 pt-4">
                  <div className="space-y-1">
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Date: {new Date(order.created_at).toLocaleDateString()}</div>
                    <div className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Qté: {order.quantity}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-orbitron font-black text-brand-accent">{formatPrice(order.total_amount)}</div>
                  </div>
                </div>

                {viewMode === 'supplier' && order.status === 'pending' && (
                    <div className="flex gap-2 mt-4">
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'processing'); }}
                            className="flex-1 bg-brand-accent/20 text-brand-accent border border-brand-accent/30 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-accent hover:text-white transition-all"
                        >
                            Accepter
                        </button>
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'cancelled'); }}
                            className="flex-1 bg-red-500/10 text-red-500 border border-red-500/20 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all"
                        >
                            Refuser
                        </button>
                    </div>
                )}

                {viewMode === 'supplier' && order.status === 'processing' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'shipped'); }}
                        className="w-full mt-4 bg-blue-500/20 text-blue-500 border border-blue-500/30 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-blue-500 hover:text-white transition-all"
                    >
                        Marquer comme Expédié
                    </button>
                )}

                {viewMode === 'supplier' && order.status === 'shipped' && (
                    <div className="mt-4 p-3 bg-blue-500/5 rounded-xl border border-blue-500/10 text-center">
                        <span className="text-[9px] font-bold text-blue-500 uppercase tracking-widest">En attente de confirmation client</span>
                    </div>
                )}

                {viewMode === 'buyer' && order.status === 'shipped' && (
                    <button 
                        onClick={(e) => { e.stopPropagation(); handleUpdateStatus(order.id, 'delivered'); }}
                        className="w-full mt-4 bg-emerald-500 text-white py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-glow shadow-emerald-500/20 hover:scale-[1.02] transition-all"
                    >
                        Confirmer la Réception
                    </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-20 h-20 bg-brand-card rounded-full flex items-center justify-center mb-6 text-gray-700">
            <ShoppingBag size={32} />
          </div>
          <h3 className="text-lg font-bold text-white mb-2 uppercase">Aucune commande</h3>
          <p className="text-xs text-gray-500 max-w-xs mb-8">
            {viewMode === 'buyer' 
              ? "Vous n'avez pas encore effectué d'achat sur le réseau TradeHub." 
              : "Vous n'avez pas encore reçu de commandes de la part de clients."}
          </p>
          {viewMode === 'buyer' && (
            <button onClick={() => navigate('/products')} className="px-8 py-4 bg-brand-accent text-white rounded-2xl font-orbitron font-bold text-xs uppercase tracking-widest shadow-glow hover:scale-105 transition-transform">
              Explorer le Market
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};
