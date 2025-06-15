
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Upload, FileText, Clock, CheckCircle, XCircle, Shield } from "lucide-react";

interface Contract {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
  error_message?: string;
}

interface UserProfile {
  credits: number;
}

const Dashboard = () => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    
    fetchUserData();
  }, [user, navigate]);

  const fetchUserData = async () => {
    try {
      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('credits')
        .eq('user_id', user!.id)
        .single();

      if (profileError) {
        console.error('Error fetching profile:', profileError);
      } else {
        setUserProfile(profile);
      }

      // Fetch contracts
      const { data: contractsData, error: contractsError } = await supabase
        .from('contracts')
        .select('id, file_name, status, created_at, error_message')
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
        title: "Créditos insuficientes",
        description: "Você precisa de mais créditos para analisar contratos.",
        variant: "destructive",
      });
      return;
    }

    // Check file type
    if (!file.type.includes('pdf') && !file.type.includes('text')) {
      toast({
        title: "Tipo de arquivo inválido",
        description: "Apenas arquivos PDF e TXT são suportados.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Upload file to Supabase Storage
      const filePath = `${user!.id}/${Date.now()}_${file.name}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('contract-uploads')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      // Insert contract record
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .insert({
          user_id: user!.id,
          file_name: file.name,
          file_path: filePath,
          status: 'pending'
        })
        .select()
        .single();

      if (contractError) {
        throw contractError;
      }

      toast({
        title: "Upload realizado!",
        description: "Seu contrato está sendo analisado por nossa IA. Isso pode levar até 2 minutos.",
      });

      // Refresh data
      fetchUserData();

      // Clear input
      event.target.value = '';

    } catch (error: any) {
      console.error('Upload error:', error);
      toast({
        title: "Erro no upload",
        description: error.message || "Erro ao fazer upload do arquivo.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
      case 'processing':
        return <Clock className="h-5 w-5 text-yellow-500" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-500" />;
      default:
        return <FileText className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending':
        return 'Aguardando';
      case 'processing':
        return 'Analisando';
      case 'success':
        return 'Concluído';
      case 'error':
        return 'Erro';
      default:
        return status;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <p>Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center">
              <div className="inline-flex items-center justify-center w-10 h-10 bg-primary rounded-lg mr-3">
                <span className="text-lg font-bold text-white">CS</span>
              </div>
              <h1 className="text-xl font-bold text-gray-900">Contrato Seguro</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-600">
                Análises restantes: <span className="font-bold text-primary">{userProfile?.credits || 0}</span>
              </div>
              <Button variant="outline" onClick={signOut}>
                Sair
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Area */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-dashed border-gray-300 hover:border-primary transition-colors">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center">
                  <Upload className="h-6 w-6 mr-2" />
                  Analisar Contrato
                </CardTitle>
                <CardDescription>
                  Arraste seu contrato (.pdf ou .txt) aqui ou clique para selecionar
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="relative">
                  <Input
                    type="file"
                    accept=".pdf,.txt"
                    onChange={handleFileUpload}
                    disabled={isUploading || !userProfile || userProfile.credits <= 0}
                    className="cursor-pointer file:cursor-pointer"
                  />
                  {isUploading && (
                    <div className="absolute inset-0 bg-white bg-opacity-75 flex items-center justify-center">
                      <div className="text-sm text-gray-600">Uploading...</div>
                    </div>
                  )}
                </div>
                {(!userProfile || userProfile.credits <= 0) && (
                  <p className="text-sm text-red-600 mt-2">
                    Você precisa de créditos para analisar contratos.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Contracts History */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Análises</CardTitle>
                <CardDescription>
                  Seus contratos analisados e em andamento
                </CardDescription>
              </CardHeader>
              <CardContent>
                {contracts.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                    <p>Nenhum contrato analisado ainda.</p>
                    <p className="text-sm">Faça upload do seu primeiro contrato para começar!</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {contracts.map((contract) => (
                      <div
                        key={contract.id}
                        className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                        onClick={() => {
                          if (contract.status === 'success') {
                            navigate(`/analise/${contract.id}`);
                          }
                        }}
                      >
                        <div className="flex items-center space-x-3">
                          {getStatusIcon(contract.status)}
                          <div>
                            <p className="font-medium text-gray-900">{contract.file_name}</p>
                            <p className="text-sm text-gray-500">
                              {new Date(contract.created_at).toLocaleDateString('pt-BR')} às{' '}
                              {new Date(contract.created_at).toLocaleTimeString('pt-BR', {
                                hour: '2-digit',
                                minute: '2-digit'
                              })}
                            </p>
                            {contract.error_message && (
                              <p className="text-sm text-red-600">{contract.error_message}</p>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {getStatusText(contract.status)}
                          </span>
                          {contract.status === 'success' && (
                            <p className="text-xs text-gray-500 mt-1">Clique para ver</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
