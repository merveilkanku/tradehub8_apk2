
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Star, ShieldCheck, MapPin, MessageSquare, ChevronRight, Loader2, Store } from 'lucide-react';
import { motion } from 'motion/react';
import { supabase } from '../supabaseClient';
import { UserProfile, UserRole } from '../types';

export const SuppliersView = () => {
  const navigate = useNavigate();
  const [suppliers, setSuppliers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('role', UserRole.SUPPLIER)
        .order('is_verified_supplier', { ascending: false })
        .order('created_at', { ascending: false });

      if (error) throw error;
      if (data) setSuppliers(data as UserProfile[]);
    } catch (err) {
      console.error("Error fetching suppliers:", err);
      // Fallback mock data if needed or just empty state
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 animate-pulse">
        <Loader2 size={40} className="text-brand-accent animate-spin mb-4" />
        <p className="text-xs font-orbitron text-brand-accent uppercase tracking-widest">Initialisation du réseau...</p>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 pb-20"
    >
      <h2 className="text-3xl font-orbitron font-black mb-2 text-glow text-white">FOURNISSEURS</h2>
      <p className="text-xs text-gray-500 font-medium tracking-widest uppercase mb-6">Partenaires certifiés TradeHub</p>

      {suppliers.length > 0 ? (
        <>
          {/* Featured Supplier (The first verified one) */}
          {suppliers[0] && (
            <div className="relative overflow-hidden rounded-[2rem] bg-gradient-to-tr from-brand-accent/20 to-transparent border border-brand-accent/20 p-6 mb-8 shadow-glow">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-brand-accent p-0.5 shadow-glow relative">
                  <img src={suppliers[0].avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${suppliers[0].id}`} alt="Supplier" className="w-full h-full object-cover rounded-[calc(1rem-2px)]" />
                  {suppliers[0].is_verified_supplier && (
                    <div className="absolute -bottom-2 -right-2 bg-brand-accent text-white p-1 rounded-full border-2 border-brand-primary">
                      <ShieldCheck size={12} fill="currentColor" />
                    </div>
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-orbitron font-bold text-lg text-white uppercase truncate max-w-[150px]">{suppliers[0].username}</h3>
                    {suppliers[0].is_verified_supplier && (
                      <div className="flex items-center gap-1 bg-brand-accent text-white px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter">
                        <ShieldCheck size={10} fill="currentColor" /> Vérifié
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-brand-accent text-xs font-bold">
                    <Star size={12} fill="currentColor" />
                    <span>4.9 (2k+ Avis)</span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-400 mb-6 leading-relaxed uppercase tracking-tight line-clamp-2">
                {suppliers[0].bio || "Spécialiste de l'import-export. Partenaire de confiance sur le réseau TradeHub."}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => navigate(`/products?supplier=${suppliers[0].id}`)}
                  className="py-3 bg-brand-accent text-white rounded-2xl font-orbitron font-bold text-[10px] tracking-widest uppercase hover:scale-[1.02] transition-all shadow-glow"
                >
                  SHOWROOM
                </button>
                <button 
                  onClick={() => navigate('/discussions', { state: { supplier_id: suppliers[0].id, name: suppliers[0].username } })}
                  className="py-3 bg-brand-card border border-brand-accent/30 text-brand-accent rounded-2xl font-orbitron font-bold text-[10px] tracking-widest uppercase"
                >
                  CONTACTER
                </button>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {suppliers.slice(1).map(s => (
              <div key={s.id} className="alibaba-card p-5 rounded-3xl flex items-center gap-4 group hover:bg-white/5 transition-all">
                <div className="w-14 h-14 rounded-xl bg-brand-card border border-white/5 overflow-hidden flex-shrink-0 relative">
                  <img src={s.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.id}`} alt="Supp" className="w-full h-full object-cover opacity-80" />
                  {s.is_verified_supplier && (
                    <div className="absolute top-1 right-1 text-brand-accent bg-brand-primary/80 rounded-full p-0.5">
                      <ShieldCheck size={10} fill="currentColor" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0" onClick={() => navigate(`/products?supplier=${s.id}`)}>
                  <h4 className="font-bold text-sm tracking-tight flex items-center gap-1 text-white uppercase group-hover:text-brand-accent transition-colors truncate">
                    {s.username}
                    {s.is_verified_supplier && <ShieldCheck size={12} className="text-brand-accent" />}
                  </h4>
                  <div className="flex items-center gap-2 text-[9px] text-gray-500 mt-1 font-bold uppercase">
                    <div className="flex items-center gap-0.5">
                      <MapPin size={10} className="text-brand-accent" />
                      <span>{s.city}, {s.country}</span>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => navigate('/discussions', { state: { supplier_id: s.id, name: s.username } })}
                    className="p-3 bg-white/5 text-gray-500 hover:text-brand-accent transition-colors rounded-xl"
                  >
                    <MessageSquare size={18} />
                  </button>
                  <button 
                    onClick={() => navigate(`/products?supplier=${s.id}`)}
                    className="p-3 bg-white/5 text-gray-500 hover:text-brand-accent transition-colors rounded-xl"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-20 bg-brand-card rounded-[2rem] border border-white/5">
          <Store size={48} className="mx-auto text-gray-700 mb-4" />
          <p className="text-sm font-bold text-gray-400 uppercase tracking-widest">Aucun fournisseur actif</p>
        </div>
      )}
    </motion.div>
  );
};
