
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (_request) => {
  const provider = Deno.env.get("TT_DATA_PROVIDER");
  const apiKey = Deno.env.get("TT_DATA_API_KEY");

  if (!provider || !apiKey) {
    return new Response(
      JSON.stringify({
        success: false,
        status: "provider_not_configured",
        message: "An authorised table tennis data provider has not been configured."
      }),
      {
        status: 503,
        headers: { "Content-Type": "application/json" }
      }
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      status: "adapter_required",
      provider,
      message: "The provider API adapter still needs to be implemented."
    }),
    {
      status: 501,
      headers: { "Content-Type": "application/json" }
    }
  );
});
