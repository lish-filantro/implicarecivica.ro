'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import {
  AlertCircle,
  CheckCircle,
  Info,
  Zap,
  TrendingUp,
  Calendar,
  Mail,
  FileText,
  Sun,
  Moon
} from 'lucide-react';

export default function DesignDemoPage() {
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    // Check initial dark mode preference
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);

    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-12">

        {/* Dark Mode Toggle - Fixed top-right */}
        <div className="fixed top-6 right-6 z-50">
          <button
            onClick={toggleDarkMode}
            className="btn-activist flex items-center gap-2 animate-pulse-activist"
            aria-label="Toggle dark mode"
          >
            {darkMode ? (
              <>
                <Sun className="w-5 h-5" />
                LIGHT MODE
              </>
            ) : (
              <>
                <Moon className="w-5 h-5" />
                DARK MODE
              </>
            )}
          </button>
        </div>

        {/* Header */}
        <header className="text-center space-y-4">
          <div className="flex justify-center mb-6">
            <Image
              src="/assets/implicare_civica_logo_navbar.png"
              alt="Implicare Civică"
              width={180}
              height={60}
              className="h-16 w-auto"
              priority
            />
          </div>
          <h1 className="heading-civic">
            Modern Activist Design System
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto">
            Un design system modern, bold și accesibil pentru aplicații de activism civic
          </p>
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-activist-orange-100 dark:bg-activist-orange-900/30 rounded-lg border-2 border-activist-orange-500">
            <Zap className="w-5 h-5 text-activist-orange-600" />
            <span className="text-sm font-semibold text-activist-orange-700 dark:text-activist-orange-400">
              Click "DARK MODE" în dreapta-sus pentru a schimba tema! 🌙
            </span>
          </div>
        </header>

        {/* Color Palette */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Paleta de Culori</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

            {/* Civic Blue */}
            <div className="card-modern space-y-3">
              <h3 className="text-lg font-bold text-civic-blue-700 dark:text-civic-blue-400">
                Civic Blue
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Trust & Institutions
              </p>
              <div className="space-y-2">
                <div className="h-12 bg-civic-blue-500 rounded flex items-center justify-center text-white font-bold">
                  #1a66cc
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <div className="h-8 bg-civic-blue-100 rounded"></div>
                  <div className="h-8 bg-civic-blue-300 rounded"></div>
                  <div className="h-8 bg-civic-blue-500 rounded"></div>
                  <div className="h-8 bg-civic-blue-700 rounded"></div>
                  <div className="h-8 bg-civic-blue-900 rounded"></div>
                </div>
              </div>
            </div>

            {/* Activist Orange */}
            <div className="card-modern space-y-3">
              <h3 className="text-lg font-bold text-activist-orange-600">
                Activist Orange
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Action & Urgency
              </p>
              <div className="space-y-2">
                <div className="h-12 bg-activist-orange-500 rounded flex items-center justify-center text-white font-bold">
                  #ff6600
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <div className="h-8 bg-activist-orange-100 rounded"></div>
                  <div className="h-8 bg-activist-orange-300 rounded"></div>
                  <div className="h-8 bg-activist-orange-500 rounded"></div>
                  <div className="h-8 bg-activist-orange-700 rounded"></div>
                  <div className="h-8 bg-activist-orange-900 rounded"></div>
                </div>
              </div>
            </div>

            {/* Urban Gray */}
            <div className="card-modern space-y-3">
              <h3 className="text-lg font-bold text-urban-gray-700 dark:text-urban-gray-400">
                Urban Gray
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Neutral & Concrete
              </p>
              <div className="space-y-2">
                <div className="h-12 bg-urban-gray-500 rounded flex items-center justify-center text-white font-bold">
                  #6c757d
                </div>
                <div className="grid grid-cols-5 gap-1">
                  <div className="h-8 bg-urban-gray-100 rounded"></div>
                  <div className="h-8 bg-urban-gray-300 rounded"></div>
                  <div className="h-8 bg-urban-gray-500 rounded"></div>
                  <div className="h-8 bg-urban-gray-700 rounded"></div>
                  <div className="h-8 bg-urban-gray-900 rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Buttons - Modern Activist</h2>
          <div className="card-modern space-y-8">

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Primary Actions</h3>
              <div className="flex flex-wrap gap-4">
                <button className="btn-activist">
                  Trimite Cerere
                </button>
                <button className="btn-activist animate-pulse-activist">
                  ! Acțiune Urgentă !
                </button>
                <button className="btn-activist" disabled>
                  Dezactivat
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-semibold">Secondary Actions</h3>
              <div className="flex flex-wrap gap-4">
                <button className="btn-civic">
                  Vezi Detalii
                </button>
                <button className="btn-ghost-activist">
                  Anulează
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Cards */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Cards - Poster & Modern Style</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

            {/* Poster Card */}
            <div className="card-poster">
              <h3 className="card-poster-title">Cereri Active</h3>
              <div className="space-y-4">
                <div className="text-5xl font-black text-civic-blue-600 dark:text-civic-blue-400">
                  42
                </div>
                <p className="text-gray-600 dark:text-gray-400">
                  Cereri în curs de procesare
                </p>
                <button className="btn-activist w-full">
                  Vezi Toate
                </button>
              </div>
            </div>

            {/* Modern Card */}
            <div className="card-modern">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-activist-orange-100 dark:bg-activist-orange-900/30 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-activist-orange-600" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold mb-2">Statistici</h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-4">
                    Progres crescut cu 23% în ultima lună
                  </p>
                  <div className="flex gap-2">
                    <span className="badge-status badge-status-green">
                      <CheckCircle className="w-3 h-3" />
                      Activ
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Alerts */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Alerts - Modern Status Messages</h2>
          <div className="space-y-4">

            {/* Urgent Alert */}
            <div className="alert-urgent">
              <div className="alert-urgent-icon">
                <AlertCircle className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <div className="alert-urgent-title">Deadline Aproape</div>
                <p className="text-sm text-gray-700 dark:text-gray-300 mt-1">
                  Cererea #12345 expiră în 2 zile. Te rugăm să urmărești statusul.
                </p>
              </div>
            </div>

            {/* Success Alert */}
            <div className="alert-success">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-grassroots-green-600 dark:text-grassroots-green-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-grassroots-green-800 dark:text-grassroots-green-200">
                    Cerere Trimisă cu Succes
                  </p>
                  <p className="text-sm text-grassroots-green-700 dark:text-grassroots-green-300 mt-1">
                    Cererea ta a fost înregistrată și trimisă către instituție.
                  </p>
                </div>
              </div>
            </div>

            {/* Info Alert */}
            <div className="alert-info">
              <div className="flex items-start gap-3">
                <Info className="w-5 h-5 text-civic-blue-600 dark:text-civic-blue-400 mt-0.5" />
                <div>
                  <p className="font-semibold text-civic-blue-800 dark:text-civic-blue-200">
                    Informație Importantă
                  </p>
                  <p className="text-sm text-civic-blue-700 dark:text-civic-blue-300 mt-1">
                    Conform Legii 544/2001, termenul de răspuns este de 10 zile lucrătoare.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Badges */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Badges - Status Indicators</h2>
          <div className="card-modern space-y-6">

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Urgent Badge</h3>
              <div className="flex flex-wrap gap-3">
                <span className="badge-urgent">
                  <Zap className="w-3 h-3" />
                  3 Urgente
                  <Zap className="w-3 h-3" />
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-lg font-semibold">Status Badges</h3>
              <div className="flex flex-wrap gap-3">
                <span className="badge-status badge-status-green">
                  <CheckCircle className="w-3 h-3" />
                  Înregistrat
                </span>
                <span className="badge-status badge-status-yellow">
                  <Calendar className="w-3 h-3" />
                  Amânat
                </span>
                <span className="badge-status badge-status-red">
                  <AlertCircle className="w-3 h-3" />
                  Întârziat
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Typography */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Typography - Modern Activist</h2>
          <div className="card-modern space-y-8">

            <div className="space-y-4">
              <h1 className="heading-protest">
                Drepturile Tale Contează
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Heading Protest - Gradient text cu Oswald font
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="heading-civic">
                Activism Civic Digital
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                Heading Civic - Bold uppercase cu Oswald
              </p>
            </div>

            <div className="space-y-4">
              <p className="text-activist text-2xl text-activist-orange-600">
                Acționează Acum!
              </p>
              <p className="text-gray-600 dark:text-gray-400">
                Text Activist - Uppercase bold
              </p>
            </div>

            <div className="space-y-2">
              <p className="text-lg font-body">
                Acesta este un text normal folosind Inter font. Perfect pentru body text,
                foarte lizibil și modern cu suport complet pentru diacritice românești:
                ă, â, î, ș, ț.
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Body text - Inter font family
              </p>
            </div>
          </div>
        </section>

        {/* Inputs */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Form Inputs - Modern & Activist</h2>
          <div className="card-modern space-y-6">

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Input Modern
              </label>
              <input
                type="text"
                placeholder="Introdu numele instituției..."
                className="input-modern"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Input Activist (Brutalist Style)
              </label>
              <input
                type="text"
                placeholder="Subiectul cererii..."
                className="input-activist"
              />
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300">
                Textarea Modern
              </label>
              <textarea
                rows={4}
                placeholder="Conținutul cererii de informații publice..."
                className="input-modern resize-none"
              />
            </div>
          </div>
        </section>

        {/* Animations */}
        <section className="space-y-6">
          <h2 className="card-poster-title">Animations - Smooth & Modern</h2>
          <div className="card-modern">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Pulse Activist</h3>
                <button className="btn-activist animate-pulse-activist w-full">
                  Pulsing Button
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Shake Urgent</h3>
                <button className="btn-activist animate-shake-urgent w-full">
                  Shake on Hover
                </button>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Fade In</h3>
                <div className="p-4 bg-civic-blue-100 dark:bg-civic-blue-900/30 rounded-lg animate-fade-in">
                  Content fades in smoothly
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-lg font-semibold">Scale In</h3>
                <div className="p-4 bg-activist-orange-100 dark:bg-activist-orange-900/30 rounded-lg animate-scale-in">
                  Content scales in
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="text-center py-8 border-t-2 border-gray-200 dark:border-gray-700">
          <p className="text-activist text-sm text-gray-600 dark:text-gray-400">
            Modern Activist Design System
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
            Inspirat de 544-FULL-APP, modernizat pentru proiectul 544
          </p>
        </footer>
      </div>
    </div>
  );
}
