import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { 
  MessageCircle, Send, ArrowLeft, User, Headphones, Search, Trash2, AlertCircle, Camera, Download, Phone, MessageSquare
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
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

export default function AdminMessages() {
  const [user, setUser] = useState(null);
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [newMessage, setNewMessage] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [deleteConversationEmail, setDeleteConversationEmail] = useState(null);
  const [showDeleteAllDialog, setShowDeleteAllDialog] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imagePreview, setImagePreview] = useState(null);
  const scrollRef = useRef(null);
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

  const { data: allMessages = [] } = useQuery({
    queryKey: ['all-messages'],
    queryFn: () => base44.entities.Message.list('created_date'),
    enabled: !!user,
    refetchInterval: 5000
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user
  });

  // Group messages by customer
  const conversations = allMessages.reduce((acc, msg) => {
    const email = msg.customer_email;
    if (!acc[email]) {
      acc[email] = [];
    }
    acc[email].push(msg);
    return acc;
  }, {});

  const getUserName = (email) => {
    const user = allUsers.find(u => u.email === email);
    if (user && user.first_name && user.last_name) {
      return `${user.first_name} ${user.last_name}`;
    }
    return email;
  };

  // Only show clients with existing conversations
  const conversationList = Object.keys(conversations)
    .map(email => ({
      email,
      userName: getUserName(email),
      messages: conversations[email],
      lastMessage: conversations[email][conversations[email].length - 1],
      unreadCount: conversations[email].filter(m => !m.is_read && m.sender_type === 'customer').length,
      phone: allUsers.find(u => u.email === email)?.phone || '',
      hasConversation: true
    }))
    .filter(c => {
      if (!searchQuery) return true; // Show all conversations by default
      return c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
             c.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
             c.phone?.includes(searchQuery);
    })
    .sort((a, b) => new Date(b.lastMessage.created_date) - new Date(a.lastMessage.created_date));

  const sendMessageMutation = useMutation({
    mutationFn: (content) => base44.entities.Message.create({
      customer_email: selectedConversation,
      content,
      sender_type: 'admin',
      is_read: true
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
      setNewMessage('');
    }
  });

  const deleteConversationMutation = useMutation({
    mutationFn: async (email) => {
      const messagesToDelete = allMessages.filter(m => m.customer_email === email);
      await Promise.all(messagesToDelete.map(m => base44.entities.Message.delete(m.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
      setDeleteConversationEmail(null);
      if (selectedConversation === deleteConversationEmail) {
        setSelectedConversation(null);
      }
    }
  });

  const deleteAllConversationsMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(allMessages.map(m => base44.entities.Message.delete(m.id)));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['all-messages'] });
      setShowDeleteAllDialog(false);
      setSelectedConversation(null);
    }
  });

  // Mark messages as read
  useEffect(() => {
    if (selectedConversation && conversations[selectedConversation]) {
      conversations[selectedConversation]
        .filter(m => !m.is_read && m.sender_type === 'customer')
        .forEach(m => {
          base44.entities.Message.update(m.id, { is_read: true });
        });
    }
  }, [selectedConversation, conversations]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [selectedConversation, conversations]);

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

  const totalUnreadMessages = conversationList.reduce((sum, conv) => sum + conv.unreadCount, 0);

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 w-full bg-slate-50" style={{ height: 'calc(100vh - 4rem)' }}>
          {/* Conversation List */}
          <Card className="border-0 border-r border-slate-200 shadow-none rounded-none overflow-hidden flex flex-col h-full lg:col-span-1" style={{ display: selectedConversation ? 'none' : 'flex' }}>
            <CardHeader className="pb-2 pt-3 px-3 shrink-0 border-b border-slate-100">
              <div className="flex items-center gap-2 mb-2">
                <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-emerald-600 transition-colors">
                  <ArrowLeft className="w-4 h-4" />
                </Link>
                <MessageCircle className="w-4 h-4 text-purple-600" />
                <h1 className="text-sm font-bold text-slate-800 flex-1">Messagerie</h1>
                {totalUnreadMessages > 0 && (
                  <Badge className="bg-rose-500 text-white text-xs font-bold">
                    {totalUnreadMessages}
                  </Badge>
                )}
                {Object.keys(conversations).length > 0 && (
                  <Button
                    onClick={() => setShowDeleteAllDialog(true)}
                    variant="ghost"
                    size="sm"
                    className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-7 px-2 text-xs"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 min-h-0">
              <ScrollArea className="h-full">
                {conversationList.map(conv => (
                  <div
                    key={conv.email}
                    className={`
                      flex items-center gap-3 p-4 cursor-pointer transition-all border-b group
                      ${selectedConversation === conv.email 
                        ? 'bg-emerald-50 border-emerald-100' 
                        : conv.unreadCount > 0
                        ? 'bg-slate-200 hover:bg-slate-300'
                        : 'hover:bg-slate-50'
                      }
                    `}
                  >
                    <div 
                      onClick={() => setSelectedConversation(conv.email)}
                      className="flex items-center gap-3 flex-1 min-w-0"
                    >
                      <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5 text-slate-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <p className={`truncate ${conv.unreadCount > 0 ? 'font-bold' : 'font-medium'}`}>{conv.userName}</p>
                          {conv.unreadCount > 0 && (
                            <Badge className="bg-emerald-600 text-white text-xs font-bold">
                              {conv.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className={`text-sm truncate ${conv.unreadCount > 0 ? 'text-slate-700 font-medium' : 'text-slate-500'}`}>
                          {conv.lastMessage?.content.startsWith('[IMAGE]') ? '📷 Photo' : conv.lastMessage?.content || 'Pas de messages'}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `tel:${conv.email}`;
                        }}
                        className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 h-8 w-8"
                        title="Appeler"
                      >
                        <Phone className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.location.href = `sms:${conv.email}`;
                        }}
                        className="text-purple-500 hover:text-purple-700 hover:bg-purple-50 h-8 w-8"
                        title="SMS"
                      >
                        <MessageSquare className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteConversationEmail(conv.email);
                        }}
                        className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 h-8 w-8"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area - Desktop */}
          <Card className="col-span-1 border-0 shadow-none rounded-none flex flex-col h-full overflow-hidden hidden lg:flex">
            {selectedConversation ? (
              <>
                <CardHeader className="bg-emerald-500 text-white shrink-0 lg:flex hidden">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedConversation(null)}
                        className="text-white hover:bg-white/20"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                        <User className="w-5 h-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{getUserName(selectedConversation)}</p>
                        {allUsers.find(u => u.email === selectedConversation)?.phone && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.location.href = `tel:${allUsers.find(u => u.email === selectedConversation)?.phone}`}
                            className="text-white hover:bg-white/20 h-6 px-2 text-xs mt-1 flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            {allUsers.find(u => u.email === selectedConversation)?.phone}
                          </Button>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConversationEmail(selectedConversation)}
                      className="text-white hover:bg-white/20"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardHeader className="bg-emerald-500 text-white shrink-0 lg:hidden flex">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedConversation(null)}
                        className="text-white hover:bg-white/20"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </Button>
                      <div>
                        <p className="font-semibold">{getUserName(selectedConversation)}</p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setDeleteConversationEmail(selectedConversation)}
                      className="text-white hover:bg-white/20"
                    >
                      <Trash2 className="w-5 h-5" />
                    </Button>
                  </CardTitle>
                </CardHeader>

                <ScrollArea className="flex-1 p-4 min-h-0" ref={scrollRef}>
                  <div className="space-y-4">
                    {conversations[selectedConversation]?.map((msg) => (
                      <motion.div
                        key={msg.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`
                          max-w-[80%] rounded-2xl px-4 py-3
                          ${msg.sender_type === 'admin' 
                            ? 'bg-green-500 text-white rounded-br-md' 
                            : 'bg-orange-500 text-white rounded-bl-md'
                          }
                        `}>
                          {renderMessageContent(msg.content)}
                          <p className={`text-xs mt-1 ${msg.sender_type === 'admin' ? 'text-green-100' : 'text-orange-100'}`}>
                            {format(new Date(msg.created_date), 'HH:mm', { locale: fr })}
                          </p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>

                <div className="p-4 border-t bg-white shrink-0">
                  <form onSubmit={handleSend} className="flex gap-3">
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={handleImageCapture}
                      className="hidden"
                      id="admin-camera-input"
                      disabled={uploadingImage}
                    />
                    <label htmlFor="admin-camera-input">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 w-12 rounded-xl"
                        disabled={uploadingImage}
                        asChild
                      >
                        <span>
                          <Camera className={`w-5 h-5 ${uploadingImage ? 'animate-pulse' : ''}`} />
                        </span>
                      </Button>
                    </label>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="Écrivez votre réponse..."
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
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-center p-8 hidden lg:flex">
              <div>
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500">Sélectionnez une conversation</p>
              </div>
              </div>
              )}
              </Card>

              {/* Chat Area - Mobile */}
              {selectedConversation && (
              <Card className="col-span-1 border-0 shadow-none rounded-none flex flex-col h-full overflow-hidden lg:hidden">
              <CardHeader className="bg-emerald-500 text-white shrink-0 flex">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setSelectedConversation(null)}
                      className="text-white hover:bg-white/20"
                    >
                      <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <div>
                      <p className="font-semibold text-sm">{getUserName(selectedConversation)}</p>
                      {allUsers.find(u => u.email === selectedConversation)?.phone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => window.location.href = `tel:${allUsers.find(u => u.email === selectedConversation)?.phone}`}
                          className="text-white hover:bg-white/20 h-5 px-2 text-xs mt-0.5 flex items-center gap-1"
                        >
                          <Phone className="w-3 h-3" />
                          {allUsers.find(u => u.email === selectedConversation)?.phone}
                        </Button>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setDeleteConversationEmail(selectedConversation)}
                    className="text-white hover:bg-white/20"
                  >
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </CardTitle>
              </CardHeader>

              <ScrollArea className="flex-1 p-4 min-h-0">
                <div className="space-y-4">
                  {conversations[selectedConversation]?.map((msg) => (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex ${msg.sender_type === 'admin' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`
                        max-w-[80%] rounded-2xl px-4 py-3
                        ${msg.sender_type === 'admin' 
                          ? 'bg-green-500 text-white rounded-br-md' 
                          : 'bg-orange-500 text-white rounded-bl-md'
                        }
                      `}>
                        {renderMessageContent(msg.content)}
                        <p className={`text-xs mt-1 ${msg.sender_type === 'admin' ? 'text-green-100' : 'text-orange-100'}`}>
                          {format(new Date(msg.created_date), 'HH:mm', { locale: fr })}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </ScrollArea>

              <div className="p-4 border-t bg-white shrink-0">
                <form onSubmit={handleSend} className="flex gap-3">
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleImageCapture}
                    className="hidden"
                    id="admin-camera-input-mobile"
                    disabled={uploadingImage}
                  />
                  <label htmlFor="admin-camera-input-mobile">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-12 w-12 rounded-xl"
                      disabled={uploadingImage}
                      asChild
                    >
                      <span>
                        <Camera className={`w-5 h-5 ${uploadingImage ? 'animate-pulse' : ''}`} />
                      </span>
                    </Button>
                  </label>
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Écrivez votre réponse..."
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
              )}

              {/* Delete Conversation Dialog */}
      <AlertDialog open={!!deleteConversationEmail} onOpenChange={() => setDeleteConversationEmail(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Supprimer la conversation
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer cette conversation avec <strong>{getUserName(deleteConversationEmail)}</strong> ?
              <br />
              Tous les messages seront définitivement supprimés. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConversationMutation.mutate(deleteConversationEmail)}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete All Conversations Dialog */}
      <AlertDialog open={showDeleteAllDialog} onOpenChange={setShowDeleteAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-rose-500" />
              Supprimer toutes les conversations
            </AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer <strong>TOUTES les conversations</strong> ?
              <br />
              Cette action supprimera définitivement tous les messages de tous les clients. Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteAllConversationsMutation.mutate()}
              className="bg-rose-500 hover:bg-rose-600"
            >
              Supprimer tout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-4xl p-2">
          <img 
            src={imagePreview} 
            alt="Aperçu" 
            className="w-full h-auto rounded-lg"
          />
          <Button
            onClick={() => window.open(imagePreview, '_blank')}
            className="mt-4 w-full bg-emerald-500 hover:bg-emerald-600"
          >
            <Download className="w-4 h-4 mr-2" />
            Télécharger l'image
          </Button>
        </DialogContent>
        </Dialog>
        </div>
        );
        }