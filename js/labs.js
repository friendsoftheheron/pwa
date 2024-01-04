import config from './config.js';
import du from './domutils.js';
import i18n from './i18n.js';
import Location from './location.js';
import Map from './map.js';
import st from './settings.js';

export default class Labs {
    static labs = null;
    static data_theme = {}

    static blockSize = () => new Promise(resolve =>
        Promise.all([
            st.getSetting('block-size'),
            st.getSetting('hide-logged'),
        ]).then(([block_size, hide_logged]) =>
            resolve(Math.max(block_size, 0.001) * (hide_logged ? -1 : +1))
        )
    );

    static appendFromQueryString = (data) => {
        window
            .location
            .search
            .substring(1) // Remove the '?'
            .split('&')
            .reduce((acc, part) => {
                const p = part.split('=');
                if (p[0]) {
                    if ('r' === p[0]) {
                        p[0] = 'referrer';
                    }
                    if (acc.hasOwnProperty(decodeURIComponent(p[0]))) {
                        acc[decodeURIComponent(p[0])] += ';' + decodeURIComponent(p[1])
                    } else {
                        acc[decodeURIComponent(p[0])] = decodeURIComponent(p[1])
                    }
                }
                return acc;
            }, data)
        ;
        return data;
    };

    static getData = (data = null) => new Promise((resolve, reject) => {
        Promise.all([
            st.getSetting('username'),
            st.getSetting('password'),
            st.getSetting('data-url'),
            st.getSetting('friend-bits'),
            st.getSetting('language'),
        ]).then(([
            username,
            password,
            data_url,
            friend_bits,
            language
        ]) => {
            if (null === data) {
                data = {};
            }
            this.appendFromQueryString(data);
            document
                .querySelector('[data-loading-counter]')
                .dataset
                .loadingCounter++;
            document.dispatchEvent(new MessageEvent('message', {data: 'fetch:' + JSON.stringify(data)}));

            data.latitude = data.latitude || localStorage.getItem(config.current_latitude) || 52.0880131;
            data.longitude = data.longitude || localStorage.getItem(config.current_longitude) || 5.1273913;
            data.username = username || '';
            data.password = password || '';
            data.friends = data.friends ?? (friend_bits || 0);
            data.language = language || 'en';
            const form_data = new FormData();
            Object.keys(data).forEach(key => form_data.append(key, data[key]));
            fetch(
                data_url || config.data_url,
                {
                    body: form_data,
                    method: 'POST',
                    mode: 'cors',
                }
            )
                .then(res => {
                    if (res.headers.get('content-type').includes('application/json')) {
                        return resolve(res.json());
                    }
                    return resolve(res.text());
                })
                .catch(err => reject(err))
                .finally(data => {
                    document
                        .querySelector('[data-loading-counter]')
                        .dataset
                        .loadingCounter--;
                    return resolve(data)
                })
            ;
        });
    });

    static extraLabProperties = (lab, source) => {
        lab.source = [source];
        lab.position = new Location(lab.location_latitude, lab.location_longitude);
        lab.linear_class = +lab.is_linear ? 'linear' : 'random';
        lab.theme_formatted = (lab.theme_ids||'0').split(',').map(x =>
            x ? `<div class="flex">
                <div class="theme ${Labs.data_theme[x].name.toLowerCase()}" title="${Labs.data_theme[x].name}"></div>
                <div class="tag" data-i18n-key="theme-${Labs.data_theme[x].name.toLowerCase()}"}">${Labs.data_theme[x].name}</div>
                </div>
        ` : ''
        ).join('');
        // <div class="theme other" ></div><div class="theme architecture" ></div>
        // No return, this us used as a procedure
    }

    static checkLabs = (labs, source) => {
        document.dispatchEvent(
            new MessageEvent(
                'message',
                {data: `checkLabs(${labs.labs.length}, ${labs.max_labs})`}
            )
        );
        const elem = document.getElementById('icon-'+source);
        if (elem) {
            if (labs.labs.length < labs.max_labs) {
                elem.classList.remove('alert')
            } else {
                elem.classList.add('alert')
            }
        }
    }

    static removeLabs = (labs, source) => {
        if (null === this.labs) { return }
        const ids = labs.labs.map(lab => lab.id);
        this.labs.map(lab => {
            if (ids.includes(lab.id)) {
                if (!lab.source.includes(source)) {
                    lab.source.push(source);
                }
            } else {
                lab.source = lab.source.filter(s => !s.includes(source))
            }
        });
        this.labs = this.labs.filter(lab => lab.source.length)
    }

