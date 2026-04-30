import React, { useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

export default function NotificationListener({ user }) {
  const lastCounts = useRef({
    orders: 0,
    returns: 0,
    messages: 0,
    refunds: 0
  });

  const { data: settings = [] } = useQuery({
    queryKey: ['notificationSettings', user?.email],
    queryFn: () => base44.entities.NotificationSettings.filter({ admin_email: user?.email }),
    enabled: !!user?.email && user?.role === 'admin'
  });

  const config = settings[0] || { enabled: true, sound: 'default', volume: 70 };

  // Polling pour les nouvelles commandes
  const { data: orders = [] } = useQuery({
    queryKey: ['orders-notification'],
    queryFn: () => base44.entities.Order.list('-created_date', 50),
    enabled: !!user && user.role === 'admin' && config.enabled && config.new_order,
    refetchInterval: 10000 // 10 secondes
  });

  // Polling pour les retours
  const { data: returns = [] } = useQuery({
    queryKey: ['returns-notification'],
    queryFn: () => base44.entities.Return.filter({ status: 'pending' }),
    enabled: !!user && user.role === 'admin' && config.enabled && config.new_return,
    refetchInterval: 15000
  });

  // Polling pour les messages non lus
  const { data: messages = [] } = useQuery({
    queryKey: ['messages-notification'],
    queryFn: () => base44.entities.Message.filter({ is_read: false, sender_type: 'customer' }),
    enabled: !!user && user.role === 'admin' && config.enabled && config.new_message,
    refetchInterval: 12000
  });

  // Polling pour les remboursements
  const { data: refunds = [] } = useQuery({
    queryKey: ['refunds-notification'],
    queryFn: () => base44.entities.Refund.filter({ status: 'pending' }),
    enabled: !!user && user.role === 'admin' && config.enabled && config.new_refund,
    refetchInterval: 20000
  });

  const playSound = (soundType) => {
    // Si mode sonnerie unique activé, utiliser global_sound
    const actualSound = config.use_single_sound ? config.global_sound : soundType;
    if (!config.enabled || !actualSound || actualSound === 'none') return;
    
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const volume = (config.volume || 70) / 100;
      
      const playNote = (freq, startTime, duration, type = 'sine') => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        osc.connect(gain);
        gain.connect(audioContext.destination);
        
        osc.type = type;
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(volume * 0.3, startTime);
        gain.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        osc.start(startTime);
        osc.stop(startTime + duration);
      };
      
      const now = audioContext.currentTime;
      
      // Vraies mélodies pour chaque sonnerie
      const melodies = {
        default: [
          { freq: 659, time: 0, duration: 0.15 },
          { freq: 784, time: 0.15, duration: 0.15 },
          { freq: 880, time: 0.3, duration: 0.2 }
        ],
        chime: [
          { freq: 1046, time: 0, duration: 0.2 },
          { freq: 1318, time: 0.1, duration: 0.2 },
          { freq: 1568, time: 0.2, duration: 0.3 }
        ],
        bell: [
          { freq: 523, time: 0, duration: 0.3 },
          { freq: 659, time: 0.15, duration: 0.25 },
          { freq: 784, time: 0.3, duration: 0.4 }
        ],
        alert: [
          { freq: 880, time: 0, duration: 0.1 },
          { freq: 698, time: 0.12, duration: 0.1 },
          { freq: 880, time: 0.24, duration: 0.1 },
          { freq: 698, time: 0.36, duration: 0.1 }
        ],
        beep: [
          { freq: 440, time: 0, duration: 0.1 },
          { freq: 440, time: 0.15, duration: 0.1 }
        ],
        ding: [
          { freq: 1568, time: 0, duration: 0.08 },
          { freq: 2093, time: 0.08, duration: 0.12 }
        ],
        'double-beep': [
          { freq: 932, time: 0, duration: 0.1 },
          { freq: 932, time: 0.15, duration: 0.1 }
        ],
        'triple-beep': [
          { freq: 880, time: 0, duration: 0.08 },
          { freq: 880, time: 0.12, duration: 0.08 },
          { freq: 880, time: 0.24, duration: 0.08 }
        ],
        urgent: [
          { freq: 1046, time: 0, duration: 0.1 },
          { freq: 880, time: 0.1, duration: 0.1 },
          { freq: 1046, time: 0.2, duration: 0.1 },
          { freq: 880, time: 0.3, duration: 0.1 },
          { freq: 1046, time: 0.4, duration: 0.15 }
        ],
        soft: [
          { freq: 523, time: 0, duration: 0.25 },
          { freq: 659, time: 0.25, duration: 0.25 },
          { freq: 523, time: 0.5, duration: 0.3 }
        ],
        ascending: [
          { freq: 523, time: 0, duration: 0.15 },
          { freq: 659, time: 0.15, duration: 0.15 },
          { freq: 784, time: 0.3, duration: 0.15 },
          { freq: 1046, time: 0.45, duration: 0.2 }
        ],
        descending: [
          { freq: 1046, time: 0, duration: 0.15 },
          { freq: 784, time: 0.15, duration: 0.15 },
          { freq: 659, time: 0.3, duration: 0.15 },
          { freq: 523, time: 0.45, duration: 0.2 }
        ],
        success: [
          { freq: 523, time: 0, duration: 0.1 },
          { freq: 659, time: 0.1, duration: 0.1 },
          { freq: 784, time: 0.2, duration: 0.1 },
          { freq: 1046, time: 0.3, duration: 0.25 }
        ],
        warning: [
          { freq: 698, time: 0, duration: 0.15 },
          { freq: 622, time: 0.15, duration: 0.15 },
          { freq: 698, time: 0.3, duration: 0.2 }
        ]
      };
      
      const melody = melodies[actualSound] || melodies.default;
      melody.forEach(note => {
        playNote(note.freq, now + note.time, note.duration);
      });
      
    } catch (err) {
      console.error('Erreur lecture audio:', err);
    }
  };

  // Détection nouvelle commande
  useEffect(() => {
    if (!config.enabled || !config.new_order) return;
    
    const pendingOrders = orders.filter(o => o.status === 'pending');
    const cancelledOrders = orders.filter(o => o.status === 'cancelled');
    
    if (lastCounts.current.orders > 0) {
      if (pendingOrders.length > lastCounts.current.orders) {
        playSound(config.new_order_sound);
        toast.success('🛍️ Nouvelle commande reçue !', {
          duration: 5000,
          action: {
            label: 'Voir',
            onClick: () => window.location.href = '/admin/orders'
          }
        });
      }
      
      if (config.order_cancelled && cancelledOrders.length > lastCounts.current.cancelled) {
        playSound(config.order_cancelled_sound);
        toast.error('❌ Commande annulée', {
          duration: 5000,
          action: {
            label: 'Voir',
            onClick: () => window.location.href = '/admin/orders'
          }
        });
      }
    }
    
    lastCounts.current.orders = pendingOrders.length;
    lastCounts.current.cancelled = cancelledOrders.length;
  }, [orders, config]);

  // Détection nouveau retour
  useEffect(() => {
    if (!config.enabled || !config.new_return) return;
    
    if (lastCounts.current.returns > 0 && returns.length > lastCounts.current.returns) {
      playSound(config.new_return_sound);
      toast.warning('📦 Nouvelle demande de retour', {
        duration: 5000,
        action: {
          label: 'Voir',
          onClick: () => window.location.href = '/admin/returns'
        }
      });
    }
    
    lastCounts.current.returns = returns.length;
  }, [returns, config]);

  // Détection nouveau message
  useEffect(() => {
    if (!config.enabled || !config.new_message) return;
    
    if (lastCounts.current.messages > 0 && messages.length > lastCounts.current.messages) {
      playSound(config.new_message_sound);
      toast.info('💬 Nouveau message client', {
        duration: 5000,
        action: {
          label: 'Voir',
          onClick: () => window.location.href = '/admin/messages'
        }
      });
    }
    
    lastCounts.current.messages = messages.length;
  }, [messages, config]);

  // Détection nouveau remboursement
  useEffect(() => {
    if (!config.enabled || !config.new_refund) return;
    
    if (lastCounts.current.refunds > 0 && refunds.length > lastCounts.current.refunds) {
      playSound(config.new_refund_sound);
      toast.warning('💰 Nouvelle demande de remboursement', {
        duration: 5000,
        action: {
          label: 'Voir',
          onClick: () => window.location.href = '/admin/wallet'
        }
      });
    }
    
    lastCounts.current.refunds = refunds.length;
  }, [refunds, config]);

  return null;
}