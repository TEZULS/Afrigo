import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Eye, Users, UserCheck, Search, Calendar, Monitor, Mail } from 'lucide-react';
import { toast } from 'sonner';

export default function AdminVisitors() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [invitingVisitor, setInvitingVisitor] = useState(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  React.useEffect(() => {
    base44.auth.me()
      .then(u => {
        if (u?.role !== 'admin') {
          navigate('/');
        } else {
          setUser(u);
        }
      })
      .catch(() => navigate('/'))
      .finally(() => setAuthLoading(false));
  }, [navigate]);

  const { data: visitors = [], isLoading } = useQuery({
    queryKey: ['visitors'],
    queryFn: () => base44.entities.Visitor.list('-last_visit'),
    enabled: !authLoading && !!user,
  });

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !authLoading && !!user,
  });

  const inviteMutation = useMutation({
    mutationFn: async (email) => {
      return base44.functions.invoke('sendCustomInvitation', { email });
    },
    onSuccess: () => {
      toast.success('Invitation envoyée avec succès');
      setInvitingVisitor(null);
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'envoi de l\'invitation');
    }
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  const registeredVisitors = visitors.filter(v => v.user_email);
  const guestVisitors = visitors.filter(v => !v.user_email);
  const totalVisits = visitors.reduce((sum, v) => sum + (v.visit_count || 1), 0);

  const filteredVisitors = visitors.filter(v => {
    const query = searchQuery.toLowerCase();
    return !query || 
      v.user_email?.toLowerCase().includes(query) ||
      v.visitor_id?.toLowerCase().includes(query) ||
      v.device_info?.toLowerCase().includes(query);
  });

  const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { 
      day: '2-digit', 
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Visiteurs de l'application</h1>
          <p className="text-slate-600">Suivez tous les visiteurs et leur activité</p>
        </div>

        {/* Statistiques */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total visiteurs
              </CardTitle>
              <Eye className="w-4 h-4 text-slate-400" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-slate-900">
                {visitors.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Utilisateurs inscrits
              </CardTitle>
              <UserCheck className="w-4 h-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-emerald-600">
                {registeredVisitors.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Visiteurs invités
              </CardTitle>
              <Users className="w-4 h-4 text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">
                {guestVisitors.length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                Total visites
              </CardTitle>
              <Calendar className="w-4 h-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">
                {totalVisits}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Barre de recherche */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher par email, ID ou appareil..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Liste des visiteurs */}
        <Card>
          <CardHeader>
            <CardTitle>Liste des visiteurs ({filteredVisitors.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Visiteur
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Type
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Appareil
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Visites
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Première visite
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Dernière visite
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredVisitors.map((visitor) => (
                    <tr key={visitor.id} className="border-b hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="font-medium text-slate-900">
                          {visitor.user_email || visitor.visitor_id}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        {visitor.user_email ? (
                          <Badge className="bg-emerald-100 text-emerald-700">
                            Inscrit
                          </Badge>
                        ) : (
                          <Badge className="bg-slate-100 text-slate-700">
                            Invité
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2 text-sm text-slate-600">
                          <Monitor className="w-4 h-4" />
                          {visitor.device_info || 'Inconnu'}
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline">
                          {visitor.visit_count || 1} visite{(visitor.visit_count || 1) > 1 ? 's' : ''}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(visitor.first_visit || visitor.created_date)}
                      </td>
                      <td className="py-3 px-4 text-sm text-slate-600">
                        {formatDate(visitor.last_visit || visitor.updated_date)}
                      </td>
                      <td className="py-3 px-4">
                        {!visitor.user_email && (
                          <div className="flex items-center gap-2">
                            <Input
                              type="email"
                              placeholder="Email du visiteur"
                              value={invitingVisitor === visitor.id ? visitor.tempEmail || '' : ''}
                              onChange={(e) => {
                                setInvitingVisitor(visitor.id);
                                visitor.tempEmail = e.target.value;
                              }}
                              className="h-9 w-48"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                if (visitor.tempEmail) {
                                  inviteMutation.mutate(visitor.tempEmail);
                                } else {
                                  toast.error('Veuillez entrer un email');
                                }
                              }}
                              disabled={inviteMutation.isPending}
                              className="bg-emerald-500 hover:bg-emerald-600"
                            >
                              <Mail className="w-4 h-4 mr-1" />
                              Inviter
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredVisitors.length === 0 && (
                <div className="text-center py-12 text-slate-500">
                  Aucun visiteur trouvé
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}