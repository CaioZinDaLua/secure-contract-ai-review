
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, MessageCircle, Zap, LogOut } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import PlanBadge from "@/components/PlanBadge";
import UpgradeModal from "@/components/UpgradeModal";
import ChatBot from "@/components/ChatBot";

interface Contract {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

interface UserProfile {
  credits: number;
  plan_type: string;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserData();
    }
  }, [user]);

  useEffect(() => {
    const upgradeStatus = searchParams.get('upgrade');
    if (upgradeStatus === 'success') {
      toast({
        title: "Upgrade realizado com sucesso!",
        description: "Bem-vindo ao plano PRO! Suas funcionalidades foram desbloqueadas.",
      });
      // Remove the parameter from URL
      navigate('/dashboard', { replace: true });
    } else if (upgradeStatus === 'cancelled') {
      toast({
        title: "Upgrade cancelado",
        description: "Você pode fazer o upgrade a qualquer momento.",
        variant: "destructive",
      });
      navigate('/dashboard', { replace: true });
    }
  }, [searchParams, toast, navigate]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('credits, plan_type')
        .eq('user_id', user!.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setUserProfile(profileData);
      }

      // Fetch contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
      } else {
        setContracts(contractsData || []);
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check if user has credits
    if (!userProfile || userProfile.credits <= 0) {
      toast({
        title: "Sem créditos",
        description: "Você não tem créditos suficientes para analisar contratos.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (file.type !== 'application/pdf') {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Por favor, envie apenas arquivos PDF.",
        variant: "destructive",
      });
      return;
    }

    // Check file size (5MB limit)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "Arquivo muito grande",
        description: "O arquivo deve ter no máximo 5MB.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Create form data
      const formData = new FormData();
      formData.append('file', file);

      // Upload and analyze contract
      const { data, error } = await supabase.functions.invoke('analyze-contract', {
        body: formData,
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Contrato enviado!",
        description: "Sua análise está sendo processada. Você será redirecionado em instantes.",
      });

      // Refresh data
      fetchUserData();

      // Redirect to analysis page
      setTimeout(() => {
        navigate(`/analise/${data.contract_id}`);
      }, 2000);

    } catch (error: any) {
      console.error('Error uploading file:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Erro ao enviar arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      // Reset input
      event.target.value = '';
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">Contrato Seguro</h1>
              <PlanBadge planType={userProfile?.plan_type || 'free'} />
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Créditos: <span className="font-medium">{userProfile?.credits || 0}</span>
              </div>
              
              {userProfile?.plan_type !== 'pro' && (
                <Button
                  onClick={() => setShowUpgradeModal(true)}
                  className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white"
                >
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade PRO
                </Button>
              )}
              
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="contracts" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contracts" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Análise de Contratos
            </TabsTrigger>
            <TabsTrigger value="chatbot" className="flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chatbot com IA
            </TabsTrigger>
          </TabsList>

          <TabsContent value="contracts" className="space-y-6">
            {/* Upload Section */}
            <Card>
              <CardHeader>
                <CardTitle>Enviar Novo Contrato</CardTitle>
                <CardDescription>
                  Faça upload de um arquivo PDF para análise jurídica automatizada
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-center w-full">
                  <label
                    htmlFor="contract-upload"
                    className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <Upload className="w-8 h-8 mb-4 text-gray-500" />
                      <p className="mb-2 text-sm text-gray-500">
                        <span className="font-semibold">Clique para enviar</span> ou arraste e solte
                      </p>
                      <p className="text-xs text-gray-500">PDF (MAX. 5MB)</p>
                    </div>
                    <Input
                      id="contract-upload"
                      type="file"
                      accept=".pdf"
                      className="hidden"
                      onChange={handleFileUpload}
                      disabled={isUploading}
                    />
                  </label>
                </div>
                {isUploading && (
                  <div className="mt-4 text-center">
                    <div className="inline-flex items-center">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                      Processando contrato...
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contracts List */}
            <Card>
              <CardHeader>
                <CardTitle>Seus Contratos</CardTitle>
                <CardDescription>
                  Histórico de contratos analisados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum contrato analisado ainda</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Faça upload do seu primeiro contrato para começar
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                        onClick={() => navigate(`/analise/${contract.id}`)}
                      >
                        <div className="flex items-center space-x-3">
                          <FileText className="h-5 w-5 text-gray-500" />
                          <div>
                            <p className="font-medium text-gray-900">{contract.file_name}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(contract.created_at).toLocaleDateString('pt-BR')} • {contract.status}
                            </p>
                          </div>
                        </div>
                        <Button variant="outline" size="sm">
                          Ver Análise
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chatbot">
            <ChatBot />
          </TabsContent>
        </Tabs>
      </div>

      <UpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)} 
      />
    </div>
  );
};

export default Dashboard;
