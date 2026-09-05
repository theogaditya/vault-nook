/**
 * Nook Editorial Landing Page
 * "Your private corner of the cloud."
 */

import React, { useEffect, useState } from 'react';
import { Key, Lock } from 'lucide-react';
import AuthScreen from './AuthScreen';
import { InfoModal, InfoModalType } from './InfoModal';
import { SiteFooter } from './SiteFooter';

interface LandingPageProps {
  onOpenAuth?: (tab?: 'create-passphrase' | 'welcome' | 'recovery') => void;
}

export function LandingPage({ onOpenAuth }: LandingPageProps) {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [infoModalType, setInfoModalType] = useState<InfoModalType>(null);
  const [activeSectionId, setActiveSectionId] = useState<string>('section-01');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Reveal initial elements
    const timer = setTimeout(() => {
      const heroEls = document.querySelectorAll('.hero-reveal');
      heroEls.forEach(el => el.classList.add('is-visible'));
    }, 80);

    // Scroll reveal observer
    const observerOptions = {
      root: null,
      rootMargin: '0px',
      threshold: 0.12,
    };

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, observerOptions);

    const revealEls = document.querySelectorAll('.reveal');
    revealEls.forEach((el) => observer.observe(el));

    // Scrollspy scroll handler for right-side mini lines
    const sections = ['section-01', 'section-02', 'section-03', 'section-04'];
    const handleScroll = () => {
      const scrollPos = window.scrollY + window.innerHeight / 3;
      for (let i = sections.length - 1; i >= 0; i--) {
        const el = document.getElementById(sections[i]);
        if (el && el.offsetTop <= scrollPos) {
          setActiveSectionId(sections[i]);
          break;
        }
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      clearTimeout(timer);
      observer.disconnect();
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  const handleCreateClick = () => {
    if (onOpenAuth) onOpenAuth();
  };

  const scrollToSection = (id: string) => {
    setMobileMenuOpen(false);
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="bg-[#141312] text-[#e6e2e0] font-sans antialiased selection:bg-[#cac6c3] selection:text-[#32302f] min-h-screen relative">
      {/* Right Side Unlabeled 4 Mini-Lines Scrollspy (PC only) */}
      <aside
        className="fixed right-6 sm:right-10 top-1/2 -translate-y-1/2 z-40 hidden md:flex flex-col gap-4 items-end"
        aria-label="Scrollspy navigation"
      >
        {[
          { id: 'section-01' },
          { id: 'section-02' },
          { id: 'section-03' },
          { id: 'section-04' },
        ].map(({ id }) => {
          const isActive = activeSectionId === id;
          return (
            <button
              key={id}
              onClick={() => scrollToSection(id)}
              className="p-2 focus:outline-none cursor-pointer touch-manipulation flex items-center justify-end group"
            >
              <span
                className={`block transition-all duration-300 rounded-full ${
                  isActive
                    ? 'w-8 h-[3px] bg-[#EAB308] shadow-[0_0_10px_rgba(234,179,8,0.6)]'
                    : 'w-4 h-[2px] bg-[#4b4640] group-hover:w-6 group-hover:bg-[#cdc5bd]'
                }`}
              />
            </button>
          );
        })}
      </aside>

      {/* Top Navigation Bar */}
      <header className="bg-[#141312] w-full top-0 sticky border-b border-[#4b4640] z-50">
        {/* Desktop Layout (md:flex) — Unchanged */}
        <div className="hidden md:flex justify-between items-center w-full px-6 md:px-10 py-6 max-w-screen-2xl mx-auto gap-3">
          <div className="font-garamond text-[32px] text-[#e6e2e0] tracking-tight leading-none shrink-0">
            Nook
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleCreateClick}
              className="btn-editorial font-space-mono text-[11px] font-bold px-6 py-3 tracking-widest text-[#e6e2e0] uppercase cursor-pointer truncate"
            >
              Create your Nook
            </button>
          </div>
        </div>

        {/* Mobile Layout (md:hidden) — Matches exact design mockup */}
        <div className="flex md:hidden items-center justify-between w-full px-4 py-3.5 relative">
          {/* Left: Hamburger Icon */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-[#e6e2e0] hover:text-[#EAB308] transition-colors cursor-pointer touch-manipulation z-10"
            aria-label="Toggle menu"
          >
            <div className="w-5 h-[2px] bg-current mb-1.5" />
            <div className="w-5 h-[2px] bg-current mb-1.5" />
            <div className="w-5 h-[2px] bg-current" />
          </button>

          {/* Center: NOOK Title */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="font-garamond text-[28px] sm:text-[32px] font-normal uppercase tracking-[0.2em] text-[#e6e2e0] leading-none">
              NOOK
            </span>
          </div>

          {/* Right: CREATE Button */}
          <button
            onClick={handleCreateClick}
            className="border border-[#4b4640] hover:border-[#cac6c3] px-3 py-1.5 font-space-mono text-[10px] font-bold tracking-widest text-[#e6e2e0] uppercase transition-colors cursor-pointer shrink-0 z-10"
          >
            CREATE
          </button>
        </div>

        {/* Mobile Slide-Down Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden bg-[#0f0e0d] border-t border-[#4b4640] px-4 py-3 space-y-1">
            {[
              { id: 'section-01', label: 'HOW IT WORKS' },
              { id: 'section-02', label: 'MECHANICS' },
              { id: 'section-03', label: 'DIVERGENCE' },
              { id: 'section-04', label: 'FAQ' },
            ].map(({ id, label }) => (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className="w-full text-left px-3 py-2.5 font-space-mono text-[12px] font-bold text-[#cdc5bd] hover:text-[#EAB308] hover:bg-[#141312] transition-colors cursor-pointer tracking-widest uppercase"
              >
                {label}
              </button>
            ))}
            <div className="pt-2 border-t border-[#4b4640]">
              <button
                onClick={() => { setMobileMenuOpen(false); handleCreateClick(); }}
                className="w-full text-left px-3 py-2.5 font-space-mono text-[12px] font-bold text-[#e6e2e0] bg-[#201f1e] hover:bg-[#2a2826] transition-colors cursor-pointer tracking-widest uppercase"
              >
                Create your Nook →
              </button>
            </div>
          </div>
        )}
      </header>

      <main className="w-full max-w-screen-2xl mx-auto px-6 md:px-10">
        {/* Hero Section */}
        <section className="min-h-[720px] flex flex-col md:flex-row items-center py-16 md:py-24 border-b border-[#4b4640] border-trace">
          <div className="w-full md:w-1/2 pr-0 md:pr-12 reveal is-visible">
            <div className="font-space-mono text-[13px] text-[#EAB308] uppercase tracking-widest mb-4 reveal is-visible">
              <span className="inline-block w-2 h-2 rounded-full bg-[#EAB308] mr-2 animate-pulse" />
              Zero-Knowledge Architecture
            </div>
            <h1 className="font-garamond text-[44px] sm:text-[56px] md:text-[80px] leading-[1.0] tracking-[-0.03em] mb-8 max-w-2xl text-[#e6e2e0] reveal is-visible">
              Your private corner of the Internet.
            </h1>
            {/* <p className="font-sans text-[18px] leading-[1.6] text-[#cdc5bd] mb-12 max-w-md reveal delay-100 is-visible">
              Keep what’s yours.
            </p> */}
            <button
              onClick={handleCreateClick}
              className="btn-editorial font-space-mono text-[11px] font-bold px-8 py-4 tracking-widest text-[#e6e2e0] uppercase reveal delay-200 is-visible cursor-pointer mb-10"
            >
              Create your Nook
            </button>

            <div className="space-y-4 mb-8 reveal delay-300 is-visible">
              <div className="flex items-center gap-4 font-sans text-[15px] text-[#cdc5bd]">
                <span className="font-space-mono text-[13px] font-bold text-[#EAB308]">01</span>
                <span>Create a passkey</span>
              </div>
              <div className="flex items-center gap-4 font-sans text-[15px] text-[#cdc5bd]">
                <span className="font-space-mono text-[13px] font-bold text-[#EAB308]">02</span>
                <span>Set your vault passphrase</span>
              </div>
              <div className="flex items-center gap-4 font-sans text-[15px] text-[#cdc5bd]">
                <span className="font-space-mono text-[13px] font-bold text-[#EAB308]">03</span>
                <span>Explor your private space</span>
              </div>
            </div>

            <p className="font-space-mono text-[11px] text-[#636363] uppercase tracking-widest reveal delay-300 is-visible">
              NO EMAIL OR PHONE NUMBER REQUIRED.
            </p>
          </div>

          {/* Interactive Abstract SVG Diagram */}
          <div className="w-full md:w-1/2 h-full min-h-[380px] mt-12 md:mt-0 flex items-center justify-center relative reveal delay-300 is-visible">
            <div className="w-full max-w-lg text-[#cdc5bd]">
              <svg className="w-full h-auto overflow-visible" viewBox="0 0 800 400" fill="none" xmlns="http://www.w3.org/2000/svg">
                {/* Outer Dashed Orbit */}
                <circle className="opacity-20 animate-ring-rotate" cx="400" cy="200" r="150" stroke="currentColor" strokeDasharray="4 6" strokeWidth="1" />
                {/* Inner Orbit Ring */}
                <circle className="opacity-40" cx="400" cy="200" r="95" stroke="currentColor" strokeWidth="1" />
                {/* Signal Rays */}
                <line x1="250" y1="200" x2="305" y2="200" stroke="#EAB308" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
                <line x1="495" y1="200" x2="550" y2="200" stroke="#EAB308" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
                <line x1="400" y1="50" x2="400" y2="105" stroke="#EAB308" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
                <line x1="400" y1="295" x2="400" y2="350" stroke="#EAB308" strokeWidth="1" strokeDasharray="2 4" opacity="0.6" />
                {/* Central Yellow Core */}
                <g className="animate-core-pulse">
                  <circle cx="400" cy="200" r="48" fill="#EAB308" />
                  {/* Lock Icon inside Core */}
                  <path d="M388 195H412V212H388V195ZM391 195V189C391 183.5 395.5 179 400 179C404.5 179 409 183.5 409 189V195" stroke="#141312" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </g>
              </svg>
            </div>
          </div>
        </section>

        {/* The Problem (Section 01) */}
        <section id="section-01" className="py-20 border-b border-[#4b4640] border-trace reveal">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
            <div className="col-span-1 md:col-span-3">
              <span className="font-space-mono text-[13px] tracking-[0.05em] text-[#cdc5bd] block mb-4">01 / THE DEFAULT</span>
            </div>
            <div className="col-span-1 md:col-span-9">
              {/* Word-by-word stagger animation */}
              <p className="font-garamond text-[28px] md:text-[36px] text-[#e6e2e0] max-w-4xl leading-[1.3]">
                {[
                  'Cloud', 'drives', 'can', 'read', 'your', 'files.',
                  'Their', 'employees', 'can', 'see', 'your', 'data.',
                  'Subpoenas', 'can', 'bypass', 'your', 'privacy.',
                  'We', 'built', 'a', 'different', 'one.'
                ].map((word, i) => (
                  <span
                    key={i}
                    className="inline-block opacity-0 translate-y-2 word-reveal"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    {word}&nbsp;
                  </span>
                ))}
              </p>
            </div>
          </div>
        </section>

        {/* No-Data Manifesto */}
        <section className="py-24 border-b border-[#4b4640] border-trace reveal">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
            {/* Left: Big quote */}
            <div className="col-span-1 md:col-span-7">
              <p className="font-garamond text-[32px] sm:text-[42px] md:text-[52px] leading-[1.15] text-[#e6e2e0] italic mb-8">
                "We maintain a strict no-email policy. If we are breached, the attackers get nothing but noise. Your device is the key."
              </p>
              {/* <p className="font-sans text-[16px] text-[#cdc5bd] leading-relaxed max-w-lg">
                We designed Nook around a simple truth — data you never collect can never be stolen, subpoenaed, or sold. There is no registration form. No profile. No user record.
              </p> */}
            </div>

            {/* Right: Never-collected list */}
            <div className="col-span-1 md:col-span-5">
              <div className="border border-[#4b4640] p-6 md:p-8">
                <div className="mb-6">
                  <span className="font-space-mono text-[10px] font-bold tracking-widest text-[#636363] uppercase block mb-1">
                    What we never ask for
                  </span>
                  <div className="w-8 h-px bg-[#4b4640] mt-3" />
                </div>

                <div className="space-y-0 divide-y divide-[#4b4640]">
                  {[
                    { field: 'Email address', note: 'None. Not even for recovery.' },
                    { field: 'Phone number', note: 'We have no SMS / OTP system.' },
                    { field: 'Your real name', note: 'You get a random vault ID.' },
                    { field: 'File metadata', note: 'Names & types are encrypted.' },
                  ].map(({ field, note }) => (
                    <div key={field} className="py-4 flex items-start justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <span className="w-4 h-px bg-[#ffb4ab] inline-block shrink-0 mt-2.5" />
                        <div>
                          <span className="font-space-mono text-[13px] font-bold text-[#e6e2e0] line-through decoration-[#ffb4ab] decoration-1">
                            {field}
                          </span>
                          <p className="font-space-mono text-[11px] text-[#636363] mt-0.5">{note}</p>
                        </div>
                      </div>
                      <span className="font-space-mono text-[10px] font-bold text-[#ffb4ab] shrink-0 mt-0.5 uppercase tracking-widest">
                        NEVER
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-6 pt-5 border-t border-[#4b4640]">
                  <p className="font-space-mono text-[11px] text-[#636363] leading-relaxed">
                    Your only identity is a cryptographic passkey bound to your hardware.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* How it Works (Section 02 / MECHANICS) */}
        <section id="section-02" className="py-20 border-b border-[#4b4640] border-trace reveal">
          <div className="mb-16">
            <span className="font-space-mono text-[13px] tracking-[0.05em] text-[#cdc5bd] block mb-6">02 / MECHANICS</span>
            <h2 className="font-garamond text-[40px] sm:text-[52px] md:text-[64px] text-[#e6e2e0] leading-[1.05] tracking-[-0.02em] reveal delay-100">
              The three keys to your Nook.
            </h2>
          </div>

          {/* Three Keys Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12 md:gap-16 mb-20 reveal delay-200">
            <div>
              <div className="h-8 flex items-center mb-6">
                <Key className="w-6 h-6 text-[#EAB308]" />
              </div>
              <h3 className="font-garamond text-[28px] md:text-[34px] text-[#e6e2e0] leading-tight mb-3">
                Passkey
              </h3>
              <p className="font-sans text-[15px] leading-[1.6] text-[#cdc5bd]">
                Proves this is your device. Hardware-bound security that replaces traditional email and password.
              </p>
            </div>

            <div>
              <div className="h-8 flex items-center mb-6">
                <Lock className="w-6 h-6 text-[#EAB308]" />
              </div>
              <h3 className="font-garamond text-[28px] md:text-[34px] text-[#e6e2e0] leading-tight mb-3">
                Vault passphrase
              </h3>
              <p className="font-sans text-[15px] leading-[1.6] text-[#cdc5bd]">
                Unlocks your encrypted vault. Known only to you, never stored on our servers. Your password never leaves your device.
              </p>
            </div>

            <div>
              <div className="h-8 flex items-center mb-6">
                <span className="font-space-mono text-[14px] font-bold text-[#EAB308] tracking-wider uppercase">
                  SOS
                </span>
              </div>
              <h3 className="font-garamond text-[28px] md:text-[34px] text-[#e6e2e0] leading-tight mb-3">
                Recovery phrase
              </h3>
              <p className="font-sans text-[15px] leading-[1.6] text-[#cdc5bd]">
                Lets you recover your vault if you lose access to your devices. Your ultimate fail-safe.
              </p>
            </div>
          </div>

          {/* Technical Step Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#4b4640]">
            {[
              // {
              //   step: 'STEP 01',
              //   proto: 'ARGON2ID WASM',
              //   title: 'Memory-Hard KDF',
              //   body: 'Vault keys are generated using heavy cryptographic hashing, making GPU/ASIC brute-force attacks infeasible.',
              //   tag: 'GPU-RESISTANT KEY ENGINE',
              // },
              // {
              //   step: 'STEP 01',
              //   proto: 'AES-256-GCM',
              //   title: 'Local Encryption',
              //   body: 'Your files are encrypted inside your browser before a single byte touches the network.',
              //   tag: 'ZERO-KNOWLEDGE ENCRYPTION',
              // },
              // {
              //   step: 'STEP 02',
              //   proto: 'WEBAUTHN PASSKEY',
              //   title: 'Biometric Hardware Auth',
              //   body: 'Vault authentication is bound directly to your physical hardware. Your password never leaves your device.',
              //   tag: 'HARDWARE-BOUND ACCESS',
              // },
              // {
              //   step: 'STEP 03',
              //   proto: 'ZERO-RESIDUE LOGOUT',
              //   title: 'Ephemeral Local Memory',
              //   body: 'Logging out instantly wipes all decrypted file buffers, keys, and cached data from browser memory.',
              //   tag: 'VOLATILE MEMORY PURGE',
              // },
            ].map(({ step, proto, title, body, tag }, i) => (
              <div
                key={step}
                className={`bg-[#141312] p-8 flex flex-col gap-6 reveal`}
                style={{ animationDelay: `${i * 120}ms` }}
              >
                <div className="flex items-center justify-between">
                  <span className="font-space-mono text-[11px] font-bold text-[#636363] uppercase tracking-widest">{step}</span>
                  <span className="font-space-mono text-[10px] text-[#EAB308] border border-[#EAB308]/30 px-2 py-0.5 tracking-widest">{proto}</span>
                </div>
                <div>
                  <h3 className="font-garamond text-[28px] leading-tight mb-3 text-[#e6e2e0]">{title}</h3>
                  <p className="font-sans text-[14px] leading-[1.7] text-[#cdc5bd]">{body}</p>
                </div>
                <div className="mt-auto pt-4 border-t border-[#4b4640]">
                  <span className="font-space-mono text-[10px] text-[#636363] tracking-widest">{tag}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Comparison (Section 03 / DIVERGENCE) */}
        <section id="section-03" className="py-20 border-b border-[#4b4640] border-trace reveal">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
            <div className="col-span-1 md:col-span-3">
              <span className="font-space-mono text-[13px] tracking-[0.05em] text-[#cdc5bd] block">03 / DIVERGENCE</span>
            </div>
            <div className="col-span-1 md:col-span-9 space-y-4">
              <h2 className="font-garamond text-[36px] sm:text-[48px] md:text-[56px] text-[#e6e2e0] leading-[1.1] tracking-[-0.02em] reveal delay-100">
                Is Nook a Google Drive replacement?
              </h2>
              <p className="font-garamond text-[22px] md:text-[26px] text-[#EAB308] italic reveal delay-200">
                Not exactly. And that's the point.
              </p>
              <p className="font-sans text-[16px] md:text-[18px] font-medium text-[#e6e2e0] leading-relaxed max-w-3xl reveal delay-200">
                Nook is built for a different priority - privacy over convenience.
              </p>
              {/* <p className="font-sans text-[15px] text-[#cdc5bd] leading-relaxed max-w-3xl reveal delay-300">
                Traditional cloud drives are designed around collaboration, integrations, sharing, and seamless recovery. Nook is designed around keeping your files cryptographically inaccessible to the cloud.
              </p> */}
            </div>
          </div>

          {/* Comparison Rows Data */}
          {(() => {
            const comparisonRows = [
              {
                traditional: 'The provider can access your files',
                nook: 'Only you can decrypt your files',
              },
              {
                traditional: 'Passwords & email-based access',
                nook: 'Hardware-backed passkeys. No passwords. No email.',
              },
              {
                traditional: 'Provider-managed encryption keys',
                nook: 'Your vault keys never leave your device',
              },
              {
                traditional: 'Plaintext can exist during sessions',
                nook: 'Logout clears keys, decrypted buffers & cached data',
              },
              {
                traditional: 'Privacy depends on trusting the provider',
                nook: 'Zero-knowledge by design',
              },
            ];

            return (
              <>
                {/* Mobile View: Stacked TRADITIONAL CLOUD first, then NOOK */}
                <div className="block md:hidden space-y-6">
                  {/* Traditional Cloud Block */}
                  <div className="border border-[#4b4640] bg-[#141312]">
                    <div className="p-4 bg-[#1c1b1a] border-b border-[#4b4640]">
                      <span className="font-space-mono text-[12px] font-bold tracking-widest text-[#cdc5bd] uppercase block">
                        TRADITIONAL CLOUD
                      </span>
                    </div>
                    <div className="divide-y divide-[#4b4640]/60">
                      {comparisonRows.map((row, idx) => (
                        <div key={idx} className="p-4 flex items-center gap-3">
                          <span className="w-1.5 h-1.5 bg-[#ffb4ab] rounded-full shrink-0" />
                          <span className="font-sans text-[14px] font-semibold text-[#cdc5bd] leading-snug">
                            {row.traditional}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Nook Block */}
                  <div className="border border-[#4b4640] bg-[#141312] border-l-2 border-l-[#EAB308]">
                    <div className="p-4 bg-[#1c1b1a] border-b border-[#4b4640]">
                      <span className="font-space-mono text-[12px] font-bold tracking-widest text-[#EAB308] uppercase block">
                        NOOK
                      </span>
                    </div>
                    <div className="divide-y divide-[#4b4640]/60">
                      {comparisonRows.map((row, idx) => (
                        <div key={idx} className="p-4 bg-[#181716] flex items-center gap-3">
                          <span className="w-1.5 h-1.5 bg-[#EAB308] rounded-full shrink-0" />
                          <span className="font-sans text-[14px] font-semibold text-[#e6e2e0] leading-snug">
                            {row.nook}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* PC / Desktop View: 2-Column Side-by-Side Table */}
                <div className="hidden md:block border border-[#4b4640] bg-[#141312] overflow-hidden">
                  {/* Table Header */}
                  <div className="grid grid-cols-2 border-b border-[#4b4640] bg-[#1c1b1a]">
                    <div className="p-6 md:p-8 border-r border-[#4b4640]">
                      <span className="font-space-mono text-[12px] md:text-[13px] font-bold tracking-widest text-[#cdc5bd] uppercase block">
                        TRADITIONAL CLOUD
                      </span>
                    </div>
                    <div className="p-6 md:p-8 bg-[#1c1b1a] border-l-2 border-[#EAB308]">
                      <span className="font-space-mono text-[12px] md:text-[13px] font-bold tracking-widest text-[#EAB308] uppercase block">
                        NOOK
                      </span>
                    </div>
                  </div>

                  {/* Table Rows */}
                  {comparisonRows.map((row, idx, arr) => (
                    <div
                      key={idx}
                      className={`grid grid-cols-2 ${idx < arr.length - 1 ? 'border-b border-[#4b4640]/60' : ''}`}
                    >
                      <div className="p-6 md:p-8 border-r border-[#4b4640]/60 flex items-center">
                        <span className="font-sans text-[15px] font-semibold text-[#cdc5bd] leading-snug">
                          {row.traditional}
                        </span>
                      </div>
                      <div className="p-6 md:p-8 bg-[#181716] border-l-2 border-[#EAB308]/40 flex items-center">
                        <span className="font-sans text-[15px] font-semibold text-[#e6e2e0] leading-snug">
                          {row.nook}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            );
          })()}
        </section>

        {/* FAQ Section (Section 04 / FAQ) */}
        <section id="section-04" className="py-20 border-b border-[#4b4640] border-trace reveal">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
            <div className="col-span-1 md:col-span-3">
              <span className="font-space-mono text-[13px] tracking-[0.05em] text-[#cdc5bd] block">04 / FAQ</span>
            </div>
            <div className="col-span-1 md:col-span-9 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
              <div>
                <h2 className="font-garamond text-[40px] sm:text-[52px] md:text-[64px] text-[#e6e2e0] leading-[1.05] tracking-[-0.02em] reveal delay-100">
                  Frequently Asked Questions
                </h2>
              </div>
              <button
                onClick={() => setInfoModalType('faq')}
                className="btn-editorial font-space-mono text-[11px] font-bold px-6 py-3 tracking-widest text-[#EAB308] border border-[#EAB308]/40 uppercase cursor-pointer shrink-0"
              >
                View Full FAQ
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="border border-[#4b4640] bg-[#141312] p-6 space-y-3">
              <span className="font-space-mono text-[10px] text-[#EAB308] uppercase tracking-widest block">USING NOOK</span>
              <h3 className="font-garamond text-[22px] text-[#e6e2e0]">What files can I store?</h3>
              <p className="font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
                PDF, DOCX, XLSX, images, video, audio, ZIP, EXE, text, Markdown, and binary. Unsupported formats can be stored and downloaded seamlessly.
              </p>
            </div>

            <div className="border border-[#4b4640] bg-[#141312] p-6 space-y-3">
              <span className="font-space-mono text-[10px] text-[#EAB308] uppercase tracking-widest block">ACCOUNT SECURITY</span>
              <h3 className="font-garamond text-[22px] text-[#e6e2e0]">Why no email address?</h3>
              <p className="font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
                Your identity does not depend on email accounts or passwords. There is no email password-reset vulnerability vector.
              </p>
            </div>

            <div className="border border-[#4b4640] bg-[#141312] p-6 space-y-3">
              <span className="font-space-mono text-[10px] text-[#EAB308] uppercase tracking-widest block">ZERO-KNOWLEDGE</span>
              <h3 className="font-garamond text-[22px] text-[#e6e2e0]">Can Nook employees read my files?</h3>
              <p className="font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
                No. Nook possesses zero plaintext master keys. Having backend or server access provides no ability to decrypt your files.
              </p>
            </div>

            <div className="border border-[#4b4640] bg-[#141312] p-6 space-y-3">
              <span className="font-space-mono text-[10px] text-[#EAB308] uppercase tracking-widest block">COMPARISON</span>
              <h3 className="font-garamond text-[22px] text-[#e6e2e0]">Is Nook a Google Drive replacement?</h3>
              <p className="font-sans text-[14px] text-[#cdc5bd] leading-relaxed">
                Nook is built for <strong className="text-[#e6e2e0]">Privacy First</strong>. If your priority is keeping files encrypted and out of host hands, Nook is engineered for you.
              </p>
            </div>
          </div>
        </section>


        {/* Closing Call to Action */}
        <section className="py-24 text-center flex flex-col items-center justify-center min-h-[480px] reveal">
          <h2 className="font-garamond text-[40px] sm:text-[56px] md:text-[80px] leading-[1.0] mb-8 max-w-4xl text-[#e6e2e0] reveal delay-100">
            Encrypted before it leaves your device. Not after.
          </h2>
          <button
            onClick={handleCreateClick}
            className="btn-editorial font-space-mono text-[11px] font-bold px-8 py-4 tracking-widest text-[#e6e2e0] uppercase mt-4 reveal delay-200 cursor-pointer"
          >
            Create your Nook
          </button>
        </section>
      </main>

      <SiteFooter onSelectInfo={setInfoModalType} />

      <InfoModal type={infoModalType} onClose={() => setInfoModalType(null)} />
    </div>
  );
}
