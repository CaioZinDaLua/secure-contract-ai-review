
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
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
    console.log("Iniciando create-checkout...");

    // Inicializar Supabase
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("Header de autorização não encontrado");
      return new Response(
        JSON.stringify({ error: "Header de autorização não encontrado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !data.user?.email) {
      console.error("Erro de autenticação:", authError);
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const user = data.user;
    console.log("Usuário autenticado:", user.email);

    // Verificar chave do Stripe
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Configuração do Stripe não encontrada" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log("Chave do Stripe encontrada");

    // Inicializar Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    // Verificar dados da requisição
    let requestData;
    try {
      requestData = await req.json();
    } catch (e) {
      console.error("Erro ao parsear JSON:", e);
      return new Response(
        JSON.stringify({ error: "Dados da requisição inválidos" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    const { plan } = requestData;
    if (plan !== 'pro') {
      console.error("Plano inválido:", plan);
      return new Response(
        JSON.stringify({ error: "Plano inválido" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log("Verificando customer existente...");

    // Verificar se já existe customer
    let customerId;
    try {
      const customers = await stripe.customers.list({
        email: user.email,
        limit: 1
      });

      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log("Customer existente encontrado:", customerId);
      } else {
        console.log("Criando novo customer...");
        const customer = await stripe.customers.create({
          email: user.email,
          metadata: {
            supabase_user_id: user.id
          }
        });
        customerId = customer.id;
        console.log("Novo customer criado:", customerId);
      }
    } catch (error) {
      console.error("Erro ao gerenciar customer do Stripe:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao configurar cliente no Stripe" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    console.log("Criando sessão de checkout...");

    // Criar sessão de checkout
    let session;
    try {
      session = await stripe.checkout.sessions.create({
        customer: customerId,
        line_items: [
          {
            price_data: {
              currency: "brl",
              product_data: {
                name: "Contrato Seguro PRO",
                description: "Acesso completo ao chat com IA e funcionalidades avançadas"
              },
              unit_amount: 2790, // R$ 27,90
              recurring: {
                interval: "month"
              }
            },
            quantity: 1,
          },
        ],
        mode: "subscription",
        success_url: `${req.headers.get("origin")}/dashboard?upgrade=success`,
        cancel_url: `${req.headers.get("origin")}/dashboard?upgrade=cancelled`,
        metadata: {
          user_id: user.id,
          plan: "pro"
        }
      });
      
      console.log("Sessão criada com sucesso:", session.id);
    } catch (error) {
      console.error("Erro ao criar sessão do Stripe:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao criar sessão de pagamento" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 500,
        }
      );
    }

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Erro geral no checkout:", error);
    return new Response(
      JSON.stringify({ 
        error: "Erro interno do servidor",
        details: error.message
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
