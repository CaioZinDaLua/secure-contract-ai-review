
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

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    // Verificar autenticação
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Header de autorização não encontrado");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data } = await supabaseClient.auth.getUser(token);
    const user = data.user;
    
    if (!user?.email) {
      throw new Error("Usuário não autenticado ou email não disponível");
    }

    console.log("Usuário autenticado:", user.email);

    // Verificar se a chave do Stripe está configurada
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      console.error("STRIPE_SECRET_KEY não configurada");
      throw new Error("Chave do Stripe não configurada");
    }

    if (!stripeKey.startsWith("sk_")) {
      console.error("Chave do Stripe inválida - deve começar com sk_");
      throw new Error("Chave do Stripe deve ser uma chave secreta (sk_)");
    }

    console.log("Chave do Stripe configurada corretamente");

    // Inicializar Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: "2023-10-16",
    });

    const { plan } = await req.json();

    if (plan !== 'pro') {
      throw new Error("Plano inválido");
    }

    console.log("Verificando customer existente...");

    // Verificar se já existe customer
    const customers = await stripe.customers.list({
      email: user.email,
      limit: 1
    });

    let customerId;
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

    console.log("Criando sessão de checkout...");

    // Criar sessão de checkout para assinatura
    const session = await stripe.checkout.sessions.create({
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

    return new Response(
      JSON.stringify({ url: session.url }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    console.error("Erro no checkout:", error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: "Verifique os logs da função para mais detalhes"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
