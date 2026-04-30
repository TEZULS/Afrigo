import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Search, Trash2, Package, User, Calendar, MessageSquare, Eye, EyeOff, Reply } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

export default function AdminReviews() {
  const [user, setUser] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('all');
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [reviewToDelete, setReviewToDelete] = useState(null);
  const [responseDialogOpen, setResponseDialogOpen] = useState(false);
  const [currentReview, setCurrentReview] = useState(null);
  const [adminResponse, setAdminResponse] = useState('');
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u?.role !== 'admin') {
        navigate(createPageUrl('Home'));
      }
    });
  }, [navigate]);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => base44.entities.Review.list('-created_date')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  const { data: orders = [] } = useQuery({
    queryKey: ['orders'],
    queryFn: () => base44.entities.Order.list()
  });

  const deleteReviewMutation = useMutation({
    mutationFn: (reviewId) => base44.entities.Review.delete(reviewId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setDeleteDialogOpen(false);
      setReviewToDelete(null);
      toast.success('Avis supprimé');
    },
    onError: () => {
      toast.error('Erreur lors de la suppression');
    }
  });

  const toggleVisibilityMutation = useMutation({
    mutationFn: ({ reviewId, isVisible }) => 
      base44.entities.Review.update(reviewId, { is_visible: isVisible }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      toast.success('Visibilité mise à jour');
    },
    onError: () => {
      toast.error('Erreur lors de la mise à jour');
    }
  });

  const respondToReviewMutation = useMutation({
    mutationFn: ({ reviewId, response }) => 
      base44.entities.Review.update(reviewId, { admin_response: response }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      setResponseDialogOpen(false);
      setCurrentReview(null);
      setAdminResponse('');
      toast.success('Réponse publiée');
    },
    onError: () => {
      toast.error('Erreur lors de la publication');
    }
  });

  const filteredReviews = reviews.filter(review => {
    const product = products.find(p => p.id === review.product_id);
    const matchesSearch = !searchQuery || 
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.comment?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRating = filterRating === 'all' || review.rating === parseInt(filterRating);
    
    return matchesSearch && matchesRating;
  });

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: reviews.filter(r => r.rating === rating).length
  }));

  if (!user || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Gestion des avis clients</h1>
              <p className="text-slate-500">Consultez et modérez les avis laissés par vos clients</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Total avis</p>
                    <p className="text-3xl font-bold text-slate-800">{reviews.length}</p>
                  </div>
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Note moyenne</p>
                    <div className="flex items-center gap-2">
                      <p className="text-3xl font-bold text-slate-800">{averageRating}</p>
                      <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
                    </div>
                  </div>
                  <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-amber-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">5 étoiles</p>
                    <p className="text-3xl font-bold text-slate-800">
                      {ratingCounts.find(r => r.rating === 5)?.count || 0}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                    <Star className="w-6 h-6 text-green-600 fill-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Avec commentaire</p>
                    <p className="text-3xl font-bold text-slate-800">
                      {reviews.filter(r => r.comment).length}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <MessageSquare className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input
                    placeholder="Rechercher par produit, client ou commentaire..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 rounded-xl"
                  />
                </div>
                <Select value={filterRating} onValueChange={setFilterRating}>
                  <SelectTrigger className="w-full md:w-48 h-12 rounded-xl">
                    <SelectValue placeholder="Filtrer par note" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes les notes</SelectItem>
                    <SelectItem value="5">5 étoiles</SelectItem>
                    <SelectItem value="4">4 étoiles</SelectItem>
                    <SelectItem value="3">3 étoiles</SelectItem>
                    <SelectItem value="2">2 étoiles</SelectItem>
                    <SelectItem value="1">1 étoile</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Reviews List */}
        <div className="space-y-4">
          {filteredReviews.length === 0 ? (
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-12 text-center">
                <MessageSquare className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                <p className="text-slate-500">Aucun avis trouvé</p>
              </CardContent>
            </Card>
          ) : (
            filteredReviews.map(review => {
              const product = products.find(p => p.id === review.product_id);
              const order = orders.find(o => o.id === review.order_id);
              
              return (
                <Card key={review.id} className="border-0 shadow-lg rounded-2xl">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        {/* Rating */}
                        <div className="flex items-center gap-2 mb-3">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-5 h-5 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                            />
                          ))}
                          <span className="font-semibold text-slate-800 ml-2">
                            {review.rating}/5
                          </span>
                          <Badge variant="outline" className="ml-2">
                            {format(new Date(review.created_date), 'dd MMM yyyy', { locale: fr })}
                          </Badge>
                        </div>

                        {/* Product and Customer Info */}
                        <div className="flex flex-wrap gap-4 mb-3">
                          <div className="flex items-center gap-2">
                            <Package className="w-4 h-4 text-slate-400" />
                            <span className="font-medium text-slate-800">
                              {product?.name || 'Produit supprimé'}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-400" />
                            <span className="text-slate-600">
                              {review.customer_name || review.customer_email}
                            </span>
                          </div>
                          {order && (
                            <div className="flex items-center gap-2">
                              <Calendar className="w-4 h-4 text-slate-400" />
                              <span className="text-slate-600 text-sm">
                                Commande #{order.id.slice(-8).toUpperCase()}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Comment */}
                        {review.comment && (
                          <div className="p-4 bg-slate-50 rounded-xl">
                            <p className="text-slate-700 italic">"{review.comment}"</p>
                          </div>
                        )}

                        {/* Admin Response */}
                        {review.admin_response && (
                          <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-xl mt-3">
                            <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center gap-1">
                              <Reply className="w-3 h-3" />
                              RÉPONSE DE L'ADMINISTRATEUR
                            </p>
                            <p className="text-sm text-blue-800">{review.admin_response}</p>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2 p-2 bg-slate-50 rounded-lg">
                          <Label htmlFor={`visible-${review.id}`} className="text-xs cursor-pointer">
                            {review.is_visible !== false ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-slate-400" />
                            )}
                          </Label>
                          <Switch
                            id={`visible-${review.id}`}
                            checked={review.is_visible !== false}
                            onCheckedChange={(checked) => {
                              toggleVisibilityMutation.mutate({ 
                                reviewId: review.id, 
                                isVisible: checked 
                              });
                            }}
                          />
                        </div>
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setCurrentReview(review);
                            setAdminResponse(review.admin_response || '');
                            setResponseDialogOpen(true);
                          }}
                          className="text-blue-500 hover:text-blue-700 hover:bg-blue-50 rounded-xl"
                        >
                          <Reply className="w-5 h-5" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setReviewToDelete(review);
                            setDeleteDialogOpen(true);
                          }}
                          className="text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl"
                        >
                          <Trash2 className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supprimer cet avis ?</DialogTitle>
              <DialogDescription>
                Cette action est irréversible. L'avis sera définitivement supprimé.
              </DialogDescription>
            </DialogHeader>
            {reviewToDelete && (
              <div className="p-4 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-1 mb-2">
                  {[...Array(5)].map((_, i) => (
                    <Star 
                      key={i} 
                      className={`w-4 h-4 ${i < reviewToDelete.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                    />
                  ))}
                </div>
                {reviewToDelete.comment && (
                  <p className="text-sm text-slate-600 italic">"{reviewToDelete.comment}"</p>
                )}
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDeleteDialogOpen(false);
                  setReviewToDelete(null);
                }}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                onClick={() => deleteReviewMutation.mutate(reviewToDelete.id)}
                disabled={deleteReviewMutation.isPending}
                className="bg-rose-600 hover:bg-rose-700 rounded-xl"
              >
                {deleteReviewMutation.isPending ? 'Suppression...' : 'Supprimer'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Response Dialog */}
        <Dialog open={responseDialogOpen} onOpenChange={setResponseDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Répondre à l'avis</DialogTitle>
              <DialogDescription>
                Votre réponse sera visible publiquement sous l'avis du client.
              </DialogDescription>
            </DialogHeader>
            {currentReview && (
              <div className="space-y-4">
                <div className="p-4 bg-slate-50 rounded-xl">
                  <div className="flex items-center gap-1 mb-2">
                    {[...Array(5)].map((_, i) => (
                      <Star 
                        key={i} 
                        className={`w-4 h-4 ${i < currentReview.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                      />
                    ))}
                  </div>
                  <p className="text-sm font-medium text-slate-800 mb-1">{currentReview.customer_name}</p>
                  {currentReview.comment && (
                    <p className="text-sm text-slate-600 italic">"{currentReview.comment}"</p>
                  )}
                </div>
                
                <div>
                  <Label htmlFor="admin-response">Votre réponse</Label>
                  <Textarea
                    id="admin-response"
                    value={adminResponse}
                    onChange={(e) => setAdminResponse(e.target.value)}
                    placeholder="Écrivez votre réponse au client..."
                    className="mt-2 min-h-[120px]"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setResponseDialogOpen(false);
                  setCurrentReview(null);
                  setAdminResponse('');
                }}
                className="rounded-xl"
              >
                Annuler
              </Button>
              <Button
                onClick={() => respondToReviewMutation.mutate({ 
                  reviewId: currentReview.id, 
                  response: adminResponse 
                })}
                disabled={respondToReviewMutation.isPending || !adminResponse.trim()}
                className="bg-blue-600 hover:bg-blue-700 rounded-xl"
              >
                {respondToReviewMutation.isPending ? 'Publication...' : 'Publier la réponse'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}