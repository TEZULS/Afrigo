import React from 'react';
import { motion } from 'framer-motion';
import { FileText, CheckCircle, XCircle, PackageCheck } from 'lucide-react';

const steps = [
  { id: 'pending', label: 'En attente', icon: FileText },
  { id: 'approved', label: 'Approuvé', icon: CheckCircle },
  { id: 'completed', label: 'Terminé', icon: PackageCheck }
];

export default function ReturnTracker({ currentStatus, rejectionReason }) {
  if (currentStatus === 'rejected') {
    return (
      <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 text-center">
        <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <XCircle className="w-8 h-8 text-rose-600" />
        </div>
        <h3 className="text-lg font-semibold text-rose-800 mb-2">Demande refusée</h3>
        <p className="text-sm text-rose-600">Votre demande de retour a été refusée.</p>
        {rejectionReason && (
          <div className="mt-4 p-3 bg-white rounded-xl text-left">
            <p className="text-xs text-slate-500 mb-1">Motif:</p>
            <p className="text-sm text-slate-700">{rejectionReason}</p>
          </div>
        )}
      </div>
    );
  }

  const currentStepIndex = steps.findIndex(step => step.id === currentStatus);
  const progress = currentStepIndex >= 0 ? ((currentStepIndex + 1) / steps.length) * 100 : 0;

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm">
      <div className="relative">
        {/* Progress Bar */}
        <div className="absolute top-5 left-0 right-0 h-1 bg-slate-200 rounded-full">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
            className="h-full bg-emerald-500 rounded-full"
          />
        </div>

        {/* Steps */}
        <div className="relative flex justify-between">
          {steps.map((step, index) => {
            const StepIcon = step.icon;
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.id} className="flex flex-col items-center" style={{ flex: 1 }}>
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: index * 0.1 }}
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center mb-3 z-10
                    ${isCompleted ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-400'}
                    ${isCurrent ? 'ring-4 ring-emerald-100' : ''}
                  `}
                >
                  <StepIcon className="w-5 h-5" />
                </motion.div>
                <span className={`
                  text-xs sm:text-sm font-medium text-center
                  ${isCompleted ? 'text-slate-800' : 'text-slate-400'}
                `}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}