import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Settings, ArrowLeft, Power, Globe, Phone, RotateCcw, Bell, Mail } from 'lucide-react';
import { Checkbox } from "@/components/ui/checkbox";
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';

export default function AdminSettings() {
  const [user, setUser] = useState(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [message, setMessage] = useState('');
  const [geoRestrictionEnabled, setGeoRestrictionEnabled] = useState(false);
  const [allowedRegions, setAllowedRegions] = useState([]);
  const [geoMessage, setGeoMessage] = useState('');
  const [supportPhone, setSupportPhone] = useState('+33123456789');
  const [supportEmail, setSupportEmail] = useState('contact@afrigo.app');
  const [returnTimeLimit, setReturnTimeLimit] = useState(2);
  const [autoNotifyOrders, setAutoNotifyOrders] = useState(true);
  const [autoNotifyReturns, setAutoNotifyReturns] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: settings = [], isLoading } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list(),
    enabled: !!user
  });

  const currentSettings = settings[0];

  useEffect(() => {
    if (currentSettings) {
      setIsAvailable(currentSettings.is_available);
      setMessage(currentSettings.maintenance_message || '');
      setGeoRestrictionEnabled(currentSettings.geo_restriction_enabled || false);
      setAllowedRegions(currentSettings.allowed_regions || []);
      setGeoMessage(currentSettings.geo_restriction_message || '');
      setSupportPhone(currentSettings.support_phone || '+33123456789');
      setSupportEmail(currentSettings.support_email || 'contact@afrigo.app');
      setReturnTimeLimit(currentSettings.return_time_limit_hours || 2);
      setAutoNotifyOrders(currentSettings.auto_notify_order_status !== false);
      setAutoNotifyReturns(currentSettings.auto_notify_return_status !== false);
    }
  }, [currentSettings]);

  const updateSettingsMutation = useMutation({
    mutationFn: async (data) => {
      if (currentSettings) {
        return base44.entities.AppSettings.update(currentSettings.id, data);
      } else {
        return base44.entities.AppSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appSettings'] });
      toast.success('Paramètres mis à jour');
      navigate(-1);
    }
  });

  const handleSave = () => {
    updateSettingsMutation.mutate({
      is_available: isAvailable,
      maintenance_message: message,
      geo_restriction_enabled: geoRestrictionEnabled,
      allowed_regions: allowedRegions,
      geo_restriction_message: geoMessage,
      support_phone: supportPhone,
      support_email: supportEmail,
      return_time_limit_hours: returnTimeLimit,
      auto_notify_order_status: autoNotifyOrders,
      auto_notify_return_status: autoNotifyReturns
    });
  };

  const toggleRegion = (region) => {
    if (allowedRegions.includes(region)) {
      setAllowedRegions(allowedRegions.filter(r => r !== region));
    } else {
      setAllowedRegions([...allowedRegions, region]);
    }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center gap-3 mb-8">
          <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center">
            <Settings className="w-6 h-6 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Paramètres de l'application</h1>
            <p className="text-slate-500">Gérer la disponibilité de l'application</p>
          </div>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Power className="w-5 h-5 text-indigo-600" />
              Disponibilité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <Label className="text-base font-semibold text-slate-800">
                  Application disponible
                </Label>
                <p className="text-sm text-slate-500 mt-1">
                  Activer ou désactiver l'accès client à l'application
                </p>
              </div>
              <Switch
                checked={isAvailable}
                onCheckedChange={setIsAvailable}
                className="ml-4"
              />
            </div>

            {!isAvailable && (
              <div>
                <Label>Message de maintenance</Label>
                <Textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="L'application est temporairement indisponible pour maintenance..."
                  className="mt-2 min-h-[120px]"
                />
              </div>
            )}

            <div className={`p-4 rounded-xl border-2 ${
              isAvailable 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-3 h-3 rounded-full ${
                  isAvailable ? 'bg-emerald-500' : 'bg-orange-500'
                }`}></div>
                <p className="font-semibold text-slate-800">
                  Statut actuel: {isAvailable ? 'En ligne' : 'Maintenance'}
                </p>
              </div>
              <p className="text-sm text-slate-600">
                {isAvailable 
                  ? 'Les clients peuvent accéder normalement à l\'application'
                  : 'Les clients verront la page de maintenance'
                }
              </p>
            </div>

          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Phone className="w-5 h-5 text-indigo-600" />
              Service Client
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="support-phone" className="text-base font-semibold text-slate-800">
                Numéro de téléphone du service client
              </Label>
              <p className="text-sm text-slate-500 mb-2">
                Ce numéro sera affiché dans la page "Nous contacter"
              </p>
              <Input
                id="support-phone"
                type="tel"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                placeholder="+33123456789"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="support-email" className="text-base font-semibold text-slate-800">
                Email du service client
              </Label>
              <p className="text-sm text-slate-500 mb-2">
                Cet email sera affiché dans la page "Nous contacter"
              </p>
              <Input
                id="support-email"
                type="email"
                value={supportEmail}
                onChange={(e) => setSupportEmail(e.target.value)}
                placeholder="contact@afrigo.app"
                className="mt-2"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <RotateCcw className="w-5 h-5 text-indigo-600" />
              Politique de retour
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="return-limit" className="text-base font-semibold text-slate-800">
                Délai de retour après livraison (heures)
              </Label>
              <p className="text-sm text-slate-500 mb-2">
                Les clients auront ce délai pour effectuer un retour après réception
              </p>
              <Input
                id="return-limit"
                type="number"
                min="0"
                step="0.5"
                value={returnTimeLimit}
                onChange={(e) => setReturnTimeLimit(parseFloat(e.target.value) || 2)}
                placeholder="2"
                className="mt-2"
              />
              <p className="text-xs text-slate-400 mt-2">
                Délai actuel: {returnTimeLimit} heure{returnTimeLimit > 1 ? 's' : ''}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-indigo-600" />
              Notifications automatiques
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <Label className="text-base font-semibold text-slate-800">
                  Notifications de commande
                </Label>
                <p className="text-sm text-slate-500 mt-1">
                  Envoyer automatiquement SMS et email aux clients à chaque changement de statut de commande
                </p>
              </div>
              <Switch
                checked={autoNotifyOrders}
                onCheckedChange={setAutoNotifyOrders}
                className="ml-4"
              />
            </div>

            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <Label className="text-base font-semibold text-slate-800">
                  Notifications de retour
                </Label>
                <p className="text-sm text-slate-500 mt-1">
                  Envoyer automatiquement SMS et email aux clients à chaque changement de statut de retour
                </p>
              </div>
              <Switch
                checked={autoNotifyReturns}
                onCheckedChange={setAutoNotifyReturns}
                className="ml-4"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-indigo-600" />
              Restriction géographique
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
              <div className="flex-1">
                <Label className="text-base font-semibold text-slate-800">
                  Restriction géographique
                </Label>
                <p className="text-sm text-slate-500 mt-1">
                  Limiter l'accès selon la localisation géographique
                </p>
              </div>
              <Switch
                checked={geoRestrictionEnabled}
                onCheckedChange={setGeoRestrictionEnabled}
                className="ml-4"
              />
            </div>

            {geoRestrictionEnabled && (
              <>
                <div>
                  <Label className="text-base font-semibold mb-3 block">Régions et pays autorisés</Label>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {/* Régions */}
                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Checkbox
                        id="europe"
                        checked={allowedRegions.includes('europe')}
                        onCheckedChange={() => toggleRegion('europe')}
                      />
                      <label htmlFor="europe" className="text-sm font-semibold cursor-pointer">
                        🇪🇺 Toute l'Europe
                      </label>
                    </div>

                    <div className="flex items-center space-x-2 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Checkbox
                        id="africa"
                        checked={allowedRegions.includes('africa')}
                        onCheckedChange={() => toggleRegion('africa')}
                      />
                      <label htmlFor="africa" className="text-sm font-semibold cursor-pointer">
                        🌍 Toute l'Afrique
                      </label>
                    </div>

                    {/* Pays individuels */}
                    <p className="text-xs text-slate-500 mt-4 mb-2 font-medium">Pays spécifiques :</p>
                    
                    {[
                      { code: 'FR', name: 'France', flag: '🇫🇷' },
                      { code: 'BE', name: 'Belgique', flag: '🇧🇪' },
                      { code: 'CH', name: 'Suisse', flag: '🇨🇭' },
                      { code: 'DE', name: 'Allemagne', flag: '🇩🇪' },
                      { code: 'ES', name: 'Espagne', flag: '🇪🇸' },
                      { code: 'IT', name: 'Italie', flag: '🇮🇹' },
                      { code: 'GB', name: 'Royaume-Uni', flag: '🇬🇧' },
                      { code: 'MA', name: 'Maroc', flag: '🇲🇦' },
                      { code: 'TN', name: 'Tunisie', flag: '🇹🇳' },
                      { code: 'DZ', name: 'Algérie', flag: '🇩🇿' },
                      { code: 'SN', name: 'Sénégal', flag: '🇸🇳' },
                      { code: 'CI', name: 'Côte d\'Ivoire', flag: '🇨🇮' },
                      { code: 'CM', name: 'Cameroun', flag: '🇨🇲' },
                      { code: 'CG', name: 'Congo', flag: '🇨🇬' },
                      { code: 'CD', name: 'RD Congo', flag: '🇨🇩' },
                      { code: 'GA', name: 'Gabon', flag: '🇬🇦' },
                      { code: 'BJ', name: 'Bénin', flag: '🇧🇯' },
                      { code: 'TG', name: 'Togo', flag: '🇹🇬' },
                      { code: 'BF', name: 'Burkina Faso', flag: '🇧🇫' },
                      { code: 'ML', name: 'Mali', flag: '🇲🇱' },
                      { code: 'NE', name: 'Niger', flag: '🇳🇪' },
                    ].map(country => (
                      <div key={country.code} className="flex items-center space-x-2 p-2 bg-slate-50 rounded-lg hover:bg-slate-100">
                        <Checkbox
                          id={country.code}
                          checked={allowedRegions.includes(country.code)}
                          onCheckedChange={() => toggleRegion(country.code)}
                        />
                        <label htmlFor={country.code} className="text-sm cursor-pointer flex-1">
                          {country.flag} {country.name}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Message de restriction géographique</Label>
                  <Textarea
                    value={geoMessage}
                    onChange={(e) => setGeoMessage(e.target.value)}
                    placeholder="Cette application n'est pas disponible dans votre région..."
                    className="mt-2 min-h-[100px]"
                  />
                </div>
              </>
            )}

            <Button
              onClick={handleSave}
              disabled={updateSettingsMutation.isPending}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-lg"
            >
              {updateSettingsMutation.isPending ? 'Enregistrement...' : 'Enregistrer les modifications'}
            </Button>
          </CardContent>
        </Card>


      </div>
    </div>
  );
}