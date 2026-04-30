import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Phone, MapPin, Save, CheckCircle, AlertCircle, Wallet, Star, Gift, ArrowRightLeft, ArrowLeft, LogOut, Edit2, Key, Eye, EyeOff, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import CustomerIdGenerator from '@/components/profile/CustomerIdGenerator';
import ReferralSection from '@/components/profile/ReferralSection';
import TierBadge from '@/components/profile/TierBadge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

export default function Profile() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const redirectTo = urlParams.get('redirect');
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const [registerError, setRegisterError] = useState('');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSent, setResetSent] = useState(false);
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetPasswordError, setResetPasswordError] = useState('');
  const [formData, setFormData] = useState({
    civility: '',
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    address: '',
    postal_code: '',
    city: '',
    user_password: ''
  });
  const [addressSuggestions, setAddressSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const addressRef = useRef(null);
  const [editingField, setEditingField] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (addressRef.current && !addressRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const { data: loyaltySettings } = useQuery({
    queryKey: ['loyaltySettings'],
    queryFn: () => base44.entities.LoyaltySettings.list(),
    select: (data) => data[0] || { points_per_euro: 1, min_purchase_amount: 10, is_active: true },
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const { data: calculatedPoints } = useQuery({
    queryKey: ['calculatedPoints', user?.email],
    queryFn: async () => {
      const response = await base44.functions.invoke('calculateLoyaltyPoints');
      return response.data;
    },
    enabled: !!user && loyaltySettings?.auto_calculate_points === true,
    refetchInterval: 60000,
    retry: false,
  });

  const { data: loyaltyPoints = [] } = useQuery({
    queryKey: ['loyaltyPoints', user?.email],
    queryFn: () => base44.entities.LoyaltyPoints.filter({ customer_email: user?.email }),
    enabled: !!user?.email,
    staleTime: 2 * 60 * 1000,
    retry: false,
  });

  const { data: tierBenefits = [] } = useQuery({
    queryKey: ['tierBenefits'],
    queryFn: () => base44.entities.TierBenefit.list(),
    staleTime: 10 * 60 * 1000,
    retry: false,
  });

  const currentTierBenefit = tierBenefits.find(t => t.tier === user?.customer_tier);

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      setFormData({
        civility: u.civility || '',
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        email: u.email || '',
        phone: u.phone || '',
        address: u.address || '',
        postal_code: u.postal_code || '',
        city: u.city || '',
        user_password: u.user_password || ''
      });
    }).catch(() => {
      setUser(null);
    }).finally(() => {
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // Vérifier si on a un token de réinitialisation dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('reset');
    if (token) {
      setResetToken(token);
      setShowResetPassword(true);
      verifyResetToken(token);
    }
  }, []);

  const verifyResetToken = async (token) => {
    try {
      const response = await base44.functions.invoke('handleCustomAuth', {
        action: 'verify_reset_token',
        token
      });
      
      if (!response.data.success) {
        toast.error('Lien de réinitialisation invalide ou expiré');
        setShowResetPassword(false);
        window.history.replaceState({}, '', window.location.pathname);
      }
    } catch (error) {
      toast.error('Erreur lors de la vérification du lien');
      setShowResetPassword(false);
    }
  };

  const handleResetPassword = async () => {
    setResetPasswordError('');
    
    if (!newPassword || newPassword.length < 6) {
      setResetPasswordError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    if (newPassword !== confirmPassword) {
      setResetPasswordError('Les mots de passe ne correspondent pas');
      return;
    }

    setSaving(true);
    try {
      const response = await base44.functions.invoke('handleCustomAuth', {
        action: 'update_password',
        token: resetToken,
        newPassword
      });
      
      if (response.data.success) {
        setShowResetPassword(false);
        setIsLoginMode(true);
        setNewPassword('');
        setConfirmPassword('');
        window.history.replaceState({}, '', window.location.pathname);
        toast.success('✅ Mot de passe modifié avec succès ! Vous pouvez maintenant vous connecter avec votre nouveau mot de passe.');
      } else {
        setResetPasswordError(response.data.error || 'Erreur lors de la mise à jour');
      }
    } catch (error) {
      setResetPasswordError('Erreur lors de la mise à jour du mot de passe');
    } finally {
      setSaving(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!resetEmail) {
      toast.error('Veuillez entrer votre email');
      return;
    }

    setSaving(true);
    try {
      const response = await base44.functions.invoke('handleCustomAuth', {
        action: 'reset_password',
        email: resetEmail
      });
      
      if (response.data.success) {
        setResetSent(true);
        toast.success('Email de réinitialisation envoyé !');
      } else {
        toast.error(response.data.error || 'Erreur lors de l\'envoi de l\'email');
      }
    } catch (error) {
      toast.error('Erreur lors de l\'envoi de l\'email');
    } finally {
      setSaving(false);
    }
  };

  const handleLogin = async () => {
    setLoginError('');
    
    if (!loginEmail || !loginPassword) {
      setLoginError('Veuillez remplir tous les champs');
      return;
    }
    
    setSaving(true);
    
    try {
      // Vérifier que l'utilisateur existe et que le mot de passe est correct
      const response = await base44.functions.invoke('handleCustomAuth', {
        action: 'verify_login',
        email: loginEmail,
        password: loginPassword
      });
      
      if (response.data.success) {
        // Déclencher la connexion Base44 - cela enverra un email magique
        base44.auth.redirectToLogin(createPageUrl('Profile'));
      } else {
        setLoginError('Email ou mot de passe incorrect');
      }
    } catch (error) {
      setLoginError('Erreur de connexion');
    } finally {
      setSaving(false);
    }
  };

  const handleRegister = async () => {
    setRegisterError('');
    
    // Vérifier que tous les champs obligatoires sont remplis
    if (!formData.email || !formData.user_password || !formData.first_name || !formData.last_name || !formData.phone || !formData.civility || !formData.address || !formData.postal_code || !formData.city) {
      setRegisterError('Veuillez remplir tous les champs obligatoires');
      return;
    }
    
    if (formData.user_password.length < 6) {
      setRegisterError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }
    
    setSaving(true);
    
    try {
      // Vérifier si l'email ou le téléphone existe déjà
      const checkResponse = await base44.functions.invoke('handleCustomAuth', {
        action: 'check_exists',
        email: formData.email,
        phone: formData.phone
      });
      
      if (checkResponse.data.emailExists) {
        setRegisterError('Cet email est déjà utilisé.');
        setIsLoginMode(true);
        setLoginEmail(formData.email);
        setLoginError('Cet email existe déjà. Connectez-vous.');
        setSaving(false);
        return;
      }
      
      if (checkResponse.data.phoneExists) {
        setRegisterError('Ce numéro de téléphone est déjà utilisé par un autre compte');
        setSaving(false);
        return;
      }
      
      // Créer le compte via la fonction backend qui gère l'invitation et les données
      const formattedPhone = formatPhone(formData.phone);
      const createResponse = await base44.functions.invoke('handleCustomAuth', {
        action: 'create_user',
        email: formData.email,
        password: formData.user_password,
        civility: formData.civility,
        first_name: formData.first_name,
        last_name: formData.last_name,
        phone: formattedPhone,
        address: formData.address,
        postal_code: formData.postal_code,
        city: formData.city
      });
      
      if (createResponse.data.success) {
        toast.success('Compte créé ! Vérifiez votre email pour vous connecter.');
        setIsLoginMode(true);
        setLoginEmail(formData.email);
        setLoginError('');
      } else {
        setRegisterError(createResponse.data.error || 'Erreur lors de la création du compte');
      }
      setSaving(false);
    } catch (error) {
      setRegisterError('Erreur lors de la création du compte');
      setSaving(false);
    }
  };

  const searchAddress = async (query) => {
    if (query.length < 2) {
      setAddressSuggestions([]);
      return;
    }

    try {
      let url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(query)}&limit=50&autocomplete=1`;
      
      // Ajouter la géolocalisation si disponible
      if (navigator.geolocation) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 });
          });
          url += `&lat=${position.coords.latitude}&lon=${position.coords.longitude}`;
        } catch (geoError) {
          // Continuer sans géolocalisation si refusée ou erreur
        }
      }
      
      const response = await fetch(url);
      const data = await response.json();
      setAddressSuggestions(data.features || []);
      setShowSuggestions(true);
    } catch (error) {
      console.error('Erreur lors de la recherche d\'adresse:', error);
    }
  };

  const selectAddress = (feature) => {
    const properties = feature.properties;
    setFormData({
      ...formData,
      address: properties.name || '',
      postal_code: properties.postcode || '',
      city: properties.city || ''
    });
    setAddressSuggestions([]);
    setShowSuggestions(false);
  };

  const formatPhone = (phone) => {
    if (!phone) return phone;
    const cleaned = phone.replace(/[\s\-\.]/g, '');
    if (cleaned.startsWith('+')) return cleaned;
    if (cleaned.startsWith('0')) return '+33' + cleaned.slice(1);
    if (cleaned.startsWith('33') && cleaned.length >= 11) return '+' + cleaned;
    return '+33' + cleaned;
  };

  const { data: allUsers = [] } = useQuery({
    queryKey: ['all-users'],
    queryFn: () => base44.entities.User.list(),
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  const handleSaveField = async (field) => {
    setSaving(true);
    try {
      let valueToSave = formData[field];

      if (field === 'phone') {
        valueToSave = formatPhone(formData.phone);
        setFormData(prev => ({ ...prev, phone: valueToSave }));

        const existingUserWithPhone = allUsers.find(u => u.phone === valueToSave && u.id !== user.id);
        if (existingUserWithPhone) {
          toast.error('Ce numéro de téléphone est déjà utilisé par un autre compte');
          setSaving(false);
          return;
        }
      }
      
      await base44.auth.updateMe({ [field]: valueToSave });
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      setEditingField(null);
      toast.success('Modification enregistrée');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNames = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ 
        first_name: formData.first_name, 
        last_name: formData.last_name 
      });
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      setEditingField(null);
      toast.success('Nom et prénom modifiés');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAddress = async () => {
    setSaving(true);
    try {
      await base44.auth.updateMe({ 
        address: formData.address,
        postal_code: formData.postal_code,
        city: formData.city
      });
      const updatedUser = await base44.auth.me();
      setUser(updatedUser);
      setEditingField(null);
      toast.success('Adresse modifiée');
      queryClient.invalidateQueries({ queryKey: ['all-users'] });
    } catch (error) {
      toast.error('Erreur lors de l\'enregistrement. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };



  const handleConvertPoints = async () => {
    const totalPoints = loyaltyPoints.reduce((sum, p) => sum + (p.points || 0), 0);
    const conversionRate = loyaltySettings?.points_to_euro_rate || 100;
    
    if (totalPoints < conversionRate) {
      toast.error(`Vous devez avoir au moins ${conversionRate} points pour convertir`);
      return;
    }

    setConverting(true);
    
    const euroAmount = Math.floor(totalPoints / conversionRate);
    const pointsToConvert = euroAmount * conversionRate;
    const remainingPoints = totalPoints - pointsToConvert;
    
    // Créer une transaction de conversion de points (uniquement les points convertibles)
    await base44.entities.LoyaltyPoints.create({
      customer_email: user.email,
      points: -pointsToConvert,
      transaction_type: 'converted',
      converted_amount: euroAmount
    });

    // Créer une transaction de portefeuille
    await base44.entities.WalletTransaction.create({
      customer_email: user.email,
      amount: euroAmount,
      type: 'credit',
      reason: `Conversion de ${pointsToConvert} points de fidélité`
    });

    // Mettre à jour le solde du portefeuille
    const newBalance = (user.wallet_balance || 0) + euroAmount;
    await base44.auth.updateMe({ wallet_balance: newBalance });

    // Rafraîchir les données
    const updatedUser = await base44.auth.me();
    setUser(updatedUser);
    queryClient.invalidateQueries({ queryKey: ['loyaltyPoints'] });
    
    if (remainingPoints > 0) {
      toast.success(`${pointsToConvert} points convertis en ${euroAmount}€. ${remainingPoints} points restants.`);
    } else {
      toast.success(`${pointsToConvert} points convertis en ${euroAmount}€`);
    }
    setConverting(false);
  };
  
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDeleteAccount = async () => {
    setDeleting(true);
    try {
      await base44.functions.invoke('handleCustomAuth', { action: 'delete_account' });
      base44.auth.logout();
    } catch (error) {
      toast.error('Erreur lors de la suppression du compte');
      setDeleting(false);
    }
  };

  const isProfileComplete = formData.civility && formData.first_name && formData.last_name && formData.phone && formData.address && formData.postal_code && formData.city && user?.email;
  const showWarning = redirectTo === 'checkout' && !isProfileComplete;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  // Interface pour les non-connectés
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-md mx-auto px-4 py-8">
          <div className="text-center mb-8">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{backgroundColor: 'var(--afrigo-green-light)'}}>
              <User className="w-10 h-10" style={{color: 'var(--afrigo-green)'}} />
            </div>
            <h1 className="text-3xl font-bold text-slate-800 mb-2">
              Bienvenue sur AfriGo
            </h1>
            <p className="text-slate-500">
              Connectez-vous ou créez un compte pour commencer
            </p>
          </div>

          <Card className="border-0 shadow-lg rounded-2xl">
            <CardContent className="p-6 space-y-4">
              <Button
                onClick={() => base44.auth.redirectToLogin(createPageUrl('Profile'))}
                className="w-full h-14 bg-emerald-500 hover:bg-emerald-600 rounded-xl text-lg"
              >
                Se connecter
              </Button>

              <Button
                onClick={() => base44.auth.redirectToLogin(createPageUrl('Profile'))}
                variant="outline"
                className="w-full h-14 rounded-xl text-lg border-2"
                style={{ borderColor: 'var(--afrigo-green)', color: 'var(--afrigo-green)' }}
              >
                S'inscrire
              </Button>
            </CardContent>
          </Card>

          <div className="text-center mt-6">
            <Button
              variant="ghost"
              onClick={() => navigate(createPageUrl('Home'))}
              className="rounded-xl"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour à l'accueil
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <CustomerIdGenerator user={user} />
      <div className="max-w-2xl mx-auto px-4 py-8">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-6 rounded-xl"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour
        </Button>
        
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="text-center mb-8">
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center mx-auto mb-4" style={{backgroundColor: 'var(--afrigo-green-light)'}}>
              <User className="w-8 h-8 sm:w-10 sm:h-10" style={{color: 'var(--afrigo-green)'}} />
            </div>
            <h1 className="text-2xl font-bold text-slate-800">
              {formData.first_name && formData.last_name ? `${formData.first_name} ${formData.last_name}` : user?.full_name || 'Mon profil'}
            </h1>
            <p className="text-slate-500 mb-3">{user?.email}</p>
            
            <TierBadge tier={user?.customer_tier} tierBenefit={currentTierBenefit} />
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-6">
            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Identifiant client</p>
                    <p className="text-2xl font-bold text-slate-800">
                      {user?.customer_id || '...'}
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center">
                    <User className="w-6 h-6 text-slate-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm rounded-2xl">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Solde du portefeuille</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {(user?.wallet_balance || 0).toFixed(2)}€
                    </p>
                  </div>
                  <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                    <Wallet className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {loyaltySettings?.is_active && (
            <Card className="border-0 shadow-sm rounded-2xl mb-6">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-slate-500 mb-1">Achat minimum</p>
                    <p className="text-2xl font-bold" style={{color: 'var(--afrigo-green)'}}>
                      {loyaltySettings?.min_purchase_amount || 10}€
                    </p>
                    <p className="text-xs text-slate-400 mt-1">
                      Pour gagner des points
                    </p>
                  </div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{backgroundColor: 'var(--afrigo-green-light)'}}>
                    <Gift className="w-6 h-6" style={{color: 'var(--afrigo-green)'}} />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {loyaltySettings?.is_active && (
            <Card className="border-0 shadow-lg rounded-2xl mb-6 bg-gradient-to-br from-amber-50 to-orange-50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Star className="w-5 h-5 text-amber-600" />
                  Mes points de fidélité
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-slate-600">Points disponibles</p>
                      <p className="text-xl font-bold text-amber-600">
                        {Math.max(0, loyaltyPoints.reduce((sum, p) => sum + (p.points || 0), 0))} pts
                      </p>
                    </div>
                    <div className="text-center px-4">
                      <ArrowRightLeft className="w-6 h-6 text-slate-400 mx-auto mb-1" />
                      <p className="text-xs text-slate-500">{loyaltySettings?.points_to_euro_rate || 100} pts = 1€</p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Montant convertible</p>
                      <p className="text-xl font-bold text-purple-600">
                        {Math.floor(Math.max(0, loyaltyPoints.reduce((sum, p) => sum + (p.points || 0), 0)) / (loyaltySettings?.points_to_euro_rate || 100))}€
                      </p>
                    </div>
                  </div>
                  <Button
                    onClick={handleConvertPoints}
                    disabled={converting || Math.max(0, loyaltyPoints.reduce((sum, p) => sum + (p.points || 0), 0)) < (loyaltySettings?.points_to_euro_rate || 100)}
                    className="w-full h-12 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 rounded-xl shadow-lg"
                  >
                    {converting ? (
                      'Conversion en cours...'
                    ) : (
                      <>
                        <Wallet className="w-4 h-4 mr-2" />
                        Convertir en portefeuille
                      </>
                    )}
                  </Button>
                  {Math.max(0, loyaltyPoints.reduce((sum, p) => sum + (p.points || 0), 0)) < (loyaltySettings?.points_to_euro_rate || 100) && (
                    <p className="text-xs text-slate-500 text-center">
                      Vous devez avoir au moins {loyaltySettings?.points_to_euro_rate || 100} points pour convertir
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {showWarning && (
            <Card className="border-0 shadow-lg rounded-2xl mb-6 bg-amber-50 border-amber-200">
              <CardContent className="p-5 flex items-start gap-4">
                <div className="w-10 h-10 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <AlertCircle className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-amber-900 mb-1">
                    Complétez votre profil
                  </h3>
                  <p className="text-sm text-amber-700">
                    Pour passer commande, veuillez renseigner toutes vos informations personnelles : état civil, nom, prénom, téléphone, adresse complète.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>Mes informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>État civil *</Label>
                  {editingField !== 'civility' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField('civility')}
                      className="h-8 text-emerald-600"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Modifier
                    </Button>
                  )}
                </div>
                {editingField === 'civility' ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      {['M.', 'Mme', 'Autre'].map((option) => (
                        <button
                          key={option}
                          type="button"
                          onClick={() => setFormData({...formData, civility: option})}
                          className={`flex-1 h-12 rounded-xl border-2 font-medium transition-all ${
                            formData.civility === option
                              ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                          }`}
                        >
                          {option}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSaveField('civility')}
                        disabled={saving || !formData.civility}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Enregistrer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFormData({...formData, civility: user.civility});
                          setEditingField(null);
                        }}
                        className="rounded-xl"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-12 px-4 bg-slate-50 rounded-xl flex items-center text-slate-700">
                    {formData.civility || 'Non défini'}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Email *</Label>
                </div>
                <div className="h-12 px-4 bg-slate-50 rounded-xl flex items-center text-slate-700">
                  {formData.email}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Prénom et Nom *</Label>
                  {editingField !== 'names' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField('names')}
                      className="h-8 text-emerald-600"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Modifier
                    </Button>
                  )}
                </div>
                {editingField === 'names' ? (
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <Input
                        value={formData.first_name}
                        onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                        placeholder="Prénom"
                        className="h-12 rounded-xl"
                      />
                      <Input
                        value={formData.last_name}
                        onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                        placeholder="Nom"
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveNames}
                        disabled={saving || !formData.first_name || !formData.last_name}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Enregistrer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFormData({...formData, first_name: user.first_name, last_name: user.last_name});
                          setEditingField(null);
                        }}
                        className="rounded-xl"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-12 px-4 bg-slate-50 rounded-xl flex items-center text-slate-700">
                    {formData.first_name} {formData.last_name}
                  </div>
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Téléphone *</Label>
                  {editingField !== 'phone' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField('phone')}
                      className="h-8 text-emerald-600"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Modifier
                    </Button>
                  )}
                </div>
                {editingField === 'phone' ? (
                  <div className="space-y-2">
                    <div className="relative">
                      <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                      <Input
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="06 12 34 56 78"
                        className="h-12 pl-10 rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => handleSaveField('phone')}
                        disabled={saving || !formData.phone}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Enregistrer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFormData({...formData, phone: user.phone});
                          setEditingField(null);
                        }}
                        className="rounded-xl"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="h-12 px-4 bg-slate-50 rounded-xl flex items-center text-slate-700">
                    {formData.phone}
                  </div>
                )}
              </div>

              <Separator />

              <div>
                <div className="flex items-center justify-between mb-1">
                  <Label>Adresse complète *</Label>
                  {editingField !== 'address' && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingField('address')}
                      className="h-8 text-emerald-600"
                    >
                      <Edit2 className="w-3 h-3 mr-1" />
                      Modifier
                    </Button>
                  )}
                </div>
                {editingField === 'address' ? (
                  <div className="space-y-3">
                    <div ref={addressRef} className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                      <Input
                        value={formData.address}
                        onChange={(e) => {
                          const value = e.target.value;
                          setFormData({...formData, address: value});
                          searchAddress(value);
                        }}
                        onFocus={() => formData.address.length >= 2 && setShowSuggestions(true)}
                        placeholder="Commencez à taper votre adresse..."
                        className="h-12 pl-10 rounded-xl"
                        autoComplete="off"
                      />
                      {showSuggestions && addressSuggestions.length > 0 && (
                        <div className="absolute z-20 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                          {addressSuggestions.map((suggestion, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => selectAddress(suggestion)}
                              className="w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors border-b border-slate-100 last:border-0"
                            >
                              <p className="font-medium text-slate-800">{suggestion.properties.name}</p>
                              <p className="text-sm text-slate-500">
                                {suggestion.properties.postcode} {suggestion.properties.city}
                              </p>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <Input
                        value={formData.postal_code}
                        onChange={(e) => setFormData({...formData, postal_code: e.target.value})}
                        placeholder="Code postal"
                        className="h-12 rounded-xl"
                      />
                      <Input
                        value={formData.city}
                        onChange={(e) => setFormData({...formData, city: e.target.value})}
                        placeholder="Ville"
                        className="h-12 rounded-xl"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={handleSaveAddress}
                        disabled={saving || !formData.address || !formData.postal_code || !formData.city}
                        className="flex-1 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                      >
                        <Save className="w-3 h-3 mr-1" />
                        Enregistrer
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setFormData({
                            ...formData, 
                            address: user.address,
                            postal_code: user.postal_code,
                            city: user.city
                          });
                          setEditingField(null);
                        }}
                        className="rounded-xl"
                      >
                        Annuler
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 rounded-xl text-slate-700">
                    <p className="font-medium">{formData.address}</p>
                    <p className="text-sm text-slate-500 mt-1">
                      {formData.postal_code} {formData.city}
                    </p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Referral Section */}
          <ReferralSection user={user} />

          {/* Logout & Delete */}
          <div className="mt-6 pb-8 space-y-3">
            <Button
              onClick={() => base44.auth.logout()}
              variant="outline"
              className="w-full h-12 rounded-xl border-rose-200 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Se déconnecter
            </Button>

            {!showDeleteConfirm ? (
              <Button
                onClick={() => setShowDeleteConfirm(true)}
                variant="ghost"
                className="w-full h-12 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 text-sm"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Supprimer mon compte
              </Button>
            ) : (
              <div className="border border-rose-200 rounded-xl p-4 bg-rose-50 space-y-3">
                <p className="text-sm font-semibold text-rose-700 text-center">
                  ⚠️ Êtes-vous sûr de vouloir supprimer définitivement votre compte ?
                </p>
                <p className="text-xs text-rose-500 text-center">
                  Cette action est irréversible. Toutes vos données seront perdues.
                </p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDeleteAccount}
                    disabled={deleting}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white rounded-xl"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    {deleting ? 'Suppression...' : 'Oui, supprimer'}
                  </Button>
                  <Button
                    onClick={() => setShowDeleteConfirm(false)}
                    variant="outline"
                    className="flex-1 rounded-xl"
                  >
                    Annuler
                  </Button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}