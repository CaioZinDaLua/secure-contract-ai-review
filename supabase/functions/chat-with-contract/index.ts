
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ChatPayload {
  contract_id: string;
  user_message: string;
}

const getChatAiPrompt = (
  originalAnalysis: string,
  chatHistory: string,
  latestVersionText: string,
  userMessage: string
): string => {
  return `Você é "Contrato Seguro", um assistente jurídico virtual especialista em legislação brasileira. Sua tarefa é responder perguntas e, quando solicitado explicitamente, fazer correções no contrato de um usuário.

CONTEXTO FORNECIDO:
1.  **Análise Inicial do Contrato:**
    ${originalAnalysis}

2.  **Histórico da Conversa (últimas 5 trocas):**
    ${chatHistory}

3.  **Versão Mais Recente do Contrato (Texto Completo):**
    ---
    ${latestVersionText}
    ---

TAREFA ATUAL:
O usuário disse: "${userMessage}"

INSTRUÇÕES:
- Baseie TODAS as suas respostas no contexto fornecido.
- Se o usuário fizer uma pergunta, responda de forma clara e objetiva.
- **SE E SOMENTE SE** o usuário usar frases como "corrija o contrato", "altere a cláusula", "modifique o texto" ou "faça a correção", você deve:
    1.  Confirmar a alteração na sua resposta.
    2.  No final da sua resposta, incluir o texto COMPLETO e ATUALIZADO do contrato dentro de um bloco delimitado por "[[[START_CONTRACT]]]" e "[[[END_CONTRACT]]]". É crucial que o contrato inteiro seja retornado, não apenas a parte alterada.
- Se não for um pedido de correção, apenas responda à pergunta sem incluir o bloco de contrato.
`;
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method Not Allowed' }), { 
      status: 405,
      headers: corsHeaders 
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  try {
    const payload: ChatPayload = await req.json();
    const { contract_id, user_message } = payload;
    
    // Extrai o user_id do token de autorização JWT
    const authHeader = req.headers.get('Authorization')!;
    const jwt = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseAdmin.auth.getUser(jwt);
    if (!user) throw new Error("Usuário não autenticado.");

    // Verificação de Plano PRO
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('user_profiles')
        .select('plan_type')
        .eq('user_id', user.id)
        .single();
    if (profileError || profile.plan_type !== 'pro') {
        throw new Error("Acesso negado. Esta funcionalidade é exclusiva para assinantes PRO.");
    }

    // Coleta de Contexto
    // Análise inicial
    const { data: analysisData } = await supabaseAdmin
      .from('analyses')
      .select('analysis_result')
      .eq('contract_id', contract_id)
      .single();
    
    // Versão mais recente do texto
    const { data: versionData } = await supabaseAdmin
      .from('contract_versions')
      .select('content_text, version_number')
      .eq('contract_id', contract_id)
      .order('version_number', { ascending: false })
      .limit(1)
      .single();
    
    // Histórico da conversa
    const { data: chatData } = await supabaseAdmin
      .from('chat_history')
      .select('user_message, ai_response')
      .eq('contract_id', contract_id)
      .order('created_at', { ascending: false })
      .limit(5);

    const originalAnalysis = JSON.stringify(analysisData?.analysis_result || {});
    const latestVersionText = versionData?.content_text || '';
    const chatHistory = chatData?.map(m => `Usuário: ${m.user_message}\nIA: ${m.ai_response}`).reverse().join('\n') || 'Nenhum histórico.';

    // Chamada para a IA
    const aiPrompt = getChatAiPrompt(originalAnalysis, chatHistory, latestVersionText, user_message);
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json', 
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}` 
        },
        body: JSON.stringify({
            model: 'gpt-4-turbo',
            messages: [{ role: 'user', content: aiPrompt }],
            temperature: 0.5,
        }),
    });

    if (!openAIResponse.ok) throw new Error("Erro na comunicação com a IA.");
    
    const aiResult = await openAIResponse.json();
    let aiResponseMessage = aiResult.choices[0].message.content;

    // Processamento e Persistência
    let newContractText: string | null = null;
    const contractRegex = /\[\[\[START_CONTRACT\]\]\]([\s\S]*?)\[\[\[END_CONTRACT\]\]\]/;
    const match = aiResponseMessage.match(contractRegex);

    if (match && match[1]) {
      newContractText = match[1].trim();
      // Limpa a resposta para o usuário, removendo o bloco do contrato
      aiResponseMessage = aiResponseMessage.replace(contractRegex, '').trim();
    }
    
    // Salva a conversa no histórico
    await supabaseAdmin
      .from('chat_history')
      .insert({ 
        contract_id, 
        user_id: user.id, 
        user_message, 
        ai_response: aiResponseMessage 
      });
    
    // Se houver uma nova versão, salva-a
    if (newContractText) {
      const newVersionNumber = (versionData?.version_number || 0) + 1;
      await supabaseAdmin
        .from('contract_versions')
        .insert({
          contract_id,
          version_number: newVersionNumber,
          content_text: newContractText
        });
    }

    return new Response(JSON.stringify({ ai_response: aiResponseMessage }), {
      status: 200,
      headers: corsHeaders,
    });

  } catch (error) {
    console.error('Erro no chat:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
