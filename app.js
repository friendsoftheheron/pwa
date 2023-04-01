import config from './js/config.js'
import du from './js/domutils.js'
import Labs from './js/labs.js'
import Location from './js/location.js'
import Map from './js/map.js'
import QrCode from './js/qr-code.js'
import st from './js/settings.js'
import pp from './js/paypal.js'

console.log(config.name, config.version);

const MESSAGES = [];
let swRegistration = null;

const send_message_to_service_worker = (data) => new Promise((resolve) => {
    console.info('send_message', data);
    navigator.serviceWorker.ready.then((reg) => {
        console.info('registration:', reg);
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
	        du.setChecked('authenticated', res.authenticated);

            if (config.level & 1) {
                document.querySelectorAll('[for="debug"]').forEach(elem => elem.classList.remove('hidden'));
            } else {
                document.querySelectorAll('[for="debug"]').forEach(elem => elem.classList.add('hidden'));
                du.setChecked('debug', false);
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
    if(swRegistration && 'showNotification' in swRegistration) {
        return swRegistration.showNotification(title, payload);
    }
    return  new Notification(title, payload);
}
const notify = (distance) => {
    null != Labs.labs && Labs
        .labs
        .filter(lab => lab.distance < distance && 'undefined' == typeof lab.notified)
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
        .then(
            (labs) => {
                localStorage.setItem(config.fetched_labs, JSON.stringify(labs));
                Labs.showLabs();
            })
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
        Location.formatBearing(position.coords.heading || 0) +
        '<span style="float:right; font-size: 0.6rem; margin-right: 1rem;">' +
        Location.formatTimestamp(position.timestamp) + '</span>'
    );
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
            } else {
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
            }
        })
    }
})()

