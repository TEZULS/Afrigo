import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Headphones, Phone, Mail, ArrowLeft, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function Messages() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list()
  });

  const supportPhone = settings[0]?.support_phone || '+33123456789';
  const supportEmail = settings[0]?.support_email || 'contact@afrigo.app';

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Link>

        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Headphones className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800">Nous contacter</h1>
          <p className="text-slate-500 mt-2">Notre équipe est disponible pour vous aider</p>
        </div>

        <div className="space-y-4">
          {/* Téléphone */}
          <a href={`tel:${supportPhone}`} className="block">
            <Card className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-green-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Phone className="w-7 h-7 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Appelez-nous</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{supportPhone}</p>
                  <p className="text-xs text-slate-400 mt-1">Appuyez pour appeler directement</p>
                </div>
              </CardContent>
            </Card>
          </a>

          {/* Email */}
          <a href={`mailto:${supportEmail}`} className="block">
            <Card className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-blue-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Mail className="w-7 h-7 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Envoyez-nous un email</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">{supportEmail}</p>
                  <p className="text-xs text-slate-400 mt-1">Appuyez pour envoyer un email</p>
                </div>
              </CardContent>
            </Card>
          </a>

          {/* Message interne */}
          <Link to={createPageUrl('CustomerMessages')} className="block">
            <Card className="border-0 shadow-sm rounded-2xl hover:shadow-md transition-shadow cursor-pointer">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center shrink-0">
                  <MessageCircle className="w-7 h-7 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-slate-500 font-medium">Message via l'application</p>
                  <p className="text-xl font-bold text-slate-800 mt-0.5">Chat AfriGo</p>
                  <p className="text-xs text-slate-400 mt-1">Échangez directement avec notre équipe</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}