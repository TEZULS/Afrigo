import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Star, User } from 'lucide-react';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function ReviewCard({ review }) {
  return (
    <Card className="border-0 bg-slate-50 rounded-xl">
      <CardContent className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
              <User className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="font-medium text-slate-800">{review.customer_name || 'Client'}</p>
              <div className="flex items-center gap-1 mt-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className={`w-4 h-4 ${
                      i < review.rating
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-slate-300'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            {format(new Date(review.created_date), 'dd MMM yyyy', { locale: fr })}
          </span>
        </div>
        {review.comment && (
          <p className="text-slate-600 text-sm leading-relaxed">{review.comment}</p>
        )}
        {review.admin_response && (
          <div className="mt-3 p-3 bg-blue-50 border-l-4 border-blue-500 rounded-lg">
            <p className="text-xs font-semibold text-blue-900 mb-1">Réponse du vendeur</p>
            <p className="text-sm text-blue-800">{review.admin_response}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}