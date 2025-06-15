
import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, AlertTriangle, Shield, Users, Calendar, DollarSign, FileText, Download } from "lucide-react";

const ContractAnalysis = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [analysisData, setAnalysisData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Mock data da análise
  useEffect(() => {
    setTimeout(() => {
      setAnalysisData({
        fileName: "contrato_servicos_web.pdf",
        parties: {
          contractor: "João Silva Desenvolvimento Web LTDA",
          client: "Empresa ABC Comércio Online"
        },
        subject: "Desenvolvimento de website institucional com sistema de e-commerce integrado",
        payment: {
          value: "R$ 15.000,00 divididos em 3 parcelas de R$ 5.000,00",
          due_dates: "1ª parcela: assinatura do contrato, 2ª parcela: entrega do layout, 3ª parcela: entrega final"
        },
        term: {
          start_date: "01/02/2024",
          end_date: "30/04/2024",
          renewal: "Não há cláusula de renovação automática"
        },
        termination_clause: {
          penalty_for_client: "Multa de 30% sobre o valor restante do contrato",
          penalty_for_contractor: "Multa de 50% sobre o valor total do contrato + devolução integral dos valores pagos",
          notice_period: "30 dias de antecedência por escrito"
        },
        key_responsibilities: {
          contractor_duties: [
            "Desenvolver website responsivo conforme briefing",
            "Integrar sistema de pagamento",
            "Fornecer treinamento para uso da plataforma",
            "Garantir funcionamento por 90 dias após entrega"
          ],
          client_duties: [
            "Fornecer conteúdo e imagens necessárias",
            "Realizar pagamentos nas datas acordadas",
            "Disponibilizar acesso a sistemas quando necessário",
            "Aprovar layouts e funcionalidades em até 5 dias úteis"
          ]
        },
        attention_points: [
          {
            risk_level: "alto",
            clause: "Cláusula de rescisão - Multa do prestador",
            analysis: "A multa de 50% sobre o valor total para o prestador é considerada excessiva e pode ser considerada abusiva. A legislação brasileira prevê que multas não devem ser superiores a 2% do valor da prestação."
          },
          {
            risk_level: "médio", 
            clause: "Prazo de aprovação - 5 dias úteis",
            analysis: "O prazo de 5 dias úteis para aprovação pode ser curto dependendo da complexidade. Recomenda-se estabelecer prazos diferenciados para diferentes tipos de entregáveis."
          },
          {
            risk_level: "baixo",
            clause: "Garantia de funcionamento",
            analysis: "Período de garantia de 90 dias está dentro dos padrões de mercado para desenvolvimento web."
          }
        ]
      });
      setLoading(false);
    }, 1000);
  }, [id]);

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'alto':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'médio':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'baixo':
        return 'bg-green-100 text-green-800 border-green-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getRiskIcon = (level: string) => {
    switch (level) {
      case 'alto':
        return '🚨';
      case 'médio':
        return '⚠️';
      case 'baixo':
        return '✅';
      default:
        return '📄';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando análise...</p>
        </div>
      </div>
    );
  }

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600">Análise não encontrada</p>
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
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => navigate('/dashboard')}
                className="mr-4"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar
              </Button>
              <div className="flex items-center">
                <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center mr-3">
                  <span className="text-white font-bold text-sm">CS</span>
                </div>
                <h1 className="text-xl font-bold text-gray-900">Análise do Contrato</h1>
              </div>
            </div>
            
            <Button variant="outline" size="sm">
              <Download className="w-4 h-4 mr-2" />
              Exportar Relatório
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Título */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            {analysisData.fileName}
          </h2>
          <p className="text-gray-600">Análise completa realizada pela IA especializada</p>
        </div>

        {/* Pontos de Atenção - Destaque principal */}
        <Card className="mb-8 border-l-4 border-l-orange-500">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-orange-600" />
              <span>Pontos de Atenção Críticos</span>
            </CardTitle>
            <CardDescription>
              Questões que merecem sua atenção imediata
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {analysisData.attention_points.map((point: any, index: number) => (
                <div key={index} className="border rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <span className="text-2xl">{getRiskIcon(point.risk_level)}</span>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <Badge className={getRiskColor(point.risk_level)}>
                          Risco {point.risk_level}
                        </Badge>
                      </div>
                      <h4 className="font-semibold text-gray-900 mb-2">
                        {point.clause}
                      </h4>
                      <p className="text-gray-700 text-sm leading-relaxed">
                        {point.analysis}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Grid de informações */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Partes do Contrato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Users className="w-5 h-5 text-blue-600" />
                <span>Partes do Contrato</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold text-gray-900">Contratado</h4>
                  <p className="text-gray-700">{analysisData.parties.contractor}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Contratante</h4>
                  <p className="text-gray-700">{analysisData.parties.client}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Objeto do Contrato */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <FileText className="w-5 h-5 text-green-600" />
                <span>Objeto do Contrato</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-700">{analysisData.subject}</p>
            </CardContent>
          </Card>

          {/* Pagamento */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <DollarSign className="w-5 h-5 text-green-600" />
                <span>Condições de Pagamento</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <h4 className="font-semibold text-gray-900">Valor</h4>
                  <p className="text-gray-700">{analysisData.payment.value}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Vencimentos</h4>
                  <p className="text-gray-700">{analysisData.payment.due_dates}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Prazo */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-purple-600" />
                <span>Prazo e Vigência</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <h4 className="font-semibold text-gray-900">Início</h4>
                  <p className="text-gray-700">{analysisData.term.start_date}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Término</h4>
                  <p className="text-gray-700">{analysisData.term.end_date}</p>
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Renovação</h4>
                  <p className="text-gray-700">{analysisData.term.renewal}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Responsabilidades */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card>
            <CardHeader>
              <CardTitle>Obrigações do Contratado</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysisData.key_responsibilities.contractor_duties.map((duty: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-green-600 mt-1">•</span>
                    <span className="text-gray-700 text-sm">{duty}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Obrigações do Contratante</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {analysisData.key_responsibilities.client_duties.map((duty: string, index: number) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-blue-600 mt-1">•</span>
                    <span className="text-gray-700 text-sm">{duty}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Cláusulas de Rescisão */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-red-600" />
              <span>Cláusulas de Rescisão</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Rescisão pelo Contratante</h4>
                <p className="text-gray-700 text-sm">{analysisData.termination_clause.penalty_for_client}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Rescisão pelo Contratado</h4>
                <p className="text-gray-700 text-sm">{analysisData.termination_clause.penalty_for_contractor}</p>
              </div>
              <div>
                <h4 className="font-semibold text-gray-900 mb-2">Aviso Prévio</h4>
                <p className="text-gray-700 text-sm">{analysisData.termination_clause.notice_period}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ContractAnalysis;
