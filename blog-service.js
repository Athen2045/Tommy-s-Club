require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

function slugify(text) {
    return text.toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
}

// Fetch profiles for a list of posts/comments and attach them as .profiles
async function attachProfiles(rows) {
    if (!rows || rows.length === 0) return rows;
    const ids = [...new Set(rows.map(r => r.author_id).filter(Boolean))];
    if (ids.length === 0) return rows.map(r => ({ ...r, profiles: null }));
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', ids);
    const map = Object.fromEntries((profiles || []).map(p => [p.id, p]));
    return rows.map(r => ({ ...r, profiles: map[r.author_id] || null }));
}

module.exports.initialize = () => Promise.resolve();

// ── Posts ─────────────────────────────────────────────────

module.exports.getAllPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPublishedPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .eq('published', true)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPublishedPostsByCategory = async (categoryId) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .eq('published', true)
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPostsByCategory = async (categoryId) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPostsByMinDate = async (minDateStr) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .gte('created_at', new Date(minDateStr).toISOString())
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPostById = async (id) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .eq('id', id)
        .single();
    if (error) throw new Error('no results returned');
    const [post] = await attachProfiles([data]);
    return post;
};

module.exports.addPost = async (postData, authorId) => {
    const insert = {
        title: postData.title,
        slug: slugify(postData.title) + '-' + Date.now(),
        body: postData.body,
        excerpt: postData.body ? postData.body.replace(/<[^>]*>/g, '').slice(0, 200) : null,
        feature_image: postData.featureImage || null,
        published: postData.published === 'on' || postData.published === true,
        category_id: postData.category || null,
        author_id: authorId
    };
    const { error } = await supabase.from('posts').insert(insert);
    if (error) throw new Error('unable to create post');
};

module.exports.updatePost = async (id, postData) => {
    const update = {
        title: postData.title,
        body: postData.body,
        excerpt: postData.body ? postData.body.replace(/<[^>]*>/g, '').slice(0, 200) : null,
        feature_image: postData.featureImage || null,
        published: postData.published === 'on' || postData.published === true,
        category_id: postData.category || null,
        updated_at: new Date().toISOString()
    };
    const { error } = await supabase.from('posts').update(update).eq('id', id);
    if (error) throw new Error('unable to update post');
};

module.exports.getPostsByAuthor = async (authorId) => {
    const { data, error } = await supabase
        .from('posts')
        .select('*, categories(id, name, slug)')
        .eq('author_id', authorId)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.deletePostById = async (id) => {
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw new Error('unable to delete post');
};

// ── Categories ────────────────────────────────────────────

module.exports.getCategories = async () => {
    const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
    if (error) throw new Error('no results returned');
    return data;
};

module.exports.addCategory = async (categoryData) => {
    const name = categoryData.category || categoryData.name;
    const { error } = await supabase.from('categories').insert({
        name,
        slug: slugify(name)
    });
    if (error) throw new Error('unable to create category');
};

module.exports.deleteCategoryById = async (id) => {
    const { error } = await supabase.from('categories').delete().eq('id', id);
    if (error) throw new Error('unable to delete category');
};

// ── Comments ──────────────────────────────────────────────

module.exports.getCommentsByPost = async (postId) => {
    const { data, error } = await supabase
        .from('comments')
        .select('*')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    if (error) throw new Error('unable to load comments');
    return attachProfiles(data);
};

module.exports.addComment = async ({ post_id, author_id, parent_id, body }) => {
    const { error } = await supabase.from('comments').insert({
        post_id,
        author_id,
        parent_id: parent_id || null,
        body
    });
    if (error) throw new Error('unable to post comment');
};

module.exports.deleteCommentById = async (id) => {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw new Error('unable to delete comment');
};

// ── Profiles ──────────────────────────────────────────────

module.exports.getProfile = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
};

module.exports.updateProfile = async (userId, updates) => {
    const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);
    if (error) throw new Error('unable to update profile');
};

module.exports.getProfileStatus = async (userId) => {
    const { data, error } = await supabase
        .from('profiles')
        .select('status, terms_accepted')
        .eq('id', userId)
        .single();
    if (error) return null;
    return data;
};

module.exports.getPendingProfiles = async () => {
    const { data, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, created_at')
        .eq('status', 'pending')
        .order('created_at', { ascending: true });
    if (error) throw new Error('unable to fetch pending profiles');
    return data || [];
};

module.exports.updateProfileStatus = async (userId, status) => {
    const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', userId);
    if (error) throw new Error('unable to update profile status');
};

module.exports.acceptTerms = async (userId) => {
    const { error } = await supabase
        .from('profiles')
        .update({ terms_accepted: true })
        .eq('id', userId);
    if (error) throw new Error('unable to accept terms');
};

// ── Reactions ─────────────────────────────────────────────

const REACTION_KEYS   = ['fire', 'heart', 'eye', 'sparkle', 'black_heart'];
const REACTION_EMOJI  = { fire: '🔥', heart: '❤️', eye: '👁️', sparkle: '✨', black_heart: '🖤' };

module.exports.REACTION_EMOJI = REACTION_EMOJI;

module.exports.getReactionsByPost = async (postId, userId) => {
    const { data, error } = await supabase
        .from('reactions')
        .select('emoji, user_id')
        .eq('post_id', postId);
    if (error) return { counts: {}, userReactions: [] };

    const counts = Object.fromEntries(REACTION_KEYS.map(k => [k, 0]));
    const userReactions = [];
    for (const r of (data || [])) {
        if (counts[r.emoji] !== undefined) counts[r.emoji]++;
        if (userId && r.user_id === userId) userReactions.push(r.emoji);
    }
    return { counts, userReactions };
};

module.exports.toggleReaction = async (postId, userId, emojiKey) => {
    if (!REACTION_KEYS.includes(emojiKey)) throw new Error('invalid reaction');

    const { data: existing } = await supabase
        .from('reactions')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .eq('emoji', emojiKey)
        .single();

    if (existing) {
        await supabase.from('reactions').delete()
            .eq('post_id', postId).eq('user_id', userId).eq('emoji', emojiKey);
    } else {
        await supabase.from('reactions').insert({ post_id: postId, user_id: userId, emoji: emojiKey });
    }

    return module.exports.getReactionsByPost(postId, userId);
};

module.exports.getMemberByUsername = async (username) => {
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, username, avatar_url, bio, created_at')
        .eq('username', username)
        .single();
    if (error || !profile) throw new Error('member not found');

    const { data: posts } = await supabase
        .from('posts')
        .select('id, title, body, created_at')
        .eq('author_id', profile.id)
        .eq('published', true)
        .order('created_at', { ascending: false });

    return { ...profile, posts: posts || [] };
};