    static addLabs = (labs, source) => {
        if (null === this.labs) {
            this.labs = [];
        }
        labs.labs.forEach(lab => {
            if (!this.labs.filter(l => l.id === lab.id).length) {
                Labs.extraLabProperties(lab, source);
                this.labs.push(lab);
            }
        })
    }

    static updateLabs = (labs, source) => {
        this.checkLabs(labs, source);
        this.removeLabs(labs, source);
        this.addLabs(labs, source);
        Map.updateLabs();
        this.showLabs();
    }

    static clear = () => {
        this.labs = null;
        const labs_holder = document.getElementById('labs-holder');
        if (!labs_holder) return false;
        Array
            .from(labs_holder.childNodes)
            .forEach(x => x.remove())
        ;
        Map.clear();
    }

    static refresh = () => new Promise((resolve, reject) => {
        const labs = this.labs = this.labs.filter(lab => lab.source.includes('id'));
        this.clear();
        this.labs = labs;
        Promise
            .all([
                this
                    .getLabs()
                    //.then(() => Labs.showLabs()),
            ].concat(Map.position ? [
                Map
                    .handleEndDrag()
                    //.then(() => Labs.showLabs())
            ] : [])
        )
            .then(() => Labs.showLabs())
            //.then(res => resolve(res))
            .catch(err => reject(err))
    });

    static updateLocalStorage = (id, values = null) => {
        const labs = JSON.parse(localStorage.getItem(config.fetched_labs));
        if (null === values) {
            labs.labs = labs.labs.filter(lab => lab.id !== id);
            labs.max_labs--;
        } else {
            labs.labs
                .filter(lab => lab.id === id)
                .forEach(lab => {
                    Object.keys(values).forEach(key => {
                        lab[key] = values[key];
                    });
                })
            ;
        }
        localStorage.setItem(config.fetched_labs, JSON.stringify(labs))
    }

    static setBorderColor = (elem, color) => {
        elem.classList.forEach(x => {
            if (x.startsWith('border-')) {
                elem.classList.remove(x);
            }
        })
        elem.classList.add('border-'+color)
    }

    static processDistance = (lab, current_position) => {
        lab.distance_actual = lab.position.distance(current_position);
        lab.distance = Math.max(0,  lab.distance_actual - lab.geofencing_radius);
        lab.distance_formatted = (lab.distance ? '' : '⊙') + Location.formatDistance(lab.distance || lab.distance_actual);
        lab.bearing = current_position.bearing(lab.position);
        lab.bearing_formatted = Location.formatBearing(lab.bearing)
        lab.needle_class = `needle${Math.floor(lab.bearing/5+0.5)*5}`
        return lab
    }
    static processDistances = () => {
        const current_position = new Location(
            localStorage.getItem(config.current_latitude),
            localStorage.getItem(config.current_longitude)
        );
        this.labs.map(lab => this.processDistance(lab, current_position));
    }

    static sortLabs = () => {
        if (null === this.labs) { return }
        this.labs.sort((a, b) =>
            Math.sign(a.distance - b.distance) ||
            a.adventure.localeCompare(b.adventure) ||
            Math.sign(a._nr - b._nr)
        )
    }

    static showLab = (lab, template, holder) => {
        let node;
        node = document.getElementById('id' + lab.id);
        if (!node) {
            node = document.createElement('div');
            node.id = 'id' + lab.id;
            node.innerHTML = du.renderTemplate(i18n.translateHtml(template.innerHTML), lab);
        }
        node.dataset.distance = lab.distance;

        this.processDistance(
            lab,
            new Location(
                localStorage.getItem(config.current_latitude),
                localStorage.getItem(config.current_longitude)
            )
        );

        if (!lab.distance_formatted) {
            console.error('Not formatted', lab);
        }

        Labs.setBorderColor(du.getElementByClassName('lab', node), lab.color);
        du.getElementByClassName('compass', node).classList.value='compass '+ lab.needle_class;
        du.getElementByClassName('distance', node).innerHTML = lab.distance_formatted;
        du.getElementByClassName('bearing', node).innerHTML = lab.bearing_formatted;
        if (!node.getElementsByTagName('input')[0].checked) {
            holder.appendChild(node);
        }
        return node
    }

