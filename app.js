import config from './js/config.js';
import du from './js/domutils.js';
import i18n from './js/i18n.js';
import Labs from './js/labs.js';
import Location from './js/location.js';
import Map from './js/map.js';
import QrCode from './js/qr-code.js';
import st from './js/settings.js';
import pp from './js/paypal.js';

console.log(config.name, config.version);

const MESSAGES = [];
let SW_REGISTRATION = null;
let HREF_CURR = '';
let HREF_PREV = '';

const send_message_to_service_worker = (data) => new Promise((resolve) => {
    console.info('send_message', data);
    navigator.serviceWorker.ready.then((reg) => {
        reg.active.postMessage(data);
        return resolve(reg);
    });
});

function addMessage(message) {
    du.setInnerHtml('messages', message)
    MESSAGES.unshift({
        timestamp: Date.now(),
        text: message,
    })
    if (MESSAGES.length > config.message_buffer) {
        MESSAGES.length = config.message_buffer
    }
}

function showMessages() {
    const html = '<div style="display: grid; grid-template-columns: auto auto; grid-gap: 0.2rem;">'+
        MESSAGES
            .map(m => `<div>${Location.formatTimestamp(m.timestamp)}</div><div>${m.text}</div>`)
            //.map(m => `<div>${m.timestamp}</div><div>${m.text}</div>`)
            .join('') +
        '</div>'
    du.setInnerHtml('page', html);
    du.setChecked('symbol-page');
}


const updateUser = () => new Promise((resolve) => {
    Labs
        .getData()
        .then(res => {
            config.username = res.username;
            config.user_id = res.user_id;
            config.expire = res.membership_expire;
            config.expire_formatted = res.expire_formatted;
            config.level = res.membership_level;
            config.level_formatted = res.level_formatted;
            config.translator = res.translator;
            config.translator_formatted = res.translator_formatted;
            du.setChecked('authenticated', res.authenticated);
            du.setChecked('update', res.update);

            if (config.level & 1) {
                document
                    .querySelectorAll('[for="debug"]')
                    .forEach(elem => elem.classList.remove('hidden'))
                ;
            } else {
                document
                    .querySelectorAll('[for="debug"]')
                    .forEach(elem => elem.classList.add('hidden'))
                ;
                du.setChecked('debug', false);
            }
            du.setInnerHtml('friends-formatted', config.level_formatted);
            Array.from(document.querySelectorAll('input[id^="bit-"]'))
                .filter(elem => !config.level_formatted.match(/bit-\w*/g).includes(elem.id))
                .forEach(elem => elem.checked = false)
            ;
            if (config.translator.length) {
                document
                    .querySelectorAll('[for="translate"]')
                    .forEach(elem => elem.classList.remove('hidden'))
                ;
                st
                    .getSetting('data-url').then(data_url => {
                        data_url ||= config.data_url;
                        data_url += data_url.includes('?') ? '&' : '?';
                        i18n.supported_url = data_url + 'special=language';
                        i18n.translations_url = data_url + 'special=language&id=@@';
                    })
                    .then(() => st.getSetting('language'))
                    .then((locale) => {
                        i18n._supported_locales = null;
                        i18n
                            .setLanguageSelector(i18n.selector_id, locale)
                            .then(res => console.debug(res))
                            .catch(err => console.error(err))
                    })
                    .then(() => i18n.setTranslations())
            } else {
                document
                    .querySelectorAll('[for="translate"]')
                    .forEach(elem => elem.classList.add('hidden'))
                ;
                i18n.supported_url = i18n._supported_url;
                i18n.translations_url = i18n._translations_url;
                du.setChecked('translate', false);
            }

            if (Date.parse(res.last_logs_update) < new Date().setDate(new Date().getDate()-1)) {
                Labs.getData({
                    special: 'update-logs',
                }).catch(err => console.error(err));
            }
            return resolve(res)
        })
})

const sentNotification = (title, payload) => {
    if(SW_REGISTRATION && 'showNotification' in SW_REGISTRATION) {
        return SW_REGISTRATION.showNotification(title, payload);
    }
    return  new Notification(title, payload);
}
const notify = (distance) => {
    null != Labs.labs && Labs
        .labs
        .filter(lab =>
            lab.distance < distance &&
            lab.color !== 'yellow' &&
            'undefined' === typeof lab.notified
        )
        .forEach(lab => {
            lab.notified = true;
            Labs
                .getDetail(lab.id)
                .then(l => sentNotification(
                    lab.title,
                    {
                        badge: './images/badge.png', body: l.question,
                        data: l,
                        icon: './images/icons/icon-512-512.png',
                        image: l.key_image_url,
                        tag: l.id,
                        vibrate: [100, 200, 100, 100, 200, 100,100, 200, 100, 100, 200, 100,],
                        //requireInteration: true,
                    },
                ))
        })
}

