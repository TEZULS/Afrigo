import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ChefHat, Search, ArrowLeft, ImageOff, PlayCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { createPageUrl } from '@/utils';

export default function Recipes() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchQuery, setSearchQuery] = useState('');

  const selectedCountry = searchParams.get('country');
  const selectedRecipeId = searchParams.get('recipe');

  const { data: recipes = [], isLoading } = useQuery({
    queryKey: ['recipes'],
    queryFn: () => base44.entities.Recipe.list('-created_date')
  });

  const visibleRecipes = recipes.filter(r => r.is_active !== false);

  const countryKey = (recipe) => recipe.country_code || recipe.country_name || 'AUTRE';

  // Regroupement des recettes par pays
  const countries = Object.values(
    visibleRecipes.reduce((acc, recipe) => {
      const code = countryKey(recipe);
      if (!acc[code]) {
        acc[code] = {
          code,
          name: recipe.country_name || recipe.country_code || 'Autre',
          flag: recipe.country_flag || '',
          count: 0
        };
      }
      acc[code].count += 1;
      return acc;
    }, {})
  ).sort((a, b) => a.name.localeCompare(b.name));

  const goToCountry = (code) => {
    setSearchQuery('');
    setSearchParams({ country: code });
  };

  const goToRecipe = (recipe) => {
    setSearchParams({ country: countryKey(recipe), recipe: recipe.id });
  };

  const backToCountries = () => {
    setSearchQuery('');
    setSearchParams({});
  };

  const backToCountry = () => {
    setSearchParams({ country: selectedCountry });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // ---------- Détail d'une recette ----------
  const recipe = selectedRecipeId ? visibleRecipes.find(r => r.id === selectedRecipeId) : null;

  if (recipe) {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-3xl mx-auto">
          <button
            onClick={backToCountry}
            className="inline-flex items-center text-slate-600 hover:text-orange-600 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour aux recettes
          </button>

          <div className="mb-6">
            <p className="text-sm text-slate-500 mb-1">
              {recipe.country_flag} {recipe.country_name}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{recipe.title}</h1>
          </div>

          {recipe.images?.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
              {recipe.images.map((url, index) => (
                <img
                  key={index}
                  src={url}
                  alt={`${recipe.title} ${index + 1}`}
                  className="w-full h-56 object-cover rounded-2xl border border-slate-200"
                  loading="lazy"
                />
              ))}
            </div>
          )}

          {recipe.videos?.length > 0 && (
            <div className="space-y-3 mb-6">
              {recipe.videos.map((url, index) => (
                <video
                  key={index}
                  src={url}
                  controls
                  playsInline
                  className="w-full rounded-2xl border border-slate-200 bg-black"
                />
              ))}
            </div>
          )}

          {recipe.description && (
            <Card className="rounded-2xl border-slate-200">
              <CardContent className="p-5">
                <p className="text-slate-700 whitespace-pre-line leading-relaxed">
                  {recipe.description}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ---------- Recettes d'un pays ----------
  if (selectedCountry) {
    const country = countries.find(c => c.code === selectedCountry);
    const countryRecipes = visibleRecipes.filter(r => countryKey(r) === selectedCountry);
    const filteredRecipes = countryRecipes.filter(r =>
      !searchQuery || r.title?.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-8">
        <div className="max-w-5xl mx-auto">
          <button
            onClick={backToCountries}
            className="inline-flex items-center text-slate-600 hover:text-orange-600 mb-6"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Tous les pays
          </button>

          <div className="flex items-center gap-3 mb-6">
            <span className="text-3xl">{country?.flag}</span>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-slate-900">
                Les recettes de {country?.name || selectedCountry}
              </h1>
              <p className="text-slate-500 text-sm">{countryRecipes.length} recette(s)</p>
            </div>
          </div>

          <div className="relative mb-6">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              type="text"
              placeholder="Rechercher une recette..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-12 rounded-xl border-slate-200 bg-white"
            />
          </div>

          {filteredRecipes.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              Aucune recette trouvée
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRecipes.map((r, index) => {
                const cover = r.images?.[0];
                return (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                  >
                    <Card
                      onClick={() => goToRecipe(r)}
                      className="rounded-2xl border-slate-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow h-full"
                    >
                      <div className="h-40 bg-slate-100 flex items-center justify-center">
                        {cover ? (
                          <img src={cover} alt={r.title} className="w-full h-full object-cover" loading="lazy" />
                        ) : r.videos?.length > 0 ? (
                          <PlayCircle className="w-10 h-10 text-slate-400" />
                        ) : (
                          <ImageOff className="w-8 h-8 text-slate-300" />
                        )}
                      </div>
                      <CardContent className="p-4">
                        <h3 className="font-semibold text-slate-900">{r.title}</h3>
                        {r.description && (
                          <p className="text-sm text-slate-500 line-clamp-2 mt-1 whitespace-pre-line">
                            {r.description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ---------- Liste des pays ----------
  const filteredCountries = countries.filter(c =>
    !searchQuery || c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <Link to={createPageUrl('Home')} className="inline-flex items-center text-slate-600 hover:text-orange-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Link>

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
            <ChefHat className="w-6 h-6 text-orange-500" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Recettes d'Afrique</h1>
            <p className="text-slate-500">Découvrez les saveurs du continent</p>
          </div>
        </div>

        {/* Recherche */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Rechercher un pays..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 h-12 rounded-xl border-slate-200 bg-white"
          />
        </div>

        {filteredCountries.length === 0 ? (
          <div className="text-center py-16">
            <ChefHat className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500">Aucune recette disponible pour le moment</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {filteredCountries.map((country, index) => (
              <motion.div
                key={country.code}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card
                  onClick={() => goToCountry(country.code)}
                  className="rounded-2xl border-slate-200 cursor-pointer hover:shadow-lg transition-shadow h-full"
                >
                  <CardContent className="p-5">
                    <div className="text-4xl mb-3">{country.flag}</div>
                    <h3 className="font-semibold text-slate-900">Les recettes de {country.name}</h3>
                    <p className="text-sm text-slate-500 mt-1">{country.count} recette(s)</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
