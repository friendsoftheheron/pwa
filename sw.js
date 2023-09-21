import config from './js/config.js'

const assets = [
    './app.js',
    './index.html',
    './favicon.ico',
    './css/ratings.css',
    './resize.css',
    './css/style.css',
    './css/vars.css',
    './images/badge.png',
    './images/balloon.png',
    './images/balloon-cloud.png',
    './images/center.png',
    './images/compass.png',
    './images/desert.png',
    './images/needle.png',
    './images/launch.png',
    './images/qr-code.svg',
    './html/about.html',
    './html/donate.html',
    './html/friends.html',
    './html/help.html',
    './html/labs.html',
    './html/map.html',
    './html/menu.html',
    './html/paypal.html',
    './html/qr-code.html',
    './html/review.html',
    './html/settings.html',
    './js/crypto.js',
    './js/domutils.js',
    './js/dual-range.js',
    './js/geocaching.js',
    '.js/i18n.js',
    './js/labs.js',
    './js/location.js',
    './js/map.js',
    './js/paypal.js',
    './js/qr-code.js',
    './js/settings.js',
];

self.addEventListener('install', e => {
    console.log('sw:install');
    caches.keys().then(function(names) {
        names
            .filter((x) => x.startsWith(config.name_reduced) && x !== config.cache_name)
            .forEach((name) => {
                console.info('sw:caches delete', name)
                caches.delete(name).catch(err => console.log(err));
            });
    });
    return e.waitUntil(
        caches.open(config.cache_name).then((cache) => {
            cache.addAll(assets).catch(err => console.log(err));
        })
    );
});

self.addEventListener('activate', event => {
    console.log('sw:activate');
    event.waitUntil(self.clients.claim().catch(err => console.log(err)));
});

self.addEventListener('fetch', e => {
    return e.respondWith(
        caches.match(e.request).then((res) => {
            return res || fetch(e.request).then((res) => {
                console.info('sw:fetched', e.request);
                if (
                    e.request.method !== 'GET' ||
                    // e.request.url.includes('?') || // No query parameters
                    // e.request.url.includes('mediacontainer') ||
                    e.request.url.endsWith('html/message.html') || // No messages
                    e.request.url.endsWith('js/config.js')  // Not the config
                ) {
                    return res;
                }
                return caches.open(config.cache_name).then((cache) => {
                    cache.put(e.request, res.clone()).catch(err => console.log(err));
                    return res;
                });
            }).catch(err => console.error('sw:fetch:'+e.request.url, err));
        })
    );
});

self.addEventListener('notificationclick', e => {
    console.log('sw:notificationclick', e.notification.title);
    e.notification.close()
    e.waitUntil(
        self.openUrl(config.home_url) //+ '#id-' + e.notification.tag)
            .then(client => client.postMessage('id-' + e.notification.tag))
            .catch(err => console.error('self.openUrl', err))
    );
});

self.addEventListener('notificationclose', e => {
    console.log('notificationclose', e);
});

self.addEventListener('message', e => {
    switch (e.data.type) {
        case 'action':
            switch(e.data.text) {
                case 'clear-cache':
                    self.clearCache();
                    return true;
                default:
                    self.sendMessage(`msg:Unknown text: ${e.data.text}`);
                    return false;
            }
        default:
            self.sendMessage(`msg:Unknown type: ${e.data.type}`);
    }
    return false;
});

self.openUrl = (url) => new Promise((resolve) => {
    const targetUrl = new URL(url);
    self
        .clients
        .matchAll({
            type: 'window',
            includeUncontrolled: true
        })
        .then((windowClients) => {
            let matchingClient = null;
            let clientUrl = null;

            for (let i = 0; i < windowClients.length; i++) {
                const windowClient = windowClients[i];
                clientUrl = new URL(windowClient.url);
                if (targetUrl.origin === clientUrl.origin) {
                    matchingClient = windowClient;
                    break;
                }
            }
            if (matchingClient) {
                return resolve(matchingClient.focus());
            } else {
                return resolve(self.clients.openWindow(url));
            }
        })
    ;
})

self.clearCache = () => {
   console.log('sw:clearCache');
   caches.delete(config.cache_name).catch(err => console.log(err));
    self.sendMessage('sw:Clear cache');
}

self.sendMessage = (message) => {
    self
        .clients
        .matchAll({includeUncontrolled: true, type: 'window'})
        .then(clients => {
            clients.forEach((client) => {
                client.postMessage(message);
            });
        })
    ;
}
