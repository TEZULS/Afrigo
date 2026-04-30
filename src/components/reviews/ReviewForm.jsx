import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';

export default function ReviewForm({ productId, productName, onSubmit, onCancel, isGeneralReview = false }) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    setSubmitting(true);
    await onSubmit({ rating, comment });
    setSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-600 mb-3">
          {isGeneralReview ? 'Votre note globale' : 'Votre note'}
        </p>
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              onClick={() => setRating(star)}
              onMouseEnter={() => setHoveredRating(star)}
              onMouseLeave={() => setHoveredRating(0)}
              className="transition-transform hover:scale-110"
            >
              <Star
                className={`w-10 h-10 ${
                  star <= (hoveredRating || rating)
                    ? 'fill-yellow-400 text-yellow-400'
                    : 'text-slate-300'
                }`}
              />
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-sm text-slate-600 mb-2">Votre commentaire (optionnel)</p>
        <Textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={
            isGeneralReview
              ? "Partagez votre expérience : qualité des produits, rapidité de livraison, service client..."
              : "Partagez votre expérience avec ce produit..."
          }
          className="rounded-xl min-h-[120px]"
        />
      </div>

      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={onCancel}
          className="flex-1 h-12 rounded-xl"
        >
          Annuler
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={rating === 0 || submitting}
          className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
        >
          {submitting ? 'Envoi...' : 'Publier l\'avis'}
        </Button>
      </div>
    </div>
  );
}