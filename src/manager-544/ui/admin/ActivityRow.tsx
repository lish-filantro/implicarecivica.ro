export function ActivityRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">
        {value.toLocaleString('ro-RO')}
      </span>
    </div>
  );
}
