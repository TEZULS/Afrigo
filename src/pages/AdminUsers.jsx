import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate, Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, Search, Edit, Trash2, ArrowLeft, Mail, Phone, MapPin, Calendar, Wallet, Plus, Award, Trophy, UserX, UserCheck, UserPlus, Eye, EyeOff, Key, Copy, Check, Link as LinkIcon, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { toast } from 'sonner';

export default function AdminUsers() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);
  const [invitingUser, setInvitingUser] = useState(false);
  const [deactivatingUser, setDeactivatingUser] = useState(null);
  const [formData, setFormData] = useState({});
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('user');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteData, setInviteData] = useState({
    civility: '',
    first_name: '',
    last_name: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    wallet_balance: 0,
    customer_tier: 'normal'
  });
  const [showPasswords, setShowPasswords] = useState({});
  const [linkCopied, setLinkCopied] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // URL du domaine pour inscription
  const appUrl = 'https://www.afrigo.app';

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
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list('-created_date'),
    enabled: !!user
  });

  const { data: allOrders = [] } = useQuery({
    queryKey: ['all-orders'],
    queryFn: () => base44.entities.Order.list(),
    enabled: !!user
  });

  const inviteUserMutation = useMutation({
    mutationFn: async ({ email, role, password, userData }) => {
      // Création directe sans email d'invitation
      await base44.users.inviteUser(email, role);
      
      // Attendre que l'utilisateur soit créé
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const users = await base44.entities.User.list();
      const newUser = users.find(u => u.email === email);
      if (newUser) {
        const updateData = { user_password: password, ...userData };
        await base44.entities.User.update(newUser.id, updateData);
      }
    },
    onSuccess: () => {
      toast.success('Utilisateur créé avec succès ! Le client peut maintenant se connecter.');
      setInvitingUser(false);
      setInviteEmail('');
      setInviteRole('user');
      setInvitePassword('');
      setInviteData({
        civility: '',
        first_name: '',
        last_name: '',
        phone: '',
        address: '',
        postal_code: '',
        city: '',
        wallet_balance: 0,
        customer_tier: 'normal'
      });
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ['all-users'] });
      }, 2500);
    },
    onError: (error) => {
      toast.error('Erreur lors de la création: ' + error.message);
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.User.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setEditingUser(null);
      setFormData({});
    }
  });

  const deactivateUserMutation = useMutation({
    mutationFn: ({ id, reason }) => base44.entities.User.update(id, { 
      is_active: false, 
      deactivation_reason: reason 
    }),
    onSuccess: () => {
      toast.success('Utilisateur désactivé avec succès');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setDeactivatingUser(null);
    }
  });

  const activateUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.update(id, { 
      is_active: true, 
      deactivation_reason: null 
    }),
    onSuccess: () => {
      toast.success('Utilisateur réactivé avec succès');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => base44.entities.User.delete(id),
    onSuccess: () => {
      toast.success('Utilisateur supprimé avec succès');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
      setDeletingUser(null);
    },
    onError: (error) => {
      toast.error('Erreur lors de la suppression: ' + error.message);
    }
  });

  const handleInvite = () => {
    if (!inviteEmail) {
      toast.error('Veuillez saisir un email');
      return;
    }
    if (!invitePassword) {
      toast.error('Veuillez définir un mot de passe');
      return;
    }
    inviteUserMutation.mutate({ 
      email: inviteEmail, 
      role: inviteRole, 
      password: invitePassword,
      userData: inviteData
    });
  };

  const handleEdit = (user) => {
    setEditingUser(user);
    setFormData({
      civility: user.civility || '',
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      phone: user.phone || '',
      address: user.address || '',
      postal_code: user.postal_code || '',
      city: user.city || '',
      wallet_balance: user.wallet_balance || 0,
      customer_tier: user.customer_tier || 'normal',
      user_password: user.user_password || ''
    });
  };

  const handleSave = () => {
    updateUserMutation.mutate({
      id: editingUser.id,
      data: formData
    });
  };

  const handleDeactivate = (reason) => {
    if (deactivatingUser) {
      deactivateUserMutation.mutate({ 
        id: deactivatingUser.id, 
        reason 
      });
    }
  };

  const handleDelete = () => {
    if (deletingUser) {
      deleteUserMutation.mutate(deletingUser.id);
    }
  };

  const handleCopyLink = () => {
    const message = `🛒 Bienvenue sur AfriGo !\n\n✨ Inscrivez-vous maintenant et profitez de :\n• Livraison rapide\n• Produits frais de qualité\n• Programme de fidélité\n• Offres exclusives\n\n👉 Cliquez ici pour créer votre compte :\n${appUrl}\n\n📱 Téléchargez aussi notre application pour encore plus de facilité !`;
    
    navigator.clipboard.writeText(message).then(() => {
      setLinkCopied(true);
      toast.success('Message copié ! Partagez-le sur WhatsApp 📱');
      setTimeout(() => setLinkCopied(false), 3000);
    });
  };

  const filteredUsers = users.filter(u => {
    const query = searchQuery.toLowerCase();
    return (
      u.email?.toLowerCase().includes(query) ||
      u.first_name?.toLowerCase().includes(query) ||
      u.last_name?.toLowerCase().includes(query) ||
      u.customer_id?.toLowerCase().includes(query) ||
      u.phone?.toLowerCase().includes(query)
    );
  });

  const getUserStats = (userEmail) => {
    const userOrders = allOrders.filter(o => o.customer_email === userEmail);
    const totalSpent = userOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0);
    return {
      ordersCount: userOrders.length,
      totalSpent
    };
  };

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
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Gestion des Utilisateurs</h1>
              <div className="flex items-center gap-2">
                <Badge className="bg-emerald-500 text-white text-base px-3 py-1">
                  {users.length} utilisateur{users.length > 1 ? 's' : ''} inscrit{users.length > 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => navigate(createPageUrl('AdminTiers'))}
              variant="outline"
              className="rounded-xl"
            >
              <Trophy className="w-4 h-4 mr-2" />
              Niveaux clients
            </Button>
            <Button
              onClick={() => setInvitingUser(true)}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Inviter un utilisateur
            </Button>
          </div>
        </div>

        {/* Lien d'inscription à partager */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6 bg-gradient-to-r from-orange-50 to-green-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <LinkIcon className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-slate-800 mb-2">📱 Lien d'inscription à partager</h3>
                <p className="text-sm text-slate-600 mb-3">
                  Partagez ce message sur WhatsApp ou par email pour inviter vos clients à s'inscrire
                </p>
                <div className="bg-white rounded-xl p-4 mb-3 border border-slate-200">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-sans">
{`🛒 Bienvenue sur AfriGo !

✨ Inscrivez-vous maintenant et profitez de :
• Livraison rapide
• Produits frais de qualité
• Programme de fidélité
• Offres exclusives

👉 Cliquez ici pour créer votre compte :
${appUrl}

📱 Téléchargez aussi notre application pour encore plus de facilité !`}
                  </pre>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button
                    onClick={handleCopyLink}
                    className="bg-emerald-600 hover:bg-emerald-700"
                  >
                    {linkCopied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copié !
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copier le message
                      </>
                    )}
                  </Button>
                  <Button
                    onClick={() => window.open(`https://wa.me/?text=${encodeURIComponent(`🛒 Bienvenue sur AfriGo !\n\n✨ Inscrivez-vous maintenant et profitez de :\n• Livraison rapide\n• Produits frais de qualité\n• Programme de fidélité\n• Offres exclusives\n\n👉 Cliquez ici pour créer votre compte :\n${appUrl}\n\n📱 Téléchargez aussi notre application pour encore plus de facilité !`)}`, '_blank')}
                    variant="outline"
                    className="border-green-600 text-green-600 hover:bg-green-50"
                  >
                    <Phone className="w-4 h-4 mr-2" />
                    WhatsApp
                  </Button>
                  <Button
                    onClick={() => {
                      const emailBody = `🛒 Bienvenue sur AfriGo !

✨ Inscrivez-vous maintenant et profitez de :
• Livraison rapide
• Produits frais de qualité
• Programme de fidélité
• Offres exclusives

👉 Cliquez ici pour créer votre compte :
${appUrl}

📱 Téléchargez aussi notre application pour encore plus de facilité !`;
                      
                      window.open(`https://mail.google.com/mail/?view=cm&fs=1&to=&su=${encodeURIComponent('Rejoignez AfriGo !')}&body=${encodeURIComponent(emailBody)}`, '_blank');
                    }}
                    variant="outline"
                    className="border-blue-600 text-blue-600 hover:bg-blue-50"
                  >
                    <Mail className="w-4 h-4 mr-2" />
                    Gmail
                  </Button>
                </div>
                <p className="text-xs text-slate-500 mt-3">
                  💡 Astuce : Le lien sera automatiquement cliquable sur WhatsApp avec https://
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recherche */}
        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardContent className="p-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 w-5 h-5" />
              <Input
                placeholder="Rechercher par nom, email, ID client, téléphone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardContent>
        </Card>

        {/* Table des utilisateurs */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardContent className="p-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Utilisateur</TableHead>
                    <TableHead>État civil</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead>Niveau</TableHead>
                    <TableHead>Téléphone</TableHead>
                    <TableHead>Mot de passe</TableHead>
                    <TableHead>Adresse</TableHead>
                    <TableHead>Rôle</TableHead>
                    <TableHead>Commandes</TableHead>
                    <TableHead>Portefeuille</TableHead>
                    <TableHead>Inscription</TableHead>
                    <TableHead>Messages</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-slate-500">
                        Aucun utilisateur trouvé
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredUsers.map(u => {
                      const stats = getUserStats(u.email);
                      return (
                        <TableRow key={u.id} className={u.is_active === false ? 'opacity-50 bg-slate-50' : ''}>
                          <TableCell>
                            <div>
                              <p className="font-medium">{u.first_name} {u.last_name}</p>
                              <p className="text-sm text-slate-500">{u.customer_id || 'N/A'}</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-sm text-slate-700">{u.civility || '-'}</span>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <Mail className="w-3 h-3 text-slate-400" />
                              <span className="text-slate-600">{u.email}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {u.is_active === false ? (
                              <Badge variant="destructive" className="gap-1">
                                <UserX className="w-3 h-3" />
                                Désactivé
                              </Badge>
                            ) : (
                              <Badge className="bg-green-100 text-green-700 gap-1">
                                <UserCheck className="w-3 h-3" />
                                Actif
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.customer_tier === 'diamant' ? (
                              <Badge className="bg-blue-100 text-blue-700">💎 Diamant ⭐5</Badge>
                            ) : u.customer_tier === 'or' ? (
                              <Badge className="bg-yellow-100 text-yellow-700">🥇 Or ⭐4</Badge>
                            ) : u.customer_tier === 'argent' ? (
                              <Badge className="bg-slate-200 text-slate-700">🥈 Argent ⭐3</Badge>
                            ) : (
                              <Badge variant="outline">👤 Normal</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.phone ? (
                              <div className="flex items-center gap-2 text-sm">
                                <Phone className="w-3 h-3 text-slate-400" />
                                <span className="text-slate-600">{u.phone}</span>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">Non renseigné</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.user_password ? (
                              <div className="flex items-center gap-2">
                                <Key className="w-3 h-3 text-slate-400" />
                                <span className="font-mono text-sm">
                                  {showPasswords[u.id] ? u.user_password : '••••••••'}
                                </span>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => setShowPasswords(prev => ({ ...prev, [u.id]: !prev[u.id] }))}
                                >
                                  {showPasswords[u.id] ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-400">Non défini</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {u.address ? (
                              <div className="flex items-start gap-2">
                                <MapPin className="w-3 h-3 text-slate-400 mt-0.5 flex-shrink-0" />
                                <div className="text-sm text-slate-600">
                                  <p>{u.address}</p>
                                  <p>{u.postal_code} {u.city}</p>
                                </div>
                              </div>
                            ) : (
                              <span className="text-sm text-slate-400">Non renseignée</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={u.role === 'admin' ? 'default' : 'outline'}>
                              {u.role === 'admin' ? 'Admin' : 'Client'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              <p className="font-medium">{stats.ordersCount} commande{stats.ordersCount > 1 ? 's' : ''}</p>
                              <p className="text-slate-500">{stats.totalSpent.toFixed(2)}€</p>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Wallet className="w-4 h-4 text-emerald-500" />
                              <span className="font-medium text-emerald-600">
                                {(u.wallet_balance || 0).toFixed(2)}€
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm text-slate-600">
                              <Calendar className="w-3 h-3 text-slate-400" />
                              {format(new Date(u.created_date), 'dd/MM/yyyy', { locale: fr })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Link to={`${createPageUrl('AdminMessages')}?customer=${u.email}`}>
                              <Button variant="ghost" size="sm" className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 gap-1">
                                <MessageCircle className="w-4 h-4" />
                                Voir
                              </Button>
                            </Link>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => handleEdit(u)}
                                className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                title="Modifier"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              {u.is_active === false ? (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => activateUserMutation.mutate(u.id)}
                                  className="text-green-600 hover:text-green-700 hover:bg-green-50"
                                  title="Réactiver"
                                >
                                  <UserCheck className="w-4 h-4" />
                                </Button>
                              ) : (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setDeactivatingUser(u)}
                                  className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                                  title="Désactiver"
                                >
                                  <UserX className="w-4 h-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => setDeletingUser(u)}
                                className="text-rose-600 hover:text-rose-700 hover:bg-rose-50"
                                title="Supprimer"
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Dialog de création d'utilisateur */}
        <Dialog open={invitingUser} onOpenChange={() => setInvitingUser(false)}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
              <DialogDescription>
                L'utilisateur sera créé directement. Vous pourrez lui communiquer ses identifiants manuellement.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="invite_civility">État civil</Label>
                <Select
                  value={inviteData.civility}
                  onValueChange={(value) => setInviteData({ ...inviteData, civility: value })}
                >
                  <SelectTrigger id="invite_civility">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M.">M.</SelectItem>
                    <SelectItem value="Mme">Mme</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invite_first_name">Prénom</Label>
                  <Input
                    id="invite_first_name"
                    value={inviteData.first_name}
                    onChange={(e) => setInviteData({ ...inviteData, first_name: e.target.value })}
                    placeholder="Prénom"
                  />
                </div>
                <div>
                  <Label htmlFor="invite_last_name">Nom</Label>
                  <Input
                    id="invite_last_name"
                    value={inviteData.last_name}
                    onChange={(e) => setInviteData({ ...inviteData, last_name: e.target.value })}
                    placeholder="Nom"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invite_email">Email *</Label>
                <Input
                  id="invite_email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="email@example.com"
                />
              </div>

              <div>
                <Label htmlFor="invite_password">Mot de passe de connexion *</Label>
                <Input
                  id="invite_password"
                  type="text"
                  value={invitePassword}
                  onChange={(e) => setInvitePassword(e.target.value)}
                  placeholder="Créer un mot de passe"
                />
                <p className="text-xs text-slate-500 mt-1">Ce mot de passe permettra à l'utilisateur de se connecter</p>
              </div>

              <div>
                <Label htmlFor="invite_phone">Téléphone</Label>
                <Input
                  id="invite_phone"
                  value={inviteData.phone}
                  onChange={(e) => setInviteData({ ...inviteData, phone: e.target.value })}
                  placeholder="+33..."
                />
              </div>

              <div>
                <Label htmlFor="invite_address">Adresse complète</Label>
                <Input
                  id="invite_address"
                  value={inviteData.address}
                  onChange={(e) => setInviteData({ ...inviteData, address: e.target.value })}
                  placeholder="123 Rue Example"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="invite_postal_code">Code postal</Label>
                  <Input
                    id="invite_postal_code"
                    value={inviteData.postal_code}
                    onChange={(e) => setInviteData({ ...inviteData, postal_code: e.target.value })}
                    placeholder="75001"
                  />
                </div>
                <div>
                  <Label htmlFor="invite_city">Ville</Label>
                  <Input
                    id="invite_city"
                    value={inviteData.city}
                    onChange={(e) => setInviteData({ ...inviteData, city: e.target.value })}
                    placeholder="Paris"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="invite_wallet">Solde du portefeuille (€)</Label>
                <Input
                  id="invite_wallet"
                  type="number"
                  step="0.01"
                  value={inviteData.wallet_balance}
                  onChange={(e) => setInviteData({ ...inviteData, wallet_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>

              <div>
                <Label htmlFor="invite_tier" className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Niveau de fidélité
                </Label>
                <Select
                  value={inviteData.customer_tier}
                  onValueChange={(value) => setInviteData({ ...inviteData, customer_tier: value })}
                >
                  <SelectTrigger id="invite_tier">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">👤 Normal</SelectItem>
                    <SelectItem value="argent">🥈 Argent ⭐3</SelectItem>
                    <SelectItem value="or">🥇 Or ⭐4</SelectItem>
                    <SelectItem value="diamant">💎 Diamant ⭐5</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="invite_role">Rôle</Label>
                <Select value={inviteRole} onValueChange={setInviteRole}>
                  <SelectTrigger id="invite_role">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="user">Client</SelectItem>
                    <SelectItem value="admin">Administrateur</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setInvitingUser(false)}>
                Annuler
              </Button>
              <Button onClick={handleInvite} disabled={inviteUserMutation.isPending || !inviteEmail || !invitePassword}>
                {inviteUserMutation.isPending ? 'Création...' : 'Créer l\'utilisateur'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de modification */}
        <Dialog open={!!editingUser} onOpenChange={() => setEditingUser(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Modifier l'utilisateur</DialogTitle>
              <DialogDescription>
                Modifiez les informations de {editingUser?.email}
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div>
                <Label htmlFor="edit_civility">État civil</Label>
                <Select
                  value={formData.civility || ''}
                  onValueChange={(value) => setFormData({ ...formData, civility: value })}
                >
                  <SelectTrigger id="edit_civility">
                    <SelectValue placeholder="Sélectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="M.">M.</SelectItem>
                    <SelectItem value="Mme">Mme</SelectItem>
                    <SelectItem value="Autre">Autre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="first_name">Prénom</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name || ''}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="last_name">Nom</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name || ''}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="phone">Téléphone</Label>
                <Input
                  id="phone"
                  value={formData.phone || ''}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+33..."
                />
              </div>
              <div>
                <Label htmlFor="address">Adresse</Label>
                <Input
                  id="address"
                  value={formData.address || ''}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  placeholder="123 Rue Example"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="postal_code">Code postal</Label>
                  <Input
                    id="postal_code"
                    value={formData.postal_code || ''}
                    onChange={(e) => setFormData({ ...formData, postal_code: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="city">Ville</Label>
                  <Input
                    id="city"
                    value={formData.city || ''}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="wallet_balance">Solde du portefeuille (€)</Label>
                <Input
                  id="wallet_balance"
                  type="number"
                  step="0.01"
                  value={formData.wallet_balance || 0}
                  onChange={(e) => setFormData({ ...formData, wallet_balance: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label htmlFor="customer_tier" className="flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Niveau de fidélité
                </Label>
                <Select
                  value={formData.customer_tier || 'normal'}
                  onValueChange={(value) => setFormData({ ...formData, customer_tier: value })}
                >
                  <SelectTrigger id="customer_tier" className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">👤 Normal</SelectItem>
                    <SelectItem value="argent">🥈 Argent ⭐3</SelectItem>
                    <SelectItem value="or">🥇 Or ⭐4</SelectItem>
                    <SelectItem value="diamant">💎 Diamant ⭐5</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-slate-500 mt-1">Attribuez manuellement un niveau de fidélité au client</p>
              </div>
              <div>
                <Label htmlFor="user_password" className="flex items-center gap-2">
                  <Key className="w-4 h-4" />
                  Mot de passe
                </Label>
                <Input
                  id="user_password"
                  type="text"
                  value={formData.user_password || ''}
                  onChange={(e) => setFormData({ ...formData, user_password: e.target.value })}
                  placeholder="Mot de passe de l'utilisateur"
                />
                <p className="text-xs text-slate-500 mt-1">Modifiez le mot de passe de référence de l'utilisateur</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingUser(null)}>
                Annuler
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={updateUserMutation.isPending}
              >
                {updateUserMutation.isPending ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Dialog de désactivation */}
        <AlertDialog open={!!deactivatingUser} onOpenChange={() => setDeactivatingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Désactiver l'utilisateur ?</AlertDialogTitle>
              <AlertDialogDescription>
                L'utilisateur <strong>{deactivatingUser?.email}</strong> ne pourra plus se connecter à son compte.
                Vous pouvez le réactiver à tout moment.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="px-6 pb-4">
              <Label htmlFor="deactivation_reason">Raison de la désactivation</Label>
              <Input
                id="deactivation_reason"
                placeholder="Ex: Non-paiement, compte inactif..."
                defaultValue=""
                onBlur={(e) => setFormData({ ...formData, deactivation_reason: e.target.value })}
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => handleDeactivate(formData.deactivation_reason || 'Désactivé par l\'administrateur')}
                className="bg-orange-600 hover:bg-orange-700"
              >
                Désactiver
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog de suppression */}
        <AlertDialog open={!!deletingUser} onOpenChange={() => setDeletingUser(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Supprimer l'utilisateur ?</AlertDialogTitle>
              <AlertDialogDescription>
                Êtes-vous sûr de vouloir supprimer définitivement <strong>{deletingUser?.email}</strong> ?
                Cette action est irréversible et supprimera toutes les données associées.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annuler</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                className="bg-rose-600 hover:bg-rose-700"
              >
                Supprimer définitivement
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}