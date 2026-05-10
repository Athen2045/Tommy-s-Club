require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Anon key for auth operations
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_ANON_KEY
);

// Service key to read profiles server-side
const supabaseAdmin = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

module.exports.initialize = () => Promise.resolve();

module.exports.registerUser = async function (userData) {
    const { username, email, password, password2, avatar_url } = userData;

    if (!username || !email || !password) throw new Error('All fields are required');
    if (password !== password2) throw new Error('Passwords do not match');
    if (password.length < 6) throw new Error('Password must be at least 6 characters');

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
    });

    if (error) {
        if (error.message.includes('already registered')) throw new Error('Email already in use');
        throw new Error(error.message);
    }

    // Set the chosen default avatar (the trigger may not pick it up, so we upsert here)
    if (data.user && avatar_url) {
        await supabaseAdmin.from('profiles').upsert({
            id: data.user.id,
            username,
            avatar_url
        });
    }

    return data;
};

module.exports.loginUser = async function (email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) throw new Error('Invalid email or password');

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
        terms_accepted: profile?.terms_accepted || false
    };
};