const changedPositionLarge = () => new Promise((resolve, reject) => {
    const current_position = new Location(
        localStorage.getItem(config.current_latitude),
        localStorage.getItem(config.current_longitude)
    )
    addMessage('changedPositionLarge: '+ current_position);
    Labs
        .getLabs()
        .then(() => Labs.showLabs())
        .catch(err => reject(err))
    ;
    ['latitude', 'longitude', 'timestamp'].forEach(key => {
        localStorage.setItem(
            config['fetched_'+key],
            localStorage.getItem(config['current_'+key])
        );
    })
});

const changedPositionSmall = () => new Promise((resolve) => {
    Labs.showLabs(Labs.sortLabs());
    st.getSetting('notification-distance').then(notification_distance => {
        if (
            0 !== +notification_distance &&
            'Notification' in window &&
            'granted' === Notification.permission
        ) {
            notify(+notification_distance);
        }
    })
    return resolve(Labs.labs);
})

const changedPosition = (position, type='?') => {
    addMessage('changedPosition ' + type);
    localStorage.setItem(config.current_latitude, position.coords.latitude);
    localStorage.setItem(config.current_longitude, position.coords.longitude);
    localStorage.setItem(config.current_heading, position.coords.heading);
    localStorage.setItem(config.current_timestamp, position.timestamp);
    const current_location = new Location(position.coords);
    //config.current_heading = position.coords.heading || 0;
    //config.current_heading = Math.floor(Math.random() * 360);
    du.setInnerHtml(
        'location',
        new Location(position.coords) + ' &nbsp; ' +
        Location.formatBearing(position.coords.heading || 0)
    );
    du.setInnerHtml('timestamp', Location.formatTimestamp(position.timestamp));
        
    du.setInnerHtml(
        'compass-style',
        `.compass{transform: rotate(-${position.coords.heading||0}deg);}`
    );

    if (Map.marker) {
        Map.marker.setLatLng([position.coords.latitude, position.coords.longitude]);
    }
    Map.center();

    const fetch_position = new Location(
        localStorage.getItem(config.fetched_latitude),
        localStorage.getItem(config.fetched_longitude)
    );
    addMessage(`FDistance: ${Location.formatDistance(fetch_position.distance(current_location))}`)
    st.getSetting('block-size').then(block_size => {
        if (Math.abs(block_size) * 250 < fetch_position.distance(current_location)) {
            return changedPositionLarge(position.coords);
        } else {
            return changedPositionSmall(position.coords);
        }
    });
}

const watchLocation = (() => {
    let watch_id = 0
    let interval_id = 0;
    return () => {
        if (!navigator.geolocation) {
            du.setInnerHtml(
                'location',
                "Browser doesn't support the Geolocation API"
            );
            return;
        }
        if (watch_id) {
            navigator.geolocation.clearWatch(watch_id);
            watch_id = 0;
        }
        if (interval_id) {
            window.clearInterval(interval_id);
            interval_id = 0;
        }
        Promise.all([
            st.getSetting('update-interval'),
            st.getSetting('high-accuracy'),
        ]).then(([update_interval, high_accuracy]) => {
            if (0 === +update_interval) {
                watch_id = window.navigator.geolocation.watchPosition(
                    changedPosition,
                    (error) => du.setInnerHtml('location', error.message),
                    {enableHighAccuracy: high_accuracy},
                );
                addMessage('watchPosition: ' + watch_id);
            } else if (0 < update_interval) {
                interval_id = window.setInterval(
                    () => {
                        window.navigator.geolocation.getCurrentPosition(
                            (position) => changedPosition(position, 'interval'),
                            (error) => du.setInnerHtml('location', error.message),
                            {enableHighAccuracy: high_accuracy},
                        )
                    },
                    update_interval * 1000
                );
                addMessage('setInterval: ' + interval_id);
            } else {
                changedPosition(
                    {
                        coords: {
                            latitude: 52.0880131,
                            longitude: 5.1273913,
                            heading: 314,
                        },
                        timestamp: Math.floor(Date.now() / 86400000) * 86400000 -
                            2 * 3600000 +
                            16 * 3600000 + 18 * 60000 + 3 * 1000
                            // 1.61803398875
                    },
                    'D'
                )
            }
        })
    }
})()

