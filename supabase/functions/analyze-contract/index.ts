
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface AnalyzePayload {
  contract_id: string;
}

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
    const payload: AnalyzePayload = await req.json();
    const { contract_id } = payload;
    
    console.log('Iniciando análise do contrato:', contract_id);

    // 1. Atualizar status para 'processing'
    await supabaseAdmin
      .from('contracts')
      .update({ status: 'processing' })
      .eq('id', contract_id);

    // 2. Buscar informações do contrato
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('file_path, file_name, user_id')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      throw new Error('Contrato não encontrado');
    }

    // 3. Baixar arquivo do storage
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('contract-uploads')
      .download(contract.file_path);

    if (downloadError || !fileData) {
      throw new Error('Erro ao baixar arquivo do contrato');
    }

    // 4. Extrair texto do arquivo (simulação - em produção usaria biblioteca PDF)
    const fileText = await fileData.text();
    console.log('Texto extraído do arquivo:', fileText.substring(0, 200) + '...');

    // 5. Prompt para análise jurídica
    const analysisPrompt = `Você é um especialista em direito brasileiro. Analise o seguinte contrato e forneça:

1. **Resumo Executivo**: Tipo de contrato e principais características
2. **Análise de Riscos**: Identifique cláusulas problemáticas ou arriscadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões de melhorias ou correções
5. **Conformidade**: Verificação com a legislação brasileira

Contrato a analisar:
---
${fileText}
---

Forneça uma análise detalhada e estruturada em português brasileiro.`;

    // 6. Chamar OpenAI para análise
    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages: [{ role: 'user', content: analysisPrompt }],
        temperature: 0.3,
        max_tokens: 2000
      })
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('Erro na chamada OpenAI:', errorText);
      throw new Error('Erro na análise por IA');
    }

    const aiResult = await openAIResponse.json();
    const analysisText = aiResult.choices[0].message.content;

    // 7. Estruturar resultado da análise
    const analysisResult = {
      summary: analysisText,
      analyzed_at: new Date().toISOString(),
      file_name: contract.file_name,
      status: 'completed'
    };

    // 8. Salvar análise no banco
    const { error: analysisError } = await supabaseAdmin
      .from('analyses')
      .insert({
        contract_id,
        analysis_result: analysisResult
      });

    if (analysisError) {
      throw new Error('Erro ao salvar análise');
    }

    // 9. Salvar versão inicial do contrato
    const { error: versionError } = await supabaseAdmin
      .from('contract_versions')
      .insert({
        contract_id,
        version_number: 1,
        content_text: fileText
      });

    if (versionError) {
      console.error('Erro ao salvar versão inicial:', versionError);
    }

    // 10. Decrementar créditos do usuário
    const { error: creditError } = await supabaseAdmin
      .from('user_profiles')
      .update({ credits: supabaseAdmin.sql`credits - 1` })
      .eq('user_id', contract.user_id);

    if (creditError) {
      console.error('Erro ao decrementar créditos:', creditError);
    }

    // 11. Atualizar status para 'success'
    await supabaseAdmin
      .from('contracts')
      .update({ status: 'success' })
      .eq('id', contract_id);

    console.log('Análise concluída com sucesso para contrato:', contract_id);

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Análise concluída com sucesso',
      analysis_id: contract_id 
    }), {
      status: 200,
      headers: corsHeaders
    });

  } catch (error) {
    console.error('Erro na análise:', error);
    
    // Atualizar status para 'error' em caso de falha
    try {
      const payload: AnalyzePayload = await req.json();
      await supabaseAdmin
        .from('contracts')
        .update({ 
          status: 'error',
          error_message: error.message 
        })
        .eq('id', payload.contract_id);
    } catch (updateError) {
      console.error('Erro ao atualizar status de erro:', updateError);
    }

    return new Response(JSON.stringify({ 
      error: error.message || 'Erro interno do servidor' 
    }), {
      status: 500,
      headers: corsHeaders
    });
  }
});
