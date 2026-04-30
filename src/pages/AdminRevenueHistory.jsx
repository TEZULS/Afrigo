import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, TrendingUp, ShoppingBag, BarChart3, Calendar } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';

export default function AdminRevenueHistory() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    base44.auth.me().then(u => {
      if (u?.role !== 'admin') { window.location.href = '/'; return; }
      setUser(u);
    }).catch(() => window.location.href = '/');
  }, []);

  const { data: history = [], isLoading } = useQuery({
    queryKey: ['revenueHistory'],
    queryFn: () => base44.entities.RevenueHistory.list('-period_start', 500),
    enabled: !!user,
  });

  const daily = history.filter(h => h.period_type === 'daily').sort((a, b) => a.period_start.localeCompare(b.period_start));
  const weekly = history.filter(h => h.period_type === 'weekly').sort((a, b) => a.period_start.localeCompare(b.period_start));
  const monthly = history.filter(h => h.period_type === 'monthly').sort((a, b) => a.period_start.localeCompare(b.period_start));

  const StatTable = ({ data, labelKey }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-slate-50">
            <th className="text-left p-3 font-semibold text-slate-600">Période</th>
            <th className="text-right p-3 font-semibold text-slate-600">Chiffre d'affaires</th>
            <th className="text-right p-3 font-semibold text-slate-600">Commandes</th>
            <th className="text-right p-3 font-semibold text-slate-600">Panier moyen</th>
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={4} className="text-center py-8 text-slate-400">Aucun historique disponible</td>
            </tr>
          ) : (
            [...data].reverse().map((row, i) => (
              <tr key={i} className="border-b hover:bg-slate-50 transition-colors">
                <td className="p-3 font-medium text-slate-700">{row[labelKey] || row.period_label}</td>
                <td className="p-3 text-right font-bold text-emerald-600">{(row.total_revenue || 0).toFixed(2)}€</td>
                <td className="p-3 text-right">
                  <Badge variant="secondary">{row.order_count || 0}</Badge>
                </td>
                <td className="p-3 text-right text-slate-600">{(row.average_order_value || 0).toFixed(2)}€</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  const ChartSection = ({ data, title }) => {
    const last12 = data.slice(-12);
    return (
      <Card className="border-0 shadow-sm rounded-2xl mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BarChart3 className="w-4 h-4 text-emerald-500" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={last12}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="period_label" stroke="#64748b" tick={{ fontSize: 11 }} />
              <YAxis stroke="#64748b" tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}
                formatter={(val, name) => [name === 'total_revenue' ? `${val.toFixed(2)}€` : val, name === 'total_revenue' ? 'CA' : 'Commandes']}
              />
              <Bar dataKey="total_revenue" fill="#10b981" radius={[4, 4, 0, 0]} name="CA" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4">
          <Button variant="outline" size="sm" onClick={() => window.history.back()} className="rounded-lg">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Retour
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-slate-800 mb-1 flex items-center gap-2">
              <Calendar className="w-7 h-7 text-emerald-500" />
              Historique des revenus
            </h1>
            <p className="text-slate-500">Chiffre d'affaires et commandes archivés automatiquement</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <Tabs defaultValue="monthly">
            <TabsList className="mb-6">
              <TabsTrigger value="monthly">Par mois</TabsTrigger>
              <TabsTrigger value="weekly">Par semaine</TabsTrigger>
              <TabsTrigger value="daily">Par jour</TabsTrigger>
            </TabsList>

            <TabsContent value="monthly">
              <ChartSection data={monthly} title="Chiffre d'affaires mensuel" />
              <Card className="border-0 shadow-sm rounded-2xl">
                <StatTable data={monthly} labelKey="period_label" />
              </Card>
            </TabsContent>

            <TabsContent value="weekly">
              <ChartSection data={weekly} title="Chiffre d'affaires hebdomadaire" />
              <Card className="border-0 shadow-sm rounded-2xl">
                <StatTable data={weekly} labelKey="period_label" />
              </Card>
            </TabsContent>

            <TabsContent value="daily">
              <ChartSection data={daily} title="Chiffre d'affaires journalier (30 derniers jours)" />
              <Card className="border-0 shadow-sm rounded-2xl">
                <StatTable data={daily} labelKey="period_label" />
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}