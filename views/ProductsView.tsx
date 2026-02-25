
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Search, MapPin, Plus, MessageCircle, SlidersHorizontal, X, Camera, UploadCloud, Globe, Heart, ShieldCheck, CheckCircle2, Loader2, Trash2, AlertTriangle, ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { AFRICAN_CITIES, CATEGORIES, UserProfile, Product, UserRole } from '../types';
import { supabase } from '../supabaseClient';
import { useCurrency } from '../contexts/CurrencyContext';
import { createNotification, notifyAdmins } from '../services/notificationService';

interface ProductsViewProps {
  user: UserProfile | null;
  isAddModalOpen: boolean;
  setIsAddModalOpen: (val: boolean) => void;
  notify: (m: string) => void;
}

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'demo-1',
    name: 'Générateur Solaire 5KW',
    description: 'Solution autonome pour sites isolés. Hybride, 48V. Idéal pour PME et résidences.',
    price: 1200,
    category: 'Énergie',
    image_url: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=800&q=80',
    supplier_id: 'demo-supplier',
    country: 'RDC',
    city: 'Kinshasa',
    likes_count: 42,
    created_at: new Date().toISOString(),
    moq: 1,
    profiles: { username: 'SolarTech RDC', is_verified_supplier: true, avatar_url: '' }
  },
  {
    id: 'demo-2',
    name: 'Pompe Hydraulique Industrielle',
    description: 'Haut rendement pour irrigation et mines. Débit 500L/min.',
    price: 850,
    category: 'Machines',
    image_url: 'https://images.unsplash.com/photo-1518709766631-a6a7f45921c3?w=800&q=80',
    supplier_id: 'demo-supplier-2',
    country: 'Côte d’Ivoire',
    city: 'Abidjan',
    likes_count: 18,
    created_at: new Date().toISOString(),
    moq: 5,
    profiles: { username: 'AgroMech CI', is_verified_supplier: true, avatar_url: '' }
  },
  {
    id: 'demo-3',
    name: 'Tracteur Agricole Compact',
    description: '45CV, 4x4, parfait pour maraîchage intensif.',
    price: 15000,
    category: 'Agriculture',
    image_url: 'https://images.unsplash.com/photo-1592983177815-4672ba265e31?w=800&q=80',
    supplier_id: 'demo-supplier-3',
    country: 'Sénégal',
    city: 'Dakar',
    likes_count: 156,
    created_at: new Date().toISOString(),
    moq: 1,
    profiles: { username: 'Sahel Motors', is_verified_supplier: true, avatar_url: '' }
  }
];

