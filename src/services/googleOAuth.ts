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
  private clientSecret: string;
  private redirectUri: string;
  private scope = 'https://www.googleapis.com/auth/calendar.readonly';

  constructor(credentials: OAuthCredentials) {
    this.clientId = credentials.clientId;
    this.clientSecret = credentials.clientSecret;
    // Use the current origin and add a specific path for OAuth callback
    this.redirectUri = `${window.location.origin}/`;
    
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
      prompt: 'consent'
    });

    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  }

  async exchangeCodeForTokens(code: string): Promise<GoogleTokens> {
    console.log('Exchanging code for tokens...', { code: code.substring(0, 10) + '...', redirectUri: this.redirectUri });
    
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: this.redirectUri,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OAuth token exchange failed:', response.status, errorText);
      throw new Error(`OAuth token exchange failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
  }

  async refreshAccessToken(refreshToken: string): Promise<GoogleTokens> {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: this.clientId,
        client_secret: this.clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    return await response.json();
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