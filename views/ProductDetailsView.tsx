
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ChevronLeft, MapPin, ShoppingCart, MessageCircle, Send, Clock, 
  Package, Heart, ShieldCheck, Share2, Store, Info, Truck, 
  ShieldAlert, ChevronRight, Star, Award, Zap, CheckCircle2,
  Minus, Plus
} from 'lucide-react';
import { motion } from 'motion/react';
import { Product, Comment, UserProfile, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';

interface ProductDetailsViewProps {
  user: UserProfile | null;
  onOpenAuth: () => void;
  notify: (m: string) => void;
}

export const ProductDetailsView: React.FC<ProductDetailsViewProps> = ({ user, onOpenAuth, notify }) => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { formatPrice, cdfRate } = useCurrency();
  const [product, setProduct] = useState<Product | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isLiked, setIsLiked] = useState(false);
  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    fetchProductDetails();
    fetchComments();
    if (user) {
      checkIfLiked();
    }
  }, [id, user]);

  const checkIfLiked = async () => {
    if (!user || !id) return;
    const { data } = await supabase
      .from('favorites')
      .select('*')
      .eq('user_id', user.id)
      .eq('product_id', id)
      .maybeSingle();
    
    if (data) setIsLiked(true);
  };

  const fetchProductDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('products')
        .select('*, profiles!products_supplier_id_fkey(username, is_verified_supplier, country, city, avatar_url)')
        .eq('id', id)
        .single();
        
      if (error) throw error;
      if (data) setProduct(data);
      else throw new Error("Not found");
      
    } catch (err: any) {
      console.error("Fetch Product Error:", err);
      // Fallback (simulé pour l'exemple)
      setProduct({ 
        id: id!, 
        name: 'Produit Indisponible', 
        price: 0, 
        description: 'Impossible de charger les détails.', 
        category: 'Inconnu', 
        image_url: 'https://picsum.photos/seed/error/800/600', 
        supplier_id: 's1', 
        country: 'N/A', 
        city: 'N/A', 
        likes_count: 0, 
        created_at: new Date().toISOString(),
        moq: 1,
        lead_time: '3-7 jours',
        shipping_info: 'Expédition par fret aérien ou maritime',
        trade_assurance: true,
        specifications: {
          'Matériau': 'Premium Grade',
          'Origine': 'RDC',
          'Certification': 'CE / ISO 9001',
          'Garantie': '12 Mois'
        },
        profiles: { username: 'Inconnu', is_verified_supplier: false }
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchComments = async () => {
    try {
        const { data, error } = await supabase
            .from('comments')
            .select('*')
            .eq('product_id', id)
            .order('created_at', { ascending: false });

        if (error) throw error;
        if (data) setComments(data);
        
    } catch (error: any) {
        // Silent fail for comments
    }
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
        onOpenAuth();
        return;
    }
    if (!newComment.trim()) return;

    setIsAdding(true);
    
    const comment: Comment = {
        id: `temp-${Date.now()}`,
        product_id: id!,
        user_id: user.id,
        username: user.username,
        text: newComment,
        created_at: new Date().toISOString()
    };

    try {
        const { error } = await supabase.from('comments').insert([{
            product_id: id!,
            user_id: user.id,
            username: user.username,
            text: newComment
        }]);
        
        if (error) throw error;
        setComments([comment, ...comments]);
        setNewComment('');
        notify("Message envoyé");
    } catch (err: any) {
         setComments([comment, ...comments]); // Optimistic
         setNewComment('');
         notify("Message envoyé (Offline)");
    } finally {
        setIsAdding(false);
    }
  };

  const handleOrder = async () => {
      if (!user) {
          onOpenAuth();
          return;
      }
      if (!product) return;

      setLoading(true);
      try {
          const { error } = await supabase.from('orders').insert([{
              buyer_id: user.id,
              product_id: product.id,
              quantity: quantity,
              total_amount: product.price * quantity,
              status: 'pending'
          }]);

          if (error) throw error;
          
          notify("Commande envoyée avec succès !");
          navigate('/orders');
      } catch (err: any) {
          console.error("Order Error:", err);
          notify("Erreur lors de la commande.");
      } finally {
          setLoading(false);
      }
  };
  
  const handleLike = async () => {
      if (!user) {
          onOpenAuth();
          return;
      }
      
      const previousState = isLiked;
      setIsLiked(!previousState);
      
      try {
          if (!previousState) {
              const { error } = await supabase
                .from('favorites')
                .insert([{ user_id: user.id, product_id: id }]);
              if (error) throw error;
              notify("Ajouté aux favoris");
          } else {
              const { error } = await supabase
                .from('favorites')
                .delete()
                .eq('user_id', user.id)
                .eq('product_id', id);
              if (error) throw error;
              notify("Retiré des favoris");
          }
      } catch (err) {
          console.error("Like Error:", err);
          setIsLiked(previousState);
          notify("Erreur lors de l'action favoris");
      }
  };

  if (loading) return <div className="p-10 text-center text-sm text-gray-500 animate-pulse">Chargement...</div>;
  if (!product) return <div className="p-10 text-center text-white">Produit introuvable</div>;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.3 }}
      className="pb-24"
    >
      {/* Header Image */}
      <div className="relative h-[45vh] bg-black">
        <img src={product.image_url || `https://picsum.photos/seed/${product.id}/800/600`} alt={product.name} className="w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-primary via-transparent to-transparent opacity-80" />
        
        <button onClick={() => navigate(-1)} className="absolute top-6 left-6 p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors z-10">
          <ChevronLeft size={24} />
        </button>

        <div className="absolute top-6 right-6 flex gap-3 z-10">
             <button className="p-2 bg-black/40 backdrop-blur-md rounded-full text-white hover:bg-black/60 transition-colors">
                <Share2 size={20} />
             </button>
             <button onClick={handleLike} className={`p-2 backdrop-blur-md rounded-full transition-colors ${isLiked ? 'bg-red-500 text-white' : 'bg-black/40 text-white hover:bg-black/60'}`}>
                <Heart size={20} fill={isLiked ? "currentColor" : "none"} />
             </button>
        </div>

        <div className="absolute bottom-0 left-0 right-0 p-6 pt-20">
             <div className="flex justify-between items-end">
                <div>
                    <div className="flex items-center gap-2 mb-2">
                        <span className="bg-brand-accent px-2 py-0.5 rounded text-xs font-bold text-white">{product.category}</span>
                        {product.profiles?.is_verified_supplier && (
                             <div className="flex items-center gap-1 bg-green-500/20 text-green-400 px-2 py-0.5 rounded text-xs font-medium border border-green-500/30">
                                 <ShieldCheck size={12} /> Vérifié
                             </div>
                        )}
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-1 leading-tight">{product.name}</h1>
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-300">
                        <MapPin size={14} className="text-gray-400" />
                        {product.city}, {product.country}
                    </div>
                </div>
             </div>
        </div>
      </div>

      <div className="px-6 py-6 space-y-8">
          {/* Trade Assurance & Badges */}
          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-brand-accent/10 text-brand-accent px-3 py-2 rounded-xl border border-brand-accent/20 text-[10px] font-bold uppercase tracking-wider">
                  <ShieldAlert size={14} /> Trade Assurance
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-emerald-500/10 text-emerald-500 px-3 py-2 rounded-xl border border-emerald-500/20 text-[10px] font-bold uppercase tracking-wider">
                  <Award size={14} /> Fournisseur Or
              </div>
              <div className="flex-shrink-0 flex items-center gap-1.5 bg-blue-500/10 text-blue-500 px-3 py-2 rounded-xl border border-blue-500/20 text-[10px] font-bold uppercase tracking-wider">
                  <Zap size={14} /> Réponse Rapide
              </div>
          </div>

          {/* Price & Supplier */}
          <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-brand-card border border-gray-200 dark:border-white/5 shadow-sm">
                  <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Prix Unitaire</span>
                  <div className="text-2xl font-black text-brand-accent">{formatPrice(product.price)}</div>
                  {user?.country === 'RDC' && (
                      <div className="text-xs font-bold text-brand-secondary mt-1">
                          {(product.price * cdfRate).toLocaleString()} FC
                          <span className="text-[9px] text-gray-400 block font-normal">(1$ = {cdfRate} FC)</span>
                      </div>
                  )}
                  <span className="text-[10px] text-gray-400">Négociable</span>
              </div>
              <div className="p-4 rounded-2xl bg-brand-card border border-gray-200 dark:border-white/5 shadow-sm">
                  <span className="block text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Commande Min.</span>
                  <div className="text-xl font-black text-brand-secondary flex items-center gap-1">
                      {product.moq || 1} <span className="text-xs font-medium text-gray-500">Pièces</span>
                  </div>
                  <span className="text-[10px] text-gray-400">En stock</span>
              </div>
          </div>

          {/* Quantity Selector */}
          {!(user?.role === UserRole.SUPPLIER && user.id === product.supplier_id) && (
            <div className="bg-brand-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 flex items-center justify-between">
                <div>
                    <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest">Quantité</h3>
                    <p className="text-[10px] text-gray-500">Min. {product.moq || 1} pièces</p>
                </div>
                <div className="flex items-center gap-4 bg-black/20 p-1 rounded-xl border border-white/5">
                    <button 
                        onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                        className="p-2 hover:bg-white/5 rounded-lg text-gray-400 transition-colors"
                    >
                        <Minus size={16} />
                    </button>
                    <span className="text-lg font-black text-white min-w-[3ch] text-center">{quantity}</span>
                    <button 
                        onClick={() => setQuantity(quantity + 1)}
                        className="p-2 hover:bg-white/5 rounded-lg text-brand-accent transition-colors"
                    >
                        <Plus size={16} />
                    </button>
                </div>
            </div>
          )}

          {/* Logistics Info */}
          <div className="bg-brand-card rounded-2xl border border-gray-200 dark:border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-500 font-medium">
                      <Truck size={14} /> Expédition
                  </div>
                  <div className="text-brand-secondary font-bold">{product.shipping_info || 'À négocier'}</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-500 font-medium">
                      <Clock size={14} /> Délai de livraison
                  </div>
                  <div className="text-brand-secondary font-bold">{product.lead_time || '7-15 jours'}</div>
              </div>
              <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-gray-500 font-medium">
                      <ShieldCheck size={14} /> Protection
                  </div>
                  <div className="text-emerald-500 font-bold">Paiement Sécurisé</div>
              </div>
          </div>

          {/* Supplier Profile Card */}
          <div className="bg-brand-card rounded-2xl border border-gray-200 dark:border-white/5 p-4" onClick={() => navigate(`/products?supplier=${product.supplier_id}`)}>
              <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                      <div className="relative">
                        <div className="w-14 h-14 rounded-2xl bg-gray-200 dark:bg-gray-800 overflow-hidden border-2 border-brand-accent/20">
                            <img src={product.profiles?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${product.supplier_id}`} className="w-full h-full object-cover" alt="Supplier" />
                        </div>
                        {product.profiles?.is_verified_supplier && (
                            <div className="absolute -bottom-1 -right-1 bg-brand-accent text-white p-1 rounded-lg shadow-lg">
                                <ShieldCheck size={10} fill="currentColor" />
                            </div>
                        )}
                      </div>
                      <div>
                          <h3 className="text-sm font-black text-brand-secondary uppercase tracking-tight">{product.profiles?.username || 'Fournisseur'}</h3>
                          <div className="flex items-center gap-1 text-[10px] text-gray-500 font-bold uppercase tracking-widest">
                              <MapPin size={10} /> {product.profiles?.city || product.city}, {product.profiles?.country || product.country}
                          </div>
                          <div className="flex items-center gap-1 mt-1">
                              <div className="flex text-yellow-500">
                                  {[...Array(5)].map((_, i) => <Star key={i} size={10} fill="currentColor" />)}
                              </div>
                              <span className="text-[10px] text-gray-400 font-bold">(4.9)</span>
                          </div>
                      </div>
                  </div>
                  <ChevronRight size={20} className="text-gray-400" />
              </div>
              <div className="grid grid-cols-3 gap-2 pt-4 border-t border-white/5">
                  <div className="text-center">
                      <div className="text-xs font-black text-brand-secondary">3 ans</div>
                      <div className="text-[8px] text-gray-500 uppercase font-bold">Expérience</div>
                  </div>
                  <div className="text-center border-x border-white/5">
                      <div className="text-xs font-black text-brand-secondary">98%</div>
                      <div className="text-[8px] text-gray-500 uppercase font-bold">Réponse</div>
                  </div>
                  <div className="text-center">
                      <div className="text-xs font-black text-brand-secondary">50k+</div>
                      <div className="text-[8px] text-gray-500 uppercase font-bold">Ventes</div>
                  </div>
              </div>
          </div>

          {/* Specifications */}
          <div>
              <h3 className="text-xs font-black text-brand-secondary mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <Info size={16} className="text-brand-accent" /> Spécifications Techniques
              </h3>
              <div className="bg-brand-card rounded-2xl border border-gray-200 dark:border-white/5 overflow-hidden">
                  {product.specifications ? Object.entries(product.specifications).map(([key, value], idx) => (
                      <div key={key} className={`flex items-center p-3 text-xs ${idx % 2 === 0 ? 'bg-white/5' : ''}`}>
                          <div className="w-1/3 text-gray-500 font-bold uppercase tracking-tighter">{key}</div>
                          <div className="flex-1 text-brand-secondary font-medium">{value}</div>
                      </div>
                  )) : (
                    <div className="p-4 text-center text-xs text-gray-500 italic">Aucune spécification détaillée fournie.</div>
                  )}
              </div>
          </div>

          {/* Description */}
          <div>
              <h3 className="text-xs font-black text-brand-secondary mb-4 flex items-center gap-2 uppercase tracking-widest">
                  <Clock size={16} className="text-brand-accent" /> Description du Produit
              </h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm text-gray-600 dark:text-gray-300 leading-relaxed bg-brand-card p-4 rounded-2xl border border-white/5">
                    {product.description}
                </p>
              </div>
          </div>

          {/* Customization */}
          <div className="bg-brand-card rounded-2xl border border-gray-200 dark:border-white/5 p-4">
              <h3 className="text-[10px] font-black text-brand-secondary uppercase tracking-widest mb-3">Personnalisation</h3>
              <div className="space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-gray-500">Logo personnalisé (Min. 500 pièces)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-gray-500">Emballage personnalisé (Min. 1000 pièces)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs">
                      <CheckCircle2 size={14} className="text-emerald-500" />
                      <span className="text-gray-500">Personnalisation graphique (Min. 500 pièces)</span>
                  </div>
              </div>
          </div>

          {/* Related Products */}
          <div className="pt-8 border-t border-white/5">
              <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs font-black text-brand-secondary uppercase tracking-widest">Produits Similaires</h3>
                  <button onClick={() => navigate('/products')} className="text-[10px] font-bold text-brand-accent uppercase flex items-center gap-1">
                      Voir tout <ChevronRight size={12} />
                  </button>
              </div>
              <div className="grid grid-cols-2 gap-4">
                  {[...Array(2)].map((_, i) => (
                      <div key={i} className="bg-brand-card rounded-2xl border border-white/5 overflow-hidden group cursor-pointer" onClick={() => navigate('/products')}>
                          <div className="aspect-square bg-gray-200 dark:bg-gray-800 relative">
                              <img src={`https://picsum.photos/seed/rel-${i}/400/400`} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="Related" />
                          </div>
                          <div className="p-3">
                              <h4 className="text-[10px] font-bold text-brand-secondary truncate mb-1">Produit Recommandé {i+1}</h4>
                              <div className="text-xs font-black text-brand-accent">{(Math.random() * 100).toFixed(2)} $</div>
                          </div>
                      </div>
                  ))}
              </div>
          </div>

          {/* Comments Section */}
          <div className="pt-6 border-t border-gray-200 dark:border-white/5">
               <h3 className="text-sm font-bold text-brand-secondary mb-4">Questions & Avis ({comments.length})</h3>
               
               <div className="space-y-4 mb-6">
                   {comments.map(c => (
                       <div key={c.id} className="flex gap-3">
                           <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-white/10 flex items-center justify-center font-bold text-xs text-gray-600 dark:text-gray-300">
                               {c.username.charAt(0)}
                           </div>
                           <div className="flex-1">
                               <div className="bg-gray-100 dark:bg-white/5 p-3 rounded-2xl rounded-tl-none">
                                   <div className="flex justify-between items-baseline mb-1">
                                       <span className="text-xs font-bold text-brand-secondary">{c.username}</span>
                                       <span className="text-[10px] text-gray-500">{new Date(c.created_at).toLocaleDateString()}</span>
                                   </div>
                                   <p className="text-xs text-gray-600 dark:text-gray-300">
                                       {c.text}
                                   </p>
                               </div>
                           </div>
                       </div>
                   ))}
               </div>

               <form onSubmit={handlePostComment} className="relative">
                   <input 
                       className="w-full bg-gray-100 dark:bg-white/5 border-transparent rounded-full py-3 pl-4 pr-12 text-sm font-medium text-brand-secondary outline-none focus:bg-white dark:focus:bg-black focus:border-brand-accent border transition-all placeholder:text-gray-500"
                       placeholder="Écrire un commentaire..."
                       value={newComment}
                       onChange={(e) => setNewComment(e.target.value)}
                   />
                   <button 
                      type="submit" 
                      disabled={isAdding || !newComment.trim()}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 bg-brand-accent rounded-full text-white disabled:opacity-50 transition-transform hover:scale-105"
                   >
                       <Send size={14} />
                   </button>
               </form>
          </div>
      </div>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 glass-nav p-4 border-t border-gray-200 dark:border-white/5 safe-bottom z-50 flex items-center gap-3">
           <button 
              onClick={() => navigate('/discussions', { state: { supplier_id: product.supplier_id, name: product.profiles?.username || 'Fournisseur' } })}
              className="flex flex-col items-center justify-center gap-1 px-3 text-gray-500 hover:text-brand-accent transition-colors"
           >
               <MessageCircle size={20} />
               <span className="text-[8px] font-bold uppercase">Chat</span>
           </button>
           
           <div className="flex-1">
               <span className="block text-[8px] font-bold text-gray-500 uppercase">Total</span>
               <div className="text-lg font-black text-brand-secondary">{formatPrice(product.price * quantity)}</div>
               {user?.country === 'RDC' && (
                   <div className="text-[10px] font-bold text-gray-500">
                       {(product.price * quantity * cdfRate).toLocaleString()} FC
                   </div>
               )}
           </div>

           {user?.role === UserRole.SUPPLIER && user.id === product.supplier_id ? (
               <button className="flex-1 bg-gray-200 dark:bg-white/10 text-brand-secondary font-bold py-3 rounded-xl text-xs uppercase tracking-widest">
                   Gérer
               </button>
           ) : (
               <button onClick={handleOrder} className="flex-[1.5] bg-brand-accent text-white font-bold py-3 rounded-xl shadow-glow text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-[1.02] transition-transform active:scale-95">
                   <ShoppingCart size={16} /> Commander
               </button>
           )}
      </div>
    </motion.div>
  );
};
