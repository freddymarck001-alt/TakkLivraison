interface StatCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  color?: 'navy' | 'orange' | 'green' | 'red' | 'blue' | 'gray';
  trend?: { value: number; label: string };
  onClick?: () => void;
}

const colors = {
  navy: { bg: 'bg-[#1B2A4A]', text: 'text-white', sub: 'text-blue-200', icon: 'text-blue-200' },
  orange: { bg: 'bg-[#F5821F]', text: 'text-white', sub: 'text-orange-100', icon: 'text-orange-100' },
  green: { bg: 'bg-emerald-600', text: 'text-white', sub: 'text-emerald-100', icon: 'text-emerald-100' },
  red: { bg: 'bg-red-600', text: 'text-white', sub: 'text-red-100', icon: 'text-red-100' },
  blue: { bg: 'bg-blue-600', text: 'text-white', sub: 'text-blue-100', icon: 'text-blue-100' },
  gray: { bg: 'bg-white', text: 'text-[#1B2A4A]', sub: 'text-gray-500', icon: 'text-gray-400' },
};

export default function StatCard({ label, value, sub, icon: Icon, color = 'gray', trend, onClick }: StatCardProps) {
  const c = colors[color];

  return (
    <div
      onClick={onClick}
      className={`${c.bg} rounded-2xl p-5 shadow-sm border border-gray-100 ${onClick ? 'cursor-pointer hover:scale-[1.02] active:scale-[0.98]' : ''} transition-transform`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold uppercase tracking-wider mb-2 ${c.sub} opacity-80`}>{label}</p>
          <p className={`text-xl sm:text-2xl font-bold ${c.text} leading-tight break-words`}>{value}</p>
          {sub && <p className={`text-xs mt-1.5 ${c.sub} break-words`}>{sub}</p>}
          {trend && (
            <p className={`text-xs mt-2 font-medium ${trend.value >= 0 ? 'text-green-300' : 'text-red-300'}`}>
              {trend.value >= 0 ? '↑' : '↓'} {Math.abs(trend.value)}% {trend.label}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`${c.icon} opacity-70 flex-shrink-0`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  );
}
