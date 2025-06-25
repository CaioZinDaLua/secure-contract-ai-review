
import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Shield, X, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const SecurityAlert = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<any[]>([]);
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
      // Verificar atividades suspeitas nos últimos 30 minutos
      const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
      
      const { data: recentActivity, error } = await supabase
        .from('audit_logs')
        .select('*')
        .eq('user_id', user.id)
        .gte('timestamp', thirtyMinutesAgo)
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('Error checking security alerts:', error);
        return;
      }

      const securityAlerts = [];
      
      // Verificar tentativas excessivas de análise
      const analysisAttempts = recentActivity?.filter(log => 
        log.action === 'contract_analysis_failed'
      ).length || 0;
      
      if (analysisAttempts > 3) {
        securityAlerts.push({
          type: 'warning',
          title: 'Múltiplas falhas de análise detectadas',
          description: `${analysisAttempts} tentativas falharam nos últimos 30 minutos. Verifique seus arquivos.`,
          id: 'analysis-failures'
        });
      }

      // Verificar muitas mensagens de chat
      const chatMessages = recentActivity?.filter(log => 
        log.action.includes('chat_message')
      ).length || 0;
      
      if (chatMessages > 50) {
        securityAlerts.push({
          type: 'info',
          title: 'Alto volume de mensagens',
          description: `${chatMessages} mensagens enviadas recentemente. Lembre-se dos limites de uso.`,
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
