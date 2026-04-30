import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Save, ArrowLeft, Users, UserCheck, UserX, Eye, X, Clock, Plus, Edit } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminWelcomeMessage() {
  const [user, setUser] = useState(null);
  const [formData, setFormData] = useState({
    title: 'Bienvenue sur AfriGo',
    message: '',
    button_text_guest: "S'inscrire/Se connecter",
    button_text_registered: "J'ai compris",
    is_active: true,
    target_audience: 'guests',
    specific_users: [],
    display_frequency: 'once'
  });
  const [emailInput, setEmailInput] = useState('');
  const [editingMessage, setEditingMessage] = useState(null);
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

  const { data: welcomeMessages = [] } = useQuery({
    queryKey: ['welcomeMessages'],
    queryFn: () => base44.entities.WelcomeMessage.list('-created_date'),
    enabled: !!user
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Supprimer le useEffect qui chargeait automatiquement le premier message

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (editingMessage) {
        return base44.entities.WelcomeMessage.update(editingMessage.id, data);
      } else {
        return base44.entities.WelcomeMessage.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcomeMessages'] });
      toast.success(editingMessage ? 'Message mis à jour' : 'Message créé');
      setEditingMessage(null);
      resetForm();
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.WelcomeMessage.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['welcomeMessages'] });
      toast.success('Message supprimé');
    }
  });

  const resetForm = () => {
    setFormData({
      title: 'Bienvenue sur AfriGo',
      message: '',
      button_text_guest: "S'inscrire/Se connecter",
      button_text_registered: "J'ai compris",
      is_active: true,
      target_audience: 'guests',
      specific_users: [],
      display_frequency: 'once'
    });
    setEmailInput('');
  };

  const handleSave = () => {
    saveMutation.mutate(formData);
  };

  const handleAddEmail = () => {
    if (emailInput && !formData.specific_users.includes(emailInput)) {
      setFormData({
        ...formData,
        specific_users: [...formData.specific_users, emailInput]
      });
      setEmailInput('');
    }
  };

  const handleRemoveEmail = (email) => {
    setFormData({
      ...formData,
      specific_users: formData.specific_users.filter(e => e !== email)
    });
  };

  const audienceLabels = {
    guests: { label: 'Non inscrits uniquement', icon: UserX, color: 'text-orange-600', bg: 'bg-orange-100' },
    registered: { label: 'Inscrits uniquement', icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-100' },
    all: { label: 'Tous les utilisateurs', icon: Users, color: 'text-purple-600', bg: 'bg-purple-100' },
    specific: { label: 'Utilisateurs spécifiques', icon: Eye, color: 'text-emerald-600', bg: 'bg-emerald-100' }
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminSettings')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour aux paramètres
        </Link>

        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Messages de bienvenue</h1>
              <p className="text-slate-500">Gérez les messages affichés aux visiteurs</p>
            </div>
          </div>
          <Button
            onClick={resetForm}
            className="bg-emerald-500 hover:bg-emerald-600 rounded-xl"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nouveau message
          </Button>
        </div>

        {/* Liste des messages existants */}
        {welcomeMessages.length > 0 && (
          <Card className="border-0 shadow-sm rounded-2xl mb-6">
            <CardHeader>
              <CardTitle>Messages existants ({welcomeMessages.length})</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {welcomeMessages.map((msg) => (
                <div key={msg.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-slate-800">{msg.title}</h3>
                      <Badge variant={msg.is_active ? "default" : "secondary"}>
                        {msg.is_active ? 'Actif' : 'Inactif'}
                      </Badge>
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-1">{msg.message}</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {audienceLabels[msg.target_audience]?.label} · {msg.display_frequency === 'once' ? 'Une fois' : msg.display_frequency === 'daily' ? 'Quotidien' : 'Chaque connexion'}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => {
                        setEditingMessage(msg);
                        setFormData({
                          title: msg.title || 'Bienvenue sur AfriGo',
                          message: msg.message || '',
                          button_text_guest: msg.button_text_guest || "S'inscrire/Se connecter",
                          button_text_registered: msg.button_text_registered || "J'ai compris",
                          is_active: msg.is_active ?? true,
                          target_audience: msg.target_audience || 'guests',
                          specific_users: msg.specific_users || [],
                          display_frequency: msg.display_frequency || 'once'
                        });
                      }}
                      variant="outline"
                      size="icon"
                      className="rounded-xl"
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      onClick={() => {
                        if (confirm('Supprimer ce message ?')) {
                          deleteMutation.mutate(msg.id);
                        }
                      }}
                      variant="outline"
                      size="icon"
                      className="rounded-xl text-rose-600 hover:bg-rose-50"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm rounded-2xl mb-6">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              {editingMessage ? 'Modifier le message' : 'Nouveau message'}
              <div className="flex items-center gap-2">
                <Label htmlFor="active-switch" className="text-sm font-normal text-slate-600">
                  {formData.is_active ? 'Actif' : 'Inactif'}
                </Label>
                <Switch
                  id="active-switch"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div>
              <Label>Titre du message</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Bienvenue sur AfriGo"
                className="h-12 rounded-xl mt-2"
              />
            </div>

            <div>
              <Label>Contenu du message</Label>
              <Textarea
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Écrivez votre message de bienvenue ici..."
                className="min-h-[200px] rounded-xl mt-2"
              />
              <p className="text-xs text-slate-500 mt-1">
                Ce message sera affiché aux utilisateurs selon votre ciblage
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Texte bouton (invités)</Label>
                <Input
                  value={formData.button_text_guest}
                  onChange={(e) => setFormData({ ...formData, button_text_guest: e.target.value })}
                  placeholder="S'inscrire/Se connecter"
                  className="h-12 rounded-xl mt-2"
                />
              </div>
              <div>
                <Label>Texte bouton (inscrits)</Label>
                <Input
                  value={formData.button_text_registered}
                  onChange={(e) => setFormData({ ...formData, button_text_registered: e.target.value })}
                  placeholder="J'ai compris"
                  className="h-12 rounded-xl mt-2"
                />
              </div>
            </div>

            <div>
              <Label>Audience ciblée</Label>
              <Select
                value={formData.target_audience}
                onValueChange={(value) => setFormData({ ...formData, target_audience: value })}
              >
                <SelectTrigger className="h-12 rounded-xl mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(audienceLabels).map(([key, config]) => {
                    const Icon = config.icon;
                    return (
                      <SelectItem key={key} value={key}>
                        <div className="flex items-center gap-2">
                          <Icon className={`w-4 h-4 ${config.color}`} />
                          {config.label}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Fréquence d'affichage</Label>
              <Select
                value={formData.display_frequency}
                onValueChange={(value) => setFormData({ ...formData, display_frequency: value })}
              >
                <SelectTrigger className="h-12 rounded-xl mt-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="once">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-blue-600" />
                      Une seule fois
                    </div>
                  </SelectItem>
                  <SelectItem value="daily">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-600" />
                      Une fois par jour
                    </div>
                  </SelectItem>
                  <SelectItem value="every_login">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-orange-600" />
                      À chaque connexion
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-500 mt-1">
                {formData.display_frequency === 'once' && 'Le message ne sera affiché qu\'une seule fois'}
                {formData.display_frequency === 'daily' && 'Le message sera affiché une fois par jour'}
                {formData.display_frequency === 'every_login' && 'Le message sera affiché à chaque connexion'}
              </p>
            </div>

            {formData.target_audience === 'specific' && (
              <div>
                <Label>Utilisateurs spécifiques</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddEmail())}
                    placeholder="Email du client"
                    className="h-12 rounded-xl"
                  />
                  <Button
                    onClick={handleAddEmail}
                    disabled={!emailInput}
                    className="h-12 px-6 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                  >
                    Ajouter
                  </Button>
                </div>
                {formData.specific_users.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {formData.specific_users.map((email) => {
                      const user = allUsers.find(u => u.email === email);
                      const displayName = user?.first_name && user?.last_name 
                        ? `${user.first_name} ${user.last_name}` 
                        : email;
                      return (
                        <Badge key={email} className="bg-emerald-100 text-emerald-700 px-3 py-1.5 rounded-lg">
                          {displayName}
                          <button
                            onClick={() => handleRemoveEmail(email)}
                            className="ml-2 hover:text-emerald-900"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </Badge>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <Button
                onClick={handleSave}
                disabled={saveMutation.isPending || !formData.message}
                className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl shadow-lg"
              >
                <Save className="w-4 h-4 mr-2" />
                {editingMessage ? 'Mettre à jour' : 'Créer le message'}
              </Button>
              {editingMessage && (
                <Button
                  onClick={() => {
                    setEditingMessage(null);
                    resetForm();
                  }}
                  variant="outline"
                  className="h-12 rounded-xl"
                >
                  Annuler
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview */}
        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <CardTitle className="text-lg">Aperçu du message</CardTitle>
          </CardHeader>
          <CardContent>
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white border-2 border-orange-200 rounded-2xl p-6"
            >
              <div className="flex items-center gap-2 mb-4">
                <div className="w-10 h-10 bg-orange-100 rounded-xl flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-orange-500" />
                </div>
                <h3 className="text-xl font-bold text-slate-800">{formData.title}</h3>
              </div>
              <p className="text-slate-700 whitespace-pre-wrap">
                {formData.message || 'Votre message apparaîtra ici...'}
              </p>
              <div className="mt-4 pt-4 border-t">
                <div className="flex items-center gap-2">
                  {(() => {
                    const config = audienceLabels[formData.target_audience];
                    const Icon = config.icon;
                    return (
                      <>
                        <Icon className={`w-4 h-4 ${config.color}`} />
                        <span className="text-sm text-slate-600">
                          Visible pour : <strong>{config.label}</strong>
                        </span>
                      </>
                    );
                  })()}
                </div>
              </div>
            </motion.div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}