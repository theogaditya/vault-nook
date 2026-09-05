/**
 * Nook Onboarding Tour
 * Shown once to new users after their first successful vault unlock.
 * Non-skippable: user must click through all steps.
 * State persisted in localStorage so it only shows once.
 * Fully mobile responsive & touch optimized.
 */

import React, { useState } from 'react';
import {
  Shield,
  FolderPlus,
  Upload,
  Key,
  Smartphone,
  ChevronRight,
  ChevronLeft,
  Lock,
  FileText,
  CheckCircle2,
} from 'lucide-react';

const TOUR_STORAGE_KEY = 'nook_tour_completed';

export function hasCompletedTour(userId?: string): boolean {
  try {
    if (userId && localStorage.getItem(`nook_tour_completed_${userId}`) === '1') {
      return true;
    }
    return localStorage.getItem(TOUR_STORAGE_KEY) === '1';
  } catch {
    return true; // if storage fails, don't block the user
  }
}

export function markTourCompleted(userId?: string) {
  try {
    localStorage.setItem(TOUR_STORAGE_KEY, '1');
    if (userId) {
      localStorage.setItem(`nook_tour_completed_${userId}`, '1');
    }
  } catch {}
}

const steps = [
  {
    icon: Shield,
    iconColor: '#a5d6a7',
    step: '01',
    title: 'Welcome to Nook',
    body: 'Everything you store here is encrypted in your browser before it ever leaves your device. Even we cannot read your files — your passphrase is your key, and it never leaves you.',
    hint: null,
  },
  {
    icon: Key,
    iconColor: '#EAB308',
    step: '02',
    title: 'Save your Vault ID',
    body: 'Your Vault ID is the only identifier for your account. There is no email, no username, and no password reset. Copy it now from the account menu (top-right) and keep it somewhere safe.',
    hint: 'Top-right → Account Icon → Vault ID is shown there',
  },
  {
    icon: Upload,
    iconColor: '#818cf8',
    step: '03',
    title: 'Upload & organise files',
    body: 'Click Upload to add files, or drag-and-drop them anywhere on the page. Use New Folder to organise your vault. You can upload whole folders — the entire folder tree is preserved.',
    hint: 'Supported: documents, images, spreadsheets, code, and more',
  },
  {
    icon: FileText,
    iconColor: '#cac6c3',
    step: '04',
    title: 'Write encrypted notes',
    body: 'Click New Note to open the built-in Markdown editor. Notes are encrypted and stored in your vault just like any other file — great for passwords, ideas, or private journals.',
    hint: null,
  },
  {
    icon: Smartphone,
    iconColor: '#f59e0b',
    step: '05',
    title: 'Add your Recovery Kit',
    body: 'If you lose access to your device, the Recovery Kit is your only way back in. Go to Recovery Kit in the sidebar right now and generate your emergency key — store it offline.',
    hint: 'Skip this and lose your device → lose your vault. Permanently.',
  },
];

interface OnboardingTourProps {
  onComplete: () => void;
}

export function OnboardingTour({ onComplete }: OnboardingTourProps) {
  const [step, setStep] = useState(0);
  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;
  const Icon = current.icon;

  const handleNext = () => {
    if (isLast) {
      markTourCompleted();
      onComplete();
    } else {
      setStep((s) => s + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirst) {
      setStep((s) => s - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-[#0f0e0d]/90 backdrop-blur-md flex items-center justify-center p-3 sm:p-4">
      <div className="w-full max-w-lg max-h-[92vh] bg-[#141312] border border-[#4b4640] shadow-2xl flex flex-col overflow-hidden">

        {/* Progress Bar */}
        <div className="flex h-1 bg-[#201f1e] shrink-0">
          {steps.map((_, i) => (
            <div
              key={i}
              className="flex-1 transition-all duration-500"
              style={{ background: i <= step ? '#e6e1df' : 'transparent' }}
            />
          ))}
        </div>

        {/* Step Content Scroll Container */}
        <div className="p-5 sm:p-8 space-y-4 sm:space-y-6 overflow-y-auto flex-1">
          {/* Step badge */}
          <div className="flex items-center gap-3">
            <span className="font-space-mono text-[10px] sm:text-[11px] text-[#636363] tracking-widest uppercase">
              Step {current.step} of {steps.length}
            </span>
            <div className="flex-1 h-px bg-[#4b4640]" />
          </div>

          {/* Icon */}
          <div
            className="w-12 h-12 sm:w-14 sm:h-14 border border-[#4b4640] bg-[#0f0e0d] flex items-center justify-center shrink-0"
            style={{ boxShadow: `0 0 20px ${current.iconColor}18` }}
          >
            <Icon className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: current.iconColor }} />
          </div>

          {/* Text */}
          <div className="space-y-2.5 sm:space-y-3">
            <h2 className="font-garamond text-[22px] sm:text-[28px] leading-tight text-[#e6e2e0]">
              {current.title}
            </h2>
            <p className="font-sans text-[13px] sm:text-[14px] text-[#cdc5bd] leading-relaxed">
              {current.body}
            </p>
            {current.hint && (
              <div className="flex items-start gap-2 p-2.5 sm:p-3 border border-[#4b4640] bg-[#0f0e0d]">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#636363] mt-0.5 shrink-0" />
                <span className="font-space-mono text-[10px] sm:text-[11px] text-[#cdc5bd] leading-relaxed">
                  {current.hint}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-5 pb-5 sm:px-8 sm:pb-8 pt-2 flex items-center justify-between gap-3 shrink-0 bg-[#141312] border-t border-[#4b4640]/40">
          {/* Step dots & Prev Button */}
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                onClick={handlePrev}
                className="p-2 border border-[#4b4640] text-[#cdc5bd] hover:text-[#e6e2e0] hover:bg-[#201f1e] transition cursor-pointer"
                title="Previous step"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            )}
            <div className="flex items-center gap-1.5">
              {steps.map((_, i) => (
                <div
                  key={i}
                  className="w-1.5 h-1.5 transition-all duration-300"
                  style={{
                    background: i === step ? '#e6e1df' : i < step ? '#636363' : '#4b4640',
                  }}
                />
              ))}
            </div>
          </div>

          {/* CTA */}
          <button
            onClick={handleNext}
            className="flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-[#e6e1df] text-[#1d1b1a] font-space-mono text-[11px] font-bold uppercase tracking-widest hover:bg-[#cac6c3] transition cursor-pointer shrink-0"
          >
            {isLast ? (
              <>
                <Lock className="w-3.5 h-3.5" />
                <span>Enter Vault</span>
              </>
            ) : (
              <>
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