const enableNotifications = () => {
    if ('Notification' in window) {
        if (Notification.permission !== 'granted') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    console.log('The user accepted');
                }
            });
        } else {
            console.log('Permission already granted');
        }
    }
}

const showMessage = () => {
    du
        .loadUrlToElem('popup-content', './html/message.html')
        .then(html => {
            const html_hash = du.hash(html);
            console.log(html_hash, html);
            if (+localStorage.getItem(config.message_hash) !== html_hash) {
                du.setChecked('symbol-popup')
            }
            localStorage.setItem(config.message_hash, html_hash);
        })
        // Not really an error if at this moment there is no message
        .catch(err => console.debug('No message:', err))
    ;
}

const logLab = (id) => {
    const elem = document
        .getElementById('id'+id)
        .getElementsByClassName('lab')[0];
    elem.parentNode.classList.add('wait');

    Labs.
        logLab(
            id,
            elem.querySelector('.answer').querySelector('select').value ||
            elem.querySelector('.answer').querySelector('input').value
        )
        .then(res => {
            let color;
            switch (res.Result) {
                case 0:
                case 3:
                    const geocache = document.querySelector('[href="#id-'+res.id+'"]');
                    if (geocache) {
                        geocache.parentElement.classList.add('logged')
                    }

                    color = 'yellow';
                    const html = '' +
                        (res.JournalImageUrl ? '<img src="' + res.JournalImageUrl + '" />' : '') +
                        (res.JournalVideoYouTubeId ?
                            '<div class="video"><iframe src="https://www.youtube-nocookie.com/embed/' +
                            res.JournalVideoYouTubeId +
                            '"></iframe></div>' +
                            '<div style="width:1000px;"></div>' : // Force video width to maxWidth
                            ''
                        ) +
                        (res.JournalMessage ? res.JournalMessage.replace('\n', '<br />') : '') +
                        '';
                    du.setInnerHtml(
                        'popup-content',
                        '<div class="journal">' + html + '</div>'
                    );
                    const journal = document.getElementById(
                        'journal-' + elem.parentNode.id.slice(2)
                    );
                    if (journal) {
                        journal.innerHTML = html;
                        journal.classList.remove('hidden');
                    }
                    du.setChecked('symbol-popup');
                    if (res.hasOwnProperty('rating')) {
                        rateAdventure(res);
                    }
                    break;
                case 2:
                    color = 'orange';
                    break;
                default:
                    console.log(res);
                    color = 'red';
            }
            elem.parentNode.classList.remove('wait');
            st.getSetting('hide-logged').then(hide_logged => {
                const id = elem.parentNode.id.slice(2)
                if (hide_logged && 'yellow' === color) {
                    Labs.labs = Labs.labs.filter(lab => lab.id !== id)
                    const circle = Map.id2layer(id);
                    if (circle) {
                        Map.map.removeLayer(circle);
                    }
                    elem.remove();
                    Labs.updateLocalStorage(id);
                } else {
                    Labs
                        .labs
                        .filter(lab => lab.id === id)
                        .forEach(lab => {
                            lab.color = color;
                            Map.setCircleColor(lab.id, color);
                        })
                    ;
                    Labs.setBorderColor(elem, color);
                    Labs.updateLocalStorage(id, { color: color });
               }
            })
        })
        .catch(err => console.error(err))
    ;

}

const postReview = () => {
    Promise.all([
        du.getElementValue('adventure_id'),
        du.getRadioValue('rating'),
        du.getElementValue('review'),
    ]).then(([adventure_id, rating, review,]) => {
        document.getElementById('post-review').disabled=true;
        Labs.getData({
            'id': adventure_id,
            'block_size': rating,
            'code': review,
            'special': 'ratings',
        }).then(res => {
            document.getElementById('post-review').disabled=false;
            du.dispatchEvent(du.elemOrId('cancel'), 'click');
            console.debug(res);
        })
    })
}

const showJsonNavigation = () => {
    const tables = document.getElementsByClassName('table-from-array');
    const page = tables.length ? +tables[0].dataset.pgc_num || 0 : 0;
    const pages = tables.length ? +tables[0].dataset.pgt_num || 0 : 0;
    return (HREF_PREV ? `<a href="${HREF_PREV}"><b>⏎</b></a>` : '') +
        (pages > 1 && page > 0 ? ' &nbsp ' + [...Array(pages).keys()].map(
            x => x+1 === page ? `${x+1}` : `<a href="${HREF_CURR}?page=${x+1}">${x+1}</a>`
        ).join(' ') : '')
}

