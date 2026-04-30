import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, Users, Search, Award, Tag } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function AdminReferrals() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')));
  }, [navigate]);

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list('-created_date'),
    enabled: !!user
  });

  const { data: promoCodes = [] } = useQuery({
    queryKey: ['promo-codes'],
    queryFn: () => base44.entities.PromoCode.list(),
    enabled: !!user
  });

  const { data: referralSettings = [] } = useQuery({
    queryKey: ['referral-settings'],
    queryFn: () => base44.entities.ReferralSettings.list(),
    enabled: !!user
  });

  const settings = referralSettings.length > 0 ? referralSettings[0] : {
    max_referrals_per_user: 2
  };

  // Créer une map des parrainages
  const referralStats = users.reduce((acc, u) => {
    if (u.referral_code) {
      const referralsCount = users.filter(referred => referred.referred_by === u.email).length;
      const promoCode = promoCodes.find(p => p.owner_email === u.email);
      acc.push({
        user: u,
        referralsCount,
        promoUsageCount: promoCode?.usage_count || 0,
        referredUsers: users.filter(referred => referred.referred_by === u.email)
      });
    }
    return acc;
  }, []);

  const filteredStats = referralStats.filter(stat => {
    const searchLower = searchQuery.toLowerCase();
    return (
      stat.user.full_name?.toLowerCase().includes(searchLower) ||
      stat.user.first_name?.toLowerCase().includes(searchLower) ||
      stat.user.last_name?.toLowerCase().includes(searchLower) ||
      stat.user.email?.toLowerCase().includes(searchLower) ||
      stat.user.customer_id?.toLowerCase().includes(searchLower) ||
      stat.user.referral_code?.toLowerCase().includes(searchLower)
    );
  });

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Suivi des parrainages</h1>
              <p className="text-slate-500">{referralStats.length} parrains actifs</p>
            </div>
          </div>
          <Link to={createPageUrl('AdminReferralSettings')}>
            <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200 cursor-pointer px-4 py-2">
              Paramètres
            </Badge>
          </Link>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Rechercher par nom, prénom ou code parrain..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm rounded-2xl overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead>Parrain</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Utilisations</TableHead>
                  <TableHead>Parrainages réussis</TableHead>
                  <TableHead>Filleuls</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStats.map(stat => (
                  <TableRow key={stat.user.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {stat.user.first_name && stat.user.last_name
                            ? `${stat.user.first_name} ${stat.user.last_name}`
                            : stat.user.full_name}
                        </p>
                        <p className="text-xs text-slate-500">{stat.user.customer_id}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">
                        {stat.user.referral_code}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-amber-500" />
                        <span>{stat.promoUsageCount}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={stat.referralsCount > 0 ? 'bg-emerald-600 text-white font-bold' : 'bg-slate-100 text-slate-600'}>
                        {stat.referralsCount}/{settings.max_referrals_per_user}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {stat.referredUsers.length > 0 ? (
                        <div className="space-y-1">
                          {stat.referredUsers.map(referred => (
                            <div key={referred.id} className="text-sm">
                              <span className="text-slate-600">
                                {referred.first_name && referred.last_name
                                  ? `${referred.first_name} ${referred.last_name}`
                                  : referred.full_name}
                              </span>
                              <span className="text-xs text-slate-400 ml-2">
                                {format(new Date(referred.created_date), 'dd/MM/yyyy', { locale: fr })}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">Aucun filleul</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}