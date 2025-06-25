
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
import SecurityAlert from "@/components/SecurityAlert";
import FileUploadValidator from "@/components/FileUploadValidator";

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
    console.log('Dashboard useEffect - user:', user);
    if (user) {
      console.log('Fetching user data for user:', user.id);
      fetchUserData();
    } else {
      console.log('No user found, setting loading to false');
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const upgradeStatus = searchParams.get('upgrade');
    if (upgradeStatus === 'success') {
      toast({
        title: "Upgrade realizado com sucesso!",
        description: "Bem-vindo ao plano PRO! Suas funcionalidades foram desbloqueadas.",
      });
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
    console.log('Starting fetchUserData...');
    try {
      setLoading(true);
      
      // Fetch user profile
      console.log('Fetching user profile...');
      const { data: profileData, error: profileError } = await supabase
        .from('user_profiles')
        .select('credits, plan_type')
        .eq('user_id', user!.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
        // Create profile if it doesn't exist
        if (profileError.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...');
          const { data: newProfile, error: createError } = await supabase
            .from('user_profiles')
            .insert({ user_id: user!.id, credits: 3, plan_type: 'free' })
            .select('credits, plan_type')
            .single();
          
          if (createError) {
            console.error('Error creating profile:', createError);
            toast({
              title: "Erro",
              description: "Erro ao criar perfil do usuário.",
              variant: "destructive",
            });
          } else {
            console.log('Profile created successfully:', newProfile);
            setUserProfile(newProfile);
          }
        }
      } else {
        console.log('Profile data fetched:', profileData);
        setUserProfile(profileData);
      }

      // Fetch contracts
      console.log('Fetching contracts...');
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (contractsError) {
        console.error('Error fetching contracts:', contractsError);
        toast({
          title: "Erro",
          description: "Erro ao carregar contratos.",
          variant: "destructive",
        });
      } else {
        console.log('Contracts data fetched:', contractsData);
        setContracts(contractsData || []);
      }
    } catch (error) {
      console.error('Error in fetchUserData:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar dados do usuário.",
        variant: "destructive",
      });
    } finally {
      console.log('Setting loading to false');
      setLoading(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('File selected:', file.name, file.type, file.size);

    // Check if user has credits
    if (!userProfile || userProfile.credits <= 0) {
      toast({
        title: "Sem créditos",
        description: "Você não tem créditos suficientes para analisar contratos.",
        variant: "destructive",
      });
      return;
    }

    // Validate file using the validator component
    const handleValidFile = async (validatedFile: File) => {
      setIsUploading(true);
      console.log('Starting file upload...');

      try {
        // Upload file to storage first
        const fileExt = validatedFile.name.split('.').pop();
        const sanitizedFileName = validatedFile.name.replace(/[<>:"/\\|?*]/g, '_');
        const fileName = `${Date.now()}_${sanitizedFileName}`;
        const filePath = `${user!.id}/${fileName}`;

        console.log('Uploading to storage:', filePath);
        const { error: uploadError } = await supabase.storage
          .from('contract-uploads')
          .upload(filePath, validatedFile, {
            cacheControl: '3600',
            upsert: false
          });

        if (uploadError) {
          console.error('Storage upload error:', uploadError);
          throw new Error(`Erro no upload: ${uploadError.message}`);
        }

        console.log('File uploaded successfully, creating contract record...');
        // Create contract record
        const { data: contractData, error: contractError } = await supabase
          .from('contracts')
          .insert({
            user_id: user!.id,
            file_name: sanitizedFileName,
            file_path: filePath,
            status: 'pending'
          })
          .select()
          .single();

        if (contractError) {
          console.error('Contract creation error:', contractError);
          throw new Error(`Erro ao criar contrato: ${contractError.message}`);
        }

        console.log('Contract created, starting analysis:', contractData.id);
        // Start analysis
        const { error: analysisError } = await supabase.functions.invoke('analyze-contract', {
          body: { contract_id: contractData.id }
        });

        if (analysisError) {
          console.error('Analysis error:', analysisError);
          throw new Error(`Erro na análise: ${analysisError.message}`);
        }

        toast({
          title: "Arquivo enviado!",
          description: "Sua análise está sendo processada. Você será redirecionado em instantes.",
        });

        // Refresh data
        fetchUserData();

        // Redirect to analysis page
        setTimeout(() => {
          navigate(`/analise/${contractData.id}`);
        }, 2000);

      } catch (error: any) {
        console.error('Error in file upload process:', error);
        toast({
          title: "Erro no upload",
          description: error.message || "Erro ao enviar arquivo.",
          variant: "destructive",
        });
      } finally {
        setIsUploading(false);
        event.target.value = '';
      }
    };

    const handleInvalidFile = (error: string) => {
      console.error('File validation failed:', error);
      event.target.value = '';
    };

    // Create validator instance and execute validation
    const validator = <FileUploadValidator 
      file={file}
      onValid={handleValidFile}
      onInvalid={handleInvalidFile}
    />;
  };

  const handleSignOut = async () => {
    try {
      console.log('Signing out...');
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Show loading state
  if (loading) {
    console.log('Rendering loading state');
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p>Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Show login prompt if no user
  if (!user) {
    console.log('No user, redirecting to home');
    navigate('/');
    return null;
  }

  console.log('Rendering dashboard with user:', user.id);

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
        {/* Security Alerts */}
        <SecurityAlert />

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
                <CardTitle>Enviar Novo Documento</CardTitle>
                <CardDescription>
                  Faça upload de PDF, imagens ou áudio para análise jurídica automatizada
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
                      <p className="text-xs text-gray-500">PDF, Word, Imagens (JPG/PNG) ou Áudio (MP3/WAV) - MAX. 10MB</p>
                      <p className="text-xs text-red-500 mt-1">
                        ⚠️ Arquivos são validados por segurança
                      </p>
                    </div>
                    <Input
                      id="contract-upload"
                      type="file"
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.mp3,.wav,.webm,.mp4"
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
                      Processando arquivo com segurança...
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Contracts List */}
            <Card>
              <CardHeader>
                <CardTitle>Seus Documentos</CardTitle>
                <CardDescription>
                  Histórico de arquivos analisados
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Nenhum documento analisado ainda</p>
                    <p className="text-sm text-gray-400 mt-2">
                      Faça upload do seu primeiro arquivo para começar
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
        open={showUpgradeModal} 
        onOpenChange={setShowUpgradeModal} 
      />
    </div>
  );
};

export default Dashboard;