export const ProductsView: React.FC<ProductsViewProps> = ({ user, isAddModalOpen, setIsAddModalOpen, notify }) => {
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  
  // Filters
  const [selectedCat, setSelectedCat] = useState(queryParams.get('cat') || 'Tous');
  const [selectedCountry, setSelectedCountry] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [searchQuery, setSearchQuery] = useState(queryParams.get('q') || '');
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  // Form states for new product
  const [newProduct, setNewProduct] = useState({
    name: '',
    price: '',
    category: CATEGORIES[0],
    description: '',
    moq: '1'
  });
  
  // Image Upload State
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Unique countries for the filter
  const countries = Array.from(new Set(AFRICAN_CITIES.map(c => c.country))).sort();
  
  // Cities filtered by selected country
  const filteredCities = selectedCountry 
    ? AFRICAN_CITIES.filter(c => c.country === selectedCountry).map(c => c.city).sort()
    : [];

  useEffect(() => {
    fetchProducts();
  }, [selectedCat, selectedCountry, selectedCity, searchQuery, verifiedOnly]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let selectStatement = '*, profiles!products_supplier_id_fkey(username, is_verified_supplier, avatar_url)';
      
      if (verifiedOnly) {
        selectStatement = '*, profiles!products_supplier_id_fkey!inner(username, is_verified_supplier, avatar_url)';
      }

      let query = supabase.from('products').select(selectStatement).order('created_at', { ascending: false });
      
      if (verifiedOnly) {
        query = query.eq('profiles.is_verified_supplier', true);
      }

      if (selectedCat !== 'Tous') query = query.eq('category', selectedCat);
      if (selectedCountry) query = query.eq('country', selectedCountry);
      if (selectedCity) query = query.eq('city', selectedCity);
      if (searchQuery) query = query.ilike('name', `%${searchQuery}%`);
      
      const { data, error } = await query;
      
      if (error) throw error;
      setProducts((data as unknown as Product[]) || []);
    } catch (err: any) {
      const msg = (err?.message || String(err)).toLowerCase();
      if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed')) {
         setProducts(MOCK_PRODUCTS);
      } else {
         console.warn("Erreur fetch products:", err.message);
      }
    } finally { setLoading(false); }
  };

  const handleCountryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCountry(e.target.value);
    setSelectedCity(''); 
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) { 
        notify("Image trop lourde (>5MB)");
        return;
      }
      setImageFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const checkMonthlyLimit = async () => {
     if (!user || user.is_verified_supplier) return true;

     const now = new Date();
     const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

     try {
         const { count, error } = await supabase
            .from('products')
            .select('*', { count: 'exact', head: true })
            .eq('supplier_id', user.id)
            .gte('created_at', startOfMonth);

         if (error) throw error;

         if ((count || 0) >= 5) {
             setShowLimitModal(true);
             setIsAddModalOpen(false); 
             return false;
         }
         return true;
     } catch (err) {
         return true; 
     }
  };

  const handlePostProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || user.role !== UserRole.SUPPLIER) return;
    
    setUploading(true);

    try {
      const canPost = await checkMonthlyLimit();
      if (!canPost) {
          setUploading(false);
          return;
      }

      let finalImageUrl = `https://picsum.photos/seed/${Date.now()}/400/300`; 

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const filePath = `${fileName}`;

        try {
            const { error: uploadError } = await supabase.storage
              .from('products')
              .upload(filePath, imageFile, {
                contentType: imageFile.type,
                upsert: true
              });

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
            .from('products')
            .getPublicUrl(filePath);
            
            finalImageUrl = urlData.publicUrl;
        } catch (storageErr: any) {
            console.warn("Erreur image:", storageErr);
        }
      }

      if (!newProduct.name || !newProduct.price || !newProduct.description) {
        notify("Veuillez remplir tous les champs obligatoires.");
        setUploading(false);
        return;
      }

      const parsedPrice = parseFloat(newProduct.price);
      if (isNaN(parsedPrice) || parsedPrice < 0) {
        notify("Prix invalide.");
        setUploading(false);
        return;
      }

      const parsedMoq = parseInt(newProduct.moq) || 1;
      if (parsedMoq < 1) {
        notify("Quantité minimum invalide.");
        setUploading(false);
        return;
      }

      const newProductData = {
        name: newProduct.name,
        price: parsedPrice,
        category: newProduct.category || 'Divers',
        description: newProduct.description,
        moq: parsedMoq,
        image_url: finalImageUrl,
        supplier_id: user.id,
        country: user.country || 'RDC', // Fallback
        city: user.city || 'Kinshasa',   // Fallback
        likes_count: 0
      };

      console.log("Inserting product:", newProductData);

      const { error: dbError } = await supabase.from('products').insert([newProductData]);
      
      if (dbError) {
        console.error("Database error:", dbError);
        throw dbError;
      }

      // Notify Admins
      await notifyAdmins(
        "Nouvelle Offre",
        `${user.username} a publié un nouveau produit : ${newProduct.name}`,
        `/products`
      );

      notify("Produit en ligne");
      fetchProducts(); 
      setIsAddModalOpen(false);
      setNewProduct({ name: '', price: '', category: CATEGORIES[0], description: '', moq: '1' });
      setImageFile(null);
      setPreviewUrl(null);

    } catch (err: any) {
      const msg = err.message || JSON.stringify(err);
      notify(`Erreur: ${msg}`);
    } finally { 
      setUploading(false); 
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6"
    >
      
      {/* MODAL LIMITE ATTEINTE */}
      {showLimitModal && (
          <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
             <div className="bg-brand-card rounded-3xl p-6 max-w-sm w-full relative overflow-hidden">
                <div className="w-16 h-16 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 mx-auto mb-4">
                    <AlertTriangle size={32} />
                </div>
                
                <h3 className="text-xl font-bold text-center text-brand-secondary mb-2">Limite Atteinte</h3>
                <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
                   Vous avez atteint la limite gratuite de <strong>5 articles ce mois-ci</strong>. Passez au statut <span className="text-green-500 font-bold">Vérifié</span> pour publier en illimité.
                </p>

                <div className="space-y-3">
                   <button 
                      onClick={() => { setShowLimitModal(false); navigate('/menu'); }}
                      className="w-full py-4 bg-green-500 text-white rounded-xl font-bold text-sm shadow-md"
                   >
                       Vérifier mon compte
                   </button>
                   <button 
                      onClick={() => setShowLimitModal(false)}
                      className="w-full py-4 bg-gray-100 dark:bg-white/5 text-gray-500 rounded-xl font-bold text-sm"
                   >
                       Plus Tard
                   </button>
                </div>
             </div>
          </div>
      )}

      {/* Modal d'Ajout Produit */}
      {isAddModalOpen && user?.role === UserRole.SUPPLIER && (
        <div className="fixed inset-0 z-[100] bg-brand-primary/95 flex flex-col p-6 animate-in fade-in duration-300 overflow-hidden">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-brand-secondary">Nouveau Produit</h2>
            <button onClick={() => setIsAddModalOpen(false)} className="p-2 bg-brand-card border border-gray-200 dark:border-white/10 rounded-full hover:bg-gray-200 dark:hover:bg-white/10"><X size={20}/></button>
          </div>
          
          <form onSubmit={handlePostProduct} className="flex-1 overflow-y-auto space-y-6 pb-20 scrollbar-hide">
            
            {!user.is_verified_supplier && (
                 <div className="bg-orange-50/50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/20 p-4 rounded-xl flex items-center gap-3">
                     <AlertTriangle className="text-orange-500 shrink-0" size={20} />
                     <p className="text-xs text-orange-600 dark:text-orange-200 font-medium">Compte Standard : Limité à 5 ajouts / mois.</p>
                 </div>
            )}

            <div 
              onClick={triggerFileInput}
              className={`aspect-video w-full rounded-2xl flex flex-col items-center justify-center gap-2 group cursor-pointer transition-all border-2 border-dashed relative overflow-hidden ${previewUrl ? 'border-brand-accent bg-black' : 'border-gray-200 dark:border-white/10 bg-brand-card hover:border-brand-accent'}`}
            >
              <input type="file" ref={fileInputRef} onChange={handleImageSelect} className="hidden" accept="image/png, image/jpeg, image/jpg, image/webp" />
              
              {previewUrl ? (
                <>
                  <img src={previewUrl} alt="Preview" className="w-full h-full object-contain" />
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <Camera size={32} className="text-white" />
                  </div>
                </>
              ) : (
                <>
                  <div className="p-4 bg-gray-100 dark:bg-white/5 rounded-full">
                    <UploadCloud size={32} className="text-gray-400" />
                  </div>
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Ajouter une photo</span>
                </>
              )}
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 pl-1">Nom de l'unité</label>
                <input 
                  placeholder="Ex: Générateur Solaire" 
                  className="w-full bg-brand-card border border-gray-200 dark:border-white/10 p-4 rounded-xl text-sm outline-none focus:border-brand-accent text-brand-secondary"
                  value={newProduct.name}
                  onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 pl-1">Prix (USD)</label>
                  <input 
                    type="number" step="0.01" placeholder="0.00" 
                    className="w-full bg-brand-card border border-gray-200 dark:border-white/10 p-4 rounded-xl text-sm outline-none focus:border-brand-accent text-brand-secondary"
                    value={newProduct.price}
                    onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-gray-500 pl-1">Qté Min (MOQ)</label>
                  <input 
                    type="number" placeholder="1" 
                    className="w-full bg-brand-card border border-gray-200 dark:border-white/10 p-4 rounded-xl text-sm outline-none focus:border-brand-accent text-brand-secondary"
                    value={newProduct.moq}
                    onChange={e => setNewProduct({...newProduct, moq: e.target.value})}
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 pl-1">Catégorie</label>
                <div className="relative">
                  <select 
                    className="w-full bg-brand-card border border-gray-200 dark:border-white/10 p-4 rounded-xl text-sm appearance-none outline-none focus:border-brand-accent text-brand-secondary"
                    value={newProduct.category}
                    onChange={e => setNewProduct({...newProduct, category: e.target.value})}
                  >
                    {CATEGORIES.map(c => <option key={c} value={c} className="bg-brand-card text-brand-secondary">{c}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-gray-500 pl-1">Description</label>
                <textarea 
                  placeholder="Détails techniques..." 
                  className="w-full bg-brand-card border border-gray-200 dark:border-white/10 p-4 rounded-xl text-sm min-h-[120px] outline-none focus:border-brand-accent text-brand-secondary"
                  value={newProduct.description}
                  onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  required
                />
              </div>
            </div>

            <button 
              type="submit" 
              disabled={uploading}
              className="w-full py-4 bg-brand-accent text-white rounded-2xl font-bold text-sm shadow-md flex items-center justify-center gap-2"
            >
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
              <span>{uploading ? 'Publication...' : 'Publier'}</span>
            </button>
          </form>
        </div>
      )}

      {/* Header List View */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-xl font-bold text-brand-secondary">Marketplace</h2>
          <p className="text-xs text-gray-500 font-medium">Explorer les offres</p>
        </div>
        {user?.role === UserRole.SUPPLIER && (
          <button onClick={() => setIsAddModalOpen(true)} className="p-3 bg-brand-accent rounded-full text-white shadow-md hover:scale-110 transition-transform">
            <Plus size={20} />
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6 overflow-x-auto scrollbar-hide pb-2 items-center">
        <button onClick={() => setSelectedCat('Tous')} className={`px-4 py-2 rounded-full text-xs font-bold transition-all ${selectedCat === 'Tous' ? 'bg-brand-accent text-white' : 'bg-brand-card text-gray-500'}`}>Tous</button>
        <button onClick={() => setVerifiedOnly(!verifiedOnly)} className={`flex items-center gap-1 px-4 py-2 rounded-full text-xs font-bold transition-all ${verifiedOnly ? 'bg-brand-accent text-white' : 'bg-brand-card text-gray-500'}`}>
          <ShieldCheck size={12} fill={verifiedOnly ? "currentColor" : "none"} /> Vérifié
        </button>
        <div className="w-[1px] h-6 bg-gray-200 dark:bg-white/10 mx-1 flex-shrink-0" />
        {CATEGORIES.map(c => (
          <button key={c} onClick={() => setSelectedCat(c)} className={`px-4 py-2 rounded-full text-xs font-bold flex-shrink-0 transition-all ${selectedCat === c ? 'bg-brand-accent/10 text-brand-accent' : 'bg-brand-card text-gray-500'}`}>{c}</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3 mb-8">
        <div className="relative col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" placeholder="Rechercher..." 
            className="w-full bg-brand-card border border-transparent rounded-full py-3 pl-12 pr-4 text-sm font-medium focus:bg-brand-primary focus:border-brand-accent focus:shadow-md outline-none text-brand-secondary transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        
        <div className="relative group">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <select 
            className="w-full bg-brand-card border border-transparent rounded-xl py-3 pl-9 pr-2 text-xs font-medium appearance-none text-brand-secondary outline-none"
            value={selectedCountry}
            onChange={handleCountryChange}
          >
            <option value="">Tout Pays</option>
            {countries.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        <div className={`relative group ${!selectedCountry ? 'opacity-50' : ''}`}>
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
          <select 
            className="w-full bg-brand-card border border-transparent rounded-xl py-3 pl-9 pr-2 text-xs font-medium appearance-none text-brand-secondary outline-none"
            value={selectedCity}
            onChange={(e) => setSelectedCity(e.target.value)}
            disabled={!selectedCountry}
          >
            <option value="">Toutes Villes</option>
            {filteredCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 pb-24">
        {loading ? (
          <div className="col-span-2 py-20 text-center text-gray-400 text-sm animate-pulse">Chargement...</div>
        ) : products.length > 0 ? (
          products.map(p => (
            <div 
              key={p.id} 
              onClick={() => navigate(`/products/${p.id}`)}
              className="bg-brand-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all cursor-pointer group"
            >
              <div className="relative aspect-square bg-gray-100 dark:bg-gray-800">
                <img src={p.image_url || `https://picsum.photos/seed/${p.id}/400/400`} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
                {p.profiles?.is_verified_supplier && (
                  <div className="absolute top-2 right-2 bg-white p-1 rounded-full shadow-sm">
                    <CheckCircle2 size={12} fill="currentColor" className="text-green-500" />
                  </div>
                )}
              </div>
              <div className="p-3">
                <h4 className="text-sm font-medium text-brand-secondary line-clamp-1 mb-1">{p.name}</h4>
                <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-brand-accent">{formatPrice(p.price)}</span>
                    <span className="text-[10px] text-gray-400">MOQ: {p.moq || 1}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                  <MapPin size={10} /> {p.city}, {p.country}
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-2 py-20 text-center">
            <div className="mb-4 text-gray-400 flex justify-center"><Search size={40} /></div>
            <p className="text-sm text-gray-500">Aucun produit trouvé.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
};
