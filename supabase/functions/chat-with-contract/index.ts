
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Helper function for rate limiting
function checkRateLimit(userId: string, maxRequests = 30, windowMs = 60000): boolean {
  const now = Date.now();
  const userLimit = rateLimitStore.get(userId);
  
  if (!userLimit || now > userLimit.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + windowMs });
    return true;
  }
  
  if (userLimit.count >= maxRequests) {
    return false;
  }
  
  userLimit.count++;
  return true;
}

// Helper function for input sanitization
function sanitizeInput(input: string): string {
  return input.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
              .replace(/[<>]/g, '')
              .trim()
              .substring(0, 2000); // Limitar tamanho da mensagem
}

// Helper function for audit logging
async function logAuditEvent(supabase: any, userId: string, action: string, details: any) {
  try {
    console.log(`Audit log: ${action} for user ${userId}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Token de autenticação não fornecido");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (authError || !user) {
      throw new Error("Usuário não autenticado");
    }

    // Rate limiting
    if (!checkRateLimit(user.id, 30, 60000)) { // 30 messages per minute
      throw new Error("Muitas mensagens enviadas. Aguarde um momento.");
    }

    const requestData = await req.json();
    const { contract_id, user_message, general_chat, file_path, file_name } = requestData;

    if (!user_message || typeof user_message !== 'string') {
      throw new Error("Mensagem do usuário é obrigatória");
    }

    // Sanitizar entrada do usuário
    const sanitizedMessage = sanitizeInput(user_message);
    if (!sanitizedMessage) {
      throw new Error("Mensagem inválida após sanitização");
    }

    // Preparar contexto
    let context = "";
    let systemPrompt = "";
    let messages = [];

    if (general_chat) {
      // Chat geral sobre questões jurídicas
      systemPrompt = `Você é uma assistente jurídica virtual especializada em direito brasileiro. 
      Responda perguntas sobre direito de forma clara, didática e precisa.
      Sempre mencione que suas respostas são informativas e não substituem a consulta com um advogado.
      Mantenha as respostas concisas mas completas.
      Responda sempre em português brasileiro.
      Não forneça conselhos jurídicos específicos, apenas informações gerais.`;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: sanitizedMessage }
      ];

      // Se há arquivo anexado, mencionar na mensagem
      if (file_path && file_name) {
        messages[1].content = `Arquivo anexado: ${file_name}\n\n${sanitizedMessage}`;
      }

      // Log para chat geral
      await logAuditEvent(supabaseClient, user.id, 'general_chat_message', {
        message_length: sanitizedMessage.length,
        has_file: !!file_path
      });

    } else {
      // Chat específico sobre contrato
      if (!contract_id || typeof contract_id !== 'string') {
        throw new Error("ID do contrato é obrigatório para chat específico");
      }

      // Buscar o contrato e sua análise com validação de propriedade
      const { data: contractData, error: contractError } = await supabaseClient
        .from('contracts')
        .select('file_name, user_id')
        .eq('id', contract_id)
        .eq('user_id', user.id) // Verificar se o contrato pertence ao usuário
        .single();

      if (contractError || !contractData) {
        throw new Error("Contrato não encontrado ou acesso negado");
      }

      const { data: analysisData, error: analysisError } = await supabaseClient
        .from('analyses')
        .select('analysis_result')
        .eq('contract_id', contract_id)
        .single();

      if (analysisError || !analysisData) {
        throw new Error("Análise do contrato não encontrada");
      }

      context = `Contrato: ${contractData.file_name}\n\nAnálise: ${JSON.stringify(analysisData.analysis_result)}`;
      systemPrompt = `Você é um assistente jurídico especializado em análise de contratos. 
      Responda perguntas sobre o contrato fornecido de forma clara e precisa.
      Use as informações da análise para dar respostas contextualizadas.
      Sempre mencione que suas respostas são informativas e não substituem a consulta com um advogado.
      Responda sempre em português brasileiro.
      Não forneça conselhos jurídicos específicos, apenas interpretações das informações disponíveis.`;

      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `${context}\n\nPergunta do usuário: ${sanitizedMessage}` }
      ];

      // Log para chat específico
      await logAuditEvent(supabaseClient, user.id, 'contract_chat_message', {
        contract_id,
        message_length: sanitizedMessage.length
      });
    }

    // Fazer chamada para OpenAI
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: messages,
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!openaiResponse.ok) {
      const errorData = await openaiResponse.text();
      console.error('OpenAI Error:', errorData);
      throw new Error(`Erro na API OpenAI: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices?.[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    // Sanitizar resposta da IA
    const sanitizedResponse = sanitizeInput(aiResponse);

    // Salvar no histórico apenas se for chat específico de contrato
    if (!general_chat && contract_id) {
      const { error: insertError } = await supabaseClient
        .from('chat_history')
        .insert({
          contract_id,
          user_message: sanitizedMessage,
          ai_response: sanitizedResponse,
          user_id: user.id
        });

      if (insertError) {
        console.error('Erro ao salvar histórico:', insertError);
      }
    }

    return new Response(
      JSON.stringify({ ai_response: sanitizedResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Erro no chat:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno do servidor" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
