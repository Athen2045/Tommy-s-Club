require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);
const ADMIN_USER_ID = (process.env.ADMIN_USER_ID || '').trim();
const POST_SELECT = 'id, title, slug, body, excerpt, feature_image, published, author_id, category_id, created_at, updated_at, pinned_at, categories(id, name, slug), comments(count), post_images(image_url, position, width, height, alt_text)';

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
        .select('id, username, avatar_url, status')
        .in('id', ids);
    const map = Object.fromEntries((profiles || []).map(p => [
        p.id,
        { ...p, isAdmin: Boolean(ADMIN_USER_ID && p.id === ADMIN_USER_ID) }
    ]));
    return rows.map(r => ({ ...r, profiles: map[r.author_id] || null }));
}

function normalizeCommentCounts(rows) {
    return (rows || []).map(row => ({
        ...row,
        isPinned: Boolean(row.pinned_at),
        comment_count: Array.isArray(row.comments) && row.comments[0]
            ? Number(row.comments[0].count || 0)
            : 0,
        comments: undefined,
        post_images: normalizePostImages(row)
    }));
}

function normalizePostImages(row) {
    const images = Array.isArray(row?.post_images)
        ? row.post_images.slice().sort((a, b) => Number(a.position) - Number(b.position))
        : [];
    if (images.length === 0 && row?.feature_image) {
        images.push({
            id: null,
            image_url: row.feature_image,
            image_file_id: row.feature_image_file_id || null,
            position: 0,
            width: null,
            height: null,
            alt_text: row.title || ''
        });
    }
    return images;
}

function withNormalizedImages(row) {
    return row ? {
        ...row,
        isPinned: Boolean(row.pinned_at),
        post_images: normalizePostImages(row)
    } : row;
}

module.exports.initialize = () => Promise.resolve();

// ── Posts ─────────────────────────────────────────────────

module.exports.getAllPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(normalizeCommentCounts(data));
};

module.exports.getPublishedPosts = async () => {
    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('published', true)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(normalizeCommentCounts(data));
};