const showHref = (href) => {
    const [page, extension] = HREF_CURR.slice(1).split('.');
    const data = Object.fromEntries(new URLSearchParams(href.split('?').splice(1).join('?')));
    console.debug(page, extension, data);
    let key = 'html';
    switch (extension) {
        case 'json':
            key = 'special';
            break;
        default:
            key = 'html';
            break
    }
    data[key] = page;
    Labs
        .getData(data)
        .then(res => du.setInnerHtml(
            'page',
            '<input id="page-checkbox" class="hidden" type="checkbox" />' +
            '<h2 data-i18n-key="' +
                ('data-'+page).toLowerCase().replace(/(\s|_|-)+/g, '-') +
            '">' +  du.htmlTitle(page) + '</h2>' +
            (('json' === extension) ? '<div class="table-navigation"></div>' : '') +
            du.htmlFromData(res) +
            (('json' === extension) ? '<div class="table-navigation"></div>' : '')
        ))
        .then(() => Array
            .from(document.getElementsByClassName('table-navigation'))
            .forEach(elem => elem.innerHTML = showJsonNavigation(href))
        )
        .then(() => du.setChecked('symbol-page'))
        .catch(err => console.error(err))
    return false;
}

const rateAdventure = (data=null) => {
    if (null === data) {
        data = {
            rating: Math.floor(Math.random()*10+1)/2,
            adventure_id: '',
        }
    }
    data.rating = (Math.round(data.rating * 2) / 2).toFixed(1);
    du
        .loadUrlToElem('page', './html/review.html')
        .then(() => {
            du.setRadioValue('rating', data.rating);
            du.setElementValue('adventure_id', data.adventure_id);
            du.setChecked('symbol-page');
        });
    return false
}

const translate = (page = 1) => {
    Promise.all([
        Labs.getData({
            special: 'language',
            id: i18n.locale,
            block_size: page || 1,
        }),
        du.loadUrlToElem('page', './html/translate.html'),
    ]).then(([json, html]) => {
        console.debug(html);
        const template = du.elemOrId('translation-template');
        const holder = du.elemOrId('translation-holder');

        holder.innerHtml = '';
        json.labels.forEach(key => {
            const node = document.createElement('div');
            node.innerHTML = template.innerHTML;
            const span = node.getElementsByTagName('span')[0];
            span.innerHTML = key;
            const edit = node.getElementsByTagName('span')[1];
            edit.dataset.i18nKey = key;
            holder.append(node);
        });
        i18n.translate();
        du.setChecked('symbol-page');
        Array
            .from(document.getElementsByClassName('pagination'))
            .forEach(elem => {
                elem.innerHTML = '';
                Array.from(Array(+json.pages)).forEach((_, p) => {
                    elem.innerHTML += ` <span data-page="${p + 1}" ${p + 1 === json.page ? 'class="orange"' : 'href="#translate"'}>${p + 1}</span>`;
                })
            });
    });
    return false;
}

const updateAdventure = (id) => {
    const data = {
        'special': 'update-adventure',
        'latitude':  Map.map.getCenter().lat || localStorage.getItem('current_latitude'),
        'longitude':  Map.map.getCenter().lng || localStorage.getItem('current_longitude'),
    }
    if (id.startsWith('special-update-')) {
        data['id'] = id.slice('special-update-'.length);
    }

    const template = du.elemOrId('update-start-template');
    if (template) {
        du.setInnerHtml(
            'popup-content',
            template.innerHTML,
            { 'text': data.hasOwnProperty('id') ? data.id : new Location(data) }
        );
        du.setChecked('symbol-popup');
    }

    Labs
        .getData(data)
        .then(res => new Promise((resolve, reject) => {
            if ('error' in res) {
                reject(res.error);
            } else {
                resolve(res);
            }
        }))
        .then(json => {
            console.log(json);
            let text = '';
            if (json.hasOwnProperty('err')) {
                text = 'Error:' + json.err;
            } else if (json.hasOwnProperty('Title')) {
                text = 'Updated: ' + json.Title;
            } else {
                text = 'Updated: ' + json.all.length + '<br />' +
                    'New: ' + json.new.length;
            }

            const template = du.elemOrId('update-finish-template');
            if (template) {
                du.setInnerHtml(
                    'popup-content',
                    template.innerHTML,
                    {'text': json.hasOwnProperty('err') ? json.err : json.hasOwnProperty('Title') ? json.Title : json.new.length + ' / ' +  json.all.length }
                );
                du.setChecked('symbol-popup');
            }
            return changedPositionLarge()
        })
        .catch(err => console.error(err))
    ;
}

