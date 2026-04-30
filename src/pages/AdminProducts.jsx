import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { 
  Package, Plus, Pencil, Trash2, Search, 
  AlertTriangle, Percent, ArrowLeft
} from 'lucide-react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { toast } from 'sonner';
import { countries } from '@/components/data/countries';

const FOOD_CATEGORIES = [
  { id: 'fruits_legumes', label: 'Fruits & Légumes' },
  { id: 'viandes_poissons', label: 'Viandes & Poissons' },
  { id: 'produits_laitiers', label: 'Produits Laitiers' },
  { id: 'epices', label: 'Épices' },
  { id: 'boissons', label: 'Boissons' },
  { id: 'surgeles', label: 'Surgelés' },
  { id: 'entretien', label: 'Entretien' },
  { id: 'sec', label: 'Sec' },
  { id: 'frais', label: 'Frais' },
];

const COSMETIQUE_CATEGORIES = [
  { id: 'cosmetique', label: 'Cosmétique' },
];

const categories = [...FOOD_CATEGORIES, ...COSMETIQUE_CATEGORIES];

const units = [
  { id: 'piece', label: 'Pièce' },
  { id: 'unite', label: 'Unité' },
  { id: 'kg', label: 'Kilogramme (kg)' },
  { id: 'litre', label: 'Litre (L)' },
  { id: 'metre', label: 'Mètre (m)' },
  { id: 'bouteille', label: 'Bouteille' },
  { id: 'pack', label: 'Pack' },
  { id: 'lot', label: 'Lot' },
  { id: 'carton', label: 'Carton' },
  { id: 'sac', label: 'Sac' },
  { id: 'sache', label: 'Sachet' },
  { id: 'boite', label: 'Boîte' },
];



