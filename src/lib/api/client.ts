import type { ApiResponse } from '@/types';

// API Configuration
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';
export const LILY_MCP_URL = import.meta.env.VITE_LILY_MCP_URL || '/api/lily';

// Token storage keys
const ACCESS_TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';

// HTTP Client with authentication and automatic token refresh
export class ApiClient {
    private baseUrl: string;
    private token: string | null = null;
    private refreshToken: string | null = null;
    private refreshPromise: Promise<boolean> | null = null;
    private onAuthFailure: (() => void) | null = null;

    constructor(baseUrl: string) {
        this.baseUrl = baseUrl;
        this.token = localStorage.getItem(ACCESS_TOKEN_KEY);
        this.refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    }

    setTokens(accessToken: string | null, refreshToken?: string | null) {
        this.token = accessToken;
        if (accessToken) {
            localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
        } else {
            localStorage.removeItem(ACCESS_TOKEN_KEY);
        }

        if (refreshToken !== undefined) {
            this.refreshToken = refreshToken ?? null;
            if (refreshToken) {
                localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
            } else {
                localStorage.removeItem(REFRESH_TOKEN_KEY);
            }
        }
    }

    /** Legacy compat — alias for setTokens(token, undefined) */
    setToken(token: string | null) {
        this.setTokens(token);
    }

    getAccessToken(): string | null {
        return this.token;
    }

    /** Register a callback for when refresh fails (triggers logout) */
    onAuthError(cb: () => void) {
        this.onAuthFailure = cb;
    }

    // ── Token Refresh ────────────────────────────────────────────────────

    private async attemptRefresh(): Promise<boolean> {
        if (!this.refreshToken) return false;

        try {
            const resp = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refreshToken: this.refreshToken }),
            });

            if (!resp.ok) {
                this.setTokens(null, null);
                this.onAuthFailure?.();
                return false;
            }

            const data = await resp.json();
            this.setTokens(data.accessToken, data.refreshToken);
            return true;
        } catch {
            return false;
        }
    }

    /** Coalesces concurrent refresh attempts into one */
    private refresh(): Promise<boolean> {
        if (!this.refreshPromise) {
            this.refreshPromise = this.attemptRefresh().finally(() => {
                this.refreshPromise = null;
            });
        }
        return this.refreshPromise;
    }

    // ── Core Request ─────────────────────────────────────────────────────

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        _isRetry = false,
    ): Promise<ApiResponse<T>> {
        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...options.headers,
        };

        try {
            const response = await fetch(`${this.baseUrl}${endpoint}`, {
                ...options,
                headers,
            });

            // Auto-refresh on 401 (expired access token)
            if (response.status === 401 && !_isRetry && this.refreshToken) {
                const refreshed = await this.refresh();
                if (refreshed) {
                    return this.request<T>(endpoint, options, true);
                }
            }

            const data = await response.json();

            if (!response.ok) {
                return {
                    data: null as unknown as T,
                    success: false,
                    error: data.error || `HTTP ${response.status}`,
                };
            }

            return { data, success: true };
        } catch (error) {
            return {
                data: null as unknown as T,
                success: false,
                error: error instanceof Error ? error.message : 'Network error',
            };
        }
    }

    // ── Raw fetch (for SSE streaming) ────────────────────────────────────

    async fetchRaw(endpoint: string, options: RequestInit = {}): Promise<Response> {
        const headers: HeadersInit = {
            ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
            ...options.headers,
        };

        return fetch(`${this.baseUrl}${endpoint}`, { ...options, headers });
    }

    // ── HTTP Methods ─────────────────────────────────────────────────────

    get<T>(endpoint: string) {
        return this.request<T>(endpoint, { method: 'GET' });
    }

    post<T>(endpoint: string, body?: unknown) {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    put<T>(endpoint: string, body?: unknown) {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    patch<T>(endpoint: string, body?: unknown) {
        return this.request<T>(endpoint, {
            method: 'PATCH',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    delete<T>(endpoint: string, body?: unknown) {
        return this.request<T>(endpoint, {
            method: 'DELETE',
            body: body ? JSON.stringify(body) : undefined,
        });
    }
}

export const apiClient = new ApiClient(API_BASE_URL);
export const lilyClient = new ApiClient(LILY_MCP_URL);
