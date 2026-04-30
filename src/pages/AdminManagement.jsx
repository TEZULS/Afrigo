import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, Trash2, Plus, Crown, User, Copy, Check, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from 'sonner';

const permissionLabels = {
  dashboard: "📊 Tableau de bord",
  users: "👥 Utilisateurs & Visiteurs",
  products: "📦 Produits",
  orders: "🛍️ Commandes & Paniers clients",
  returns: "↩️ Retours",
  reviews: "⭐ Avis clients",
  delivery: "🚚 Zones de livraison, Créneaux, Assignation & Suivi",
  loyalty: "🎖️ Fidélité",
  referrals: "🤝 Parrainages",
  messages: "💬 Messages & Diffusion",
  wallet: "💰 Portefeuilles",
  qrcode: "📱 QR Code",
  top_customers: "🏆 Meilleurs clients",
  customer_history: "📜 Historique clients",
  settings: "⚙️ Paramètres, Codes promo, Paiement Stripe & Notifications",
  welcome_message: "✨ Message de bienvenue",
  admin_management: "🛡️ Gestion des admins"
};

export default function AdminManagement() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [canModify, setCanModify] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me()
      .then(user => {
        setUser(user);
        if (user.role !== 'admin') {
          navigate(createPageUrl('Home'));
        }
      })
      .catch(() => navigate(createPageUrl('Home')))
      .finally(() => setLoading(false));
  }, []);

  const { data: adminPermissions = [] } = useQuery({
    queryKey: ['adminPermissions'],
    queryFn: () => base44.entities.AdminPermissions.list(),
    enabled: !loading
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['allUsers'],
    queryFn: () => base44.entities.User.list(),
    enabled: !loading
  });

  const currentUserPermissions = adminPermissions.find(p => p.admin_email === user?.email);
  const isSuperAdminUser = currentUserPermissions?.is_super_admin || false;

  const adminUsers = allUsers.filter(u => u.role === 'admin');

  const createAdminMutation = useMutation({
    mutationFn: async ({ email, username, password, permissions, isSuperAdmin, canModify }) => {
      // Vérifier si l'utilisateur existe
      const targetUser = allUsers.find(u => u.email === email);
      if (!targetUser) {
        throw new Error("Utilisateur introuvable");
      }

      // Promouvoir en admin si nécessaire
      if (targetUser.role !== 'admin') {
        await base44.entities.User.update(targetUser.id, { role: 'admin' });
      }

      // Créer les permissions
      return base44.entities.AdminPermissions.create({
        admin_email: email,
        username,
        password,
        is_super_admin: isSuperAdmin,
        can_modify: canModify,
        permissions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      setDialogOpen(false);
      setNewAdminEmail('');
      setNewUsername('');
      setNewPassword('');
      setSelectedPermissions([]);
      setIsSuperAdmin(false);
      setCanModify(false);
      toast.success('Administrateur ajouté avec succès');
    },
    onError: (error) => {
      toast.error(error.message || 'Erreur lors de l\'ajout');
    }
  });

  const updatePermissionsMutation = useMutation({
    mutationFn: async ({ permissionId, permissions, isSuperAdmin, canModify, username, password }) => {
      const updateData = {
        permissions,
        is_super_admin: isSuperAdmin,
        can_modify: canModify
      };
      if (username) updateData.username = username;
      if (password) updateData.password = password;
      return base44.entities.AdminPermissions.update(permissionId, updateData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPermissions'] });
      setDialogOpen(false);
      setSelectedAdmin(null);
      toast.success('Permissions mises à jour');
    }
  });

  const deleteAdminMutation = useMutation({
    mutationFn: async ({ userId, permissionId }) => {
      // Retirer le rôle admin
      await base44.entities.User.update(userId, { role: 'user' });
      // Supprimer les permissions
      if (permissionId) {
        await base44.entities.AdminPermissions.delete(permissionId);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('Administrateur supprimé');
    }
  });

  const deleteAccountMutation = useMutation({
    mutationFn: async ({ userId, permissionId }) => {
      if (permissionId) {
        await base44.entities.AdminPermissions.delete(permissionId);
      }
      await base44.entities.User.delete(userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminPermissions'] });
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      toast.success('Compte supprimé définitivement');
    },
    onError: () => toast.error('Erreur lors de la suppression du compte')
  });

  const handleDeleteAccount = (admin) => {
    if (admin.email === user?.email) {
      toast.error('Vous ne pouvez pas supprimer votre propre compte');
      return;
    }
    if (!confirm(`⚠️ Supprimer DÉFINITIVEMENT le compte de ${admin.email} ? Cette action est irréversible.`)) return;
    const permissions = adminPermissions.find(p => p.admin_email === admin.email);
    const targetUser = allUsers.find(u => u.email === admin.email);
    deleteAccountMutation.mutate({ userId: targetUser?.id, permissionId: permissions?.id });
  };

  const handleOpenAddDialog = () => {
    setSelectedAdmin(null);
    setNewAdminEmail('');
    setNewUsername('');
    setNewPassword('');
    setSelectedPermissions([]);
    setIsSuperAdmin(false);
    setCanModify(false);
    setDialogOpen(true);
  };

  const handleOpenEditDialog = (admin) => {
    const permissions = adminPermissions.find(p => p.admin_email === admin.email);
    setSelectedAdmin(admin);
    setNewUsername(permissions?.username || '');
    setNewPassword(permissions?.password || '');
    setSelectedPermissions(permissions?.permissions || []);
    setIsSuperAdmin(permissions?.is_super_admin || false);
    setCanModify(permissions?.can_modify || false);
    setDialogOpen(true);
  };

  const handleTogglePermission = (permission) => {
    setSelectedPermissions(prev =>
      prev.includes(permission)
        ? prev.filter(p => p !== permission)
        : [...prev, permission]
    );
  };

  const handleSave = () => {
    if (selectedAdmin) {
      const permissions = adminPermissions.find(p => p.admin_email === selectedAdmin.email);
      if (!isSuperAdmin && (!newUsername || !newPassword)) {
        toast.error('Identifiant et mot de passe requis pour les admins standards');
        return;
      }
      updatePermissionsMutation.mutate({
        permissionId: permissions.id,
        permissions: selectedPermissions,
        isSuperAdmin,
        canModify,
        username: isSuperAdmin ? null : newUsername,
        password: isSuperAdmin ? null : newPassword
      });
    } else {
      if (!newAdminEmail) {
        toast.error('Email requis');
        return;
      }
      if (!isSuperAdmin && (!newUsername || !newPassword)) {
        toast.error('Identifiant et mot de passe requis pour les admins standards');
        return;
      }
      createAdminMutation.mutate({
        email: newAdminEmail,
        username: isSuperAdmin ? null : newUsername,
        password: isSuperAdmin ? null : newPassword,
        permissions: selectedPermissions,
        isSuperAdmin,
        canModify
      });
    }
  };

  const handleDeleteAdmin = (admin) => {
    if (admin.email === user?.email) {
      toast.error('Vous ne pouvez pas vous supprimer vous-même');
      return;
    }

    if (!confirm(`Supprimer l'accès administrateur de ${admin.email} ?`)) {
      return;
    }

    const permissions = adminPermissions.find(p => p.admin_email === admin.email);
    deleteAdminMutation.mutate({
      userId: admin.id,
      permissionId: permissions?.id
    });
  };

  const handleCopyAdminLink = () => {
    const adminLoginUrl = `${window.location.origin}${createPageUrl('AdminLogin')}`;
    navigator.clipboard.writeText(adminLoginUrl);
    setCopiedLink(true);
    toast.success('Lien copié !');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!isSuperAdminUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center">
            <Shield className="w-12 h-12 text-rose-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Accès refusé</h2>
            <p className="text-slate-600">Seul le super administrateur peut accéder à cette page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">Gestion des administrateurs</h1>
            <p className="text-slate-600 mt-1">Gérez les accès et permissions des administrateurs</p>
          </div>
          <Button
            onClick={handleOpenAddDialog}
            className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ajouter un admin
          </Button>
        </div>

        {/* Lien de connexion admin */}
        <Card className="mb-6 border-0 shadow-sm rounded-2xl bg-gradient-to-br from-emerald-50 to-white">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                  <Shield className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-800 mb-1">Page de connexion administrateur</h3>
                  <p className="text-sm text-slate-600">
                    {window.location.origin}{createPageUrl('AdminLogin')}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCopyAdminLink}
                  className="rounded-xl"
                >
                  {copiedLink ? (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Copié !
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4 mr-2" />
                      Copier le lien
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(createPageUrl('AdminLogin'), '_blank')}
                  className="rounded-xl"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Ouvrir
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4">
          {adminUsers.map(admin => {
            const permissions = adminPermissions.find(p => p.admin_email === admin.email);
            const isSuper = permissions?.is_super_admin || false;

            return (
              <Card key={admin.id} className="border-0 shadow-sm rounded-2xl">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div className="w-12 h-12 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-xl flex items-center justify-center text-white font-bold">
                        {isSuper ? <Crown className="w-6 h-6" /> : <User className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-slate-800">
                            {admin.first_name && admin.last_name
                              ? `${admin.first_name} ${admin.last_name}`
                              : admin.full_name}
                          </h3>
                          {isSuper && (
                            <Badge className="bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0">
                              <Crown className="w-3 h-3 mr-1" />
                              Super Admin
                            </Badge>
                          )}
                          {admin.email === user?.email && (
                            <Badge variant="secondary">Vous</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-600 mb-2">{admin.email}</p>
                        
                        {!isSuper && permissions?.username && (
                          <div className="mb-3">
                            <Badge className="bg-blue-100 text-blue-700 text-xs">
                              🔑 Identifiant: {permissions.username}
                            </Badge>
                          </div>
                        )}
                        
                        {isSuper && (
                          <div className="mb-3">
                            <Badge className="bg-emerald-100 text-emerald-700 text-xs">
                              ✓ Connexion via interface standard
                            </Badge>
                          </div>
                        )}
                        
                        {!isSuper && permissions?.permissions && (
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              {permissions.can_modify ? (
                                <Badge className="bg-emerald-100 text-emerald-700 border-0">
                                  ✓ Peut modifier
                                </Badge>
                              ) : (
                                <Badge className="bg-amber-100 text-amber-700 border-0">
                                  👁️ Lecture seule
                                </Badge>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {permissions.permissions.length === 0 ? (
                                <Badge variant="secondary">Aucun accès</Badge>
                              ) : (
                                permissions.permissions.map(perm => (
                                  <Badge key={perm} variant="outline" className="text-xs">
                                    {permissionLabels[perm]}
                                  </Badge>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                        {isSuper && (
                          <Badge variant="outline" className="text-xs">
                            Accès complet à toutes les sections
                          </Badge>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditDialog(admin)}
                        className="rounded-xl"
                      >
                        <Shield className="w-4 h-4 mr-2" />
                        Permissions
                      </Button>
                      {admin.email !== user?.email && (
                        <>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAdmin(admin)}
                            className="rounded-xl text-orange-600 hover:bg-orange-50"
                            title="Rétrograder en utilisateur"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Retirer admin
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDeleteAccount(admin)}
                            className="rounded-xl text-rose-600 hover:bg-rose-50"
                            title="Supprimer le compte définitivement"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Supprimer compte
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Dialog pour ajouter/modifier un admin */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>
                {selectedAdmin ? 'Modifier les permissions' : 'Ajouter un administrateur'}
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {!selectedAdmin && (
                <div>
                  <label className="block text-sm font-medium mb-2">Email de l'utilisateur</label>
                  <Input
                    type="email"
                    placeholder="exemple@email.com"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    className="rounded-xl"
                  />
                  <p className="text-xs text-slate-500 mt-1">
                    L'utilisateur doit déjà être inscrit sur la plateforme
                  </p>
                </div>
              )}

{!isSuperAdmin && (
                <div className="border-t pt-4">
                  <h4 className="font-semibold text-slate-700 mb-3">Identifiants de connexion</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-2">Identifiant *</label>
                      <Input
                        placeholder="admin01"
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-2">Mot de passe *</label>
                      <Input
                        type="password"
                        placeholder="Mot de passe sécurisé"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    Ces identifiants seront utilisés pour la connexion via la page AdminLogin
                  </p>
                </div>
              )}
              
              {isSuperAdmin && (
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-sm text-amber-800">
                    ℹ️ Le super administrateur se connecte via la page de connexion standard de l'application (pas d'identifiant/mot de passe séparés requis)
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                  <Checkbox
                    checked={isSuperAdmin}
                    onCheckedChange={setIsSuperAdmin}
                    id="super-admin"
                  />
                  <label htmlFor="super-admin" className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-2 font-semibold text-amber-800">
                      <Crown className="w-4 h-4" />
                      Super administrateur
                    </div>
                    <p className="text-xs text-amber-700">
                      Accès complet à toutes les sections, y compris la gestion des autres administrateurs
                    </p>
                  </label>
                </div>

                {!isSuperAdmin && (
                  <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                    <Checkbox
                      checked={canModify}
                      onCheckedChange={setCanModify}
                      id="can-modify"
                    />
                    <label htmlFor="can-modify" className="flex-1 cursor-pointer">
                      <div className="font-semibold text-emerald-800">
                        Autoriser les modifications
                      </div>
                      <p className="text-xs text-emerald-700">
                        Permet de modifier les données. Sinon, accès en lecture seule uniquement.
                      </p>
                    </label>
                  </div>
                )}
              </div>

              {!isSuperAdmin && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium">Sections accessibles</label>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs"
                        onClick={() => setSelectedPermissions(Object.keys(permissionLabels).filter(k => k !== 'admin_management'))}
                      >
                        Tout sélectionner
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-xl text-xs"
                        onClick={() => setSelectedPermissions([])}
                      >
                        Tout décocher
                      </Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {Object.entries(permissionLabels)
                      .filter(([key]) => key !== 'admin_management')
                      .map(([key, label]) => (
                        <div
                          key={key}
                          className={`flex items-center gap-3 p-3 border rounded-xl cursor-pointer transition-colors ${
                            selectedPermissions.includes(key) ? 'bg-emerald-50 border-emerald-300' : 'hover:bg-slate-50'
                          }`}
                          onClick={() => handleTogglePermission(key)}
                        >
                          <Checkbox
                            checked={selectedPermissions.includes(key)}
                            onCheckedChange={() => handleTogglePermission(key)}
                          />
                          <label className="text-sm cursor-pointer flex-1">{label}</label>
                          {selectedPermissions.includes(key) && (
                            <Check className="w-4 h-4 text-emerald-500" />
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setDialogOpen(false)}
                  className="flex-1 rounded-xl"
                >
                  Annuler
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  {selectedAdmin ? 'Mettre à jour' : 'Ajouter'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}