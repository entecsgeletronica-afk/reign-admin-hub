import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get the caller's token to verify they are an admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing Authorization header");
    }

    const {
      data: { user: caller },
      error: callerError,
    } = await supabaseClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (callerError || !caller) {
      throw new Error("Invalid token");
    }

    // Only super_admins may create users / grant admin roles through this
    // service-role edge function. Regular admins must not be able to escalate
    // privileges via this endpoint.
    const { data: roleData, error: roleError } = await supabaseClient
      .from("user_roles")
      .select("role")
      .eq("user_id", caller.id)
      .eq("role", "super_admin")
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Unauthorized: super_admin role required" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const { action, email, password, displayName, isAdmin } = await req.json();

    if (action === "create-user") {
      const { data, error } = await supabaseClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          display_name: displayName,
          full_name: displayName, // Syncing both for compatibility
        },
      });

      if (error) throw error;

      if (isAdmin && data.user) {
        const { error: roleInsertError } = await supabaseClient
          .from("user_roles")
          .insert({ user_id: data.user.id, role: "admin" });
        
        if (roleInsertError) {
          console.error("Error granting admin role:", roleInsertError);
        }
      }

      return new Response(JSON.stringify({ user: data.user }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
