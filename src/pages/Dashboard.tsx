
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Clock, Check, X, Shield } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const Dashboard = () => {
  const [isDragging, setIsDragging] = useState(false);
  const [credits, setCredits] = useState(3);
  const [isUploading, setIsUploading] = useState(false);
  const { toast } = useToast();

  // Mock data para histórico
  const [contracts] = useState([
    {
      id: "1",
      fileName: "contrato_servicos_web.pdf",
      status: "success" as const,
      createdAt: "2024-01-15T10:30:00Z",
    },
    {
      id: "2", 
      fileName: "contrato_marketing_digital.pdf",
      status: "processing" as const,
      createdAt: "2024-01-14T14:20:00Z",
    },
    {
      id: "3",
      fileName: "contrato_consultoria.pdf", 
      status: "error" as const,
      createdAt: "2024-01-13T09:15:00Z",
    }
  ]);

  const handleFileUpload = async (file: File) => {
    if (credits <= 0) {
      toast({
        title: "Créditos insuficientes",
        description: "Você precisa de mais créditos para continuar.",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.includes('pdf')) {
      toast({
        title: "Formato inválido",
        description: "Apenas arquivos PDF são aceitos.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    // Simular upload e processamento
    setTimeout(() => {
      setIsUploading(false);
      setCredits(prev => prev - 1);
      toast({
        title: "Upload realizado!",
        description: "Seu contrato está sendo analisado. Avisaremos quando estiver pronto.",
      });
    }, 2000);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const files = Array.from(e.dataTransfer.files);
    if (files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files[0]) {
      handleFileUpload(files[0]);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <Check className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'error':
        return <X className="w-4 h-4 text-red-600" />;
      default:
        return <FileText className="w-4 h-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'success':
        return <Badge className="bg-green-100 text-green-800 border-green-200">Concluído</Badge>;
      case 'processing':
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Processando</Badge>;
      case 'error':
        return <Badge className="bg-red-100 text-red-800 border-red-200">Erro</Badge>;
      default:
        return <Badge variant="secondary">Pendente</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex items-center">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">CS</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">Contrato Seguro</h1>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Shield className="w-5 h-5 text-accent" />
                <span className="text-sm font-medium text-gray-700">
                  Análises restantes: <span className="text-primary font-bold">{credits}</span>
                </span>
              </div>
              <Button variant="outline" size="sm">
                Sair
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Upload Area */}
          <div className="lg:col-span-1">
            <Card className="border-2 border-dashed border-gray-300 hover:border-primary transition-colors">
              <CardHeader className="text-center">
                <CardTitle className="flex items-center justify-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Upload de Contrato</span>
                </CardTitle>
                <CardDescription>
                  Envie seu contrato em PDF para análise automatizada
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!isUploading ? (
                  <div
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                      isDragging ? 'border-primary bg-blue-50' : 'border-gray-300'
                    }`}
                    onDrop={handleDrop}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnter={() => setIsDragging(true)}
                    onDragLeave={() => setIsDragging(false)}
                  >
                    <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-600 mb-4">
                      Arraste seu contrato (.pdf) aqui ou clique para selecionar
                    </p>
                    <input
                      type="file"
                      accept=".pdf"
                      onChange={handleFileSelect}
                      className="hidden"
                      id="file-upload"
                    />
                    <label htmlFor="file-upload">
                      <Button className="gradient-primary border-0" asChild>
                        <span>Selecionar arquivo</span>
                      </Button>
                    </label>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                    <p className="text-gray-600 mb-2">Enviando contrato...</p>
                    <Progress value={75} className="w-full" />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Histórico de Análises */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>Histórico de Análises</CardTitle>
                <CardDescription>
                  Seus contratos analisados recentemente
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {contracts.map((contract) => (
                    <div
                      key={contract.id}
                      className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => window.location.href = `/analise/${contract.id}`}
                    >
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(contract.status)}
                        <div>
                          <h3 className="font-medium text-gray-900">
                            {contract.fileName}
                          </h3>
                          <p className="text-sm text-gray-500">
                            {formatDate(contract.createdAt)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3">
                        {getStatusBadge(contract.status)}
                        <Button variant="ghost" size="sm">
                          Ver análise
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">🤖 IA Especializada</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600">
                Nossa IA é especializada em legislação brasileira e contratos de prestação de serviço
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">⚡ Análise Rápida</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600">
                Resultados em até 2 minutos, destacando pontos críticos jurídicos e financeiros
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-lg">🔒 100% Seguro</CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-sm text-gray-600">
                Seus documentos são processados com total confidencialidade e segurança
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
