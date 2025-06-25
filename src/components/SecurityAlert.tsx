
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface SecurityAlertData {
  type: 'warning' | 'info';
  title: string;
  description: string;
  id: string;
}

const SecurityAlert = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<SecurityAlertData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      checkSecurityAlerts();
    }
  }, [user]);

  const checkSecurityAlerts = async () => {
    if (!user) return;
    
    setLoading(true);
    try {
      const securityAlerts: SecurityAlertData[] = [];
      
      // Verificar contratos com erro nos últimos 30 minutos
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: recentContracts, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false });

      if (contractsError) {
        console.error('Error checking contracts:', contractsError);
      } else if (recentContracts) {
        // Verificar tentativas de upload com erro
        const failedContracts = recentContracts.filter(contract => 
          contract.status === 'error' || contract.error_message
        );
        
        if (failedContracts.length > 2) {
          securityAlerts.push({
            type: 'warning',
            title: 'Múltiplas falhas de upload detectadas',
            description: `${failedContracts.length} uploads falharam nos últimos 30 minutos. Verifique seus arquivos.`,
            id: 'upload-failures'
          });
        }

        // Verificar muitos uploads recentes
        if (recentContracts.length > 10) {
          securityAlerts.push({
            type: 'info',
            title: 'Alto volume de uploads',
            description: `${recentContracts.length} arquivos enviados recentemente. Lembre-se dos limites de uso.`,
            id: 'high-upload-volume'
          });
        }
      }

      // Verificar mensagens de chat recentes
      const { data: recentChat, error: chatError } = await supabase
        .from('chat_history')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyMinutesAgo)
        .order('created_at', { ascending: false });

      if (chatError) {
        console.error('Error checking chat history:', chatError);
      } else if (recentChat && recentChat.length > 30) {
        securityAlerts.push({
          type: 'info',
          title: 'Alto volume de mensagens',
          description: `${recentChat.length} mensagens enviadas recentemente. Lembre-se dos limites de uso.`,
          id: 'high-chat-volume'
        });
      }

      setAlerts(securityAlerts);
    } catch (error) {
      console.error('Error in security check:', error);
    } finally {
      setLoading(false);
    }
  };

  const dismissAlert = (alertId: string) => {
    setAlerts(alerts.filter(alert => alert.id !== alertId));
  };

  if (loading || alerts.length === 0) return null;

  return (
    <div className="space-y-4 mb-6">
      {alerts.map((alert) => (
        <Alert key={alert.id} variant={alert.type === 'warning' ? 'destructive' : 'default'}>
          <div className="flex items-start justify-between">
            <div className="flex items-start space-x-2">
              {alert.type === 'warning' ? (
                <AlertTriangle className="h-4 w-4 mt-0.5" />
              ) : (
                <Shield className="h-4 w-4 mt-0.5" />
              )}
              <div>
                <AlertTitle>{alert.title}</AlertTitle>
                <AlertDescription>{alert.description}</AlertDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dismissAlert(alert.id)}
              className="h-6 w-6 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </Alert>
      ))}
    </div>
  );
};

export default SecurityAlert;
