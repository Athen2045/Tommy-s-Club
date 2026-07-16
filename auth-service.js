require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const authOptions = {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
};

const APP_URL = (process.env.APP_URL || 'http://localhost:8080').replace(/\/$/, '');

// Anon key for auth operations
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY,
    authOptions
);

// Service key to read profiles server-side
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY,
    authOptions
);

const DEFAULT_AVATARS = Object.freeze({
    m: '/assets/avatar-anon-m.svg',
    f: '/assets/avatar-anon-f.svg'
});

module.exports.DEFAULT_AVATARS = DEFAULT_AVATARS;

module.exports.initialize = () => Promise.resolve();

module.exports.registerUser = async function (userData) {
    const username = typeof userData.username === 'string' ? userData.username.trim().toLowerCase() : '';
    const email = typeof userData.email === 'string' ? userData.email.trim().toLowerCase() : '';
    const { password, password2, default_avatar } = userData;

    if (!username || !email || !password) throw new Error('All fields are required');
    if (!/^[A-Za-z0-9_]{3,32}$/.test(username)) throw new Error('Username must be 3–32 characters using letters, numbers, or underscores');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address');
    if (password !== password2) throw new Error('Passwords do not match');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(password)) {
        throw new Error('Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol');
    }

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
            data: { username },
            emailRedirectTo: `${APP_URL}/auth/confirm`
        }
    });

    if (error) {
        if (error.message.includes('already registered')) throw new Error('Email already in use');
        throw new Error(error.message);
    }

    // Only accept a server-known avatar path; never trust a client-supplied URL.
    const avatar_url = DEFAULT_AVATARS[default_avatar] || DEFAULT_AVATARS.m;
    if (data.user) {
        await supabaseAdmin.from('profiles').upsert({
            id: data.user.id,
            username,
            avatar_url
        });
    }

    return data;
};

module.exports.verifyEmailToken = async function (tokenHash) {
    if (typeof tokenHash !== 'string' || tokenHash.length < 20 || tokenHash.length > 512) {
        throw new Error('invalid verification link');
    }
    const client = createClient(
        process.env.SUPABASE_URL,
        process.env.SUPABASE_ANON_KEY,
        authOptions
    );
    const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
    if (error) throw new Error('invalid verification link');
};

module.exports.loginUser = async function (email, password) {
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
        if (/email not confirmed|email.*confirm/i.test(error.message || '')) {
            throw new Error('Please verify your email address before signing in');
        }
        throw new Error('Invalid email or password');
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('username, avatar_url, bio, status, terms_accepted')
        .eq('id', data.user.id)
        .single();

    return {
        id:             data.user.id,
        email:          data.user.email,
        username:       profile?.username       || email.split('@')[0],
        avatar_url:     profile?.avatar_url     || null,
        bio:            profile?.bio            || null,
        status:         profile?.status         || 'pending',
        terms_accepted: profile?.terms_accepted || false,
        email_verified: !!data.user.email_confirmed_at
    };
};

module.exports.verifyPassword = async function (email, password) {
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    if (!email || typeof password !== 'string' || !password) {
        throw new Error('Current password is required');
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Current password is incorrect');
};

module.exports.deleteUserAccount = async function (userId) {
    if (!userId) throw new Error('Missing user id');
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error('Unable to delete account');
};

async function authenticatedClient(email, password) {
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY, authOptions);
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw new Error('Current password is incorrect');
    return client;
}

module.exports.changeEmail = async function (email, password, newEmail) {
    email = typeof email === 'string' ? email.trim().toLowerCase() : '';
    newEmail = typeof newEmail === 'string' ? newEmail.trim().toLowerCase() : '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) throw new Error('Enter a valid new email address');
    if (newEmail === email) throw new Error('New email address must be different');
    const client = await authenticatedClient(email, password);
    const { error } = await client.auth.updateUser({ email: newEmail });
    if (error) throw new Error(error.message || 'Unable to change email address');
};

module.exports.changePassword = async function (email, password, newPassword) {
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/.test(newPassword || '')) {
        throw new Error('Password must be at least 8 characters and include uppercase, lowercase, a number, and a symbol');
    }
    const client = await authenticatedClient(email, password);
    const { error } = await client.auth.updateUser({ password: newPassword });
    if (error) throw new Error(error.message || 'Unable to change password');
};
