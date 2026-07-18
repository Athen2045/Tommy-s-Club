(function () {
    'use strict';

    var configEl = document.getElementById('chatConfig');
    var container = document.getElementById('chatMessages');
    if (!configEl || !container) return;

    var config = JSON.parse(configEl.textContent || '{}');
    var memberRecords = Array.isArray(config.members) ? config.members.map(function (member) {
        return typeof member === 'string' ? { username: member, isAdmin: false } : member;
    }) : [];
    var members = memberRecords.map(function (member) { return member.username; });
    var currentUserId = config.currentUserId || '';
    var isAdmin = Boolean(config.isAdmin);
    var imagekitEndpoint = config.imagekitEndpoint || '';
    var inputEl = document.getElementById('chatInput');
    var sendBtn = document.getElementById('chatSendBtn');
    var dropdown = document.getElementById('mentionDropdown');
    var feedback = document.getElementById('chatFeedback');
    var imageInput = document.getElementById('chatImageInput');
    var imagePreview = document.getElementById('chatImagePreview');
    var imagePreviewImg = document.getElementById('chatImagePreviewImg');
    var imageName = document.getElementById('chatImageName');
    var imageRemove = document.getElementById('chatImageRemove');
    var selectedImage = null;
    var previewUrl = '';
    var mentionStart = -1;
    var reconnectFailures = 0;
    var pollingTimer = null;
    var lastMessageId = 0;
    var allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif'];

    function formatTime(ts) {
        if (!ts) return '';
        var date = new Date(ts);
        var sameDay = date.toDateString() === new Date().toDateString();
        if (sameDay) return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' ' +
            date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    }

    function scrollToBottom() {
        container.scrollTop = container.scrollHeight;
    }

    function autoResize() {
        inputEl.style.height = 'auto';
        inputEl.style.height = Math.min(inputEl.scrollHeight, 112) + 'px';
    }

    function renderBodyInto(element, rawText) {
        element.textContent = '';
        String(rawText || '').split(/(@\w+)/g).forEach(function (part) {
            var match = part.match(/^@(\w+)$/);
            var found = match && members.find(function (member) {
                return member.toLowerCase() === match[1].toLowerCase();
            });
            if (found) {
                var link = document.createElement('a');
                link.href = '/member/' + encodeURIComponent(found);
                link.className = 'chat-mention';
                link.textContent = '@' + found;
                element.appendChild(link);
            } else {
                element.appendChild(document.createTextNode(part));
            }
        });
    }

    function imageDeliveryUrl(url, preset) {
        if (!url || !imagekitEndpoint || !url.startsWith(imagekitEndpoint)) return url;
        var transform = preset === 'chat'
            ? 'w-320,h-320,c-at_max,q-78,f-auto'
            : 'w-1600,h-1600,c-at_max,q-82,f-auto';
        return url + (url.includes('?') ? '&' : '?') + 'tr=' + transform;
    }

    function buildMessage(msg) {
        var outer = document.createElement('article');
        outer.className = 'chat-msg';
        outer.dataset.id = msg.id;
        outer.dataset.author = msg.author_id;

        var avatar = document.createElement('div');
        avatar.className = 'chat-msg-avatar';
        if (msg.avatar_url) {
            var avatarImg = document.createElement('img');
            avatarImg.src = msg.avatar_url;
            avatarImg.alt = '';
            avatarImg.className = 'chat-avatar-img';
            avatarImg.loading = 'lazy';
            avatar.appendChild(avatarImg);
        } else {
            var initials = document.createElement('span');
            initials.className = 'chat-avatar-initials';
            initials.textContent = (msg.username || '?').charAt(0).toUpperCase();
            avatar.appendChild(initials);
        }
        outer.appendChild(avatar);

        var content = document.createElement('div');
        content.className = 'chat-msg-content';
        var meta = document.createElement('div');
        meta.className = 'chat-msg-meta';
        var author = document.createElement('a');
        author.className = 'chat-msg-author';
        author.href = '/member/' + encodeURIComponent(msg.username || '');
        author.textContent = msg.username || 'unknown';
        meta.appendChild(author);
        if (msg.is_admin) {
            var adminBadge = document.createElement('img');
            adminBadge.className = 'admin-verified-badge';
            adminBadge.src = '/assets/admin-verified.jpeg';
            adminBadge.alt = '';
            adminBadge.setAttribute('aria-hidden', 'true');
            meta.appendChild(adminBadge);
            var adminText = document.createElement('span');
            adminText.className = 'sr-only';
            adminText.textContent = 'Administrator';
            meta.appendChild(adminText);
        }
        var time = document.createElement('time');
        time.className = 'chat-msg-time';
        time.textContent = formatTime(msg.created_at);
        meta.appendChild(time);
        content.appendChild(meta);

        if (msg.body) {
            var body = document.createElement('div');
            body.className = 'chat-msg-body';
            renderBodyInto(body, msg.body);
            content.appendChild(body);
        }
        if (msg.image_url) {
            var imageLink = document.createElement('a');
            imageLink.className = 'chat-msg-image-link';
            imageLink.href = msg.image_full_url || imageDeliveryUrl(msg.image_url, 'post');
            imageLink.target = '_blank';
            imageLink.rel = 'noopener noreferrer';
            imageLink.setAttribute('aria-label', 'Open image from ' + (msg.username || 'member'));
            var messageImage = document.createElement('img');
            messageImage.className = 'chat-msg-image';
            messageImage.src = msg.image_thumb_url || imageDeliveryUrl(msg.image_url, 'chat');
            messageImage.alt = 'Image shared by ' + (msg.username || 'member');
            messageImage.loading = 'lazy';
            messageImage.width = 320;
            messageImage.height = 320;
            imageLink.appendChild(messageImage);
            content.appendChild(imageLink);
        }
        outer.appendChild(content);

        if (msg.author_id === currentUserId || isAdmin) {
            var deleteButton = document.createElement('button');
            deleteButton.className = 'chat-delete-btn';
            deleteButton.type = 'button';
            deleteButton.dataset.msgid = msg.id;
            deleteButton.title = 'Delete message';
            deleteButton.setAttribute('aria-label', 'Delete message');
            deleteButton.innerHTML = '<i class="bi bi-trash" aria-hidden="true"></i>';
            outer.appendChild(deleteButton);
        }
        return outer;
    }

    function appendMessage(message) {
        if (!message || !message.id || container.querySelector('.chat-msg[data-id="' + String(message.id) + '"]')) return;
        container.appendChild(buildMessage(message));
        lastMessageId = Math.max(lastMessageId, Number(message.id) || 0);
        localStorage.setItem('tommys_club_last_msg', String(lastMessageId));
        scrollToBottom();
    }

    function clearSelectedImage() {
        selectedImage = null;
        imageInput.value = '';
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = '';
        imagePreview.hidden = true;
        imagePreviewImg.removeAttribute('src');
        imageName.textContent = '';
    }

    function selectImage(file) {
        feedback.textContent = '';
        if (!file) return clearSelectedImage();
        if (!allowedTypes.includes(file.type)) {
            feedback.textContent = 'Choose a JPEG, PNG, GIF, WebP, or AVIF image.';
            return clearSelectedImage();
        }
        if (file.size > 8 * 1024 * 1024) {
            feedback.textContent = 'Image must be 8 MB or smaller.';
            return clearSelectedImage();
        }
        selectedImage = file;
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = URL.createObjectURL(file);
        imagePreviewImg.src = previewUrl;
        imageName.textContent = file.name;
        imagePreview.hidden = false;
    }

    function closeMentions() {
        dropdown.style.display = 'none';
        dropdown.textContent = '';
        mentionStart = -1;
    }

    function responseJson(response) {
        return response.json().catch(function () { return {}; }).then(function (data) {
            if (!response.ok) throw new Error(data.error || 'Message could not be sent');
            return data;
        });
    }

    function sendMessage() {
        var body = inputEl.value.trim();
        if ((!body && !selectedImage) || sendBtn.disabled) return;
        feedback.textContent = '';
        sendBtn.disabled = true;
        sendBtn.setAttribute('aria-busy', 'true');
        sendBtn.textContent = 'Sending…';

        var mediaPromise = selectedImage
            ? window.TommyMedia.upload(selectedImage, 'chat', function (percent) {
                feedback.textContent = 'Uploading image… ' + percent + '%';
            })
            : Promise.resolve(null);

        mediaPromise.then(function (media) {
            feedback.textContent = media ? 'Sending image…' : '';
            return fetch('/chat/send', {
                method: 'POST',
                headers: {
                    'X-CSRF-Token': window.CSRF_TOKEN,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    body: body,
                    image_url: media ? media.url : null,
                    image_file_id: media ? media.fileId : null
                })
            });
        })
            .then(responseJson)
            .then(function () {
                inputEl.value = '';
                autoResize();
                clearSelectedImage();
                closeMentions();
            })
            .catch(function (error) { feedback.textContent = error.message; })
            .finally(function () {
                sendBtn.disabled = false;
                sendBtn.removeAttribute('aria-busy');
                sendBtn.textContent = 'Send';
                inputEl.focus();
            });
    }

    document.getElementById('membersList').replaceChildren.apply(
        document.getElementById('membersList'),
        memberRecords.map(function (member) {
            var item = document.createElement('div');
            item.className = 'chat-member-item';
            var name = document.createElement('span');
            name.textContent = member.username;
            item.appendChild(name);
            if (member.isAdmin) {
                var badge = document.createElement('img');
                badge.className = 'admin-verified-badge';
                badge.src = '/assets/admin-verified.jpeg';
                badge.alt = '';
                badge.setAttribute('aria-hidden', 'true');
                item.appendChild(badge);
                var adminText = document.createElement('span');
                adminText.className = 'sr-only';
                adminText.textContent = 'Administrator';
                item.appendChild(adminText);
            }
            return item;
        })
    );

    container.querySelectorAll('.chat-msg').forEach(function (message) {
        var body = message.querySelector('.chat-msg-body');
        var time = message.querySelector('.chat-msg-time');
        var deleteButton = message.querySelector('.chat-delete-btn');
        if (body) renderBodyInto(body, body.dataset.raw || '');
        if (time) time.textContent = formatTime(time.dataset.ts);
        if (deleteButton && message.dataset.author !== currentUserId && !isAdmin) deleteButton.remove();
    });

    var lastMessage = container.querySelector('.chat-msg:last-child');
    if (lastMessage) {
        lastMessageId = Number(lastMessage.dataset.id) || 0;
        localStorage.setItem('tommys_club_last_msg', lastMessage.dataset.id);
    }
    scrollToBottom();

    function pollMessages() {
        fetch('/chat/messages?after=' + encodeURIComponent(String(lastMessageId)), {
            headers: { 'Accept': 'application/json' }
        })
            .then(responseJson)
            .then(function (data) {
                (data.messages || []).forEach(appendMessage);
            })
            .catch(function () {});
    }

    function startPolling() {
        if (pollingTimer) return;
        pollMessages();
        pollingTimer = window.setInterval(pollMessages, 3000);
    }

    function stopPolling() {
        if (!pollingTimer) return;
        window.clearInterval(pollingTimer);
        pollingTimer = null;
    }

    function connectWebSocket() {
        fetch('/chat/ws-token')
            .then(responseJson)
            .then(function (data) {
                var protocol = location.protocol === 'https:' ? 'wss' : 'ws';
                var socket = new WebSocket(protocol + '://' + location.host + '/chat/ws?token=' + encodeURIComponent(data.token));
                socket.onopen = function () {
                    reconnectFailures = 0;
                    stopPolling();
                };
                socket.onmessage = function (event) {
                    try {
                        var message = JSON.parse(event.data);
                        if (message.type === 'message') appendMessage(message);
                    } catch (_) {}
                };
                socket.onclose = function (event) {
                    reconnectFailures++;
                    if (reconnectFailures >= 3) startPolling();
                    if (event.code !== 4001) window.setTimeout(connectWebSocket, Math.min(15000, 2000 * reconnectFailures));
                };
                socket.onerror = function () {};
            })
            .catch(function () {
                reconnectFailures++;
                if (reconnectFailures >= 3) startPolling();
                window.setTimeout(connectWebSocket, Math.min(15000, 2000 * reconnectFailures));
            });
    }
    connectWebSocket();

    imageInput.addEventListener('change', function () { selectImage(imageInput.files[0]); });
    imageRemove.addEventListener('click', clearSelectedImage);
    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', function (event) {
        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            var active = dropdown.querySelector('.mention-item.active');
            if (dropdown.style.display === 'block' && active) return active.click();
            sendMessage();
        } else if (event.key === 'Escape') {
            closeMentions();
        }
    });

    container.addEventListener('click', function (event) {
        var button = event.target.closest('.chat-delete-btn');
        if (!button || !window.confirm('Delete this message?')) return;
        fetch('/chat/' + encodeURIComponent(button.dataset.msgid), {
            method: 'DELETE',
            headers: { 'X-CSRF-Token': window.CSRF_TOKEN, 'Accept': 'application/json' }
        }).then(responseJson).then(function () {
            var message = Array.from(container.querySelectorAll('.chat-msg')).find(function (item) {
                return item.dataset.id === button.dataset.msgid;
            });
            if (message) message.remove();
        }).catch(function (error) { feedback.textContent = error.message; });
    });

    function insertMention(username) {
        var value = inputEl.value;
        var before = value.slice(0, mentionStart);
        var after = value.slice(inputEl.selectionStart);
        inputEl.value = before + '@' + username + ' ' + after;
        inputEl.focus();
        closeMentions();
    }

    inputEl.addEventListener('input', function () {
        autoResize();
        var before = inputEl.value.slice(0, inputEl.selectionStart);
        var match = before.match(/@(\w*)$/);
        if (!match) return closeMentions();
        mentionStart = before.lastIndexOf('@');
        var query = match[1].toLowerCase();
        var filtered = members.filter(function (member) {
            return member.toLowerCase().startsWith(query);
        }).slice(0, 6);
        if (!filtered.length) return closeMentions();
        dropdown.textContent = '';
        filtered.forEach(function (name, index) {
            var item = document.createElement('button');
            item.type = 'button';
            item.className = 'mention-item' + (index === 0 ? ' active' : '');
            item.setAttribute('role', 'option');
            item.setAttribute('aria-selected', String(index === 0));
            item.textContent = name;
            item.addEventListener('click', function () { insertMention(name); });
            dropdown.appendChild(item);
        });
        dropdown.style.display = 'block';
    });

    document.addEventListener('click', function (event) {
        if (!dropdown.contains(event.target) && event.target !== inputEl) closeMentions();
    });
})();