const updateFilters = () => {
    const filters = {};
    Object
        .keys(localStorage)
        .filter(x => x.startsWith(st.prefix+'filter-'))
        .forEach(x => {
            const key = x.replace(st.prefix+'filter-', '')
            //console.log('key:', key, ' x:', x, ' local:', localStorage.getItem(x), localStorage.getItem(st.prefix+'disable-filter-'+key.replace(/\[.*?\]$/, '').split('-').slice(0,-1).join('-')));
            if (
                localStorage.getItem(x) &&
                !localStorage.getItem(st.prefix+'disable-filter-'+key.replace(/\[.*?\]$/, '').split('-').slice(0,-1).join('-'))
            ) {
                const match = key.match(/^(.*)\[(.*?)\]$/);
                if (match) {
                    if (!filters[match[1]]) { filters[match[1]] = {}; }
                    filters[match[1]][match[2]] = match[2]; //localStorage.getItem(x)
                } else {
                    filters[key] = localStorage.getItem(x);
                }
            }
            /* remove extremes from dual sliders */
            Object
                .keys(filters)
                .forEach(key => {
                    const elem = document.getElementById('filter-'+key);
                    if (
                        elem &&
                        elem.parentNode.classList.contains('dual-range') &&
                        elem.classList.contains(key.split('-').slice(-1)[0]) &&
                        +filters[key] === +elem.getAttribute(key.split('-').slice(-1)[0])

                    ) {
                        delete filters[key];
                    }
                })
            ;
        })
    ;
    delete filters['themes-unc'];
    delete filters['owners-unc'];
    localStorage.setItem(config.filters_key, JSON.stringify(filters))
    console.log(filters)
}

const init = () => {
    pp
        .appendScript()
        .catch(err => console.error(err))
    ;
    Promise.all([
        st.getSetting('username', ''),
        st.getSetting('password', ''),
        fetch('./data/theme.json'),
    ])
    .then(([username, password, theme]) => {
        theme.json().then(json => Labs.data_theme = json).catch(err => console.error(err));
        if (username && password) {
            updateUser()
                .then(res => console.debug("updateUser:", res))
                .catch(err => console.error(err))
            ;
       }
    }).catch(err => { console.error(err); console.log(err); })

    // Make sure there is a decent json string in the filter localstorage
    try {
        if (!JSON.parse(localStorage.getItem(config.filters_key))) {
            throw new Error('Filter is not set');
        }
    } catch(e) {
        localStorage.setItem(config.filters_key, JSON.stringify({}));
    }

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', function() {
            navigator.serviceWorker
                .register('./sw.js', {type: 'module'})
                .then(reg => SW_REGISTRATION = reg)
                .catch(err => console.error('service worker not registered', err))
        })
        navigator.serviceWorker.addEventListener('message', (e) => {
             addMessage(e.data);
            if (e.data.startsWith('id-')) {
                Labs.openLab(e.data.slice(3))
            }
        });
    }

    document.addEventListener('DOMContentLoaded', waitFor);
}

const waitFor = () => {
    if (Labs.data_theme.hasOwnProperty(0)) {
        return main();
    }
    window.setTimeout(waitFor, 100);
}

const main = () => {
    addMessage('main()')
    addMessage(config.home_url);
    Promise
        .all([
            st.getSetting('data-url', ''),
            st.fillSettingsDiv([
                {
                    data: Object
                        .values(Labs.data_theme)
                        .filter(x => 0 !== x.id)
                        .map(data => {
                            return {
                                id: data.id,
                                isother: data.id < 999 ? 0 : 1,
                                Name: data.name,
                                name: data.name.toLowerCase()
                            };
                        }),
                    holder: 'filter-themes-holder',
                },
                {
                    data: Object
                        .keys(localStorage)
                        .filter(x => x.startsWith(st.prefix+'filter-owners-') && localStorage[x] && '' !== localStorage[x])
                        .map(x => ({id: x.replace(/.*\[(.*?)\]$/, '$1'), 'innerHTML': localStorage[x]}))
                        .sort((a,b) => a.innerHTML.localeCompare(b.innerHTML)),
                    holder: 'filter-owners-holder',
                }
            ]),
            du.loadUrlToElem('labs', './html/labs.html'),
            du.loadUrlToElem('map', './html/map.html')
        ]).then((result) => {
            if (du.isOverflow('h1')) {
                du.fitFont('h1', 0.95, 1);
            }
            // Hack to put the data_url as a global variable
            window.data_url = result[0] || config.data_url;

            Map.init();
            watchLocation();
            showMessage();

            const labs =
                localStorage.getItem(config.fetched_latitude) &&
                localStorage.getItem(config.fetched_longitude) &&
                localStorage.getItem(config.fetched_labs);
            if (labs) {
                ['latitude', 'longitude', 'timestamp'].forEach(key => {
                    localStorage.setItem(
                        config['current_'+key],
                        localStorage.getItem(config['fetched_'+key])
                    );
                })
                Labs.updateLabs(JSON.parse(labs), 'labs');
                //Labs.showLabs();
            } else {
                // Heron Island S23.44240 E151.91500
                localStorage.setItem(config.fetched_latitude, config.start_latitude.toString());
                localStorage.setItem(config.fetched_longitude, config.start_longitude.toString());
            }

            const hash = location.hash
            if (hash) {
                if (hash.startsWith('#id-')) {
                    Labs.openLab(hash.slice(4));
                    return;
                }
                const elem = document.getElementById('hash');
                elem.setAttribute('href', hash)
                du.dispatchEvent(elem, 'click');
                return;
            }
            Promise.all([
                st.getSetting('username'),
                st.getSetting('primary-page'),
            ]).then(([username, primary_page]) => {
                if (username) {
                    du.setChecked('symbol-' + primary_page);
                } else {
                    du.setChecked('symbol-settings');
                }
            })
        });
    du.loadUrlToElem('menu', './html/menu.html').catch(err => console.error(err));
}

