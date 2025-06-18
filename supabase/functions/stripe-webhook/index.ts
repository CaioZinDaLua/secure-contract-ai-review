
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
  apiVersion: "2023-10-16",
});

const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

serve(async (req) => {
  console.log("Webhook recebido - método:", req.method);
  
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  
  if (!signature) {
    console.error("Sem assinatura do Stripe");
    return new Response("No signature", { status: 400 });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("STRIPE_WEBHOOK_SECRET não configurado");
      return new Response("Webhook secret not configured", { status: 500 });
    }

    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      webhookSecret
    );

    console.log("Evento recebido:", event.type, "ID:", event.id);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        console.log("Checkout completado:", session.id, "Cliente:", session.customer);
        
        if (session.mode === "subscription" && session.metadata?.user_id) {
          console.log("Atualizando usuário para PRO:", session.metadata.user_id);
          
          // Atualizar usuário para PRO
          const { error } = await supabase
            .from('user_profiles')
            .update({ 
              plan_type: 'pro',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', session.metadata.user_id);

          if (error) {
            console.error("Erro ao atualizar plano:", error);
          } else {
            console.log("Usuário atualizado para PRO com sucesso:", session.metadata.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        console.log("Assinatura cancelada:", subscription.id);
        
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        
        if (customer && !customer.deleted && customer.metadata?.supabase_user_id) {
          console.log("Fazendo downgrade para FREE:", customer.metadata.supabase_user_id);
          
          // Downgrade para FREE
          const { error } = await supabase
            .from('user_profiles')
            .update({ 
              plan_type: 'free',
              updated_at: new Date().toISOString()
            })
            .eq('user_id', customer.metadata.supabase_user_id);

          if (error) {
            console.error("Erro ao fazer downgrade:", error);
          } else {
            console.log("Usuário alterado para FREE:", customer.metadata.supabase_user_id);
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        console.log("Pagamento falhou:", invoice.id);
        
        if (invoice.customer) {
          const customer = await stripe.customers.retrieve(invoice.customer as string);
          
          if (customer && !customer.deleted && customer.metadata?.supabase_user_id) {
            console.log("Fazendo downgrade por falha no pagamento:", customer.metadata.supabase_user_id);
            
            // Downgrade para FREE por falha no pagamento
            const { error } = await supabase
              .from('user_profiles')
              .update({ 
                plan_type: 'free',
                updated_at: new Date().toISOString()
              })
              .eq('user_id', customer.metadata.supabase_user_id);

            if (error) {
              console.error("Erro ao fazer downgrade:", error);
            } else {
              console.log("Usuário alterado para FREE por falha no pagamento:", customer.metadata.supabase_user_id);
            }
          }
        }
        break;
      }

      default:
        console.log("Evento não tratado:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response(`Webhook error: ${error.message}`, { status: 400 });
  }
});
