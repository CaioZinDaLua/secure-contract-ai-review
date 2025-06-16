
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, MessageCircle, FileText, Send, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Contract {
  id: string;
  file_name: string;
  status: string;
  created_at: string;
}

interface Analysis {
  analysis_result: {
    summary: string;
    analyzed_at: string;
    file_name: string;
    status: string;
  };
}

interface ChatMessage {
  id: number;
  user_message: string;
  ai_response: string;
  created_at: string;
}

interface UserProfile {
  plan_type: string;
}

const ContractAnalysis = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [contract, setContract] = useState<Contract | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || !id) {
      navigate('/dashboard');
      return;
    }
    
    fetchContractData();
  }, [user, id, navigate]);

  const fetchContractData = async () => {
    try {
      // Fetch contract
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select('*')
        .eq('id', id)
        .eq('user_id', user!.id)
        .single();

      if (contractError || !contractData) {
        navigate('/dashboard');
        return;
      }

      setContract(contractData);

      // Fetch analysis
      const { data: analysisData, error: analysisError } = await supabase
        .from('analyses')
        .select('analysis_result')
        .eq('contract_id', id)
        .single();

      if (!analysisError && analysisData) {
        // Parse the analysis result properly
        const analysisResult = analysisData.analysis_result as any;
        setAnalysis({
          analysis_result: {
            summary: analysisResult.summary || '',
            analyzed_at: analysisResult.analyzed_at || '',
            file_name: analysisResult.file_name || '',
            status: analysisResult.status || ''
          }
        });
      }

      // Fetch user profile
      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('plan_type')
        .eq('user_id', user!.id)
        .single();

      if (profileData) {
        setUserProfile(profileData);
      }

      // Fetch chat history
      const { data: chatData } = await supabase
        .from('chat_history')
        .select('*')
        .eq('contract_id', id)
        .order('created_at', { ascending: true });

      if (chatData) {
        setChatHistory(chatData);
      }

    } catch (error) {
      console.error('Error fetching contract data:', error);
      navigate('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || isSending) return;

    if (userProfile?.plan_type !== 'pro') {
      toast({
        title: "Upgrade necessário",
        description: "O chat com IA é exclusivo para usuários PRO.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    const messageToSend = newMessage.trim();
    setNewMessage("");

    try {
      const { data, error } = await supabase.functions.invoke('chat-with-contract', {
        body: {
          contract_id: id,
          user_message: messageToSend
        }
      });

      if (error) {
        throw error;
      }

      // Refresh chat history
      fetchContractData();

      toast({
        title: "Mensagem enviada!",
        description: "A IA respondeu sua pergunta.",
      });

    } catch (error: any) {
      console.error('Error sending message:', error);
      toast({
        title: "Erro no chat",
        description: error.message || "Erro ao enviar mensagem.",
        variant: "destructive",
      });
      // Restore message if there was an error
      setNewMessage(messageToSend);
    } finally {
      setIsSending(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 text-primary mx-auto mb-4 animate-pulse" />
          <p>Carregando análise...</p>
        </div>
      </div>
    );
  }

  if (!contract || !analysis) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500">Análise não encontrada</p>
          <Button onClick={() => navigate('/dashboard')} className="mt-4">
            Voltar ao Dashboard
          </Button>
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
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                onClick={() => navigate('/dashboard')}
                className="mr-4"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Voltar
              </Button>
              <h1 className="text-xl font-bold text-gray-900">
                Análise: {contract.file_name}
              </h1>
            </div>
            {userProfile?.plan_type === 'pro' && (
              <div className="flex items-center bg-gradient-to-r from-yellow-400 to-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                <Zap className="h-4 w-4 mr-1" />
                PRO
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs defaultValue="analysis" className="space-y-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="analysis" className="flex items-center">
              <FileText className="h-4 w-4 mr-2" />
              Análise
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex items-center">
              <MessageCircle className="h-4 w-4 mr-2" />
              Chat com IA
              {userProfile?.plan_type !== 'pro' && (
                <Zap className="h-3 w-3 ml-1 text-yellow-500" />
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="analysis">
            <Card>
              <CardHeader>
                <CardTitle>Resultado da Análise Jurídica</CardTitle>
                <CardDescription>
                  Análise realizada em {new Date(analysis.analysis_result.analyzed_at).toLocaleDateString('pt-BR')}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="prose max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed">
                    {analysis.analysis_result.summary}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="chat">
            {userProfile?.plan_type !== 'pro' ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Zap className="h-5 w-5 mr-2 text-yellow-500" />
                    Chat com IA - Plano PRO
                  </CardTitle>
                  <CardDescription>
                    Upgrade para PRO e converse com a IA sobre seu contrato
                  </CardDescription>
                </CardHeader>
                <CardContent className="text-center py-8">
                  <p className="text-gray-600 mb-4">
                    O chat com IA permite fazer perguntas específicas sobre seu contrato e até mesmo solicitar correções automáticas.
                  </p>
                  <Button className="bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600">
                    Upgrade para PRO
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {/* Chat History */}
                <Card className="max-h-96 overflow-y-auto">
                  <CardHeader>
                    <CardTitle>Conversa com a IA</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {chatHistory.length === 0 ? (
                      <p className="text-gray-500 text-center py-4">
                        Nenhuma conversa ainda. Faça sua primeira pergunta!
                      </p>
                    ) : (
                      chatHistory.map((message) => (
                        <div key={message.id} className="space-y-2">
                          <div className="bg-blue-50 rounded-lg p-3">
                            <p className="font-medium text-blue-900">Você:</p>
                            <p className="text-blue-800">{message.user_message}</p>
                          </div>
                          <div className="bg-gray-50 rounded-lg p-3">
                            <p className="font-medium text-gray-900">IA:</p>
                            <p className="text-gray-800 whitespace-pre-wrap">{message.ai_response}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Message Input */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="flex space-x-2">
                      <Textarea
                        placeholder="Faça uma pergunta sobre o contrato ou solicite uma correção..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        disabled={isSending}
                        className="min-h-[80px]"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                          }
                        }}
                      />
                      <Button
                        onClick={sendMessage}
                        disabled={!newMessage.trim() || isSending}
                        className="self-end"
                      >
                        {isSending ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        ) : (
                          <Send className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Pressione Enter para enviar, Shift+Enter para nova linha
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default ContractAnalysis;