document.addEventListener('click', (e) => {
    let popup_close = true;
    let target = e.target;
    while(target) {
        popup_close &&= !target.classList.contains('do-not-close');
        // Menu and hash pages
        const href = target.getAttribute('href')
        if (href && href.startsWith('#')) {
            e.preventDefault();
            if (href.startsWith('#id-')) {
                Labs.openLab(href.slice(4));
                return;
            }

            HREF_PREV = HREF_CURR === href.split('?', 1)[0] ? HREF_PREV : HREF_CURR;
            HREF_CURR = href.split('?', 1)[0];
            document.getElementById('symbol-menu').checked = false;
            switch(HREF_CURR.slice(1)) {
                case 'close':
                    // Used by leaflet
                    return true;
                case 'about':
                    config.count_labs = Labs.labs.length;
                    config.count_map = Object.keys(Map.map._layers).length;
                    // Extra data has been added, continue as with regular pages
                case 'help':
                case 'stats':
                    du
                        .loadUrlToElem('page', './html/'+href.slice(1)+'.html', config)
                        .then(() => du.setChecked('symbol-page'));
                    return false;
                case 'donate':
                    if (du.getElementValue('authenticated')) {
                        pp.page()
                    } else {
                        du
                            .loadUrlToElem('page', 'html/donate.html')
                            .then(() => du.setChecked('symbol-page'))
                        ;
                    }
                    return false;
                case 'friends':
                    Promise
                        .all([
                            Labs.getData({'html': 'friends'}),
                            Labs.getData({'special': 'referrer'}),
                            du.loadUrlToElem('page', './html/friends.html'),
                        ])
                        .then(([friends, referrers]) => {
                            du.setInnerHtml('friends-container', friends);
                            du.setSelectOptions(
                                'friend-username-select', 
                                [
                                    {' ': i18n.translations['friends-select-user'] || 'Select user'},
                                    ...referrers,
                                    {'': (i18n.translations['friends-select-user-other'] || 'Other') + ':'}
                                ]
                            );
                            du.dispatchEvent('friend-username-select', 'change');
                            du.setChecked('symbol-page');
                        });
                    return false;
                case 'labs':
                    du.setChecked('symbol-labs');
                    return false;
                case 'rate': {
                    return rateAdventure();
                }
                case 'licence': {
                    du
                        .loadUrl('./LICENCE')
                        .then(txt => {
                            du.setInnerHtml('page', txt.replaceAll('\n', '<br />\n'));
                            du.setChecked('symbol-page');
                        });
                    return false
                }
                case 'map': {
                    du.setChecked('symbol-map');
                    return false;
                }
                case 'messages':
                    showMessages();
                    return false;
                case 'settings':
                {
                    du.setChecked('symbol-settings');
                    return false;
                }
                case 'translate':
                    return translate(+target.dataset.page);
                case 'qr':
                    du
                        .loadUrlToElem('popup-content', './html/qr-code.html')
                        .then(() => QrCode.show())
                        .then(() => {
                            const elem = document.getElementById('qr-url')
                            if (elem) {
                                elem.innerHTML = QrCode.qrcode._options.data;
                                elem.href = QrCode.qrcode._options.data;
                            }
                            du.setChecked('symbol-popup')
                        })
                        .catch(err => console.error(err))
                    ;
                    return false;
                default:
                    return showHref(href);
            }
        }

        // Make radio buttons toggleable
        if (
            'radio' === target.getAttribute('type') &&
            !['top', 'friends-period'].includes(target.name)
        ) {
            if (target.dataset._checked) {
                target.dataset._checked = '';
                du.setChecked(target, false);
            } else {
                target.dataset._checked = 'on'
                document.getElementsByName(target.name)
                    .forEach(elem => {
                        if (elem !== e.target && elem.dataset._checked) {
                            elem.dataset._checked = '';
                            du.dispatchEvent(elem, 'change')
                        }
                    })
                ;
            }
        }

        // Friend bits
        if (target.dataset.friendBits) {
            const bits = document.getElementById('friend-bits')
            if (bits)
                if (du.getElementValue(target.getAttribute('for'))) {
                    bits.value |= target.dataset.friendBits;
                } else {
                    bits.value &= ~target.dataset.friendBits;
                }
                st.updateSetting(bits);
        }


        if (target.id.startsWith('symbol-')) {
            // Handled by the change listener
            // Don't close the popups
            return false;
        }

        // Map
        if (target.id.startsWith('map-')) {
            return Labs.openLab(target.id.slice(4));
        }

        // Update
        if (
            'special-update' === target.id ||
            target.id.startsWith('special-update-')
        ) {
            return updateAdventure(target.id);
        }
        if (
            (target.classList.contains('log-button')) && (
                target.parentElement.getElementsByTagName('input')[0].value ||
                target.parentElement.getElementsByTagName('select')[0].value
            )
        ) {
            return logLab(target.dataset.id);
        } 
        switch(target.id) {
            case 'give-friend':
                Labs
                    .getData({
                        'special': 'give-friend',
                        'id': pp.friendsBits() + ':::' +
                            (
                                document.getElementById('friend-username-select').value ||
                                document.getElementById('friend-username-input').value
                            ) +
                            ':::' + document.getElementById('friend-duration').value * 7,
                    })
                    .then(res => {
                        du.setInnerHtml(
                            'popup-content',
                            i18n.translateHtml(
                                `<span data-i18n-key="${res.label}">${res.message}</span>`
                            )
                        );
                        du.setChecked('symbol-popup')
                    })
                return false;
            case 'cancel':
            case 'save-and-exit':
                st.getSetting('primary-page').then(primary_page => {
                    du.setChecked('symbol-' + primary_page)
                });
                return false;
            case 'post-review':
                return postReview();
            case 'restore-default-settings':
                st.clearSettings();
                return false;
            case 'translate-save':
                e.preventDefault();
                Promise.all(
                    Array.from(
                        target
                            .parentNode
                            .getElementsByTagName('textarea')
                    )
                        .filter(textarea =>
                            undefined !== textarea.dataset.content &&
                            textarea.dataset.content !== textarea.value
                        )
                        .map(textarea => new Promise((resolve, reject) => {
                            Labs
                                .getData({
                                    special: 'language',
                                    id: textarea.dataset.label + '|' + textarea.dataset.locale,
                                    code: textarea.value,
                                })
                                .then(res => resolve(res))
                                .catch(err => reject(err))
                        }))
                ).then(res => {
                    res
                        .filter(res => res.locale === i18n.locale)
                        .forEach(res => i18n.setTranslation(res.label, res.content));
                    du.setChecked('symbol-popup', false)
                });

                return false;
            // Debug stuff
            case 'reload-labs':
                changedPositionLarge().then();
                return false
            case 'clear-cache':
                send_message_to_service_worker({
                    type: 'action',
                    text: target.id,
                }).then()
                return false;
            default:
                // Check a level higher
                target = target.parentElement;
        }
    }
    //This closes the popups very fanatic
    popup_close && du.setChecked('symbol-popup', false);
    du.setChecked('symbol-menu', false);
    return true;
});

