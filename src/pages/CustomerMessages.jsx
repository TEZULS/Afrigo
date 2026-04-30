import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { MessageCircle, Send, ArrowLeft, Headphones, Phone, Camera, Download } from 'lucide-react';
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function CustomerMessages() {
  const [user, setUser] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const scrollRef = useRef(null);
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get('order');

  useEffect(() => {
    base44.auth.me().then(setUser).catch(() => {});
  }, []);

  const { data: settings = [] } = useQuery({
    queryKey: ['appSettings'],
    queryFn: () => base44.entities.AppSettings.list()
  });

  const supportPhone = settings[0]?.support_phone || '+33123456789';

  const { data: messages = [] } = useQuery({
    queryKey: ['messages', user?.email],
    queryFn: () => base44.entities.Message.filter({ customer_email: user?.email }, 'created_date'),
    enabled: !!user?.email,
    refetchInterval: 5000
  });

  const sendMessageMutation = useMutation({
    mutationFn: (content) => base44.entities.Message.create({
      customer_email: user.email,
      content,
      sender_type: 'customer',
      order_id: orderId || null,
      is_read: false
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] });
      setNewMessage('');
    }
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    sendMessageMutation.mutate(newMessage);
  };

  const handleImageCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingImage(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      sendMessageMutation.mutate(`[IMAGE]${file_url}`);
    } catch (error) {
      console.error('Erreur upload:', error);
    } finally {
      setUploadingImage(false);
      e.target.value = '';
    }
  };

  const renderMessageContent = (content) => {
    if (content.startsWith('[IMAGE]')) {
      const imageUrl = content.replace('[IMAGE]', '');
      return (
        <img
          src={imageUrl}
          alt="Photo envoyée"
          className="rounded-lg max-w-full cursor-pointer hover:opacity-90 transition-opacity"
          onClick={() => setImagePreview(imageUrl)}
        />
      );
    }
    return <p className="text-sm">{content}</p>;
  };

  const unreadAdminMessages = messages.filter(m => !m.is_read && m.sender_type === 'admin').length;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <Link to={createPageUrl('Messages')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au contact
        </Link>

        <Card className="border-0 shadow-lg rounded-2xl overflow-hidden h-[calc(100vh-140px)] flex flex-col">
          <CardHeader className="bg-emerald-500 text-white shrink-0">
            <CardTitle className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                  <Headphones className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-semibold flex items-center gap-2">
                    Le service client AfriGo
                    {unreadAdminMessages > 0 && (
                      <Badge className="bg-rose-500 text-white text-xs font-bold">
                        {unreadAdminMessages}
                      </Badge>
                    )}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => window.location.href = `tel:${supportPhone}`}
                className="h-10 px-4 rounded-xl bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <Phone className="w-4 h-4 mr-2" />
                Appeler
              </Button>
            </CardTitle>
          </CardHeader>

          <ScrollArea className="flex-1 p-4" ref={scrollRef}>
            {messages.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500">Aucun message pour le moment</p>
                <p className="text-sm text-slate-400 mt-1">Posez-nous vos questions, une réponse dans les instants à venir</p>
              </div>
            ) : (
              <AnimatePresence>
                <div className="space-y-4">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.sender_type === 'customer' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                        msg.sender_type === 'customer'
                          ? 'bg-green-500 text-white rounded-br-md'
                          : 'bg-orange-500 text-white rounded-bl-md'
                      }`}>
                        {renderMessageContent(msg.content)}
                        <p className={`text-xs mt-1 ${msg.sender_type === 'customer' ? 'text-green-100' : 'text-orange-100'}`}>
                          {format(new Date(msg.created_date), 'HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </AnimatePresence>
            )}
          </ScrollArea>

          <div className="p-4 border-t bg-white shrink-0">
            <form onSubmit={handleSend} className="flex gap-3">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleImageCapture}
                className="hidden"
                id="camera-input"
                disabled={uploadingImage}
              />
              <label htmlFor="camera-input">
                <Button type="button" variant="outline" className="h-12 w-12 rounded-xl" disabled={uploadingImage} asChild>
                  <span>
                    <Camera className={`w-5 h-5 ${uploadingImage ? 'animate-pulse' : ''}`} />
                  </span>
                </Button>
              </label>
              <Input
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Écrivez votre message..."
                className="flex-1 h-12 rounded-xl"
              />
              <Button
                type="submit"
                disabled={!newMessage.trim() || sendMessageMutation.isPending}
                className="h-12 w-12 rounded-xl bg-emerald-500 hover:bg-emerald-600"
              >
                <Send className="w-5 h-5" />
              </Button>
            </form>
          </div>
        </Card>
      </div>

      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-4xl p-2">
          <img src={imagePreview} alt="Aperçu" className="w-full h-auto rounded-lg" />
          <Button onClick={() => window.open(imagePreview, '_blank')} className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600">
            <Download className="w-4 h-4 mr-2" />
            Télécharger l'image
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}