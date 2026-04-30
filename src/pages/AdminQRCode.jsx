import React, { useState, useEffect, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { QrCode, Download, Share2, Copy, ArrowLeft } from 'lucide-react';
import QRCodeLib from 'qrcode';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';

export default function AdminQRCode() {
  const [user, setUser] = useState(null);
  const [appUrl, setAppUrl] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const canvasRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    base44.auth.me().then(u => {
      setUser(u);
      if (u.role !== 'admin') {
        navigate('/');
      }
    }).catch(() => navigate('/'));

    // Utiliser le domaine personnel
    const url = 'https://www.afrigo.app';
    setAppUrl(url);
    generateQRCode(url);
  }, [navigate]);

  const generateQRCode = async (url) => {
    try {
      const qrDataUrl = await QRCodeLib.toDataURL(url, {
        width: 400,
        margin: 2,
        color: {
          dark: '#059669',
          light: '#FFFFFF'
        }
      });
      setQrCodeUrl(qrDataUrl);
    } catch (err) {
      console.error('Erreur génération QR code:', err);
    }
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.download = 'afrigo-qrcode.png';
    link.href = qrCodeUrl;
    link.click();
    toast.success('QR code téléchargé');
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(appUrl);
    toast.success('Lien copié');
  };

  if (!user || user.role !== 'admin') return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <Link to={createPageUrl('AdminDashboard')} className="inline-flex items-center text-slate-600 hover:text-emerald-600 mb-6">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Retour au tableau de bord
        </Link>
        <h1 className="text-3xl font-bold text-slate-800 mb-8">QR Code de l'application</h1>

        <div className="grid md:grid-cols-2 gap-6">
          {/* QR Code Display */}
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <QrCode className="w-5 h-5 text-emerald-500" />
                QR Code
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {qrCodeUrl && (
                <div className="flex flex-col items-center">
                  <div className="bg-white p-6 rounded-2xl border-4 border-emerald-500 shadow-xl">
                    <img src={qrCodeUrl} alt="QR Code" className="w-full max-w-sm" />
                  </div>
                  <p className="text-sm text-slate-500 mt-4 text-center">
                    Scannez ce code pour accéder à AfriGo
                  </p>
                </div>
              )}

              <div className="flex gap-3 mt-6">
                <Button
                  onClick={handleDownload}
                  className="flex-1 h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
                >
                  <Download className="w-4 h-4 mr-2" />
                  Télécharger
                </Button>
                <Button
                  onClick={handleDownload}
                  variant="outline"
                  className="flex-1 h-12 rounded-xl"
                >
                  <Share2 className="w-4 h-4 mr-2" />
                  Partager
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* URL Info */}
          <Card className="border-0 shadow-lg rounded-2xl">
            <CardHeader>
              <CardTitle>Lien de l'application</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>URL de l'application</Label>
                <div className="flex gap-2 mt-2">
                  <Input
                    value={appUrl}
                    readOnly
                    className="h-12 rounded-xl bg-slate-50"
                  />
                  <Button
                    onClick={handleCopyUrl}
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 rounded-xl"
                  >
                    <Copy className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-2">
                <h3 className="font-semibold text-blue-900">Comment utiliser le QR code :</h3>
                <ul className="text-sm text-blue-800 space-y-1 list-disc list-inside">
                  <li>Téléchargez l'image du QR code</li>
                  <li>Partagez-le sur vos réseaux sociaux</li>
                  <li>Imprimez-le sur des flyers ou affiches</li>
                  <li>Ajoutez-le à vos signatures d'email</li>
                </ul>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
                <p className="text-sm text-emerald-800">
                  💡 <strong>Astuce :</strong> Les nouveaux clients devront créer un compte et remplir leurs informations (nom, prénom, adresse, téléphone) avant de pouvoir passer commande.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}