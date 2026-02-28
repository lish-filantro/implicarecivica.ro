'use client';

import { useState, useEffect, useMemo } from 'react';
import { Mail, ArrowLeft, Reply, Trash2 } from 'lucide-react';
import EmailSidebar from '@/components/emails/EmailSidebar';
import EmailList from '@/components/emails/EmailList';
import ComposeModal from '@/components/emails/ComposeModal';
import { listEmails, markEmailAsRead, getUnreadCount } from '@/lib/supabase/email-queries';
import { getProfile } from '@/lib/supabase/profile-queries';
import { formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import type { Email } from '@/lib/types/email';
import type { EmailFolder } from '@/components/emails/EmailSidebar';

function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, '');
}

export default function EmailsPage() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeFolder, setActiveFolder] = useState<EmailFolder>('inbox');
  const [selectedEmail, setSelectedEmail] = useState<Email | null>(null);
  const [search, setSearch] = useState('');
  const [composeOpen, setComposeOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [emailData, profile, unread] = await Promise.all([
          listEmails(),
          getProfile(),
          getUnreadCount(),
        ]);
        setEmails(emailData);
        setUserEmail(profile?.mailcow_email ?? null);
        setUnreadCount(unread);
      } catch (err) {
        console.error('Failed to load emails:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Auto mark-as-read when selecting an unread email
  useEffect(() => {
    if (selectedEmail && !selectedEmail.is_read && selectedEmail.type === 'received') {
      markEmailAsRead(selectedEmail.id)
        .then(() => {
          setEmails(prev => prev.map(e =>
            e.id === selectedEmail.id ? { ...e, is_read: true } : e
          ));
          setSelectedEmail(prev => prev ? { ...prev, is_read: true } : null);
          setUnreadCount(prev => Math.max(0, prev - 1));
        })
        .catch(err => console.error('Failed to mark as read:', err));
    }
  }, [selectedEmail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEmails = useMemo(() => {
    let result = emails;

    if (activeFolder === 'inbox') {
      result = result.filter(e => e.type === 'received');
    } else if (activeFolder === 'sent') {
      result = result.filter(e => e.type === 'sent');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(e =>
        e.subject.toLowerCase().includes(q) ||
        e.from_email.toLowerCase().includes(q) ||
        e.to_email.toLowerCase().includes(q)
      );
    }

    return result;
  }, [emails, activeFolder, search]);

  const handleSelectEmail = (email: Email) => {
    setSelectedEmail(email);
  };

  const handleFolderChange = (folder: EmailFolder) => {
    setActiveFolder(folder);
    setSelectedEmail(null);
    setSearch('');
  };

  const handleEmailSent = (newEmail: Email) => {
    if (newEmail) {
      setEmails(prev => [newEmail, ...prev]);
    }
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <EmailSidebar
          activeFolder={activeFolder}
          onFolderChange={handleFolderChange}
          onCompose={() => setComposeOpen(true)}
          unreadCount={unreadCount}
          userEmail={userEmail}
        />
      </div>

      {/* Mobile header with folder tabs */}
      <div className="md:hidden fixed top-14 left-0 right-0 z-40
                      bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700
                      flex items-center gap-1 px-3 py-2">
        {selectedEmail ? (
          <button
            onClick={() => setSelectedEmail(null)}
            className="flex items-center gap-2 text-sm font-medium text-civic-blue-600 dark:text-civic-blue-400"
          >
            <ArrowLeft className="h-4 w-4" />
            Înapoi
          </button>
        ) : (
          <>
            {(['inbox', 'sent', 'all'] as EmailFolder[]).map((f) => (
              <button
                key={f}
                onClick={() => handleFolderChange(f)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors
                  ${activeFolder === f
                    ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 text-civic-blue-700 dark:text-civic-blue-300'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
              >
                {f === 'inbox' ? 'Primite' : f === 'sent' ? 'Trimise' : 'Toate'}
                {f === 'inbox' && unreadCount > 0 && (
                  <span className="ml-1 px-1 text-xs bg-civic-blue-500 text-white rounded-full">{unreadCount}</span>
                )}
              </button>
            ))}
            <button
              onClick={() => setComposeOpen(true)}
              className="ml-auto px-3 py-1 rounded-full text-xs font-semibold
                         bg-activist-orange-500 text-white"
            >
              Compune
            </button>
          </>
        )}
      </div>

      {/* Email list panel */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 flex-shrink-0
                       ${selectedEmail ? 'hidden md:flex' : 'flex'} flex-col
                       mt-12 md:mt-0`}>
        <EmailList
          emails={filteredEmails}
          loading={loading}
          selectedEmailId={selectedEmail?.id ?? null}
          onSelectEmail={handleSelectEmail}
          activeFolder={activeFolder}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      {/* Email detail panel */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden
                       ${selectedEmail ? 'flex' : 'hidden md:flex'}
                       mt-12 md:mt-0`}>
        {selectedEmail ? (
          <div className="flex flex-col h-full animate-fade-in">
            {/* Detail header */}
            <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {selectedEmail.subject}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm text-gray-500 dark:text-gray-400">
                <span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">De la:</span>{' '}
                  {selectedEmail.from_email}
                </span>
                <span>
                  <span className="font-medium text-gray-700 dark:text-gray-300">Către:</span>{' '}
                  {selectedEmail.to_email}
                </span>
                <span>{formatDate(selectedEmail.created_at, 'long')}</span>
              </div>
            </div>

            {/* Detail body */}
            <div className="flex-1 overflow-y-auto scrollbar-modern p-6">
              {selectedEmail.body ? (
                <div
                  className="prose-email text-sm text-gray-800 dark:text-gray-200 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(selectedEmail.body) }}
                />
              ) : (
                <p className="text-sm text-gray-400 italic">Fără conținut</p>
              )}
            </div>

            {/* Detail footer */}
            <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center gap-3">
              <Button variant="outline" size="sm" disabled className="gap-2 opacity-50">
                <Reply className="h-4 w-4" />
                Răspunde (în curând)
              </Button>
              <Button variant="ghost" size="sm" className="gap-2 text-protest-red-600 hover:text-protest-red-700 hover:bg-protest-red-50 dark:hover:bg-protest-red-900/20">
                <Trash2 className="h-4 w-4" />
                Șterge
              </Button>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4">
            <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 mb-4">
              <Mail className="h-8 w-8 text-gray-400" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Selectează un email
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Alege un email din listă pentru a-l vizualiza
            </p>
          </div>
        )}
      </div>

      {/* Compose modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={handleEmailSent}
        userEmail={userEmail}
      />
    </div>
  );
}
