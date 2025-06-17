
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user) {
      throw new Error("Usuário não autenticado");
    }

    const { contract_id, user_message, general_chat } = await req.json();

    if (!user_message) {
      throw new Error("Mensagem do usuário é obrigatória");
    }

    // Preparar contexto
    let context = "";
    let systemPrompt = "";

    if (general_chat) {
      // Chat geral sobre questões jurídicas
      systemPrompt = `Você é uma assistente jurídica virtual especializada em direito brasileiro. 
      Responda perguntas sobre direito de forma clara, didática e precisa.
      Sempre mencione que suas respostas são informativas e não substituem a consulta com um advogado.
      Mantenha as respostas concisas mas completas.
      Responda sempre em português brasileiro.`;
    } else {
      // Chat específico sobre contrato
      if (!contract_id) {
        throw new Error("ID do contrato é obrigatório para chat específico");
      }

      // Buscar o contrato e sua análise
      const { data: contractData, error: contractError } = await supabaseClient
        .from('contracts')
        .select('file_name')
        .eq('id', contract_id)
        .eq('user_id', user.id)
        .single();

      if (contractError || !contractData) {
        throw new Error("Contrato não encontrado");
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
      Responda sempre em português brasileiro.`;
    }

    // Fazer chamada para OpenAI
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          },
          {
            role: 'user',
            content: context ? `${context}\n\nPergunta: ${user_message}` : user_message
          }
        ],
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!openAIResponse.ok) {
      throw new Error(`Erro na API OpenAI: ${openAIResponse.status}`);
    }

    const openAIData = await openAIResponse.json();
    const aiResponse = openAIData.choices[0]?.message?.content || "Desculpe, não consegui processar sua pergunta.";

    // Salvar no histórico apenas se for chat específico de contrato
    if (!general_chat && contract_id) {
      const { error: insertError } = await supabaseClient
        .from('chat_history')
        .insert({
          contract_id,
          user_message,
          ai_response: aiResponse,
          user_id: user.id
        });

      if (insertError) {
        console.error('Erro ao salvar histórico:', insertError);
      }
    }

    return new Response(
      JSON.stringify({ ai_response: aiResponse }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Erro no chat:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
