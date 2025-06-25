
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
    await supabase.from('audit_logs').insert({
      user_id: userId,
      action,
      details,
      timestamp: new Date().toISOString(),
      ip_address: 'edge-function'
    });
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
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.mp3', '.wav', '.webm', '.mp4'];
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));
    
    if (!hasValidExtension) {
      throw new Error('Tipo de arquivo não suportado. Use PDF, imagens ou áudio.');
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

    // 7. Processar com Gemini baseado no tipo de arquivo
    let analysisResult;

    if (fileName.endsWith('.pdf')) {
      // Para PDF, usar análise textual
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise o seguinte contrato PDF e forneça:

1. **Resumo Executivo**: Tipo de contrato e principais características
2. **Análise de Riscos**: Identifique cláusulas problemáticas ou arriscadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões de melhorias ou correções
5. **Conformidade**: Verificação com a legislação brasileira

Contrato: ${contract.file_name}
Forneça uma análise detalhada e estruturada em português brasileiro.`;

      const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + Deno.env.get('GEMINI_API_KEY'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: analysisPrompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      });

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.text();
        console.error('Gemini Error:', errorData);
        throw new Error(`Erro na análise por IA: ${geminiResponse.status}`);
      }

      const aiResult = await geminiResponse.json();
      const analysisText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'Análise não disponível';

      analysisResult = {
        summary: analysisText,
        analyzed_at: new Date().toISOString(),
        file_name: contract.file_name,
        status: 'completed'
      };

    } else if (fileName.match(/\.(jpg|jpeg|png)$/)) {
      // Para imagens, usar Gemini Vision
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise esta imagem de documento jurídico e forneça:

1. **Resumo Executivo**: Tipo de documento e principais características
2. **Análise de Riscos**: Identifique cláusulas problemáticas ou arriscadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões de melhorias ou correções
5. **Conformidade**: Verificação com a legislação brasileira

Forneça uma análise detalhada e estruturada em português brasileiro.`;
      
      const geminiResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + Deno.env.get('GEMINI_API_KEY'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: analysisPrompt },
              {
                inline_data: {
                  mime_type: `image/${fileName.endsWith('.png') ? 'png' : 'jpeg'}`,
                  data: base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      });

      if (!geminiResponse.ok) {
        const errorData = await geminiResponse.text();
        console.error('Gemini Error:', errorData);
        throw new Error(`Erro na análise de imagem: ${geminiResponse.status}`);
      }

      const aiResult = await geminiResponse.json();
      const analysisText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'Análise não disponível';

      analysisResult = {
        summary: analysisText,
        analyzed_at: new Date().toISOString(),
        file_name: contract.file_name,
        status: 'completed'
      };

    } else if (fileName.match(/\.(mp3|wav|webm|mp4)$/)) {
      // Para áudio, primeiro transcrever com Gemini e depois analisar
      const arrayBuffer = await fileData.arrayBuffer();
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)));
      
      // Transcrição com Gemini
      const transcriptionResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + Deno.env.get('GEMINI_API_KEY'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Transcreva este áudio em português brasileiro:" },
              {
                inline_data: {
                  mime_type: fileName.endsWith('.mp3') ? 'audio/mp3' : fileName.endsWith('.wav') ? 'audio/wav' : 'audio/webm',
                  data: base64
                }
              }
            ]
          }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1000
          }
        })
      });

      if (!transcriptionResponse.ok) {
        throw new Error(`Erro na transcrição do áudio: ${transcriptionResponse.status}`);
      }

      const transcriptionResult = await transcriptionResponse.json();
      const fileContent = transcriptionResult.candidates?.[0]?.content?.parts?.[0]?.text || 'Transcrição não disponível';
      
      const analysisPrompt = `Você é um especialista em direito brasileiro. Analise a seguinte transcrição de áudio jurídico e forneça:

1. **Resumo Executivo**: Tipo de conteúdo e principais pontos
2. **Análise Jurídica**: Identifique questões legais mencionadas
3. **Pontos de Atenção**: Aspectos que merecem revisão
4. **Recomendações**: Sugestões baseadas no conteúdo
5. **Próximos Passos**: Ações recomendadas

Transcrição: ${fileContent}
Forneça uma análise detalhada e estruturada em português brasileiro.`;

      const analysisResponse = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + Deno.env.get('GEMINI_API_KEY'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: analysisPrompt }]
          }],
          generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 2000
          }
        })
      });

      if (!analysisResponse.ok) {
        throw new Error(`Erro na análise de transcrição: ${analysisResponse.status}`);
      }

      const aiResult = await analysisResponse.json();
      const analysisText = aiResult.candidates?.[0]?.content?.parts?.[0]?.text || 'Análise não disponível';

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
