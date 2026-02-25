import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, Upload, CreditCard, CheckCircle2, AlertCircle, Loader2, 
  ChevronLeft, Camera, ShieldAlert, Info, Banknote, ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { UserProfile } from '../types';

interface VerificationViewProps {
  user: UserProfile | null;
  onUpdateProfile: (newProfile: UserProfile) => void;
  notify: (m: string) => void;
}

export const VerificationView: React.FC<VerificationViewProps> = ({ user, onUpdateProfile, notify }) => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [request, setRequest] = useState<any>(null);
  const [idFile, setIdFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    fetchVerificationStatus();

    const params = new URLSearchParams(window.location.search);
    if (params.get('verification') === 'success') {
      handleVerificationSuccess();
    }
  }, [user]);

  const handleVerificationSuccess = async () => {
    if (!user) return;
    try {
      setSubmitting(true);
      
      // Update the request status
      const { error: updateRequestError } = await supabase
        .from('verification_requests')
        .update({ status: 'completed', updated_at: new Date().toISOString() })
        .eq('user_id', user.id)
        .eq('status', 'pending_payment');

      if (updateRequestError) {
          console.error("Error updating request:", updateRequestError);
      }

      // Update the profile
      const { error: updateProfileError } = await supabase
        .from('profiles')
        .update({ is_verified_supplier: true, updated_at: new Date().toISOString() })
        .eq('id', user.id);

      if (updateProfileError) throw updateProfileError;

      onUpdateProfile({ ...user, is_verified_supplier: true });
      notify("Félicitations ! Votre compte est maintenant vérifié.");
      navigate('/verification', { replace: true });
    } catch (error: any) {
      notify("Erreur lors de la finalisation: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const fetchVerificationStatus = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('verification_requests')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (data) {
        setRequest(data);
      }
    } catch (error) {
      console.log("No existing request found");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setIdFile(file);
      setPreviewUrl(URL.createObjectURL(file));
    }
  };

  const uploadIdCard = async () => {
    if (!idFile || !user) return;

    try {
      setSubmitting(true);
      const fileExt = idFile.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;
      const filePath = `id-cards/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('id-cards')
        .upload(filePath, idFile, {
          contentType: idFile.type,
          upsert: true
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('id-cards')
        .getPublicUrl(filePath);

      const { data, error } = await supabase
        .from('verification_requests')
        .insert([{
          user_id: user.id,
          id_card_url: publicUrlData.publicUrl,
          status: 'pending_admin'
        }])
        .select()
        .single();

      if (error) throw error;
      setRequest(data);
      notify("Document envoyé avec succès ! En attente de validation admin.");
    } catch (error: any) {
      notify("Erreur: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePayment = async () => {
    try {
      setSubmitting(true);
      const response = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user?.id, userEmail: user?.email })
      });

      const session = await response.json();
      if (session.url) {
        window.location.href = session.url;
      } else {
        throw new Error("Impossible de créer la session de paiement");
      }
    } catch (error: any) {
      notify("Erreur paiement: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-brand-primary flex items-center justify-center">
        <Loader2 className="animate-spin text-brand-accent" size={40} />
      </div>
    );
  }

  const handleMobileMoneyPayment = async (provider: string) => {
    const phone = prompt(`Entrez votre numéro ${provider} (ex: 0812345678) :`);
    if (!phone) return;

    try {
      setSubmitting(true);
      const response = await fetch('/api/initiate-mobile-money', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user?.id, 
          userEmail: user?.email,
          phoneNumber: phone,
          provider: provider === 'Orange Money' ? 'orange' : (provider === 'Airtel Money' ? 'airtel' : 'vodacom'),
          amount: 8
        })
      });

      const data = await response.json();
      
      if (data.status === 'success' || data.status === 'pending') {
        if (data.meta?.authorization?.mode === 'redirect') {
          window.location.href = data.meta.authorization.redirect;
        } else {
          notify("Paiement initié. Veuillez valider sur votre téléphone.");
          // On pourrait ajouter un polling ici pour vérifier le statut
        }
      } else {
        throw new Error(data.message || "Erreur d'initialisation");
      }

    } catch (error: any) {
      notify("Erreur paiement: " + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const renderStep = () => {
    if (user?.is_verified_supplier) {
      return (
        <div className="text-center py-12">
          <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldCheck size={48} className="text-green-500" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Compte Vérifié</h2>
          <p className="text-gray-400 mb-8">Félicitations ! Votre compte est certifié TradeHub.</p>
          <button onClick={() => navigate('/menu')} className="px-8 py-3 bg-brand-accent text-white rounded-xl font-bold">Retour au menu</button>
        </div>
      );
    }

    if (!request) {
      return (
        <div className="space-y-8">
          <div className="bg-brand-card p-6 rounded-3xl border border-white/5">
            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Camera className="text-brand-accent" size={20} />
              Étape 1 : Pièce d'Identité
            </h3>
            <p className="text-sm text-gray-400 mb-6">Veuillez télécharger une photo claire de votre carte d'identité ou passeport pour validation.</p>
            
            <div 
              onClick={() => document.getElementById('id-upload')?.click()}
              className="aspect-video w-full border-2 border-dashed border-white/10 rounded-2xl flex flex-col items-center justify-center gap-3 cursor-pointer hover:border-brand-accent transition-all overflow-hidden relative"
            >
              {previewUrl ? (
                <img src={previewUrl} className="w-full h-full object-cover" />
              ) : (
                <>
                  <Upload size={32} className="text-gray-500" />
                  <span className="text-xs font-bold text-gray-500 uppercase">Cliquez pour uploader</span>
                </>
              )}
              <input type="file" id="id-upload" className="hidden" accept="image/*" onChange={handleFileChange} />
            </div>
          </div>

          <button 
            disabled={!idFile || submitting}
            onClick={uploadIdCard}
            className="w-full py-4 bg-brand-accent text-white rounded-2xl font-bold shadow-glow flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="animate-spin" size={20} /> : <ArrowRight size={20} />}
            Soumettre pour validation
          </button>
        </div>
      );
    }

    if (request.status === 'pending_admin') {
      return (
        <div className="text-center py-12 bg-brand-card rounded-3xl border border-white/5 p-8">
          <div className="w-20 h-20 bg-orange-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <ShieldAlert size={48} className="text-orange-500" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Validation en cours</h2>
          <p className="text-sm text-gray-400 mb-6">Votre document est en cours d'examen par notre équipe. Vous recevrez une notification dès qu'il sera validé.</p>
          <div className="p-4 bg-white/5 rounded-xl text-left">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase mb-2">
              <Info size={14} /> Statut
            </div>
            <p className="text-sm text-orange-500 font-bold">Attente de confirmation Admin</p>
          </div>
        </div>
      );
    }

    if (request.status === 'pending_payment') {
      return (
        <div className="space-y-8">
          <div className="bg-brand-card p-8 rounded-3xl border border-white/5 text-center">
            <div className="w-20 h-20 bg-brand-accent/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <CreditCard size={48} className="text-brand-accent" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Document Validé !</h2>
            <p className="text-sm text-gray-400 mb-8">Dernière étape : réglez les frais pour activer votre badge vérifié.</p>
            
            <div className="bg-white/5 p-6 rounded-2xl text-left mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-gray-400">Frais de certification</span>
                <span className="text-xl font-bold text-white">5.00 USD</span>
              </div>
              <div className="flex justify-between items-center mb-4 border-b border-white/5 pb-4">
                <span className="text-gray-400">Abonnement mensuel</span>
                <span className="text-lg font-bold text-brand-accent">3.00 USD / mois</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-sm font-bold text-white uppercase">Total à payer</span>
                <span className="text-2xl font-black text-brand-accent">8.00 USD</span>
              </div>
              <ul className="space-y-2 mt-6">
                <li className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 size={14} className="text-green-500" /> Badge de confiance
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 size={14} className="text-green-500" /> Priorité dans les recherches
                </li>
                <li className="flex items-center gap-2 text-xs text-gray-400">
                  <CheckCircle2 size={14} className="text-green-500" /> Support dédié
                </li>
              </ul>
            </div>

            <button 
              disabled={submitting}
              onClick={handlePayment}
              className="w-full py-4 bg-brand-accent text-white rounded-2xl font-bold shadow-glow flex items-center justify-center gap-2 mb-4"
            >
              {submitting ? <Loader2 className="animate-spin" size={20} /> : <CreditCard size={20} />}
              Payer avec Stripe
            </button>

            <div className="relative mb-4">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10"></div>
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-brand-card px-2 text-gray-500">Ou Mobile Money (RDC)</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <button 
                disabled={submitting}
                onClick={() => handleMobileMoneyPayment('Orange Money')}
                className="py-3 bg-orange-500/10 text-orange-500 border border-orange-500/20 rounded-xl font-bold text-xs hover:bg-orange-500 hover:text-white transition-all"
              >
                Orange Money
              </button>
              <button 
                disabled={submitting}
                onClick={() => handleMobileMoneyPayment('Airtel Money')}
                className="py-3 bg-red-500/10 text-red-500 border border-red-500/20 rounded-xl font-bold text-xs hover:bg-red-500 hover:text-white transition-all"
              >
                Airtel Money
              </button>
              <button 
                disabled={submitting}
                onClick={() => handleMobileMoneyPayment('M-Pesa')}
                className="py-3 bg-green-500/10 text-green-500 border border-green-500/20 rounded-xl font-bold text-xs hover:bg-green-500 hover:text-white transition-all"
              >
                M-Pesa
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (request.status === 'rejected') {
        return (
          <div className="text-center py-12 bg-brand-card rounded-3xl border border-white/5 p-8">
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <ShieldAlert size={48} className="text-red-500" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Document Refusé</h2>
            <p className="text-sm text-gray-400 mb-6">Votre document n'a pas pu être validé. Veuillez réessayer avec une photo plus nette.</p>
            <button 
                onClick={() => setRequest(null)}
                className="w-full py-4 bg-white/5 text-white rounded-2xl font-bold border border-white/10"
            >
                Réessayer
            </button>
          </div>
        );
      }

    return null;
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="min-h-screen bg-brand-primary p-6 pb-24"
    >
      <header className="flex items-center gap-4 mb-8">
        <button onClick={() => navigate('/menu')} className="p-2 bg-brand-card rounded-full text-gray-400">
          <ChevronLeft size={24} />
        </button>
        <h1 className="text-2xl font-orbitron font-bold text-white uppercase tracking-tighter">Certification</h1>
      </header>

      <div className="max-w-md mx-auto">
        <div className="flex justify-between mb-8 px-4">
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${!request ? 'bg-brand-accent text-white' : 'bg-green-500 text-white'}`}>1</div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">ID Card</span>
          </div>
          <div className="flex-1 h-[2px] bg-white/10 mt-4 mx-2" />
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${request?.status === 'pending_payment' ? 'bg-brand-accent text-white' : 'bg-white/10 text-gray-500'}`}>2</div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Paiement</span>
          </div>
          <div className="flex-1 h-[2px] bg-white/10 mt-4 mx-2" />
          <div className="flex flex-col items-center gap-2">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${user?.is_verified_supplier ? 'bg-green-500 text-white' : 'bg-white/10 text-gray-500'}`}>3</div>
            <span className="text-[10px] font-bold text-gray-500 uppercase">Vérifié</span>
          </div>
        </div>

        {renderStep()}
      </div>
    </motion.div>
  );
};
