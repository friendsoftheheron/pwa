import cr from './crypto.js';
import du from './domutils.js';
import i18n from './i18n.js';
// We need the listeners of the modules below
import dr from './dual-range.js';
import rs from './resize.js';
import DomUtils from "./domutils.js";


export default class Settings {

    static prefix = 'setting-'
    static div = 'settings'
    static url = './html/settings.html'
    static encrypt_field_start = 'password'

    static getItem = (id) => new Promise((resolve, reject) => {
        const value = localStorage.getItem(this.prefix + id);
        if (null === value) {
            return reject('item not found: ' + id)
        }
        cr.decrypt(value)
            .then(plain => resolve(plain))
            .catch(() => resolve(value))
    })

    static setItem = (id ='', value='') => new Promise((resolve) => {
        cr.encrypt(value).then(cypher => {
            localStorage.setItem(
                this.prefix + id,
                id.startsWith(this.encrypt_field_start) ? cypher : value
            );
            return resolve(value);
        })
    })

    static getSetting = (id, resolve_to=null) => new Promise((resolve, reject) => {
        this.getItem(id)
            .then(value => resolve(value))
            .catch(() => {
                console.warn('Setting does not exist: ' + id);
                const elem = document.getElementById(id);
                if (null !== elem) {
                    return resolve(elem.dataset[du.camelcaseify(this.prefix + 'default')]);
                }
                console.warn('Setting element does exist: ' + id);
                if (null === resolve_to) {
                    reject('Setting not found: ' + id);
                } else {
                    resolve(resolve_to);
                }
            })
        ;
    })

    static updateSetting = (elem) => new Promise((resolve) =>
        this.setItem(elem.id, du.getElementValue(elem))
    )

    static addTemplate = (holder, data, options = {}) => {
        const _holder = du.elemOrId(holder);
        const _template = du.elemOrId(_holder.dataset.templateId);

        console.log('addTemplate', data.id)
        if (_holder.querySelector('input[type="radio"][name="'+(data.namePrefix||'')+data.id+'"]')) {
            console.warn('Id already exists:', data.id);
            return false;
        }

        const node = document.createElement('span');
        node.innerHTML = du.renderTemplate(i18n.translateHtml(_template.innerHTML), data);

        const nodes = Array
            .from(_holder.children)
            .filter(x => x.innerHTML.localeCompare(node.innerHTML) > 0)
        _holder.insertBefore(node, nodes.length ? nodes[0] : null);

        if (options.radio) {
            du.dispatchEvent(node.querySelector('[data-label-for-radio]'), 'click')
        }
    }

    static removeTemplate = (elem) => {
        const holder_id = elem.dataset.removeHolder;
        let node;
        while(elem && holder_id !== elem.id) {
            node = elem;
            elem = elem.parentNode;
        }
        if (!elem) {
            console.warn('Holder not found:', holder_id);
            return false;
        }
        node.querySelectorAll('input[type="radio"]').forEach(radio=> {
            // Very short timeout to prevent the radio click to reenter the local storage
            window.setTimeout(
                () => localStorage.removeItem(this.prefix+radio.id),
                6
            );

        });
        node.remove();
        return true;
    }

    static fillTemplate = (data) => new Promise((resolve, reject) => {
        const holder = du.elemOrId(data.holder);
        if (!holder) { return reject('No holder: ' + data.holder); }
        const template = du.elemOrId(holder.dataset.templateId);
        if (!template) { return reject('No holder: ' + data.holder); }
        holder.innerHTML='';
        data.data.forEach(data => {
            const node = document.createElement('span');
            node.innerHTML = du.renderTemplate(i18n.translateHtml(template.innerHTML), data);
            holder.append(node);
        });
        resolve(holder);
    })


    static fillSettingsDiv = (templates = []) => new Promise((resolve, reject) => {
        du.loadUrlToElem(this.div, this.url)
            .then(() => Promise.all(templates.map(t => this.fillTemplate(t))))
            .then(() => i18n.setLanguageSelector())
            .then(() => this.initialiseSettings())
            .then(() => this.getSetting('language', 'en'))
            .then(locale => i18n.locale = locale)
            .then(res => resolve(res))
            .catch(err => reject(err))
    });


    static clearSettings = () => {
        Array.from(document
            .querySelectorAll('[data-' + this.prefix + 'default]')
        )
            .forEach(elem => {
                localStorage.removeItem(this.prefix + elem.id);
                du.setElementValue(elem, elem.dataset[du.camelcaseify(this.prefix + 'default')]);
            })
    }

    static initialiseSettings = () =>
        Promise.all(
            Array.from(document
                .querySelectorAll('[data-' + this.prefix + 'default]')
            )
                .map(elem => new Promise((resolve) => {
                    this.getSetting(elem.id)
                        .then(value => this.setItem(elem.id, value))
                        .then(value => resolve(du.setElementValue(elem, value)))
                        .catch(err => { console.error(err); resolve(); })
                    })

                )
        )
    ;
}

document.addEventListener('change', (e) => {
    if (e.target.hasAttribute('data-'+Settings.prefix+'default')) {
        const name = 'INPUT' === e.target.tagName && 'radio' === e.target.getAttribute('type') && e.target.getAttribute('name');
        if (name) {
            document.getElementsByName(name).forEach(elem => Settings.updateSetting(elem).then());
        } else { Settings.updateSetting(e.target).then(); }
        let changes = JSON.parse(
            document
                .getElementById(Settings.div)
                .dataset
                .changes
        );
        if (!changes.includes(e.target.id)) {
            changes.push(e.target.id)
        }
        document
            .getElementById(Settings.div)
            .dataset
            .changes = JSON.stringify(changes)
    }

    if ('owners-select' === e.target.id) {
        const option = e.target.querySelector(`[value="${e.target.value}"]`)
        if (option) {
            Settings.addTemplate(
                e.target.dataset.holderId,
                {
                    'id': e.target.value,
                    'innerHTML': option.innerHTML,
                    'namePrefix': e.target.dataset.namePrefix,
                },
                {
                    radio: true,
                }
            );
        }
    }
});

document.addEventListener('click', e=> {
    if (e.target.dataset.removeHolder) { Settings.removeTemplate(e.target); }
});