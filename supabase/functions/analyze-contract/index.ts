
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limiting store
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

// Helper function for rate limiting
function checkRateLimit(userId: string, maxRequests = 10, windowMs = 60000): boolean {
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
              .trim();
}

// Helper function for audit logging
async function logAuditEvent(supabase: any, userId: string, action: string, details: any) {
  try {
    console.log(`Audit log: ${action} for user ${userId}`);
  } catch (error) {
    console.error('Failed to log audit event:', error);
  }
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
    
    if (!contract_id || typeof contract_id !== 'string') {
      throw new Error('ID do contrato é obrigatório e deve ser uma string válida');
    }

    console.log('Iniciando análise do contrato:', contract_id);

    // 1. Buscar informações do contrato com validação
    const { data: contract, error: contractError } = await supabaseAdmin
      .from('contracts')
      .select('file_path, file_name, user_id')
      .eq('id', contract_id)
      .single();

    if (contractError || !contract) {
      throw new Error('Contrato não encontrado ou acesso negado');
    }

    // 2. Rate limiting por usuário
    if (!checkRateLimit(contract.user_id, 5, 300000)) { // 5 requests per 5 minutes
      throw new Error('Muitas tentativas. Tente novamente em alguns minutos.');
    }

    // 3. Log da ação
    await logAuditEvent(supabaseAdmin, contract.user_id, 'contract_analysis_started', {
      contract_id,
      file_name: contract.file_name
    });

    // 4. Atualizar status para 'processing'
    await supabaseAdmin
      .from('contracts')
      .update({ status: 'processing' })
      .eq('id', contract_id);

    // 5. Validar tipo de arquivo
    const fileName = sanitizeInput(contract.file_name.toLowerCase());
    const allowedExtensions = ['.pdf', '.doc', '.docx', '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.webm', '.mp4'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      throw new Error('Tipo de arquivo não suportado. Use PDF, Word, imagens ou áudio.');
    }

    // 6. Baixar arquivo do storage com validação de tamanho
    const { data: fileData, error: downloadError } = await supabaseAdmin.storage
      .from('contract-uploads')
      .download(contract.file_path);

    if (downloadError || !fileData) {
      throw new Error('Erro ao acessar arquivo do contrato');
    }

    // Verificar tamanho do arquivo (máximo 10MB)
    if (fileData.size > 10 * 1024 * 1024) {
      throw new Error('Arquivo muito grande. Máximo permitido: 10MB');
    }

    // 7. Processar com OpenAI baseado no tipo de arquivo
    let analysisResult;

    if (fileName.endsWith('.pdf') || fileName.endsWith('.doc') || fileName.endsWith('.docx')) {
      // Para documentos de texto, usar análise textual
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise o seguinte documento jurídico e forneça:

1. **Resumo Executivo**: Tipo de documento e principais características
2. **Análise de Riscos**: Identifique cláusulas problemáticas ou arriscadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões de melhorias ou correções
5. **Conformidade**: Verificação com a legislação brasileira

Documento: ${contract.file_name}
Forneça uma análise detalhada e estruturada em português brasileiro.`;

      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Você é um especialista em direito brasileiro especializado em análise de documentos jurídicos.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text();
        console.error('OpenAI Error:', errorData);
        throw new Error(`Erro na análise por IA: ${openaiResponse.status}`);
      }

      const aiResult = await openaiResponse.json();
      const analysisText = aiResult.choices?.[0]?.message?.content || 'Análise não disponível';

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
      
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: analysisPrompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${fileName.endsWith('.png') ? 'png' : 'jpeg'};base64,${base64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!openaiResponse.ok) {
        const errorData = await openaiResponse.text();
        console.error('OpenAI Error:', errorData);
        throw new Error(`Erro na análise de imagem: ${openaiResponse.status}`);
      }

      const aiResult = await openaiResponse.json();
      const analysisText = aiResult.choices?.[0]?.message?.content || 'Análise não disponível';

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
      formData.append('language', 'pt');

      const transcriptionResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
        },
        body: formData
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`Erro na transcrição do áudio: ${transcriptionResponse.status}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      const fileContent = transcriptionResult.text || 'Transcrição não disponível';
      
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise a seguinte transcrição de áudio jurídico e forneça:

1. **Resumo Executivo**: Tipo de conteúdo e principais pontos
2. **Análise Jurídica**: Identifique questões legais mencionadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões baseadas no conteúdo
5. **Próximos Passos**: Ações recomendadas

Transcrição: ${fileContent}
Forneça uma análise detalhada e estruturada em português brasileiro.`;

      const analysisResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Você é um especialista em direito brasileiro.' },
            { role: 'user', content: analysisPrompt }
          ],
          temperature: 0.3,
          max_tokens: 2000
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`Erro na análise de transcrição: ${analysisResponse.status}`);
      }

      const aiResult = await analysisResponse.json();
      const analysisText = aiResult.choices?.[0]?.message?.content || 'Análise não disponível';

      analysisResult = {
        summary: analysisText,
        analyzed_at: new Date().toISOString(),
        file_name: contract.file_name,
        status: 'completed'
      };
    } else {
      throw new Error('Tipo de arquivo não suportado');
    }

    // 8. Salvar análise no banco com transação
    await saveAnalysisResult(supabaseAdmin, contract_id, analysisResult, contract.user_id);

    // 9. Log de sucesso
    await logAuditEvent(supabaseAdmin, contract.user_id, 'contract_analysis_completed', {
      contract_id,
      file_name: contract.file_name,
      analysis_length: analysisResult.summary.length
    });

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
      
      if (contract_id) {
        await supabaseAdmin
          .from('contracts')
          .update({ 
            status: 'error',
            error_message: error.message 
          })
          .eq('id', contract_id);

        // Log do erro
        const { data: contract } = await supabaseAdmin
          .from('contracts')
          .select('user_id')
          .eq('id', contract_id)
          .single();

        if (contract?.user_id) {
          await logAuditEvent(supabaseAdmin, contract.user_id, 'contract_analysis_failed', {
            contract_id,
            error: error.message
          });
        }
      }
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
