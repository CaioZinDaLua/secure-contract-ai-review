
import { Badge } from "@/components/ui/badge";
import { Zap, User } from "lucide-react";

interface PlanBadgeProps {
  planType: string;
  className?: string;
}

const PlanBadge = ({ planType, className = "" }: PlanBadgeProps) => {
  if (planType === 'pro') {
    return (
      <Badge className={`bg-gradient-to-r from-yellow-400 to-orange-500 text-white font-medium ${className}`}>
        <Zap className="h-3 w-3 mr-1" />
        PRO
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className={className}>
      <User className="h-3 w-3 mr-1" />
      FREE
    </Badge>
  );
};

export default PlanBadge;
