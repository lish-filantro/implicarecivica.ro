'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { FileText, MessageSquare, Search } from 'lucide-react';
import { RequestCard } from '@/components/dashboard/RequestCard';
import { listRequests } from '@/lib/supabase/request-queries';
import { LoadingSpinner } from '@/components/shared/loading-spinner';
import type { Request, RequestStatus } from '@/lib/types/request';

const STATUS_FILTERS: { label: string; value: RequestStatus | 'all' }[] = [
  { label: 'Toate', value: 'all' },
  { label: 'In asteptare', value: 'pending' },
  { label: 'Inregistrate', value: 'received' },
  { label: 'Raspunse', value: 'answered' },
  { label: 'Prelungite', value: 'extension' },
  { label: 'Intarziate', value: 'delayed' },
];

export default function RequestsPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<RequestStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await listRequests();
        setRequests(data);
      } catch (err) {
        setError('Nu am putut incarca cererile.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = useMemo(() => {
    let result = requests;
    if (activeFilter !== 'all') {
      result = result.filter((r) => r.status === activeFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (r) =>
          r.institution_name.toLowerCase().includes(q) ||
          r.subject.toLowerCase().includes(q)
      );
    }
    return result;
  }, [requests, activeFilter, search]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
          Cererile mele
        </h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          Toate cererile de informatii publice trimise in baza Legii 544/2001
        </p>
      </div>

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6">
        {/* Status filters */}
        <div className="flex flex-wrap gap-2">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.value}
              onClick={() => setActiveFilter(filter.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors duration-200
                         focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50
                         ${activeFilter === filter.value
                           ? 'bg-civic-blue-50 dark:bg-civic-blue-900/20 border-civic-blue-300 dark:border-civic-blue-700 text-civic-blue-700 dark:text-civic-blue-300'
                           : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'
                         }`}
            >
              {filter.label}
              {filter.value === 'all' && requests.length > 0 && ` (${requests.length})`}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-64 sm:ml-auto">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cauta institutie sau subiect..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-700
                       bg-white dark:bg-gray-800 text-gray-900 dark:text-white
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-civic-blue-500/50"
          />
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center py-20">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="space-y-4">
          {filtered.map((request, index) => (
            <div
              key={request.id}
              className="animate-slide-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <RequestCard
                request={request}
                onClick={() => setSelectedId(request.id)}
                isSelected={selectedId === request.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700
                        p-12 text-center">
          <div className="p-4 rounded-full bg-gray-100 dark:bg-gray-700 w-fit mx-auto mb-4">
            <FileText className="h-10 w-10 text-gray-400 dark:text-gray-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            {search || activeFilter !== 'all' ? 'Niciun rezultat' : 'Nu ai cereri inca'}
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm mx-auto mb-6">
            {search || activeFilter !== 'all'
              ? 'Incearca sa modifici filtrele sau termenul de cautare.'
              : 'Foloseste asistentul 544 pentru a crea prima cerere de informatii publice.'
            }
          </p>
          {!search && activeFilter === 'all' && (
            <Link
              href="/chat"
              className="inline-flex items-center gap-2 px-6 py-2.5 bg-activist-orange-500 hover:bg-activist-orange-600
                         text-white font-bold uppercase tracking-wide rounded-lg
                         transition-all duration-200 hover:shadow-lg"
            >
              <MessageSquare className="h-4 w-4" />
              Creaza cerere
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
