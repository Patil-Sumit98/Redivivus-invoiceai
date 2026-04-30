
import { Loader2, CheckCircle, AlertTriangle, AlertCircle, XCircle } from 'lucide-react';
import { Badge } from './ui/badge';

interface StatusBadgeProps {
  status: string | null | undefined;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  if (!status) return <Badge className="bg-gray-100 text-gray-800 border-gray-200">UNKNOWN</Badge>;

  const upperStr = status.toUpperCase();

  if (['PROCESSING', 'PENDING'].includes(upperStr)) {
    return (
      <Badge className="bg-blue-100 text-blue-800 border-blue-200 shadow-none flex items-center gap-1.5 py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        PROCESSING
      </Badge>
    );
  }

  if (['COMPLETED', 'AUTO_APPROVED'].includes(upperStr)) {
    return (
      <Badge className="bg-green-100 text-green-800 border-green-200 shadow-none flex items-center gap-1.5 py-1">
        <CheckCircle className="h-3 w-3" />
        {upperStr === 'COMPLETED' ? 'COMPLETED' : 'AUTO-APPROVED'}
      </Badge>
    );
  }
  
  if (upperStr === 'VERIFIED') {
    return (
      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 font-bold shadow-none flex items-center gap-1.5 py-1">
        <CheckCircle className="h-3 w-3" />
        VERIFIED
      </Badge>
    );
  }

  if (['NEEDS_REVIEW', 'HUMAN_REQUIRED'].includes(upperStr)) {
    return (
      <Badge className="bg-amber-100 text-amber-800 border-amber-200 shadow-none flex items-center gap-1.5 py-1">
        <AlertTriangle className="h-3 w-3" />
        NEEDS REVIEW
      </Badge>
    );
  }

  if (['FAILED', 'REJECTED'].includes(upperStr)) {
    return (
      <Badge className="bg-red-100 text-red-800 border-red-200 shadow-none flex items-center gap-1.5 py-1">
        {upperStr === 'FAILED' ? <AlertCircle className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
        {upperStr}
      </Badge>
    );
  }

  return <Badge className="bg-gray-100 text-gray-800 border-gray-200 shadow-none py-1">{upperStr}</Badge>;
};