export default function AdminProducts() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    price: '',
    is_free: false,
    free_product_min_purchase: 15,
    free_product_limit_per_customer: 1,
    allowed_tiers: ['normal', 'argent', 'or', 'diamant'],
    featured_groups: [],
    category: '',
    country_of_origin: '',
    image_url: '',
    images: [],
    stock_quantity: '',
    stock_unit: 'unite',
    unit: 'piece',
    variants: [],
    is_promotion: false,
    promotion_price: '',
    promotion_end_date: '',
    expiration_date: '',
    purchase_count: 0,
    purchase_count_message: 'personnes ont acheté ce produit',
    show_purchase_count: false
  });
  const [productZone, setProductZone] = useState('food'); // 'food' | 'cosmetique'
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newVariant, setNewVariant] = useState({ type: 'taille', value: '', price_modifier: 0, promotion_price: '', image_url: '', stock_quantity: 0 });
  const [selectedColors, setSelectedColors] = useState([]);
  const [countrySearch, setCountrySearch] = useState('');
  const [variantImageUploading, setVariantImageUploading] = useState(false);
  const [editingVariantIndex, setEditingVariantIndex] = useState(null);
  const [mainImageUploading, setMainImageUploading] = useState(false);
  const [additionalImagesUploading, setAdditionalImagesUploading] = useState(false);

  const predefinedColors = [
    { name: 'Rouge', code: '#FF0000' },
    { name: 'Rouge foncé', code: '#8B0000' },
    { name: 'Rouge clair', code: '#FF6B6B' },
    { name: 'Bordeaux', code: '#800020' },
    { name: 'Framboise', code: '#C72C48' },
    { name: 'Cerise', code: '#DE3163' },
    { name: 'Corail', code: '#FF7F50' },
    { name: 'Saumon', code: '#FA8072' },
    { name: 'Rose', code: '#FF69B4' },
    { name: 'Rose pâle', code: '#FFB6C1' },
    { name: 'Rose bonbon', code: '#FF1493' },
    { name: 'Fuchsia', code: '#FF00FF' },
    { name: 'Magenta', code: '#FF00AA' },
    { name: 'Orange', code: '#FF8C00' },
    { name: 'Orange vif', code: '#FF6600' },
    { name: 'Orange clair', code: '#FFA500' },
    { name: 'Pêche', code: '#FFDAB9' },
    { name: 'Abricot', code: '#FFCC99' },
    { name: 'Jaune', code: '#FFFF00' },
    { name: 'Jaune doré', code: '#FFD700' },
    { name: 'Jaune citron', code: '#FFFF66' },
    { name: 'Jaune pâle', code: '#FFFFCC' },
    { name: 'Moutarde', code: '#FFDB58' },
    { name: 'Or', code: '#FFD700' },
    { name: 'Vert', code: '#00FF00' },
    { name: 'Vert foncé', code: '#006400' },
    { name: 'Vert clair', code: '#90EE90' },
    { name: 'Vert menthe', code: '#98FF98' },
    { name: 'Vert lime', code: '#32CD32' },
    { name: 'Vert forêt', code: '#228B22' },
    { name: 'Vert olive', code: '#808000' },
    { name: 'Kaki', code: '#8B864E' },
    { name: 'Vert émeraude', code: '#50C878' },
    { name: 'Turquoise', code: '#40E0D0' },
    { name: 'Cyan', code: '#00FFFF' },
    { name: 'Bleu ciel', code: '#87CEEB' },
    { name: 'Bleu', code: '#0000FF' },
    { name: 'Bleu foncé', code: '#00008B' },
    { name: 'Bleu roi', code: '#4169E1' },
    { name: 'Bleu marine', code: '#000080' },
    { name: 'Bleu nuit', code: '#191970' },
    { name: 'Bleu électrique', code: '#7DF9FF' },
    { name: 'Bleu cobalt', code: '#0047AB' },
    { name: 'Indigo', code: '#4B0082' },
    { name: 'Violet', code: '#8B00FF' },
    { name: 'Violet foncé', code: '#9400D3' },
    { name: 'Violet clair', code: '#EE82EE' },
    { name: 'Lavande', code: '#E6E6FA' },
    { name: 'Prune', code: '#8E4585' },
    { name: 'Pourpre', code: '#800080' },
    { name: 'Marron', code: '#8B4513' },
    { name: 'Marron foncé', code: '#654321' },
    { name: 'Marron clair', code: '#A0522D' },
    { name: 'Chocolat', code: '#D2691E' },
    { name: 'Caramel', code: '#C68E17' },
    { name: 'Beige', code: '#F5F5DC' },
    { name: 'Crème', code: '#FFFDD0' },
    { name: 'Ivoire', code: '#FFFFF0' },
    { name: 'Blanc', code: '#FFFFFF' },
    { name: 'Blanc cassé', code: '#F8F8FF' },
    { name: 'Gris clair', code: '#D3D3D3' },
    { name: 'Gris', code: '#808080' },
    { name: 'Gris foncé', code: '#555555' },
    { name: 'Gris anthracite', code: '#2F4F4F' },
    { name: 'Argent', code: '#C0C0C0' },
    { name: 'Noir', code: '#000000' },
  ];


  const scrollPositionRef = React.useRef(0);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u.role !== 'admin') {
        navigate(createPageUrl('Home'));
      } else {
        setUser(u);
      }
    }).catch(() => navigate(createPageUrl('Home')))
    .finally(() => setLoading(false));
  }, [navigate]);

  const { data: products = [], isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => base44.entities.Product.list(),
    enabled: !!user
  });

  const createProductMutation = useMutation({
    mutationFn: (data) => base44.entities.Product.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setDialogOpen(false);
      resetForm();
      toast.success('Produit créé avec succès');
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Product.update(id, data),
    onSuccess: () => {
      const savedScroll = scrollPositionRef.current;
      setDialogOpen(false);
      resetForm();
      toast.success('Produit mis à jour');
      queryClient.invalidateQueries({ queryKey: ['products'] }).then(() => {
        // Sauvegarder dans sessionStorage pour que le Layout ne l'écrase pas
        sessionStorage.setItem(`scrollPos:${window.location.pathname}`, savedScroll.toString());
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            window.scrollTo({ top: savedScroll, behavior: 'instant' });
          });
        });
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: (id) => base44.entities.Product.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success('Produit supprimé');
    }
  });

  const resetForm = () => {
    setProductZone('food');
    setFormData({
      name: '',
      description: '',
      price: '',
      is_free: false,
      free_product_min_purchase: 15,
      free_product_limit_per_customer: 1,
      allowed_tiers: ['normal', 'argent', 'or', 'diamant'],
      featured_groups: [],
      category: '',
      country_of_origin: '',
      image_url: '',
      images: [],
      stock_quantity: '',
      stock_unit: 'unite',
      unit: 'piece',
      variants: [],
      is_promotion: false,
      promotion_price: '',
      promotion_end_date: '',
      expiration_date: '',
      purchase_count: 0,
      purchase_count_message: 'personnes ont acheté ce produit',
      show_purchase_count: false
    });
    setEditingProduct(null);
    setNewImageUrl('');
    setNewVariant({ type: 'taille', value: '', price_modifier: 0, promotion_price: '', image_url: '', stock_quantity: 0 });
    setVariantImageUploading(false);
    setEditingVariantIndex(null);
    };

  const handleEdit = (product) => {
    scrollPositionRef.current = window.scrollY;
    setProductZone(COSMETIQUE_CATEGORIES.some(c => c.id === product.category) ? 'cosmetique' : 'food');
    setEditingProduct(product);
    setFormData({
      name: product.name || '',
      description: product.description || '',
      price: product.price?.toString() || '',
      is_free: product.is_free || false,
      free_product_min_purchase: product.free_product_min_purchase || 15,
      free_product_limit_per_customer: product.free_product_limit_per_customer || 1,
      allowed_tiers: product.allowed_tiers || ['normal', 'argent', 'or', 'diamant'],
      featured_groups: product.featured_groups || [],
      category: product.category || '',
      country_of_origin: product.country_of_origin || '',
      image_url: product.image_url || '',
      images: product.images || [],
      stock_quantity: product.stock_quantity?.toString() || '',
      stock_unit: product.stock_unit || 'unite',
      unit: product.unit || 'piece',
      variants: product.variants || [],
      is_promotion: product.is_promotion || false,
      promotion_price: product.promotion_price?.toString() || '',
      promotion_end_date: product.promotion_end_date || '',
      expiration_date: product.expiration_date || '',
      purchase_count: product.purchase_count || 0,
      purchase_count_message: product.purchase_count_message || 'personnes ont acheté ce produit',
      show_purchase_count: product.show_purchase_count || false
    });
    setDialogOpen(true);
  };

  const handleSubmit = () => {
    const productData = {
      ...formData,
      price: parseFloat(formData.price),
      stock_quantity: parseInt(formData.stock_quantity),
      promotion_price: formData.promotion_price ? parseFloat(formData.promotion_price) : null,
      free_product_min_purchase: formData.is_free ? parseFloat(formData.free_product_min_purchase) : null,
      free_product_limit_per_customer: formData.is_free ? parseInt(formData.free_product_limit_per_customer) : null
    };

    if (editingProduct) {
      updateProductMutation.mutate({ id: editingProduct.id, data: productData });
    } else {
      createProductMutation.mutate(productData);
    }
  };

  const getProductStatus = (product) => {
    if (product.stock_quantity <= 0) return 'out_of_stock';
    if (product.stock_quantity <= 5) return 'low_stock';
    
    // Vérifier l'expiration
    if (product.expiration_date) {
      const today = new Date();
      const expiration = new Date(product.expiration_date);
      const diffTime = expiration - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 14) return 'expiring_soon';
      if (diffDays <= 30) return 'expiring_month';
    }
    
    if (product.is_promotion && product.promotion_price) return 'promotion';
    return 'in_stock';
  };

  const filteredProducts = products
    .filter(p => {
      const matchesSearch = p.name?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesStatus = statusFilter === 'all' || getProductStatus(p) === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((a, b) => {
      // Priorité 1: Rupture de stock (0)
      const aOutOfStock = a.stock_quantity <= 0;
      const bOutOfStock = b.stock_quantity <= 0;
      
      // Priorité 2: Stock faible (1-5)
      const aLowStock = a.stock_quantity > 0 && a.stock_quantity <= 5;
      const bLowStock = b.stock_quantity > 0 && b.stock_quantity <= 5;
      
      // Priorité 3: En promotion
      const aPromo = a.is_promotion && a.promotion_price && a.stock_quantity > 5;
      const bPromo = b.is_promotion && b.promotion_price && b.stock_quantity > 5;
      
      // Priorité 4: En stock (>5)
      const aInStock = a.stock_quantity > 5 && (!a.is_promotion || !a.promotion_price);
      const bInStock = b.stock_quantity > 5 && (!b.is_promotion || !b.promotion_price);
      
      // Rupture de stock en premier
      if (aOutOfStock && !bOutOfStock) return -1;
      if (!aOutOfStock && bOutOfStock) return 1;
      
      // Stock faible ensuite
      if (aLowStock && !bLowStock) return -1;
      if (!aLowStock && bLowStock) return 1;
      
      // En promotion après
      if (aPromo && !bPromo) return -1;
      if (!aPromo && bPromo) return 1;
      
      // En stock en dernier
      if (aInStock && !bInStock) return -1;
      if (!aInStock && bInStock) return 1;
      
      return 0;
    });

  if (loading || isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
              <Package className="w-6 h-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800">Gestion des produits</h1>
              <p className="text-slate-500">{products.length} produits</p>
            </div>
          </div>

          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button className="bg-emerald-500 hover:bg-emerald-600 rounded-xl">
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un produit
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingProduct ? 'Modifier le produit' : 'Nouveau produit'}
                </DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {/* Sélecteur de zone */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                  <button
                    type="button"
                    onClick={() => { setProductZone('food'); setFormData(f => ({ ...f, category: '' })); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      productZone === 'food' ? 'bg-white shadow text-orange-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <img src="https://cdn-icons-png.flaticon.com/512/3724/3724788.png" alt="Alimentation" className="w-5 h-5 object-contain" />
                    Alimentation
                  </button>
                  <button
                    type="button"
                    onClick={() => { setProductZone('cosmetique'); setFormData(f => ({ ...f, category: 'cosmetique' })); }}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg font-semibold text-sm transition-all ${
                      productZone === 'cosmetique' ? 'bg-white shadow text-purple-600' : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    <img src="https://cdn-icons-png.flaticon.com/512/2553/2553651.png" alt="Cosmétiques" className="w-5 h-5 object-contain" />
                    Cosmétiques
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <Label>Nom du produit</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="mt-1"
                    />
                  </div>
                  
                  <div className="col-span-2">
                    <Label>Description</Label>
                    <Textarea
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Prix (€)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.price}
                      onChange={(e) => setFormData({...formData, price: e.target.value})}
                      className="mt-1"
                      disabled={formData.is_free}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label>Produit gratuit</Label>
                    <Switch
                      checked={formData.is_free}
                      onCheckedChange={(checked) => setFormData({...formData, is_free: checked, price: checked ? '0' : formData.price})}
                    />
                  </div>

                  {formData.is_free && (
                    <>
                      <div className="col-span-2">
                        <Label>Montant minimum d'achat (€)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.free_product_min_purchase}
                          onChange={(e) => setFormData({...formData, free_product_min_purchase: parseFloat(e.target.value)})}
                          className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">Montant minimum requis dans le panier pour obtenir ce produit gratuit</p>
                      </div>

                      <div className="col-span-2">
                        <Label>Limite par client</Label>
                        <Input
                          type="number"
                          value={formData.free_product_limit_per_customer}
                          onChange={(e) => setFormData({...formData, free_product_limit_per_customer: parseInt(e.target.value)})}
                          className="mt-1"
                        />
                        <p className="text-xs text-slate-500 mt-1">Nombre maximum de ce produit gratuit qu'un client peut obtenir</p>
                      </div>
                    </>
                  )}

                  <div className="col-span-2 border-t pt-4">
                    <Label className="mb-2 block">Niveaux de clients autorisés</Label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'normal', label: 'Normal', icon: '👤' },
                        { value: 'argent', label: 'Argent ⭐3', icon: '🥈' },
                        { value: 'or', label: 'Or ⭐4', icon: '🥇' },
                        { value: 'diamant', label: 'Diamant ⭐5', icon: '💎' }
                      ].map(tier => (
                        <label key={tier.value} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-slate-50">
                          <input
                            type="checkbox"
                            checked={formData.allowed_tiers?.includes(tier.value)}
                            onChange={(e) => {
                              const tiers = formData.allowed_tiers || [];
                              if (e.target.checked) {
                                setFormData({...formData, allowed_tiers: [...tiers, tier.value]});
                              } else {
                                setFormData({...formData, allowed_tiers: tiers.filter(t => t !== tier.value)});
                              }
                            }}
                            className="rounded"
                          />
                          <span>{tier.icon}</span>
                          <span className="text-sm font-medium">{tier.label}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-slate-500 mt-2">Seuls les clients avec ces niveaux pourront voir et acheter ce produit</p>
                  </div>

                  <div className="col-span-2 border-t pt-4">
                    <Label className="mb-3 block text-base font-semibold">🌟 Groupes de mise en avant</Label>
                    <p className="text-sm text-slate-500 mb-4">Sélectionnez les catégories dans lesquelles mettre en avant ce produit</p>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: 'nouveaute', label: 'Nouveauté', icon: '✨' },
                        { value: 'meilleure_vente', label: 'Meilleure vente', icon: '🔥' },
                        { value: 'coup_de_coeur', label: 'Coup de cœur', icon: '❤️' },
                        { value: 'recommande', label: 'Recommandé', icon: '⭐' },
                        { value: 'bio', label: 'Bio & Local', icon: '🌱' },
                        { value: 'exclusif', label: 'Exclusif', icon: '💎' }
                      ].map(group => (
                        <label key={group.value} className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer hover:bg-emerald-50">
                          <input
                            type="checkbox"
                            checked={formData.featured_groups?.includes(group.value)}
                            onChange={(e) => {
                              const groups = formData.featured_groups || [];
                              if (e.target.checked) {
                                setFormData({...formData, featured_groups: [...groups, group.value]});
                              } else {
                                setFormData({...formData, featured_groups: groups.filter(g => g !== group.value)});
                              }
                            }}
                            className="rounded"
                          />
                          <span className="text-xl">{group.icon}</span>
                          <span className="text-sm font-medium">{group.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <Label>Quantité en stock</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.stock_quantity}
                      onChange={(e) => setFormData({...formData, stock_quantity: e.target.value})}
                      className="mt-1"
                    />
                  </div>

                  <div>
                    <Label>Unité du stock</Label>
                    <Select
                      value={formData.stock_unit || 'unite'}
                      onValueChange={(value) => setFormData({...formData, stock_unit: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="unite">Unité</SelectItem>
                        <SelectItem value="kg">Kilogramme (kg)</SelectItem>
                        <SelectItem value="litre">Litre (L)</SelectItem>
                        <SelectItem value="metre">Mètre (m)</SelectItem>
                        <SelectItem value="lot">Lot</SelectItem>
                        <SelectItem value="carton">Carton</SelectItem>
                        <SelectItem value="pack">Pack</SelectItem>
                        <SelectItem value="sache">Sachet</SelectItem>
                        <SelectItem value="sac">Sac</SelectItem>
                        <SelectItem value="boite">Boîte</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Catégorie</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({...formData, category: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner" />
                      </SelectTrigger>
                      <SelectContent>
                        {(productZone === 'cosmetique' ? COSMETIQUE_CATEGORIES : FOOD_CATEGORIES).map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label>Unité</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(value) => setFormData({...formData, unit: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {units.map(u => (
                          <SelectItem key={u.id} value={u.id}>{u.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label>Pays d'origine</Label>
                    <Select
                      value={formData.country_of_origin}
                      onValueChange={(value) => setFormData({...formData, country_of_origin: value})}
                    >
                      <SelectTrigger className="mt-1">
                        <SelectValue placeholder="Sélectionner un pays" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        <div className="sticky top-0 bg-white p-2 border-b z-10">
                          <Input
                            placeholder="Rechercher un pays..."
                            value={countrySearch}
                            onChange={(e) => setCountrySearch(e.target.value)}
                            className="h-8"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                        {countries
                          .filter(c => c.name.toLowerCase().includes(countrySearch.toLowerCase()))
                          .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
                          .map(country => (
                            <SelectItem key={country.code} value={country.name}>
                              {country.flag} {country.name}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="col-span-2">
                    <Label>Image principale</Label>
                    <div className="space-y-2 mt-1">
                      {mainImageUploading ? (
                        <div className="w-full h-24 flex items-center justify-center bg-emerald-50 border-2 border-emerald-300 rounded-lg">
                          <div className="text-center">
                            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full mx-auto mb-2" />
                            <p className="text-sm text-emerald-700">Upload en cours...</p>
                          </div>
                        </div>
                      ) : formData.image_url ? (
                        <div className="flex items-center gap-4">
                          <div className="relative w-32 h-32 group">
                            <img src={formData.image_url} alt="" className="w-full h-full rounded-lg object-cover border-2 border-emerald-200" />
                            <Button
                              type="button"
                              size="icon"
                              variant="destructive"
                              className="absolute -top-2 -right-2 w-6 h-6"
                              onClick={() => setFormData({...formData, image_url: ''})}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('main-image-input').click()}
                            className="text-sm"
                          >
                            Changer l'image
                          </Button>
                        </div>
                      ) : (
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById('main-image-input').click()}
                          className="w-full h-24 border-2 border-dashed border-emerald-300 hover:border-emerald-500 bg-emerald-50 hover:bg-emerald-100"
                        >
                          <div className="text-center">
                            <div className="text-2xl mb-2">📷</div>
                            <div className="text-sm font-medium text-emerald-700">Cliquer pour ajouter une image</div>
                          </div>
                        </Button>
                      )}
                      <input
                        id="main-image-input"
                        type="file"
                        accept="image/*"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (!file) {
                            e.target.value = '';
                            return;
                          }
                          
                          try {
                            setMainImageUploading(true);
                            console.log('Upload de l\'image principale...', file.name);
                            const { file_url } = await base44.integrations.Core.UploadFile({ file });
                            console.log('Image uploadée:', file_url);
                            setFormData(prev => ({...prev, image_url: file_url}));
                            toast.success('Image uploadée avec succès !');
                          } catch (error) {
                            console.error('Erreur upload:', error);
                            toast.error('Erreur lors de l\'upload: ' + (error.message || 'Erreur inconnue'));
                          } finally {
                            setMainImageUploading(false);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="col-span-2">
                    <Label>Images supplémentaires</Label>
                    <div className="space-y-2 mt-1">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('additional-images-input').click()}
                        disabled={additionalImagesUploading}
                        className="w-full h-16 border-2 border-dashed border-blue-300 hover:border-blue-500 bg-blue-50 hover:bg-blue-100"
                      >
                        {additionalImagesUploading ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin w-5 h-5 border-3 border-blue-500 border-t-transparent rounded-full" />
                            <span className="text-sm font-medium text-blue-700">Upload en cours...</span>
                          </div>
                        ) : (
                          <div className="text-center">
                            <div className="text-xl mb-1">🖼️</div>
                            <div className="text-sm font-medium text-blue-700">Ajouter des images supplémentaires</div>
                          </div>
                        )}
                      </Button>
                      <input
                        id="additional-images-input"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={async (e) => {
                          const files = Array.from(e.target.files || []);
                          if (files.length === 0) {
                            e.target.value = '';
                            return;
                          }
                          
                          try {
                            setAdditionalImagesUploading(true);
                            console.log('Upload de', files.length, 'image(s)...');
                            const uploadPromises = files.map(file => 
                              base44.integrations.Core.UploadFile({ file })
                            );
                            const results = await Promise.all(uploadPromises);
                            const urls = results.map(r => r.file_url);
                            console.log('Images uploadées:', urls);
                            setFormData(prev => ({
                              ...prev,
                              images: [...(prev.images || []), ...urls]
                            }));
                            toast.success(`${files.length} image(s) uploadée(s) avec succès !`);
                          } catch (error) {
                            console.error('Erreur upload images:', error);
                            toast.error('Erreur lors de l\'upload: ' + (error.message || 'Erreur inconnue'));
                          } finally {
                            setAdditionalImagesUploading(false);
                            e.target.value = '';
                          }
                        }}
                        className="hidden"
                      />
                      {formData.images?.length > 0 && (
                        <div className="flex flex-wrap gap-2 mt-2">
                          {formData.images.map((img, idx) => (
                            <div key={idx} className="relative group">
                              <img src={img} alt="" className="w-16 h-16 rounded-lg object-cover border" />
                              <Button
                                type="button"
                                size="icon"
                                variant="destructive"
                                className="absolute -top-2 -right-2 w-6 h-6"
                                onClick={() => {
                                  setFormData({
                                    ...formData,
                                    images: formData.images.filter((_, i) => i !== idx)
                                  });
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="col-span-2 border-t pt-4">
                    <Label className="mb-3 block text-base font-semibold">Variantes du produit</Label>
                    <p className="text-sm text-slate-500 mb-4">Ajoutez plusieurs types de variantes pour un même produit (taille, poids, volume, couleur, pack, lot, etc.)</p>
                      <div className="space-y-2">
                        <div className="flex gap-2">
                          <Select
                            value={newVariant.type}
                            onValueChange={(value) => setNewVariant({...newVariant, type: value})}
                          >
                            <SelectTrigger className="w-32">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                             <SelectItem value="taille">Taille</SelectItem>
                             <SelectItem value="poids">Poids</SelectItem>
                             <SelectItem value="volume">Volume</SelectItem>
                             <SelectItem value="couleur">Couleur</SelectItem>
                             <SelectItem value="pack">Pack</SelectItem>
                             <SelectItem value="lot">Lot</SelectItem>
                             <SelectItem value="carton">Carton</SelectItem>
                             <SelectItem value="sache">Sachet</SelectItem>
                             <SelectItem value="unite">Unité</SelectItem>
                             <SelectItem value="metre">Mètre</SelectItem>
                             <SelectItem value="litre">Litre</SelectItem>
                            </SelectContent>
                          </Select>
                          {newVariant.type === 'taille' ? (
                            <Select
                              value={newVariant.value}
                              onValueChange={(value) => setNewVariant({...newVariant, value})}
                            >
                              <SelectTrigger className="flex-1">
                                <SelectValue placeholder="Sélectionner" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="Plus petit">Plus petit</SelectItem>
                                <SelectItem value="Petit">Petit</SelectItem>
                                <SelectItem value="Moyen">Moyen</SelectItem>
                                <SelectItem value="Grand">Grand</SelectItem>
                                <SelectItem value="Plus grand">Plus grand</SelectItem>
                              </SelectContent>
                            </Select>
                          ) : newVariant.type === 'couleur' ? (
                            <div className="flex-1 space-y-3">
                              <div className="flex items-center gap-2">
                                <Label className="text-xs text-slate-500">Sélection multiple:</Label>
                                <div className="flex flex-wrap gap-1.5">
                                  {predefinedColors.map(color => (
                                    <button
                                      key={color.code}
                                      type="button"
                                      onClick={() => {
                                        const isSelected = selectedColors.some(c => c.code === color.code);
                                        if (isSelected) {
                                          setSelectedColors(selectedColors.filter(c => c.code !== color.code));
                                        } else {
                                          setSelectedColors([...selectedColors, color]);
                                        }
                                      }}
                                      className={`w-7 h-7 rounded-full border-2 transition-all ${
                                        selectedColors.some(c => c.code === color.code)
                                          ? 'border-emerald-500 ring-2 ring-emerald-200'
                                          : 'border-slate-300 hover:border-slate-400'
                                      }`}
                                      style={{ backgroundColor: color.code }}
                                      title={color.name}
                                    />
                                  ))}
                                </div>
                              </div>
                              {selectedColors.length > 0 && (
                                <div className="flex items-center gap-2 p-2 bg-emerald-50 rounded-lg">
                                  <span className="text-sm font-medium">Sélectionnées:</span>
                                  {selectedColors.map((color, idx) => (
                                    <span key={idx} className="text-xs bg-white px-2 py-1 rounded-full border flex items-center gap-1">
                                      <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: color.code }} />
                                      {color.name}
                                    </span>
                                  ))}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const colorName = selectedColors.map(c => c.name).join(' / ');
                                      const colorCodes = selectedColors.map(c => c.code).join(',');
                                      setNewVariant({
                                        ...newVariant,
                                        value: colorName,
                                        color_code: colorCodes
                                      });
                                      setSelectedColors([]);
                                    }}
                                    className="text-xs text-emerald-600 hover:text-emerald-700 font-medium ml-auto"
                                  >
                                    ✓ Utiliser
                                  </button>
                                </div>
                              )}
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  value={newVariant.color_code?.split(',')[0] || '#000000'}
                                  onChange={(e) => setNewVariant({...newVariant, color_code: e.target.value})}
                                  className="w-16 h-10 p-1"
                                />
                                <Input
                                  placeholder="Nom de la couleur"
                                  value={newVariant.value}
                                  onChange={(e) => setNewVariant({...newVariant, value: e.target.value})}
                                  className="flex-1"
                                />
                              </div>
                            </div>
                          ) : (
                            <Input
                              placeholder={
                                newVariant.type === 'poids' ? 'ex: 500g, 1kg' :
                                newVariant.type === 'volume' ? 'ex: 250ml, 1L' :
                                newVariant.type === 'pack' ? 'ex: Pack de 6, Pack de 12' :
                                newVariant.type === 'lot' ? 'ex: Lot de 3, Lot de 5' :
                                newVariant.type === 'carton' ? 'ex: Carton de 24' :
                                newVariant.type === 'sache' ? 'ex: Sachet de 100g' :
                                newVariant.type === 'unite' ? 'ex: 1 unité, 5 unités' :
                                newVariant.type === 'metre' ? 'ex: 1m, 2.5m' :
                                newVariant.type === 'litre' ? 'ex: 1L, 5L' :
                                'Valeur de la variante'
                              }
                              value={newVariant.value}
                              onChange={(e) => setNewVariant({...newVariant, value: e.target.value})}
                              className="flex-1"
                            />
                          )}
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              onClick={() => {
                                const currentPrice = parseFloat(formData.price) || 0;
                                const step = currentPrice * 0.1; // 10% du prix
                                setNewVariant({...newVariant, price_modifier: parseFloat((newVariant.price_modifier - step).toFixed(2))});
                              }}
                              variant="outline"
                              size="icon"
                              className="w-8 h-8"
                              title="Diminuer le prix"
                            >
                              -
                            </Button>
                            <Input
                              type="number"
                              step="0.01"
                              placeholder="Prix +/-"
                              value={newVariant.price_modifier}
                              onChange={(e) => setNewVariant({...newVariant, price_modifier: parseFloat(e.target.value)})}
                              className="w-24"
                            />
                            <Button
                              type="button"
                              onClick={() => {
                                const currentPrice = parseFloat(formData.price) || 0;
                                const step = currentPrice * 0.1; // 10% du prix
                                setNewVariant({...newVariant, price_modifier: parseFloat((newVariant.price_modifier + step).toFixed(2))});
                              }}
                              variant="outline"
                              size="icon"
                              className="w-8 h-8"
                              title="Augmenter le prix"
                            >
                              +
                            </Button>
                          </div>
                          <Input
                            type="number"
                            step="0.01"
                            placeholder="Promo €"
                            value={newVariant.promotion_price}
                            onChange={(e) => setNewVariant({...newVariant, promotion_price: e.target.value})}
                            className="w-24"
                            min="0"
                            title="Prix promotionnel pour cette variante"
                          />
                          <Input
                            type="number"
                            placeholder="Stock"
                            value={newVariant.stock_quantity}
                            onChange={(e) => setNewVariant({...newVariant, stock_quantity: parseInt(e.target.value) || 0})}
                            className="w-24"
                            min="0"
                            title="Stock pour cette variante"
                          />
                          <div className="flex items-center gap-2">
                           <input
                             type="file"
                             accept="image/*"
                             id="variant-image-upload"
                             className="hidden"
                             onChange={async (e) => {
                               const file = e.target.files?.[0];
                               if (!file) {
                                 e.target.value = '';
                                 return;
                               }
                               
                               try {
                                 setVariantImageUploading(true);
                                 console.log('Upload image variante...', file.name);
                                 toast.info('Upload en cours...');
                                 const { file_url } = await base44.integrations.Core.UploadFile({ file });
                                 console.log('Image variante uploadée:', file_url);
                                 setNewVariant({...newVariant, image_url: file_url});
                                 toast.success('Image de variante uploadée avec succès !');
                               } catch (error) {
                                 console.error('Erreur upload variante:', error);
                                 toast.error('Erreur lors de l\'upload: ' + (error.message || 'Erreur inconnue'));
                               } finally {
                                 setVariantImageUploading(false);
                                 e.target.value = '';
                               }
                             }}
                           />
                           <Button
                             type="button"
                             variant="outline"
                             size="icon"
                             onClick={() => document.getElementById('variant-image-upload').click()}
                             disabled={variantImageUploading}
                             title="Ajouter une image pour cette variante"
                             className="h-10 w-10"
                           >
                             {variantImageUploading ? (
                               <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                             ) : newVariant.image_url ? (
                               <img src={newVariant.image_url} alt="" className="w-full h-full rounded object-cover" />
                             ) : (
                               '🖼️'
                             )}
                           </Button>
                           <Button
                              type="button"
                              onClick={() => {
                                if (newVariant.value) {
                                  const variantToAdd = newVariant.type === 'couleur' 
                                    ? { ...newVariant, color_code: newVariant.color_code || '#000000' }
                                    : newVariant;

                                  let updatedVariants;
                                  if (editingVariantIndex !== null) {
                                    // Mode modification : remplacer la variante existante
                                    updatedVariants = [...(formData.variants || [])];
                                    updatedVariants[editingVariantIndex] = variantToAdd;
                                  } else {
                                    // Mode ajout : ajouter une nouvelle variante
                                    updatedVariants = [...(formData.variants || []), variantToAdd];
                                  }

                                  // Si c'est la première variante avec une image et que le produit n'a pas d'image principale, utiliser l'image de la variante
                                  const updatedFormData = {
                                    ...formData,
                                    variants: updatedVariants
                                  };

                                  if (variantToAdd.image_url && !formData.image_url) {
                                    updatedFormData.image_url = variantToAdd.image_url;
                                  }

                                  setFormData(updatedFormData);
                                  setNewVariant({ type: 'taille', value: '', price_modifier: 0, image_url: '', stock_quantity: 0 });
                                  setSelectedColors([]);
                                  setVariantImageUploading(false);
                                  setEditingVariantIndex(null);
                                  }
                                  }}
                                  variant="outline"
                                  >
                                  {editingVariantIndex !== null ? '✓ Modifier' : <Plus className="w-4 h-4" />}
                                  </Button>
                          </div>
                          </div>
                        {formData.variants?.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {formData.variants.map((variant, idx) => (
                              <div key={idx} className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                                <span className="text-sm flex items-center gap-2">
                                  {variant.image_url && (
                                    <img src={variant.image_url} alt="" className="w-12 h-12 rounded object-cover border-2 border-emerald-200" />
                                  )}
                                  <strong>{variant.type}:</strong> 
                                  {variant.type === 'couleur' && variant.color_code && (
                                    <span className="flex gap-0.5">
                                      {variant.color_code.split(',').map((code, i) => (
                                        <span 
                                          key={i}
                                          className="w-5 h-5 rounded-full border-2 border-slate-300 inline-block"
                                          style={{ backgroundColor: code.trim() }}
                                        />
                                      ))}
                                    </span>
                                  )}
                                  {variant.value} 
                                  {variant.price_modifier ? ` (${variant.price_modifier > 0 ? '+' : ''}${variant.price_modifier}€)` : ''}
                                  {variant.promotion_price && (
                                    <span className="text-xs text-rose-600 font-semibold ml-1 bg-rose-50 px-1.5 py-0.5 rounded">
                                      Promo: {variant.promotion_price}€
                                    </span>
                                  )}
                                  {variant.stock_quantity !== undefined && (
                                    <span className="text-xs text-slate-500 ml-2">
                                      Stock: {variant.stock_quantity}
                                    </span>
                                  )}
                                </span>
                                <div className="flex gap-1">
                                 <Button
                                   type="button"
                                   size="icon"
                                   variant="ghost"
                                   className="h-6 w-6 text-blue-500 hover:text-blue-600"
                                   onClick={() => {
                                     setNewVariant(variant);
                                     setEditingVariantIndex(idx);
                                     if (variant.type === 'couleur' && variant.color_code) {
                                       const colors = variant.color_code.split(',').map(code => 
                                         predefinedColors.find(c => c.code === code.trim()) || { name: 'Personnalisé', code: code.trim() }
                                       );
                                       setSelectedColors(colors);
                                     }
                                   }}
                                   title="Modifier cette variante"
                                 >
                                   <Pencil className="w-3 h-3" />
                                 </Button>
                                 <Button
                                   type="button"
                                   size="icon"
                                   variant="ghost"
                                   className="h-6 w-6 text-rose-500"
                                   onClick={() => {
                                     setFormData({
                                       ...formData,
                                       variants: formData.variants.filter((_, i) => i !== idx)
                                     });
                                     if (editingVariantIndex === idx) {
                                       setNewVariant({ type: 'taille', value: '', price_modifier: 0, image_url: '', stock_quantity: 0 });
                                       setEditingVariantIndex(null);
                                     }
                                   }}
                                 >
                                   <Trash2 className="w-3 h-3" />
                                 </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                  <div className="col-span-2 border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <Label>Promotion</Label>
                      <Switch
                        checked={formData.is_promotion}
                        onCheckedChange={(checked) => setFormData({...formData, is_promotion: checked})}
                      />
                    </div>
                    
                    {formData.is_promotion && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label>Prix promotionnel (€)</Label>
                          <Input
                            type="number"
                            step="0.01"
                            value={formData.promotion_price}
                            onChange={(e) => setFormData({...formData, promotion_price: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label>Date de fin</Label>
                          <Input
                            type="date"
                            value={formData.promotion_end_date}
                            onChange={(e) => setFormData({...formData, promotion_end_date: e.target.value})}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="col-span-2 border-t pt-4">
                    <Label>Date d'expiration (visible uniquement par l'admin)</Label>
                    <Input
                      type="date"
                      value={formData.expiration_date}
                      onChange={(e) => setFormData({...formData, expiration_date: e.target.value})}
                      className="mt-1"
                    />
                    <p className="text-xs text-slate-500 mt-1">Cette information n'est pas visible par les clients</p>
                  </div>

                  <div className="col-span-2 border-t pt-4">
                    <div className="flex items-center justify-between mb-4">
                      <Label>Afficher le nombre d'achats</Label>
                      <Switch
                        checked={formData.show_purchase_count}
                        onCheckedChange={(checked) => setFormData({...formData, show_purchase_count: checked})}
                      />
                    </div>
                    
                    {formData.show_purchase_count && (
                      <div className="space-y-4">
                        <div>
                          <Label>Nombre de personnes ayant acheté ce produit</Label>
                          <Input
                            type="number"
                            min="0"
                            value={formData.purchase_count}
                            onChange={(e) => setFormData({...formData, purchase_count: parseInt(e.target.value) || 0})}
                            className="mt-1"
                          />
                          <p className="text-xs text-slate-500 mt-1">Ce nombre est géré manuellement par vous</p>
                        </div>
                        
                        <div>
                          <Label>Message personnalisé</Label>
                          <Input
                            type="text"
                            placeholder="personnes ont acheté ce produit"
                            value={formData.purchase_count_message}
                            onChange={(e) => setFormData({...formData, purchase_count_message: e.target.value})}
                            className="mt-1"
                          />
                          <p className="text-xs text-slate-500 mt-1">Exemple d'affichage: "125 {formData.purchase_count_message}"</p>
                        </div>

                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <p className="text-sm font-medium text-blue-900">Aperçu:</p>
                          <p className="text-sm text-blue-700 mt-1">
                            👥 {formData.purchase_count || 0} {formData.purchase_count_message}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDialogOpen(false);
                      resetForm();
                    }}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    onClick={handleSubmit}
                    disabled={!formData.name || !formData.price || !formData.category}
                    className="flex-1 bg-emerald-500 hover:bg-emerald-600"
                  >
                    {editingProduct ? 'Mettre à jour' : 'Créer le produit'}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="border-0 shadow-sm rounded-2xl">
          <CardHeader>
            <div className="space-y-4">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input
                  placeholder="Rechercher un produit..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 rounded-xl"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('all')}
                  className="rounded-xl"
                  style={statusFilter === 'all' ? { backgroundColor: '#008000' } : {}}
                >
                  Tous les statuts
                </Button>
                <Button
                  variant={statusFilter === 'out_of_stock' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('out_of_stock')}
                  className="rounded-xl"
                  style={statusFilter === 'out_of_stock' ? { backgroundColor: '#dc2626' } : {}}
                >
                  Rupture de stock
                </Button>
                <Button
                  variant={statusFilter === 'low_stock' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('low_stock')}
                  className="rounded-xl"
                  style={statusFilter === 'low_stock' ? { backgroundColor: '#f59e0b' } : {}}
                >
                  Stock faible
                </Button>
                <Button
                  variant={statusFilter === 'promotion' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('promotion')}
                  className="rounded-xl"
                  style={statusFilter === 'promotion' ? { backgroundColor: '#8b5cf6' } : {}}
                >
                  En promotion
                </Button>
                <Button
                  variant={statusFilter === 'in_stock' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('in_stock')}
                  className="rounded-xl"
                  style={statusFilter === 'in_stock' ? { backgroundColor: '#10b981' } : {}}
                >
                  En stock
                </Button>
                <Button
                  variant={statusFilter === 'expiring_soon' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('expiring_soon')}
                  className="rounded-xl"
                  style={statusFilter === 'expiring_soon' ? { backgroundColor: '#dc2626' } : {}}
                >
                  ⚠️ Expire dans 2 semaines
                </Button>
                <Button
                  variant={statusFilter === 'expiring_month' ? 'default' : 'outline'}
                  onClick={() => setStatusFilter('expiring_month')}
                  className="rounded-xl"
                  style={statusFilter === 'expiring_month' ? { backgroundColor: '#eab308' } : {}}
                >
                  ⚡ Expire dans 1 mois
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produit</TableHead>
                  <TableHead>Catégorie</TableHead>
                  <TableHead>Prix</TableHead>
                  <TableHead>Stock</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Mise en avant</TableHead>
                  <TableHead>Expiration</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredProducts.map(product => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <img
                          src={product.image_url || 'https://images.unsplash.com/photo-1543168256-418811576931?w=100'}
                          alt={product.name}
                          className="w-12 h-12 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-slate-500 truncate max-w-[200px]">
                            {product.description}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {categories.find(c => c.id === product.category)?.label || product.category}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div>
                        {product.is_free ? (
                          <span className="font-semibold text-emerald-600">Gratuit</span>
                        ) : product.is_promotion && product.promotion_price ? (
                          <>
                            <span className="font-semibold text-emerald-600">{product.promotion_price.toFixed(2)}€</span>
                            <span className="text-sm text-slate-400 line-through ml-2">{product.price?.toFixed(2)}€</span>
                          </>
                        ) : (
                          <span className="font-semibold">{product.price?.toFixed(2)}€</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={product.stock_quantity <= 5 ? 'text-rose-600 font-medium' : ''}>
                        {product.stock_quantity} {product.stock_unit === 'kg' ? 'kg' : product.stock_unit === 'litre' ? 'L' : product.stock_unit === 'metre' ? 'm' : ''}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {product.stock_quantity <= 0 && (
                          <Badge variant="destructive">Rupture</Badge>
                        )}
                        {product.stock_quantity > 0 && product.stock_quantity <= 5 && (
                          <Badge className="bg-amber-100 text-amber-700">Stock faible</Badge>
                        )}
                        {(() => {
                          if (product.expiration_date) {
                            const today = new Date();
                            const expiration = new Date(product.expiration_date);
                            const diffTime = expiration - today;
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                            
                            if (diffDays <= 14) {
                              return (
                                <Badge className="bg-red-100 text-red-700">
                                  ⚠️ Expire bientôt
                                </Badge>
                              );
                            }
                            if (diffDays <= 30) {
                              return (
                                <Badge className="bg-yellow-100 text-yellow-700">
                                  ⚡ Expire dans 1 mois
                                </Badge>
                              );
                            }
                          }
                          return null;
                        })()}
                        {product.is_promotion && (
                          <Badge className="bg-rose-100 text-rose-700">
                            <Percent className="w-3 h-3 mr-1" />
                            Promo
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.featured_groups && product.featured_groups.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {product.featured_groups.map((group, idx) => (
                            <Badge key={idx} className="bg-emerald-100 text-emerald-700 text-xs">
                              {group === 'nouveaute' && '✨ Nouveauté'}
                              {group === 'meilleure_vente' && '🔥 Best'}
                              {group === 'coup_de_coeur' && '❤️ Coup de cœur'}
                              {group === 'recommande' && '⭐ Recommandé'}
                              {group === 'bio' && '🌱 Bio'}
                              {group === 'exclusif' && '💎 Exclusif'}
                            </Badge>
                          ))}
                        </div>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.expiration_date ? (
                        <span className="text-sm">
                          {new Date(product.expiration_date).toLocaleDateString('fr-FR')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(product)}
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => deleteProductMutation.mutate(product.id)}
                          className="text-rose-500 hover:text-rose-600"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}