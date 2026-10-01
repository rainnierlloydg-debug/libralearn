import { forwardRef, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

const Table = forwardRef(function Table({
  columns,
  data,
  keyField = 'id',
  className = '',
  sortable = true,
  onRowClick,
  emptyMessage = 'No data available',
  loading = false,
  ...props
}, ref) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleSort = (key) => {
    if (!sortable) return;
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
  };

  const sortedData = [...data].sort((a, b) => {
    if (!sortConfig.key) return 0;
    const aVal = a[sortConfig.key];
    const bVal = b[sortConfig.key];
    if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return (
    <div ref={ref} className={`table-container ${className}`} {...props}>
      {loading ? (
        <div className="p-8 text-center">
          <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          <p className="text-[var(--text-muted)]">Loading...</p>
        </div>
      ) : data.length === 0 ? (
        <div className="p-8 text-center">
          <p className="text-[var(--text-muted)]">{emptyMessage}</p>
        </div>
      ) : (
        <table className="table" role="grid">
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  className={col.className}
                  style={{ width: col.width }}
                  aria-sort={sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
                >
                  <div className="flex items-center gap-1.5">
                    <span>{col.label}</span>
                    {sortable && col.sortable !== false && (
                      <button
                        onClick={() => handleSort(col.key)}
                        className="p-0.5 hover:bg-[var(--border)] rounded transition-colors"
                        aria-label={`Sort by ${col.label} ${sortConfig.key === col.key ? (sortConfig.direction === 'asc' ? 'descending' : 'ascending') : 'ascending'}`}
                      >
                        {sortConfig.key === col.key ? (
                          sortConfig.direction === 'asc' ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />
                        ) : (
                          <span className="w-4 h-4 flex items-center justify-center">
                            <ChevronUp className="w-3 h-3 text-[var(--text-faint)]" />
                            <ChevronDown className="w-3 h-3 text-[var(--text-faint)]" />
                          </span>
                        )}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedData.map((row) => (
              <tr
                key={row[keyField]}
                className={onRowClick ? 'cursor-pointer' : ''}
                onClick={() => onRowClick?.(row)}
              >
                {columns.map((col) => (
                  <td key={col.key} className={col.className}>
                    {col.render ? col.render(row[col.key], row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
});

Table.displayName = 'Table';

export default Table;