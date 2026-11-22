'use client';

import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Terjadi kesalahan pada aplikasi.' };
  }

  render() {
    if (this.state.hasError) {
      let friendly = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message) as { error?: string; path?: string; operationType?: string };
        if (parsed.error) {
          friendly = `${parsed.error} (${parsed.operationType || 'operasi'} pada ${parsed.path || 'database'})`;
        }
      } catch {
        // non-JSON error message
      }
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#FCFAF6] p-6 text-[#394536]">
          <div className="max-w-lg w-full bg-white border border-[#E5DFD3] rounded-xl p-8 text-center">
            <h2 className="font-serif text-2xl font-semibold mb-2">Terjadi Gangguan Sistem</h2>
            <p className="text-sm text-[#817B72] mb-6 leading-relaxed">{friendly}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-[#87977B] text-white text-sm font-medium rounded-lg hover:opacity-90 transition-opacity"
            >
              Muat Ulang Halaman
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
