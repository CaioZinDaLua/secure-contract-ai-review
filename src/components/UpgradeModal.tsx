
import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Zap, Check, Star, Sparkles } from "lucide-react";

interface UpgradeModalProps {
  trigger?: React.ReactNode;
}

const UpgradeModal = ({ trigger }: UpgradeModalProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleUpgrade = async () => {
    if (!user) return;

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout', {
        body: { plan: 'pro' }
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error: any) {
      console.error('Erro no upgrade:', error);
      toast({
        title: "Erro no upgrade",
        description: error.message || "Erro ao processar o upgrade. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const proFeatures = [
    "Chat ilimitado com IA sobre seus contratos",
    "Correções automáticas de cláusulas",
    "Análises mais detalhadas",
    "Histórico completo de versões",
    "Suporte prioritário",
    "Sem limites de análises mensais"
  ];

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold">
            <Zap className="h-4 w-4 mr-2" />
            Upgrade para PRO
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center text-xl">
            <Sparkles className="h-6 w-6 mr-2 text-yellow-500" />
            Upgrade para Contrato Seguro PRO
          </DialogTitle>
          <DialogDescription>
            Desbloqueie todo o potencial da análise jurídica com IA
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card className="border-2 border-gradient-to-r from-yellow-400 to-orange-500">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center mb-2">
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-4 py-1">
                  <Star className="h-4 w-4 mr-1" />
                  PLANO PRO
                </Badge>
              </div>
              <CardTitle className="text-3xl font-bold">R$ 49,90</CardTitle>
              <CardDescription className="text-lg">por mês</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {proFeatures.map((feature, index) => (
                  <li key={index} className="flex items-center">
                    <Check className="h-5 w-5 text-green-500 mr-3 flex-shrink-0" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              
              <Button 
                onClick={handleUpgrade}
                disabled={isLoading}
                className="w-full mt-6 bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white font-bold py-3"
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processando...
                  </div>
                ) : (
                  <>
                    <Zap className="h-4 w-4 mr-2" />
                    Fazer Upgrade Agora
                  </Button>
                )}
              </Button>
              
              <p className="text-xs text-gray-500 text-center mt-3">
                Cobrança segura via Stripe • Cancele a qualquer momento
              </p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
