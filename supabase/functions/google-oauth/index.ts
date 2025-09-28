import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-redirect-uri',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      status: 200, 
      headers: corsHeaders 
    });
  }

  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const { action, code, refresh_token } = await req.json();
    
    console.log(`Google OAuth ${action} request initiated`);
    
    // Get OAuth credentials from Supabase secrets
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');
    
    if (!clientId || !clientSecret) {
      console.error('Missing Google OAuth credentials in secrets');
      return new Response(
        JSON.stringify({ 
          error: 'Google OAuth credentials not configured. Please add GOOGLE_OAUTH_CLIENT_ID and GOOGLE_OAUTH_CLIENT_SECRET to your Supabase secrets.' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const redirectUri = req.headers.get('x-redirect-uri') || 'https://7512f92b-0bee-4020-a9bd-994e850579bb.lovableproject.com/google-oauth/callback';
    
    if (action === 'exchange_code') {
      if (!code) {
        return new Response(
          JSON.stringify({ error: 'Authorization code is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Exchanging authorization code for tokens...', { 
        code: code.substring(0, 10) + '...', 
        redirectUri 
      });
      
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('OAuth token exchange failed:', tokenResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: `OAuth token exchange failed: ${tokenResponse.status} - ${errorText}` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const tokens = await tokenResponse.json();
      console.log('Token exchange successful');
      return new Response(
        JSON.stringify(tokens),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    if (action === 'refresh_token') {
      if (!refresh_token) {
        return new Response(
          JSON.stringify({ error: 'Refresh token is required' }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      console.log('Refreshing access token...');
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token,
          grant_type: 'refresh_token',
        }),
      });

      if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        console.error('Token refresh failed:', refreshResponse.status, errorText);
        return new Response(
          JSON.stringify({ 
            error: `Token refresh failed: ${refreshResponse.status} - ${errorText}` 
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          }
        );
      }

      const tokens = await refreshResponse.json();
      console.log('Token refresh successful');
      return new Response(
        JSON.stringify(tokens),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid action. Use "exchange_code" or "refresh_token"' }),
      { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Google OAuth function error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error during OAuth processing' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});