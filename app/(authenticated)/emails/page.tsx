'use client';

import EmailSidebar from '@m544/ui/emails/EmailSidebar';
import EmailList from '@m544/ui/emails/EmailList';
import ComposeModal from '@m544/ui/emails/ComposeModal';
import EmailDetail, { EmailEmptyState } from '@m544/ui/emails/EmailDetail';
import MobileFolderBar from '@m544/ui/emails/MobileFolderBar';
import { useEmails } from '@m544/ui/emails/useEmails';

export default function EmailsPage() {
  const {
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
  } = useEmails();

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Sidebar — hidden on mobile */}
      <div className="hidden md:block">
        <EmailSidebar
          activeFolder={activeFolder}
          onFolderChange={changeFolder}
          onCompose={() => setComposeOpen(true)}
          unreadCount={unreadCount}
          userEmail={userEmail}
        />
      </div>

      {/* Mobile header with folder tabs */}
      <MobileFolderBar
        hasSelection={selectedEmail !== null}
        activeFolder={activeFolder}
        unreadCount={unreadCount}
        onBack={() => selectEmail(null)}
        onFolderChange={changeFolder}
        onCompose={() => setComposeOpen(true)}
      />

      {/* Email list panel */}
      <div className={`w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 flex-shrink-0
                       ${selectedEmail ? 'hidden md:flex' : 'flex'} flex-col
                       mt-12 md:mt-0`}>
        <EmailList
          emails={filteredEmails}
          loading={loading}
          selectedEmailId={selectedEmail?.id ?? null}
          onSelectEmail={selectEmail}
          activeFolder={activeFolder}
          search={search}
          onSearchChange={setSearch}
        />
      </div>

      {/* Email detail panel */}
      <div className={`flex-1 flex flex-col bg-white dark:bg-gray-800 overflow-hidden
                       ${selectedEmail ? 'flex' : 'hidden md:flex'}
                       mt-12 md:mt-0`}>
        {selectedEmail ? <EmailDetail email={selectedEmail} /> : <EmailEmptyState />}
      </div>

      {/* Compose modal */}
      <ComposeModal
        isOpen={composeOpen}
        onClose={() => setComposeOpen(false)}
        onSent={addSentEmail}
        userEmail={userEmail}
      />
    </div>
  );
}
