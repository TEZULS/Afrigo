import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { Construction, Clock, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

const europeanCountries = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB', 'CH', 'NO', 'IS'
];

const africanCountries = [
  'DZ', 'AO', 'BJ', 'BW', 'BF', 'BI', 'CM', 'CV', 'CF', 'TD', 
  'KM', 'CG', 'CD', 'CI', 'DJ', 'EG', 'GQ', 'ER', 'ET', 'GA', 
  'GM', 'GH', 'GN', 'GW', 'KE', 'LS', 'LR', 'LY', 'MG', 'MW', 
  'ML', 'MR', 'MU', 'MA', 'MZ', 'NA', 'NE', 'NG', 'RW', 'ST', 
  'SN', 'SC', 'SL', 'SO', 'ZA', 'SS', 'SD', 'SZ', 'TZ', 'TG', 
  'TN', 'UG', 'ZM', 'ZW'
];

export default function MaintenanceMode({ children, user }) {
  const [userCountry, setUserCountry] = useState(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(true);

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list()
  });

  const currentSettings = settings[0];
  const isAvailable = currentSettings?.is_available !== false;
  const geoRestrictionEnabled = currentSettings?.geo_restriction_enabled || false;
  const allowedRegions = currentSettings?.allowed_regions || [];

  // Get user's country via IP geolocation
  useEffect(() => {
    if (geoRestrictionEnabled && user?.role !== 'admin') {
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          setUserCountry(data.country_code);
          setIsCheckingLocation(false);
        })
        .catch(() => {
          setUserCountry('UNKNOWN');
          setIsCheckingLocation(false);
        });
    } else {
      setIsCheckingLocation(false);
    }
  }, [geoRestrictionEnabled, user]);

  // Check if user is in allowed region
  const isRegionAllowed = () => {
    if (!geoRestrictionEnabled || !userCountry) return true;
    
    // Check for specific regions
    if (allowedRegions.includes('europe') && europeanCountries.includes(userCountry)) return true;
    if (allowedRegions.includes('africa') && africanCountries.includes(userCountry)) return true;
    
    // Check for specific countries (stored as country codes)
    if (allowedRegions.includes(userCountry)) return true;
    
    return allowedRegions.length === 0;
  };

  // Admin users can always access
  if (user?.role === 'admin') {
    return <>{children}</>;
  }

  // Wait for geolocation check
  if (isCheckingLocation) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Check geo restriction
  if (geoRestrictionEnabled && !isRegionAllowed()) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <MapPin className="w-8 h-8 sm:w-10 sm:h-10 text-orange-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-3">
              Service non disponible
            </h1>
            
            <p className="text-slate-600 mb-6">
              {currentSettings?.geo_restriction_message || 
                "Cette application n'est pas disponible dans votre région pour le moment."}
            </p>

            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              <MapPin className="w-4 h-4" />
              <span>Détecté: {userCountry}</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // Check maintenance mode
  if (!isAvailable) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="max-w-md w-full"
        >
          <div className="bg-white rounded-3xl shadow-2xl p-6 sm:p-8 text-center">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <Construction className="w-8 h-8 sm:w-10 sm:h-10 text-orange-600" />
            </div>
            
            <h1 className="text-2xl font-bold text-slate-800 mb-3">
              Maintenance en cours
            </h1>
            
            <p className="text-slate-600 mb-6">
              {currentSettings?.maintenance_message || 
                "L'application est temporairement indisponible pour maintenance. Nous serons de retour très bientôt."}
            </p>

            <div className="flex items-center justify-center gap-2 text-slate-500 text-sm">
              <Clock className="w-4 h-4" />
              <span>Merci de votre patience</span>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // All checks passed, show the app
  return <>{children}</>;
}