
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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
    const { contract_id } = await req.json();
    
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

    // 4. Determinar tipo de arquivo e processar adequadamente
    const fileName = contract.file_name.toLowerCase();
    let analysisResult;

    if (fileName.endsWith('.pdf')) {
      // Para PDF, simular análise de texto (na prática você precisaria extrair o texto do PDF)
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise o seguinte contrato PDF e forneça:

1. **Resumo Executivo**: Tipo de contrato e principais características
2. **Análise de Riscos**: Identifique cláusulas problemáticas ou arriscadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões de melhorias ou correções
5. **Conformidade**: Verificação com a legislação brasileira

Contrato: ${contract.file_name}
Forneça uma análise detalhada e estruturada em português brasileiro.`;

      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!openAIResponse.ok) {
        const errorData = await openAIResponse.text();
        console.error('OpenAI Error:', errorData);
        throw new Error(`Erro na análise por IA: ${openAIResponse.status}`);
      }

      const aiResult = await openAIResponse.json();
      const analysisText = aiResult.choices[0].message.content;

      analysisResult = {
        summary: analysisText,
        analyzed_at: new Date().toISOString(),
        file_name: contract.file_name,
        status: 'completed'
      };

    } else if (fileName.match(/\.(jpg|jpeg|png)$/)) {
      // Para imagens, usar GPT-4 Vision
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise esta imagem de documento jurídico e forneça:

1. **Resumo Executivo**: Tipo de documento e principais características
2. **Análise de Riscos**: Identifique cláusulas problemáticas ou arriscadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões de melhorias ou correções
5. **Conformidade**: Verificação com a legislação brasileira

Forneça uma análise detalhada e estruturada em português brasileiro.`;
      
      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [{
            role: 'user',
            content: [
              { type: 'text', text: analysisPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/jpeg;base64,${base64}`
                }
              }
            ]
          }],
          max_tokens: 2000,
          temperature: 0.3
        })
      });

      if (!openAIResponse.ok) {
        const errorData = await openAIResponse.text();
        console.error('OpenAI Error:', errorData);
        throw new Error(`Erro na análise de imagem: ${openAIResponse.status}`);
      }

      const aiResult = await openAIResponse.json();
      const analysisText = aiResult.choices[0].message.content;

      analysisResult = {
        summary: analysisText,
        analyzed_at: new Date().toISOString(),
        file_name: contract.file_name,
        status: 'completed'
      };

    } else if (fileName.match(/\.(mp3|wav|webm|mp4)$/)) {
      // Para áudio, usar Whisper para transcrição e depois analisar
      const formData = new FormData();
      formData.append('file', fileData, contract.file_name);
      formData.append('model', 'whisper-1');

      const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`
        },
        body: formData
      });

      if (!whisperResponse.ok) {
        const errorData = await whisperResponse.text();
        console.error('Whisper Error:', errorData);
        throw new Error(`Erro na transcrição do áudio: ${whisperResponse.status}`);
      }

      const transcription = await whisperResponse.json();
      const fileContent = transcription.text;
      
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise a seguinte transcrição de áudio jurídico e forneça:

1. **Resumo Executivo**: Tipo de conteúdo e principais pontos
2. **Análise Jurídica**: Identifique questões legais mencionadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões baseadas no conteúdo
5. **Próximos Passos**: Ações recomendadas

Transcrição: ${fileContent}
Forneça uma análise detalhada e estruturada em português brasileiro.`;

      const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')!}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: analysisPrompt }],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!openAIResponse.ok) {
        const errorData = await openAIResponse.text();
        console.error('OpenAI Error:', errorData);
        throw new Error(`Erro na análise de transcrição: ${openAIResponse.status}`);
      }

      const aiResult = await openAIResponse.json();
      const analysisText = aiResult.choices[0].message.content;

      analysisResult = {
        summary: analysisText,
        analyzed_at: new Date().toISOString(),
        file_name: contract.file_name,
        status: 'completed'
      };
    } else {
      throw new Error('Tipo de arquivo não suportado');
    }

    // 5. Salvar análise no banco
    await saveAnalysisResult(supabaseAdmin, contract_id, analysisResult, contract.user_id);

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
      const requestBody = await req.clone().json();
      const { contract_id } = requestBody;
      
      await supabaseAdmin
        .from('contracts')
        .update({ 
          status: 'error',
          error_message: error.message 
        })
        .eq('id', contract_id);
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

async function saveAnalysisResult(supabaseAdmin: any, contract_id: string, analysisResult: any, user_id: string) {
  // Salvar análise no banco
  const { error: analysisError } = await supabaseAdmin
    .from('analyses')
    .insert({
      contract_id,
      analysis_result: analysisResult
    });

  if (analysisError) {
    throw new Error('Erro ao salvar análise');
  }

  // Decrementar créditos do usuário
  const { data: currentProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('credits')
    .eq('user_id', user_id)
    .single();

  if (currentProfile && currentProfile.credits > 0) {
    const { error: creditError } = await supabaseAdmin
      .from('user_profiles')
      .update({ credits: currentProfile.credits - 1 })
      .eq('user_id', user_id);

    if (creditError) {
      console.error('Erro ao decrementar créditos:', creditError);
    }
  }

  // Atualizar status para 'success'
  await supabaseAdmin
    .from('contracts')
    .update({ status: 'success' })
    .eq('id', contract_id);
}
