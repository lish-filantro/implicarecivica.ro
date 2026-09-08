'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { listEmails, markEmailAsRead, getUnreadCount } from '@m544/emails/queries.client';
import { getProfile } from '@m544/emails/profile-queries.client';
import type { Email } from '@m544/shared/types/email';
import type { Profile } from '@m544/shared/types/profile';
import { filterEmails, type EmailFolder } from './filter';
import { subscribeToEmails, type SubscribeToEmails } from './realtime';

export interface EmailsDeps {
  listEmails: () => Promise<Email[]>;
  getProfile: () => Promise<Profile | null>;
  getUnreadCount: () => Promise<number>;
  markEmailAsRead: (id: string) => Promise<void>;
  subscribe: SubscribeToEmails;
}

export interface EmailChangeHandlers {
  onInsert: (email: Email) => void;
  onUpdate: (email: Email) => void;
}

const DEFAULT_DEPS: EmailsDeps = {
  listEmails: () => listEmails(),
  getProfile: () => getProfile(),
  getUnreadCount: () => getUnreadCount(),
  markEmailAsRead: (id) => markEmailAsRead(id),
  subscribe: subscribeToEmails,
};

/** Data + selection state of the emails page (load, realtime, auto mark-as-read). */
export function useEmails(deps: EmailsDeps = DEFAULT_DEPS) {
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
          deps.listEmails(),
          deps.getProfile(),
          deps.getUnreadCount(),
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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Realtime: subscribe to new / updated emails
  useEffect(() => {
    const unsubscribe = deps.subscribe(
      (newEmail) => {
        setEmails((prev) => {
          // Avoid duplicates
          if (prev.some((e) => e.id === newEmail.id)) return prev;
          return [newEmail, ...prev];
        });
        if (newEmail.type === 'received' && !newEmail.is_read) {
          setUnreadCount((prev) => prev + 1);
        }
      },
      (updated) => {
        setEmails((prev) => prev.map((e) => (e.id === updated.id ? updated : e)));
        setSelectedEmail((prev) => (prev?.id === updated.id ? updated : prev));
      },
    );
    return unsubscribe;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto mark-as-read when selecting an unread email
  useEffect(() => {
    if (selectedEmail && !selectedEmail.is_read && selectedEmail.type === 'received') {
      deps
        .markEmailAsRead(selectedEmail.id)
        .then(() => {
          setEmails((prev) => prev.map((e) => (e.id === selectedEmail.id ? { ...e, is_read: true } : e)));
          setSelectedEmail((prev) => (prev ? { ...prev, is_read: true } : null));
          setUnreadCount((prev) => Math.max(0, prev - 1));
        })
        .catch((err) => console.error('Failed to mark as read:', err));
    }
  }, [selectedEmail?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filteredEmails = useMemo(() => filterEmails(emails, activeFolder, search), [emails, activeFolder, search]);

  const selectEmail = useCallback((email: Email | null) => setSelectedEmail(email), []);

  const changeFolder = useCallback((folder: EmailFolder) => {
    setActiveFolder(folder);
    setSelectedEmail(null);
    setSearch('');
  }, []);

  const addSentEmail = useCallback((newEmail: Email) => {
    if (newEmail) {
      setEmails((prev) => [newEmail, ...prev]);
    }
  }, []);

  return {
    emails,
    loading,
    activeFolder,
    selectedEmail,
    search,
    setSearch,
    composeOpen,
    setComposeOpen,
    unreadCount,
    userEmail,
    filteredEmails,
    selectEmail,
    changeFolder,
    addSentEmail,
  };
}