module.exports.getPublishedPostsByCategory = async (categoryId) => {
    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('published', true)
        .eq('category_id', categoryId)
        .order('pinned_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(normalizeCommentCounts(data));
};

module.exports.getPublishedPostsForUser = async (userId) => {
    const { data: follows, error: followError } = await supabase
        .from('category_follows')
        .select('category_id')
        .eq('user_id', userId);
    if (followError) throw new Error('unable to load followed channels');
    const categoryIds = (follows || []).map(follow => follow.category_id);
    if (categoryIds.length === 0) return [];

    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('published', true)
        .in('category_id', categoryIds)
        .order('created_at', { ascending: false })
        .limit(60);
    if (error) throw new Error('no results returned');
    return attachProfiles(normalizeCommentCounts(data));
};

module.exports.getPostsByCategory = async (categoryId) => {
    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('category_id', categoryId)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPostsByMinDate = async (minDateStr) => {
    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .gte('created_at', new Date(minDateStr).toISOString())
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.getPostById = async (id) => {
    const { data, error } = await supabase
        .from('posts')
        .select(POST_SELECT)
        .eq('id', id)
        .single();
    if (error) throw new Error('no results returned');
    const [post] = await attachProfiles([data]);
    return withNormalizedImages(post);
};

module.exports.addPost = async (postData, authorId) => {
    const images = Array.isArray(postData.images) ? postData.images.slice(0, 4) : [];
    const leadImage = images[0] || null;
    const insert = {
        title: postData.title,
        slug: slugify(postData.title) + '-' + Date.now(),
        body: postData.body,
        excerpt: postData.body ? postData.body.replace(/<[^>]*>/g, '').slice(0, 200) : null,
        feature_image: leadImage?.url || postData.featureImage || null,
        feature_image_file_id: leadImage?.fileId || postData.featureImageFileId || null,
        published: postData.published === true,
        category_id: postData.category || null,
        author_id: authorId
    };
    const { data: post, error } = await supabase.from('posts').insert(insert).select('id').single();
    if (error || !post) throw new Error('unable to create post');

    if (images.length) {
        const rows = images.map((image, position) => ({
            post_id: post.id,
            image_url: image.url,
            image_file_id: image.fileId,
            position,
            width: image.width,
            height: image.height,
            alt_text: image.altText || null
        }));
        const { error: mediaError } = await supabase.from('post_images').insert(rows);
        if (mediaError) {
            await supabase.from('posts').delete().eq('id', post.id);
            throw new Error('unable to attach post images');
        }
    }
    return post;
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
        .select(POST_SELECT)
        .eq('author_id', authorId)
        .order('created_at', { ascending: false });
    if (error) throw new Error('no results returned');
    return attachProfiles(data);
};

module.exports.deletePostById = async (id) => {
    const { data: post } = await supabase
        .from('posts')
        .select('feature_image_file_id, post_images(image_file_id), comments(image_file_id)')
        .eq('id', id)
        .maybeSingle();
    const { error } = await supabase.from('posts').delete().eq('id', id);
    if (error) throw new Error('unable to delete post');
    return post ? {
        ...post,
        mediaFileIds: [
            post.feature_image_file_id,
            ...(post.post_images || []).map(image => image.image_file_id),
            ...(post.comments || []).map(comment => comment.image_file_id)
        ].filter(Boolean)
    } : null;
};

// ── Categories ────────────────────────────────────────────

module.exports.getCategories = async (userId) => {
    const [{ data: categories, error }, { data: publishedPosts, error: postsError }, followsResult] = await Promise.all([
        supabase
        .from('categories')
        .select('*')
        .order('name'),
        supabase
            .from('posts')
            .select('category_id')
            .eq('published', true),
        userId
            ? supabase.from('category_follows').select('category_id').eq('user_id', userId)
            : Promise.resolve({ data: [], error: null })
    ]);
    if (error || postsError || followsResult.error) throw new Error('no results returned');

    const counts = (publishedPosts || []).reduce((result, post) => {
        if (post.category_id !== null) result[post.category_id] = (result[post.category_id] || 0) + 1;
        return result;
    }, {});
    const followed = new Set((followsResult.data || []).map(row => Number(row.category_id)));
    return (categories || []).map(category => ({
        ...category,
        postCount: counts[category.id] || 0,
        isFollowing: followed.has(Number(category.id))
    }));
};

module.exports.getFollowedCategories = async (userId) => {
    const { data: follows, error } = await supabase
        .from('category_follows')
        .select('category_id, categories(id, name, slug)')
        .eq('user_id', userId);
    if (error) throw new Error('unable to load followed channels');
    const categoryIds = (follows || []).map(row => row.category_id);
    if (!categoryIds.length) return [];
    const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('category_id')
        .eq('published', true)
        .in('category_id', categoryIds);
    if (postsError) throw new Error('unable to count followed channels');
    const counts = (posts || []).reduce((result, post) => {
        result[post.category_id] = (result[post.category_id] || 0) + 1;
        return result;
    }, {});
    return (follows || [])
        .map(row => row.categories && ({ ...row.categories, isFollowing: true, postCount: counts[row.category_id] || 0 }))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name));
};

module.exports.followCategory = async (userId, categoryId) => {
    const { data: category } = await supabase
        .from('categories')
        .select('id')
        .eq('id', categoryId)
        .maybeSingle();
    if (!category) throw new Error('channel not found');
    const { error } = await supabase
        .from('category_follows')
        .upsert(
            { user_id: userId, category_id: categoryId },
            { onConflict: 'user_id,category_id', ignoreDuplicates: true }
        );
    if (error) throw new Error('unable to join channel');
};

module.exports.unfollowCategory = async (userId, categoryId) => {
    const { error } = await supabase
        .from('category_follows')
        .delete()
        .eq('user_id', userId)
        .eq('category_id', categoryId);
    if (error) throw new Error('unable to leave channel');
};

module.exports.pinPost = async (categoryId, postId, adminId) => {
    const { data: post } = await supabase
        .from('posts')
        .select('id, category_id, published')
        .eq('id', postId)
        .maybeSingle();
    if (!post || Number(post.category_id) !== Number(categoryId) || !post.published) {
        throw new Error('Only a published post in this channel can be pinned');
    }
    await supabase
        .from('posts')
        .update({ pinned_at: null, pinned_by: null })
        .eq('category_id', categoryId)
        .not('pinned_at', 'is', null);
    const { error } = await supabase
        .from('posts')
        .update({ pinned_at: new Date().toISOString(), pinned_by: adminId })
        .eq('id', postId)
        .eq('category_id', categoryId)
        .eq('published', true);
    if (error) throw new Error('unable to pin post');
};

module.exports.unpinCategory = async (categoryId) => {
    const { error } = await supabase
        .from('posts')
        .update({ pinned_at: null, pinned_by: null })
        .eq('category_id', categoryId)
        .not('pinned_at', 'is', null);
    if (error) throw new Error('unable to unpin post');
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
        .select('id, post_id, author_id, parent_id, body, image_url, image_width, image_height, created_at')
        .eq('post_id', postId)
        .order('created_at', { ascending: true });
    if (error) throw new Error('unable to load comments');
    return attachProfiles(data);
};

module.exports.addComment = async ({ post_id, author_id, parent_id, body, image }) => {
    if (!Number.isInteger(post_id) || post_id < 1) throw new Error('invalid post');
    if (parent_id !== null && (!Number.isInteger(parent_id) || parent_id < 1)) throw new Error('invalid parent comment');
    const text = typeof body === 'string' ? body.trim() : '';
    if ((!text && !image?.url) || text.length > 2000) throw new Error('Add a comment or an image');
    if (parent_id !== null) {
        const { data: parent } = await supabase
            .from('comments')
            .select('id')
            .eq('id', parent_id)
            .eq('post_id', post_id)
            .maybeSingle();
        if (!parent) throw new Error('invalid parent comment');
    }
    const { error } = await supabase.from('comments').insert({
        post_id,
        author_id,
        parent_id: parent_id || null,
        body: text || null,
        image_url: image?.url || null,
        image_file_id: image?.fileId || null,
        image_width: image?.width || null,
        image_height: image?.height || null
    });
    if (error) throw new Error('unable to post comment');
};

module.exports.deleteCommentById = async (id) => {
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw new Error('unable to delete comment');
};

module.exports.deleteCommentIfAuthorized = async (id, requesterId, isAdmin) => {
    const { data: comment } = await supabase
        .from('comments').select('author_id, image_file_id').eq('id', id).single();
    if (!comment) throw new Error('comment not found');
    if (!isAdmin && comment.author_id !== requesterId) throw new Error('not authorised');
    const { error } = await supabase.from('comments').delete().eq('id', id);
    if (error) throw new Error('unable to delete comment');
    return comment;
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

module.exports.getProfileMediaFileId = async (userId) => {
    const { data } = await supabase
        .from('profiles')
        .select('avatar_file_id')
        .eq('id', userId)
        .maybeSingle();
    return data?.avatar_file_id || null;
};

module.exports.isMediaFileAttached = async (fileId) => {
    if (!fileId) return false;
    const results = await Promise.all([
        supabase.from('post_images').select('post_id').eq('image_file_id', fileId).limit(1),
        supabase.from('posts').select('id').eq('feature_image_file_id', fileId).limit(1),
        supabase.from('comments').select('id').eq('image_file_id', fileId).limit(1),
        supabase.from('messages').select('id').eq('image_file_id', fileId).limit(1),
        supabase.from('profiles').select('id').eq('avatar_file_id', fileId).limit(1)
    ]);
    return results.some(result => !result.error && Array.isArray(result.data) && result.data.length > 0);
};

module.exports.prepareAccountDeletion = async (userId) => {
    const [profileResult, postsResult, commentsResult, messagesResult] = await Promise.all([
        supabase.from('profiles').select('avatar_file_id').eq('id', userId).maybeSingle(),
        supabase
            .from('posts')
            .select('feature_image_file_id, post_images(image_file_id), comments(image_file_id)')
            .eq('author_id', userId),
        supabase.from('comments').select('image_file_id').eq('author_id', userId),
        supabase.from('messages').select('image_file_id').eq('author_id', userId)
    ]);
    const mediaFileIds = new Set();
    if (profileResult.data?.avatar_file_id) mediaFileIds.add(profileResult.data.avatar_file_id);
    for (const post of postsResult.data || []) {
        if (post.feature_image_file_id) mediaFileIds.add(post.feature_image_file_id);
        for (const image of post.post_images || []) if (image.image_file_id) mediaFileIds.add(image.image_file_id);
        for (const comment of post.comments || []) if (comment.image_file_id) mediaFileIds.add(comment.image_file_id);
    }
    for (const comment of commentsResult.data || []) if (comment.image_file_id) mediaFileIds.add(comment.image_file_id);
    for (const message of messagesResult.data || []) if (message.image_file_id) mediaFileIds.add(message.image_file_id);

    const { error: pinError } = await supabase
        .from('posts')
        .update({ pinned_at: null, pinned_by: null })
        .eq('pinned_by', userId);
    if (pinError) throw new Error('unable to prepare account deletion');
    return Array.from(mediaFileIds);
};

module.exports.updateProfile = async (userId, updates) => {
    const { error } = await supabase
        .from('profiles')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', userId);
    if (error?.code === '23505') throw new Error('Username already exists — choose a different one');
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

    return {
        ...profile,
        isAdmin: Boolean(ADMIN_USER_ID && profile.id === ADMIN_USER_ID),
        posts: posts || []
    };
};

module.exports.searchDirectory = async (rawQuery) => {
    const query = String(rawQuery || '').trim().slice(0, 64);
    if (query.length < 2) return { members: [], categories: [] };
    const safeQuery = query.replace(/[^a-zA-Z0-9 _-]/g, '').trim();
    if (safeQuery.length < 2) return { members: [], categories: [] };
    const pattern = `%${safeQuery}%`;
    const [membersResult, categoryNamesResult, categorySlugsResult] = await Promise.all([
        supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .neq('status', 'rejected')
            .ilike('username', pattern)
            .order('username')
            .limit(8),
        supabase
            .from('categories')
            .select('id, name, slug')
            .ilike('name', pattern)
            .order('name')
            .limit(8),
        supabase
            .from('categories')
            .select('id, name, slug')
            .ilike('slug', pattern)
            .order('name')
            .limit(8)
    ]);
    if (membersResult.error || categoryNamesResult.error || categorySlugsResult.error) {
        throw new Error('search unavailable');
    }
    const categoryMap = new Map();
    for (const category of [...(categoryNamesResult.data || []), ...(categorySlugsResult.data || [])]) {
        categoryMap.set(category.id, category);
    }
    return {
        members: (membersResult.data || []).map(member => ({
            ...member,
            isAdmin: Boolean(ADMIN_USER_ID && member.id === ADMIN_USER_ID)
        })),
        categories: Array.from(categoryMap.values()).slice(0, 8)
    };
};

// ── Chat ──────────────────────────────────────────────────

module.exports.getMessageHistory = async (limit) => {
    limit = limit || 100;
    const { data, error } = await supabase
        .from('messages')
        .select('id, body, image_url, author_id, created_at')
        .order('created_at', { ascending: false })
        .limit(limit);
    if (error) return [];
    return attachProfiles((data || []).reverse());
};

module.exports.getMessagesAfter = async (afterId, limit) => {
    const { data, error } = await supabase
        .from('messages')
        .select('id, body, image_url, author_id, created_at')
        .gt('id', afterId)
        .order('id', { ascending: true })
        .limit(Math.min(Number(limit) || 100, 100));
    if (error) throw new Error('unable to load messages');
    return attachProfiles(data || []);
};

module.exports.insertMessage = async (authorId, body, media) => {
    const text = typeof body === 'string' ? body.trim() : '';
    const imageUrl = media?.imageUrl || null;
    if (!text && !imageUrl) throw new Error('Add a message or an image');
    if (text.length > 2000) throw new Error('message too long');
    const { data, error } = await supabase
        .from('messages')
        .insert({
            author_id: authorId,
            body: text || null,
            image_url: imageUrl,
            image_file_id: media?.imageFileId || null
        })
        .select('id, created_at')
        .single();
    if (error) throw new Error('unable to send message');
    return data;
};

module.exports.deleteMessage = async (messageId, requesterId, isAdmin) => {
    const { data: msg } = await supabase
        .from('messages').select('author_id, image_file_id').eq('id', messageId).single();
    if (!msg) throw new Error('message not found');
    if (!isAdmin && msg.author_id !== requesterId) throw new Error('not authorised');
    const { error } = await supabase.from('messages').delete().eq('id', messageId);
    if (error) throw new Error('unable to delete message');
    return msg;
};

module.exports.getLatestMessageId = async () => {
    const { data } = await supabase
        .from('messages').select('id').order('id', { ascending: false }).limit(1).single();
    return data ? data.id : 0;
};

module.exports.getAllMemberUsernames = async () => {
    const { data } = await supabase
        .from('profiles')
        .select('id, username')
        .neq('status', 'rejected')
        .order('username');
    return (data || []).map(function (profile) {
        return {
            username: profile.username,
            isAdmin: Boolean(ADMIN_USER_ID && profile.id === ADMIN_USER_ID)
        };
    });
};
