import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Tabs, TabsContent, TabsList, TabsTrigger
} from "@/components/ui/tabs";
import {
  ArrowLeft, Mail, MessageCircle, Users, User, Search, Image, X, Send,
  CheckCircle, Loader2, Upload, ChevronDown, ChevronUp
} from 'lucide-react';

export default function AdminBroadcast() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('group'); // 'group' | 'individual'
  const [channel, setChannel] = useState('email'); // 'email' | 'whatsapp'
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedEmails, setSelectedEmails] = useState([]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [images, setImages] = useState([]); // [{ url, name }]
  const [uploadingImage, setUploadingImage] = useState(false);
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState(null); // { success, failed }
  const [showResults, setShowResults] = useState(false);
  const [expandedUser, setExpandedUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.href = '/'; return; }
      setUser(u);
    }).catch(() => window.location.href = '/');
  }, []);

  const { data: allUsers = [], isLoading: loadingUsers } = useQuery({
    queryKey: ['all-users-broadcast'],
    queryFn: async () => {
      const allData = [];
      let skip = 0;
      const limit = 100;
      while (true) {
        const batch = await base44.entities.User.list(undefined, limit, skip);
        allData.push(...batch);
        if (batch.length < limit) break;
        skip += limit;
      }
      return allData;
    },
    enabled: !!user,
  });

  const customers = allUsers.filter(u => u.role !== 'admin');

  const filteredCustomers = customers.filter(u => {
    const name = u.first_name && u.last_name ? `${u.first_name} ${u.last_name}` : (u.full_name || '');
    const q = searchQuery.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(q) ||
      name.toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q)
    );
  });

  const getCustomerName = (u) => {
    if (u.first_name && u.last_name) return `${u.first_name} ${u.last_name}`;
    return u.full_name || u.email;
  };

  const toggleSelectAll = () => {
    if (selectedEmails.length === filteredCustomers.length) {
      setSelectedEmails([]);
    } else {
      setSelectedEmails(filteredCustomers.map(u => u.email));
    }
  };

  const toggleEmail = (email) => {
    setSelectedEmails(prev =>
      prev.includes(email) ? prev.filter(e => e !== email) : [...prev, email]
    );
  };

  const handleImageUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingImage(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      setImages(prev => [...prev, { url: file_url, name: file.name }]);
    }
    setUploadingImage(false);
    e.target.value = '';
  };

  const removeImage = (idx) => {
    setImages(prev => prev.filter((_, i) => i !== idx));
  };

  const buildEmailBody = () => {
    let body = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:24px;background:#fff;border-radius:12px;">
        <div style="font-size:16px;line-height:1.7;color:#222;margin-bottom:20px;">
          ${message.replace(/\n/g, '<br>')}
        </div>
        ${images.length > 0 ? images.map(img =>
          `<div style="margin-bottom:16px;">
            <img src="${img.url}" alt="" style="width:100%;max-width:560px;border-radius:10px;display:block;" />
          </div>`
        ).join('') : ''}
      </div>
    `;
    return body;
  };

  const buildWhatsAppText = () => {
    // Pour WhatsApp, on envoie uniquement le texte (les images sont envoyées séparément)
    return message;
  };

  const handleSendAll = async () => {
    const targets = mode === 'group'
      ? customers.map(u => u.email)
      : selectedEmails;

    if (!targets.length || !message.trim()) return;

    setSending(true);
    const success = [];
    const failed = [];

    if (channel === 'email') {
      for (const email of targets) {
        try {
          await base44.integrations.Core.SendEmail({
            to: email,
            subject: subject || 'Message de AfriGo',
            body: buildEmailBody(email),
          });
          success.push(email);
        } catch {
          failed.push(email);
        }
      }
      setResults({ success, failed });
      setShowResults(true);
    } else {
    // WhatsApp: partager via Web Share API si images présentes, sinon wa.me
    const text = buildWhatsAppText();
    const encoded = encodeURIComponent(text);

    if (mode === 'group') {
      window.open(`https://wa.me/?text=${encoded}`, '_blank');
    } else {
      for (const email of selectedEmails) {
        const u = customers.find(c => c.email === email);
        const phone = (u?.phone || '').replace(/\s+/g, '').replace(/^\+/, '');
        const url = phone
          ? `https://wa.me/${phone}?text=${encoded}`
          : `https://wa.me/?text=${encoded}`;
        window.open(url, '_blank');
        await new Promise(r => setTimeout(r, 500));
      }
    }
    setResults({ success: targets, failed: [] });
    setShowResults(true);
    }

    setSending(false);
  };

  const targetCount = mode === 'group' ? customers.length : selectedEmails.length;
  const canSend = message.trim() && targetCount > 0;

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => window.history.back()} className="rounded-lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1">Envoi de messages</h1>
            <p className="text-slate-600">Envoyez un message groupé ou individuel avec images</p>
          </div>
        </div>

        <div className="grid lg:grid-cols-5 gap-6">
          {/* LEFT: Compose */}
          <div className="lg:col-span-3 space-y-5">
            {/* Channel */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Canal d'envoi</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3">
                  <Button
                    onClick={() => setChannel('email')}
                    variant={channel === 'email' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl gap-2 ${channel === 'email' ? 'bg-blue-600 hover:bg-blue-700' : ''}`}
                  >
                    <Mail className="w-4 h-4" /> Email
                  </Button>
                  <Button
                    onClick={() => setChannel('whatsapp')}
                    variant={channel === 'whatsapp' ? 'default' : 'outline'}
                    className={`flex-1 rounded-xl gap-2 ${channel === 'whatsapp' ? 'bg-green-600 hover:bg-green-700' : ''}`}
                  >
                    <MessageCircle className="w-4 h-4" /> WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Compose */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Rédiger le message</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {channel === 'email' && (
                  <Input
                    placeholder="Objet de l'email..."
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className="rounded-xl"
                  />
                )}
                <Textarea
                  placeholder="Rédigez votre message ici..."
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  rows={7}
                  className="rounded-xl resize-none"
                />

                {/* Images */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-700">Images ({images.length})</p>
                    <label htmlFor="broadcast-image-upload">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="rounded-xl gap-2 cursor-pointer"
                        disabled={uploadingImage}
                        asChild
                      >
                        <span>
                          {uploadingImage ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Upload className="w-4 h-4" />
                          )}
                          Ajouter image(s)
                        </span>
                      </Button>
                    </label>
                    <input
                      id="broadcast-image-upload"
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleImageUpload}
                    />
                  </div>

                  {images.length > 0 && (
                    <div className="flex flex-wrap gap-3">
                      {images.map((img, idx) => (
                        <div key={idx} className="relative group">
                          <img
                            src={img.url}
                            alt={img.name}
                            className="w-20 h-20 object-cover rounded-xl border"
                          />
                          <button
                            onClick={() => removeImage(idx)}
                            className="absolute -top-2 -right-2 bg-rose-500 text-white rounded-full w-5 h-5 flex items-center justify-center shadow hover:bg-rose-600"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Send Button */}
            <Button
              onClick={handleSendAll}
              disabled={!canSend || sending}
              className={`w-full h-12 rounded-xl gap-2 text-base font-semibold ${
                channel === 'email'
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
            >
              {sending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : channel === 'email' ? (
                <Mail className="w-5 h-5" />
              ) : (
                <MessageCircle className="w-5 h-5" />
              )}
              {sending
                ? 'Envoi en cours...'
                : `Envoyer à ${targetCount} client(s) via ${channel === 'email' ? 'Email' : 'WhatsApp'}`}
            </Button>
          </div>

          {/* RIGHT: Recipients */}
          <div className="lg:col-span-2">
            <Card className="h-full">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Users className="w-4 h-4" /> Destinataires
                </CardTitle>
                <Tabs value={mode} onValueChange={setMode} className="mt-2">
                  <TabsList className="w-full rounded-xl">
                    <TabsTrigger value="group" className="flex-1 rounded-xl">
                      Tous ({customers.length})
                    </TabsTrigger>
                    <TabsTrigger value="individual" className="flex-1 rounded-xl">
                      Sélection ({selectedEmails.length})
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </CardHeader>
              <CardContent className="p-0">
                {mode === 'group' ? (
                  <div className="px-4 pb-4">
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                      <Users className="w-8 h-8 text-blue-500 mx-auto mb-2" />
                      <p className="font-semibold text-blue-800">{customers.length} clients</p>
                      <p className="text-sm text-blue-600">Tous les clients recevront ce message</p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="px-4 pb-2 space-y-2">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <Input
                          placeholder="Rechercher..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="pl-10 rounded-xl"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={toggleSelectAll}
                          className="text-sm text-blue-600 hover:underline"
                        >
                          {selectedEmails.length === filteredCustomers.length ? 'Désélectionner tout' : 'Sélectionner tout'}
                        </button>
                        <span className="text-xs text-slate-500">{selectedEmails.length} sélectionné(s)</span>
                      </div>
                    </div>
                    <div className="max-h-[420px] overflow-y-auto divide-y px-2">
                      {loadingUsers ? (
                        <div className="py-8 flex justify-center">
                          <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
                        </div>
                      ) : filteredCustomers.map(u => (
                        <label
                          key={u.email}
                          className="flex items-center gap-3 px-2 py-3 cursor-pointer hover:bg-slate-50 rounded-lg"
                        >
                          <Checkbox
                            checked={selectedEmails.includes(u.email)}
                            onCheckedChange={() => toggleEmail(u.email)}
                          />
                          <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                            <User className="w-4 h-4 text-orange-500" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800 truncate">{getCustomerName(u)}</p>
                            <p className="text-xs text-slate-500 truncate">{u.email}</p>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Results Dialog */}
      <Dialog open={showResults} onOpenChange={(open) => { if (!open) { setShowResults(false); setResults(null); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-emerald-500" />
              Résultat de l'envoi
            </DialogTitle>
          </DialogHeader>
          {results && (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="font-semibold text-emerald-800">✅ {results.success.length} envoi(s) réussi(s)</p>
              </div>
              {results.failed.length > 0 && (
                <div className="bg-rose-50 border border-rose-200 rounded-xl p-4">
                  <p className="font-semibold text-rose-800">❌ {results.failed.length} échec(s)</p>
                  <ul className="mt-2 text-sm text-rose-700 space-y-1">
                    {results.failed.map(e => <li key={e}>{e}</li>)}
                  </ul>
                </div>
              )}
              <Button
                onClick={() => {
                  setShowResults(false);
                  setResults(null);
                  setMessage('');
                  setSubject('');
                  setImages([]);
                  setSelectedEmails([]);
                }}
                className="w-full rounded-xl bg-emerald-600 hover:bg-emerald-700"
              >
                Nouveau message
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}