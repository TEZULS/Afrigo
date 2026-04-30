import React from 'react';
import { Button } from "@/components/ui/button";
import { AlertTriangle } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-8 h-8 text-rose-600" />
            </div>
            <h2 className="text-2xl font-bold text-slate-800 mb-2">
              Oups, une erreur est survenue
            </h2>
            <p className="text-slate-600 mb-6">
              Quelque chose s'est mal passé. Veuillez réessayer.
            </p>
            <Button
              onClick={() => window.location.reload()}
              className="w-full h-12 bg-emerald-500 hover:bg-emerald-600 rounded-xl"
            >
              Actualiser la page
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;