'use strict';

const crypto = require('crypto');
const session = require('express-session');
const { createClient } = require('@supabase/supabase-js');

const DAY_MS = 24 * 60 * 60 * 1000;

function createServerClient() {
    return createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_SERVICE_KEY,
        {
            auth: {
                autoRefreshToken: false,
                persistSession: false,
                detectSessionInUrl: false
            }
        }
    );
}

function sessionExpiry(sess) {
    const cookieExpiry = sess?.cookie?.expires ? new Date(sess.cookie.expires) : null;
    return cookieExpiry && Number.isFinite(cookieExpiry.getTime())
        ? cookieExpiry
        : new Date(Date.now() + DAY_MS);
}

class SupabaseSessionStore extends session.Store {
    constructor(client = createServerClient()) {
        super();
        this.client = client;
    }

    get(sid, callback) {
        this.client
            .from('app_sessions')
            .select('sess, expires_at')
            .eq('sid', sid)
            .maybeSingle()
            .then(({ data, error }) => {
                if (error) return callback(error);
                if (!data || new Date(data.expires_at) <= new Date()) {
                    if (data) this.destroy(sid, () => {});
                    return callback(null, null);
                }
                callback(null, data.sess);
            })
            .catch(callback);
    }

    set(sid, sess, callback = () => {}) {
        this.client
            .from('app_sessions')
            .upsert({
                sid,
                sess,
                expires_at: sessionExpiry(sess).toISOString(),
                updated_at: new Date().toISOString()
            }, { onConflict: 'sid' })
            .then(({ error }) => callback(error || null))
            .catch(callback);
    }

    touch(sid, sess, callback = () => {}) {
        this.client
            .from('app_sessions')
            .update({
                expires_at: sessionExpiry(sess).toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('sid', sid)
            .lt('updated_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
            .then(({ error }) => callback(error || null))
            .catch(callback);
    }

    destroy(sid, callback = () => {}) {
        this.client
            .from('app_sessions')
            .delete()
            .eq('sid', sid)
            .then(({ error }) => callback(error || null))
            .catch(callback);
    }
}

class SupabaseRateLimitStore {
    constructor(prefix, client = createServerClient()) {
        this.prefix = prefix;
        this.client = client;
        this.windowMs = 60_000;
        this.localKeys = false;
    }

    init(options) {
        this.windowMs = options.windowMs;
    }

    async increment(key) {
        const { data, error } = await this.client.rpc('increment_rate_limit', {
            p_key: `${this.prefix}:${key}`,
            p_window_ms: this.windowMs
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return {
            totalHits: Number(row.total_hits),
            resetTime: new Date(row.reset_at)
        };
    }

    async decrement(key) {
        const { error } = await this.client.rpc('decrement_rate_limit', { p_key: `${this.prefix}:${key}` });
        if (error) throw error;
    }

    async resetKey(key) {
        const { error } = await this.client
            .from('rate_limit_buckets')
            .delete()
            .eq('key', `${this.prefix}:${key}`);
        if (error) throw error;
    }
}

class SupabaseRuntimeState {
    constructor(client = createServerClient()) {
        this.client = client;
    }

    async issueWebSocketToken(user, ttlMs = 30_000) {
        const token = crypto.randomBytes(32).toString('base64url');
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const { error } = await this.client.from('ws_auth_tokens').insert({
            token_hash: tokenHash,
            user_id: user.id,
            username: user.username,
            is_admin: Boolean(user.isAdmin),
            expires_at: new Date(Date.now() + ttlMs).toISOString()
        });
        if (error) throw error;
        return token;
    }

    async consumeWebSocketToken(token) {
        if (typeof token !== 'string' || token.length < 32 || token.length > 128) return null;
        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const { data, error } = await this.client.rpc('consume_ws_auth_token', {
            p_token_hash: tokenHash
        });
        if (error) throw error;
        const row = Array.isArray(data) ? data[0] : data;
        return row || null;
    }
}

module.exports = {
    createServerClient,
    SupabaseSessionStore,
    SupabaseRateLimitStore,
    SupabaseRuntimeState
};
