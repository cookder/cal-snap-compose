import { supabase } from '@/integrations/supabase/client';

export interface OAuthCredentials {
  clientId: string;
  clientSecret: string;
}

export interface GoogleTokens {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  token_type: string;
  expires_at?: number; // Added for stored tokens
}

class GoogleOAuthService {
  private clientId: string;
  private redirectUri: string;
  private scope = 'https://www.googleapis.com/auth/calendar.readonly';

  constructor(credentials: OAuthCredentials) {
    this.clientId = credentials.clientId;
    // Dedicated callback route for reliability
    this.redirectUri = `${window.location.origin}/google-oauth/callback`;

    // Log the redirect URI for debugging
    console.log('OAuth Redirect URI:', this.redirectUri);
  }

  getAuthUrl(): string {
    const params = new URLSearchParams({
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      scope: this.scope,
      response_type: 'code',
      access_type: 'offline',
      prompt: 'consent',
      // Add mobile-specific parameters
      include_granted_scopes: 'true',
      state: Math.random().toString(36).substring(2, 15) // Add state for security
    });

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    console.log('Generated Google OAuth URL:', authUrl);
    console.log('Using redirect URI:', this.redirectUri);
    console.log('Is mobile device:', /Mobi|Android/i.test(navigator.userAgent));
    
    return authUrl;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    console.log('Exchanging authorization code via edge function...', { 
      code: code.substring(0, 10) + '...', 
      redirectUri: this.redirectUri 
    });
    
    const { data, error } = await supabase.functions.invoke('google-oauth', {
      body: { 
        action: 'exchange_code', 
        code 
      },
      headers: {
        'x-redirect-uri': this.redirectUri
      }
    });

    if (error) {
      console.error('Edge function error during token exchange:', error);
      throw new Error(`OAuth token exchange failed: ${error.message || 'Unknown error'}`);
    }

    if (data.error) {
      console.error('Google OAuth API error:', data.error);
      throw new Error(data.error);
    }

    console.log('Token exchange successful via edge function');
    return data;
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    console.log('Refreshing access token via edge function...');
    
    const { data, error } = await supabase.functions.invoke('google-oauth', {
      body: { 
        action: 'refresh_token', 
        refresh_token: refreshToken 
      }
    });

    if (error) {
      console.error('Edge function error during token refresh:', error);
      throw new Error(`Token refresh failed: ${error.message || 'Unknown error'}`);
    }

    if (data.error) {
      console.error('Google OAuth API error during refresh:', data.error);
      throw new Error(data.error);
    }

    console.log('Token refresh successful via edge function');
    return data;
  }

  saveTokens(tokens: GoogleTokens): void {
    localStorage.setItem('google_tokens', JSON.stringify({
      ...tokens,
      expires_at: Date.now() + (tokens.expires_in * 1000)
    }));
  }

  getStoredTokens(): GoogleTokens | null {
    const stored = localStorage.getItem('google_tokens');
    if (!stored) return null;

    const tokens = JSON.parse(stored);
    
    // Check if token is expired
    if (Date.now() >= tokens.expires_at) {
      this.clearTokens();
      return null;
    }

    return tokens;
  }

  clearTokens(): void {
    localStorage.removeItem('google_tokens');
  }

  async getValidAccessToken(): Promise<string | null> {
    const tokens = this.getStoredTokens();
    if (!tokens) return null;

    // If token is close to expiring (within 5 minutes), refresh it
    const fiveMinutes = 5 * 60 * 1000;
    if (tokens.expires_at && (tokens.expires_at - Date.now()) < fiveMinutes && tokens.refresh_token) {
      try {
        const newTokens = await this.refreshAccessToken(tokens.refresh_token);
        this.saveTokens({
          ...newTokens,
          refresh_token: tokens.refresh_token // Keep the refresh token
        });
        return newTokens.access_token;
      } catch (error) {
        console.error('Token refresh failed:', error);
        this.clearTokens();
        return null;
      }
    }

    return tokens.access_token;
  }
}

export default GoogleOAuthService;