const enableNotifications = (e) => {
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

const init = () => {
    pp
        .appendScript()
        .catch(err => console.error(err))
    ;
    Promise.all([
        st.getSetting('username'),
        st.getSetting('password'),
    ])
    .then(([username, password]) => {
       if (username && password) {
           updateUser()
               .then(res => console.debug("updateUser:", res))
               .catch(err => console.error(err))
       }
    });


    if ('serviceWorker' in navigator && 1==1) {
        window.addEventListener('load', function() {
            navigator.serviceWorker
                .register('./sw.js', {type: 'module'})
                .then(reg => swRegistration = reg)
                .catch(err => console.error('service worker not registered', err))
        })
        navigator.serviceWorker.addEventListener('message', (e) => {
             addMessage(e.data);
            if (e.data.startsWith('id-')) {
                Labs.openLab(e.data.slice(3))
                return
            }
        });
    }

    document.addEventListener('DOMContentLoaded', main);
}

const main = () => {
    addMessage('main()')
    addMessage(config.home_url);
    Promise
        .all([
            st.fillSettingsDiv(),
            du.loadUrlToElem('labs', './html/labs.html'),
            du.loadUrlToElem('map', './html/map.html')
        ]).then(() => {
            Map.init();
            watchLocation();

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
                Labs.showLabs();
            } else {
                // Heron Island S23.44240 E151.91500
                localStorage.setItem(config.fetched_latitude, config.start_latitude.toString());
                localStorage.setItem(config.fetched_longitude, config.start_longitude.toString());
            }

            const hash = location.hash
            if (hash) {
                if (hash.startsWith('#id-')) {
                    Labs.openLab(hash.slice(4))
                    return
                }
                const elem = document.getElementById('hash');
                elem.setAttribute('href', hash)
                du.dispatchEvent(elem, 'click');
                return
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
    du.loadUrlToElem('menu', './html/menu.html').catch(err => console.log(err));
}

document.addEventListener('click', (e) => {
    let target = e.target;
    while(target) {
        // Menu and hash pages
        const href = target.getAttribute('href')
        if (href && href.startsWith('#')) {
            document.getElementById('symbol-menu').checked = false;
            switch(href.slice(1)) {
                case 'about':
                    config.count_labs = Labs.labs.length;
                    config.count_map = Object.keys(Map.map._layers).length;
                case 'help':
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
                        .then(res => {
                            du.setInnerHtml('friends-container', res[0]);
                            du.setSelectOptions('friend-username-select',  [...res[1],{'': 'Other:'}])
                            du.setChecked('symbol-page');
                        });
                    return false;
                case 'labs':
                    du.setChecked('symbol-labs');
                    return false;
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
                case 'qr':
                    du
                        .loadUrlToElem('popup', './html/qr-code.html')
                        .then(() => QrCode.show())
                        .then(() => du.setChecked('symbol-popup'))
                        .catch(err => console.error(err))
                    ;
                    return false;
            }
        }

        // Make radio buttons toggleable
        if (
            'radio' == target.getAttribute('type') &&
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

        if (target.id.startsWith('symbol-')) {
            // Handled by the change listener
            // Don't close the popups
            return false;
        }

        if (target.id.startsWith('map-')) {
            return Labs.openLab(target.id.slice(4));
        }

        if (
            'special-update' === target.id ||
            target.id.startsWith('special-update-')
        ) {
            const data = {
                'special': 'update-adventure',
            }
            if (target.id.startsWith('special-update-')) {
                data['id'] = target.id.slice('special-update-'.length);
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
                .then(res => changedPositionLarge())
                .catch(err => console.error(err))
            ;
        }

        if (target.classList.contains('log-button')) {
            const elem = document
                .getElementById('id'+target.dataset.id)
                .getElementsByClassName('lab')[0];
            elem.parentNode.classList.add('wait');

            Labs.
                logLab(
                    target.dataset.id,
                    elem.querySelector('select').value ||
                    elem.querySelector('input:nth-child(2)').value
                )
                .then(res => {
                    let color;
                    switch (res.Result) {
                        case 0:
                        case 3:
                            color = 'yellow';
                            const html = '' +
                                (res.JournalImageUrl ? '<img src="' + res.JournalImageUrl + '" />' : '') +
                                (res.JournalMessage ? res.JournalMessage.replace('\n', '<br />') : '') +
                                '';
                            du.setInnerHtml(
                                'popup',
                                '<div class="journal">' + html + '</div>'
                            );
                            const journal = document.getElementById(
                                'journal-' + elem.parentNode.id.slice(2)
                            );
                            if (journal) {
                                journal.innerHTML = html;
                                journal.classList.remove('hidden');
                            }
                            du.setChecked('symbol-popup')
                            break;
                        case 2:
                            color = 'orange';
                            break;
                        default:
                            color = 'red';
                    }
                    elem.parentNode.classList.remove('wait');
                    st.getSetting('hide-logged').then(hide_logged => {
                        if (hide_logged && 'yellow' == color) {
                            Labs.labs = Labs.labs.filter(lab => lab.id !== elem.parentNode.id.slice(2))
                            const circle = Map.id2layer(elem.parentNode.id.slice(2));
                            if (circle) {
                                Map.map.removeLayer(circle);
                            }
                            elem.remove();
                        } else {
                            Labs.setBorderColor(elem, color);
                            Labs
                                .labs
                                .filter(lab => 'id' + lab.id === elem.parentElement.id)
                                .forEach(lab => {
                                    lab.color = color;
                                    Map.setCircleColor(lab.id, color);
                                })
                            ;
                        }
                    })
                })
                .catch(err => console.error(err))
            ;
        }

        switch(target.id) {
            case 'give-friend':
                Labs
                    .getData({
                        'special': 'give-friend',
                        'id': pp.friendsBits() + ':::' +
                            (
                                document.getElementById('friend-username-select').value ||
                                document.getElementById('friend-username-select').value
                            )
                    })
                    .then(res => {
                        du.setInnerHtml('popup', res.message);
                        du.setChecked('symbol-popup')
                    })
                return false;
            case 'save-and-exit':
                st.getSetting('primary-page').then(primary_page => {
                    du.setChecked('symbol-' + primary_page)
                });
                return false;
            case 'restore-default-settings':
                st.clearSettings();
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
    du.setChecked('symbol-popup', false);
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
    }

    if (
        e.target.classList.contains('friend-selector') ||
        'friends-period' === e.target.name
    ) {
        const period = document.querySelector( 'input[name="friends-period"]:checked');
        du.setInnerHtml('friends-price', pp.friendsPrice() * (period ? period.value : 11));
        const bits_elem = document.getElementById('friends-bits')
        if (bits_elem) { bits_elem.value = pp.friendsBits(); }
    }

    switch(e.target.id) {
        case 'friends-bits':
            Array.from(document.getElementsByClassName('friend-selector')).forEach(x => {
                x.checked = x.value === (
                    x.dataset.bitValue &
                    // + to convert to int
                    +document.getElementById('friends-bits').value
                );
            })
            break;
        case 'symbol-map':
            if (e.target.checked) {
                Map.center();
            }
            break;
        case 'symbol-labs':
            changedPositionSmall().catch(err=>console.error(err));
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

init()