document.addEventListener('change', (e) => {
    if (
        'select' === e.target.tagName.toLowerCase() &&
        e.target.parentElement.classList.contains('select-or-input')
    ) {
        e.target.parentElement.dataset.value = e.target.value;
    }

    if ('top' === e.target.name) {
        if ('symbol-settings' === e.target.id) {
            document.getElementById(st.div).dataset.changes = JSON.stringify([]);
        } else {
            const changes = JSON.parse(document.getElementById(st.div).dataset.changes);
            if (['username', 'password'].filter(x => changes.includes(x)).length) {
                updateUser().catch(err => console.error(err));
            }
            if (['username', 'password', 'block-size', 'hide-logged'].filter(x => changes.includes(x)).length) {
                Labs.refresh().then();
            }
            if (['high-accuracy', 'update-interval'].filter(x => changes.includes(x)).length) {
                watchLocation();
            }
            if (['data-url'].filter(x => changes.includes(x)).length) {
                st.getSetting('data-url').then(data_url => window.data_url = data_url || config.data_url);
            }
            console.log(changes);
            if (changes.filter(x =>
                x.startsWith('bit-') ||
                x.startsWith('filter-') ||
                x.startsWith('disable-filter-')
            ).length) {
                console.log('Filter changed')
                updateFilters();
                Labs.refresh().then();
            }
            document.getElementById(st.div).dataset.changes = JSON.stringify([]);
        }
    }

    if (e.target.id.startsWith('details-')) {
        if (document
            .getElementById('id'+e.target.id.slice(8))
            .getElementsByClassName('details')[1]
            .classList
            .contains('blur')
        ) {
            Labs
                .getDetail(e.target.id.slice(8)) // Remove the first 8 characters
                .then(lab => Labs.showDetail(lab))
            ;
        }
        if (e.target.checked) {
            const active = Labs.labs.filter(l => l.id === e.target.id.slice(8));
            if (active.length) {
                Map.active.setLatLng([
                    active[0].location_latitude,
                    active[0].location_longitude
                ]);
                Map.map.addLayer(Map.active);
            }
        } else {
            Map.map.removeLayer(Map.active);
        }
    }

    if (
        e.target.classList.contains('friend-selector') ||
        'friends-period' === e.target.name
    ) {
        const period = document.querySelector( 'input[name="friends-period"]:checked');
        du.setInnerHtml(
            'friends-price',
            (pp.friendsPrice() * (period ? period.value : 11)/100).toFixed(2)
        );
        const bits_elem = document.getElementById('friends-bits')
        if (bits_elem) { bits_elem.value = pp.friendsBits(); }
    }

    switch(e.target.id) {
        case 'friends-bits':
            Array.from(document.getElementsByClassName('friend-selector')).forEach(x => {
                x.checked = +x.value === (
                    // + to convert to int
                    (+x.dataset.bitValue) &
                    (+document.getElementById('friends-bits').value)
                );
            })
            break;
        case 'symbol-map':
            if (e.target.checked) {
                Map.center();
            }
            break;
        case 'symbol-labs':
            //changedPositionSmall().catch(err=>console.error(err));
            break;
        case 'notification-distance':
            enableNotifications(e)
            break;
        default:
            //console.log('change event not handled:', e.target.id);
            return true;
    }
});

