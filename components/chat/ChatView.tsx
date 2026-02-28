'use client';

import React from 'react';
import type { Message } from '@/lib/types/chat';
import { useAutoScroll } from '@/lib/hooks/useAutoScroll';
import { useEmailFields } from '@/lib/hooks/useEmailFields';
import MessageBubble from '@/components/chat/MessageBubble';
import TypingIndicator from '@/components/chat/TypingIndicator';
import EmailFieldSection from '@/components/chat/EmailFieldSection';
import EmailContentSection from '@/components/chat/EmailContentSection';
import EmailSolicitantSection from '@/components/chat/EmailSolicitantSection';

interface ChatViewProps {
  messages: Message[];
  inputMessage: string;
  setInputMessage: (value: string) => void;
  onSendMessage: () => void;
  isTyping: boolean;
  aiStatus: 'loading' | 'configured' | 'mock';
}

export default function ChatView({
  messages,
  inputMessage,
  setInputMessage,
  onSendMessage,
  isTyping,
  aiStatus,
}: ChatViewProps) {
  const {
    messagesEndRef,
    messagesContainerRef,
  } = useAutoScroll([messages]);

  const {
    fields,
    updateField,
    togglePreserve,
    getEmailBody,
    clearForNewEmail,
    resetFields,
    loadExampleFields,
  } = useEmailFields();

  const [emailForm, setEmailForm] = React.useState({
    to: '',
    subject: 'Solicitare informatii publice - Legea 544/2001',
  });

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onSendMessage();
    }
  };

  const [isSending, setIsSending] = React.useState(false);

  const handleSendEmail = async () => {
    const emailBody = getEmailBody();
    if (!emailBody.trim()) {
      alert('Te rog completează cel puțin o secțiune din template');
      return;
    }
    if (!emailForm.to) {
      alert('Te rog completează adresa de email a destinatarului');
      return;
    }

    setIsSending(true);
    try {
      const response = await fetch('/api/emails/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: emailForm.to,
          subject: emailForm.subject,
          body: emailBody,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        alert(`Eroare: ${data.error || 'Nu s-a putut trimite emailul'}`);
        return;
      }

      alert('Email trimis cu succes!');
      clearForNewEmail();
    } catch {
      alert('Eroare de rețea. Verifică conexiunea și încearcă din nou.');
    } finally {
      setIsSending(false);
    }
  };

  const handleClearForm = () => {
    setEmailForm({
      to: '',
      subject: 'Solicitare informatii publice - Legea 544/2001',
    });
  };

  return (
    <div className="flex h-full">
      {/* Left Side: Chatbot (70%) */}
      <div className="w-[70%] flex flex-col bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        {/* Chat Header */}
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
                Asistent 544
                <span className={`ml-2 px-2 py-1 text-xs font-medium rounded-full ${
                  aiStatus === 'configured'
                    ? 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300'
                    : aiStatus === 'mock'
                    ? 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300'
                    : 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300'
                }`}>
                  {aiStatus === 'configured' ? '✓ AI Activ' : aiStatus === 'mock' ? '⚠️ Mock Mode' : '...'}
                </span>
              </h2>
              <p className="text-sm text-gray-600 dark:text-gray-300">
                Ajutor pentru formularea cererilor de informații publice
              </p>
            </div>
          </div>
        </div>

        {/* Chat Messages */}
        <div
          ref={messagesContainerRef}
          className="flex-1 overflow-y-auto p-6 space-y-6 scroll-smooth bg-gradient-to-b from-gray-50/50 to-white/50 dark:from-gray-800/50 dark:to-gray-900/50 scrollbar-modern"
        >
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id || index}
              message={msg}
              index={index}
              isLast={index === messages.length - 1}
            />
          ))}

          {isTyping && <TypingIndicator />}

          <div ref={messagesEndRef} />
        </div>

        {/* Chat Input */}
        <div className="px-6 py-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm">
          <div className="flex space-x-3">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Scrie-ți întrebarea aici..."
              disabled={isTyping}
              className="flex-1 px-4 py-3 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 disabled:bg-gray-100 dark:disabled:bg-gray-600 disabled:cursor-not-allowed bg-white/50 dark:bg-gray-800/50 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-300 dark:hover:border-gray-500"
            />
            <button
              onClick={onSendMessage}
              disabled={isTyping || !inputMessage.trim()}
              className="px-6 py-3 bg-gradient-to-r from-civic-blue-600 to-civic-blue-700 hover:from-civic-blue-700 hover:to-civic-blue-800 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transition-all duration-300 flex items-center disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transform hover:scale-105 disabled:scale-100"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Right Side: Email Form (30%) */}
      <div className="w-[30%] flex flex-col bg-gray-50 dark:bg-gray-900">
        {/* Form Header */}
        <div className="px-6 py-4 bg-civic-blue-50 dark:bg-civic-blue-900/20 border-b border-civic-blue-100 dark:border-civic-blue-800">
          <h3 className="text-sm font-semibold text-civic-blue-900 dark:text-civic-blue-100 mb-2">
            Template Cerere Informații Publice
          </h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={loadExampleFields}
              className="text-xs text-civic-blue-600 dark:text-civic-blue-400 hover:text-civic-blue-800 dark:hover:text-civic-blue-300 underline"
            >
              Exemplu
            </button>
            <button
              onClick={resetFields}
              className="text-xs text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 underline"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4 scrollbar-modern">
          <div className="space-y-3">
            {/* Email headers */}
            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Către (To) *
                </label>
                <input
                  type="email"
                  value={emailForm.to}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, to: e.target.value }))}
                  placeholder="registratura@institutie.ro"
                  className="field-input"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Subiect *
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                  className="field-input"
                />
              </div>
            </div>

            {/* Email field sections */}
            <div className="space-y-3">
              <EmailSolicitantSection
                title="1. Date Solicitant"
                fields={[
                  { key: 'name', label: 'Solicitant', value: fields.solicitant.name, placeholder: '[Numele complet]' },
                  { key: 'address', label: 'Adresa', value: fields.solicitant.address, placeholder: '[Adresa completă]' },
                  { key: 'email', label: 'Email', value: fields.solicitant.email, placeholder: '[Email]' },
                ]}
                onFieldChange={(field, value) => updateField('solicitant', field, value)}
                onPreserveToggle={() => togglePreserve('solicitant')}
                preserve={fields.solicitant.preserve}
              />

              <EmailFieldSection
                title="2. Salutare și Introducere"
                fields={[
                  {
                    key: 'institution',
                    label: 'Instituția',
                    value: fields.greeting.institution,
                    placeholder: '[Instituția]',
                    staticText: 'Stimate reprezentant al [Instituția],',
                  },
                  {
                    key: 'name',
                    label: 'Numele',
                    value: fields.greeting.name,
                    placeholder: '[Numele]',
                    staticText: 'Subsemnatul [Numele], cu datele de contact menționate mai sus, vă adresez următoarea solicitare de acces la informații publice în conformitate cu Legea nr. 544/2001 privind liberul acces la informațiile de interes public:',
                  },
                ]}
                onFieldChange={(field, value) => updateField('greeting', field, value)}
                onPreserveToggle={() => togglePreserve('greeting')}
                preserve={fields.greeting.preserve}
              />

              <EmailContentSection
                title="3. Conținutul Cererii"
                content={fields.request.content}
                onContentChange={(content) => updateField('request', 'content', content)}
                placeholder={`⚠️ IMPORTANT: Completează aici conținutul specific al cererii tale!\n\nExemplu:\nVă rog să îmi furnizați informațiile despre [subiectul cererii] pentru perioada [data] până la [data].\n\nÎn special, sunt interesat de:\n- [punctul 1]\n- [punctul 2]\n- [punctul 3]`}
              />

              <EmailFieldSection
                title="4. Încheiere și Semnătură"
                fields={[
                  {
                    key: 'email',
                    label: 'Email',
                    value: fields.closing.email,
                    placeholder: '[email]',
                    staticText: 'Aștept cu interes răspunsul dumneavoastră la adresa de email [email] și vă mulțumesc anticipat pentru cooperare.',
                  },
                  {
                    key: 'name',
                    label: 'Numele',
                    value: fields.closing.name,
                    placeholder: '[Numele complet]',
                    staticText: 'Cu stimă, [Numele complet]',
                  },
                ]}
                onFieldChange={(field, value) => updateField('closing', field, value)}
                onPreserveToggle={() => togglePreserve('closing')}
                preserve={fields.closing.preserve}
              />
            </div>

            {/* Action buttons */}
            <div className="flex space-x-2 pt-2">
              <button
                onClick={handleSendEmail}
                disabled={isSending}
                className="bg-gradient-to-r from-civic-blue-600 to-civic-blue-700 hover:from-civic-blue-700 hover:to-civic-blue-800 text-white font-semibold flex-1 text-sm h-9 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed disabled:scale-100"
              >
                {isSending ? 'Se trimite...' : 'Trimite Email'}
              </button>
              <button
                onClick={handleClearForm}
                className="bg-gradient-to-r from-gray-500 to-gray-600 hover:from-gray-600 hover:to-gray-700 text-white font-semibold text-sm h-9 px-4 rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105"
              >
                Șterge
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
