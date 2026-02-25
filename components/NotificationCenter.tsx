
import React, { useState, useEffect } from 'react';
import { Bell, X, Package, MessageSquare, ShoppingBag, Info, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase } from '../supabaseClient';
import { Notification, UserProfile } from '../types';
import { useNavigate } from 'react-router-dom';

interface NotificationCenterProps {
  user: UserProfile;
  isOpen: boolean;
  onClose: () => void;
}

export const NotificationCenter: React.FC<NotificationCenterProps> = ({ user, isOpen, onClose }) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen]);

  useEffect(() => {
    const channel = supabase.channel(`user_notifications_${user.id}`)
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'notifications',
        filter: `user_id=eq.${user.id}`
      }, (payload) => {
        setNotifications(prev => [payload.new as Notification, ...prev]);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user.id]);

  const fetchNotifications = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setNotifications(data || []);
    } catch (err) {
      console.error("Error fetching notifications:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    } catch (err) {
      console.error("Error marking as read:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
      
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error("Error marking all as read:", err);
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      onClose();
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'order': return <ShoppingBag size={16} className="text-blue-500" />;
      case 'message': return <MessageSquare size={16} className="text-green-500" />;
      case 'product': return <Package size={16} className="text-purple-500" />;
      default: return <Info size={16} className="text-gray-500" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="relative w-full max-w-sm bg-brand-primary h-full shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Bell className="text-brand-accent" size={20} />
            <h2 className="text-lg font-bold text-white uppercase tracking-tighter">Notifications</h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
          {loading ? (
            <div className="flex justify-center py-10"><Loader2 className="animate-spin text-brand-accent" /></div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-20 text-gray-500">
              <Bell size={40} className="mx-auto mb-4 opacity-20" />
              <p className="text-sm">Aucune notification</p>
            </div>
          ) : (
            notifications.map(n => (
              <div 
                key={n.id} 
                onClick={() => handleNotificationClick(n)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${n.is_read ? 'bg-brand-card border-white/5 opacity-60' : 'bg-brand-card border-brand-accent/30 shadow-glow shadow-brand-accent/5'}`}
              >
                <div className="flex gap-3">
                  <div className="mt-1">{getIcon(n.type)}</div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="text-xs font-bold text-white uppercase tracking-wide">{n.title}</h4>
                      {!n.is_read && <div className="w-2 h-2 bg-brand-accent rounded-full" />}
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{n.message}</p>
                    <span className="text-[9px] text-gray-600 mt-2 block font-mono">
                      {new Date(n.created_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {notifications.some(n => !n.is_read) && (
          <div className="p-4 border-t border-white/5">
            <button 
              onClick={markAllAsRead}
              className="w-full py-3 bg-white/5 hover:bg-white/10 text-gray-400 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all"
            >
              Tout marquer comme lu
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
};

const Loader2 = ({ className, size = 24 }: { className?: string, size?: number }) => (
  <svg 
    className={className} 
    width={size} 
    height={size} 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round"
  >
    <path d="M21 12a9 9 0 1 1-6.219-8.56" />
  </svg>
);
