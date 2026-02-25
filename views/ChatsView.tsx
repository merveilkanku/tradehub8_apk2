
import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Phone, Video, Search, ChevronLeft, Paperclip, FileText, Download, Loader2, MessageSquare, VideoOff, PhoneOff, Mic, MicOff, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';
import { UserProfile, Message } from '../types';
import { supabase } from '../supabaseClient';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createNotification } from '../services/notificationService';

interface ChatsViewProps {
  user: UserProfile;
}

const rtcConfig = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' }
  ]
};

const QUICK_REPLIES = [
  "Est-ce encore disponible ?",
  "Quel est votre meilleur prix ?",
  "Pouvez-vous livrer ?",
  "Je suis intéressé(e).",
  "Plus de photos svp ?"
];

interface ChatContact {
    id: string;
    name: string;
    avatar: string;
    online: boolean;
    lastMsg: string;
    lastMsgTime?: string;
}

export const ChatsView = ({ user }: ChatsViewProps) => {
  const location = useLocation();
  const [selectedChat, setSelectedChat] = useState<ChatContact | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [contacts, setContacts] = useState<ChatContact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // États Appels
  const [isInCall, setIsInCall] = useState(false);
  const [callType, setCallType] = useState<'video' | 'audio'>('video');
  const [incomingCall, setIncomingCall] = useState<{ caller: string, type: 'video' | 'audio', signal: any, from?: string } | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoStopped, setIsVideoStopped] = useState(false);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const peerConnection = useRef<RTCPeerConnection | null>(null);
  const signalingChannel = useRef<RealtimeChannel | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  // --- CHARGEMENT CONTACTS ---
  const fetchConversations = async () => {
    try {
        const { data, error } = await supabase.rpc('get_user_conversations', { current_user_id: user.id });
        
        if (!error && data) {
            const mappedContacts: ChatContact[] = data.map((c: any) => ({
                id: c.partner_id,
                name: c.username || 'Utilisateur',
                avatar: c.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.partner_id}`,
                online: true, 
                lastMsg: c.last_message || 'Démarrer une discussion',
                lastMsgTime: c.last_message_time
            }));
            setContacts(mappedContacts);
        } else {
            // Fallback manuel
            const { data: sentMessages } = await supabase.from('messages').select('*').eq('sender_id', user.id);
            const { data: receivedMessages } = await supabase.from('messages').select('*').eq('receiver_id', user.id);
            
            const allMessages = [...(sentMessages || []), ...(receivedMessages || [])];
            allMessages.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

            if (allMessages.length > 0) {
                const partnerMap = new Map();
                allMessages.forEach((msg: any) => {
                    const pid = msg.sender_id === user.id ? msg.receiver_id : msg.sender_id;
                    if (!partnerMap.has(pid)) {
                        partnerMap.set(pid, {
                            lastMsg: msg.text || (msg.type === 'image' ? 'Image' : 'Fichier'),
                            lastMsgTime: msg.created_at
                        });
                    }
                });
                
                const pids = Array.from(partnerMap.keys());
                if (pids.length > 0) {
                    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', pids);
                    const newContacts = profiles?.map((p: any) => ({
                        id: p.id,
                        name: p.username || 'Inconnu',
                        avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.id}`,
                        online: true,
                        lastMsg: partnerMap.get(p.id).lastMsg,
                        lastMsgTime: partnerMap.get(p.id).lastMsgTime
                    })) || [];
                    setContacts(newContacts);
                }
            }
        }
    } catch (err) {
        console.error("Erreur chargement contacts:", err);
    } finally {
        setLoadingContacts(false);
    }
  };

  useEffect(() => {
    fetchConversations();
  }, [user.id]);

  // --- INITIALISATION via Navigation ---
  useEffect(() => {
    if (location.state?.supplier_id && !loadingContacts) {
        const partnerId = location.state.supplier_id;
        const existing = contacts.find(c => c.id === partnerId);
        if (existing) {
            setSelectedChat(existing);
        } else {
            const newC = {
                id: partnerId,
                name: location.state.name || 'Nouveau Contact',
                avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${partnerId}`,
                online: true,
                lastMsg: 'Nouveau'
            };
            setContacts([newC, ...contacts]);
            setSelectedChat(newC);
        }
    }
  }, [location.state, loadingContacts, contacts]);

  // --- MESSAGES ---
  const fetchMessages = async (partnerId: string) => {
    setLoadingMessages(true);
    try {
      // Stratégie robuste : 2 requêtes simples fusionnées (évite les bugs de syntaxe OR complexes)
      const { data: sent, error: err1 } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', user.id)
        .eq('receiver_id', partnerId);
        
      const { data: received, error: err2 } = await supabase
        .from('messages')
        .select('*')
        .eq('sender_id', partnerId)
        .eq('receiver_id', user.id);

      if (err1) throw err1;
      if (err2) throw err2;

      const all = [...(sent || []), ...(received || [])];
      // Tri par date croissant (ancien -> récent)
      all.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      setMessages(all as Message[]);
    } catch (e) { 
        console.error("Erreur fetch messages:", e); 
    } finally {
        setLoadingMessages(false);
    }
  };

  useEffect(() => {
    if (!selectedChat) return;
    fetchMessages(selectedChat.id);

    // Souscription Realtime
    const channel = supabase.channel(`chat_room_${selectedChat.id}_${user.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
            const msg = payload.new as Message;
            // Vérification stricte pour éviter le mélange de conversations
            const isRelevant = (msg.sender_id === selectedChat.id && msg.receiver_id === user.id) || 
                               (msg.sender_id === user.id && msg.receiver_id === selectedChat.id);
            
            if (isRelevant) {
                setMessages(prev => {
                    // Éviter les doublons (si l'optimistic UI a déjà ajouté l'ID temporaire, on pourrait vouloir le remplacer, 
                    // mais ici on vérifie juste si l'ID final existe déjà)
                    if (prev.some(m => m.id === msg.id)) return prev;
                    return [...prev, msg];
                });
                
                // Mettre à jour la liste des contacts (dernier message)
                setContacts(prev => prev.map(c => {
                    if (c.id === selectedChat.id) {
                        return { 
                            ...c, 
                            lastMsg: msg.text || (msg.type === 'image' ? 'Image' : 'Fichier'),
                            lastMsgTime: msg.created_at 
                        };
                    }
                    return c;
                }));
            }
        })
        .subscribe();

    signalingChannel.current = supabase.channel(`user-signaling-${selectedChat.id}`);
    signalingChannel.current.subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedChat]);

  useEffect(() => {
    if (!loadingMessages) {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isInCall, loadingMessages]);

  const sendMessage = async (text: string, type: 'text'|'image'|'file' = 'text', fileUrl?: string, fileName?: string) => {
    if ((!text.trim() && !fileUrl) || !selectedChat) return;

    // UI Optimiste
    const tempId = `temp-${Date.now()}`;
    const baseMsg = {
        sender_id: user.id,
        receiver_id: selectedChat.id,
        text,
        created_at: new Date().toISOString()
    };

    // On ajoute à l'UI locale immédiatement avec tous les champs pour feedback immédiat
    setMessages(prev => [...prev, { 
        ...baseMsg, 
        id: tempId, 
        type, 
        file_url: fileUrl, 
        file_name: fileName 
    } as Message]);

    setInputText('');

    // Envoi BDD - Construction sécurisée du payload
    try {
        const payload: any = { ...baseMsg };
        
        // N'ajouter les colonnes "avancées" que si nécessaire
        if (type !== 'text') payload.type = type;
        if (fileUrl) payload.file_url = fileUrl;
        if (fileName) payload.file_name = fileName;

        const { error } = await supabase.from('messages').insert([payload]);
        
        if (error) throw error;

        // Trigger notification for receiver
        await createNotification(
          selectedChat.id,
          `Nouveau message de ${user.username}`,
          text.length > 50 ? text.substring(0, 47) + "..." : text,
          'message',
          '/discussions'
        );
    } catch (e: any) {
        console.error("Erreur envoi message:", e);
        
        // AUTO-REPARATION: Si erreur Foreign Key (Profil manquant), on le recrée
        if (e?.code === '23503' || e?.message?.includes('foreign key')) {
            console.warn("Profil absent détecté (FK Error). Tentative de régénération...");
            try {
                // 1. Recréer le profil avec les infos actuelles de l'utilisateur
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role,
                    country: user.country || 'RDC',
                    city: user.city || 'Kinshasa',
                    address: user.address || '',
                    is_verified_supplier: user.is_verified_supplier,
                    updated_at: new Date().toISOString()
                });

                if (profileError) {
                    console.error("Impossible de recréer le profil:", profileError);
                } else {
                    console.log("Profil régénéré avec succès. Nouvelle tentative d'envoi...");
                    // 2. Réessayer l'envoi du message
                    const payload: any = { ...baseMsg };
                    if (type !== 'text') payload.type = type;
                    if (fileUrl) payload.file_url = fileUrl;
                    if (fileName) payload.file_name = fileName;
                    
                    await supabase.from('messages').insert([payload]);
                }
            } catch (repairErr) {
                console.error("Erreur critique durant l'auto-réparation:", repairErr);
            }
        } else if (e?.code === 'PGRST204' || e?.message?.includes('column') || e?.code === '42703') {
             // Fallback pour ancien schéma
             console.warn("Schema DB obsolète, repli sur mode texte simple");
             await supabase.from('messages').insert([baseMsg]);
        }
    }
  };

  const handleQuickReply = (text: string) => {
    sendMessage(text);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat) return;
    
    setIsUploading(true);
    try {
        const ext = file.name.split('.').pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('chat-uploads').upload(path, file, {
            contentType: file.type,
            upsert: true
        });
        if (error) throw error;
        
        const { data } = supabase.storage.from('chat-uploads').getPublicUrl(path);
        const type = file.type.startsWith('image/') ? 'image' : 'file';
        await sendMessage(file.name, type, data.publicUrl, file.name);
    } catch (e) { console.error(e); }
    setIsUploading(false);
  };

  // --- APPELS WEBRTC (inchangé car fonctionnel) ---
  useEffect(() => {
    const myChannel = supabase.channel(`user-signaling-${user.id}`);
    myChannel
        .on('broadcast', { event: 'call-offer' }, ({ payload }) => { if(!isInCall) setIncomingCall(payload); })
        .on('broadcast', { event: 'call-answer' }, async ({ payload }) => { 
            if(peerConnection.current) await peerConnection.current.setRemoteDescription(new RTCSessionDescription(payload.signal));
        })
        .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
            if(peerConnection.current) await peerConnection.current.addIceCandidate(new RTCIceCandidate(payload.candidate));
        })
        .on('broadcast', { event: 'end-call' }, () => endCall(false))
        .subscribe();
    return () => { supabase.removeChannel(myChannel); };
  }, [user.id, isInCall]);

  const startCall = async (type: 'video' | 'audio') => {
    if (!selectedChat) return;
    setIsInCall(true); setCallType(type);
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: type === 'video', audio: true });
        localStreamRef.current = stream;
        if(localVideoRef.current) localVideoRef.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection(rtcConfig);
        stream.getTracks().forEach(t => peerConnection.current?.addTrack(t, stream));

        peerConnection.current.onicecandidate = e => {
            if(e.candidate) signalingChannel.current?.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate } });
        };
        peerConnection.current.ontrack = e => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };

        const offer = await peerConnection.current.createOffer();
        await peerConnection.current.setLocalDescription(offer);
        signalingChannel.current?.send({ type: 'broadcast', event: 'call-offer', payload: { caller: user.username, type, signal: offer, from: user.id } });
    } catch (e) { endCall(false); }
  };

  const answerCall = async () => {
    if(!incomingCall) return;
    setIsInCall(true); setCallType(incomingCall.type);
    
    let channel = signalingChannel.current;
    if (incomingCall.from && (!selectedChat || selectedChat.id !== incomingCall.from)) {
         channel = supabase.channel(`user-signaling-${incomingCall.from}`);
         await channel.subscribe(); 
    }

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: incomingCall.type === 'video', audio: true });
        localStreamRef.current = stream;
        if(localVideoRef.current) localVideoRef.current.srcObject = stream;

        peerConnection.current = new RTCPeerConnection(rtcConfig);
        stream.getTracks().forEach(t => peerConnection.current?.addTrack(t, stream));

        peerConnection.current.onicecandidate = e => {
            if(e.candidate) channel?.send({ type: 'broadcast', event: 'ice-candidate', payload: { candidate: e.candidate } });
        };
        peerConnection.current.ontrack = e => { if(remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0]; };

        await peerConnection.current.setRemoteDescription(new RTCSessionDescription(incomingCall.signal));
        const answer = await peerConnection.current.createAnswer();
        await peerConnection.current.setLocalDescription(answer);
        channel?.send({ type: 'broadcast', event: 'call-answer', payload: { signal: answer } });
        setIncomingCall(null);
    } catch (e) { endCall(false); }
  };

  const endCall = (notify = true) => {
    if(notify && signalingChannel.current) signalingChannel.current.send({ type: 'broadcast', event: 'end-call', payload: {} });
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    peerConnection.current?.close();
    setIsInCall(false); setIncomingCall(null);
  };

  // --- RENDER ---
  if (isInCall) {
    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-in zoom-in duration-300">
            <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-black/60" />
            <div className="absolute top-10 flex flex-col items-center z-10">
                <div className="w-24 h-24 rounded-full border-4 border-brand-accent overflow-hidden mb-4"><img src={selectedChat?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChat?.name}`} className="w-full h-full object-cover" /></div>
                <h2 className="text-2xl font-orbitron text-white">{selectedChat?.name}</h2>
                <span className="text-brand-accent animate-pulse">APPEL EN COURS...</span>
            </div>
            {callType === 'video' && <video ref={localVideoRef} autoPlay playsInline muted className="absolute top-10 right-4 w-32 h-48 bg-gray-900 rounded-2xl border border-white/20 z-20 object-cover" />}
            <div className="absolute bottom-10 flex gap-6 z-20">
                <button onClick={() => { setIsVideoStopped(!isVideoStopped); localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = !t.enabled); }} className="p-4 rounded-full bg-white/10 text-white">{isVideoStopped ? <VideoOff /> : <Video />}</button>
                <button onClick={() => endCall(true)} className="p-6 rounded-full bg-red-500 text-white shadow-glow hover:scale-110 transition-transform"><PhoneOff size={32} /></button>
                <button onClick={() => { setIsMuted(!isMuted); localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = !t.enabled); }} className="p-4 rounded-full bg-white/10 text-white">{isMuted ? <MicOff /> : <Mic />}</button>
            </div>
        </div>
    );
  }

  if (incomingCall) {
      return (
          <div className="fixed inset-0 z-[100] bg-brand-primary/95 flex flex-col items-center justify-center p-8">
              <div className="w-32 h-32 rounded-full border-4 border-brand-accent animate-pulse mb-6 overflow-hidden"><img src={`https://ui-avatars.com/api/?name=${incomingCall.caller}`} className="w-full h-full object-cover" /></div>
              <h2 className="text-3xl font-orbitron text-white mb-2">{incomingCall.caller}</h2>
              <div className="flex gap-8 mt-8">
                  <button onClick={() => setIncomingCall(null)} className="p-5 bg-red-500 rounded-full text-white"><PhoneOff size={32} /></button>
                  <button onClick={answerCall} className="p-5 bg-green-500 rounded-full text-white animate-bounce"><Phone size={32} /></button>
              </div>
          </div>
      );
  }

  if (selectedChat) {
    return (
      <div className="fixed inset-0 z-[60] bg-brand-primary flex flex-col animate-in slide-in-from-right">
        <header className="glass-nav p-4 flex justify-between items-center border-b border-white/10 safe-top">
          <div className="flex items-center gap-3">
            <button onClick={() => setSelectedChat(null)} className="text-gray-400 p-2"><ChevronLeft size={24} /></button>
            <div className="w-10 h-10 rounded-xl bg-gray-800 overflow-hidden"><img src={selectedChat.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${selectedChat.name}`} className="w-full h-full object-cover" /></div>
            <div>
              <h4 className="font-bold text-white text-xs uppercase">{selectedChat.name}</h4>
              <span className="text-[8px] text-green-400 font-bold uppercase">{selectedChat.online ? 'EN LIGNE' : 'HORS LIGNE'}</span>
            </div>
          </div>
          <div className="flex gap-3 text-gray-400">
            <button onClick={() => startCall('audio')} className="p-2 hover:text-brand-accent"><Phone size={20} /></button>
            <button onClick={() => startCall('video')} className="p-2 hover:text-brand-accent"><Video size={20} /></button>
          </div>
        </header>

        <div className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-hide">
          {loadingMessages && <div className="text-center py-4"><Loader2 className="animate-spin text-brand-accent mx-auto" /></div>}
          
          {messages.map((msg, i) => {
            const isMe = msg.sender_id === user.id;
            return (
              <div key={i} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl ${isMe ? 'bg-brand-accent text-white' : 'bg-brand-card border border-white/10 text-white'}`}>
                  {msg.type === 'image' && msg.file_url && <img src={msg.file_url} className="mb-2 rounded-lg max-h-48 w-full object-cover" />}
                  {msg.type === 'file' && msg.file_url && (
                      <a href={msg.file_url} target="_blank" className="flex items-center gap-2 bg-black/20 p-2 rounded mb-1">
                          <FileText size={16} /> <span className="text-[10px] truncate flex-1">{msg.file_name}</span> <Download size={14} />
                      </a>
                  )}
                  {msg.text && <p className="text-xs font-medium">{msg.text}</p>}
                  <span className="text-[8px] opacity-60 block mt-1">{new Date(msg.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>

        {/* Zone de Saisie + Quick Replies */}
        <div className="p-4 glass-nav border-t border-white/5 safe-bottom flex flex-col gap-2">
          
          {/* Quick Replies Bar */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
            {QUICK_REPLIES.map((reply, idx) => (
                <button 
                    key={idx}
                    onClick={() => handleQuickReply(reply)}
                    className="flex-shrink-0 px-3 py-1.5 bg-brand-card border border-white/5 rounded-full text-[9px] font-bold text-gray-400 hover:text-brand-accent hover:border-brand-accent/30 transition-all uppercase whitespace-nowrap flex items-center gap-1"
                >
                    <Sparkles size={10} /> {reply}
                </button>
            ))}
          </div>

          <form onSubmit={(e) => { e.preventDefault(); sendMessage(inputText); }} className="flex items-end gap-2">
             <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileUpload} />
             <button type="button" onClick={() => fileInputRef.current?.click()} className="p-3 bg-brand-card border border-white/10 rounded-2xl text-gray-400">
                 {isUploading ? <Loader2 className="animate-spin" size={20}/> : <Paperclip size={20} />}
             </button>
            <input 
                type="text" placeholder="Message..."
                className="flex-1 bg-brand-card border border-white/5 rounded-2xl p-4 text-sm text-white outline-none"
                value={inputText} onChange={(e) => setInputText(e.target.value)}
            />
            <button type="submit" disabled={!inputText.trim() && !isUploading} className="p-4 bg-brand-accent rounded-2xl text-white shadow-glow"><Send size={20} /></button>
          </form>
        </div>
      </div>
    );
  }

  // LISTE CONVERSATIONS
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ duration: 0.3 }}
      className="px-4 py-6 pb-20"
    >
      <h2 className="text-3xl font-orbitron font-black text-white mb-8">MESSAGERIE</h2>
      {loadingContacts ? (
         <div className="flex justify-center py-20 text-brand-accent"><Loader2 className="animate-spin" size={32} /></div>
      ) : contacts.length === 0 ? (
         <div className="text-center py-20 bg-brand-card rounded-3xl border border-white/5">
             <MessageSquare size={48} className="mx-auto text-gray-700 mb-4" />
             <p className="text-sm font-bold text-gray-400">Aucune discussion</p>
         </div>
      ) : (
        <div className="space-y-3">
            {contacts.map(c => (
            <button key={c.id} onClick={() => setSelectedChat(c)} className="w-full flex items-center gap-4 p-4 rounded-[2rem] bg-brand-card border border-white/5 hover:border-brand-accent/30 transition-all">
                <div className="relative">
                    <div className="w-14 h-14 rounded-2xl bg-black overflow-hidden"><img src={c.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${c.name}`} className="w-full h-full object-cover" /></div>
                    {c.online && <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-brand-card" />}
                </div>
                <div className="flex-1 text-left">
                    <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-white text-sm uppercase">{c.name}</h4>
                        {c.lastMsgTime && <span className="text-[9px] text-gray-500 font-mono">{new Date(c.lastMsgTime).toLocaleDateString()}</span>}
                    </div>
                    <p className="text-xs text-gray-500 truncate">{c.lastMsg}</p>
                </div>
            </button>
            ))}
        </div>
      )}
    </motion.div>
  );
};
