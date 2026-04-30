import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from 'lucide-react';
import ReviewCard from './ReviewCard';

export default function ProductReviews({ reviews }) {
  // Filtrer les avis visibles uniquement
  const visibleReviews = reviews?.filter(r => r.is_visible !== false) || [];
  
  if (!visibleReviews || visibleReviews.length === 0) {
    return (
      <Card className="border-0 shadow-sm rounded-2xl">
        <CardHeader>
          <CardTitle>Avis clients</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-slate-500 text-center py-8">
            Aucun avis pour le moment. Soyez le premier à donner votre avis !
          </p>
        </CardContent>
      </Card>
    );
  }

  const avgRating = visibleReviews.reduce((sum, r) => sum + r.rating, 0) / visibleReviews.length;

  return (
    <Card className="border-0 shadow-sm rounded-2xl">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Avis clients</span>
          <div className="flex items-center gap-2">
            <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
            <span className="text-lg font-bold">{avgRating.toFixed(1)}</span>
            <span className="text-sm text-slate-500">({visibleReviews.length} avis)</span>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {visibleReviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </CardContent>
    </Card>
  );
}