    static showLabs = () => {
        console.log('showLabs');
        if (null === this.labs) { return }
        this.processDistances();
        this.sortLabs()

        const labs_holder = document.getElementById('labs-holder');
        if (!labs_holder) {
            console.error('labs element not found');
            return null;
        }

        if (0 === this.labs.length) {
            const template = document.getElementById('no-labs-template');
            if (!template) {
                console.error('Lab template not found');
                return null;
            }
            labs_holder.innerHTML = i18n.translateHtml(template.innerHTML);
            return labs_holder;
        }

        const template = document.getElementById('lab_template');
        if (!template) {
            console.error('Lab template not found');
            return null;
        }

        const ids = this.labs.map(lab => 'id'+lab.id);
        Array
            .from(labs_holder.children)
            .forEach(
                lab => {
                    if (!ids.includes(lab.getAttribute('id'))) {
                        lab.remove();
                    }
                }
            )
        ;

        this.labs.forEach(lab => {
            this.showLab(lab, template, labs_holder)
        })
        return labs_holder;
    }

    static getLabs = () => new Promise((resolve, reject) => {
        this.blockSize().then(block_size => {
            Labs
                .getData({
                    block_size: block_size,
                    filters: localStorage.getItem(config.filters_key),
                })
                .then(labs => {
                    localStorage.setItem(config.fetched_labs, JSON.stringify(labs));
                    this.updateLabs(labs, 'labs')
                    return resolve(labs);
                })
                .catch(err => reject(err))
            ;
        })
    });


    static getDetail = (id) => new Promise((resolve, reject) => {
        const labs = null !== this.labs ? this.labs.filter(lab => id === lab.id) : [];
        if (labs.length && labs[0].hasOwnProperty('description')) {
            resolve(labs[0])
        }
        this
            .getData({id: id})
            .then(lab => {
                if (labs.length) {
                    lab = {...labs[0], ...lab};
                }
                if (!lab.hasOwnProperty('position')) {
                    Labs.extraLabProperties(lab, 'id');
                }
                if (!labs.length) {
                    if (null === this.labs) {
                        this.labs = [lab]
                    } else {
                        this.labs.push(lab)
                    }
                }
                return resolve(lab)
            })
            .catch(err => reject(err))
    })

    static showDetail = (lab) => {
        const elem = document.getElementById('id'+ lab.id);
        if (!elem) {
            console.error('Element not found: id'+lab.id);
            return null;
        }
        du.setInnerHtmlByQuery('.description', lab.description.trim().replace('\n', '<br />'), elem);
        du.setInnerHtmlByQuery('.challenge', lab.question, elem);
        du.setInnerHtmlByQuery('.country', lab.country, elem);
        du.setInnerHtmlByQuery('.flag', lab.flag, elem);
        du.setInnerHtmlByQuery('.journal', lab.journal, elem);
        du.setInnerHtmlByQuery('.median-time-to-complete', lab.median_time_to_complete, elem);
        du.setInnerHtmlByQuery('.owner', lab.owner, elem);
        du.setInnerHtmlByQuery('.published-utc', lab.published_utc, elem);
        du.setInnerHtmlByQuery('.ratings-average', lab.ratings_average, elem);
        du.setInnerHtmlByQuery('.ratings-total-count', lab.ratings_total_count, elem);
        du.setInnerHtmlByQuery('.themes', lab.theme_formatted, elem);

        if (lab.journal) {
            elem.querySelector('.journal').classList.remove('hidden');
        }

        const select = elem.querySelector('.answer').querySelector('select');
        const input = elem.querySelector('.answer').querySelector('input');

        if (lab.choices) {
            let option;
            select && lab.choices.split('\n').forEach(x => {
                option = document.createElement('option');
                option.textContent = x;
                option.value = x.replace(/\s/g, '').toLowerCase();
                option.selected = option.value === lab.completion_code;
                select.appendChild(option);
            })
            input && input.classList.add('hidden');
        } else {
            select && select.classList.add('hidden');
        }
        input && (input.value = lab.completion_code);

        elem.getElementsByClassName('details')[1].classList.remove('blur');
    }

    static openLab = (id) => {
        this
            .getDetail(id)
            .then(lab => {
                if (!document.getElementById('id'+id)) {
                    this.showLab(
                        lab,
                        document.getElementById('lab_template'),
                        document.getElementById('labs-holder')
                    );
                }
                this.showDetail(lab);
                du.setChecked('symbol-labs');
                const elem = document.getElementById('details-'+id);
                if (elem) {
                    elem.parentElement.scrollIntoView(true);
                    du.setChecked(elem);
                    elem.parentElement.scrollIntoView(true);
                    return elem;
                }
            });
    }

    static logLab = (id, code) => new Promise((resolve, reject) => {
        Labs
            .getData({id: id, code: code})
            .then(x => resolve(x))
            .catch(err => reject(err))
    })
}

