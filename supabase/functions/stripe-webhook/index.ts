
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
  const signature = req.headers.get("stripe-signature");
  const body = await req.text();
  
  if (!signature) {
    return new Response("No signature", { status: 400 });
  }

  try {
    const event = stripe.webhooks.constructEvent(
      body,
      signature,
      Deno.env.get("STRIPE_WEBHOOK_SECRET") || ""
    );

    console.log("Evento recebido:", event.type);

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        if (session.mode === "subscription" && session.metadata?.user_id) {
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
            console.log("Usuário atualizado para PRO:", session.metadata.user_id);
          }
        }
        break;
      }

      case "customer.subscription.deleted":
      case "invoice.payment_failed": {
        const subscription = event.data.object as Stripe.Subscription;
        const customer = await stripe.customers.retrieve(subscription.customer as string);
        
        if (customer && !customer.deleted && customer.metadata?.supabase_user_id) {
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

      default:
        console.log("Evento não tratado:", event.type);
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response("Webhook error", { status: 400 });
  }
});
