/**
 * Nook React Error Boundary — catches render/decryption crashes gracefully
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props { children: ReactNode; }
interface State { hasError: boolean; errorMessage: string; }

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Nook ErrorBoundary]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: '#0a0e1a', color: '#e2e8f0', fontFamily: "'Inter', sans-serif",
          flexDirection: 'column', gap: '16px', padding: '32px',
        }}>
          <div style={{ fontSize: '48px' }}>🔒</div>
          <h2 style={{ margin: 0, color: '#f87171', fontSize: '20px' }}>Something went wrong</h2>
          <p style={{ color: '#94a3b8', maxWidth: '400px', textAlign: 'center', lineHeight: '1.6' }}>
            {this.state.errorMessage.includes('decrypt') || this.state.errorMessage.includes('operation')
              ? 'Decryption failed — your passphrase may be incorrect, or data may be corrupted.'
              : this.state.errorMessage}
          </p>
          <button
            onClick={() => { this.setState({ hasError: false, errorMessage: '' }); window.location.reload(); }}
            style={{
              background: 'linear-gradient(135deg, #3b82f6, #6366f1)', color: 'white',
              border: 'none', borderRadius: '8px', padding: '10px 24px', cursor: 'pointer',
              fontSize: '14px', fontWeight: 600,
            }}
          >
            Reload Nook
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
