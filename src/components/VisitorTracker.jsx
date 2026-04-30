import React, { useEffect } from 'react';
import { base44 } from '@/api/base44Client';

export default function VisitorTracker({ user }) {
  useEffect(() => {
    const trackVisit = async () => {
      try {
        // Générer un ID unique pour le visiteur (basé sur le localStorage)
        let visitorId = localStorage.getItem('visitor_id');
        if (!visitorId) {
          visitorId = `visitor-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          localStorage.setItem('visitor_id', visitorId);
        }

        // Informations sur l'appareil
        const ua = navigator.userAgent;
        
        // Détection du système d'exploitation
        let os = 'Inconnu';
        if (ua.includes('Windows')) os = 'Windows';
        else if (ua.includes('Mac')) os = 'macOS';
        else if (ua.includes('Linux')) os = 'Linux';
        else if (ua.includes('Android')) os = 'Android';
        else if (ua.includes('iOS') || ua.includes('iPhone') || ua.includes('iPad')) os = 'iOS';
        
        // Détection du navigateur
        let browser = 'Inconnu';
        if (ua.includes('Chrome') && !ua.includes('Edg')) browser = 'Chrome';
        else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
        else if (ua.includes('Firefox')) browser = 'Firefox';
        else if (ua.includes('Edg')) browser = 'Edge';
        
        // Détection du type d'appareil
        const deviceType = ua.includes('Mobile') || ua.includes('Android') || ua.includes('iPhone') ? '📱 Mobile' : '💻 Desktop';
        
        // Détection de la marque (pour mobile)
        let brand = '';
        if (ua.includes('Samsung')) brand = 'Samsung';
        else if (ua.includes('iPhone')) brand = 'iPhone';
        else if (ua.includes('iPad')) brand = 'iPad';
        else if (ua.includes('Huawei')) brand = 'Huawei';
        else if (ua.includes('Xiaomi')) brand = 'Xiaomi';
        else if (ua.includes('OnePlus')) brand = 'OnePlus';
        else if (ua.includes('Pixel')) brand = 'Google Pixel';
        
        const deviceInfo = `${deviceType} ${brand ? `${brand} - ` : ''}${os} - ${browser}`;

        // Vérifier si le visiteur existe déjà
        const visitors = await base44.entities.Visitor.filter({ visitor_id: visitorId });
        const now = new Date().toISOString();

        if (visitors.length > 0) {
          // Mettre à jour le visiteur existant
          const visitor = visitors[0];
          await base44.entities.Visitor.update(visitor.id, {
            visit_count: (visitor.visit_count || 1) + 1,
            last_visit: now,
            user_email: user?.email || visitor.user_email,
            device_info: deviceInfo
          });
        } else {
          // Créer un nouveau visiteur
          await base44.entities.Visitor.create({
            visitor_id: visitorId,
            user_email: user?.email || null,
            device_info: deviceInfo,
            visit_count: 1,
            first_visit: now,
            last_visit: now,
            pages_visited: []
          });
        }
      } catch (error) {
        console.error('Erreur lors du tracking du visiteur:', error);
      }
    };

    trackVisit();
  }, [user]);

  return null; // Composant invisible
}