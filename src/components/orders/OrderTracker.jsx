import React from 'react';
import { CheckCircle, Clock, Package, Truck, Home } from 'lucide-react';
import { motion } from 'framer-motion';

const steps = [
  { id: 'pending', label: 'Commande reçue', icon: Clock },
  { id: 'confirmed', label: 'Confirmée', icon: CheckCircle },
  { id: 'preparing', label: 'Préparation', icon: Package },
  { id: 'ready', label: 'Prête', icon: CheckCircle },
  { id: 'shipped', label: 'En livraison', icon: Truck },
  { id: 'delivered', label: 'Livrée', icon: Home },
];

export default function OrderTracker({ currentStatus }) {
  const currentIndex = steps.findIndex(s => s.id === currentStatus);
  const isCancelled = currentStatus === 'cancelled';

  if (isCancelled) {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
        <p className="text-rose-600 font-medium">Cette commande a été annulée</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-100">
      <h3 className="font-semibold text-slate-800 mb-6">Suivi de commande</h3>
      
      <div className="relative">
        {/* Progress line */}
        <div className="absolute top-6 left-6 right-6 h-0.5 bg-slate-200" />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${(currentIndex / (steps.length - 1)) * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="absolute top-6 left-6 h-0.5 bg-emerald-500"
        />

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= currentIndex;
            const isCurrent = index === currentIndex;

            return (
              <motion.div
                key={step.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex flex-col items-center"
              >
                <div
                  className={`
                    w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300
                    ${isCompleted 
                      ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-500/30' 
                      : 'bg-slate-100 text-slate-400'
                    }
                    ${isCurrent ? 'ring-4 ring-emerald-100' : ''}
                  `}
                >
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`
                  text-xs mt-2 text-center font-medium
                  ${isCompleted ? 'text-emerald-600' : 'text-slate-400'}
                `}>
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}