document.addEventListener('message', (e) => {
    console.log('Message', e.data);
    addMessage(e.data)
});

document.addEventListener('translate', (e) => {
    if (!config.translator) { return false; }
    st.getSetting('language').then(locale => {
        console.debug(locale);
        Labs
            .getData({
                'special': 'language',
                'id': e.target.dataset.i18nKey + '|' +
                    config.translator.map(x => x.split(':')[0]).join('|')
            }).then(json =>
            du.loadUrlToElem(
                'popup-content',
                './html/i18n.html',
                {'label': json[0].label}
            ).then(() => i18n.supported_locales)
                .then (supported_locales =>
            {
                const template = du.elemOrId('i18n-template');
                const holder = du.elemOrId('i18n-holder');
                json.forEach(data => {
                    ['flag', 'language'].forEach(
                        x => data[x] = supported_locales[data.locale.split(':')[0]]
                            ? supported_locales[data.locale.split(':')[0]][x]
                            : data.locale
                    );
                    const label = data['label'];
                    const content = data['content'];
                    let options; // Initialisation is redundant
                    if (data.label.endsWith('_p')) {
                        // TODO: Handle cardinal / ordinal
                        options =  new Intl.PluralRules('en').resolvedOptions().pluralCategories;
                    } else {
                        options = [''];
                    }
                    options.forEach(option => {
                        if (option) {
                            data['label'] = label + '__' + option
                        }
                        data['option'] = option;
                        data['content'] = typeof content === 'string' ? content : content[option] || '';
                        const node = document.createElement('div');
                        node.innerHTML = du.renderTemplate(i18n.translateHtml(template.innerHTML), data);
                        const textarea  = node.getElementsByTagName('textarea')[0];
                        textarea.style.width = (Math.min(config.max_width,  window.innerWidth ) * .7) + 'px';
                        if (config.translator.includes(data['locale'])) {
                            ['content', 'label', 'locale'].forEach(x => {
                                textarea.dataset[x] = data[x];
                            });
                        } else {
                            textarea.disabled = true;
                        }
                        holder.append(node);
                        })
                })
                du.setChecked('symbol-popup');
            })
        );
    });
});

init()
