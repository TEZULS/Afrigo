import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Star, Search, Package, User, MessageSquare, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AllReviews() {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('all');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews'],
    queryFn: () => base44.entities.Review.list('-created_date')
  });

  const { data: products = [] } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list()
  });

  // Filtrer uniquement les avis visibles
  const visibleReviews = reviews.filter(r => r.is_visible !== false);

  const filteredReviews = visibleReviews.filter(review => {
    const product = products.find(p => p.id === review.product_id);
    const matchesSearch = !searchQuery || 
      product?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.customer_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      review.comment?.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesRating = filterRating === 'all' || review.rating === parseInt(filterRating);
    
    return matchesSearch && matchesRating;
  });

  const averageRating = visibleReviews.length > 0 
    ? (visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length).toFixed(1)
    : 0;

  const ratingCounts = [5, 4, 3, 2, 1].map(rating => ({
    rating,
    count: visibleReviews.filter(r => r.rating === rating).length
  }));

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Link>
        
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <Star className="w-6 h-6 text-amber-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-slate-800">Avis clients</h1>
              <p className="text-slate-500">Découvrez les retours de nos clients sur nos produits</p>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Note moyenne</p>
                  <div className="flex items-center justify-center gap-2">
                    <p className="text-3xl font-bold text-slate-800">{averageRating}</p>
                    <Star className="w-6 h-6 fill-amber-500 text-amber-500" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Total avis</p>
                  <p className="text-3xl font-bold text-slate-800">{visibleReviews.length}</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">5 étoiles</p>
                  <p className="text-3xl font-bold text-green-600">
                    {ratingCounts.find(r => r.rating === 5)?.count || 0}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-lg rounded-2xl">
              <CardContent className="p-6">
                <div className="text-center">
                  <p className="text-sm text-slate-500 mb-1">Avec commentaire</p>
                  <p className="text-3xl font-bold text-blue-600">
                    {visibleReviews.filter(r => r.comment).length}
                  </p>
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
                    placeholder="Rechercher par produit ou client..."
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
                    <SelectItem value="5">5 étoiles ⭐⭐⭐⭐⭐</SelectItem>
                    <SelectItem value="4">4 étoiles ⭐⭐⭐⭐</SelectItem>
                    <SelectItem value="3">3 étoiles ⭐⭐⭐</SelectItem>
                    <SelectItem value="2">2 étoiles ⭐⭐</SelectItem>
                    <SelectItem value="1">1 étoile ⭐</SelectItem>
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
              
              return (
                <Card key={review.id} className="border-0 shadow-lg rounded-2xl hover:shadow-xl transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Product Image */}
                      {product?.image_url && (
                        <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
                          <img 
                            src={product.image_url} 
                            alt={product.name}
                            className="w-20 h-20 object-cover rounded-xl cursor-pointer hover:opacity-80 transition-opacity"
                          />
                        </Link>
                      )}

                      <div className="flex-1">
                        {/* Rating */}
                        <div className="flex items-center gap-2 mb-2">
                          {[...Array(5)].map((_, i) => (
                            <Star 
                              key={i} 
                              className={`w-5 h-5 ${i < review.rating ? 'fill-amber-500 text-amber-500' : 'text-slate-300'}`}
                            />
                          ))}
                          <span className="text-sm text-slate-500 ml-2">
                            {format(new Date(review.created_date), 'dd MMM yyyy', { locale: fr })}
                          </span>
                        </div>

                        {/* Product Name */}
                        {product && (
                          <Link to={createPageUrl(`ProductDetails?id=${product.id}`)}>
                            <div className="flex items-center gap-2 mb-2 hover:text-blue-600 transition-colors">
                              <Package className="w-4 h-4 text-slate-400" />
                              <span className="font-semibold text-slate-800">{product.name}</span>
                            </div>
                          </Link>
                        )}

                        {/* Customer Name */}
                        <div className="flex items-center gap-2 mb-3">
                          <User className="w-4 h-4 text-slate-400" />
                          <span className="text-sm text-slate-600">{review.customer_name || 'Client vérifié'}</span>
                        </div>

                        {/* Comment */}
                        {review.comment && (
                          <div className="p-4 bg-slate-50 rounded-xl mb-3">
                            <p className="text-slate-700 leading-relaxed">"{review.comment}"</p>
                          </div>
                        )}

                        {/* Admin Response */}
                        {review.admin_response && (
                          <div className="p-4 bg-blue-50 border-l-4 border-blue-500 rounded-xl">
                            <p className="text-xs font-semibold text-blue-900 mb-1">Réponse du vendeur</p>
                            <p className="text-sm text-blue-800">{review.admin_response}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}